import { getLead, updateLead } from './db.js';
import { sendText } from './evolution.js';
import { buildContractPdf } from './contract.js';
import { sendForSignature } from './signature.js';
import { CASES, CASE_TYPE_IDS, MENU_CASOS, findCase } from './cases.js';
import { logger } from './logger.js';

export const tools = [
  {
    name: 'send_menu',
    description:
      'Envia ao cliente o menu numerado das 7 áreas de atuação do escritório. Chame apenas na primeiríssima interação (stage=new) ou quando o cliente pedir para começar de novo.',
    input_schema: { type: 'object', properties: {} }
  },
  {
    name: 'send_thesis',
    description:
      'Envia a tese jurídica pronta do escritório para o case_type informado (2 mensagens: abertura empática + fundamentação com perguntas para coleta). Chame após identificar o case_type.',
    input_schema: {
      type: 'object',
      properties: {
        case_type: { type: 'string', enum: CASE_TYPE_IDS }
      },
      required: ['case_type']
    }
  },
  {
    name: 'update_lead',
    description:
      'Salva ou atualiza dados estruturados do lead. Chame sempre que descobrir um dado novo (case_type, nome, resumo, urgência).',
    input_schema: {
      type: 'object',
      properties: {
        client_name: { type: 'string', description: 'Nome completo do cliente' },
        case_type: { type: 'string', enum: CASE_TYPE_IDS },
        case_summary: { type: 'string', description: 'Resumo do caso em até 3 frases' },
        urgency: { type: 'string', enum: ['baixa', 'media', 'alta'] },
        notes: { type: 'string' }
      }
    }
  },
  {
    name: 'set_stage',
    description: 'Avança o estágio do funil.',
    input_schema: {
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
  },
  {
    name: 'send_proposal',
    description:
      'Envia ao cliente a proposta pronta do escritório para o case_type do lead, com o modelo de honorários correto. Requer que o lead já tenha case_type definido. Avança o estágio para proposal.',
    input_schema: { type: 'object', properties: {} }
  },
  {
    name: 'send_contract',
    description:
      'Gera o contrato de honorários em PDF e envia o link de assinatura digital. Chame somente após o cliente aceitar verbalmente e informar o nome completo (client_name).',
    input_schema: {
      type: 'object',
      properties: {
        confirmation: {
          type: 'string',
          description: 'Trecho da fala do cliente aceitando a proposta'
        }
      },
      required: ['confirmation']
    }
  },
  {
    name: 'mark_as_lost',
    description: 'Marca o lead como perdido (desistiu, fora do escopo, sem perfil).',
    input_schema: {
      type: 'object',
      properties: { reason: { type: 'string' } },
      required: ['reason']
    }
  }
];

export function createDispatcher(phone) {
  return async (name, args) => {
    switch (name) {
      case 'send_menu':
        return sendMenuTool(phone);
      case 'send_thesis':
        return sendThesisTool(phone, args);
      case 'update_lead':
        return updateLeadTool(phone, args);
      case 'set_stage':
        return setStageTool(phone, args);
      case 'send_proposal':
        return sendProposalTool(phone);
      case 'send_contract':
        return sendContractTool(phone, args);
      case 'mark_as_lost':
        return markLostTool(phone, args);
      default:
        return { error: `unknown_tool:${name}` };
    }
  };
}

async function sendMenuTool(phone) {
  await sendText(phone, MENU_CASOS);
  return { ok: true, sent: 'menu' };
}

async function sendThesisTool(phone, args) {
  const c = findCase(args.case_type);
  if (!c) return { error: 'invalid_case_type' };
  updateLead(phone, { case_type: args.case_type, stage: 'qualifying' });
  for (const line of c.thesis) {
    await sendText(phone, line);
    await sleep(1200);
  }
  return { ok: true, sent: 'thesis', case_type: args.case_type };
}

function updateLeadTool(phone, args) {
  const patch = {};
  if (args.case_type && CASE_TYPE_IDS.includes(args.case_type)) {
    patch.case_type = args.case_type;
  }
  for (const k of ['client_name', 'case_summary', 'urgency', 'notes']) {
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

async function sendProposalTool(phone) {
  const lead = getLead(phone);
  if (!lead) return { error: 'lead_not_found' };
  const caseId = lead.case_type;
  const c = findCase(caseId);
  if (!c) {
    return {
      error: 'case_type_not_set',
      hint: 'Chame update_lead(case_type=...) antes de send_proposal.'
    };
  }

  const updated = updateLead(phone, {
    stage: 'proposal',
    scope: c.scope,
    payment_terms: c.feeModel
  });

  await sendText(phone, c.proposal);
  return {
    ok: true,
    sent: 'proposal',
    case_type: caseId,
    lead: pick(updated)
  };
}

async function sendContractTool(phone, args) {
  const lead = getLead(phone);
  if (!lead) return { error: 'lead_not_found' };
  if (!lead.case_type) {
    return { error: 'case_type_not_set', hint: 'Defina case_type antes de send_contract.' };
  }
  if (!lead.client_name) {
    return {
      error: 'client_name_not_set',
      hint: 'Peça e registre o nome completo do cliente antes de gerar o contrato.'
    };
  }

  const pdfPath = await buildContractPdf(lead);
  const sig = await sendForSignature(lead, pdfPath);

  updateLead(phone, {
    stage: 'contract',
    contract_id: sig.contractId,
    contract_sign_url: sig.signUrl,
    contract_pdf_path: pdfPath,
    notes: args?.confirmation ? `Aceite: ${args.confirmation}` : undefined
  });

  const message =
    `*Contrato de honorários pronto para assinatura*\n\n` +
    `Para finalizar, basta assinar digitalmente neste link:\n${sig.signUrl}\n\n` +
    `Assim que assinado, recebemos o aviso automaticamente e damos início ao trabalho.`;

  await sendText(phone, message);
  logger.info(
    { phone, contractId: sig.contractId, provider: sig.provider, case_type: lead.case_type },
    'Contract sent for signature'
  );
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
  const { phone, stage, client_name, case_type, urgency } = lead;
  return { phone, stage, client_name, case_type, urgency };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
