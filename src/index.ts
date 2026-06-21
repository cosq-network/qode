#!/usr/bin/env node
import { Command } from 'commander';
import { startChatLoop } from './chat/loop.js';
import { listModels, updateModels } from './providers/models.js';
import { configureAuth } from './config.js';
import { listSessions, deleteSession } from './utils/storage.js';

const program = new Command();

program
  .name('cosqcode')
  .description('Multi-model coding agent with tools, compression and session resume')
  .version('1.0.0');

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
      console.error(`Error: ${message}`);
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
  .description('Set API keys for providers')
  .action(() => configureAuth());

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