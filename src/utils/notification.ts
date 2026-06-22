// src/utils/notification.ts

import { logger } from './logger.js';
import fs from 'fs-extra';
import path from 'path';
import { getWritableQodeSubdir } from './app-paths.js';

/**
 * Send a desktop notification if possible. Falls back to logger.info.
 */
export async function notify(message: string): Promise<void> {
  // Try to import node-notifier dynamically; it may not be installed in test env.
  try {
    const { default: notifier } = await import('node-notifier');
    notifier.notify({ title: 'Qode', message });
    logger.info(`🔔 Notification sent: ${message}`);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
} catch (_) {
    // Module not available – fallback to console info.
    logger.info(`🔔 (fallback) ${message}`);
  }
}

/**
 * Persist download status of the Qwen model.
 */
export async function writeDownloadStatus(): Promise<void> {
  const cacheDir = getWritableQodeSubdir('models');
  const statusPath = path.join(cacheDir, 'download_status.json');
  const status = { downloaded: true, timestamp: new Date().toISOString() };
  await fs.ensureDir(cacheDir);
  await fs.writeJson(statusPath, status, { spaces: 2 });
}

export async function readDownloadStatus(): Promise<boolean> {
  const statusPath = path.join(getWritableQodeSubdir('models'), 'download_status.json');
  if (await fs.pathExists(statusPath)) {
    try {
      const data = await fs.readJson(statusPath);
      return data.downloaded === true;
    } catch {}
  }
  return false;
}
