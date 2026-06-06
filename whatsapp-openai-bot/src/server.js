import express from 'express';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { config } from './config.js';
import { logger } from './logger.js';
import { handleIncoming } from './handler.js';
import { startFollowUpScheduler } from './followup.js';
import { findLeadByContract, updateLead } from './db.js';
import { sendText } from './evolution.js';

const app = express();
app.use(express.json({ limit: '5mb' }));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', instance: config.evolutionInstance });
});

app.post('/webhook/:token?', (req, res) => {
  if (config.webhookToken && req.params.token !== config.webhookToken) {
    return res.status(401).json({ error: 'invalid token' });
  }

  res.status(200).json({ received: true });

  Promise.resolve()
    .then(() => handleIncoming(req.body))
    .catch((err) => {
      logger.error({ err: err.message, stack: err.stack }, 'handleIncoming failed');
    });
});

app.post('/sign-webhook/:token?', (req, res) => {
  const expected = config.signature.zapsignWebhookSecret;
  if (expected) {
    const sig = req.headers['x-zapsign-signature'] || req.params.token || '';
    if (!verifyHmac(JSON.stringify(req.body || {}), sig, expected)) {
      return res.status(401).json({ error: 'invalid signature' });
    }
  }

  res.status(200).json({ received: true });

  const eventType = req.body?.event_type;
  const contractId = req.body?.token || req.body?.open_id || req.body?.doc?.token;

  if (eventType === 'doc_signed' && contractId) {
    Promise.resolve()
      .then(() => onContractSigned(contractId))
      .catch((err) => logger.error({ err: err.message }, 'onContractSigned failed'));
  }
});

async function onContractSigned(contractId) {
  const lead = findLeadByContract(contractId);
  if (!lead) {
    logger.warn({ contractId }, 'Contract signed webhook for unknown lead');
    return;
  }
  updateLead(lead.phone, {
    stage: 'signed',
    follow_up_next_at: null,
    last_outbound_at: Date.now()
  });
  await sendText(
    lead.phone,
    'Recebi a confirmação da sua assinatura! Contrato fechado, vamos iniciar o trabalho. Em breve te dou os próximos passos.'
  );
  logger.info({ phone: lead.phone, contractId }, 'Lead signed — contract closed');
}

function verifyHmac(payload, providedHex, secret) {
  try {
    const computed = createHmac('sha256', secret).update(payload).digest('hex');
    const a = Buffer.from(computed, 'hex');
    const b = Buffer.from(String(providedHex).replace(/^sha256=/, ''), 'hex');
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

app.listen(config.port, () => {
  logger.info(
    { port: config.port, instance: config.evolutionInstance },
    'WhatsApp bot listening'
  );
  startFollowUpScheduler();
});

process.on('unhandledRejection', (reason) => {
  logger.error({ reason: String(reason) }, 'unhandledRejection');
});
