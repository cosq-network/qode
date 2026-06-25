import { LLMMessage, ToolCall } from '../providers/base.js';
import { logger } from '../utils/logger.js';
import type { ChatEngine } from './engine.js';

function summarizeOutput(output: string): string {
  if (output.length <= 300) return output;
  return `${output.slice(0, 300)}\n... [truncated ${output.length - 300} characters]`;
}

export async function processToolCalls(
  toolCalls: ToolCall[],
  messages: LLMMessage[],
  engine: ChatEngine,
  signal?: AbortSignal
): Promise<void> {
  for (const toolCall of toolCalls) {
    if (signal?.aborted) {
      throw new Error('Operation cancelled.');
    }
    const fnName = toolCall.function.name;

    let fnArgs: Record<string, unknown>;
    try {
      fnArgs = JSON.parse(toolCall.function.arguments);
    } catch (error) {
      const message = `Error: Invalid tool arguments for ${fnName}: ${error instanceof Error ? error.message : String(error)}`;
      logger.error(message);
      messages.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        name: fnName,
        content: message,
      });
      continue;
    }

    logger.info(`⚙ Executing ${fnName}(${Object.entries(fnArgs)
      .map(([key, value]) => {
        const str = typeof value === 'string' ? value : JSON.stringify(value);
        const lower = key.toLowerCase();
        if (/(key|token|secret|password|auth|credential)/.test(lower)) {
          return `${key}=[REDACTED]`;
        }
        return `${key}=${str.length > 60 ? `${str.slice(0, 57)}...` : str}`;
      })
      .join(', ')})...`);

    let result: string;
    try {
      result = await engine.executeTool(fnName, fnArgs, signal);
    } catch (error) {
      if (signal?.aborted) {
        throw new Error('Operation cancelled.');
      }
      result = `Error: ${error instanceof Error ? error.message : String(error)}`;
    }

    logger.info(summarizeOutput(result));
    messages.push({
      role: 'tool',
      tool_call_id: toolCall.id,
      name: fnName,
      content: result,
    });
  }
}
