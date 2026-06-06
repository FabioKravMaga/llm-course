import { config } from './config.js';
import { logger } from './logger.js';
import { dueFollowUps, getLead, updateLead } from './db.js';
import { runFollowUp, isBusy } from './handler.js';

const messagesByStage = {
  new: [
    'Olá! Vi que paramos a conversa. Posso te ajudar com sua questão jurídica?',
    'Oi! Ainda está por aí? Se quiser, podemos retomar quando for melhor para você.',
    'Sem problemas se não for o momento. Estou à disposição quando precisar.'
  ],
  qualifying: [
    'Oi! Para te enviar uma proposta adequada, ainda preciso entender melhor o seu caso. Pode me passar mais detalhes?',
    'Tudo bem? Estou aqui para te ajudar a avaliar sua situação. Quer continuar de onde paramos?',
    'Vou deixar nosso atendimento em standby. Quando quiser retomar, é só me chamar por aqui.'
  ],
  proposal: [
    'Tudo certo com a proposta de honorários que enviei? Posso esclarecer qualquer dúvida sobre valor ou condições.',
    'Aproveitando, a proposta segue valendo. Posso ajustar alguma condição para facilitar para você?',
    'Vou aguardar seu retorno sobre a proposta. Se preferir reagendar, me avise.'
  ],
  contract: [
    'O contrato de honorários está te esperando para assinatura. Posso te ajudar a finalizar?',
    'Oi! Te enviei o link do contrato. Está com alguma dificuldade para assinar?',
    'Vou aguardar a assinatura. Se preferir outro formato ou tiver dúvidas, me avise.'
  ]
};

const LOST_MESSAGE =
  'Sem problemas, vou encerrar esse atendimento por aqui. Se mudar de ideia, é só me chamar — estarei à disposição.';

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

async function sendOne(lead) {
  const stage = lead.stage in messagesByStage ? lead.stage : 'new';
  const idx = Math.min(lead.follow_up_count, messagesByStage[stage].length - 1);
  const message = messagesByStage[stage][idx];

  const maxAttempts = config.followUp.delaysMs.length;
  const isFinal = lead.follow_up_count + 1 >= maxAttempts;

  try {
    await runFollowUp(lead, message);
  } catch (err) {
    logger.error({ phone: lead.phone, err: err.message }, 'follow-up send failed');
    return;
  }

  const nowCount = lead.follow_up_count + 1;
  if (isFinal) {
    try {
      await runFollowUp(getLead(lead.phone), LOST_MESSAGE);
    } catch {}
    updateLead(lead.phone, {
      stage: 'lost',
      lost_reason: 'Sem resposta após follow-ups',
      follow_up_count: nowCount,
      follow_up_next_at: null,
      last_outbound_at: Date.now()
    });
    logger.info({ phone: lead.phone }, 'Lead marked as lost after follow-ups');
    return;
  }

  updateLead(lead.phone, {
    follow_up_count: nowCount,
    last_outbound_at: Date.now()
  });
  scheduleNextFollowUp(lead.phone, nowCount);
}
