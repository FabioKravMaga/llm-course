import { getLead, createLead, updateLead, deleteLead } from './db.js';
import { createThread, addUserMessage, runAndWait } from './openai.js';
import { sendText, setPresence } from './evolution.js';
import { createDispatcher } from './tools.js';
import { scheduleNextFollowUp } from './followup.js';
import { logger } from './logger.js';

const inFlight = new Map();

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
    const threadId = await createThread();
    lead = createLead(phone, threadId);
    logger.info({ phone, threadId: lead.thread_id }, 'Created new lead');
  }

  updateLead(phone, {
    last_inbound_at: Date.now(),
    follow_up_count: 0,
    follow_up_next_at: null
  });

  setPresence(phone, 'composing');

  await addUserMessage(lead.thread_id, text);
  const reply = await runAndWait(lead.thread_id, createDispatcher(phone));

  if (reply) await sendText(phone, reply);

  const fresh = getLead(phone);
  if (fresh && !['signed', 'lost'].includes(fresh.stage)) {
    scheduleNextFollowUp(phone, 0);
  }

  return { phone, stage: fresh?.stage, replyChars: reply?.length || 0 };
}

export async function runFollowUp(lead, message) {
  if (inFlight.has(lead.phone)) return { skipped: true, reason: 'busy' };

  const job = (async () => {
    await sendText(lead.phone, message);
    const nextCount = lead.follow_up_count + 1;
    await addUserMessage(
      lead.thread_id,
      `[SISTEMA] Follow-up automático #${nextCount} enviado ao cliente: "${message}"`
    ).catch(() => {});
    return { sent: true };
  })().finally(() => inFlight.delete(lead.phone));

  inFlight.set(lead.phone, job);
  return job;
}
