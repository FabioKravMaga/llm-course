import OpenAI from 'openai';
import { config } from './config.js';
import { logger } from './logger.js';

const client = new OpenAI({ apiKey: config.openaiApiKey });

export async function createThread() {
  const thread = await client.beta.threads.create();
  return thread.id;
}

export async function addUserMessage(threadId, content) {
  await client.beta.threads.messages.create(threadId, {
    role: 'user',
    content
  });
}

export async function runAndWait(threadId) {
  const run = await client.beta.threads.runs.create(threadId, {
    assistant_id: config.assistantId
  });

  const deadline = Date.now() + config.runTimeoutMs;
  let current = run;
  while (['queued', 'in_progress', 'cancelling'].includes(current.status)) {
    if (Date.now() > deadline) {
      await client.beta.threads.runs.cancel(threadId, current.id).catch(() => {});
      throw new Error(`Run ${current.id} timed out after ${config.runTimeoutMs}ms`);
    }
    await sleep(800);
    current = await client.beta.threads.runs.retrieve(threadId, current.id);
  }

  if (current.status !== 'completed') {
    logger.error({ runId: current.id, status: current.status, last_error: current.last_error }, 'Run did not complete');
    throw new Error(`Run ended with status ${current.status}`);
  }

  const messages = await client.beta.threads.messages.list(threadId, {
    order: 'desc',
    limit: 1
  });
  const reply = messages.data[0];
  if (!reply || reply.role !== 'assistant') {
    throw new Error('No assistant message returned');
  }
  return reply.content
    .filter((part) => part.type === 'text')
    .map((part) => part.text.value)
    .join('\n')
    .trim();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
