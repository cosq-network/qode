import fs from 'fs-extra';
import path from 'path';
import { getWritableQodeSubdir } from './app-paths.js';

export interface DownloadProgress {
  modelName: string;
  filename: string;
  status: 'idle' | 'downloading' | 'completed' | 'failed';
  percent: number;
  downloadedBytes: number;
  totalBytes: number;
  error?: string;
  startedAt?: string;
  completedAt?: string;
}

interface PersistedProgress {
  models: Record<string, DownloadProgress>;
}

const inMemory: Record<string, DownloadProgress> = {};

function getProgressFile(): string {
  return path.join(getWritableQodeSubdir('models'), 'download-progress.json');
}

async function loadPersisted(): Promise<PersistedProgress> {
  try {
    const file = getProgressFile();
    if (await fs.pathExists(file)) {
      return await fs.readJson(file);
    }
  } catch { }
  return { models: {} };
}

async function persist(): Promise<void> {
  const file = getProgressFile();
  await fs.ensureDir(path.dirname(file));
  await fs.writeJson(file, { models: inMemory }, { spaces: 2 });
}

export function getDownloadProgress(filename: string): DownloadProgress {
  return inMemory[filename] ?? { modelName: filename, filename, status: 'idle', percent: 0, downloadedBytes: 0, totalBytes: 0 };
}

export function listDownloadProgress(): DownloadProgress[] {
  return Object.values(inMemory);
}

export function setDownloadProgress(filename: string, progress: Partial<DownloadProgress>): void {
  inMemory[filename] = { ...getDownloadProgress(filename), ...progress };
  persist().catch(() => {});
}

export function resetDownloadProgress(filename: string): void {
  delete inMemory[filename];
  persist().catch(() => {});
}

export async function loadDownloadProgress(): Promise<void> {
  const persisted = await loadPersisted();
  for (const [filename, progress] of Object.entries(persisted.models)) {
    if (progress.status === 'downloading') {
      progress.status = 'idle';
      progress.percent = 0;
    }
    inMemory[filename] = progress;
  }
}
