import * as readline from 'readline';
import { v4 as uuidv4 } from 'uuid';
import { loadConfig, saveConfig } from '../config.js';
import { logger } from '../utils/logger.js';
import { loadSession, saveSession, listSessions } from '../utils/storage.js';
import { Session } from './session.js';
import { ChatEngine } from './engine.js';
import { setCwd } from '../tools/exec.js';
import { processTurn } from './processor.js';
import { loadSkills, matchSkills } from '../utils/skills.js';
import { fetchRegistry, searchRegistry, installSkill } from '../utils/registry.js';
import { getRecentFiles } from '../utils/files.js';
import { getTheme, THEMES } from '../utils/themes.js';
import { copyToClipboard, pasteFromClipboard } from '../utils/clipboard.js';
import path from 'path';
import fs from 'fs-extra';

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
    completer,
  });

  logger.info(`Working directory: ${process.cwd()}`);
  logger.info('Type /help for commands, /exit to quit.');
  await promptNext(session, rl, config);

  let linesAccumulator: string[] = [];

  rl.on('line', async (input) => {
    let trimmed = input.trim();
    // Multiline continuation check (backslash at the end of the line)
    const endsWithContinuation = input.endsWith('\\');
    if (endsWithContinuation) {
      linesAccumulator.push(input.slice(0, -1)); // strip backslash
      rl.setPrompt('... ');
      rl.prompt();
      return;
    }

    // Support multiline cancellation via /cancel
    if (linesAccumulator.length > 0 && trimmed === '/cancel') {
      linesAccumulator = [];
      logger.info('Multiline input cancelled.');
      rl.setPrompt('> ');
      await promptNext(session, rl, config);
      return;
    }

    // Combine accumulated lines if any
    if (linesAccumulator.length > 0) {
      linesAccumulator.push(input);
      trimmed = linesAccumulator.join('\n').trim();
      linesAccumulator = []; // reset
      rl.setPrompt('> '); // restore prompt
    }

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
  /skills                     Manage skills (list, search, install, list-local)
  /theme [name]               List or switch CLI visual themes
  /status                     Show session dashboard (tokens, duration, changed files)
  /copy                       Copy last response to clipboard
  /paste                      Paste clipboard content as prompt
  /exit                       Quit
      `);
      await promptNext(session, rl, config);
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
      await promptNext(session, rl, config);
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
            await activateSkills(fp, session);
            session.addMessage({
              role: 'user',
              content: `Please perform a detailed code review of the file **${fp}**. Consider bugs, security, performance, style, and best practices.\n\n\`\`\`\n${content}\n\`\`\``,
            });
            await processTurn(session, engine);
          } catch (e: unknown) {
            const errMsg = e instanceof Error ? e.message : String(e);
            logger.error(`Error reading ${fp}: ${errMsg}`);
          }
        }
        await saveSession(session.id, session.toJSON());
      }
      await promptNext(session, rl, config);
      return;
    }

    // Generate code suggestion
    if (trimmed.startsWith('/suggest')) {
      const task = trimmed.slice('/suggest'.length).trim();
      if (!task) {
        logger.info('Usage: /suggest <description of what you want to implement>');
      } else {
        await activateSkills(task, session);
        session.addMessage({
          role: 'user',
          content: `Write code to ${task}. Provide the full implementation with explanation.`,
        });
        await processTurn(session, engine);
        await saveSession(session.id, session.toJSON());
      }
      await promptNext(session, rl, config);
      return;
    }

    if (trimmed === '/compress') {
      await session.compressIfNeeded();
      await saveSession(session.id, session.toJSON());
      await promptNext(session, rl, config);
      return;
    }
    if (trimmed === '/clear') {
      session.messages = [session.messages[0]]; // keep system
      logger.info('Conversation cleared.');
      await saveSession(session.id, session.toJSON());
      await promptNext(session, rl, config);
      return;
    }
    if (trimmed === '/sessions') {
      await listSessions();
      await promptNext(session, rl, config);
      return;
    }
    if (trimmed === '/save') {
      await saveSession(session.id, session.toJSON());
      logger.info('Session saved.');
      await promptNext(session, rl, config);
      return;
    }

    if (trimmed.startsWith('/skills')) {
      const parts = trimmed.split(/\s+/);
      const subCommand = parts[1];
      if (!subCommand || subCommand === 'help') {
        logger.info(`
Skills Commands:
  /skills list                      List available skills in the public registry
  /skills search <query>            Search public registry for skills
  /skills install <name> [--global] Install a skill from registry to workspace or global
  /skills list-local                List all installed skills
        `);
      } else if (subCommand === 'list') {
        logger.info('Fetching public skill registry...');
        const registrySkills = await fetchRegistry();
        if (registrySkills.length === 0) {
          logger.info('No skills found in remote registry.');
        } else {
          logger.info('\nAvailable Skills in Public Registry:');
          registrySkills.forEach(s => {
            logger.info(`- **${s.name}**: ${s.description} (tags: ${s.tags.join(', ')})`);
          });
        }
      } else if (subCommand === 'search') {
        const query = parts.slice(2).join(' ').trim();
        if (!query) {
          logger.info('Usage: /skills search <query>');
        } else {
          logger.info(`Searching public registry for "${query}"...`);
          const matched = await searchRegistry(query);
          if (matched.length === 0) {
            logger.info('No matching skills found.');
          } else {
            logger.info(`\nMatched Skills:`);
            matched.forEach(s => {
              logger.info(`- **${s.name}**: ${s.description} (tags: ${s.tags.join(', ')})`);
            });
          }
        }
      } else if (subCommand === 'install') {
        const installArgs = parts.slice(2);
        let isGlobal = false;
        const nameParts: string[] = [];
        installArgs.forEach(arg => {
          if (arg === '--global' || arg === '-g') {
            isGlobal = true;
          } else {
            nameParts.push(arg);
          }
        });
        const skillName = nameParts.join(' ').trim();
        if (!skillName) {
          logger.info('Usage: /skills install <name> [--global]');
        } else {
          logger.info(`Installing skill "${skillName}"...`);
          const success = await installSkill(skillName, process.cwd(), isGlobal);
          if (success) {
            logger.info(`Skill "${skillName}" successfully installed.`);
          }
        }
      } else if (subCommand === 'list-local') {
        try {
          const localSkills = await loadSkills(process.cwd());
          if (localSkills.length === 0) {
            logger.info('No local or global skills currently installed.');
          } else {
            logger.info('\nInstalled Skills (Workspace & Global):');
            localSkills.forEach(s => {
              logger.info(`- **${s.name}** at ${s.path} (tags: ${s.tags.join(', ')})`);
            });
          }
        } catch (err: any) {
          logger.error(`Failed to list local skills: ${err.message}`);
        }
      } else {
        logger.info(`Unknown skills sub-command: ${subCommand}. Type /skills help for details.`);
      }
      await promptNext(session, rl, config);
      return;
    }

    if (trimmed.startsWith('/theme')) {
      const parts = trimmed.split(/\s+/);
      const chosenTheme = parts[1];
      if (!chosenTheme) {
        logger.info(`Current theme: \x1b[36m${config.theme || 'default'}\x1b[0m`);
        logger.info(`Available themes: ${Object.keys(THEMES).join(', ')}`);
      } else {
        const themeLower = chosenTheme.toLowerCase();
        if (THEMES[themeLower]) {
          config.theme = themeLower;
          await saveConfig(config);
          logger.info(`Theme switched to \x1b[36m${themeLower}\x1b[0m`);
        } else {
          logger.info(`Unknown theme "${chosenTheme}". Available: ${Object.keys(THEMES).join(', ')}`);
        }
      }
      await promptNext(session, rl, config);
      return;
    }

    if (trimmed === '/status') {
      logger.info('\n┌─────────────────────────── Session Status ───────────────────────────┐');
      logger.info(`│ 🤖 Model: \x1b[36m${session.modelName}\x1b[0m (${session.provider?.providerName || 'N/A'})`);
      logger.info(`│ 📁 Directory: \x1b[33m${process.cwd()}\x1b[0m`);
      
      // Duration
      const sessionStart = new Date(session.createdAt).getTime();
      const elapsedMs = Date.now() - sessionStart;
      const formatDuration = (ms: number) => {
        const secs = Math.floor(ms / 1000) % 60;
        const mins = Math.floor(ms / 60000) % 60;
        const hours = Math.floor(ms / 3600000);
        return `${hours > 0 ? `${hours}h ` : ''}${mins > 0 ? `${mins}m ` : ''}${secs}s`;
      };
      logger.info(`│ 🕒 Session Age: ${formatDuration(elapsedMs)}`);

      // Tokens
      let consumed = 0;
      let limit = 0;
      if (session.provider) {
        consumed = session.messages.reduce((sum, m) => sum + session.provider.countTokens(m.content ?? ''), 0);
        limit = session.provider.maxContextTokens;
      }
      const pct = limit > 0 ? ((consumed / limit) * 100).toFixed(1) : '0';
      logger.info(`│ 📊 Token Usage: \x1b[32m${consumed}\x1b[0m / ${limit} tokens (${pct}%)`);

      // Theme
      logger.info(`│ 🎨 Active Theme: \x1b[36m${config.theme || 'default'}\x1b[0m`);

      // Recent Files
      let recentFiles: string[] = [];
      try {
        recentFiles = await getRecentFiles(process.cwd(), 5);
      } catch {}
      const filesWithTime = [];
      for (const file of recentFiles) {
        try {
          const stat = await fs.stat(path.join(process.cwd(), file));
          const diffMs = Date.now() - stat.mtimeMs;
          let timeStr = '';
          if (diffMs < 60000) {
            timeStr = 'just now';
          } else if (diffMs < 3600000) {
            timeStr = `${Math.floor(diffMs / 60000)}m ago`;
          } else {
            timeStr = `${Math.floor(diffMs / 3600000)}h ago`;
          }
          filesWithTime.push(`\x1b[35m${file}\x1b[0m (${timeStr})`);
        } catch {
          filesWithTime.push(`\x1b[35m${file}\x1b[0m`);
        }
      }
      logger.info(`│ 📄 Changed Files: ${filesWithTime.length > 0 ? filesWithTime.join(', ') : 'None'}`);

      // Tools & MCP
      const totalTools = engine.getTools().length;
      logger.info(`│ 🔧 Loaded Tools: ${totalTools} active tools (including built-ins & MCP)`);

      logger.info('└──────────────────────────────────────────────────────────────────────┘\n');
      await promptNext(session, rl, config);
      return;
    }

    if (trimmed === '/copy') {
      const assistantMessages = session.messages.filter(m => m.role === 'assistant');
      if (assistantMessages.length === 0) {
        logger.info('No assistant messages found to copy.');
      } else {
        const lastResponse = assistantMessages[assistantMessages.length - 1].content || '';
        const success = await copyToClipboard(lastResponse);
        if (success) {
          logger.info('✔ Last response copied to clipboard.');
        } else {
          logger.error('Failed to copy to clipboard.');
        }
      }
      await promptNext(session, rl, config);
      return;
    }

    if (trimmed === '/paste') {
      logger.info('Pasting prompt from system clipboard...');
      const clipboardContent = await pasteFromClipboard();
      if (!clipboardContent) {
        logger.info('Clipboard is empty or could not be read.');
        await promptNext(session, rl, config);
      } else {
        logger.info(`\n\x1b[90mPasted Content:\x1b[0m\n${clipboardContent}\n`);
        await activateSkills(clipboardContent, session);
        session.addMessage({ role: 'user', content: clipboardContent });
        await processTurn(session, engine);
        await saveSession(session.id, session.toJSON());
        await promptNext(session, rl, config);
      }
      return;
    }

    // Normal user input
    await activateSkills(trimmed, session);
    session.addMessage({ role: 'user', content: trimmed });
    await processTurn(session, engine);
    await saveSession(session.id, session.toJSON());
    await promptNext(session, rl, config);
  });

  const keypressHandler = async (str: string, key: any) => {
    if (key && key.ctrl) {
      if (key.name === 'k') {
        const assistantMessages = session.messages.filter(m => m.role === 'assistant');
        if (assistantMessages.length === 0) {
          logger.info('\nNo response to copy.');
        } else {
          const lastResponse = assistantMessages[assistantMessages.length - 1].content || '';
          const success = await copyToClipboard(lastResponse);
          if (success) {
            logger.info('\n✔ Last response copied to clipboard.');
          } else {
            logger.error('\nFailed to copy to clipboard.');
          }
        }
        await promptNext(session, rl, config);
      } else if (key.name === 'g') {
        logger.info('\nPasting from clipboard...');
        const clipboardContent = await pasteFromClipboard();
        if (!clipboardContent) {
          logger.info('Clipboard is empty.');
          await promptNext(session, rl, config);
        } else {
          logger.info(`\n\x1b[90mPasted Content:\x1b[0m\n${clipboardContent}\n`);
          await activateSkills(clipboardContent, session);
          session.addMessage({ role: 'user', content: clipboardContent });
          await processTurn(session, engine);
          await saveSession(session.id, session.toJSON());
          await promptNext(session, rl, config);
        }
      }
    }
  };

  process.stdin.on('keypress', keypressHandler);

  rl.on('close', async () => {
    process.stdin.removeListener('keypress', keypressHandler);
    await saveSession(session.id, session.toJSON());
    await engine.close();
    logger.info('Goodbye!');
    process.exit(0);
  });
}

async function activateSkills(prompt: string, session: Session): Promise<void> {
  try {
    const skills = await loadSkills(process.cwd());
    const matched = matchSkills(prompt, skills);
    if (session.messages.length === 0) {
      session.messages.push({ role: 'system', content: session.systemPrompt });
    }
    if (matched.length > 0) {
      logger.info(`💡 Activating skills: ${matched.map(s => s.name).join(', ')}`);
      const skillInstructions = matched
        .map(s => `=== Skill: ${s.name} ===\n${s.instructions}`)
        .join('\n\n');
      session.messages[0].content = `${session.systemPrompt}\n\n${skillInstructions}`;
    } else {
      session.messages[0].content = session.systemPrompt;
    }
  } catch (error: any) {
    logger.error(`Failed to load or match skills: ${error.message}`);
  }
}

async function promptNext(session: Session, rl: readline.Interface, config: any): Promise<void> {
  await renderStatusHeader(session, process.cwd(), config.theme);
  rl.prompt();
}

async function renderStatusHeader(session: Session, cwd: string, themeName?: string): Promise<void> {
  const t = getTheme(themeName);
  const reset = '\x1b[0m';
  const model = session.modelName;
  const providerName = session.provider?.providerName || 'N/A';
  
  // Calculate tokens
  let consumedTokens = 0;
  let maxTokens = 0;
  if (session.provider) {
    consumedTokens = session.messages.reduce(
      (sum, m) => sum + session.provider.countTokens(m.content ?? ''),
      0
    );
    maxTokens = session.provider.maxContextTokens;
  }
  const pctUsed = maxTokens > 0 ? ((consumedTokens / maxTokens) * 100).toFixed(1) : '0';

  // Get recent files
  let recentFiles: string[] = [];
  try {
    recentFiles = await getRecentFiles(cwd);
  } catch {
    // Ignore error
  }

  const border = '─'.repeat(78);
  console.log(`\n${t.borderChar}┌${border}┐${reset}`);
  console.log(`${t.borderChar}│${reset} 🤖 Model: ${t.model}${model}${reset} (${providerName})`);
  console.log(`${t.borderChar}│${reset} 📁 Directory: ${t.dir}${cwd}${reset}`);
  console.log(`${t.borderChar}│${reset} 📊 Context usage: ${t.context}${consumedTokens}${reset} / ${maxTokens} tokens (${pctUsed}%)`);
  if (recentFiles.length > 0) {
    console.log(`${t.borderChar}│${reset} 🕒 Recent edits: ${recentFiles.map(f => `${t.files}${f}${reset}`).join(', ')}`);
  } else {
    console.log(`${t.borderChar}│${reset} 🕒 Recent edits: None`);
  }
  console.log(`${t.borderChar}├${border}┤${reset}`);
  console.log(`${t.borderChar}│${reset} ⌨ Tab = Autocomplete | Ctrl+K = Copy Response | Ctrl+G = Paste Prompt`);
  console.log(`${t.borderChar}└${border}┘${reset}`);
}

export function completer(line: string) {
  const completions = [
    '/model',
    '/review',
    '/suggest',
    '/compress',
    '/clear',
    '/sessions',
    '/save',
    '/skills',
    '/theme',
    '/status',
    '/copy',
    '/paste',
    '/exit',
    '/cancel',
  ];
  const hits = completions.filter((c) => c.startsWith(line));
  return [hits.length ? hits : completions, line];
}
