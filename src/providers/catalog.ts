export type ProviderRuntime = 'gemini' | 'anthropic' | 'openai-compatible' | 'opencode';

export interface ModelCatalogEntry {
  id: string;
  label: string;
  aliases?: string[];
}

export interface ProviderCatalogEntry {
  key: string;
  runtime: ProviderRuntime;
  authType: 'api-key' | 'device-code';
  description: string;
  aliases: string[];
  envVar?: string;
  baseURL?: string;
  models: ModelCatalogEntry[];
}

export const PROVIDER_CATALOG: ProviderCatalogEntry[] = [
  {
    key: 'Google AI Studio',
    runtime: 'gemini',
    authType: 'api-key',
    description: 'Google AI Studio API key',
    aliases: ['google', 'gemini', 'google-ai-studio'],
    envVar: 'GOOGLE_API_KEY',
    models: [
      { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', aliases: ['Gemini 2.5 Pro'] },
      { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', aliases: ['Gemini 2.5 Flash'] },
      { id: 'gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro Preview', aliases: ['Gemini 3.1 Pro Preview'] },
    ],
  },
  {
    key: 'OpenAI',
    runtime: 'openai-compatible',
    authType: 'api-key',
    description: 'OpenAI API key',
    aliases: ['openai'],
    envVar: 'OPENAI_API_KEY',
    baseURL: 'https://api.openai.com/v1',
    models: [
      { id: 'gpt-5.4-mini', label: 'GPT-5.4 Mini', aliases: ['gpt-5-mini', 'GPT-5 Mini'] },
      { id: 'gpt-5.4', label: 'GPT-5.4' },
      { id: 'gpt-5.5', label: 'GPT-5.5' },
    ],
  },
  {
    key: 'Anthropic',
    runtime: 'anthropic',
    authType: 'api-key',
    description: 'Anthropic API key for Claude',
    aliases: ['anthropic', 'claude'],
    envVar: 'ANTHROPIC_API_KEY',
    models: [
      { id: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4', aliases: ['Claude Sonnet 4'] },
      { id: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet', aliases: ['Claude 3.5 Sonnet'] },
      { id: 'claude-3-5-haiku-20241022', label: 'Claude 3.5 Haiku', aliases: ['Claude 3.5 Haiku'] },
    ],
  },
  {
    key: 'GitHub Models',
    runtime: 'openai-compatible',
    authType: 'api-key',
    description: 'GitHub Models API key or PAT',
    aliases: ['github', 'github-models', 'github_models'],
    envVar: 'GITHUB_MODELS_API_KEY',
    baseURL: 'https://models.inference.ai.azure.com',
    models: [
      { id: 'openai/gpt-4.1', label: 'GPT-4.1' },
      { id: 'openai/gpt-4.1-mini', label: 'GPT-4.1 Mini' },
      { id: 'DeepSeek-R1', label: 'DeepSeek R1', aliases: ['DeepSeek-R1'] },
    ],
  },
  {
    key: 'DeepSeek API',
    runtime: 'openai-compatible',
    authType: 'api-key',
    description: 'DeepSeek API key',
    aliases: ['deepseek', 'deepseek-api'],
    envVar: 'DEEPSEEK_API_KEY',
    baseURL: 'https://api.deepseek.com/v1',
    models: [
      { id: 'deepseek-chat', label: 'DeepSeek Chat', aliases: ['DeepSeek V4-Flash'] },
      { id: 'deepseek-reasoner', label: 'DeepSeek Reasoner', aliases: ['DeepSeek V4-Pro'] },
    ],
  },
  {
    key: 'OpenRouter',
    runtime: 'openai-compatible',
    authType: 'api-key',
    description: 'OpenRouter API key',
    aliases: ['openrouter'],
    envVar: 'OPENROUTER_API_KEY',
    baseURL: 'https://openrouter.ai/api/v1',
    models: [
      { id: 'openai/gpt-oss-120b', label: 'GPT OSS 120B', aliases: ['gpt-oss-120b'] },
      { id: 'qwen/qwen3-coder', label: 'Qwen3 Coder', aliases: ['Qwen3-Coder'] },
      { id: 'poolside/laguna-m-1', label: 'Laguna M.1', aliases: ['Laguna M.1 (Poolside)'] },
    ],
  },
  {
    key: 'GroqCloud',
    runtime: 'openai-compatible',
    authType: 'api-key',
    description: 'GroqCloud API key',
    aliases: ['groq', 'groqcloud'],
    envVar: 'GROQ_API_KEY',
    baseURL: 'https://api.groq.com/openai/v1',
    models: [
      { id: 'qwen/qwen3-32b', label: 'Qwen3 32B', aliases: ['Qwen3 (32B)'] },
      { id: 'meta-llama/llama-4-scout-17b-16e-instruct', label: 'Llama 4 Scout 17B', aliases: ['Llama 4 Scout (17B)'] },
      { id: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B Versatile' },
    ],
  },
  {
    key: 'OpenCode Zen',
    runtime: 'opencode',
    authType: 'api-key',
    description: 'OpenCode Zen API key',
    aliases: ['opencode', 'opencode-zen'],
    envVar: 'OPENCODE_ZEN_API_KEY',
    models: [
      { id: 'big-pickle', label: 'Big Pickle', aliases: ['Big Pickle'] },
      { id: 'deepseek-v4-flash-free', label: 'DeepSeek V4 Flash Free' },
      { id: 'nemotron-3-ultra-free', label: 'Nemotron 3 Ultra Free' },
      { id: 'qwen3-5-plus', label: 'Qwen3 5 Plus' },
    ],
  },
  {
    key: 'Z.ai',
    runtime: 'openai-compatible',
    authType: 'api-key',
    description: 'Z.ai API key',
    aliases: ['z', 'zai', 'z-ai', 'z.ai'],
    envVar: 'ZAI_API_KEY',
    baseURL: 'https://api.z.ai/api/paas/v4',
    models: [
      { id: 'glm-4.5', label: 'GLM-4.5', aliases: ['GLM-4.7-Flash'] },
      { id: 'glm-4.5-flash', label: 'GLM-4.5 Flash', aliases: ['GLM-5.2'] },
    ],
  },
  {
    key: 'GitHub Copilot',
    runtime: 'openai-compatible',
    authType: 'device-code',
    description: 'GitHub Copilot subscription via device code',
    aliases: ['copilot', 'github-copilot'],
    models: [],
  },
];

export function getProviderCatalog(providerKey: string): ProviderCatalogEntry | undefined {
  return PROVIDER_CATALOG.find((provider) => provider.key === providerKey);
}

export function getProviderAliasMap(): Record<string, string> {
  const aliases: Record<string, string> = {};
  for (const provider of PROVIDER_CATALOG) {
    aliases[provider.key.toLowerCase()] = provider.key;
    aliases[provider.key.toLowerCase().replace(/[\s_.]+/g, '-')] = provider.key;
    for (const alias of provider.aliases) {
      aliases[alias.toLowerCase()] = provider.key;
      aliases[alias.toLowerCase().replace(/[\s_.]+/g, '-')] = provider.key;
    }
  }
  return aliases;
}

export function resolveProviderName(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const aliases = getProviderAliasMap();
  const normalized = trimmed.toLowerCase();
  return aliases[normalized] ?? aliases[normalized.replace(/[\s_.]+/g, '-')] ?? null;
}
