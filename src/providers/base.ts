import type { ToolDefinition } from '../tools/definitions.js';

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  name?: string;
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string; // JSON string
  };
}

export interface ChatResponse {
  message: LLMMessage;
  usage?: TokenUsage;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

/** Options that can be passed to a provider to control generation behavior. */
export interface ProviderOptions {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  stopSequences?: string[];
}

/** A single chunk yielded by a streaming provider. */
export interface StreamChunk {
  type: 'text' | 'tool_call' | 'tool_call_start' | 'done' | 'error';
  /** The text content for `text` chunks. */
  content?: string;
  /** The full tool call object (available on `tool_call` chunks). */
  toolCall?: ToolCall;
  /** The index of this tool call among multiple parallel calls. */
  toolCallIndex?: number;
  /** Usage stats, available on the final `done` chunk. */
  usage?: TokenUsage;
  /** Error message for `error` chunks. */
  error?: string;
}

export abstract class LLMProvider {
  abstract readonly providerName: string;
  abstract readonly modelName: string;
  abstract readonly maxContextTokens: number;

  abstract chat(
    messages: LLMMessage[],
    tools?: ToolDefinition[],
    options?: ProviderOptions,
    signal?: AbortSignal,
  ): Promise<ChatResponse>;

  /** Streaming variant of chat. If not implemented, callers fall back to `chat()`. */
  stream?(
    messages: LLMMessage[],
    tools?: ToolDefinition[],
    options?: ProviderOptions,
    signal?: AbortSignal,
  ): AsyncGenerator<StreamChunk, void, unknown>;

  abstract countTokens(text: string): number;

  /** Count tokens for a batch of tool-calling messages. Defaults to concatenating content. */
  countToolTokens(messages: LLMMessage[]): number {
    let total = 0;
    for (const msg of messages) {
      total += this.countTokens(msg.content);
      if (msg.tool_calls) {
        for (const tc of msg.tool_calls) {
          total += this.countTokens(tc.function.arguments);
        }
      }
    }
    return total;
  }
}
