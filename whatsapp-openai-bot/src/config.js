import 'dotenv/config';

const required = ['OPENAI_API_KEY', 'ASSISTANT_ID', 'EVOLUTION_API_KEY', 'EVOLUTION_INSTANCE'];
const missing = required.filter((k) => !process.env[k]);
if (missing.length) {
  throw new Error(`Missing required env vars: ${missing.join(', ')}`);
}

export const config = {
  openaiApiKey: process.env.OPENAI_API_KEY,
  assistantId: process.env.ASSISTANT_ID,
  evolutionUrl: process.env.EVOLUTION_URL || 'http://localhost:8080',
  evolutionApiKey: process.env.EVOLUTION_API_KEY,
  evolutionInstance: process.env.EVOLUTION_INSTANCE,
  port: Number(process.env.PORT || 3000),
  webhookToken: process.env.WEBHOOK_TOKEN || '',
  dbPath: process.env.DB_PATH || './data/threads.db',
  runTimeoutMs: Number(process.env.RUN_TIMEOUT_MS || 60000),
  logLevel: process.env.LOG_LEVEL || 'info'
};
