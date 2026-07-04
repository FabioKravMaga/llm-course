import { request } from 'undici';
import { config } from './config.js';

const baseHeaders = {
  'Content-Type': 'application/json',
  apikey: config.evolutionApiKey
};

export async function sendText(phone, text) {
  const url = `${config.evolutionUrl}/message/sendText/${encodeURIComponent(config.evolutionInstance)}`;
  const { statusCode, body } = await request(url, {
    method: 'POST',
    headers: baseHeaders,
    body: JSON.stringify({
      number: phone,
      text
    })
  });
  const payload = await body.text();
  if (statusCode >= 300) {
    throw new Error(`Evolution sendText failed (${statusCode}): ${payload}`);
  }
}

export async function setPresence(phone, presence) {
  const url = `${config.evolutionUrl}/chat/sendPresence/${encodeURIComponent(config.evolutionInstance)}`;
  await request(url, {
    method: 'POST',
    headers: baseHeaders,
    body: JSON.stringify({ number: phone, presence, delay: 1200 })
  }).catch(() => {});
}
