#!/usr/bin/env node
import { Command } from 'commander';
import { createRequire } from 'module';
// import ora from 'ora';
import { logger } from './utils/logger.js';
import { startChatLoop } from './chat/loop.js';
import { downloadQwenModel } from './commands/slash.js';

const require = createRequire(import.meta.url);
const pkg = require('../package.json');

// Background model download
void (async () => {
  try {
    await downloadQwenModel();
  } catch (e) {
    logger.error(`Background Qwen model download failed: ${(e as Error).message}`);
  }
})();

// Optionally start llama-server if local model is enabled
void (async () => {
  try {
    const { loadConfig } = await import('./config.js');
    const config = await loadConfig();
    if (config.localModel?.enabled && config.localModel?.autoStart) {
      const { getLlamaServerManager } = await import('./models/llama-server.js');
      const { BUILTIN_MODELS, isModelDownloaded } = await import('./models/downloader.js');
      const filename = config.localModel.modelPath ?? BUILTIN_MODELS[0].filename;
      if (await isModelDownloaded(filename)) {
        const mgr = getLlamaServerManager(filename, {
          port: config.localModel.port,
          contextSize: config.localModel.contextSize,
          threads: config.localModel.threads,
          gpuLayers: config.localModel.gpuLayers,
        });
        await mgr.start();
      }
    }
  } catch (e) {
    logger.error(`Failed to start llama-server: ${(e as Error).message}`);
  }
})();
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
  .option('-m, --model <model>', 'Initial model (default: Gemini 2.5 Flash)')
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
      const confirm = await import('inquirer').then(i => i.prompt([
        { type: 'confirm', name: 'ok', message: 'Delete all stored API keys?', default: false },
      ]));
      if (confirm.ok) {
        await import('./config.js').then(m => m.saveConfig({ providers: {}, autoCompress: true, compressThreshold: 0.8, mcpServers: [] }));
        console.log('All credentials cleared.');
        return;
      }
    }
    await import('./config.js').then(m => m.configureAuth());
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