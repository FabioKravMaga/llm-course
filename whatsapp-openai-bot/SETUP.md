# WhatsApp + Claude Bot — Setup (11 passos)

Bot de captação jurídica via WhatsApp para o escritório **Machado Deveza Advogados Associados**. Atende as 6 áreas do escritório (golpe/Pix, vínculo trabalhista, restabelecimento de auxílio, aposentadoria por invalidez, planejamento previdenciário, mídias sociais + "outro"), envia a tese jurídica pronta por área, cotiza pelo modelo de honorários certo (êxito / fixo / mensal), gera o contrato em PDF e envia para assinatura digital. Quando o cliente fica em silêncio, faz follow-ups nos dias 1, 3, 7 e 14 — no dia 14 se despede e marca como perdido.

Stack: **Evolution API (Docker) → Node.js webhook → Anthropic Claude (tools) → SQLite (funil por número) → PM2 → ZapSign (assinatura)**.

```
WhatsApp → Evolution API → /webhook → Bot → Claude (Opus 4.8) ⟷ tools (update_lead, send_proposal, send_contract...)
                                                                          ↓
                                                              PDF → ZapSign → cliente assina
                                                                          ↓
                                                              /sign-webhook → lead = signed
```

## Funil e áreas

| Estágio | O que acontece |
|---|---|
| `new` | Primeiro contato. Claude cumprimenta e chama `send_menu` (6+1 áreas numeradas). |
| `qualifying` | Cliente escolhe a área (número ou descrição). Claude chama `send_thesis(case_type)` e coleta os dados que a tese pede. |
| `proposal` | Claude chama `send_proposal()` — envia texto pronto do escritório com o modelo de honorários certo para a área. Pede nome completo. |
| `contract` | Após aceite verbal + nome, `send_contract()` gera PDF e envia link de assinatura. |
| `signed` | Marcado pelo webhook da ZapSign. |
| `lost` | `mark_as_lost` ou esgotamento dos follow-ups. |

**Áreas atendidas** (edite em `src/cases.js`):

| # | case_type | Modelo de honorários |
|---|---|---|
| 1 | `golpe_pix` | Apenas em caso de êxito |
| 2 | `vinculo_trabalhista` | Percentual sobre o recebido |
| 3 | `restabelecimento_auxilio` | Percentual sobre atrasados |
| 4 | `aposentadoria_invalidez` | Percentual sobre retroativos |
| 5 | `planejamento_previdenciario` | Valor fixo pelo estudo |
| 6 | `midias_sociais` | Plano mensal |
| 7 | `outro` | A definir após análise |

## Follow-up

Padrão: **1 dia → 3 dias → 7 dias → 14 dias**. No 14º dia envia despedida ("não ser inconveniente") e marca como `lost`. Mensagem varia por *dia* e por *case_type* (prova social + urgência específicas de cada área — em `src/followup.js`). Resposta do cliente zera o contador.

---

## Antes de começar

1. `ANTHROPIC_API_KEY` — gere em https://console.anthropic.com/settings/keys
2. IP público do servidor — `curl ifconfig.me`
3. Acesso SSH com usuário sudo
4. (Opcional, mas recomendado) Conta ZapSign + token de API — https://app.zapsign.com.br

> O system prompt do bot vive em `src/prompt.js`. Edite ali se quiser ajustar o tom, escopo do escritório, regras de honorários, etc.

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

## Passo 3 — Instalar Docker, Node 20 e PM2

```bash
bash scripts/install.sh
```

Faça **logout/login** se for a primeira vez no grupo `docker`. Verifique:

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
ANTHROPIC_API_KEY=sk-ant-...
CLAUDE_MODEL=claude-opus-4-8

EVOLUTION_API_KEY=$(openssl rand -hex 32)
EVOLUTION_INSTANCE=whatsapp-bot
WEBHOOK_TOKEN=$(openssl rand -hex 32)

LAWYER_NAME=Machado Deveza Advogados Associados
LAWYER_OAB=SP 000.000
LAWYER_DOCUMENT=00.000.000/0001-00
LAWYER_ADDRESS=Rua Exemplo, 123 — São Paulo/SP
LAWYER_EMAIL=contato@machadodeveza.com.br
LAWYER_PIX_KEY=contato@machadodeveza.com.br

SIGNATURE_PROVIDER=mock   # troque para zapsign quando configurar
```

**Modelos disponíveis:**

| Modelo | Quando usar |
|---|---|
| `claude-opus-4-8` (default) | Máxima qualidade de conversa, mais caro |
| `claude-sonnet-4-6` | Ótimo equilíbrio qualidade/custo |
| `claude-haiku-4-5` | Volume alto, custo mínimo |

## Passo 5 — Instalar dependências

```bash
npm install
```

## Passo 6 — Subir Evolution API + Postgres + Redis

```bash
docker compose --env-file .env up -d
docker compose ps
curl -s http://localhost:8080 | head
```

## Passo 7 — Criar instância e parear o WhatsApp

```bash
source .env

curl -s -X POST "http://localhost:8080/instance/create" \
  -H "Content-Type: application/json" \
  -H "apikey: $EVOLUTION_API_KEY" \
  -d "{\"instanceName\":\"$EVOLUTION_INSTANCE\",\"qrcode\":true,\"integration\":\"WHATSAPP-BAILEYS\"}"

curl -s "http://localhost:8080/instance/connect/$EVOLUTION_INSTANCE" \
  -H "apikey: $EVOLUTION_API_KEY"
```

Ou abra `http://SEU_IP:8080/manager` no navegador e escaneie o QR. Depois:

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

## Passo 10 — (Opcional) Configurar ZapSign para assinatura automática

1. Crie conta em https://app.zapsign.com.br, gere o token em **Conta → API**.
2. No `.env`:
   ```env
   SIGNATURE_PROVIDER=zapsign
   ZAPSIGN_TOKEN=zs_live_...
   ZAPSIGN_WEBHOOK_SECRET=$(openssl rand -hex 32)
   PUBLIC_BASE_URL=https://bot.seudominio.com
   ```
3. `pm2 restart whatsapp-openai-bot`.
4. No painel ZapSign → **Configurações → Webhook**:
   - URL: `https://bot.seudominio.com/sign-webhook` (HTTPS público)
   - Evento: `doc_signed`
   - Secret: o mesmo `ZAPSIGN_WEBHOOK_SECRET` do `.env`

## Passo 11 — Teste end-to-end

Mande "Olá, preciso de ajuda jurídica" do seu WhatsApp para o número pareado. Acompanhe:

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
| Ver funil | `sqlite3 data/threads.db 'SELECT phone, stage, follow_up_count FROM leads;'` |
| Forçar follow-up agora | `sqlite3 data/threads.db "UPDATE leads SET follow_up_next_at=strftime('%s','now')*1000 WHERE phone='5511...';"` |
| Trocar modelo do Claude | `nano .env` (`CLAUDE_MODEL=claude-sonnet-4-6`) → `pm2 restart whatsapp-openai-bot` |
| Editar prompt do bot | `nano src/prompt.js` → `pm2 restart whatsapp-openai-bot` |
| Restart do bot | `pm2 restart whatsapp-openai-bot` |
| Logs em tempo real | `pm2 logs whatsapp-openai-bot` |
| Atualizar o bot | `git pull && npm install && pm2 restart whatsapp-openai-bot` |

## Customização

- **Mensagens de follow-up**: edite `messagesByStage` em `src/followup.js`.
- **Atrasos**: `FOLLOWUP_DELAYS_MS` no `.env`.
- **Modelo de contrato**: `src/contract.js` (cláusulas + layout PDF).
- **Persona / regras do Claude**: `src/prompt.js`.
- **Tools**: `src/tools.js`. Para adicionar coleta de dado novo, crie outra tool e estenda o `dispatcher`.

## Troubleshooting

- **Webhook não chega**: `docker exec -it evolution-api wget -qO- http://host.docker.internal:3000/health`.
- **`lead_not_found` no log**: Claude chamou `send_contract` antes de `send_proposal` — ajuste o prompt.
- **Follow-up não dispara**: confirme `FOLLOWUP_ENABLED=true` e `follow_up_next_at` no SQLite.
- **ZapSign 401**: token errado ou conta sem créditos.
- **Resposta do Claude muito longa**: ajuste `CLAUDE_MAX_TOKENS` ou reforce no prompt que mensagens são para WhatsApp (curtas).
- **Custo alto**: troque para `CLAUDE_MODEL=claude-sonnet-4-6` ou `claude-haiku-4-5`. O bot já usa **prompt caching** no system + tools, então mensagens repetidas ficam ~90% mais baratas.
