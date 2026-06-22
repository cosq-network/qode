import {
  GoogleGenerativeAI,
  GenerativeModel,
  Content,
  FunctionDeclaration,
  SchemaType,
  Tool,
} from '@google/generative-ai';
import {
  LLMProvider,
  LLMMessage,
  ChatResponse,
  ProviderOptions,
  StreamChunk,
} from './base.js';
import type { ToolDefinition } from '../tools/definitions.js';

/** Convert our ToolDefinition format to Gemini's FunctionDeclaration. */
function toGeminiFunctionDecl(tool: ToolDefinition): FunctionDeclaration {
  const params = tool.function.parameters as any;
  const properties: Record<string, any> = {};
  const required: string[] = [];

  if (params?.properties) {
    for (const [key, schema] of Object.entries<any>(params.properties)) {
      const typeMap: Record<string, SchemaType> = {
        string: SchemaType.STRING,
        number: SchemaType.NUMBER,
        integer: SchemaType.INTEGER,
        boolean: SchemaType.BOOLEAN,
        array: SchemaType.ARRAY,
        object: SchemaType.OBJECT,
      };
      properties[key] = {
        type: typeMap[schema.type] ?? SchemaType.STRING,
        description: schema.description,
      };
      if (schema.enum) properties[key].enum = schema.enum;
      if (schema.type === 'array' && schema.items) {
        properties[key].items = {
          type: typeMap[schema.items.type] ?? SchemaType.STRING,
        };
      }
    }
    if (params.required) required.push(...params.required);
  }

  return {
    name: tool.function.name,
    description: tool.function.description,
    parameters: {
      type: SchemaType.OBJECT,
      properties,
      required: required.length > 0 ? required : undefined,
    },
  };
}

/** Convert messages to Gemini content format. */
function toGeminiContents(messages: LLMMessage[]): Content[] {
  const contents: Content[] = [];

  for (const msg of messages) {
    if (msg.role === 'system') {
      // Gemini handles system instructions via systemInstruction, not as a message
      continue;
    }

    if (msg.role === 'tool') {
      // Tool results are sent as user messages with FunctionResponse parts
      const toolCallId = msg.tool_call_id;
      // Find the matching tool call name from a previous assistant message
      let toolName = msg.name ?? 'unknown';
      for (const m of messages) {
        if (m.role === 'assistant' && m.tool_calls) {
          const match = m.tool_calls.find((tc) => tc.id === toolCallId);
          if (match) {
            toolName = match.function.name;
            break;
          }
        }
      }

      let parsedResponse: object;
      try {
        parsedResponse = JSON.parse(msg.content);
      } catch {
        parsedResponse = { result: msg.content };
      }

      contents.push({
        role: 'user',
        parts: [
          {
            functionResponse: {
              name: toolName,
              response: parsedResponse,
            },
          } as any,
        ],
      });
      continue;
    }

    const role = msg.role === 'assistant' ? 'model' : 'user';
    const parts: any[] = [];

    if (msg.content) {
      parts.push({ text: msg.content });
    }

    if (msg.tool_calls && msg.tool_calls.length > 0) {
      for (const tc of msg.tool_calls) {
        let args: object;
        try {
          args = JSON.parse(tc.function.arguments);
        } catch {
          args = {};
        }
        parts.push({
          functionCall: {
            name: tc.function.name,
            args,
          },
        });
      }
    }

    if (parts.length > 0) {
      contents.push({ role, parts });
    }
  }

  return contents;
}

export class GeminiProvider extends LLMProvider {
  private model: GenerativeModel;
  private systemInstruction?: string;
  public readonly providerName = 'Google AI Studio';
  public readonly modelName: string;
  public readonly maxContextTokens: number;
  private readonly apiKey: string;

  constructor(modelName: string, apiKey: string) {
    super();
    this.modelName = modelName;
    this.apiKey = apiKey;
    // Set context limits based on model variant
    if (modelName.includes('Pro')) {
      this.maxContextTokens = 2_097_152; // Gemini 2.5 Pro: 2M tokens
    } else if (modelName.includes('Flash')) {
      this.maxContextTokens = 1_048_576; // Gemini 2.5 Flash: 1M tokens
    } else {
      this.maxContextTokens = 1_048_576; // Default: 1M tokens
    }
    const genAI = new GoogleGenerativeAI(apiKey);
    this.model = genAI.getGenerativeModel({ model: modelName });
  }

  async chat(
    messages: LLMMessage[],
    tools?: ToolDefinition[],
    options?: ProviderOptions,
  ): Promise<ChatResponse> {
    // Extract system messages
    const systemMessages = messages.filter((m) => m.role === 'system');
    const nonSystemMessages = messages.filter((m) => m.role !== 'system');
    this.systemInstruction = systemMessages.map((m) => m.content).join('\n\n') || undefined;

    // Convert tools to Gemini format
    const geminiTools: Tool[] | undefined = tools && tools.length > 0
      ? [{ functionDeclarations: tools.map(toGeminiFunctionDecl) }]
      : undefined;

    // Reinitialize model with tools and system instruction
    const genAI = new GoogleGenerativeAI(this.apiKey);
    this.model = genAI.getGenerativeModel({
      model: this.modelName,
      tools: geminiTools,
      systemInstruction: this.systemInstruction,
    });

    const contents = toGeminiContents(nonSystemMessages);

    // Use generateContent for the latest user message
    const lastUserMsg = nonSystemMessages.filter((m) => m.role === 'user').pop();
    if (!lastUserMsg) {
      return { message: { role: 'assistant', content: '' } };
    }

    // Build generation config
    const genConfig: any = {};
    if (options?.temperature !== undefined) genConfig.temperature = options.temperature;
    if (options?.maxTokens !== undefined) genConfig.maxOutputTokens = options.maxTokens;
    if (options?.topP !== undefined) genConfig.topP = options.topP;
    if (options?.stopSequences !== undefined) genConfig.stopSequences = options.stopSequences;

    const result = await this.model.generateContent({
      contents,
      generationConfig: genConfig,
    });

    const response = result.response;
    const text = response.text();
    const functionCalls = response.functionCalls();

    // Build assistant message
    const assistantMessage: LLMMessage = { role: 'assistant', content: text || '' };

    if (functionCalls && functionCalls.length > 0) {
      assistantMessage.tool_calls = functionCalls.map((fc, i) => ({
        id: `gemini-${Date.now()}-${i}`,
        type: 'function' as const,
        function: {
          name: fc.name,
          arguments: JSON.stringify(fc.args),
        },
      }));
    }

    const usage = (response as any).usageMetadata;

    return {
      message: assistantMessage,
      usage: usage
        ? {
            promptTokens: usage.promptTokenCount ?? 0,
            completionTokens: usage.candidatesTokenCount ?? 0,
            totalTokens: usage.totalTokenCount ?? 0,
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
    this.systemInstruction = systemMessages.map((m) => m.content).join('\n\n') || undefined;

    const geminiTools: Tool[] | undefined = tools && tools.length > 0
      ? [{ functionDeclarations: tools.map(toGeminiFunctionDecl) }]
      : undefined;

    const genAI = new GoogleGenerativeAI(this.apiKey);
    this.model = genAI.getGenerativeModel({
      model: this.modelName,
      tools: geminiTools,
      systemInstruction: this.systemInstruction,
    });

    const contents = toGeminiContents(nonSystemMessages);

    const genConfig: any = {};
    if (options?.temperature !== undefined) genConfig.temperature = options.temperature;
    if (options?.maxTokens !== undefined) genConfig.maxOutputTokens = options.maxTokens;
    if (options?.topP !== undefined) genConfig.topP = options.topP;
    if (options?.stopSequences !== undefined) genConfig.stopSequences = options.stopSequences;

    const streamResult = await this.model.generateContentStream({
      contents,
      generationConfig: genConfig,
    });

    let totalText = '';
    const toolCallAccumulators: Map<number, { name: string; args: object }> = new Map();

    for await (const chunk of streamResult.stream) {
      // Text content
      const text = chunk.text();
      if (text) {
        totalText += text;
        yield { type: 'text', content: text };
      }

      // Tool calls
      const fcs = chunk.functionCalls();
      if (fcs && fcs.length > 0) {
        for (const fc of fcs) {
          const idx = toolCallAccumulators.size;
          toolCallAccumulators.set(idx, { name: fc.name, args: fc.args });
          yield { type: 'tool_call_start', toolCallIndex: idx };
        }
      }

      // Usage metadata (last chunk)
      const usage = (chunk as any).usageMetadata;
      if (usage && usage.totalTokenCount > 0) {
        yield {
          type: 'done',
          usage: {
            promptTokens: usage.promptTokenCount ?? 0,
            completionTokens: usage.candidatesTokenCount ?? 0,
            totalTokens: usage.totalTokenCount ?? 0,
          },
        };
      }
    }

    // Emit completed tool calls
    for (const [idx, acc] of toolCallAccumulators) {
      yield {
        type: 'tool_call',
        toolCall: {
          id: `gemini-${Date.now()}-${idx}`,
          type: 'function',
          function: { name: acc.name, arguments: JSON.stringify(acc.args) },
        },
        toolCallIndex: idx,
      };
    }

    // If no usage was emitted, yield done
    if (toolCallAccumulators.size === 0 && !totalText) {
      yield { type: 'done' };
    }
  }

  countTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }
}
