import { GoogleGenerativeAI, GenerativeModel, Content } from '@google/generative-ai';
import { LLMProvider, LLMMessage, ChatResponse } from './base.js';

function toGeminiRole(role: string): string {
  if (role === 'assistant') return 'model';
  if (role === 'tool') return 'user'; // Gemini treats tool results as user
  return role;
}

export class GeminiProvider extends LLMProvider {
  private model: GenerativeModel;
  public readonly providerName = 'Google AI Studio';
  public readonly modelName: string;
  public readonly maxContextTokens: number;

  constructor(modelName: string, apiKey: string) {
    super();
    this.modelName = modelName;
    // Known token limits for Gemini models
    this.maxContextTokens = modelName.includes('Pro') ? 1_048_576 : 1_048_576;
    const genAI = new GoogleGenerativeAI(apiKey);
    this.model = genAI.getGenerativeModel({ model: modelName });
  }

  async chat(messages: LLMMessage[]): Promise<ChatResponse> {
    // Convert messages to Gemini history
    const history: Content[] = messages.map((m) => ({
      role: toGeminiRole(m.role),
      parts: [{ text: m.content }],
    }));

    const chat = this.model.startChat({ history });
    // Simple text generation (no native tool calls in this example – can be extended)
    const result = await chat.sendMessage(messages[messages.length - 1].content);
    const text = result.response.text();

    return {
      message: { role: 'assistant', content: text },
      usage: {
        promptTokens: 0, // Gemini doesn't expose usage easily in this SDK
        completionTokens: 0,
        totalTokens: 0,
      },
    };
  }

  countTokens(text: string): number {
    // Approximate: 1 token ≈ 4 chars for Gemini (very rough)
    return Math.ceil(text.length / 4);
  }
}