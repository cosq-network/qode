import type { LLMMessage, ChatResponse, ToolCall, ProviderOptions, StreamChunk } from './base.js';
import { LLMProvider } from './base.js';
import type { ToolDefinition } from '../tools/definitions.js';
import Anthropic from '@anthropic-ai/sdk';

/** Convert our ToolDefinition to Anthropic's Tool format. */
function toAnthropicTool(tool: ToolDefinition): Anthropic.Beta.Tools.Tool {
  return {
    name: tool.function.name,
    description: tool.function.description,
    input_schema: {
      type: 'object' as const,
      properties: (tool.function.parameters as any)?.properties ?? {},
      required: (tool.function.parameters as any)?.required ?? [],
    },
  };
}

/** Convert our messages to Anthropic's message format. */
function toAnthropicMessages(messages: LLMMessage[]): Anthropic.Beta.Tools.ToolsBetaMessageParam[] {
  const anthropicMessages: Anthropic.Beta.Tools.ToolsBetaMessageParam[] = [];

  for (const msg of messages) {
    if (msg.role === 'system') continue;

    if (msg.role === 'tool') {
      // Tool results are sent as user messages with ToolResultBlockParam
      const content: Anthropic.Beta.Tools.ToolResultBlockParam = {
        type: 'tool_result' as const,
        tool_use_id: msg.tool_call_id ?? '',
        content: [{ type: 'text', text: msg.content }],
      };
      anthropicMessages.push({ role: 'user', content: [content] });
      continue;
    }

    const content: Array<any> = [];

    if (msg.content) {
      content.push({ type: 'text', text: msg.content });
    }

    if (msg.tool_calls && msg.tool_calls.length > 0) {
      for (const tc of msg.tool_calls) {
        let input: object;
        try {
          input = JSON.parse(tc.function.arguments);
        } catch {
          input = {};
        }
        content.push({
          type: 'tool_use',
          id: tc.id,
          name: tc.function.name,
          input,
        });
      }
    }

    if (content.length > 0) {
      anthropicMessages.push({ role: msg.role as 'user' | 'assistant', content });
    }
  }

  return anthropicMessages;
}

export class AnthropicProvider extends LLMProvider {
  readonly providerName = 'Anthropic';
  readonly modelName: string;
  readonly maxContextTokens: number;
  private client: Anthropic;
  private maxTokens: number;

  constructor(modelName: string, maxContextTokens: number = 200_000, apiKey?: string) {
    super();
    this.modelName = modelName;
    this.maxContextTokens = maxContextTokens;
    this.maxTokens = 8192;
    this.client = new Anthropic({ apiKey: apiKey ?? process.env.ANTHROPIC_API_KEY });
  }

  async chat(
    messages: LLMMessage[],
    tools?: ToolDefinition[],
    options?: ProviderOptions,
  ): Promise<ChatResponse> {
    const systemMessages = messages.filter((m) => m.role === 'system');
    const nonSystemMessages = messages.filter((m) => m.role !== 'system');
    const systemPrompt = systemMessages.map((m) => m.content).join('\n\n') || undefined;

    const anthropicMessages = toAnthropicMessages(nonSystemMessages);
    const anthropicTools = tools?.map(toAnthropicTool);

    const maxTokens = options?.maxTokens ?? this.maxTokens;

    const response = await (this.client.beta.tools.messages as any).create({
      model: this.modelName,
      max_tokens: maxTokens,
      messages: anthropicMessages,
      system: systemPrompt,
      tools: anthropicTools,
      temperature: options?.temperature,
      top_p: options?.topP,
      stop_sequences: options?.stopSequences,
    });

    // Parse response content blocks
    let textContent = '';
    const toolCalls: ToolCall[] = [];

    for (const block of response.content) {
      if (block.type === 'text') {
        textContent += block.text;
      } else if (block.type === 'tool_use') {
        toolCalls.push({
          id: block.id,
          type: 'function',
          function: {
            name: block.name,
            arguments: JSON.stringify(block.input),
          },
        });
      }
    }

    const assistantMessage: LLMMessage = {
      role: 'assistant',
      content: textContent,
      tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
    };

    return {
      message: assistantMessage,
      usage: response.usage
        ? {
            promptTokens: response.usage.input_tokens ?? 0,
            completionTokens: response.usage.output_tokens ?? 0,
            totalTokens: (response.usage.input_tokens ?? 0) + (response.usage.output_tokens ?? 0),
          }
        : undefined,
    };
  }

  async *stream(
    messages: LLMMessage[],
    tools?: ToolDefinition[],
    options?: ProviderOptions,
    _signal?: AbortSignal,
  ): AsyncGenerator<StreamChunk, void, unknown> {
    const systemMessages = messages.filter((m) => m.role === 'system');
    const nonSystemMessages = messages.filter((m) => m.role !== 'system');
    const systemPrompt = systemMessages.map((m) => m.content).join('\n\n') || undefined;

    const anthropicMessages = toAnthropicMessages(nonSystemMessages);
    const anthropicTools = tools?.map(toAnthropicTool);
    const maxTokens = options?.maxTokens ?? this.maxTokens;

    const stream = await (this.client.beta.tools.messages as any).stream({
      model: this.modelName,
      max_tokens: maxTokens,
      messages: anthropicMessages,
      system: systemPrompt,
      tools: anthropicTools,
      temperature: options?.temperature,
      top_p: options?.topP,
      stop_sequences: options?.stopSequences,
    });

    // Accumulate tool calls by id
    const toolCallAccumulators: Map<
      string,
      { id: string; name: string; input: string }
    > = new Map();
    let emittedDone = false;

    for await (const event of stream) {
      if (event.type === 'content_block_start') {
        if (event.content_block.type === 'tool_use') {
          toolCallAccumulators.set(event.index, {
            id: event.content_block.id,
            name: event.content_block.name,
            input: '',
          });
          yield { type: 'tool_call_start', toolCallIndex: event.index };
        }
      } else if (event.type === 'content_block_delta') {
        if (event.delta.type === 'text_delta') {
          yield { type: 'text', content: event.delta.text };
        }
      } else if (event.type === 'message_delta') {
        const usage = event.usage;
        if (usage) {
          emittedDone = true;
          yield {
            type: 'done',
            usage: {
              promptTokens: 0, // Anthropic doesn't report prompt tokens in streaming delta
              completionTokens: usage.output_tokens ?? 0,
              totalTokens: usage.output_tokens ?? 0,
            },
          };
        }
      }
    }

    // Emit completed tool calls
    let idx = 0;
    for (const [, acc] of toolCallAccumulators) {
      yield {
        type: 'tool_call',
        toolCall: {
          id: acc.id,
          type: 'function',
          function: { name: acc.name, arguments: acc.input || '{}' },
        },
        toolCallIndex: idx++,
      };
    }

    if (!emittedDone) {
      yield { type: 'done' };
    }
  }

  countTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }
}
