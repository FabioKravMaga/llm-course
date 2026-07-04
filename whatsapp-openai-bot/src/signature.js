import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { request } from 'undici';
import { config } from './config.js';
import { logger } from './logger.js';

export async function sendForSignature(lead, pdfPath) {
  if (config.signature.provider === 'zapsign') return zapsign(lead, pdfPath);
  return mock(lead, pdfPath);
}

async function mock(lead, pdfPath) {
  const id = `mock_${Date.now()}`;
  const url = config.signature.publicBaseUrl
    ? `${config.signature.publicBaseUrl}/contracts/${basename(pdfPath)}`
    : `https://example.invalid/sign/${id}`;
  logger.warn({ phone: lead.phone, url }, 'Using mock signature provider — set SIGNATURE_PROVIDER=zapsign for production');
  return { contractId: id, signUrl: url, provider: 'mock' };
}

async function zapsign(lead, pdfPath) {
  if (!config.signature.zapsignToken) throw new Error('ZAPSIGN_TOKEN not set');

  const pdf = await readFile(pdfPath);
  const base64 = pdf.toString('base64');

  const phoneDigits = lead.phone.replace(/\D/g, '');
  const country = phoneDigits.startsWith('55') ? '55' : '';
  const number = country ? phoneDigits.slice(2) : phoneDigits;

  const { statusCode, body } = await request('https://api.zapsign.com.br/api/v1/docs/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.signature.zapsignToken}`
    },
    body: JSON.stringify({
      name: `Contrato de honorários — ${lead.client_name || lead.phone}`,
      base64_pdf: base64,
      signers: [
        {
          name: lead.client_name || `Cliente ${lead.phone}`,
          phone_country: country || '55',
          phone_number: number,
          send_automatic_whatsapp: false,
          auth_mode: 'assinaturaTela'
        }
      ],
      lang: 'pt-br',
      disable_signer_emails: true
    })
  });
  const payload = await body.json();
  if (statusCode >= 300) {
    throw new Error(`ZapSign error (${statusCode}): ${JSON.stringify(payload)}`);
  }
  const signer = payload.signers?.[0];
  return {
    contractId: payload.token || payload.open_id,
    signUrl: signer?.sign_url,
    provider: 'zapsign'
  };
}
