import { config } from './config.js';
import { logger } from './logger.js';
import { dueFollowUps, getLead, updateLead } from './db.js';
import { runFollowUp, isBusy } from './handler.js';
import { CASES, findCase } from './cases.js';

const LOST_MESSAGE = `Esta será minha última mensagem para não ser inconveniente. 🙏

Se em algum momento quiser retomar a conversa, estarei aqui à disposição.

Abraço, ${config.lawyer.name}.`;

let timer = null;

export function startFollowUpScheduler() {
  if (!config.followUp.enabled) {
    logger.info('Follow-up scheduler disabled');
    return;
  }
  const tick = async () => {
    try {
      await processDue();
    } catch (err) {
      logger.error({ err: err.message }, 'follow-up tick failed');
    }
  };
  timer = setInterval(tick, config.followUp.scanIntervalMs);
  if (timer.unref) timer.unref();
  tick();
  logger.info(
    { intervalMs: config.followUp.scanIntervalMs, delaysMs: config.followUp.delaysMs },
    'Follow-up scheduler started'
  );
}

export function stopFollowUpScheduler() {
  if (timer) clearInterval(timer);
  timer = null;
}

export function scheduleNextFollowUp(phone, currentCount) {
  const idx = Number(currentCount) || 0;
  const delays = config.followUp.delaysMs;
  if (idx >= delays.length) {
    updateLead(phone, { follow_up_next_at: null });
    return null;
  }
  const nextAt = Date.now() + delays[idx];
  updateLead(phone, { follow_up_next_at: nextAt });
  return nextAt;
}

async function processDue() {
  const leads = dueFollowUps();
  if (!leads.length) return;
  for (const lead of leads) {
    if (isBusy(lead.phone)) continue;
    await sendOne(lead);
  }
}

function buildMessage(attempt, lead) {
  const firstName = lead.client_name ? String(lead.client_name).split(' ')[0] : null;
  const p = firstName ? `${firstName}, ` : '';
  const c = findCase(lead.case_type) || CASES.golpe_pix;
  const socialProof = c.followUp?.socialProof || '';
  const urgency = c.followUp?.urgency || '';

  switch (attempt) {
    case 1:
      return `Oi${firstName ? `, ${firstName}` : ''}! 👋 Passei para saber se ficou alguma dúvida sobre o que conversamos.

A análise inicial não tem custo nenhum — se quiser conversar mais, estou por aqui.`;

    case 2:
      return `${firstName ? firstName + ', s' : 'S'}ó um retorno rápido. ⚖️

Para você ter uma referência: ${socialProof}.

Se quiser saber como funcionaria no seu caso, me chama.`;

    case 3:
      return `${p}passando por aqui porque o tempo importa no seu caso. ⏰

${urgency ? urgency.charAt(0).toUpperCase() + urgency.slice(1) + '.' : ''}

Se quiser que eu analise seu caso essa semana, posso priorizar. É só me avisar.`;

    default:
      return LOST_MESSAGE;
  }
}

async function sendOne(lead) {
  const maxAttempts = config.followUp.delaysMs.length;
  const attempt = lead.follow_up_count + 1;
  const isFinal = attempt >= maxAttempts;
  const message = buildMessage(attempt, lead);

  try {
    await runFollowUp(lead, message);
  } catch (err) {
    logger.error({ phone: lead.phone, err: err.message }, 'follow-up send failed');
    return;
  }

  if (isFinal) {
    updateLead(lead.phone, {
      stage: 'lost',
      lost_reason: 'Sem resposta após follow-ups',
      follow_up_count: attempt,
      follow_up_next_at: null,
      last_outbound_at: Date.now()
    });
    logger.info({ phone: lead.phone }, 'Lead marked as lost after follow-ups');
    return;
  }

  updateLead(lead.phone, {
    follow_up_count: attempt,
    last_outbound_at: Date.now()
  });
  scheduleNextFollowUp(lead.phone, attempt);
}
