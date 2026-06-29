import { LLMMessage, ToolCall } from '../providers/base.js';
import { logger } from '../utils/logger.js';
import type { ChatEngine } from './engine.js';
import type { TerminalChatUI } from './terminal-ui.js';
import fs from 'fs-extra';

function summarizeOutput(output: string): string {
  if (output.length <= 300) return output;
  return `${output.slice(0, 300)}\n... [truncated ${output.length - 300} characters]`;
}

export async function processToolCalls(
  toolCalls: ToolCall[],
  messages: LLMMessage[],
  engine: ChatEngine,
  signal?: AbortSignal,
  session?: import('./session.js').Session,
  ui?: TerminalChatUI
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

    if (session) {
      let riskLevel: import('./session.js').AuditRiskLevel = 'low';
      if (fnName.includes('shell') || fnName.includes('delete') || fnName.includes('remove')) {
        riskLevel = 'high';
      } else if (fnName.includes('write') || fnName.includes('edit') || fnName.includes('replace')) {
        riskLevel = 'medium';
      }
      session.addAuditEntry({ toolName: fnName, args: JSON.stringify(fnArgs), riskLevel });
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

    let targetFile = '';
    let originalContent: string | null = null;
    if (fnName.includes('write') || fnName.includes('edit') || fnName.includes('replace')) {
      targetFile = (fnArgs.TargetFile || fnArgs.targetFile || fnArgs.file || fnArgs.path) as string;
      if (targetFile) {
        try {
          originalContent = await fs.readFile(targetFile, 'utf8');
        } catch {
          originalContent = null;
        }
      }
    }

    let result: string;
    try {
      result = await engine.executeTool(fnName, fnArgs, signal);
      
      if (ui && targetFile) {
        let newContent: string | null = null;
        try {
          newContent = await fs.readFile(targetFile, 'utf8');
        } catch {}
        
        if (newContent !== null && originalContent !== newContent) {
          const decision = await ui.showDiffTheater(targetFile, originalContent || '', newContent);
          if (decision === 'revert') {
            if (originalContent === null) {
              await fs.unlink(targetFile);
            } else {
              await fs.writeFile(targetFile, originalContent, 'utf8');
            }
            logger.info(`Reverted changes to ${targetFile} via Terminal Diff Theater`);
            result += '\n(User reverted these changes via Diff Theater)';
          }
        }
      }
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
