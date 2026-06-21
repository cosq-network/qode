// src/commands/slash.ts
import path from 'path';
import os from 'os';
import fs from 'fs-extra';
import { loadConfig, saveConfig } from '../config.js';
import { logger } from '../utils/logger.js';
import { runWithSpinner } from '../utils/spinner.js';
import { exec } from 'child_process';
import { notify, writeDownloadStatus, readDownloadStatus } from '../utils/notification.js';
import { promisify } from 'util';

const _execAsync = promisify(exec);

/** Set an API key for a provider via slash command.
 * Example: `/set-key OpenAI sk-xxxx`
 */
export async function setKey(provider: string, key: string): Promise<void> {
  const cfg = await loadConfig();
  cfg.providers[provider] = { ...(cfg.providers[provider] ?? {}), apiKey: key };
  await saveConfig(cfg);
  logger.info(`✅ API key set for ${provider}`);
}

/** Clear the API key for a provider via slash command. */
export async function clearKey(provider: string): Promise<void> {
  const cfg = await loadConfig();
  if (cfg.providers[provider]) {
    delete cfg.providers[provider]!.apiKey;
    await saveConfig(cfg);
    logger.info(`🗑️ API key cleared for ${provider}`);
  } else {
    logger.info(`⚠️ Provider ${provider} not found in config`);
  }
}

/** Download Qwen2.5-Coder-0.5B-Instruct model to the cache directory.
 * The download runs in the background and shows a spinner while in progress.
 */
export async function downloadQwenModel(): Promise<void> {
  const cacheDir = path.join(os.homedir(), '.qode', 'models');
  await fs.ensureDir(cacheDir);
  const targetPath = path.join(cacheDir, 'Qwen2.5-Coder-0.5B-Instruct.gguf');
  const url = 'https://huggingface.co/Qwen/Qwen2.5-Coder-0.5B-Instruct/resolve/main/qwen2.5-coder-0.5b-instruct.gguf';

  // Always run spinner; inside we decide whether to actually download.
  await runWithSpinner('Downloading Qwen model...', async () => {
    // If the model file already exists, consider it downloaded.
    if (await fs.pathExists(targetPath)) {
      logger.info('✅ Qwen model already present in cache.');
      await writeDownloadStatus();
      return;
    }
    // If the file is already cached, write the status flag and exit.
    if (await fs.pathExists(targetPath)) {
      logger.info('✅ Qwen model already present in cache.');
      await writeDownloadStatus();
      return;
    }
    // Perform the actual download.
    const downloadCmd = `curl -L --progress-bar -o "${targetPath}" "${url}"`;
    await new Promise((resolve, reject) => {
  exec(downloadCmd, (error, stdout, stderr) => {
    if (error) {
      reject(error);
    } else {
      resolve({ stdout, stderr });
    }
  });
});
    await writeDownloadStatus();
    await notify('Qwen model download completed');
    logger.info('✅ Qwen model downloaded to cache and ready to use!');
  });
}

/** Report Qwen model download status via slash command */
export async function modelStatus(): Promise<void> {
  const downloaded = await readDownloadStatus();
  if (downloaded) {
    logger.info('📦 Qwen model is downloaded and ready.');
  } else {
    logger.info('⚙️ Qwen model not yet downloaded. Use /download-qwen to start.');
  }
}


/** Registry of slash command handlers. */
export const slashCommandHandlers: Record<string, (...args: string[]) => Promise<void>> = {
  'set-key': async (provider: string, key: string) => setKey(provider, key),
  'clear-key': async (provider: string) => clearKey(provider),
  // 'download-qwen' command removed; model download now runs automatically on startup.
  'model-status': async () => modelStatus(),
};

/** Parse raw slash command input and dispatch. Returns true if a slash command was handled. */
export async function handleSlashCommand(input: string): Promise<boolean> {
  if (!input.startsWith('/')) return false;
  const parts = input.slice(1).trim().split(/\s+/);
  const cmd = parts[0];
  const handler = slashCommandHandlers[cmd];
  if (!handler) return false;
  try {
    await handler(...parts.slice(1));
  } catch (e) {
    logger.error(`Error executing /${cmd}: ${(e as Error).message}`);
  }
  return true;
}
