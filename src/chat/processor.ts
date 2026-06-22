import { Session } from './session.js';
import { ChatEngine } from './engine.js';
import { processToolCalls } from './tool-handler.js';
import { logger } from '../utils/logger.js';
import type { StreamChunk, LLMMessage, ChatResponse } from '../providers/base.js';

const DEFAULT_MAX_TOOL_CALLS = 50;

/**
 * Consume a stream and produce a ChatResponse.
 * Prints text chunks to stdout as they arrive.
 */
async function consumeStream(
  stream: AsyncGenerator<StreamChunk, void, unknown>,
): Promise<ChatResponse> {
  let text = '';
  const toolCalls: LLMMessage['tool_calls'] = [];
  let usage: ChatResponse['usage'] | undefined;

  for await (const chunk of stream) {
    switch (chunk.type) {
      case 'text':
        process.stdout.write(chunk.content ?? '');
        text += chunk.content ?? '';
        break;
      case 'tool_call':
        if (chunk.toolCall) toolCalls.push(chunk.toolCall);
        break;
      case 'done':
        usage = chunk.usage;
        break;
      case 'error':
        throw new Error(chunk.error ?? 'Stream error');
    }
  }

  const assistantMessage: LLMMessage = {
    role: 'assistant',
    content: text,
    tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
  };

  return { message: assistantMessage, usage };
}

/**
 * Fall back to non-streaming chat when the provider doesn't implement stream().
 */
async function nonStreamingChat(
  session: Session,
  engine: ChatEngine,
): Promise<ChatResponse> {
  return session.provider.chat(session.messages, engine.getTools());
}

/**
 * Process a single conversation turn — send messages to the model,
 * execute any tool calls, and repeat until the model stops calling tools.
 */
export async function processTurn(session: Session, engine: ChatEngine): Promise<void> {
  try {
    await session.compressIfNeeded();

    let response: ChatResponse;

    // Use streaming if the provider supports it
    if (session.provider.stream) {
      const stream = session.provider.stream(
        session.messages,
        engine.getTools(),
        undefined, // ProviderOptions (future: pull from config)
      );
      response = await consumeStream(stream);
      process.stdout.write('\n');
    } else {
      response = await nonStreamingChat(session, engine);
    }

    session.addMessage(response.message);

    // Loop while there are tool calls requested by the model
    let toolCallCount = 0;
    const maxToolCalls = engine.getMaxToolCalls() ?? DEFAULT_MAX_TOOL_CALLS;

    while (response.message.tool_calls && response.message.tool_calls.length > 0) {
      toolCallCount += response.message.tool_calls.length;

      if (toolCallCount > maxToolCalls) {
        logger.warn(`Tool call limit reached (${maxToolCalls}). Stopping tool execution.`);
        const limitMessage = {
          role: 'assistant' as const,
          content: `[System: Tool call limit of ${maxToolCalls} reached. Please continue with a text response.]`,
        };
        session.addMessage(limitMessage);

        if (session.provider.stream) {
          const stream = session.provider.stream(
            session.messages,
            engine.getTools(),
          );
          response = await consumeStream(stream);
          process.stdout.write('\n');
        } else {
          response = await nonStreamingChat(session, engine);
        }
        session.addMessage(response.message);
        break;
      }

      await processToolCalls(response.message.tool_calls, session.messages, engine);

      if (session.provider.stream) {
        const stream = session.provider.stream(
          session.messages,
          engine.getTools(),
        );
        response = await consumeStream(stream);
        process.stdout.write('\n');
      } else {
        response = await nonStreamingChat(session, engine);
      }
      session.addMessage(response.message);
    }

    // For non-streaming mode, print the full response at once
    if (!session.provider.stream && response.message.content) {
      console.log(`\n${response.message.content}\n`);
    }
  } catch (error: any) {
    logger.error(`Error during conversation turn: ${error.message}`);
  }
}
