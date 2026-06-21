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
  usage?: { promptTokens: number; completionTokens: number; totalTokens: number };
}

export abstract class LLMProvider {
  abstract readonly providerName: string;
  abstract readonly modelName: string;
  abstract readonly maxContextTokens: number;

  abstract chat(messages: LLMMessage[], tools?: ToolDefinition[]): Promise<ChatResponse>;

  abstract countTokens(text: string): number;
}