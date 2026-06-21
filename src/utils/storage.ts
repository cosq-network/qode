// src/utils/storage.ts
import path from 'path';
import fs from 'fs-extra';
import os from 'os';

const SESSION_DIR = path.join(os.homedir(), '.cosqcode', 'sessions');

/**
 * Exact shape of the JSON persisted for a session.
 */
export interface SessionData {
  id: string;
  modelName: string;
  messages: any[]; // The message objects are defined in LLMMessage, but to avoid circular imports we keep them loosely typed here.
  createdAt: string;
  lastAccessed: string;
}

/** Save a session to disk. */
export async function saveSession(id: string, data: SessionData): Promise<void> {
  await fs.ensureDir(SESSION_DIR);
  const filePath = path.join(SESSION_DIR, `${id}.json`);
  await fs.writeJson(filePath, data, { spaces: 2 });
}

/** Load a session from disk. */
export async function loadSession(id: string): Promise<SessionData> {
  const filePath = path.join(SESSION_DIR, `${id}.json`);
  return fs.readJson(filePath) as Promise<SessionData>;
}

export async function listSessions(): Promise<void> {
  await fs.ensureDir(SESSION_DIR);
  const files = await fs.readdir(SESSION_DIR);
  const sessions: SessionMeta[] = [];
  for (const file of files) {
    if (file.endsWith('.json')) {
      const id = file.replace('.json', '');
      const data = await fs.readJson(path.join(SESSION_DIR, file)) as SessionData;
      sessions.push({
        id,
        createdAt: data.createdAt ?? 'unknown',
        lastAccessed: data.lastAccessed ?? 'unknown',
        model: data.modelName ?? 'unknown',
        messageCount: (data.messages ?? []).length,
      });
    }
  }
  console.table(sessions);
}

export interface SessionMeta {
  id: string;
  createdAt: string;
  lastAccessed: string;
  model: string;
  messageCount: number;
}

export async function deleteSession(id: string): Promise<void> {
  const filePath = path.join(SESSION_DIR, `${id}.json`);
  await fs.remove(filePath);
  console.log(`Session ${id} deleted.`);
}