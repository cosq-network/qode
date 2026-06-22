import { logger } from '../utils/logger.js';
import { AUTH_PROVIDERS } from './providers.js';
import { saveCredentials, removeCredentials, listConfiguredProviders, getApiKey as storageGetApiKey, getTokens as storageGetTokens } from './storage.js';
import { exec } from 'child_process';
import type { AuthProvider, AuthTokens } from './storage.js';

/**
 * Main auth manager that orchestrates authentication flows.
 */
export class AuthManager {
  private providers: Record<string, AuthProvider>;

  constructor() {
    this.providers = AUTH_PROVIDERS;
  }

  /** List all available auth providers. */
  listProviders(): Array<{ name: string; type: string; description: string; configured: boolean }> {
    return Object.values(this.providers).map((p) => ({
      name: p.name,
      type: p.type,
      description: p.description,
      configured: false, // Will be updated by caller
    }));
  }

  /** Get a specific auth provider. */
  getProvider(name: string): AuthProvider | undefined {
    return this.providers[name];
  }

  /** Connect a provider using the appropriate auth flow. */
  async connectProvider(providerName: string): Promise<boolean> {
    const provider = this.providers[providerName];
    if (!provider) {
      logger.error(`Unknown provider: ${providerName}`);
      return false;
    }

    try {
      switch (provider.type) {
        case 'api-key':
          return await this.connectApiKey(provider);
        case 'device-code':
          return await this.connectDeviceCode(provider);
        case 'oauth':
          return await this.connectOAuth(provider);
        default:
          logger.error(`Unsupported auth type: ${provider.type}`);
          return false;
      }
    } catch (error: any) {
      logger.error(`Authentication failed: ${error.message}`);
      return false;
    }
  }

  /** Connect via API key. */
  private async connectApiKey(provider: AuthProvider): Promise<boolean> {
    if (!provider.setupApiKey) {
      logger.error(`Provider ${provider.name} does not support API key setup.`);
      return false;
    }

    const apiKey = await provider.setupApiKey();
    if (!apiKey) {
      logger.info('Authentication cancelled.');
      return false;
    }

    const tokens: AuthTokens = { accessToken: apiKey };
    const valid = await provider.validateCredentials(tokens);
    if (!valid) {
      logger.error('Invalid API key. Please check and try again.');
      return false;
    }

    await saveCredentials(provider.name, {
      provider: provider.name,
      type: 'api-key',
      apiKey,
      tokens,
      lastValidated: new Date().toISOString(),
    });

    logger.info(`✔ Connected to ${provider.name}`);
    return true;
  }

  /** Connect via device code flow. */
  private async connectDeviceCode(provider: AuthProvider): Promise<boolean> {
    if (!provider.startDeviceCode || !provider.pollDeviceCode) {
      logger.error(`Provider ${provider.name} does not support device code flow.`);
      return false;
    }

    const session = await provider.startDeviceCode();

    // Open browser for user
    logger.info(`\n┌─────────────────── Device Code Authentication ───────────────────┐`);
    logger.info(`│ To authenticate with ${provider.name}:`);
    logger.info(`│`);
    logger.info(`│ 1. Open: \x1b[36m${session.verificationUri}\x1b[0m`);
    logger.info(`│ 2. Enter code: \x1b[33m${session.userCode}\x1b[0m`);
    logger.info(`│`);
    logger.info(`│ Waiting for authentication... (press Ctrl+C to cancel)`);
    logger.info(`└──────────────────────────────────────────────────────────────────┘\n`);

    // Try to open browser
    try {
      const platform = process.platform;
      const cmd = platform === 'darwin' ? 'open' : platform === 'win32' ? 'start' : 'xdg-open';
      exec(`${cmd} ${session.verificationUri}`);
    } catch {
      // Ignore if browser can't be opened
    }

    // Poll for completion
    const maxAttempts = Math.floor((session.expiresAt - Date.now()) / (session.interval * 1000));
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise((resolve) => setTimeout(resolve, session.interval * 1000));

      try {
        const tokens = await provider.pollDeviceCode(session);
        if (tokens.accessToken) {
          await saveCredentials(provider.name, {
            provider: provider.name,
            type: 'device-code',
            tokens,
            lastValidated: new Date().toISOString(),
          });
          logger.info(`✔ Connected to ${provider.name}`);
          return true;
        }
      } catch (error: any) {
        if (error.message === 'PENDING') {
          // Still waiting
          process.stdout.write('.');
          continue;
        }
        throw error;
      }
    }

    logger.error('Authentication timed out.');
    return false;
  }

  /** Connect via OAuth flow. */
  private async connectOAuth(provider: AuthProvider): Promise<boolean> {
    if (!provider.startOAuth || !provider.handleCallback) {
      logger.error(`Provider ${provider.name} does not support OAuth flow.`);
      return false;
    }

    // OAuth flow would require a local server to handle callbacks
    // This is a simplified version
    logger.info(`OAuth flow for ${provider.name} is not yet fully implemented.`);
    logger.info('Please use API key or device code authentication.');
    return false;
  }

  /** Disconnect a provider. */
  async disconnectProvider(providerName: string): Promise<boolean> {
    try {
      await removeCredentials(providerName);
      logger.info(`✔ Disconnected from ${providerName}`);
      return true;
    } catch (error: any) {
      logger.error(`Failed to disconnect: ${error.message}`);
      return false;
    }
  }

  /** Get API key for a provider. */
  async getApiKey(providerName: string): Promise<string | null> {
    return storageGetApiKey(providerName);
  }

  /** Get tokens for a provider. */
  async getTokens(providerName: string): Promise<AuthTokens | null> {
    return storageGetTokens(providerName);
  }

  /** Check if a provider is configured. */
  async isConfigured(providerName: string): Promise<boolean> {
    const cred = await storageGetApiKey(providerName);
    return cred !== null;
  }

  /** Show auth status for all providers. */
  async showStatus(): Promise<void> {
    const configured = await listConfiguredProviders();

    logger.info('\n┌─────────────────────── Auth Status ───────────────────────┐');
    for (const [name, provider] of Object.entries(this.providers)) {
      const isConfigured = configured.includes(name);
      const icon = isConfigured ? '\x1b[32m✔\x1b[0m' : '\x1b[90m✘\x1b[0m';
      const status = isConfigured ? '\x1b[32mconnected\x1b[0m' : '\x1b[90mnot configured\x1b[0m';
      logger.info(`│ ${icon} ${name} (${provider.type}): ${status}`);
    }
    logger.info('└──────────────────────────────────────────────────────────┘');
    logger.info('Usage: /connect <provider>  — Set up authentication');
    logger.info('       /auth logout <provider> — Remove credentials');
  }
}

/** Singleton instance. */
let manager: AuthManager | null = null;

export function getAuthManager(): AuthManager {
  if (!manager) {
    manager = new AuthManager();
  }
  return manager;
}
