import type { LLMMessage, ChatResponse } from './base.js';
import { LLMProvider } from './base.js';
import Anthropic from '@anthropic-ai/sdk';

export class AnthropicProvider extends LLMProvider {
  readonly providerName = 'Anthropic';
  readonly modelName: string;
  readonly maxContextTokens: number;
  private client: Anthropic;

  constructor(modelName: string, maxContextTokens: number = 200_000) {
    super();
    this.modelName = modelName;
    this.maxContextTokens = maxContextTokens;
    this.client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }

  async chat(messages: LLMMessage[], tools?: any[]): Promise<ChatResponse> {
    const anthropicMessages = messages.map((msg) => ({ role: msg.role, content: msg.content }));
    const response = await this.client.messages.create({
      model: this.modelName,
      max_tokens: 1024,
      messages: anthropicMessages as any,
    });
    const chatResponse: ChatResponse = {
      message: {
        role: 'assistant',
        content: typeof response.content === 'string' ? response.content : JSON.stringify(response.content),
      },
      usage: {
        promptTokens: (response as any).usage?.input_tokens ?? 0,
        completionTokens: (response as any).usage?.output_tokens ?? 0,
        totalTokens: ((response as any).usage?.input_tokens ?? 0) + ((response as any).usage?.output_tokens ?? 0),
      },
    };
    return chatResponse;
  }

  countTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }
}
