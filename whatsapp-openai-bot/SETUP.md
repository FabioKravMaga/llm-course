# WhatsApp + OpenAI Assistants Bot — Setup (12 passos)

Bot completo de captação jurídica via WhatsApp: **qualifica, propõe honorários, gera contrato em PDF, envia para assinatura digital e fecha o atendimento automaticamente**. Quando o cliente fica em silêncio, o bot faz follow-ups programados; se não responder, marca como perdido.

Stack: **Evolution API (Docker) → Node.js webhook → OpenAI Assistants (tools) → SQLite (funil por número) → PM2 → ZapSign (assinatura)**.

```
WhatsApp → Evolution API → /webhook → Bot → OpenAI Assistant ⟷ tools (atualiza lead, envia proposta, gera contrato)
                                                                          ↓
                                                              PDF → ZapSign → cliente assina
                                                                          ↓
                                                              /sign-webhook → lead = signed
```

## Funil

| Estágio | O que acontece |
|---|---|
| `new` | Primeiro contato. Assistant cumprimenta e abre. |
| `qualifying` | Coleta nome, tipo de caso, resumo, urgência. |
| `proposal` | Envia proposta (valor, condições, escopo) via tool `send_proposal`. |
| `contract` | Gera PDF e envia link de assinatura (`send_contract`). |
| `signed` | Marcado automaticamente pelo webhook da ZapSign. |
| `lost` | `mark_as_lost` ou esgotamento dos follow-ups. |

## Follow-up

Após cada mensagem do bot, agenda o próximo follow-up. Quando o cliente responde, o contador zera. Padrão: **4h → 24h → 72h** e então marca como `lost`. Mensagens variam por estágio (definidas em `src/followup.js`).

---

## Antes de começar — você precisa ter em mãos

1. `OPENAI_API_KEY` — https://platform.openai.com/api-keys
2. IP público do servidor — `curl ifconfig.me`
3. Acesso SSH com usuário sudo
4. (Opcional, mas recomendado) Conta ZapSign + token de API — https://app.zapsign.com.br

> O Assistant é criado/atualizado **pelo script `npm run setup:assistant`** com as ferramentas certas. Não precisa configurar tools manualmente na UI.

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

Faça **logout/login** se for a primeira vez (para entrar no grupo `docker`). Verifique:

```bash
docker --version && docker compose version && node -v && pm2 -v
```

## Passo 4 — Configurar variáveis de ambiente

```bash
cp .env.example .env
nano .env
```

Preencha pelo menos:

```env
OPENAI_API_KEY=sk-...
EVOLUTION_API_KEY=$(openssl rand -hex 32)
EVOLUTION_INSTANCE=whatsapp-bot
WEBHOOK_TOKEN=$(openssl rand -hex 32)

LAWYER_NAME=Seu Escritório
LAWYER_OAB=SP 000.000
LAWYER_DOCUMENT=000.000.000-00
LAWYER_ADDRESS=Rua Exemplo, 123 — São Paulo/SP
LAWYER_EMAIL=fabioadvogado@gmail.com
LAWYER_PIX_KEY=fabioadvogado@gmail.com

# Comece com mock; troque para zapsign quando configurar
SIGNATURE_PROVIDER=mock
```

Deixe `ASSISTANT_ID` em branco por enquanto — o passo 5 preenche.

## Passo 5 — Criar o Assistant (com tools e prompt)

```bash
npm install
node --version  # >= 18
npm run setup:assistant
```

A saída inclui `ASSISTANT_ID=asst_...`. Cole no `.env`:

```bash
nano .env  # cole o ASSISTANT_ID
```

> Se já tinha um Assistant, defina `ASSISTANT_ID` antes de rodar o script — ele atualiza em vez de criar.

## Passo 6 — Subir Evolution API + Postgres + Redis

```bash
docker compose --env-file .env up -d
docker compose ps
curl -s http://localhost:8080 | head
```

## Passo 7 — Criar a instância e parear o WhatsApp

```bash
source .env

curl -s -X POST "http://localhost:8080/instance/create" \
  -H "Content-Type: application/json" \
  -H "apikey: $EVOLUTION_API_KEY" \
  -d "{\"instanceName\":\"$EVOLUTION_INSTANCE\",\"qrcode\":true,\"integration\":\"WHATSAPP-BAILEYS\"}"

curl -s "http://localhost:8080/instance/connect/$EVOLUTION_INSTANCE" \
  -H "apikey: $EVOLUTION_API_KEY"
```

Ou abra `http://SEU_IP:8080/manager` no navegador e escaneie o QR. Depois confira:

```bash
curl -s "http://localhost:8080/instance/connectionState/$EVOLUTION_INSTANCE" \
  -H "apikey: $EVOLUTION_API_KEY"
```

Quer ver `"state":"open"`.

## Passo 8 — Apontar o webhook da Evolution para o bot

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
      \"events\": [\"MESSAGES_UPSERT\"]
    }
  }"
```

Se `host.docker.internal` não resolver, troque por `172.17.0.1`.

## Passo 9 — Subir o bot com PM2

```bash
mkdir -p logs data data/contracts
pm2 start ecosystem.config.js
pm2 save
pm2 startup systemd -u $USER --hp $HOME   # copie/cole o comando que aparecer
pm2 logs whatsapp-openai-bot --lines 30
curl -s http://localhost:3000/health
```

## Passo 10 — (Opcional, mas necessário para fechar contrato sozinho) Configurar ZapSign

1. Crie conta em https://app.zapsign.com.br e gere o token em **Conta → API**.
2. No `.env`:
   ```env
   SIGNATURE_PROVIDER=zapsign
   ZAPSIGN_TOKEN=zs_live_...
   ZAPSIGN_WEBHOOK_SECRET=$(openssl rand -hex 32)
   PUBLIC_BASE_URL=https://bot.seudominio.com    # opcional, para mock
   ```
3. Reinicie: `pm2 restart whatsapp-openai-bot`.
4. No painel ZapSign → **Configurações → Webhook**, cadastre:
   - URL: `https://bot.seudominio.com/sign-webhook` (precisa estar publicado com HTTPS)
   - Evento: `doc_signed`
   - Secret: o mesmo `ZAPSIGN_WEBHOOK_SECRET` do `.env`

> Sem HTTPS público você ainda pode usar a ZapSign — só não vai receber o webhook automático. Nesse caso confira a assinatura manualmente e marque o lead em SQLite.

## Passo 11 — Firewall (UFW)

```bash
sudo ufw allow OpenSSH
# Apenas se for expor /manager ou /sign-webhook diretamente (use Nginx+HTTPS por cima):
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

Não exponha 3000/8080 direto sem TLS.

## Passo 12 — Teste end-to-end

Mande "Olá, preciso de ajuda" do seu WhatsApp para o número pareado. Acompanhe:

```bash
pm2 logs whatsapp-openai-bot
sqlite3 data/threads.db 'SELECT phone, stage, client_name, fee_amount FROM leads;'
```

Você deve ver o lead progredir: `new → qualifying → proposal → contract → signed`.

---

## Comandos úteis

| O que | Comando |
|---|---|
| Resetar a conversa | mande `/reset` no chat |
| Ver funil completo | `sqlite3 data/threads.db 'SELECT phone, stage, follow_up_count, follow_up_next_at FROM leads;'` |
| Forçar follow-up agora | `sqlite3 data/threads.db "UPDATE leads SET follow_up_next_at=strftime('%s','now')*1000 WHERE phone='5511...';"` |
| Recriar Assistant após mudar tools | `npm run setup:assistant` |
| Restart do bot | `pm2 restart whatsapp-openai-bot` |
| Logs em tempo real | `pm2 logs whatsapp-openai-bot` |
| Restart da Evolution | `docker compose restart evolution-api` |
| Atualizar o bot | `git pull && npm install && pm2 restart whatsapp-openai-bot` |

## Customização

- **Mensagens de follow-up**: edite o objeto `messagesByStage` em `src/followup.js`.
- **Atrasos**: `FOLLOWUP_DELAYS_MS` no `.env` (ms separados por vírgula).
- **Modelo de contrato**: `src/contract.js` — cláusulas e layout.
- **Prompt e regras do Assistant**: `scripts/setup-assistant.js` (rode novamente após editar).
- **Tools**: `src/tools.js` — para adicionar coleta de dados nova, crie outro tool e atualize a `dispatcher`.

## Troubleshooting

- **Webhook não chega**: `docker exec -it evolution-api wget -qO- http://host.docker.internal:3000/health`.
- **Tool retorna erro `lead_not_found`**: o Assistant chamou `send_contract` antes de `send_proposal` — ajuste o prompt.
- **PDF não abre**: verifique `data/contracts/` e permissões.
- **Follow-up não dispara**: confirme `FOLLOWUP_ENABLED=true` e `follow_up_next_at` no SQLite.
- **ZapSign 401**: token errado ou conta sem créditos.
