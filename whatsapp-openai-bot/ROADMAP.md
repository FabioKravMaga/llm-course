# Roadmap de Implantação — Bot Machado Deveza (WhatsApp + Claude)

Cronograma executável, pensado para ser rodado por um agente (Cowork / Claude Code no VS Code) fase a fase. Cada fase tem: objetivo, quem executa, tarefas, critério de aceite ("pronto quando") e um **prompt pronto para colar no agente**.

**Legenda de executor:**
- 🤖 **Agente** — Cowork/Claude Code executa sozinho no servidor
- 👤 **Fabio** — ação humana obrigatória (chaves, QR code, decisões)
- 🤝 **Ambos** — agente executa, Fabio valida

**Duração total estimada: 5 dias úteis** (D1 a D5), podendo comprimir para 2 dias se as credenciais já estiverem em mãos.

---

## Visão geral

| Fase | Dia | O quê | Executor | Status |
|---|---|---|---|---|
| 0 | D1 manhã | Credenciais e acessos | 👤 | ☐ |
| 1 | D1 tarde | Infraestrutura VPS | 🤖 | ☐ |
| 2 | D1 tarde | Evolution API + pareamento WhatsApp | 🤝 | ☐ |
| 3 | D2 manhã | Deploy do bot + Claude | 🤖 | ☐ |
| 4 | D2 tarde | Teste E2E com assinatura mock | 🤝 | ☐ |
| 5 | D3 | ZapSign + HTTPS (assinatura real) | 🤝 | ☐ |
| 6 | D4 | Homologação: roteiro de testes das 8 áreas | 🤝 | ☐ |
| 7 | D5 | Go-live + hardening | 🤖 | ☐ |
| 8 | Contínuo | Operação e melhoria | 🤝 | ☐ |

---

## Fase 0 — Credenciais e acessos (👤 Fabio, ~1h)

Nada técnico roda sem isto. Colete e guarde num gerenciador de senhas:

- [ ] **VPS Linux** (Ubuntu 22.04+, mínimo 2 vCPU / 4 GB RAM / 40 GB disco) — IP, usuário com sudo, chave SSH
- [ ] **ANTHROPIC_API_KEY** — https://console.anthropic.com/settings/keys (adicione créditos)
- [ ] **Número de WhatsApp dedicado ao bot** (chip/eSIM próprio — não use o número pessoal do escritório)
- [ ] **Conta ZapSign** + token de API — https://app.zapsign.com.br (pode ficar para a Fase 5)
- [ ] **Domínio ou subdomínio** (ex: `bot.machadodeveza.com.br`) apontando para o IP da VPS — necessário só na Fase 5
- [ ] Dados do escritório para o contrato: razão social, OAB, CNPJ, endereço, e-mail, chave PIX

**Pronto quando:** todos os itens acima anotados e acessíveis.

---

## Fase 1 — Infraestrutura VPS (🤖 Agente, ~30 min)

**Objetivo:** servidor com Docker, Node 20 e PM2 prontos.

Tarefas:
1. Conectar via SSH na VPS
2. Clonar o repositório e entrar em `whatsapp-openai-bot/`
3. Rodar `bash scripts/install.sh`
4. Validar: `docker --version`, `docker compose version`, `node -v` (≥18), `pm2 -v`
5. Configurar `.env` a partir do `.env.example` com as credenciais da Fase 0
6. Gerar segredos: `EVOLUTION_API_KEY=$(openssl rand -hex 32)` e `WEBHOOK_TOKEN=$(openssl rand -hex 32)`

**Pronto quando:** os 4 comandos de validação respondem e o `.env` está completo (exceto ZapSign).

**Prompt para o agente:**
```
Conecte na VPS <IP> como <usuario>. Clone https://github.com/FabioKravMaga/llm-course.git,
entre em llm-course/whatsapp-openai-bot, rode bash scripts/install.sh e valide docker,
docker compose, node >= 18 e pm2. Depois copie .env.example para .env e preencha:
ANTHROPIC_API_KEY=<chave>, CLAUDE_MODEL=claude-opus-4-8, LAWYER_NAME, LAWYER_OAB,
LAWYER_DOCUMENT, LAWYER_ADDRESS, LAWYER_EMAIL, LAWYER_PIX_KEY com os dados que vou passar.
Gere EVOLUTION_API_KEY e WEBHOOK_TOKEN com openssl rand -hex 32. Deixe SIGNATURE_PROVIDER=mock.
Ao final me mostre o .env com as chaves mascaradas.
```

---

## Fase 2 — Evolution API + pareamento WhatsApp (🤝, ~45 min)

**Objetivo:** WhatsApp do bot conectado e recebendo mensagens.

Tarefas:
1. 🤖 `docker compose --env-file .env up -d` e conferir `docker compose ps` (evolution-api, postgres, redis saudáveis)
2. 🤖 Criar a instância via `POST /instance/create` (SETUP.md passo 7)
3. 👤 **Fabio escaneia o QR code** com o número dedicado (Aparelhos conectados → Conectar aparelho)
4. 🤖 Validar `connectionState` = `"open"`
5. 🤖 Registrar o webhook da Evolution apontando para o bot (SETUP.md passo 8)

**Pronto quando:** `connectionState` retorna `open` e o webhook está registrado.

**Prompt para o agente:**
```
Na VPS, suba docker compose --env-file .env up -d dentro de whatsapp-openai-bot e confirme
que evolution-api, postgres e redis estão saudáveis. Crie a instância do WhatsApp conforme
o passo 7 do SETUP.md e me mostre o QR code (ou o link do manager em http://<IP>:8080/manager)
para eu escanear. Depois que eu confirmar o pareamento, valide connectionState = open e
registre o webhook conforme o passo 8 do SETUP.md. Teste que o endpoint interno responde.
```

---

## Fase 3 — Deploy do bot + Claude (🤖 Agente, ~30 min)

**Objetivo:** bot no ar respondendo pelo funil das 8 áreas.

Tarefas:
1. `npm install`
2. `mkdir -p logs data data/contracts`
3. `pm2 start ecosystem.config.js && pm2 save && pm2 startup`
4. Validar `curl http://localhost:3000/health`
5. Conferir nos logs que o follow-up scheduler subiu (`Follow-up scheduler started`)

**Pronto quando:** `/health` responde `ok` e `pm2 status` mostra o processo `online`.

**Prompt para o agente:**
```
Em whatsapp-openai-bot na VPS: npm install, crie os diretórios logs/, data/ e data/contracts/,
suba com pm2 start ecosystem.config.js, pm2 save e configure pm2 startup. Valide
curl http://localhost:3000/health e me mostre as 30 primeiras linhas de pm2 logs
confirmando "WhatsApp bot listening" e "Follow-up scheduler started".
```

---

## Fase 4 — Teste E2E com assinatura mock (🤝, ~1h)

**Objetivo:** validar o funil completo antes de gastar com ZapSign.

Tarefas:
1. 👤 Fabio manda "Olá" de outro número → deve receber boas-vindas + menu de 8 opções
2. 👤 Responde "1" (golpe do Pix) → deve receber a tese em 2 mensagens
3. 👤 Responde os 3 dados (banco, valor, B.O.) → deve receber a proposta com honorários de êxito
4. 👤 Aceita e manda nome completo → deve receber link de contrato (mock)
5. 🤖 Conferir no SQLite: `stage='contract'`, `case_type='golpe_pix'`, `client_name` preenchido, PDF gerado em `data/contracts/`
6. 🤖 Testar `/reset` e refazer com a área 6 (revisão de aposentadoria)
7. 🤖 Forçar um follow-up: `UPDATE leads SET follow_up_next_at=strftime('%s','now')*1000 WHERE phone='...'` e conferir que a mensagem do dia 1 chega

**Pronto quando:** funil completo percorrido em pelo menos 2 áreas + follow-up forçado entregue.

**Prompt para o agente:**
```
Vou testar o bot pelo WhatsApp. A cada etapa que eu disser "feito", confira no servidor:
pm2 logs (sem erros), sqlite3 data/threads.db "SELECT phone, stage, case_type, client_name
FROM leads;" e a existência do PDF em data/contracts/. No final, force um follow-up com
UPDATE leads SET follow_up_next_at=strftime('%s','now')*1000 WHERE phone='<meu numero>';
e confirme que recebi a mensagem. Me reporte qualquer erro de log com o stack completo.
```

---

## Fase 5 — ZapSign + HTTPS (🤝, ~2h)

**Objetivo:** assinatura digital real com fechamento automático do contrato.

Tarefas:
1. 👤 Criar conta ZapSign, gerar token de API, me passar
2. 🤖 Instalar Nginx + Certbot; configurar `bot.machadodeveza.com.br` com HTTPS fazendo proxy para `localhost:3000`
3. 🤖 Atualizar `.env`: `SIGNATURE_PROVIDER=zapsign`, `ZAPSIGN_TOKEN`, `ZAPSIGN_WEBHOOK_SECRET=$(openssl rand -hex 32)`, `PUBLIC_BASE_URL=https://bot.machadodeveza.com.br` → `pm2 restart`
4. 👤 No painel ZapSign, cadastrar webhook `doc_signed` → `https://bot.machadodeveza.com.br/sign-webhook` com o mesmo secret
5. 🤝 Teste real: percorrer o funil, assinar o documento de teste na ZapSign, confirmar que o lead vira `signed` e a mensagem de confirmação chega no WhatsApp

**Pronto quando:** um contrato de teste assinado na ZapSign fecha o lead automaticamente (`stage='signed'`).

**Prompt para o agente:**
```
Na VPS: instale nginx e certbot, configure o server block para bot.machadodeveza.com.br
com proxy_pass para http://localhost:3000 e emita o certificado Let's Encrypt. Ajuste o UFW
(permitir 80/443, manter 3000 e 8080 fechados externamente). Atualize o .env com
SIGNATURE_PROVIDER=zapsign, ZAPSIGN_TOKEN=<token>, ZAPSIGN_WEBHOOK_SECRET gerado com openssl,
PUBLIC_BASE_URL=https://bot.machadodeveza.com.br e reinicie com pm2. Me passe o secret para
eu cadastrar no painel da ZapSign e depois valide o endpoint /sign-webhook com um POST de teste.
```

---

## Fase 6 — Homologação: roteiro das 8 áreas (🤝, ~meio dia)

**Objetivo:** validar tom, teses e propostas com o olhar do advogado.

Roteiro (um chat `/reset` entre cada):

| # | Cenário de teste | Validar |
|---|---|---|
| 1 | "caí num golpe de pix de R$ 8.000" | Tese banco/responsabilidade objetiva; proposta êxito |
| 2 | "trabalhei 2 anos sem carteira" | Tese art. 3º CLT; pergunta provas; proposta % sobre recebido |
| 3 | "o INSS cortou meu auxílio" | Tese liminar/restabelecimento; pede laudos |
| 4 | "não consigo mais voltar a trabalhar" | Tese conversão + adicional 25% |
| 5 | "quando posso me aposentar?" | Tese estudo; proposta valor fixo; pede CNIS |
| 6 | "ganhei ação trabalhista, dá pra aumentar minha aposentadoria?" | Tese revisão; pede sentença; proposta % sobre diferenças |
| 7 | "quero ajuda com meu instagram" | Menciona parceria SmartAdv; diagnóstico gratuito |
| 8 | "tenho um problema de inventário" | Cai em "outro"; coleta o relato |
| — | Perguntar preço logo de cara | Bot adia educadamente até qualificar |
| — | Mandar "9" ou texto sem nexo na triagem | Bot reapresenta o menu |
| — | Ficar em silêncio (follow-up forçado) | Mensagens dia 1/3/7 com prova social e urgência da área certa |

Ajustes prováveis nesta fase: textos em `src/cases.js`, regras em `src/prompt.js`. Cada ajuste = editar → `pm2 restart` → retestar.

**Pronto quando:** Fabio aprova as 8 conversas e os follow-ups.

**Prompt para o agente:**
```
Vou rodar o roteiro de homologação da Fase 6 do ROADMAP.md pelo WhatsApp. Conforme eu
reportar ajustes de texto ou comportamento, edite src/cases.js e/ou src/prompt.js no
servidor, rode node --check nos arquivos alterados, pm2 restart whatsapp-openai-bot,
e me avise para retestar. Ao final, commite as alterações na branch com uma mensagem
descrevendo os ajustes de homologação e faça push.
```

---

## Fase 7 — Go-live + hardening (🤖 Agente, ~2h)

**Objetivo:** produção segura e resiliente.

Tarefas:
1. UFW definitivo: só SSH, 80, 443 abertos (8080 e 3000 apenas locais)
2. Backup diário do SQLite e contratos: cron `sqlite3 data/threads.db ".backup ..."` + tar de `data/contracts/` (reter 30 dias)
3. `pm2 install pm2-logrotate` (logs com rotação, máx 10 MB)
4. Healthcheck externo (UptimeRobot ou cron com alerta) em `https://bot.machadodeveza.com.br/health`
5. Atualização automática de segurança do SO: `unattended-upgrades`
6. Documentar runbook de incidentes no repositório (o que fazer se: Evolution cair, WhatsApp desparear, Claude 429/529, disco cheio)
7. Divulgar o número do bot (site, Instagram, Google Business)

**Pronto quando:** backup testado (restore de amostra), healthcheck ativo, runbook commitado.

**Prompt para o agente:**
```
Execute a Fase 7 do ROADMAP.md na VPS: feche o UFW (só OpenSSH, 80, 443), configure backup
diário via cron do data/threads.db (.backup do sqlite3) e tar do data/contracts/ com retenção
de 30 dias em /var/backups/whatsapp-bot/, instale pm2-logrotate com limite de 10MB, configure
unattended-upgrades, e crie docs/RUNBOOK.md no repositório cobrindo: Evolution caiu, WhatsApp
despareou, erros 429/529 da Anthropic, disco cheio e restore de backup. Teste um restore de
amostra do backup. Commite o runbook e faça push.
```

---

## Fase 8 — Operação contínua (🤝)

Cadência semanal (15 min):
- Funil: `sqlite3 data/threads.db "SELECT stage, COUNT(*) FROM leads GROUP BY stage;"`
- Taxa de conversão por área: leads `signed` / total por `case_type`
- Leads `lost` com motivo — vale ajustar tese/proposta?
- Custo Anthropic no console — se subir, avaliar `CLAUDE_MODEL=claude-sonnet-4-6`
- `git pull` de melhorias + `pm2 restart`

Backlog de evolução (priorizar depois do go-live):
- [ ] Dashboard web simples do funil (leads por estágio/área)
- [ ] Notificação ao advogado (WhatsApp/e-mail) quando lead chega em `contract` e `signed`
- [ ] Transcrição de áudios do cliente (hoje o bot só lê texto/legenda)
- [ ] Multi-atendente: transbordo para humano em casos complexos
- [ ] Métricas de cache hit e custo por conversa nos logs

---

## Dependências entre fases

```
Fase 0 ──► Fase 1 ──► Fase 2 ──► Fase 3 ──► Fase 4 ──► Fase 6 ──► Fase 7 ──► Fase 8
                                    │                     ▲
                                    └──► Fase 5 ──────────┘
                                    (ZapSign pode rodar em paralelo à homologação,
                                     mas precisa estar pronta antes do go-live)
```

## Riscos e planos B

| Risco | Mitigação |
|---|---|
| WhatsApp banir o número (uso não-oficial via Baileys) | Número dedicado, aquecimento gradual, sem disparo em massa; plano B: migrar para WhatsApp Cloud API oficial |
| ZapSign indisponível | `SIGNATURE_PROVIDER=mock` temporário + assinatura manual; arquitetura já aceita outro provedor em `src/signature.js` |
| Custo Anthropic acima do previsto | Trocar `CLAUDE_MODEL` para sonnet/haiku (1 linha no .env); prompt caching já ativo |
| VPS cair | PM2 + Docker `restart: unless-stopped` retomam sozinhos; backup diário garante os dados |
| Cliente manda áudio | Bot ignora hoje — orientar no primeiro contato ("me escreva por texto"); transcrição está no backlog |
