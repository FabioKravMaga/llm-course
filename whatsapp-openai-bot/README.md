# whatsapp-openai-bot

Bot de **captação jurídica via WhatsApp** que leva o cliente do primeiro "oi" até o **contrato de honorários assinado digitalmente** — sem intervenção humana. Usa **Anthropic Claude** com function calling para conduzir o funil, [Evolution API](https://github.com/EvolutionAPI/evolution-api) como bridge do WhatsApp, ZapSign para assinatura, e um scheduler de follow-ups para recuperar clientes silenciosos.

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
    ├── handler.js           # Parser + orquestração inbound
    ├── followup.js          # Scheduler de follow-ups por estágio
    ├── tools.js             # Tool schemas + dispatcher
    ├── claude.js            # Cliente Anthropic com loop de tool use + prompt caching
    ├── evolution.js         # Cliente Evolution API
    ├── contract.js          # Geração de PDF (pdfkit)
    ├── signature.js         # ZapSign + provedor mock
    ├── db.js                # SQLite (leads + histórico de mensagens)
    └── logger.js
```

## Follow-up automático

Padrão: **4h → 24h → 72h** e então marca como `lost`. Configurável via `FOLLOWUP_DELAYS_MS`. Mensagens variam por estágio em `src/followup.js`.

## Comandos em chat

| Comando | Efeito |
|---|---|
| `/reset` | Apaga o lead e o histórico desse número |

## Tools (function calling)

| Tool | Quando o Claude chama | Efeito |
|---|---|---|
| `update_lead` | A cada dado novo | Grava nome, tipo de caso, resumo, urgência |
| `set_stage` | Ao avançar o funil | Atualiza estágio |
| `send_proposal` | Quando pronto para cotar | Envia proposta formatada + persiste valor/condições |
| `send_contract` | Quando cliente aceita verbalmente | Gera PDF → ZapSign → manda link |
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
