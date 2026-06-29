// src/utils/storage.ts
import path from 'path';
import { logger } from './logger.js';
import fs from 'fs-extra';
import { getQodeSubdir, getWritableQodeSubdir } from './app-paths.js';

/**
 * Exact shape of the JSON persisted for a session.
 */
export interface SessionData {
  id: string;
  modelName: string;
  messages: any[]; // The message objects are defined in LLMMessage, but to avoid circular imports we keep them loosely typed here.
  createdAt: string;
  lastAccessed: string;
  mode?: string;
  activePlan?: any;
}

/** Save a session to disk. */
export async function saveSession(id: string, data: SessionData): Promise<void> {
  const sessionDir = getWritableQodeSubdir('sessions');
  await fs.ensureDir(sessionDir);
  const filePath = path.join(sessionDir, `${id}.json`);
  await fs.writeJson(filePath, data, { spaces: 2 });
}

/** Load a session from disk. */
export async function loadSession(id: string): Promise<SessionData> {
  const filePath = path.join(getQodeSubdir('sessions'), `${id}.json`);
  return fs.readJson(filePath) as Promise<SessionData>;
}

export async function listSessions(): Promise<void> {
  const sessionDir = getQodeSubdir('sessions');
  await fs.ensureDir(sessionDir);
  const files = await fs.readdir(sessionDir);
  const sessions: SessionMeta[] = [];
  for (const file of files) {
    if (file.endsWith('.json')) {
      const id = file.replace('.json', '');
      const data = await fs.readJson(path.join(sessionDir, file)) as SessionData;
      sessions.push({
        id,
        createdAt: data.createdAt ?? 'unknown',
        lastAccessed: data.lastAccessed ?? 'unknown',
        model: data.modelName ?? 'unknown',
        messageCount: (data.messages ?? []).length,
      });
    }
  }
  // Use logger for consistent output, especially in TUI mode.
  // Pretty‑print the session list as JSON for readability.
  logger.info('🗂️ Saved Sessions:');
  logger.info(JSON.stringify(sessions, null, 2));
}

export interface SessionMeta {
  id: string;
  createdAt: string;
  lastAccessed: string;
  model: string;
  messageCount: number;
}

export async function deleteSession(id: string): Promise<void> {
  const filePath = path.join(getQodeSubdir('sessions'), `${id}.json`);
  await fs.remove(filePath);
  console.log(`Session ${id} deleted.`);
}
