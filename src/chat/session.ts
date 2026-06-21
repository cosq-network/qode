import { LLMMessage, LLMProvider } from '../providers/base.js';
import { loadConfig } from '../config.js';

export class Session {
  public id: string;
  public messages: LLMMessage[] = [];
  public modelName: string;
  public provider: LLMProvider;
  public createdAt: string;
  public lastAccessed: string;
  private systemPrompt: string;

  constructor(
    id: string,
    provider: LLMProvider,
    systemPrompt: string = 'You are a helpful coding assistant with access to shell and file tools. Use them to help the user.',
    messages?: LLMMessage[]
  ) {
    this.id = id;
    this.provider = provider;
    this.modelName = provider.modelName;
    this.systemPrompt = systemPrompt;
    this.messages = messages ?? [{ role: 'system', content: systemPrompt }];
    this.createdAt = new Date().toISOString();
    this.lastAccessed = this.createdAt;
  }

  async compressIfNeeded(): Promise<void> {
    const config = await loadConfig();
    if (!config.autoCompress) return;

    const totalTokens = this.messages.reduce((sum, m) => sum + this.provider.countTokens(m.content ?? ''), 0);
    const limit = Math.floor(this.provider.maxContextTokens * config.compressThreshold);

    if (totalTokens <= limit) return;

    console.log('⟳ Context approaching limit – compressing older messages...');
    // Keep system prompt and last 4 messages, summarize the rest
    const systemMsg = this.messages[0];
    const recent = this.messages.slice(-4);
    const toSummarize = this.messages.slice(1, -4);

    // Use the provider itself to generate a summary
    const summaryPrompt = `Summarize the following conversation in a concise way that captures all important details, decisions, and code snippets. This summary will replace the full conversation history to save context space.
Conversation:
${toSummarize.map(m => `${m.role}: ${m.content}`).join('\n')}
Summary:`;

    const summaryResponse = await this.provider.chat([{ role: 'user', content: summaryPrompt }]);
    const summaryContent = summaryResponse.message.content ?? 'No summary generated.';

    // Replace messages with system + summary + recent
    this.messages = [
      systemMsg,
      { role: 'system', content: `[Previous conversation summary]: ${summaryContent}` },
      ...recent,
    ];
    console.log('✔ Compression complete.');
  }

  addMessage(msg: LLMMessage) {
    this.messages.push(msg);
    this.lastAccessed = new Date().toISOString();
  }

  toJSON() {
    return {
      id: this.id,
      modelName: this.modelName,
      messages: this.messages,
      createdAt: this.createdAt,
      lastAccessed: this.lastAccessed,
    };
  }
}