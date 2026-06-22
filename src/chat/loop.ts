import * as readline from 'readline';
import { exec } from 'child_process';
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
// import { runWithSpinner as _runWithSpinner } from '../utils/spinner.js';
import { handleSlashCommand } from '../commands/slash.js';
import { getRecentFiles } from '../utils/files.js';
import { getTheme, THEMES, ICONS } from '../utils/themes.js';
import { copyToClipboard, pasteFromClipboard } from '../utils/clipboard.js';
import { FileBrowser } from '../utils/browser.js';
import { getSubagentManager } from '../agents/subagent.js';
import { getAuthManager } from '../auth/manager.js';
import { buildIndex, loadIndex, searchIndex } from '../search/indexer.js';
import path from 'path';
import fs from 'fs-extra';
import type { AgentMode } from '../config.js';
import { MissingApiKeyError } from './engine.js';

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
    // Restore mode and plan from saved session
    if (data.mode && (data.mode === 'build' || data.mode === 'plan')) {
      session.mode = data.mode;
    }
    if (data.activePlan) session.activePlan = data.activePlan;
    await session.loadCompressionConfig();
    logger.info(`Resumed session ${resumeId} with model ${modelName}`);
  } else {
    session = new Session(uuidv4(), modelName);
    await session.loadCompressionConfig();
    await saveSession(session.id, session.toJSON());
    logger.info(`New session ${session.id} with ${modelName}`);
  }

  await ensureSessionProvider(session, engine);

  setCwd(process.cwd());

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: '> ',
    completer,
  });

  const fileBrowser = new FileBrowser(rl);

  logger.info(`Working directory: ${process.cwd()}`);
  logger.info('Type /help for commands, /exit to quit.');
  await promptNext(session, rl, config);

  let linesAccumulator: string[] = [];

  rl.on('line', async (input) => {
    let trimmed = input.trim();
    // Check for slash commands first (e.g., /set-key, /clear-key, /download-qwen)
    const handled = await handleSlashCommand(trimmed);
    if (handled) {
      await promptNext(session, rl, config);
      return;
    }
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
      rl.setPrompt(getPromptString(session));
      await promptNext(session, rl, config);
      return;
    }

    // Combine accumulated lines if any
    if (linesAccumulator.length > 0) {
      linesAccumulator.push(input);
      trimmed = linesAccumulator.join('\n').trim();
      linesAccumulator = []; // reset
      rl.setPrompt(getPromptString(session)); // restore prompt
    }

    if (trimmed.startsWith('!')) {
      const shellCmd = trimmed.slice(1).trim();
      if (!shellCmd) {
        logger.info('Usage: !<command>');
      } else {
        await executeShellCommand(shellCmd);
      }
      await promptNext(session, rl, config);
      return;
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
  /search [--rebuild] <query>  Semantic search across codebase
  /compress [--keep N]         Force context compression (N = messages to keep)
  /clear                      Clear conversation (keep system)
  /sessions                   List saved sessions
  /save                       Save current session
  /skills                     Manage skills (list, search, install, list-local)
  /theme [name]               List or switch CLI visual themes
  /permissions [cmd]           View/set tool permissions (list, set, mode, clear)
  /allow-all                  Allow all tools for this session
  /deny-all                   Disable permission bypass
  /mode [plan|build]           Switch agent mode or show current mode
  /plan [show|clear|export]    Manage active plan
  /task <subagent> <prompt>    Delegate task to a subagent (explore, general)
  /connect <provider>         Set up authentication for a provider
  /auth [status|logout]       Manage authentication
  /status                     Show session dashboard (tokens, duration, changed files)
  /copy                       Copy last response to clipboard
  /paste                      Paste clipboard content as prompt
  @<subagent> <prompt>         Delegate via @mention (e.g., @explore find auth)
  !<command>                   Execute a shell command (e.g. !ls -la)
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
        session.clearProvider();
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
            if (await ensureSessionProvider(session, engine)) {
              await processTurn(session, engine);
            }
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
        if (await ensureSessionProvider(session, engine)) {
          await processTurn(session, engine);
        }
        await saveSession(session.id, session.toJSON());
      }
      await promptNext(session, rl, config);
      return;
    }

    if (trimmed.startsWith('/compress')) {
      const parts = trimmed.split(/\s+/);
      const keepIdx = parts.indexOf('--keep');
      const keepCount = keepIdx >= 0 ? parseInt(parts[keepIdx + 1]) : undefined;
      if (keepIdx >= 0 && (keepCount === undefined || isNaN(keepCount) || keepCount < 1)) {
        logger.info('Usage: /compress [--keep N]  (N = messages to keep, default 4)');
      } else {
        await session.compressNow(keepCount);
        await saveSession(session.id, session.toJSON());
      }
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

    // ── Permission commands ──────────────────────────────────────────
    if (trimmed === '/allow-all') {
      engine.getPermissionManager().enableBypass();
      logger.info('✔ All tools allowed for this session (bypass active).');
      await promptNext(session, rl, config);
      return;
    }
    if (trimmed === '/deny-all') {
      engine.getPermissionManager().disableBypass();
      engine.getPermissionManager().resetSession();
      logger.info('✔ Permission bypass disabled. Using configured rules.');
      await promptNext(session, rl, config);
      return;
    }
    if (trimmed.startsWith('/permissions')) {
      const parts = trimmed.split(/\s+/);
      const sub = parts[1];

      if (!sub || sub === 'list') {
        const pm = engine.getPermissionManager();
        const bypass = pm.isBypassActive();
        const overrides = pm.getSessionOverrides();
        const summary = pm.summarize();

        logger.info('\n┌───────────────────── Permissions ─────────────────────┐');
        if (bypass) {
          logger.info('│ ⚠️  Bypass mode: ALL tools allowed for this session   │');
        }
        if (overrides.size > 0) {
          logger.info('│ Session overrides:                                   │');
          for (const [tool, level] of overrides) {
            const icon = level === 'allow' ? '✔' : level === 'deny' ? '✘' : '?';
            logger.info(`│   ${icon} ${tool}: ${level}`);
          }
        }
        // Group by effective permission
        const groups: Record<string, string[]> = { allow: [], ask: [], deny: [] };
        for (const { tool, permission } of summary) {
          groups[permission].push(tool);
        }
        for (const [level, tools] of Object.entries(groups)) {
          if (tools.length > 0) {
            const icon = level === 'allow' ? '✔' : level === 'deny' ? '✘' : '?';
            logger.info(`│ ${icon} ${level.toUpperCase()} (${tools.length}): ${tools.slice(0, 5).join(', ')}${tools.length > 5 ? '...' : ''}`);
          }
        }
        logger.info('└──────────────────────────────────────────────────────┘');
        logger.info('Usage: /permissions set <tool> <allow|ask|deny>');
        logger.info('       /permissions mode <plan|build|explore>');
        logger.info('       /permissions clear [tool]');
        logger.info('       /allow-all / /deny-all');
      } else if (sub === 'set' && parts[2] && parts[3]) {
        const tool = parts[2];
        const level = parts[3] as 'allow' | 'ask' | 'deny';
        if (!['allow', 'ask', 'deny'].includes(level)) {
          logger.info('Permission level must be: allow, ask, or deny');
        } else {
          engine.getPermissionManager().setSessionOverride(tool, level);
          logger.info(`✔ Session override: "${tool}" → ${level}`);
        }
      } else if (sub === 'mode' && parts[2]) {
        const mode = parts[2];
        const modes = engine.getConfig().permissionModes;
        if (engine.getPermissionManager().loadMode(mode, modes)) {
          logger.info(`✔ Permission mode "${mode}" loaded.`);
        } else {
          logger.info(`Unknown mode "${mode}". Available: ${Object.keys(modes ?? {}).join(', ')}`);
        }
      } else if (sub === 'clear' && parts[2]) {
        engine.getPermissionManager().clearSessionOverride(parts[2]);
        logger.info(`✔ Session override cleared for "${parts[2]}"`);
      } else if (sub === 'clear' && !parts[2]) {
        engine.getPermissionManager().resetSession();
        logger.info('✔ All session overrides cleared.');
      } else {
        logger.info('Usage: /permissions [list|set|mode|clear] [args]');
      }
      await promptNext(session, rl, config);
      return;
    }

    // ── Mode commands ───────────────────────────────────────────────
    if (trimmed === '/mode' || trimmed.startsWith('/mode ')) {
      const parts = trimmed.split(/\s+/);
      const targetMode = parts[1] as AgentMode | undefined;

      if (!targetMode) {
        // Show current mode
        const currentMode = session.mode;
        const planInfo = session.activePlan
          ? ` | Plan: ${session.getPlanProgress()}`
          : '';
        logger.info(`\n┌─────────────────────── Agent Mode ───────────────────────┐`);
        logger.info(`│ Current mode: \x1b[36m${currentMode.toUpperCase()}\x1b[0m${planInfo}`);
        logger.info(`│`);
        logger.info(`│ Available modes:`);
        logger.info(`│   \x1b[32mbuild\x1b[0m  — Full access (edit, shell, all tools)`);
        logger.info(`│   \x1b[33mplan\x1b[0m   — Read-only (analyze, search, create plans)`);
        logger.info(`│`);
        logger.info(`│ Usage: /mode <build|plan>`);
        logger.info(`└──────────────────────────────────────────────────────────┘`);
      } else if (targetMode === 'build' || targetMode === 'plan') {
        session.setMode(targetMode);
        // Load the corresponding permission mode
        const modes = engine.getConfig().permissionModes;
        if (targetMode === 'plan') {
          engine.getPermissionManager().loadMode('plan', modes);
        } else {
          engine.getPermissionManager().resetSession();
        }
        const modeLabel = targetMode === 'plan' ? '\x1b[33mPLAN\x1b[0m' : '\x1b[32mBUILD\x1b[0m';
        logger.info(`✔ Switched to ${modeLabel} mode`);
        if (targetMode === 'plan') {
          logger.info('  Read-only: file edits and shell commands are denied.');
          logger.info('  Use todowrite to track plan progress.');
        }
      } else {
        logger.info(`Unknown mode "${targetMode}". Available: build, plan`);
      }
      await promptNext(session, rl, config);
      return;
    }

    // ── Plan commands ───────────────────────────────────────────────
    if (trimmed === '/plan' || trimmed.startsWith('/plan ')) {
      const parts = trimmed.split(/\s+/);
      const sub = parts[1];

      if (!sub || sub === 'show') {
        if (!session.activePlan) {
          logger.info('No active plan. Use todowrite to create tasks, or ask the AI to create a plan.');
        } else {
          const plan = session.activePlan;
          const completed = plan.steps.filter((s) => s.status === 'completed').length;
          const total = plan.steps.length;
          const pct = session.getPlanPercentage();

          logger.info('\n┌──────────────────────── Active Plan ────────────────────────┐');
          logger.info(`│ Created: ${plan.createdAt}`);
          if (plan.completedAt) {
            logger.info(`│ Completed: ${plan.completedAt}`);
          }
          logger.info(`│ Progress: ${completed}/${total} steps (${pct}%)`);
          logger.info('│');

          for (const step of plan.steps) {
            const icon = step.status === 'completed' ? '\x1b[32m[x]\x1b[0m'
              : step.status === 'in_progress' ? '\x1b[33m[~]\x1b[0m'
              : step.status === 'cancelled' ? '\x1b[90m[-]\x1b[0m'
              : '[ ]';
            logger.info(`│ ${icon} ${step.description}`);
          }
          logger.info('└─────────────────────────────────────────────────────────────┘');
        }
      } else if (sub === 'clear') {
        session.clearPlan();
        logger.info('✔ Plan cleared.');
      } else if (sub === 'export') {
        const md = session.exportPlanAsMarkdown();
        logger.info('\n' + md);
      } else {
        logger.info('Usage: /plan [show|clear|export]');
      }
      await promptNext(session, rl, config);
      return;
    }

    // ── Auth commands ────────────────────────────────────────────────
    if (trimmed.startsWith('/connect')) {
      const parts = trimmed.split(/\s+/);
      const providerName = parts.slice(1).join(' ').trim();

      if (!providerName) {
        const authManager = getAuthManager();
        const providers = authManager.listProviders();
        logger.info('\n┌─────────────────── Available Providers ───────────────────┐');
        for (const p of providers) {
          logger.info(`│ ${p.name} (${p.type})`);
          logger.info(`│   ${p.description}`);
        }
        logger.info('└──────────────────────────────────────────────────────────┘');
        logger.info('Usage: /connect <provider name>');
      } else {
        const authManager = getAuthManager();
        logger.info(`Connecting to ${providerName}...`);
        const success = await authManager.connectProvider(providerName);
        if (!success) {
          logger.info('Connection failed or was cancelled.');
        }
      }
      await promptNext(session, rl, config);
      return;
    }

    if (trimmed.startsWith('/auth')) {
      const parts = trimmed.split(/\s+/);
      const sub = parts[1];

      const authManager = getAuthManager();

      if (!sub || sub === 'status') {
        await authManager.showStatus();
      } else if (sub === 'logout') {
        const providerName = parts[2];
        if (!providerName) {
          logger.info('Usage: /auth logout <provider>');
        } else {
          await authManager.disconnectProvider(providerName);
        }
      } else {
        logger.info('Usage: /auth [status|logout <provider>]');
      }
      await promptNext(session, rl, config);
      return;
    }

    // ── Search command ──────────────────────────────────────────────
    if (trimmed.startsWith('/search')) {
      const parts = trimmed.split(/\s+/);
      const rebuild = parts.includes('--rebuild');
      const query = parts.filter((p) => p !== '--rebuild').slice(1).join(' ').trim();

      if (!query) {
        logger.info('Usage: /search [--rebuild] <query>');
        logger.info('Options:');
        logger.info('  --rebuild  Force rebuild the search index');
      } else {
        try {
          if (rebuild) {
            await buildIndex();
          } else {
            const loaded = await loadIndex();
            if (!loaded) {
              logger.info('No search index found. Building...');
              await buildIndex();
            }
          }

          const results = searchIndex(query, 10);
          if (results.length === 0) {
            logger.info(`No results found for: "${query}"`);
          } else {
            logger.info(`\nSearch Results for "${query}":`);
            for (let i = 0; i < results.length; i++) {
              const result = results[i];
              const { filePath, lineStart, lineEnd } = result.document.metadata;
              const score = (result.score * 100).toFixed(1);
              const location = lineStart ? `${filePath}:${lineStart}-${lineEnd}` : filePath;
              logger.info(`\n${i + 1}. \x1b[36m${location}\x1b[0m (${score}% match)`);
              // Show first few lines
              const preview = result.document.content.split('\n').slice(0, 3).join('\n');
              logger.info(`\x1b[90m${preview}\x1b[0m`);
            }
          }
        } catch (error: any) {
          logger.error(`Search failed: ${error.message}`);
        }
      }
      await promptNext(session, rl, config);
      return;
    }

    if (trimmed === '/status') {
      logger.info('\n┌─────────────────────────── Session Status ───────────────────────────┐');
      logger.info(`│ 🤖 Model: \x1b[36m${session.modelName}\x1b[0m (${session.provider?.providerName || 'N/A'})`);
      logger.info(`│ 📁 Directory: \x1b[33m${process.cwd()}\x1b[0m`);

      // Mode
      const modeIcon = session.mode === 'plan' ? '\x1b[33mPLAN\x1b[0m' : '\x1b[32mBUILD\x1b[0m';
      logger.info(`│ 🔧 Mode: ${modeIcon}`);

      // Plan progress
      if (session.activePlan) {
        const planProgress = session.getPlanProgress();
        const pct = session.getPlanPercentage();
        const barWidth = 20;
        const filled = Math.round((pct / 100) * barWidth);
        const bar = '█'.repeat(filled) + '░'.repeat(barWidth - filled);
        logger.info(`│ 📋 Plan: ${planProgress} ${bar} ${pct}%`);
      }
      
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

      // Permissions
      const pm = engine.getPermissionManager();
      if (pm.isBypassActive()) {
        logger.info('│ 🔓 Permissions: \x1b[33mBYPASS (all tools allowed)\x1b[0m');
      } else {
        const summary = pm.summarize();
        const askCount = summary.filter((p) => p.permission === 'ask').length;
        const denyCount = summary.filter((p) => p.permission === 'deny').length;
        const allowCount = summary.filter((p) => p.permission === 'allow').length;
        const parts = [];
        if (askCount > 0) parts.push(`\x1b[33m${askCount} ask\x1b[0m`);
        if (denyCount > 0) parts.push(`\x1b[31m${denyCount} deny\x1b[0m`);
        parts.push(`\x1b[32m${allowCount} allow\x1b[0m`);
        logger.info(`│ 🔐 Permissions: ${parts.join(', ')}`);
      }

      // Compression stats
      const compHistory = session.compressionHistory;
      if (compHistory.length > 0) {
        const last = compHistory[compHistory.length - 1];
        const savedTokens = last.tokensBefore - last.tokensAfter;
        const savedMsgs = last.messagesBefore - last.messagesAfter;
        logger.info(`│ 🗜️  Compressions: ${compHistory.length} (last saved ${savedTokens} tokens, ${savedMsgs} msgs)`);
      } else {
        logger.info('│ 🗜️  Compressions: none yet');
      }

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
        if (await ensureSessionProvider(session, engine)) {
          await processTurn(session, engine);
        }
        await saveSession(session.id, session.toJSON());
        await promptNext(session, rl, config);
      }
      return;
    }

    // ── Task command (subagent delegation) ───────────────────────────
    if (trimmed.startsWith('/task')) {
      const parts = trimmed.split(/\s+/);
      const subagentName = parts[1];
      const prompt = parts.slice(2).join(' ').trim();

      if (!subagentName || !prompt) {
        const manager = getSubagentManager();
        const available = manager.listSubagents();
        logger.info(`Usage: /task <subagent> <prompt>`);
        logger.info(`Available subagents: ${available.join(', ')}`);
        logger.info(`Example: /task explore "Find all authentication patterns in the codebase"`);
      } else {
        logger.info(`Delegating to subagent "${subagentName}"...`);
        const result = await engine.executeTool('task', { subagent: subagentName, prompt });
        logger.info(`\n${result}\n`);
      }
      await promptNext(session, rl, config);
      return;
    }

    // Check for @mention delegation
    const mentionManager = getSubagentManager();
    const mention = mentionManager.parseMention(trimmed);
    if (mention) {
      logger.info(`Delegating to subagent "${mention.subagent}"...`);
      const result = await engine.executeTool('task', { subagent: mention.subagent, prompt: mention.prompt });
      logger.info(`\n${result}\n`);
      await promptNext(session, rl, config);
      return;
    }

    // Normal user input
    await activateSkills(trimmed, session);
    session.addMessage({ role: 'user', content: trimmed });
    if (await ensureSessionProvider(session, engine)) {
      await processTurn(session, engine);
    }
    await saveSession(session.id, session.toJSON());
    await promptNext(session, rl, config);
  });

  const keypressHandler = async (str: string, key: any) => {
    const handled = await fileBrowser.handleKeyPress(str, key);
    if (handled) return;

    if (key && key.ctrl) {
      if (key.name === 'f') {
        await fileBrowser.start(keypressHandler);
        return;
      }
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
          if (await ensureSessionProvider(session, engine)) {
            await processTurn(session, engine);
          }
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

export async function executeShellCommand(shellCmd: string): Promise<void> {
  const isDestructive = /\b(rm\s+-rf|rm\s+-f\s+\*|dd\s+if|mkfs|chmod\s+-R\s+777|chown\s+-R)\b/.test(shellCmd);
  if (isDestructive) {
    logger.error("WARNING: Dangerous or destructive command pattern detected. Operation blocked for safety.");
    return;
  }

  const cdMatch = shellCmd.match(/^cd\s*(.*)$/);
  if (cdMatch) {
    let targetDir = cdMatch[1].trim();
    if (!targetDir || targetDir === '~') {
      targetDir = process.env.HOME || '.';
    } else if (targetDir.startsWith('~/')) {
      targetDir = path.join(process.env.HOME || '.', targetDir.slice(2));
    }
    try {
      process.chdir(path.resolve(process.cwd(), targetDir));
      setCwd(process.cwd());
    } catch (err: any) {
      logger.error(`cd: ${err.message}`);
    }
    return;
  }

  return new Promise<void>((resolve) => {
    exec(shellCmd, { cwd: process.cwd() }, (error, stdout, stderr) => {
      if (stdout) {
        process.stdout.write(stdout);
      }
      if (stderr) {
        process.stderr.write(stderr);
      }
      if (error && !stderr) {
        logger.error(error.message);
      }
      resolve();
    });
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
  rl.setPrompt(getPromptString(session));
  rl.prompt();
}

async function ensureSessionProvider(session: Session, engine: ChatEngine): Promise<boolean> {
  if (session.provider && session.provider.modelName === session.modelName) {
    return true;
  }

  try {
    const provider = await engine.createProvider(session.modelName);
    session.setProvider(provider);
    return true;
  } catch (error: unknown) {
    if (error instanceof MissingApiKeyError) {
      logger.info(`No API key configured for ${error.provider}. Use /auth or /model, then try again.`);
      return false;
    }

    const message = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to initialize model ${session.modelName}: ${message}`);
    return false;
  }
}

function getPromptString(session: Session): string {
  const model = session.modelName;
  const providerName = session.provider?.providerName || 'N/A';
  const modeTag = session.mode === 'plan' ? ' \x1b[33m[PLAN]\x1b[0m' : '';
  return `\x1b[36m[${model} (${providerName})]${modeTag}\x1b[0m > `;
}

async function renderStatusHeader(session: Session, cwd: string, themeName?: string): Promise<void> {
  const t = getTheme(themeName);
  const reset = '\x1b[0m';
  const model = session.modelName;
  const providerName = session.provider?.providerName || 'N/A';
  const modeTag = session.mode === 'plan' ? ' \x1b[33m[PLAN]\x1b[0m' : '';
  
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
  console.log(`${t.borderChar}│${reset} ${ICONS.robot} Model: ${t.model}${model}${reset} (${providerName})${modeTag}`);
  console.log(`${t.borderChar}│${reset} ${ICONS.dir} Directory: ${t.dir}${cwd}${reset}`);
  console.log(`${t.borderChar}│${reset} ${ICONS.chart} Context usage: ${t.context}${consumedTokens}${reset} / ${maxTokens} tokens (${pctUsed}%)`);
  if (recentFiles.length > 0) {
    console.log(`${t.borderChar}│${reset} ${ICONS.clock} Recent edits: ${recentFiles.map(f => `${t.files}${f}${reset}`).join(', ')}`);
  } else {
    console.log(`${t.borderChar}│${reset} ${ICONS.clock} Recent edits: None`);
  }
  console.log(`${t.borderChar}├${border}┤${reset}`);
  console.log(`${t.borderChar}│${reset} ${ICONS.keyboard} Tab = Autocomplete | Ctrl+F = File Browser | Ctrl+K = Copy | Ctrl+G = Paste`);
  console.log(`${t.borderChar}└${border}┘${reset}`);
}

export function completer(line: string) {
  // Handle "@" prefix for file and directory path suggestions
  const atPos = line.lastIndexOf('@');
  if (atPos !== -1) {
    const prefix = line.slice(atPos + 1);
    try {
      const entries = fs.readdirSync(process.cwd());
      const matches = entries
        .filter((e) => e.startsWith(prefix))
        .map((e) => line.slice(0, atPos + 1) + e);
      return [matches.length ? matches : [], line];
    } catch {
      // fall back to slash completions on error
    }
  }

  // Default slash command completions
  const completions = [
    '/model',
    '/review',
    '/suggest',
    '/search',
    '/compress',
    '/clear',
    '/sessions',
    '/save',
    '/skills',
    '/theme',
    '/status',
    '/copy',
    '/paste',
    '/permissions',
    '/allow-all',
    '/deny-all',
    '/mode',
    '/plan',
    '/task',
    '/connect',
    '/auth',
    '/exit',
    '/cancel',
  ];
  const hits = completions.filter((c) => c.startsWith(line));
  return [hits.length ? hits : completions, line];
}
