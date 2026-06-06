import { getLead, updateLead } from './db.js';
import { sendText } from './evolution.js';
import { buildContractPdf } from './contract.js';
import { sendForSignature } from './signature.js';
import { config } from './config.js';
import { logger } from './logger.js';

export const assistantTools = [
  {
    type: 'function',
    function: {
      name: 'update_lead',
      description:
        'Salva ou atualiza dados estruturados do cliente coletados na conversa. Chame sempre que descobrir um dado novo.',
      parameters: {
        type: 'object',
        properties: {
          client_name: { type: 'string', description: 'Nome completo do cliente' },
          case_type: {
            type: 'string',
            description: 'Categoria do caso (ex: trabalhista, civil, previdenciario, familia, criminal, tributario, consumidor)'
          },
          case_summary: { type: 'string', description: 'Resumo da demanda em até 3 frases' },
          urgency: { type: 'string', enum: ['baixa', 'media', 'alta'] },
          notes: { type: 'string', description: 'Observações livres relevantes' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'set_stage',
      description:
        'Avança o estágio do funil. Use "qualifying" quando começar a coletar dados, "proposal" quando já souber o que cobrar.',
      parameters: {
        type: 'object',
        properties: {
          stage: {
            type: 'string',
            enum: ['qualifying', 'proposal', 'contract', 'signed', 'lost']
          },
          notes: { type: 'string' }
        },
        required: ['stage']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'send_proposal',
      description:
        'Envia uma proposta de honorários ao cliente via WhatsApp. Salva escopo, valor e condições no lead.',
      parameters: {
        type: 'object',
        properties: {
          fee_amount: { type: 'number', description: 'Valor total em reais (BRL)' },
          payment_terms: {
            type: 'string',
            description: 'Forma de pagamento (à vista, parcelado em X vezes no PIX/cartão, etc.)'
          },
          scope: { type: 'string', description: 'Descrição do escopo do serviço advocatício' }
        },
        required: ['fee_amount', 'payment_terms', 'scope']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'send_contract',
      description:
        'Gera o contrato de honorários em PDF e envia o link para assinatura digital. Chame somente após o cliente aceitar verbalmente a proposta.',
      parameters: {
        type: 'object',
        properties: {
          confirmation: { type: 'string', description: 'Trecho da fala do cliente aceitando a proposta' }
        },
        required: ['confirmation']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'mark_as_lost',
      description: 'Marca o lead como perdido (sem perfil, desistiu, fora do escopo, etc.).',
      parameters: {
        type: 'object',
        properties: {
          reason: { type: 'string' }
        },
        required: ['reason']
      }
    }
  }
];

export function createDispatcher(phone) {
  return async (name, args) => {
    switch (name) {
      case 'update_lead':
        return updateLeadTool(phone, args);
      case 'set_stage':
        return setStageTool(phone, args);
      case 'send_proposal':
        return sendProposalTool(phone, args);
      case 'send_contract':
        return sendContractTool(phone, args);
      case 'mark_as_lost':
        return markLostTool(phone, args);
      default:
        return { error: `unknown_tool:${name}` };
    }
  };
}

function updateLeadTool(phone, args) {
  const patch = {};
  for (const k of ['client_name', 'case_type', 'case_summary', 'urgency', 'notes']) {
    if (args[k] != null && String(args[k]).trim() !== '') patch[k] = String(args[k]).trim();
  }
  const lead = updateLead(phone, patch);
  return { ok: true, lead: pick(lead) };
}

function setStageTool(phone, args) {
  const patch = { stage: args.stage };
  if (args.notes) patch.notes = args.notes;
  if (args.stage === 'lost' && args.notes) patch.lost_reason = args.notes;
  const lead = updateLead(phone, patch);
  return { ok: true, stage: lead.stage };
}

async function sendProposalTool(phone, args) {
  const { fee_amount, payment_terms, scope } = args;
  const lead = updateLead(phone, {
    stage: 'proposal',
    fee_amount,
    payment_terms,
    scope
  });

  const valor = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(Number(fee_amount) || 0);

  const proposalText =
    `*Proposta de honorários*\n\n` +
    `*Escopo:* ${scope}\n` +
    `*Honorários:* ${valor}\n` +
    `*Pagamento:* ${payment_terms}\n\n` +
    `${config.lawyer.pixKey ? `PIX para pagamento: ${config.lawyer.pixKey}\n` : ''}` +
    `Se estiver de acordo, me confirme por aqui que já envio o contrato para sua assinatura digital.`;

  await sendText(phone, proposalText);
  return { ok: true, sent: true, lead: pick(lead) };
}

async function sendContractTool(phone, args) {
  const lead = getLead(phone);
  if (!lead) return { error: 'lead_not_found' };
  if (!lead.fee_amount || !lead.payment_terms || !lead.scope) {
    return { error: 'missing_proposal_data', hint: 'Chame send_proposal antes de send_contract.' };
  }

  const pdfPath = await buildContractPdf(lead);
  const sig = await sendForSignature(lead, pdfPath);

  updateLead(phone, {
    stage: 'contract',
    contract_id: sig.contractId,
    contract_sign_url: sig.signUrl,
    contract_pdf_path: pdfPath,
    notes: args.confirmation ? `Aceite: ${args.confirmation}` : undefined
  });

  const message =
    `*Contrato de honorários pronto para assinatura*\n\n` +
    `Para finalizar, basta assinar digitalmente neste link:\n${sig.signUrl}\n\n` +
    `Assim que assinado, recebo o aviso automaticamente e damos início ao trabalho.`;

  await sendText(phone, message);

  logger.info({ phone, contractId: sig.contractId, provider: sig.provider }, 'Contract sent for signature');
  return { ok: true, contract_id: sig.contractId, sign_url: sig.signUrl };
}

function markLostTool(phone, args) {
  const lead = updateLead(phone, {
    stage: 'lost',
    lost_reason: args.reason || null,
    follow_up_next_at: null
  });
  return { ok: true, stage: lead.stage };
}

function pick(lead) {
  if (!lead) return null;
  const { phone, stage, client_name, case_type, urgency, fee_amount, payment_terms } = lead;
  return { phone, stage, client_name, case_type, urgency, fee_amount, payment_terms };
}
