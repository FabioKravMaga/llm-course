import express from 'express';
import { config } from './config.js';
import { logger } from './logger.js';
import { handleIncoming } from './handler.js';

const app = express();
app.use(express.json({ limit: '5mb' }));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', instance: config.evolutionInstance });
});

app.post('/webhook/:token?', (req, res) => {
  if (config.webhookToken && req.params.token !== config.webhookToken) {
    return res.status(401).json({ error: 'invalid token' });
  }

  res.status(200).json({ received: true });

  Promise.resolve()
    .then(() => handleIncoming(req.body))
    .catch((err) => {
      logger.error({ err: err.message, stack: err.stack }, 'handleIncoming failed');
    });
});

app.listen(config.port, () => {
  logger.info(
    { port: config.port, instance: config.evolutionInstance },
    'WhatsApp bot listening'
  );
});

process.on('unhandledRejection', (reason) => {
  logger.error({ reason: String(reason) }, 'unhandledRejection');
});
