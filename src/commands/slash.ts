import { loadConfig, saveConfig } from '../config.js';
import { logger } from '../utils/logger.js';
import { listModels } from '../providers/models.js';
import { getAuthManager } from '../auth/manager.js';
import { AUTH_PROVIDERS, resolveAuthProviderName } from '../auth/providers.js';

/** Set an API key for a provider via slash command. */
export async function setKey(provider: string, key: string): Promise<void> {
  const cfg = await loadConfig();
  cfg.providers[provider] = { ...(cfg.providers[provider] ?? {}), apiKey: key };
  await saveConfig(cfg);
  logger.info(`✅ API key set for ${provider}`);
}

/** Clear the API key for a provider via slash command. */
export async function clearKey(provider: string): Promise<void> {
  const cfg = await loadConfig();
  if (cfg.providers[provider]) {
    delete cfg.providers[provider]!.apiKey;
    await saveConfig(cfg);
    logger.info(`🗑️ API key cleared for ${provider}`);
  } else {
    logger.info(`⚠️ Provider ${provider} not found in config`);
  }
}

function formatAuthProviders(): string {
  return Object.keys(AUTH_PROVIDERS)
    .map((provider) => provider === 'Google AI Studio' ? 'gemini' : provider.toLowerCase().replace(/\s+/g, '-'))
    .join(', ');
}

function resolveProviderOrReport(providerInput: string | undefined): string | null {
  if (!providerInput) {
    logger.info(`Usage: /auth set <provider>`);
    logger.info(`Providers: ${formatAuthProviders()}`);
    return null;
  }

  const provider = resolveAuthProviderName(providerInput);
  if (!provider) {
    logger.info(`Unknown provider "${providerInput}".`);
    logger.info(`Providers: ${formatAuthProviders()}`);
    return null;
  }
  return provider;
}

/** Handle BYOK auth commands backed by encrypted credential storage. */
export async function authCommand(action = 'status', providerInput?: string): Promise<void> {
  const auth = getAuthManager();
  const normalizedAction = action.toLowerCase();

  if (normalizedAction === 'status') {
    await auth.showStatus();
    logger.info('Use /auth set <provider> to add a key, or /auth clear <provider> to remove one.');
    return;
  }

  if (normalizedAction === 'list') {
    logger.info('\nAvailable BYOK providers:');
    for (const provider of Object.values(AUTH_PROVIDERS)) {
      const env = provider.apiKeyEnv ? ` · env: ${provider.apiKeyEnv}` : '';
      logger.info(`  - ${provider.name} (${provider.type})${env}`);
    }
    logger.info('\nExamples: /auth set openai, /auth set gemini, /auth clear anthropic');
    return;
  }

  if (normalizedAction === 'set' || normalizedAction === 'connect') {
    const provider = resolveProviderOrReport(providerInput);
    if (!provider) return;
    logger.info(`Setting up ${provider}. Your key will be masked and stored encrypted.`);
    await auth.connectProvider(provider);
    return;
  }

  if (normalizedAction === 'clear' || normalizedAction === 'logout' || normalizedAction === 'remove') {
    const provider = resolveProviderOrReport(providerInput);
    if (!provider) return;
    await auth.disconnectProvider(provider);
    return;
  }

  logger.info('Usage: /auth [status|list|set|clear] [provider]');
  logger.info('Examples: /auth set openai, /auth set gemini, /auth status');
}

/** List available models. */
export async function listModelsCommand(): Promise<void> {
  await listModels();
}

/** Registry of slash command handlers. */
export const slashCommandHandlers: Record<string, (...args: string[]) => Promise<void>> = {
  'set-key': async (provider: string, key: string) => setKey(provider, key),
  'clear-key': async (provider: string) => clearKey(provider),
  'auth': async (action?: string, ...providerParts: string[]) => authCommand(action, providerParts.join(' ')),
  'connect': async (...providerParts: string[]) => authCommand('set', providerParts.join(' ')),
  'models': async () => listModelsCommand(),
};

/** Parse raw slash command input and dispatch. Returns true if a slash command was handled. */
export async function handleSlashCommand(input: string): Promise<boolean> {
  if (!input.startsWith('/')) return false;
  const parts = input.slice(1).trim().split(/\s+/);
  const cmd = parts[0];
  const handler = slashCommandHandlers[cmd];
  if (!handler) return false;
  try {
    await handler(...parts.slice(1));
  } catch (e) {
    logger.error(`Error executing /${cmd}: ${(e as Error).message}`);
  }
  return true;
}
