import 'dotenv/config';

const required = ['ANTHROPIC_API_KEY', 'EVOLUTION_API_KEY', 'EVOLUTION_INSTANCE'];
const missing = required.filter((k) => !process.env[k]);
if (missing.length) {
  throw new Error(`Missing required env vars: ${missing.join(', ')}`);
}

const parseDelays = (raw, fallback) => {
  if (!raw) return fallback;
  return raw
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
};

const FOUR_HOURS = 4 * 60 * 60 * 1000;
const ONE_DAY = 24 * 60 * 60 * 1000;
const THREE_DAYS = 3 * 24 * 60 * 60 * 1000;

export const config = {
  anthropicApiKey: process.env.ANTHROPIC_API_KEY,
  claudeModel: process.env.CLAUDE_MODEL || 'claude-opus-4-8',
  claudeThinking: process.env.CLAUDE_THINKING || 'adaptive',
  claudeMaxTokens: Number(process.env.CLAUDE_MAX_TOKENS || 2048),

  evolutionUrl: process.env.EVOLUTION_URL || 'http://localhost:8080',
  evolutionApiKey: process.env.EVOLUTION_API_KEY,
  evolutionInstance: process.env.EVOLUTION_INSTANCE,

  port: Number(process.env.PORT || 3000),
  webhookToken: process.env.WEBHOOK_TOKEN || '',
  dbPath: process.env.DB_PATH || './data/threads.db',
  logLevel: process.env.LOG_LEVEL || 'info',

  followUp: {
    enabled: process.env.FOLLOWUP_ENABLED !== 'false',
    scanIntervalMs: Number(process.env.FOLLOWUP_SCAN_INTERVAL_MS || 5 * 60 * 1000),
    delaysMs: parseDelays(process.env.FOLLOWUP_DELAYS_MS, [FOUR_HOURS, ONE_DAY, THREE_DAYS])
  },

  lawyer: {
    name: process.env.LAWYER_NAME || 'Escritório de Advocacia',
    oab: process.env.LAWYER_OAB || '',
    document: process.env.LAWYER_DOCUMENT || '',
    address: process.env.LAWYER_ADDRESS || '',
    email: process.env.LAWYER_EMAIL || '',
    pixKey: process.env.LAWYER_PIX_KEY || ''
  },

  signature: {
    provider: process.env.SIGNATURE_PROVIDER || 'mock',
    zapsignToken: process.env.ZAPSIGN_TOKEN || '',
    zapsignWebhookSecret: process.env.ZAPSIGN_WEBHOOK_SECRET || '',
    publicBaseUrl: process.env.PUBLIC_BASE_URL || ''
  },

  contractsDir: process.env.CONTRACTS_DIR || './data/contracts'
};
