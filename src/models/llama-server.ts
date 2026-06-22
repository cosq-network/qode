import { spawn, ChildProcess } from 'child_process';
import fs from 'fs-extra';
import { logger } from '../utils/logger.js';
import { getModelPath, BUILTIN_MODELS } from './downloader.js';

/** Configuration for the llama.cpp server. */
export interface LlamaServerConfig {
  port: number;
  contextSize: number;
  threads?: number;
  gpuLayers?: number;
}

const DEFAULT_CONFIG: LlamaServerConfig = {
  port: 8080,
  contextSize: 32768,
};

/** State of the llama-server process. */
export type LlamaServerState = 'stopped' | 'starting' | 'running' | 'error';

/** Manager for the llama.cpp inference server. */
export class LlamaServerManager {
  private process: ChildProcess | null = null;
  private state: LlamaServerState = 'stopped';
  private config: LlamaServerConfig;
  private modelPath: string;
  private baseUrl: string;
  private startPromise: Promise<void> | null = null;

  constructor(modelFilename: string, config?: Partial<LlamaServerConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.modelPath = getModelPath(modelFilename);
    this.baseUrl = `http://127.0.0.1:${this.config.port}`;
  }

  /** Get the current server state. */
  getState(): LlamaServerState {
    return this.state;
  }

  /** Get the base URL for API calls. */
  getBaseUrl(): string {
    return this.baseUrl;
  }

  /** Check if the server is healthy. */
  async isHealthy(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        signal: AbortSignal.timeout(2000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /** Start the llama-server process. Idempotent — returns immediately if already running. */
  async start(): Promise<void> {
    if (this.state === 'running') return;
    if (this.startPromise) return this.startPromise;

    this.startPromise = this.doStart();
    try {
      await this.startPromise;
    } finally {
      this.startPromise = null;
    }
  }

  private async doStart(): Promise<void> {
    // Check if llama-server binary exists
    const serverPath = await findLlamaServer();
    if (!serverPath) {
      logger.warn('⚠️  llama-server not found. Local model disabled.');
      logger.info('  Install llama.cpp: brew install llama.cpp (macOS) or build from source.');
      this.state = 'error';
      return;
    }

    // Check if model file exists
    if (!(await fs.pathExists(this.modelPath))) {
      logger.warn(`⚠️  Model file not found: ${this.modelPath}`);
      this.state = 'error';
      return;
    }

    logger.info(`🚀 Starting llama-server on port ${this.config.port}...`);
    this.state = 'starting';

    const args = [
      '-m', this.modelPath,
      '--port', String(this.config.port),
      '--ctx-size', String(this.config.contextSize),
      '--host', '127.0.0.1',
    ];

    if (this.config.threads) args.push('--threads', String(this.config.threads));
    if (this.config.gpuLayers !== undefined) args.push('-ngl', String(this.config.gpuLayers));

    this.process = spawn(serverPath, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    this.process.stdout?.on('data', (data: Buffer) => {
      const msg = data.toString().trim();
      if (msg.includes('listening') || msg.includes('server is ready')) {
        this.state = 'running';
        logger.info(`✔ llama-server running at ${this.baseUrl}`);
      }
    });

    this.process.stderr?.on('data', (data: Buffer) => {
      const msg = data.toString().trim();
      if (msg.includes('error') || msg.includes('failed')) {
        logger.error(`llama-server: ${msg}`);
      }
    });

    this.process.on('close', (code) => {
      logger.info(`llama-server exited with code ${code}`);
      this.state = 'stopped';
      this.process = null;
    });

    this.process.on('error', (err) => {
      logger.error(`llama-server error: ${err.message}`);
      this.state = 'error';
      this.process = null;
    });

    // Wait for server to become healthy (up to 30s)
    const startTime = Date.now();
    const timeout = 30_000;
    while (Date.now() - startTime < timeout) {
      if (this.state !== 'starting') return;
      if (await this.isHealthy()) {
        this.state = 'running';
        logger.info(`✔ llama-server ready at ${this.baseUrl}`);
        return;
      }
      await new Promise((r) => setTimeout(r, 500));
    }

    logger.warn('⚠️  llama-server did not become healthy within 30s.');
    this.state = 'error';
  }

  /** Stop the llama-server process. */
  async stop(): Promise<void> {
    if (this.process) {
      this.process.kill('SIGTERM');
      // Wait up to 5s for graceful shutdown
      await new Promise<void>((resolve) => {
        const timer = setTimeout(() => {
          if (this.process) this.process.kill('SIGKILL');
          resolve();
        }, 5000);
        this.process!.on('close', () => {
          clearTimeout(timer);
          resolve();
        });
      });
    }
    this.state = 'stopped';
    this.process = null;
  }

  /** Restart the server. */
  async restart(): Promise<void> {
    await this.stop();
    await this.start();
  }
}

/** Find the llama-server binary on the system. */
async function findLlamaServer(): Promise<string | null> {
  const candidates = [
    'llama-server',
    'llama.cpp/server',
    '/opt/homebrew/bin/llama-server',
    '/usr/local/bin/llama-server',
    // Homebrew on Apple Silicon
    '/opt/homebrew/opt/llama.cpp/bin/llama-server',
  ];

  for (const candidate of candidates) {
    try {
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);
      await execAsync(`which ${candidate} 2>/dev/null || command -v ${candidate} 2>/dev/null`);
      return candidate;
    } catch { /* not found */ }
  }

  return null;
}

/** Singleton server manager. */
let defaultManager: LlamaServerManager | null = null;

/** Get or create the default llama-server manager. */
export function getLlamaServerManager(
  modelFilename?: string,
  config?: Partial<LlamaServerConfig>,
): LlamaServerManager {
  if (!defaultManager) {
    const filename = modelFilename ?? BUILTIN_MODELS[0].filename;
    defaultManager = new LlamaServerManager(filename, config);
  }
  return defaultManager;
}
