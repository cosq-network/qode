import type { AuthProvider, AuthTokens, DeviceCodeSession } from './storage.js';

/** Google AI Studio auth provider (API key based). */
export const GoogleAuthProvider: AuthProvider = {
  name: 'Google AI Studio',
  type: 'api-key',
  description: 'Google AI Studio API key (get from aistudio.google.com)',

  async setupApiKey(): Promise<string> {
    const inquirer = await import('inquirer');
    const { apiKey } = await inquirer.default.prompt([
      {
        type: 'password',
        name: 'apiKey',
        message: 'Enter your Google AI Studio API key:',
        mask: '*',
      },
    ]);
    return apiKey.trim();
  },

  async validateCredentials(tokens: AuthTokens): Promise<boolean> {
    // For API keys, validation is done by making a test request
    return !!tokens.accessToken;
  },
};

/** OpenAI auth provider (API key based). */
export const OpenAIAuthProvider: AuthProvider = {
  name: 'OpenAI',
  type: 'api-key',
  description: 'OpenAI API key (get from platform.openai.com)',

  async setupApiKey(): Promise<string> {
    const inquirer = await import('inquirer');
    const { apiKey } = await inquirer.default.prompt([
      {
        type: 'password',
        name: 'apiKey',
        message: 'Enter your OpenAI API key:',
        mask: '*',
      },
    ]);
    return apiKey.trim();
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

  async setupApiKey(): Promise<string> {
    const inquirer = await import('inquirer');
    const { apiKey } = await inquirer.default.prompt([
      {
        type: 'password',
        name: 'apiKey',
        message: 'Enter your Anthropic API key:',
        mask: '*',
      },
    ]);
    return apiKey.trim();
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
      // 200 = valid key, 401 = invalid
      return response.ok || response.status === 400; // 400 = valid key but bad request
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

/** All built-in auth providers. */
export const AUTH_PROVIDERS: Record<string, AuthProvider> = {
  'Google AI Studio': GoogleAuthProvider,
  'OpenAI': OpenAIAuthProvider,
  'Anthropic': AnthropicAuthProvider,
  'GitHub Copilot': GitHubAuthProvider,
};
