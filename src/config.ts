import * as readline from 'readline';
import fs from 'fs-extra';
import os from 'os';
import path from 'path';

export interface ProviderConfig {
  apiKey?: string;
  baseURL?: string;
}

export interface MCPServerConfig {
  command: string;
  args: string[];
}

export interface CosqcodeConfig {
  providers: Record<string, ProviderConfig>;
  defaultModel?: string;
  autoCompress: boolean;
  compressThreshold: number;
  mcpServers?: MCPServerConfig[];
}

const CONFIG_DIR = path.join(os.homedir(), '.cosqcode');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

const DEFAULT_CONFIG: CosqcodeConfig = {
  providers: {},
  autoCompress: true,
  compressThreshold: 0.8,
  mcpServers: [],
};

export async function loadConfig(): Promise<CosqcodeConfig> {
  try {
    const raw = await fs.readJson(CONFIG_FILE);
    return {
      ...DEFAULT_CONFIG,
      ...raw,
      providers: {
        ...DEFAULT_CONFIG.providers,
        ...(raw?.providers ?? {}),
      },
      mcpServers: Array.isArray(raw?.mcpServers) ? raw.mcpServers : [],
    };
  } catch (error: any) {
    if (error?.code === 'ENOENT') {
      return { ...DEFAULT_CONFIG };
    }
    throw error;
  }
}

export async function saveConfig(config: CosqcodeConfig): Promise<void> {
  await fs.ensureDir(CONFIG_DIR);
  await fs.writeJson(CONFIG_FILE, config, { spaces: 2 });
}

export async function configureAuth(): Promise<void> {
  const config = await loadConfig();
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const question = (prompt: string): Promise<string> =>
    new Promise((resolve) => {
      rl.question(prompt, (answer) => resolve(answer));
    });

  const providers = [
    'Google AI Studio',
    'GitHub Models',
    'DeepSeek API',
    'OpenRouter',
    'GroqCloud',
    'OpenCode Zen',
  ];

  for (const provider of providers) {
    const value = await question(`${provider} API key (leave blank to skip): `);
    if (value.trim()) {
      config.providers[provider] = {
        ...config.providers[provider],
        apiKey: value.trim(),
      };
    }
  }

  rl.close();
  await saveConfig(config);
  console.log('Authentication settings saved.');
}