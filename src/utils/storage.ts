import path from 'path';
import fs from 'fs-extra';
import os from 'os';

const SESSION_DIR = path.join(os.homedir(), '.cosqcode', 'sessions');

export interface SessionMeta {
  id: string;
  createdAt: string;
  lastAccessed: string;
  model: string;
  messageCount: number;
}

export async function saveSession(id: string, data: any): Promise<void> {
  await fs.ensureDir(SESSION_DIR);
  const filePath = path.join(SESSION_DIR, `${id}.json`);
  await fs.writeJson(filePath, data, { spaces: 2 });
}

export async function loadSession(id: string): Promise<any> {
  const filePath = path.join(SESSION_DIR, `${id}.json`);
  return fs.readJson(filePath);
}

export async function listSessions(): Promise<void> {
  await fs.ensureDir(SESSION_DIR);
  const files = await fs.readdir(SESSION_DIR);
  const sessions: SessionMeta[] = [];
  for (const file of files) {
    if (file.endsWith('.json')) {
      const id = file.replace('.json', '');
      const data = await fs.readJson(path.join(SESSION_DIR, file));
      sessions.push({
        id,
        createdAt: data.createdAt ?? 'unknown',
        lastAccessed: data.lastAccessed ?? 'unknown',
        model: data.model ?? 'unknown',
        messageCount: (data.messages ?? []).length,
      });
    }
  }
  console.table(sessions);
}

export async function deleteSession(id: string): Promise<void> {
  const filePath = path.join(SESSION_DIR, `${id}.json`);
  await fs.remove(filePath);
  console.log(`Session ${id} deleted.`);
}