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
  await promptNext(session, rl, config);

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
  /skills                     Manage skills (list, search, install, list-local)
  /theme [name]               List or switch CLI visual themes
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

    // Normal user input
    await activateSkills(trimmed, session);
    session.addMessage({ role: 'user', content: trimmed });
    await processTurn(session, engine);
    await saveSession(session.id, session.toJSON());
    await promptNext(session, rl, config);
  });

  rl.on('close', async () => {
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
  console.log(`${t.borderChar}└${border}┘${reset}`);
}
