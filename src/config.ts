import fs from 'fs-extra';
import path from 'path';
import os from 'os';

const CONFIG_DIR = path.join(os.homedir(), '.cosqcode');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

export interface ProviderConfig {
  apiKey?: string;
  baseURL?: string;   // for OpenAI-compatible APIs
}

export interface CosqcodeConfig {
  providers: Record<string, ProviderConfig>;
  defaultModel?: string;
  autoCompress: boolean;
  compressThreshold: number; // token limit before compression (default 0.8 * context)
}

const DEFAULT_CONFIG: CosqcodeConfig = {
  providers: {},
  autoCompress: true,
  compressThreshold: 0.8,
};

export async function loadConfig(): Promise<CosqcodeConfig> {
  await fs.ensureDir(CONFIG_DIR);
  if (!(await fs.pathExists(CONFIG_FILE))) {
    await fs.writeJson(CONFIG_FILE, DEFAULT_CONFIG, { spaces: 2 });
    return DEFAULT_CONFIG;
  }
  return fs.readJson(CONFIG_FILE);
}

export async function saveConfig(config: CosqcodeConfig): Promise<void> {
  await fs.ensureDir(CONFIG_DIR);
  await fs.writeJson(CONFIG_FILE, config, { spaces: 2 });
}

import readline from 'readline';

export async function configureAuth(): Promise<void> {
  const config = await loadConfig();
  // Interactive setup: ask for keys (simplified here, you'd use inquirer)
  console.log('Interactive auth setup (enter provider key or leave blank):');
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const question = (q: string) => new Promise<string>((res) => rl.question(q, res));

  for (const provider of ['Google AI Studio', 'GitHub Models', 'DeepSeek API', 'OpenRouter', 'GroqCloud', 'OpenCode Zen']) {
    const key = await question(`${provider} API key (ENTER to skip): `);
    if (key.trim()) {
      config.providers[provider] = { apiKey: key.trim() };
    }
  }
  rl.close();
  await saveConfig(config);
  console.log('Configuration saved.');
}