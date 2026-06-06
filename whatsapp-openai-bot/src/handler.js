import { getLead, createLead, updateLead, deleteLead, getMessages, setMessages } from './db.js';
import { runConversation, appendUserText } from './claude.js';
import { sendText, setPresence } from './evolution.js';
import { createDispatcher } from './tools.js';
import { scheduleNextFollowUp } from './followup.js';
import { logger } from './logger.js';

const inFlight = new Map();
const MAX_HISTORY_TURNS = 60;

export function isBusy(phone) {
  return inFlight.has(phone);
}

export function parseMessage(event) {
  if (!event || event.event !== 'messages.upsert') return null;

  const data = event.data;
  if (!data || !data.key || data.key.fromMe) return null;

  const remoteJid = data.key.remoteJid || '';
  if (remoteJid.endsWith('@g.us') || remoteJid.endsWith('@broadcast')) return null;

  const phone = remoteJid.replace(/@s\.whatsapp\.net$/, '').replace(/@c\.us$/, '');
  if (!phone) return null;

  const msg = data.message || {};
  const text =
    msg.conversation ||
    msg.extendedTextMessage?.text ||
    msg.imageMessage?.caption ||
    msg.videoMessage?.caption ||
    '';

  if (!text || !text.trim()) return null;
  return { phone, text: text.trim(), remoteJid };
}

export async function handleIncoming(event) {
  const parsed = parseMessage(event);
  if (!parsed) return { skipped: true };

  const { phone, text } = parsed;

  if (inFlight.has(phone)) {
    logger.warn({ phone }, 'Dropping message: previous run still in flight');
    return { skipped: true, reason: 'busy' };
  }

  const job = process(phone, text).finally(() => inFlight.delete(phone));
  inFlight.set(phone, job);
  return job;
}

async function process(phone, text) {
  if (text.toLowerCase() === '/reset') {
    deleteLead(phone);
    await sendText(phone, 'Conversa reiniciada. Pode mandar a próxima mensagem.');
    return { reset: true };
  }

  let lead = getLead(phone);
  if (!lead) {
    lead = createLead(phone);
    logger.info({ phone }, 'Created new lead');
  }

  updateLead(phone, {
    last_inbound_at: Date.now(),
    follow_up_count: 0,
    follow_up_next_at: null
  });

  setPresence(phone, 'composing');

  const history = appendUserText(getMessages(phone), text);
  const { history: finalHistory, reply } = await runConversation(
    history,
    createDispatcher(phone)
  );

  setMessages(phone, trimHistory(finalHistory));

  if (reply) {
    await sendText(phone, reply);
    updateLead(phone, { last_outbound_at: Date.now() });
  }

  const fresh = getLead(phone);
  if (fresh && !['signed', 'lost'].includes(fresh.stage)) {
    scheduleNextFollowUp(phone, 0);
  }

  return { phone, stage: fresh?.stage, replyChars: reply?.length || 0 };
}

function trimHistory(history) {
  if (history.length <= MAX_HISTORY_TURNS) return history;
  const start = history.length - MAX_HISTORY_TURNS;
  for (let i = start; i < history.length; i++) {
    const m = history[i];
    if (m.role === 'user' && typeof m.content === 'string') {
      return history.slice(i);
    }
  }
  return history;
}

export async function runFollowUp(lead, message) {
  if (inFlight.has(lead.phone)) return { skipped: true, reason: 'busy' };

  const job = (async () => {
    await sendText(lead.phone, message);
    const messages = getMessages(lead.phone);
    messages.push({
      role: 'user',
      content: `[SISTEMA] Follow-up automático enviado ao cliente: "${message}"`
    });
    setMessages(lead.phone, trimHistory(messages));
    return { sent: true };
  })().finally(() => inFlight.delete(lead.phone));

  inFlight.set(lead.phone, job);
  return job;
}
