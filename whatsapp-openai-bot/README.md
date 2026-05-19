# whatsapp-openai-bot

Bridge entre **WhatsApp** (via [Evolution API](https://github.com/EvolutionAPI/evolution-api)) e a **OpenAI Assistants API**, com memória de conversa por número de telefone em SQLite.

## Stack

- **Evolution API** (Docker) — gateway do WhatsApp via Baileys
- **Node.js 20 + Express** — webhook que recebe a mensagem, chama o Assistant e devolve a resposta
- **SQLite** (via `better-sqlite3`) — uma thread OpenAI por número de telefone
- **PM2** — manter o bot online com restart automático

## Fluxo

```
WhatsApp → Evolution API (8080) → POST /webhook → bot (3000) → OpenAI Assistants → resposta → Evolution → WhatsApp
```

## Instalação rápida

Veja [SETUP.md](./SETUP.md) — 12 passos do zero numa VPS Ubuntu/Debian.

```bash
git clone https://github.com/FabioKravMaga/llm-course.git
cd llm-course/whatsapp-openai-bot
bash scripts/install.sh
cp .env.example .env && nano .env
docker compose --env-file .env up -d
npm install
pm2 start ecosystem.config.js
```

## Estrutura

```
whatsapp-openai-bot/
├── docker-compose.yml      # Evolution API + Postgres + Redis
├── ecosystem.config.js     # PM2
├── package.json
├── .env.example
├── scripts/
│   └── install.sh          # Instala Docker, Node 20, PM2
├── SETUP.md                # Guia passo a passo
└── src/
    ├── server.js           # Express + webhook
    ├── config.js           # Lê e valida .env
    ├── handler.js          # Parser de evento + orquestração
    ├── openai.js           # Cliente Assistants API
    ├── evolution.js        # Cliente Evolution API
    ├── db.js               # SQLite (threads por número)
    └── logger.js           # pino
```

## Comandos em chat

| Comando | Efeito |
|---|---|
| `/reset` | Apaga a thread atual desse número; próxima mensagem cria uma nova |

## Variáveis de ambiente

| Var | Obrigatória | Default | Descrição |
|---|---|---|---|
| `OPENAI_API_KEY` | sim | — | Chave da OpenAI |
| `ASSISTANT_ID` | sim | — | ID do Assistant (`asst_...`) |
| `EVOLUTION_URL` | não | `http://localhost:8080` | URL da Evolution API |
| `EVOLUTION_API_KEY` | sim | — | Auth da Evolution |
| `EVOLUTION_INSTANCE` | sim | — | Nome da instância criada na Evolution |
| `PORT` | não | `3000` | Porta do webhook |
| `WEBHOOK_TOKEN` | recomendada | — | Token no path `/webhook/:token` |
| `DB_PATH` | não | `./data/threads.db` | Caminho do SQLite |
| `RUN_TIMEOUT_MS` | não | `60000` | Timeout do run do Assistant |
| `LOG_LEVEL` | não | `info` | `debug` \| `info` \| `warn` \| `error` |
