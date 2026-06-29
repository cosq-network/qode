#!/usr/bin/env node
import { Command } from 'commander';
import { createRequire } from 'module';
import dotenv from 'dotenv';
import fse from 'fs-extra';
import { homedir } from 'os';
import { dirname, resolve } from 'path';
import { confirm, isCancel } from '@clack/prompts';
import { logger } from './utils/logger.js';
import { startChatLoop } from './chat/loop.js';

const require = createRequire(import.meta.url);
const pkg = require('../package.json');

const SENTINEL = 'QODE_DOTENV_LOADED';

async function loadQodeEnvFile() {
  try {
    const start = process.cwd();
    let current = resolve(start);
    for (let depth = 0; depth < 32; depth++) {
      const candidate = resolve(current, '.env.qode');
      if (fse.pathExistsSync(candidate)) {
        dotenv.config({ path: candidate, debug: false });
        return;
      }
      const parent = dirname(current);
      if (parent === current) {
        break;
      }
      current = parent;
    }

    const homeFile = resolve(homedir(), '.qode.env');
    if (fse.pathExistsSync(homeFile)) {
      dotenv.config({ path: homeFile, debug: false });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`Warning: skipped loading Qode env file: ${message}`);
  }
}

if (!process.env[SENTINEL]) {
  loadQodeEnvFile();
}

import { listModels, updateModels } from './providers/models.js';
import { listSessions, deleteSession } from './utils/storage.js';

export const program = new Command();

// Global options
program
  .option('--json', 'Output machine‑readable JSON (for AI agents)')
  .option('--log-level <level>', 'Set log level (error, info, debug)', 'info')
  .hook('preAction', (thisCommand) => {
    const opts = thisCommand.opts();
    (globalThis as any).JSON_OUTPUT = Boolean(opts.json);
    (globalThis as any).LOG_LEVEL = opts.logLevel || 'info';
  });

program
  .name('qode')
  .description('Multi-model coding agent with tools, compression and session resume')
  .version(pkg.version);

// main chat command
program
  .command('chat', { isDefault: true })
  .description('Start an interactive coding session')
  .option('-r, --resume <id>', 'Resume a specific session ID')
  .option('-m, --model <model>', 'Initial model to use for this session')
  .action(async (opts) => {
    try {
      await startChatLoop(opts.resume, opts.model);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`Error: ${message}`);
      process.exitCode = 1;
    }
  });

// model listing
program
  .command('models')
  .description('List available models')
  .action(() => listModels());

// update model list from provider APIs
program
  .command('update-models')
  .description('Fetch the latest model lists from providers')
  .action(() => updateModels());

// authentication
program
  .command('auth')
  .description('Set or clear API keys for providers')
  .option('--reset', 'Remove all stored API keys')
  .action(async (opts) => {
    if (opts.reset) {
      const ok = await confirm({ message: 'Delete all stored API keys?' });
      if (!isCancel(ok) && ok) {
        await import('./config.js').then((m) =>
          m.saveConfig({
            providers: {},
            autoCompress: true,
            compressThreshold: 0.8,
            mcpServers: [],
          }),
        );
        console.log('All credentials cleared.');
        return;
      }
    }
    await import('./config.js').then((m) => m.configureAuth());
  });

// switch default provider and model
program
  .command('setup')
  .description('Launch the interactive setup wizard to select a provider, model, and configure API keys')
  .action(async () => {
    try {
      const { loadConfig, saveConfig } = await import('./config.js');
      const config = await loadConfig();
      config.defaultModel = undefined; // Force setup on start
      await saveConfig(config);
      await startChatLoop();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`Error: ${message}`);
      process.exitCode = 1;
    }
  });

program
  .command('use <provider> <model>')
  .description('Switch default provider and model')
  .action(async (provider, model) => {
    try {
      const { loadConfig, saveConfig } = await import('./config.js');
      const config = await loadConfig();
      config.providers = {
        ...(config.providers ?? {}),
        [provider]: { ...(config.providers?.[provider] ?? {}) },
      };
      config.defaultModel = model;
      await saveConfig(config);
      console.log(`Switched default to ${provider} / ${model}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`Error: ${message}`);
      process.exitCode = 1;
    }
  });

// session management
program
  .command('sessions')
  .description('List saved sessions')
  .action(() => listSessions());

program
  .command('session-delete <id>')
  .description('Delete a saved session')
  .action((id) => deleteSession(id));

program.parse(process.argv);
