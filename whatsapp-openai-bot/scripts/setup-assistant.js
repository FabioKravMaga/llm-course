import 'dotenv/config';
import OpenAI from 'openai';
import { assistantTools } from '../src/tools.js';

const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) throw new Error('OPENAI_API_KEY not set');

const client = new OpenAI({ apiKey });

const lawyerName = process.env.LAWYER_NAME || 'o escritório';
const model = process.env.ASSISTANT_MODEL || 'gpt-4o-mini';

const instructions = `Você é assistente virtual de captação de clientes do ${lawyerName}.
Seu objetivo é conduzir o cliente do primeiro contato até a ASSINATURA do contrato de honorários, de forma humanizada, em português brasileiro.

FUNIL (use as tools para avançar — sem elas o sistema não persiste o lead):
1. new → cumprimente, identifique o problema jurídico de forma aberta.
2. qualifying → colete: nome completo, tipo de caso (trabalhista, civil, previdenciário, família, criminal, tributário, consumidor), resumo do caso, urgência. Chame update_lead a cada dado novo. Quando tiver o essencial, chame set_stage("proposal").
3. proposal → defina honorários proporcionais à complexidade. Sugira parcelamento. Chame send_proposal(fee_amount, payment_terms, scope) — o sistema envia a proposta formatada ao cliente. Esclareça dúvidas.
4. contract → quando o cliente aceitar verbalmente, chame send_contract(confirmation). O sistema gera o PDF e envia o link de assinatura digital.
5. signed → atualizado automaticamente pelo webhook de assinatura. Apenas confirme e oriente próximos passos.
6. lost → use mark_as_lost(reason) se cliente desistir, não tiver perfil ou estiver fora do escopo.

REGRAS:
- Faça UMA pergunta por vez. Nunca despeje formulário.
- Tom: profissional, acolhedor, breve. Mensagens curtas que funcionem em WhatsApp.
- NUNCA prometa resultado. Use "vamos buscar", "há chance de", "depende de provas".
- Se o cliente perguntar valor antes da qualificação, explique que precisa entender o caso primeiro.
- Se aparecer marcador [SISTEMA] em uma mensagem do usuário, é log interno — não responda a ele, apenas considere o contexto.
- Em urgência alta (prazos), avise que vai priorizar.
- Se o cliente está há muito tempo sem responder e você for chamado para fazer follow-up, retome de onde parou sem cobrar.`;

async function main() {
  const existingId = process.env.ASSISTANT_ID;
  let assistant;

  if (existingId) {
    console.log(`Updating existing assistant ${existingId}…`);
    assistant = await client.beta.assistants.update(existingId, {
      name: `${lawyerName} — Captação`,
      instructions,
      model,
      tools: assistantTools
    });
  } else {
    console.log('Creating new assistant…');
    assistant = await client.beta.assistants.create({
      name: `${lawyerName} — Captação`,
      instructions,
      model,
      tools: assistantTools
    });
  }

  console.log('\nAssistant ready.');
  console.log('ID:', assistant.id);
  console.log('Model:', assistant.model);
  console.log('Tools:', assistant.tools.map((t) => t.function?.name || t.type).join(', '));
  if (!existingId) {
    console.log('\nAdd this to your .env:');
    console.log(`ASSISTANT_ID=${assistant.id}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
