import { GoogleAuthProvider, OpenAIAuthProvider, AnthropicAuthProvider, GitHubAuthProvider, AUTH_PROVIDERS } from '../auth/providers.js';

describe('Auth Providers', () => {
  test('all providers are registered', () => {
    expect(AUTH_PROVIDERS['Google AI Studio']).toBeDefined();
    expect(AUTH_PROVIDERS['OpenAI']).toBeDefined();
    expect(AUTH_PROVIDERS['Anthropic']).toBeDefined();
    expect(AUTH_PROVIDERS['GitHub Copilot']).toBeDefined();
  });

  test('Google AI Studio is api-key type', () => {
    expect(GoogleAuthProvider.type).toBe('api-key');
    expect(GoogleAuthProvider.name).toBe('Google AI Studio');
  });

  test('OpenAI is api-key type (not device-code)', () => {
    expect(OpenAIAuthProvider.type).toBe('api-key');
    expect(OpenAIAuthProvider.name).toBe('OpenAI');
    expect(OpenAIAuthProvider.setupApiKey).toBeDefined();
    expect(OpenAIAuthProvider.validateCredentials).toBeDefined();
  });

  test('Anthropic is api-key type', () => {
    expect(AnthropicAuthProvider.type).toBe('api-key');
    expect(AnthropicAuthProvider.name).toBe('Anthropic');
  });

  test('GitHub Copilot is device-code type', () => {
    expect(GitHubAuthProvider.type).toBe('device-code');
    expect(GitHubAuthProvider.name).toBe('GitHub Copilot');
    expect(GitHubAuthProvider.startDeviceCode).toBeDefined();
    expect(GitHubAuthProvider.pollDeviceCode).toBeDefined();
  });

  test('OpenAI validateCredentials rejects empty tokens', async () => {
    const result = await OpenAIAuthProvider.validateCredentials({
      accessToken: '',
      tokenType: 'Bearer',
    });
    expect(result).toBe(false);
  });

  test('Google validateCredentials rejects empty tokens', async () => {
    const result = await GoogleAuthProvider.validateCredentials({
      accessToken: '',
      tokenType: 'Bearer',
    });
    expect(result).toBe(false);
  });

  test('Anthropic validateCredentials rejects empty tokens', async () => {
    const result = await AnthropicAuthProvider.validateCredentials({
      accessToken: '',
      tokenType: 'Bearer',
    });
    expect(result).toBe(false);
  });
});
