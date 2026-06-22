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
  engine: ChatEngine
): Promise<void> {
  for (const toolCall of toolCalls) {
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
      .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
      .join(', ')})...`);

    let result: string;
    try {
      result = await engine.executeTool(fnName, fnArgs);
    } catch (error) {
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
