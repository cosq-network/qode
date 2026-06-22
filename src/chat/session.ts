import { LLMMessage, LLMProvider } from '../providers/base.js';
import { loadConfig } from '../config.js';
import { logger } from '../utils/logger.js';
import type { CompressionConfig } from '../config.js';
import type { AgentMode, Plan, PlanStep } from '../config.js';

/** Importance level for messages — higher = more likely to be preserved. */
export type Importance = 'critical' | 'high' | 'normal' | 'low';

/** A record of a compression event. */
export interface CompressionEvent {
  timestamp: string;
  messagesBefore: number;
  messagesAfter: number;
  tokensBefore: number;
  tokensAfter: number;
}

/** Default compression settings. */
const DEFAULT_COMPRESSION: CompressionConfig = {
  keepMessages: 4,
  keepSystem: true,
  pruneAfterMessages: 20,
  pruneMaxChars: 120,
};

/** Plan mode system prompt suffix. */
const PLAN_MODE_SUFFIX = `

You are in PLAN MODE. You can analyze code, read files, search, and create plans.
You CANNOT make any file edits or execute shell commands.
When asked to implement something, provide a detailed plan with:
1. Files to create/modify
2. Exact changes needed
3. Order of operations
4. Potential risks or considerations
Use the todowrite tool to track plan progress.`;

export class Session {
  public id: string;
  public messages: LLMMessage[] = [];
  public modelName: string;
  public provider!: LLMProvider;
  public createdAt: string;
  public lastAccessed: string;
  public systemPrompt: string;
  public compressionHistory: CompressionEvent[] = [];
  public mode: AgentMode = 'build';
  public activePlan: Plan | null = null;
  private compressionConfig: CompressionConfig;

  constructor(
    id: string,
    modelName: string,
    systemPrompt: string = 'You are a helpful coding assistant with access to shell and file tools. Use them to help the user.',
    messages?: LLMMessage[],
  ) {
    this.id = id;
    this.modelName = modelName;
    this.systemPrompt = systemPrompt;
    this.messages = messages ?? [{ role: 'system', content: systemPrompt }];
    this.createdAt = new Date().toISOString();
    this.lastAccessed = this.createdAt;
    this.compressionConfig = DEFAULT_COMPRESSION;
  }

  /** Get the effective system prompt based on current mode. */
  getEffectiveSystemPrompt(): string {
    if (this.mode === 'plan') {
      return `${this.systemPrompt}${PLAN_MODE_SUFFIX}`;
    }
    return this.systemPrompt;
  }

  /** Switch to a new mode and update the system prompt. */
  setMode(newMode: AgentMode): void {
    this.mode = newMode;
    // Update the first message (system prompt) with mode-appropriate content
    if (this.messages.length > 0 && this.messages[0].role === 'system') {
      this.messages[0].content = this.getEffectiveSystemPrompt();
    }
  }

  /** Create a new plan with the given steps. */
  createPlan(stepDescriptions: string[]): Plan {
    this.activePlan = {
      steps: stepDescriptions.map((desc, i) => ({
        id: `step-${i + 1}`,
        description: desc,
        status: 'pending' as const,
      })),
      createdAt: new Date().toISOString(),
    };
    return this.activePlan;
  }

  /** Update a plan step's status. */
  updateStepStatus(stepId: string, status: PlanStep['status']): void {
    if (!this.activePlan) return;
    const step = this.activePlan.steps.find((s) => s.id === stepId);
    if (step) {
      step.status = status;
    }
    // Check if all steps completed
    if (this.activePlan.steps.every((s) => s.status === 'completed' || s.status === 'cancelled')) {
      this.activePlan.completedAt = new Date().toISOString();
    }
  }

  /** Get plan progress summary (e.g., "Step 3/7"). */
  getPlanProgress(): string | null {
    if (!this.activePlan || this.activePlan.steps.length === 0) return null;
    const completed = this.activePlan.steps.filter((s) => s.status === 'completed').length;
    const total = this.activePlan.steps.length;
    const current = this.activePlan.steps.find((s) => s.status === 'in_progress');
    const currentDesc = current ? `: ${current.description}` : '';
    return `Step ${completed + 1}/${total}${currentDesc}`;
  }

  /** Get plan progress percentage. */
  getPlanPercentage(): number {
    if (!this.activePlan || this.activePlan.steps.length === 0) return 0;
    const completed = this.activePlan.steps.filter((s) => s.status === 'completed').length;
    return Math.round((completed / this.activePlan.steps.length) * 100);
  }

  /** Clear the active plan. */
  clearPlan(): void {
    this.activePlan = null;
  }

  /** Export plan as markdown. */
  exportPlanAsMarkdown(): string {
    if (!this.activePlan) return 'No active plan.';
    const lines: string[] = ['# Plan', '', `Created: ${this.activePlan.createdAt}`, ''];
    for (const step of this.activePlan.steps) {
      const icon = step.status === 'completed' ? '[x]' : step.status === 'cancelled' ? '[-]' : '[ ]';
      lines.push(`${icon} ${step.description}`);
      if (step.files && step.files.length > 0) {
        lines.push(`  Files: ${step.files.join(', ')}`);
      }
    }
    if (this.activePlan.completedAt) {
      lines.push('', `Completed: ${this.activePlan.completedAt}`);
    }
    return lines.join('\n');
  }

  /** Load compression settings from config. Call once after construction. */
  async loadCompressionConfig(): Promise<void> {
    const config = await loadConfig();
    this.compressionConfig = { ...DEFAULT_COMPRESSION, ...config.compression };
  }

  /** Score a message's importance for preservation during compression. */
  getImportance(msg: LLMMessage, index: number): Importance {
    // System prompt is always critical
    if (msg.role === 'system' && index === 0) return 'critical';

    // Tool results are low importance (prunable)
    if (msg.role === 'tool') return 'low';

    // Messages containing code blocks are high importance
    if (msg.content && (msg.content.includes('```') || msg.content.includes('`import`') || msg.content.includes('`const`'))) {
      return 'high';
    }

    // Messages with tool calls are high importance (they drove actions)
    if (msg.tool_calls && msg.tool_calls.length > 0) return 'high';

    // User messages are normal, assistant messages with substantial content are normal
    if (msg.role === 'user') return 'normal';
    if (msg.role === 'assistant' && msg.content && msg.content.length > 100) return 'normal';

    return 'normal';
  }

  /** Prune old tool outputs to save context space. */
  pruneToolOutputs(): number {
    const { keepMessages } = this.compressionConfig;
    const cutoff = this.messages.length - keepMessages;
    let pruned = 0;

    for (let i = 1; i < cutoff; i++) {
      const msg = this.messages[i];
      if (msg.role === 'tool' && msg.content && msg.content.length > this.compressionConfig.pruneMaxChars) {
        const original = msg.content;
        msg.content = `[Tool output pruned — was ${original.length} chars]`;
        pruned++;
      }
    }

    if (pruned > 0) {
      logger.info(`✂ Pruned ${pruned} old tool output(s).`);
    }
    return pruned;
  }

  /** Get the number of tokens in the current message history. */
  getTokenCount(): number {
    if (!this.provider) return 0;
    return this.messages.reduce((sum, m) => sum + this.provider.countTokens(m.content ?? ''), 0);
  }

  /** Compress context if approaching token limit. Uses incremental summarization.
   *  @param forceThreshold - Optional override for compressThreshold (0-1). If provided, skips config load. */
  async compressIfNeeded(forceThreshold?: number): Promise<void> {
    let threshold: number;
    let autoCompress: boolean;

    if (forceThreshold !== undefined) {
      // Forced compression mode — skip config load
      threshold = forceThreshold;
      autoCompress = true;
    } else {
      const config = await loadConfig();
      autoCompress = config.autoCompress;
      threshold = config.compressThreshold;
    }

    if (!autoCompress) return;

    if (!this.provider) {
      throw new Error('Provider not set on session');
    }

    // First, prune old tool outputs
    this.pruneToolOutputs();

    const totalTokens = this.getTokenCount();
    const limit = Math.floor(this.provider.maxContextTokens * threshold);

    if (totalTokens <= limit) return;

    logger.info('⟳ Context approaching limit – compressing older messages...');

    const { keepMessages, keepSystem } = this.compressionConfig;
    const tokensBefore = totalTokens;
    const messagesBefore = this.messages.length;

    // Split messages: system, to-summarize, recent
    const systemMsg = keepSystem ? this.messages[0] : null;
    const startIdx = keepSystem ? 1 : 0;
    const recent = this.messages.slice(-keepMessages);
    const toSummarize = this.messages.slice(startIdx, -keepMessages);

    // Check if we already have a summary — incremental compression
    const existingSummaryIdx = this.messages.findIndex(
      (m) => m.role === 'system' && m.content.startsWith('[Previous conversation summary]:'),
    );

    let summaryText: string;
    if (existingSummaryIdx >= 0 && existingSummaryIdx < startIdx) {
      // Incremental: only summarize new messages since last summary
      const existingSummary = this.messages[existingSummaryIdx].content.replace(
        '[Previous conversation summary]: ',
        '',
      );
      const newMessages = toSummarize.filter(
        (_, i) => i + startIdx > existingSummaryIdx,
      );

      if (newMessages.length === 0) {
        // Nothing new to summarize
        logger.info('✔ Compression complete (no new messages to summarize).');
        return;
      }

      summaryText = await this.generateSummary(existingSummary, newMessages);
    } else {
      // Full compression
      summaryText = await this.generateSummary(undefined, toSummarize);
    }

    // Rebuild message list
    const newMessages: LLMMessage[] = [];
    if (systemMsg) newMessages.push(systemMsg);
    newMessages.push({
      role: 'system',
      content: `[Previous conversation summary]: ${summaryText}`,
    });
    newMessages.push(...recent);

    this.messages = newMessages;

    // Record compression event
    const tokensAfter = this.getTokenCount();
    this.compressionHistory.push({
      timestamp: new Date().toISOString(),
      messagesBefore,
      messagesAfter: this.messages.length,
      tokensBefore,
      tokensAfter,
    });

    logger.info(
      `✔ Compression complete: ${messagesBefore} → ${this.messages.length} messages, ` +
      `${tokensBefore} → ${tokensAfter} tokens`,
    );
  }

  /** Generate a summary of the conversation. If previousSummary is provided, do incremental summarization. */
  private async generateSummary(
    previousSummary: string | undefined,
    messages: LLMMessage[],
  ): Promise<string> {
    const conversationText = messages
      .filter((m) => m.role !== 'system')
      .map((m) => {
        const role = m.role === 'tool' ? `tool(${m.name ?? 'unknown'})` : m.role;
        const content = m.content ?? '';
        return `${role}: ${content}`;
      })
      .join('\n');

    let summaryPrompt: string;
    if (previousSummary) {
      summaryPrompt = `You are maintaining a running summary of a coding conversation.
Previous summary:
${previousSummary}

New messages to integrate:
${conversationText}

Update the summary to include all important details from the new messages.
Preserve: key decisions, file paths, code snippets, error resolutions, and current task state.
Keep the summary concise but complete. Output only the updated summary.`;
    } else {
      summaryPrompt = `Summarize the following coding conversation. Capture:
- Key decisions and their rationale
- File paths and code snippets discussed
- Error messages and how they were resolved
- Current task state and next steps
- Any important context the assistant should remember

Conversation:
${conversationText}

Concise summary:`;
    }

    const response = await this.provider.chat([{ role: 'user', content: summaryPrompt }]);
    return response.message.content ?? 'No summary generated.';
  }

  /** Manually trigger compression with a custom keep count. */
  async compressNow(keepMessages?: number): Promise<void> {
    if (keepMessages !== undefined) {
      this.compressionConfig.keepMessages = keepMessages;
    }
    // Force compression by passing threshold=0 to skip the normal threshold check
    await this.compressIfNeeded(0);
  }

  addMessage(msg: LLMMessage) {
    this.messages.push(msg);
    this.lastAccessed = new Date().toISOString();
  }

  /** Inject provider after Session creation */
  setProvider(provider: LLMProvider) {
    this.provider = provider;
    this.modelName = provider.modelName;
  }

  /** Clear the active provider when the model changes or initialization fails. */
  clearProvider() {
    (this as { provider?: LLMProvider }).provider = undefined;
  }

  toJSON() {
    return {
      id: this.id,
      modelName: this.modelName,
      messages: this.messages,
      createdAt: this.createdAt,
      lastAccessed: this.lastAccessed,
      compressionHistory: this.compressionHistory,
      mode: this.mode,
      activePlan: this.activePlan,
    };
  }
}
