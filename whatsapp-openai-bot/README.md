# whatsapp-openai-bot

Bot de **captação jurídica via WhatsApp** que leva o cliente do primeiro "oi" até o **contrato de honorários assinado digitalmente** — sem intervenção humana. Usa OpenAI Assistants com function calling para conduzir o funil, [Evolution API](https://github.com/EvolutionAPI/evolution-api) como bridge do WhatsApp, ZapSign para assinatura, e um scheduler de follow-ups para recuperar clientes que ficam em silêncio.

## Funil

```
new → qualifying → proposal → contract → signed
                                       ↘ lost (sem resposta após follow-ups, ou desistência)
```

Cada estágio fica persistido em SQLite (uma linha por número de telefone). Cada cliente tem sua própria thread do Assistant, então a memória da conversa é por pessoa.

## Stack

- **Evolution API** (Docker) — gateway do WhatsApp via Baileys
- **Node.js 20 + Express** — webhook + orquestração
- **OpenAI Assistants API** — conversa + function calling (tools: `update_lead`, `set_stage`, `send_proposal`, `send_contract`, `mark_as_lost`)
- **SQLite** (`better-sqlite3`) — leads, funil, threads, agendamento de follow-up
- **pdfkit** — gera o contrato de honorários
- **ZapSign** (default) ou mock — assinatura digital
- **PM2** — keep-alive

## Fluxo

```
WhatsApp ─→ Evolution API ─→ POST /webhook ─→ bot
                                              ├─→ atualiza lead (last_inbound_at, reset follow_up)
                                              ├─→ OpenAI Assistant (com tools)
                                              │     ├─ update_lead → grava nome/caso/urgência
                                              │     ├─ set_stage   → avança funil
                                              │     ├─ send_proposal → envia proposta formatada
                                              │     ├─ send_contract → gera PDF + ZapSign + link
                                              │     └─ mark_as_lost
                                              └─→ envia resposta no WhatsApp
                                              
Scheduler (a cada 5 min) ─→ leads em silêncio ─→ follow-up por estágio
                                              ─→ após N tentativas → marca como lost

ZapSign ─ webhook "doc_signed" ─→ POST /sign-webhook ─→ lead = signed → mensagem de confirmação
```

## Instalação rápida

Veja [SETUP.md](./SETUP.md) — 12 passos de uma VPS limpa até bot fechando contratos.

```bash
git clone https://github.com/FabioKravMaga/llm-course.git
cd llm-course/whatsapp-openai-bot
bash scripts/install.sh
cp .env.example .env && nano .env
npm install
npm run setup:assistant    # cria Assistant com tools e prompt jurídico
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
│   ├── install.sh           # Docker, Node 20, PM2
│   └── setup-assistant.js   # cria/atualiza Assistant com tools + prompt
├── SETUP.md
└── src/
    ├── server.js            # Express: /webhook, /sign-webhook, /health
    ├── config.js
    ├── handler.js           # Parser + orquestração inbound
    ├── followup.js          # Scheduler de follow-ups por estágio
    ├── tools.js             # Tool schemas + dispatcher (function calling)
    ├── openai.js            # Assistant runs com requires_action
    ├── evolution.js         # Cliente Evolution API
    ├── contract.js          # Geração de PDF (pdfkit)
    ├── signature.js         # ZapSign + provedor mock
    ├── db.js                # SQLite (leads)
    └── logger.js
```

## Follow-up automático

Após cada mensagem do bot, agenda o próximo follow-up. Resposta do cliente zera o contador. Padrão:

| Tentativa | Atraso |
|---|---|
| 1ª | 4h |
| 2ª | 24h |
| 3ª | 72h, depois marca `lost` |

Configurável via `FOLLOWUP_DELAYS_MS` (ms separados por vírgula). Mensagens por estágio em `src/followup.js`.

## Comandos em chat

| Comando | Efeito |
|---|---|
| `/reset` | Apaga o lead e a thread desse número |

## Tools (function calling)

| Tool | Quando o Assistant chama | Efeito |
|---|---|---|
| `update_lead` | A cada dado novo coletado | Grava nome, tipo de caso, resumo, urgência |
| `set_stage` | Ao avançar o funil | Atualiza estágio |
| `send_proposal` | Quando pronto para cotar | Envia proposta formatada no WhatsApp + persiste valor/condições |
| `send_contract` | Quando cliente aceita verbalmente | Gera PDF → ZapSign → manda link de assinatura |
| `mark_as_lost` | Desistência / fora de escopo | Encerra o lead |

## Provedor de assinatura

- `SIGNATURE_PROVIDER=mock` (default): retorna URL fake — útil para testar sem custo.
- `SIGNATURE_PROVIDER=zapsign`: usa a API ZapSign + webhook `doc_signed` em `/sign-webhook`.

Para trocar de provedor (ex: Clicksign, D4Sign), adicione uma função em `src/signature.js` e roteie via `SIGNATURE_PROVIDER`.

## Variáveis de ambiente principais

Veja [`.env.example`](./.env.example) para a lista completa. Obrigatórias: `OPENAI_API_KEY`, `ASSISTANT_ID`, `EVOLUTION_API_KEY`, `EVOLUTION_INSTANCE`.
