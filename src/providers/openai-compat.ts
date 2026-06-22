import OpenAI from 'openai';
import type { Stream } from 'openai/streaming';
import {
  LLMProvider,
  LLMMessage,
  ChatResponse,
  ToolCall,
  ProviderOptions,
  StreamChunk,
} from './base.js';
import type { ToolDefinition } from '../tools/definitions.js';
import { encode } from 'gpt-tokenizer';

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
    maxTokens: number = 128000,
  ) {
    super();
    this.providerName = providerName;
    this.modelName = modelName;
    this.maxContextTokens = maxTokens;
    this.client = new OpenAI({ apiKey, baseURL });
  }

  async chat(
    messages: LLMMessage[],
    tools?: ToolDefinition[],
    options?: ProviderOptions,
    signal?: AbortSignal,
  ): Promise<ChatResponse> {
    const response = await this.client.chat.completions.create({
      model: this.modelName,
      messages: messages as any,
      tools: tools as any,
      tool_choice: tools && tools.length > 0 ? 'auto' : undefined,
      temperature: options?.temperature,
      max_tokens: options?.maxTokens,
      top_p: options?.topP,
      stop: options?.stopSequences,
    }, signal ? { signal } : undefined);

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

  async *stream(
    messages: LLMMessage[],
    tools?: ToolDefinition[],
    options?: ProviderOptions,
    signal?: AbortSignal,
  ): AsyncGenerator<StreamChunk, void, unknown> {
    const response = await this.client.chat.completions.create(
      {
        model: this.modelName,
        messages: messages as any,
        tools: tools as any,
        tool_choice: tools && tools.length > 0 ? 'auto' : undefined,
        temperature: options?.temperature,
        max_tokens: options?.maxTokens,
        top_p: options?.topP,
        stop: options?.stopSequences,
        stream: true,
        stream_options: { include_usage: true },
      } as any,
      { signal },
    );
    const stream = response as unknown as Stream<OpenAI.Chat.Completions.ChatCompletionChunk>;

    // Accumulate tool calls by index
    const toolCallAccumulators: Map<
      number,
      { id: string; name: string; arguments: string }
    > = new Map();
    let emittedDone = false;

    for await (const chunk of stream) {
      const choice = chunk.choices?.[0];

      // Text content delta
      if (choice?.delta?.content) {
        yield { type: 'text', content: choice.delta.content };
      }

      // Tool call delta
      if (choice?.delta?.tool_calls) {
        for (const tc of choice.delta.tool_calls) {
          const idx = tc.index ?? 0;
          if (!toolCallAccumulators.has(idx)) {
            toolCallAccumulators.set(idx, { id: '', name: '', arguments: '' });
            yield { type: 'tool_call_start', toolCallIndex: idx };
          }
          const acc = toolCallAccumulators.get(idx)!;
          if (tc.id) acc.id = tc.id;
          if (tc.function?.name) acc.name += tc.function.name;
          if (tc.function?.arguments) acc.arguments += tc.function.arguments;
        }
      }

      // Usage chunk (stream_options.include_usage)
      if (chunk.usage) {
        emittedDone = true;
        yield {
          type: 'done',
          usage: {
            promptTokens: chunk.usage.prompt_tokens,
            completionTokens: chunk.usage.completion_tokens,
            totalTokens: chunk.usage.total_tokens,
          },
        };
      }
    }

    // Emit completed tool calls
    for (const [, acc] of toolCallAccumulators) {
      yield {
        type: 'tool_call',
        toolCall: {
          id: acc.id,
          type: 'function',
          function: { name: acc.name, arguments: acc.arguments },
        },
      };
    }

    // If no usage chunk was emitted by the API, emit a done signal
    if (!emittedDone) {
      yield { type: 'done' };
    }
  }

  countTokens(text: string): number {
    return encode(text).length;
  }
}
