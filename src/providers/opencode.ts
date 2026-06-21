import OpenAI from 'openai';
import { LLMProvider, LLMMessage, ChatResponse } from './base.js';

/**
 * OpenCode provider – wraps the OpenCode Zen API which follows the OpenAI completions schema.
 * The API is reachable at https://opencode.ai/zen/v1 and accepts an API key via the `Authorization`
 * header (`Bearer <key>`). The provider implements the generic LLMProvider contract used by Qode.
 */
export class OpenCodeProvider extends LLMProvider {
  private client: OpenAI;
  public readonly providerName: string = 'OpenCode';
  public readonly modelName: string;
  public readonly maxContextTokens: number;

  constructor(modelName: string, apiKey: string) {
    super();
    this.modelName = modelName;
    // OpenCode Zen uses the same request/response shape as OpenAI's chat completions.
    // The base URL is the Zen endpoint.
    this.client = new OpenAI({ apiKey, baseURL: 'https://opencode.ai/zen/v1' });
    // All free OpenCode models advertise a 200k context window.
    this.maxContextTokens = 200_000;
  }

  async chat(messages: LLMMessage[], tools?: any[]): Promise<ChatResponse> {
    const response = await this.client.chat.completions.create({
      model: this.modelName,
      messages: messages as any,
      tools,
      tool_choice: tools ? 'auto' : undefined,
    });

    const choice = response.choices[0];
    const assistantMessage: LLMMessage = {
      role: 'assistant',
      content: choice.message.content ?? '',
      tool_calls: choice.message.tool_calls as any,
    };

    return {
      message: assistantMessage,
      usage: response.usage
        ? {
            promptTokens: response.usage.prompt_tokens,
            completionTokens: response.usage.completion_tokens,
            totalTokens: response.usage.total_tokens,
          }
        : undefined,
    };
  }

  countTokens(text: string): number {
    // Approximate token count using OpenAI tokenizer.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { encode } = require('gpt-tokenizer');
    return encode(text).length;
  }
}
