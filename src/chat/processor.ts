import { Session } from './session.js';
import { ChatEngine } from './engine.js';
import { processToolCalls } from './tool-handler.js';
import { logger } from '../utils/logger.js';

export async function processTurn(session: Session, engine: ChatEngine): Promise<void> {
  try {
    // Compress context if needed before sending
    await session.compressIfNeeded();

    let response = await session.provider.chat(session.messages, engine.getTools());
    session.addMessage(response.message);

    // Loop while there are tool calls requested by the model
    while (response.message.tool_calls && response.message.tool_calls.length > 0) {
      await processToolCalls(response.message.tool_calls, session.messages);
      response = await session.provider.chat(session.messages, engine.getTools());
      session.addMessage(response.message);
    }

    // Print assistant response
    if (response.message.content) {
      console.log(`\n${response.message.content}\n`);
    }
  } catch (error: any) {
    logger.error(`Error during conversation turn: ${error.message}`);
  }
}

