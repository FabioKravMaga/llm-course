# WhatsApp + OpenAI Assistants Bot — Setup (12 passos)

Stack: **Evolution API (Docker) → Node.js webhook → OpenAI Assistants API → SQLite (memória por número) → PM2**.

Fluxo:
```
WhatsApp → Evolution API (8080) → /webhook → Node.js (3000) → OpenAI Assistants → resposta → Evolution API → WhatsApp
```

---

## Antes de começar — você precisa ter em mãos

1. `OPENAI_API_KEY` — gere em https://platform.openai.com/api-keys
2. `ASSISTANT_ID` — começa com `asst_...`, criado em https://platform.openai.com/assistants
3. IP público do servidor — rode `curl ifconfig.me` no VPS
4. Acesso SSH com usuário sudo (não root puro, idealmente)

> O bot lê threads por número de telefone e persiste em SQLite, então cada usuário no WhatsApp mantém seu próprio histórico de conversa com o Assistant.

---

## Passo 1 — Conectar ao servidor

```bash
ssh seu-usuario@SEU_IP
```

## Passo 2 — Clonar o repositório

```bash
cd ~
git clone https://github.com/FabioKravMaga/llm-course.git
cd llm-course/whatsapp-openai-bot
```

## Passo 3 — Rodar o instalador (Docker, Node 20, PM2)

```bash
bash scripts/install.sh
```

Se for a primeira vez que o usuário entra no grupo `docker`, faça **logout/login** antes de continuar (ou rode com `sudo` os comandos `docker compose`).

Verifique:

```bash
docker --version
docker compose version
node -v   # >= 18
pm2 -v
```

## Passo 4 — Configurar variáveis de ambiente

```bash
cp .env.example .env
nano .env
```

Preencha:

```env
OPENAI_API_KEY=sk-...                   # do passo "Antes de começar"
ASSISTANT_ID=asst_...
EVOLUTION_URL=http://localhost:8080
EVOLUTION_API_KEY=GERE_UMA_CHAVE_FORTE  # ex: openssl rand -hex 32
EVOLUTION_INSTANCE=whatsapp-bot
PORT=3000
WEBHOOK_TOKEN=GERE_OUTRA_CHAVE          # protege o endpoint /webhook
DB_PATH=./data/threads.db
```

Gere chaves fortes com:

```bash
openssl rand -hex 32
```

## Passo 5 — Subir Evolution API + Postgres + Redis

A Evolution lê `EVOLUTION_API_KEY` do mesmo `.env`:

```bash
docker compose --env-file .env up -d
docker compose ps
```

Aguarde uns 20s e teste:

```bash
curl -s http://localhost:8080 | head
```

Deve retornar um JSON com `status: 200`.

## Passo 6 — Criar a instância do WhatsApp na Evolution

```bash
source .env
curl -s -X POST "http://localhost:8080/instance/create" \
  -H "Content-Type: application/json" \
  -H "apikey: $EVOLUTION_API_KEY" \
  -d "{
    \"instanceName\": \"$EVOLUTION_INSTANCE\",
    \"qrcode\": true,
    \"integration\": \"WHATSAPP-BAILEYS\"
  }"
```

## Passo 7 — Conectar o WhatsApp (escanear o QR code)

Pegue o QR code (ASCII):

```bash
curl -s "http://localhost:8080/instance/connect/$EVOLUTION_INSTANCE" \
  -H "apikey: $EVOLUTION_API_KEY"
```

Use o campo `code` (base64) ou abra `http://SEU_IP:8080/manager` no navegador e escaneie com o WhatsApp do celular: **Aparelhos conectados → Conectar um aparelho**.

Confira que conectou:

```bash
curl -s "http://localhost:8080/instance/connectionState/$EVOLUTION_INSTANCE" \
  -H "apikey: $EVOLUTION_API_KEY"
```

Quer ver `"state":"open"`.

## Passo 8 — Instalar dependências do bot

```bash
npm install
```

## Passo 9 — Apontar o webhook da Evolution para o bot

```bash
source .env
curl -s -X POST "http://localhost:8080/webhook/set/$EVOLUTION_INSTANCE" \
  -H "Content-Type: application/json" \
  -H "apikey: $EVOLUTION_API_KEY" \
  -d "{
    \"webhook\": {
      \"enabled\": true,
      \"url\": \"http://host.docker.internal:$PORT/webhook/$WEBHOOK_TOKEN\",
      \"webhookByEvents\": false,
      \"webhookBase64\": false,
      \"events\": [\"MESSAGES_UPSERT\"]
    }
  }"
```

> Se `host.docker.internal` não resolver no seu Linux, troque por o IP do gateway do bridge (geralmente `172.17.0.1`) ou rode o bot dentro do mesmo `docker compose`.

## Passo 10 — Subir o bot com PM2

```bash
mkdir -p logs data
pm2 start ecosystem.config.js
pm2 save
pm2 startup systemd -u $USER --hp $HOME   # copie/cole o comando que ele imprimir
```

Verifique:

```bash
pm2 status
pm2 logs whatsapp-openai-bot --lines 50
curl -s http://localhost:3000/health
```

## Passo 11 — Firewall (UFW)

Só exponha o que é necessário. O webhook é interno (Docker → bot), então **não precisa abrir a porta 3000**.

```bash
sudo ufw allow OpenSSH
sudo ufw allow 8080/tcp   # apenas se for usar o /manager via navegador; senão omita
sudo ufw enable
sudo ufw status
```

> Se for expor a Evolution publicamente, ponha um Nginx com HTTPS na frente — não deixe a porta 8080 aberta para o mundo sem TLS.

## Passo 12 — Teste end-to-end

Mande uma mensagem no WhatsApp do seu Assistant. No servidor:

```bash
pm2 logs whatsapp-openai-bot
```

Você deve ver: `Created new thread` (primeira vez) → resposta enviada. No celular: a resposta do Assistant chega.

### Comandos úteis

| O que | Comando |
|---|---|
| Resetar memória de um número | mande `/reset` no chat |
| Restart do bot | `pm2 restart whatsapp-openai-bot` |
| Logs em tempo real | `pm2 logs whatsapp-openai-bot` |
| Restart da Evolution | `docker compose restart evolution-api` |
| Ver threads salvas | `sqlite3 data/threads.db 'SELECT * FROM threads;'` |
| Atualizar o bot | `git pull && npm install && pm2 restart whatsapp-openai-bot` |

### Troubleshooting

- **Webhook não chega**: confira `pm2 logs` e o endereço no passo 9. Teste de dentro do container: `docker exec -it evolution-api wget -qO- http://host.docker.internal:3000/health`.
- **OpenAI 401**: `OPENAI_API_KEY` errada ou sem créditos.
- **Run timeout**: aumente `RUN_TIMEOUT_MS` no `.env`. Assistants com tools/file_search demoram mais.
- **"busy" nos logs**: mensagens chegando antes do run anterior terminar — esperado, o bot ignora pra não bagunçar a thread.
