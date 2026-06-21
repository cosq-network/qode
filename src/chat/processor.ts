import { Session } from './session.js';
import { ChatEngine } from './engine.js';
import { processToolCalls } from './tool-handler.js';

/**
 * Wrapper that preserves the original REPL API.
 * It forwards the session's messages to {@link processToolCalls}.
 * Any tool calls present in the messages will be executed.
 */
export async function processTurn(session: Session, _engine: ChatEngine): Promise<void> {
  // Extract tool calls from the session messages if present.
  // The type is loosely any because the actual shape is validated at runtime.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const toolCalls = (session.messages as any) as any[];
  await processToolCalls(toolCalls, session.messages);
}
