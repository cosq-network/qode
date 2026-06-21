import OpenAI from 'openai';
import { LLMProvider, LLMMessage, ChatResponse, ToolCall } from './base.js';
import { encode } from 'gpt-tokenizer'; // or tiktoken

export class OpenAICompatProvider extends LLMProvider {
  private client: OpenAI;
  public readonly providerName: string;
  public readonly modelName: string;
  public readonly maxContextTokens: number;

  constructor(
    providerName: string,
    modelName: string,
    apiKey: string,
    baseURL: string,
    maxTokens: number = 128000
  ) {
    super();
    this.providerName = providerName;
    this.modelName = modelName;
    this.maxContextTokens = maxTokens;
    this.client = new OpenAI({ apiKey, baseURL });
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
      tool_calls: choice.message.tool_calls as ToolCall[] | undefined,
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
    return encode(text).length;
  }
}