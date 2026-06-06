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

export async function runAndWait(threadId, dispatcher) {
  let current = await client.beta.threads.runs.create(threadId, {
    assistant_id: config.assistantId
  });

  const deadline = Date.now() + config.runTimeoutMs;

  while (true) {
    if (['queued', 'in_progress', 'cancelling'].includes(current.status)) {
      if (Date.now() > deadline) {
        await client.beta.threads.runs.cancel(threadId, current.id).catch(() => {});
        throw new Error(`Run ${current.id} timed out after ${config.runTimeoutMs}ms`);
      }
      await sleep(800);
      current = await client.beta.threads.runs.retrieve(threadId, current.id);
      continue;
    }

    if (current.status === 'requires_action') {
      const calls = current.required_action?.submit_tool_outputs?.tool_calls || [];
      const outputs = [];
      for (const call of calls) {
        let output;
        try {
          const args = call.function.arguments ? JSON.parse(call.function.arguments) : {};
          const result = dispatcher
            ? await dispatcher(call.function.name, args)
            : { error: 'no dispatcher' };
          output = JSON.stringify(result ?? { ok: true });
        } catch (err) {
          logger.error({ err: err.message, tool: call.function.name }, 'Tool dispatch failed');
          output = JSON.stringify({ error: err.message });
        }
        outputs.push({ tool_call_id: call.id, output });
      }
      current = await client.beta.threads.runs.submitToolOutputs(threadId, current.id, {
        tool_outputs: outputs
      });
      continue;
    }

    if (current.status === 'completed') break;

    logger.error(
      { runId: current.id, status: current.status, last_error: current.last_error },
      'Run did not complete'
    );
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
