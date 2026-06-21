// src/utils/registry.ts
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { logger } from './logger.js';

export interface RegistrySkill {
  name: string;
  description: string;
  tags: string[];
  url: string;
}

export interface RegistryData {
  skills: RegistrySkill[];
}

export const DEFAULT_REGISTRY_URL = 'https://raw.githubusercontent.com/qode/skills-registry/main/registry.json';

const CACHE_DIR = path.join(os.homedir(), '.qode');
const CACHE_FILE = path.join(CACHE_DIR, 'registry-cache.json');

export async function fetchRegistry(url = DEFAULT_REGISTRY_URL): Promise<RegistrySkill[]> {
  try {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }
    const data = (await res.json()) as RegistryData;
    const skills = data.skills || [];

    try {
      await fs.ensureDir(CACHE_DIR);
      await fs.writeJson(CACHE_FILE, skills, { spaces: 2 });
    } catch (cacheWriteError: any) {
      // Quietly ignore cache write errors
    }

    return skills;
  } catch (error: any) {
    logger.error(`Failed to fetch skill registry: ${error.message}`);

    try {
      if (await fs.pathExists(CACHE_FILE)) {
        const cached = await fs.readJson(CACHE_FILE);
        logger.info(`ℹ Offline mode: using cached skill registry from local directory.`);
        return cached;
      }
    } catch (cacheReadError: any) {
      logger.error(`Failed to read registry cache: ${cacheReadError.message}`);
    }

    return [];
  }
}

export async function searchRegistry(query: string, url = DEFAULT_REGISTRY_URL): Promise<RegistrySkill[]> {
  const skills = await fetchRegistry(url);
  const normalizedQuery = query.toLowerCase();
  return skills.filter(skill => 
    skill.name.toLowerCase().includes(normalizedQuery) ||
    skill.description.toLowerCase().includes(normalizedQuery) ||
    skill.tags.some(tag => tag.toLowerCase().includes(normalizedQuery))
  );
}

export async function installSkill(
  skillName: string, 
  workspaceCwd: string, 
  global = false, 
  registryUrl = DEFAULT_REGISTRY_URL
): Promise<boolean> {
  const skills = await fetchRegistry(registryUrl);
  const targetSkill = skills.find(s => s.name.toLowerCase() === skillName.toLowerCase());
  
  if (!targetSkill) {
    logger.error(`Skill "${skillName}" not found in registry.`);
    return false;
  }

  try {
    const res = await fetch(targetSkill.url);
    if (!res.ok) {
      throw new Error(`Failed to fetch SKILL.md: HTTP status ${res.status}`);
    }
    const skillMdContent = await res.text();

    const targetBaseDir = global 
      ? path.join(os.homedir(), '.qode', 'skills')
      : path.join(workspaceCwd, '.agents', 'skills');

    const skillDir = path.join(targetBaseDir, targetSkill.name.toLowerCase());
    const skillMdPath = path.join(skillDir, 'SKILL.md');

    await fs.ensureDir(skillDir);
    await fs.writeFile(skillMdPath, skillMdContent, 'utf8');

    logger.info(`✔ Installed skill "${targetSkill.name}" to ${global ? 'global' : 'workspace'} directory.`);
    return true;
  } catch (error: any) {
    logger.error(`Failed to install skill "${skillName}": ${error.message}`);
    return false;
  }
}
