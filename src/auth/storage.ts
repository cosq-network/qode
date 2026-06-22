import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import crypto from 'crypto';

/** Auth provider types. */
export type AuthType = 'api-key' | 'oauth' | 'device-code';

/** Tokens returned by an auth flow. */
export interface AuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
  tokenType?: string;
}

/** Auth session for OAuth flows. */
export interface AuthSession {
  state: string;
  codeVerifier?: string;
  redirectUri: string;
}

/** Device code session for device code flows. */
export interface DeviceCodeSession {
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  expiresAt: number;
  interval: number;
}

/** Auth provider interface. */
export interface AuthProvider {
  name: string;
  type: AuthType;
  description: string;

  // For API key
  setupApiKey?(): Promise<string>;

  // For OAuth
  startOAuth?(): Promise<AuthSession>;
  handleCallback?(callback: string): Promise<AuthTokens>;

  // For device code
  startDeviceCode?(): Promise<DeviceCodeSession>;
  pollDeviceCode?(session: DeviceCodeSession): Promise<AuthTokens>;

  // Common
  validateCredentials(tokens: AuthTokens): Promise<boolean>;
  refreshToken?(tokens: AuthTokens): Promise<AuthTokens>;
}

/** Stored credentials for a provider. */
export interface StoredCredentials {
  provider: string;
  type: AuthType;
  tokens?: AuthTokens;
  apiKey?: string;
  lastValidated?: string;
}

const AUTH_DIR = path.join(os.homedir(), '.qode');
const AUTH_FILE = path.join(AUTH_DIR, 'auth.json');
const KEY_FILE = path.join(AUTH_DIR, '.encryption-key');

// Get or create a machine-specific encryption key
// Uses a random key stored in a file, with hostname+username as additional entropy
async function getEncryptionKey(): Promise<string> {
  try {
    // Try to read existing key
    const keyData = await fs.readJson(KEY_FILE);
    if (keyData?.key && typeof keyData.key === 'string' && keyData.key.length === 64) {
      return keyData.key;
    }
  } catch {
    // Key file doesn't exist, create one
  }

  // Generate a new random key
  const randomBytes = crypto.randomBytes(32);
  const machineEntropy = `${os.hostname()}-${os.userInfo().username}-${Date.now()}`;
  const key = crypto.createHash('sha256').update(Buffer.concat([randomBytes, Buffer.from(machineEntropy)])).digest('hex');

  // Save the key
  await fs.ensureDir(AUTH_DIR);
  await fs.writeJson(KEY_FILE, { key }, { spaces: 2 });
  // Restrict permissions on key file (Unix only)
  try {
    await fs.chmod(KEY_FILE, 0o600);
  } catch {
    // Ignore on Windows
  }

  return key;
}

async function encrypt(text: string): Promise<string> {
  const key = await getEncryptionKey();
  const keyBuffer = Buffer.from(key, 'hex');
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', keyBuffer, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return `${iv.toString('hex')}:${encrypted}`;
}

async function decrypt(text: string): Promise<string> {
  const key = await getEncryptionKey();
  const keyBuffer = Buffer.from(key, 'hex');
  const [ivHex, encrypted] = text.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', keyBuffer, iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

/** Load all stored credentials. */
export async function loadCredentials(): Promise<Map<string, StoredCredentials>> {
  const map = new Map<string, StoredCredentials>();
  try {
    const raw = await fs.readJson(AUTH_FILE);
    if (raw && typeof raw === 'object') {
      for (const [provider, data] of Object.entries(raw)) {
        const cred = data as StoredCredentials;
        // Decrypt sensitive fields
        if (cred.apiKey) {
          try { cred.apiKey = await decrypt(cred.apiKey); } catch { /* ignore */ }
        }
        if (cred.tokens?.accessToken) {
          try { cred.tokens.accessToken = await decrypt(cred.tokens.accessToken); } catch { /* ignore */ }
        }
        if (cred.tokens?.refreshToken) {
          try { cred.tokens.refreshToken = await decrypt(cred.tokens.refreshToken); } catch { /* ignore */ }
        }
        map.set(provider, cred);
      }
    }
  } catch (error: any) {
    if (error?.code !== 'ENOENT') {
      console.error(`Failed to load auth: ${error.message}`);
    }
  }
  return map;
}

/** Save credentials for a provider. */
export async function saveCredentials(provider: string, cred: StoredCredentials): Promise<void> {
  const map = await loadCredentials();
  // Encrypt sensitive fields
  const toStore: StoredCredentials = { ...cred };
  if (toStore.apiKey) {
    toStore.apiKey = await encrypt(toStore.apiKey);
  }
  if (toStore.tokens?.accessToken) {
    toStore.tokens = { ...toStore.tokens, accessToken: await encrypt(toStore.tokens.accessToken) };
  }
  if (toStore.tokens?.refreshToken) {
    toStore.tokens = { ...toStore.tokens, refreshToken: await encrypt(toStore.tokens.refreshToken) };
  }
  map.set(provider, toStore);
  // Convert map to object for JSON serialization
  const obj: Record<string, StoredCredentials> = {};
  for (const [k, v] of map) obj[k] = v;
  await fs.ensureDir(AUTH_DIR);
  await fs.writeJson(AUTH_FILE, obj, { spaces: 2 });
}

/** Remove credentials for a provider. */
export async function removeCredentials(provider: string): Promise<void> {
  const map = await loadCredentials();
  map.delete(provider);
  const obj: Record<string, StoredCredentials> = {};
  for (const [k, v] of map) obj[k] = v;
  await fs.ensureDir(AUTH_DIR);
  await fs.writeJson(AUTH_FILE, obj, { spaces: 2 });
}

/** Get a specific provider's credentials. */
export async function getCredentials(provider: string): Promise<StoredCredentials | null> {
  const map = await loadCredentials();
  return map.get(provider) ?? null;
}

/** Get API key for a provider (convenience wrapper). */
export async function getApiKey(provider: string): Promise<string | null> {
  const cred = await getCredentials(provider);
  // API key providers store it directly
  if (cred?.apiKey) return cred.apiKey;
  // Device-code providers store the token in tokens.accessToken
  if (cred?.tokens?.accessToken) return cred.tokens.accessToken;
  return null;
}

/** Get tokens for a provider (convenience wrapper). */
export async function getTokens(provider: string): Promise<AuthTokens | null> {
  const cred = await getCredentials(provider);
  return cred?.tokens ?? null;
}

/** List all configured providers. */
export async function listConfiguredProviders(): Promise<string[]> {
  const map = await loadCredentials();
  return Array.from(map.keys());
}
