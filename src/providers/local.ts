import OpenAI from 'openai';
import { OpenAICompatProvider } from './openai-compat.js';
import { getLlamaServerManager, type LlamaServerConfig } from '../models/llama-server.js';
import type { LLMMessage, ChatResponse, ProviderOptions, StreamChunk } from './base.js';
import type { ToolDefinition } from '../tools/definitions.js';

/**
 * Local model provider — wraps a llama.cpp server instance.
 * The server exposes an OpenAI-compatible API, so this provider
 * extends OpenAICompatProvider with auto-start logic.
 */
export class LocalModelProvider extends OpenAICompatProvider {
  private serverManager: ReturnType<typeof getLlamaServerManager>;

  constructor(
    modelName: string,
    modelFilename: string,
    config?: Partial<LlamaServerConfig>,
  ) {
    super('Local', modelName, 'no-key', 'http://127.0.0.1:8080/v1');
    this.serverManager = getLlamaServerManager(modelFilename, config);
  }

  /** Ensure the llama-server is running before making API calls. */
  private async ensureServer(): Promise<void> {
    const state = this.serverManager.getState();
    if (state === 'running') return;
    await this.serverManager.start();
    // Update the client with the correct base URL
    (this as any).client = new OpenAI({
      apiKey: 'no-key',
      baseURL: `${this.serverManager.getBaseUrl()}/v1`,
    });
  }

  /** Override chat to ensure server is running first. */
  async chat(
    messages: LLMMessage[],
    tools?: ToolDefinition[],
    options?: ProviderOptions,
  ): Promise<ChatResponse> {
    await this.ensureServer();
    return super.chat(messages, tools, options);
  }

  /** Override stream to ensure server is running first. */
  async *stream(
    messages: LLMMessage[],
    tools?: ToolDefinition[],
    options?: ProviderOptions,
    signal?: AbortSignal,
  ): AsyncGenerator<StreamChunk, void, unknown> {
    await this.ensureServer();
    yield* super.stream(messages, tools, options, signal);
  }

  /** Stop the underlying server. */
  async stopServer(): Promise<void> {
    await this.serverManager.stop();
  }
}
