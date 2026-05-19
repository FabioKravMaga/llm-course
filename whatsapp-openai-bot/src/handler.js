import { getThreadId, saveThread, touchThread, resetThread } from './db.js';
import { createThread, addUserMessage, runAndWait } from './openai.js';
import { sendText, setPresence } from './evolution.js';
import { logger } from './logger.js';

const inFlight = new Map();

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
    resetThread(phone);
    await sendText(phone, 'Conversa reiniciada. Pode mandar a próxima mensagem.');
    return { reset: true };
  }

  let threadId = getThreadId(phone);
  if (!threadId) {
    threadId = await createThread();
    saveThread(phone, threadId);
    logger.info({ phone, threadId }, 'Created new thread');
  }

  setPresence(phone, 'composing');

  await addUserMessage(threadId, text);
  const reply = await runAndWait(threadId);
  touchThread(phone);

  await sendText(phone, reply);
  return { phone, threadId, replyChars: reply.length };
}
