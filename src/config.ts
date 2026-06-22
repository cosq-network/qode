import fs from 'fs-extra';
import path from 'path';
import { isCancel, password } from '@clack/prompts';
import { getQodeSubdir, getWritableQodeHome } from './utils/app-paths.js';

export interface ProviderConfig {
  apiKey?: string;
  baseURL?: string;
}

export interface MCPServerConfig {
  command: string;
  args: string[];
}

/** Permission level for a tool or category. */
export type PermissionLevel = 'allow' | 'ask' | 'deny';

/** Per-tool or per-category permission rules. Supports wildcard patterns. */
export interface PermissionRules {
  [toolOrCategory: string]: PermissionLevel;
}

/** Predefined permission sets for common modes. */
export interface ModePermissions {
  [mode: string]: PermissionRules;
}

export interface CompressionConfig {
  /** Number of recent messages to keep during compression (default: 4). */
  keepMessages: number;
  /** Whether to always keep the system prompt (default: true). */
  keepSystem: boolean;
  /** Prune tool outputs older than this many messages (default: 20). */
  pruneAfterMessages: number;
  /** Maximum characters for a pruned tool output summary (default: 120). */
  pruneMaxChars: number;
}

/** Configuration for the local llama.cpp model. */
export interface LocalModelConfig {
  /** Whether local model support is enabled. */
  enabled: boolean;
  /** Model filename to use (overrides auto-detect). */
  modelPath?: string;
  /** Port for llama-server (default: 8080). */
  port?: number;
  /** Context size for llama-server (default: 32768). */
  contextSize?: number;
  /** Number of CPU threads (default: auto). */
  threads?: number;
  /** Number of GPU layers to offload (default: 0 = CPU only). */
  gpuLayers?: number;
  /** Start llama-server automatically on qode launch. */
  autoStart?: boolean;
}

export interface QodeConfig {
  providers: Record<string, ProviderConfig>;
  defaultModel?: string;
  autoCompress: boolean;
  compressThreshold: number;
  mcpServers?: MCPServerConfig[];
  theme?: string;
  maxToolCalls?: number;
  /** Global permission rules — evaluated in order: tool-specific > category > wildcard > default. */
  permissions?: PermissionRules;
  /** Named permission presets that can be activated via /permissions mode <name>. */
  permissionModes?: ModePermissions;
  /** Compression and pruning settings. */
  compression?: Partial<CompressionConfig>;
  /** Local model (llama.cpp) settings. */
  localModel?: LocalModelConfig;
  /** Active agent mode. */
  mode?: AgentMode;
}

/** Agent modes — determines which tools are available and how the agent behaves. */
export type AgentMode = 'build' | 'plan';

/** A single step in a plan. */
export interface PlanStep {
  id: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  files?: string[];
}

/** An active plan with ordered steps. */
export interface Plan {
  steps: PlanStep[];
  createdAt: string;
  completedAt?: string;
}

const DEFAULT_CONFIG: QodeConfig = {
  providers: {},
  autoCompress: true,
  compressThreshold: 0.8,
  mcpServers: [],
  permissions: {},
  permissionModes: {
    plan: { edit: 'deny', bash: 'ask', read: 'allow', '*': 'allow' },
    build: { '*': 'allow' },
    explore: { edit: 'deny', bash: 'deny', read: 'allow', '*': 'allow' },
  },
  compression: {
    keepMessages: 4,
    keepSystem: true,
    pruneAfterMessages: 20,
    pruneMaxChars: 120,
  },
};

/** Load configuration from the user config file and apply any environment variable overrides. */
export async function loadConfig(): Promise<QodeConfig> {
  const configFile = getQodeSubdir('config.json');
  try {
    const raw = await fs.readJson(configFile);
    const merged: QodeConfig = {
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

export async function saveConfig(config: QodeConfig): Promise<void> {
  const configDir = getWritableQodeHome();
  const configFile = path.join(configDir, 'config.json');
  await fs.ensureDir(configDir);
  await fs.writeJson(configFile, config, { spaces: 2 });
}

/** Prompt the user for API keys (masked input). */
export async function configureAuth(): Promise<void> {
  const config = await loadConfig();

  const askSecret = async (prompt: string): Promise<string> => {
    const value = await password({ message: prompt, mask: '*' });
    if (isCancel(value)) {
      return '';
    }
    return value;
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
function applyEnvOverrides(config: QodeConfig): QodeConfig {
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
