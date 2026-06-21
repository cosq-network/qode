import * as readline from 'readline';
import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import inquirer from 'inquirer';

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

/** Load configuration from the user config file and apply any environment variable overrides. */
export async function loadConfig(): Promise<CosqcodeConfig> {
  try {
    const raw = await fs.readJson(CONFIG_FILE);
    const merged: CosqcodeConfig = {
      ...DEFAULT_CONFIG,
      ...raw,
      providers: {
        ...DEFAULT_CONFIG.providers,
        ...(raw?.providers ?? {}),
      },
      mcpServers: Array.isArray(raw?.mcpServers) ? raw.mcpServers : [],
    };
    return applyEnvOverrides(merged);
  } catch (error: any) {
    if (error?.code === 'ENOENT') {
      // No config file – start from defaults and apply env vars.
      return applyEnvOverrides({ ...DEFAULT_CONFIG });
    }
    throw error;
  }
}

export async function saveConfig(config: CosqcodeConfig): Promise<void> {
  await fs.ensureDir(CONFIG_DIR);
  await fs.writeJson(CONFIG_FILE, config, { spaces: 2 });
}

/** Prompt the user for API keys (masked input). */
export async function configureAuth(): Promise<void> {
  const config = await loadConfig();

  const askSecret = async (prompt: string): Promise<string> => {
    const answers = await inquirer.prompt([
      { type: 'password', name: 'key', message: prompt, mask: '*' },
    ]);
    return answers.key;
  };

  const providers = [
    'Google AI Studio',
    'GitHub Models',
    'DeepSeek API',
    'OpenRouter',
    'GroqCloud',
    'OpenCode Zen',
  ];

  for (const provider of providers) {
    const value = await askSecret(`${provider} API key (leave blank to skip): `);
    if (value.trim()) {
      config.providers[provider] = {
        ...config.providers[provider],
        apiKey: value.trim(),
      };
    }
  }

  await saveConfig(config);
  console.log('Authentication settings saved.');
}

/** Apply environment variable overrides for API keys – useful for CI pipelines. */
function applyEnvOverrides(config: CosqcodeConfig): CosqcodeConfig {
  const envMap: Record<string, string | undefined> = {
    'Google AI Studio': process.env.GOOGLE_API_KEY,
    'GitHub Models': process.env.GITHUB_MODELS_API_KEY,
    'DeepSeek API': process.env.DEEPSEEK_API_KEY,
    'OpenRouter': process.env.OPENROUTER_API_KEY,
    'GroqCloud': process.env.GROQ_API_KEY,
    'OpenCode Zen': process.env.OPENCODE_ZEN_API_KEY,
  };
  for (const [provider, key] of Object.entries(envMap)) {
    if (key) {
      config.providers[provider] = {
        ...(config.providers[provider] ?? {}),
        apiKey: key,
      };
    }
  }
  return config;
}