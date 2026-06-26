import { isCancel, password } from '@clack/prompts';
import { PROVIDER_CATALOG, resolveProviderName } from '../providers/catalog.js';
import type { AuthProvider, AuthTokens, DeviceCodeSession } from './storage.js';

/** Google AI Studio auth provider (API key based). */
export const GoogleAuthProvider: AuthProvider = {
  name: 'Google AI Studio',
  type: 'api-key',
  description: 'Google AI Studio API key (get from aistudio.google.com)',
  apiKeyEnv: 'GOOGLE_API_KEY',

  async setupApiKey(): Promise<string> {
    const apiKey = await password({
      message: 'Enter your Google AI Studio API key:',
      mask: '*',
    });
    return isCancel(apiKey) ? '' : apiKey.trim();
  },

  async validateCredentials(tokens: AuthTokens): Promise<boolean> {
    return !!tokens.accessToken;
  },
};

/** OpenAI auth provider (API key based). */
export const OpenAIAuthProvider: AuthProvider = {
  name: 'OpenAI',
  type: 'api-key',
  description: 'OpenAI API key (get from platform.openai.com)',
  apiKeyEnv: 'OPENAI_API_KEY',

  async setupApiKey(): Promise<string> {
    const apiKey = await password({
      message: 'Enter your OpenAI API key:',
      mask: '*',
    });
    return isCancel(apiKey) ? '' : apiKey.trim();
  },

  async validateCredentials(tokens: AuthTokens): Promise<boolean> {
    if (!tokens.accessToken) return false;
    try {
      const response = await fetch('https://api.openai.com/v1/models', {
        headers: {
          'Authorization': `Bearer ${tokens.accessToken}`,
        },
      });
      return response.ok;
    } catch {
      return false;
    }
  },
};

/** Anthropic auth provider. */
export const AnthropicAuthProvider: AuthProvider = {
  name: 'Anthropic',
  type: 'api-key',
  description: 'Anthropic API key (for Claude)',
  apiKeyEnv: 'ANTHROPIC_API_KEY',

  async setupApiKey(): Promise<string> {
    const apiKey = await password({
      message: 'Enter your Anthropic API key:',
      mask: '*',
    });
    return isCancel(apiKey) ? '' : apiKey.trim();
  },

  async validateCredentials(tokens: AuthTokens): Promise<boolean> {
    if (!tokens.accessToken) return false;
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': tokens.accessToken,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-3-haiku-20240307',
          max_tokens: 1,
          messages: [{ role: 'user', content: 'hi' }],
        }),
      });
      return response.ok || response.status === 400;
    } catch {
      return false;
    }
  },
};

/** GitHub Copilot auth provider (device code flow). */
export const GitHubAuthProvider: AuthProvider = {
  name: 'GitHub Copilot',
  type: 'device-code',
  description: 'GitHub Copilot subscription (via GitHub)',

  async startDeviceCode(): Promise<DeviceCodeSession> {
    // GitHub device code flow
    const response = await fetch('https://github.com/login/device/code', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: 'Iv1.b507a08c87ecfe98', // GitHub Copilot client ID
        scope: 'read:user',
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to start device code flow: ${response.statusText}`);
    }

    const data = await response.json() as {
      device_code: string;
      user_code: string;
      verification_uri: string;
      expires_in: number;
      interval: number;
    };

    return {
      deviceCode: data.device_code,
      userCode: data.user_code,
      verificationUri: data.verification_uri,
      expiresAt: Date.now() + data.expires_in * 1000,
      interval: data.interval,
    };
  },

  async pollDeviceCode(session: DeviceCodeSession): Promise<AuthTokens> {
    const response = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: 'Iv1.b507a08c87ecfe98',
        device_code: session.deviceCode,
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to poll device code: ${response.statusText}`);
    }

    const data = await response.json() as {
      access_token?: string;
      error?: string;
      error_description?: string;
    };

    if (data.error) {
      if (data.error === 'authorization_pending') {
        throw new Error('PENDING');
      }
      throw new Error(data.error_description ?? data.error);
    }

    if (!data.access_token) {
      throw new Error('No access token received');
    }

    return {
      accessToken: data.access_token,
      tokenType: 'Bearer',
    };
  },

  async validateCredentials(tokens: AuthTokens): Promise<boolean> {
    if (!tokens.accessToken) return false;
    try {
      const response = await fetch('https://api.github.com/user', {
        headers: {
          'Authorization': `Bearer ${tokens.accessToken}`,
          'Accept': 'application/vnd.github.v3+json',
        },
      });
      return response.ok;
    } catch {
      return false;
    }
  },
};

function makeApiKeyProvider(name: string, description: string, promptMessage: string, apiKeyEnv?: string): AuthProvider {
  return {
    name,
    type: 'api-key',
    description,
    apiKeyEnv,
    async setupApiKey(): Promise<string> {
      const apiKey = await password({ message: promptMessage, mask: '*' });
      return isCancel(apiKey) ? '' : apiKey.trim();
    },
    async validateCredentials(tokens: AuthTokens): Promise<boolean> {
      return !!tokens.accessToken;
    },
  };
}

const catalogByKey = Object.fromEntries(PROVIDER_CATALOG.map((provider) => [provider.key, provider]));

/** All built-in auth providers. */
export const AUTH_PROVIDERS: Record<string, AuthProvider> = {
  'Google AI Studio': GoogleAuthProvider,
  'OpenAI': OpenAIAuthProvider,
  'Anthropic': AnthropicAuthProvider,
  'GitHub Copilot': GitHubAuthProvider,
  'GitHub Models': {
    name: 'GitHub Models',
    type: 'api-key',
    description: 'GitHub Models API key or PAT',
    apiKeyEnv: catalogByKey['GitHub Models']?.envVar,
    async setupApiKey(): Promise<string> {
      const apiKey = await password({ message: 'Enter your GitHub Models API key or PAT:', mask: '*' });
      return isCancel(apiKey) ? '' : apiKey.trim();
    },
    async validateCredentials(tokens: AuthTokens): Promise<boolean> {
      return !!tokens.accessToken;
    },
  },
  'DeepSeek API': makeApiKeyProvider('DeepSeek API', 'DeepSeek API key', 'Enter your DeepSeek API key:', catalogByKey['DeepSeek API']?.envVar),
  'OpenRouter': makeApiKeyProvider('OpenRouter', 'OpenRouter API key', 'Enter your OpenRouter API key:', catalogByKey.OpenRouter?.envVar),
  'GroqCloud': makeApiKeyProvider('GroqCloud', 'GroqCloud API key', 'Enter your GroqCloud API key:', catalogByKey.GroqCloud?.envVar),
  'OpenCode Zen': makeApiKeyProvider('OpenCode Zen', 'OpenCode Zen API key', 'Enter your OpenCode Zen API key:', catalogByKey['OpenCode Zen']?.envVar),
  'Z.ai': makeApiKeyProvider('Z.ai', 'Z.ai API key', 'Enter your Z.ai API key:', catalogByKey['Z.ai']?.envVar),
};

export function resolveAuthProviderName(input: string): string | null {
  const provider = resolveProviderName(input);
  return provider && AUTH_PROVIDERS[provider] ? provider : null;
}
