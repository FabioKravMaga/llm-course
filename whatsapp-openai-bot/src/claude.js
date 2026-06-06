import Anthropic from '@anthropic-ai/sdk';
import { config } from './config.js';
import { logger } from './logger.js';
import { SYSTEM_PROMPT } from './prompt.js';
import { tools } from './tools.js';

const client = new Anthropic({ apiKey: config.anthropicApiKey });

const systemBlocks = [
  {
    type: 'text',
    text: SYSTEM_PROMPT,
    cache_control: { type: 'ephemeral' }
  }
];

const MAX_TOOL_ITERATIONS = 8;

export async function runConversation(messages, dispatcher) {
  const history = [...messages];

  for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
    const response = await client.messages.create({
      model: config.claudeModel,
      max_tokens: config.claudeMaxTokens,
      system: systemBlocks,
      tools,
      messages: history,
      ...(config.claudeThinking === 'adaptive'
        ? { thinking: { type: 'adaptive' } }
        : config.claudeThinking === 'disabled'
        ? { thinking: { type: 'disabled' } }
        : {})
    });

    history.push({ role: 'assistant', content: response.content });

    if (response.stop_reason === 'pause_turn') continue;

    if (response.stop_reason === 'refusal') {
      logger.warn({ stop_details: response.stop_details }, 'Claude refused');
      return {
        history,
        reply: 'Desculpe, não consigo responder essa solicitação. Pode reformular?'
      };
    }

    if (response.stop_reason === 'tool_use') {
      const toolUseBlocks = response.content.filter((b) => b.type === 'tool_use');
      const toolResults = [];
      for (const block of toolUseBlocks) {
        let result;
        try {
          result = await dispatcher(block.name, block.input || {});
        } catch (err) {
          logger.error({ err: err.message, tool: block.name }, 'Tool dispatch failed');
          result = { error: err.message };
        }
        toolResults.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: JSON.stringify(result ?? { ok: true })
        });
      }
      history.push({ role: 'user', content: toolResults });
      continue;
    }

    const reply = response.content
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim();

    if (response.usage) {
      logger.debug(
        {
          input: response.usage.input_tokens,
          output: response.usage.output_tokens,
          cache_read: response.usage.cache_read_input_tokens,
          cache_create: response.usage.cache_creation_input_tokens
        },
        'Claude usage'
      );
    }

    return { history, reply };
  }

  throw new Error(`Tool loop exceeded ${MAX_TOOL_ITERATIONS} iterations`);
}

export function appendUserText(messages, text) {
  return [...messages, { role: 'user', content: text }];
}
