import * as readline from 'readline';
import { v4 as uuidv4 } from 'uuid';
import { loadConfig } from '../config.js';
import { logger } from '../utils/logger.js';
import { loadSession, saveSession, listSessions } from '../utils/storage.js';
import { Session } from './session.js';
import { ChatEngine } from './engine.js';
import { setCwd } from '../tools/exec.js';
import { processTurn } from './processor.js';

export async function startChatLoop(resumeId?: string, initialModel?: string): Promise<void> {
  const config = await loadConfig();
  const engine = new ChatEngine(config);
  await engine.rebuildAllTools();

  let modelName = initialModel || config.defaultModel || 'Gemini 2.5 Flash';
  let session: Session;

  // session creation or resume
  if (resumeId) {
    const data = await loadSession(resumeId);
    modelName = data.modelName;
    session = new Session(data.id, modelName, undefined, data.messages);
    // create provider and inject
    const provider = await engine.createProvider(modelName);
    session.setProvider(provider);
    logger.info(`Resumed session ${resumeId} with model ${modelName}`);
  } else {
    session = new Session(uuidv4(), modelName);
    const provider = await engine.createProvider(modelName);
    session.setProvider(provider);
    await saveSession(session.id, session.toJSON());
    logger.info(`New session ${session.id} with ${modelName}`);
  }

  setCwd(process.cwd());

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: '> ',
  });

  logger.info(`Working directory: ${process.cwd()}`);
  logger.info('Type /help for commands, /exit to quit.');
  rl.prompt();

  rl.on('line', async (input) => {
    const trimmed = input.trim();
    if (trimmed === '/exit') {
      rl.close();
      return;
    }
    if (trimmed === '/help') {
      logger.info(`
Commands:
  /model <model>               Switch model
  /review <file1> [file2 ...]  Review one or more files
  /suggest <task description>  Generate code suggestion
  /compress                   Force context compression
  /clear                      Clear conversation (keep system)
  /sessions                   List saved sessions
  /save                       Save current session
  /exit                       Quit
      `);
      rl.prompt();
      return;
    }

    // Model switching
    if (trimmed.startsWith('/model')) {
      const parts = trimmed.split(' ');
      if (parts.length < 2) {
        logger.info('Usage: /model <model>');
      } else {
        const newModel = parts[1];
        session.modelName = newModel;
        logger.info(`Switched to ${newModel}`);
      }
      rl.prompt();
      return;
    }

    // Code review command
    if (trimmed.startsWith('/review')) {
      const parts = trimmed.split(' ');
      if (parts.length < 2) {
        logger.info('Usage: /review <file1> [file2 ...]');
      } else {
        const filePaths = parts.slice(1);
        for (const fp of filePaths) {
          try {
            const content = await engine.executeTool('file_read', { path: fp });
            if (content.startsWith('Error:')) {
              logger.error(`Skipping ${fp}: ${content}`);
              continue;
            }
            logger.info(`\n🔍 Reviewing ${fp}...`);
            session.addMessage({
              role: 'user',
              content: `Please perform a detailed code review of the file **${fp}**. Consider bugs, security, performance, style, and best practices.\n\n\`\`\`\n${content}\n\`\`\``,
            });
            await processTurn(session, engine);
          } catch (e: unknown) {
            const errMsg = e instanceof Error ? e.message : String(e);
            logger.error(`Error reading ${fp}: ${errMsg}`);
// removed duplicate error log
          }
        }
        await saveSession(session.id, session.toJSON());
      }
      rl.prompt();
      return;
    }

    // Generate code suggestion
    if (trimmed.startsWith('/suggest')) {
      const task = trimmed.slice('/suggest'.length).trim();
      if (!task) {
        logger.info('Usage: /suggest <description of what you want to implement>');
      } else {
        session.addMessage({
          role: 'user',
          content: `Write code to ${task}. Provide the full implementation with explanation.`,
        });
        await processTurn(session, engine);
        await saveSession(session.id, session.toJSON());
      }
      rl.prompt();
      return;
    }

    if (trimmed === '/compress') {
      await session.compressIfNeeded();
      await saveSession(session.id, session.toJSON());
      rl.prompt();
      return;
    }
    if (trimmed === '/clear') {
      session.messages = [session.messages[0]]; // keep system
      logger.info('Conversation cleared.');
      await saveSession(session.id, session.toJSON());
      rl.prompt();
      return;
    }
    if (trimmed === '/sessions') {
      await listSessions();
      rl.prompt();
      return;
    }
    if (trimmed === '/save') {
      await saveSession(session.id, session.toJSON());
      logger.info('Session saved.');
      rl.prompt();
      return;
    }

    // Normal user input
    session.addMessage({ role: 'user', content: trimmed });
    await processTurn(session, engine);
    await saveSession(session.id, session.toJSON());
    rl.prompt();
  });

  rl.on('close', async () => {
    await saveSession(session.id, session.toJSON());
    await engine.close();
    logger.info('Goodbye!');
    process.exit(0);
  });
}
