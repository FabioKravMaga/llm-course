# whatsapp-openai-bot

Bot de **captação jurídica via WhatsApp** para o escritório **Machado Deveza Advogados Associados**. Leva o cliente do primeiro "oi" até o **contrato de honorários assinado digitalmente**, atendendo as 7 áreas do escritório com teses jurídicas prontas e modelos de honorários específicos por área (êxito / fixo / mensal). Usa **Anthropic Claude** com function calling para conduzir o funil, [Evolution API](https://github.com/EvolutionAPI/evolution-api) como bridge do WhatsApp, ZapSign para assinatura, e um scheduler de follow-ups (dias 1, 3, 7, 14) para recuperar clientes silenciosos.

> O nome do diretório (`whatsapp-openai-bot`) ficou da v1 — desde a v2 o backend é **Anthropic Claude**.

## Funil

```
new → qualifying → proposal → contract → signed
                                       ↘ lost (sem resposta após follow-ups, ou desistência)
```

Cada estágio fica persistido em SQLite (uma linha por número de telefone). O histórico completo de mensagens é armazenado por cliente, então cada conversa tem sua própria memória.

## Stack

- **Evolution API** (Docker) — gateway WhatsApp via Baileys
- **Node.js 20 + Express** — webhook e orquestração
- **Anthropic Claude** (`@anthropic-ai/sdk`) — conversa + function calling com **prompt caching** no system + tools
  - Default: `claude-opus-4-8` com adaptive thinking
  - Configurável para `claude-sonnet-4-6` ou `claude-haiku-4-5` em workloads de alto volume
- **SQLite** (`better-sqlite3`) — leads, funil, histórico de mensagens, follow-up
- **pdfkit** — contrato de honorários em PDF
- **ZapSign** (default) ou mock — assinatura digital
- **PM2** — keep-alive em produção

## Fluxo

```
WhatsApp ─→ Evolution API ─→ POST /webhook ─→ bot
                                              ├─→ atualiza lead (last_inbound, reset follow_up)
                                              ├─→ Claude com tools
                                              │     ├─ update_lead    → nome/caso/urgência
                                              │     ├─ set_stage      → avança funil
                                              │     ├─ send_proposal  → envia proposta formatada
                                              │     ├─ send_contract  → PDF + ZapSign + link
                                              │     └─ mark_as_lost
                                              └─→ envia resposta no WhatsApp

Scheduler (5 min) ─→ leads em silêncio ─→ follow-up por estágio
                                       ─→ após N tentativas → marca como lost

ZapSign ─ webhook "doc_signed" ─→ POST /sign-webhook ─→ lead = signed → confirmação no WhatsApp
```

## Instalação rápida

Veja [SETUP.md](./SETUP.md) — 11 passos de uma VPS limpa até bot fechando contratos.
Para o plano completo de implantação (fases, executores, critérios de aceite e prompts prontos para agente), veja [ROADMAP.md](./ROADMAP.md).

```bash
git clone https://github.com/FabioKravMaga/llm-course.git
cd llm-course/whatsapp-openai-bot
bash scripts/install.sh
cp .env.example .env && nano .env
npm install
docker compose --env-file .env up -d
pm2 start ecosystem.config.js
```

## Estrutura

```
whatsapp-openai-bot/
├── docker-compose.yml       # Evolution API + Postgres + Redis
├── ecosystem.config.js      # PM2
├── package.json
├── .env.example
├── scripts/
│   └── install.sh           # Docker, Node 20, PM2
├── SETUP.md
└── src/
    ├── server.js            # Express: /webhook, /sign-webhook, /health
    ├── config.js
    ├── prompt.js            # System prompt do bot (edite para customizar)
    ├── cases.js             # Base de conhecimento das 6 áreas do escritório
    ├── handler.js           # Parser + orquestração inbound
    ├── followup.js          # Scheduler dias 1/3/7/14 com ganchos por área
    ├── tools.js             # Tool schemas + dispatcher
    ├── claude.js            # Cliente Anthropic com loop de tool use + prompt caching
    ├── evolution.js         # Cliente Evolution API
    ├── contract.js          # Geração de PDF (pdfkit) com honorários por área
    ├── signature.js         # ZapSign + provedor mock
    ├── db.js                # SQLite (leads + histórico de mensagens)
    └── logger.js
```

## Áreas atendidas

Definidas em `src/cases.js` — edite lá para ajustar tese, proposta, modelo de honorários e ganchos de follow-up.

1. `golpe_pix` — golpe/fraude bancária (Pix, boleto, clonagem). Honorários: apenas em êxito.
2. `vinculo_trabalhista` — reconhecimento de vínculo sem carteira. Honorários: percentual sobre o recebido.
3. `restabelecimento_auxilio` — auxílio-doença cortado pelo INSS. Honorários: percentual sobre atrasados.
4. `aposentadoria_invalidez` — conversão para aposentadoria permanente. Honorários: percentual sobre retroativos.
5. `planejamento_previdenciario` — estudo de aposentadoria. Honorários: valor fixo pelo estudo.
6. `revisao_aposentadoria` — revisão do benefício com inclusão de ganhos de ação trabalhista no cálculo. Honorários: percentual sobre as diferenças retroativas.
7. `midias_sociais` — gestão e conteúdo digital, em parceria com a **SmartAdv**. Honorários: plano mensal.
8. `outro` — a definir após análise da equipe.

## Follow-up automático

Padrão: **1d → 3d → 7d → 14d**. No 14º dia manda a despedida ("não ser inconveniente") e marca como `lost`. Mensagens variam por *dia* (o que dizer) e por *área* (prova social + urgência específicas). Configurável via `FOLLOWUP_DELAYS_MS`; mensagens em `src/followup.js`.

## Comandos em chat

| Comando | Efeito |
|---|---|
| `/reset` | Apaga o lead e o histórico desse número |

## Tools (function calling)

| Tool | Quando o Claude chama | Efeito |
|---|---|---|
| `send_menu` | Primeiro contato | Envia menu numerado das 8 áreas |
| `send_thesis` | Após identificar `case_type` | Envia tese jurídica pronta da área (2 mensagens) |
| `update_lead` | A cada dado novo | Grava case_type, nome, resumo, urgência |
| `set_stage` | Ao avançar o funil | Atualiza estágio |
| `send_proposal` | Quando pronto para cotar | Envia proposta pronta do escritório com modelo de honorários certo para a área |
| `send_contract` | Após aceite + nome | Gera PDF → ZapSign → manda link |
| `mark_as_lost` | Desistência / fora de escopo | Encerra o lead |

## Provedor de assinatura

- `SIGNATURE_PROVIDER=mock` (default): retorna URL fake — útil para testar sem custo.
- `SIGNATURE_PROVIDER=zapsign`: usa a API ZapSign + webhook `doc_signed` em `/sign-webhook`.

Para adicionar Clicksign/D4Sign, basta criar uma função em `src/signature.js` e rotear via `SIGNATURE_PROVIDER`.

## Por que Claude (e não OpenAI)?

A v1 deste bot usava OpenAI Assistants API. A v2 migrou para Anthropic Claude por:

1. **Sem dependência da Assistants API** — Claude usa Messages API direto, o histórico fica no seu SQLite. Você é dono dos dados.
2. **Prompt caching nativo** — system prompt + tools cacheados automaticamente, ~90% de desconto em chamadas repetidas.
3. **Adaptive thinking** — o modelo decide quanto pensar caso a caso, sem precisar tunar `budget_tokens`.
4. **Modelos mais novos** — Opus 4.8, Sonnet 4.6 e Haiku 4.5 com janela de contexto grande (1M tokens em Opus/Sonnet).

## Variáveis de ambiente principais

Veja [`.env.example`](./.env.example). Obrigatórias: `ANTHROPIC_API_KEY`, `EVOLUTION_API_KEY`, `EVOLUTION_INSTANCE`.
