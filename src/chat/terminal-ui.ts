import blessed from 'blessed';
import chalk from 'chalk';
import stripAnsi from 'strip-ansi';
import { setOutputSink, type OutputEntry } from '../utils/output.js';
import type { CompletionContext, CompletionItem } from './completion.js';
export interface ChatUIState {
  cwd: string;
  modelName: string;
  providerName: string;
  mode: string;
  tokenUsage: string;
  recentFiles: string;
  suggestion: string;
}

export class TerminalChatUI {
  private static readonly PANEL_MARGIN_X = 2;
  private static readonly PANEL_MARGIN_Y = 1;
  private static readonly PANEL_GAP_Y = 1;
  private static readonly PANEL_PADDING = 1;
  private screen: blessed.Widgets.Screen;
  private headerBox: blessed.Widgets.BoxElement;
  private transcriptBox: blessed.Widgets.BoxElement;
  private suggestionBox: blessed.Widgets.BoxElement;
  private inputBox: blessed.Widgets.TextboxElement;
  private inputLayout = { top: 0, left: 0, width: 0, height: 0 };
  private transcriptLines: string[] = [];
  private transcriptScrollOffset = 0;
  private transcriptHasUnread = false;
  private suggestions: string[] = [];
  private suggestionIndex = 0;
  private suggestionRefreshToken: NodeJS.Immediate | null = null;
  private completionState: CompletionContext | null = null;
  private inputHandler: ((value: string) => Promise<void>) | null = null;
  private inputValue = '';
  private cursor = 0;
  private history: string[] = [];
  private historyIndex = -1;
  private historyDraft = '';
  private historySearchActive = false;
  private historySearchQuery = '';
  private historySearchResults: number[] = [];
  private historySearchIndex = 0;
  private suggestionResolver: ((value: string, cursor: number) => CompletionContext | null) | null = null;
  private inputFocused = false;
  private interruptCount = 0;
  private interruptResetToken: NodeJS.Timeout | null = null;
  private escapeCancelCount = 0;
  private escapeCancelResetToken: NodeJS.Timeout | null = null;
  private taskControls: {
    isRunning?: () => boolean;
    requestCancel?: () => void;
  } = {};
  private sessionControls: {
    onToggleMode?: () => Promise<void>;
    onSave?: () => Promise<void>;
    onStatus?: () => Promise<void>;
  } = {};
  private actions: {
    onCopy?: () => Promise<void>;
    onPaste?: () => Promise<void>;
    onBrowser?: () => Promise<void>;
  } = {};

  constructor() {
    this.screen = blessed.screen({
      smartCSR: true,
      dockBorders: true,
      fullUnicode: true,
      warnings: false,
    });

    this.headerBox = blessed.box({
      top: 0,
      left: 0,
      width: '100%',
      height: 5,
      tags: false,
      border: { type: 'line' },
      padding: TerminalChatUI.PANEL_PADDING,
      style: { border: { fg: 'cyan' } },
      content: '',
    });

    this.transcriptBox = blessed.box({
      top: 5,
      left: 0,
      width: '100%',
      bottom: 8,
      tags: false,
      border: { type: 'line' },
      padding: TerminalChatUI.PANEL_PADDING,
      style: { border: { fg: 'blue' } },
      content: '',
    });

    this.suggestionBox = blessed.box({
      bottom: 3,
      left: 0,
      width: '100%',
      height: 3,
      tags: false,
      border: { type: 'line' },
      padding: TerminalChatUI.PANEL_PADDING,
      style: { border: { fg: 'magenta' } },
      content: '',
    });

    this.inputBox = blessed.textbox({
      bottom: 0,
      left: 0,
      width: '100%',
      height: 4,
      tags: false,
      border: { type: 'line' },
      padding: TerminalChatUI.PANEL_PADDING,
      keys: false,
      mouse: true,
      vi: true,
      inputOnFocus: false,
      style: { border: { fg: 'green' } },
      content: '',
    });

    this.screen.append(this.headerBox);
    this.screen.append(this.transcriptBox);
    this.screen.append(this.suggestionBox);
    this.screen.append(this.inputBox);

    this.screen.key(['C-k'], () => void this.actions.onCopy?.());
    this.screen.key(['C-g'], () => void this.actions.onPaste?.());
    this.screen.key(['C-f'], () => void this.actions.onBrowser?.());
    this.screen.key(['f2'], () => void this.sessionControls.onToggleMode?.());
    this.screen.key(['f3'], () => void this.sessionControls.onSave?.());
    this.screen.key(['f4'], () => void this.sessionControls.onStatus?.());
    this.screen.key(['pageup'], () => this.scrollTranscript(-1));
    this.screen.key(['pagedown'], () => this.scrollTranscript(1));
    this.screen.key(['resize'], () => this.renderAll());

    this.inputBox.on('keypress', (ch, key) => {
      if (!this.inputFocused) {
        return;
      }
      if (this.handleEditorKey(ch, key)) {
        return;
      }
      this.queueSuggestionRefresh();
    });

    setOutputSink((entry) => this.handleOutput(entry));
  }

  public focus(): void {
    this.inputFocused = true;
    this.inputBox.focus();
    this.screen.program.showCursor();
    this.renderAll();
  }

  public onSubmit(handler: (value: string) => Promise<void>): void {
    this.inputHandler = handler;
  }

  public setSuggestionResolver(resolver: (value: string, cursor: number) => CompletionContext | null): void {
    this.suggestionResolver = resolver;
  }

  public setSessionControls(controls: {
    onToggleMode?: () => Promise<void>;
    onSave?: () => Promise<void>;
    onStatus?: () => Promise<void>;
  }): void {
    this.sessionControls = controls;
  }

  public setTaskControls(controls: {
    isRunning?: () => boolean;
    requestCancel?: () => void;
  }): void {
    this.taskControls = controls;
  }

  public setActions(actions: {
    onCopy?: () => Promise<void>;
    onPaste?: () => Promise<void>;
    onBrowser?: () => Promise<void>;
  }): void {
    this.actions = actions;
  }

  public setState(state: ChatUIState): void {
    const lines = [
      chalk.bold.cyan('Qode CLI'),
      chalk.gray(`${state.cwd}`),
      `${chalk.cyan('Model:')} ${state.modelName} ${chalk.gray(`(${state.providerName})`)} ${state.mode === 'plan' ? chalk.yellow('[PLAN]') : chalk.green('[BUILD]')}`,
      `${chalk.cyan('Tokens:')} ${state.tokenUsage} ${chalk.gray('Recent:')} ${state.recentFiles}`,
      chalk.gray('F2 mode  F3 save  F4 status  Ctrl+R history search'),
    ];
    this.headerBox.setContent(lines.join('\n'));
    if (state.suggestion) {
      this.suggestions = [state.suggestion];
      this.suggestionIndex = 0;
    }
    this.renderAll();
  }

  public appendLine(line: string): void {
    if (!line.trim()) return;
    this.transcriptLines.push(line);
    if (this.transcriptLines.length > 300) {
      this.transcriptLines = this.transcriptLines.slice(-300);
    }
    if (this.transcriptScrollOffset === 0) {
      this.scrollTranscriptToEnd();
    } else {
      this.transcriptHasUnread = true;
    }
    this.renderAll();
  }

  public appendRaw(text: string): void {
    const lines = text.split(/\r?\n/).filter(Boolean);
    for (const line of lines) {
      this.appendLine(line);
    }
  }

  public setSuggestion(text: string): void {
    this.suggestions = text ? [text] : [];
    this.suggestionIndex = 0;
    this.renderAll();
  }

  public recordHistory(value: string): void {
    const normalized = value.trim();
    if (!normalized) return;
    if (this.history[this.history.length - 1] === normalized) return;
    this.history.push(normalized);
    if (this.history.length > 200) {
      this.history = this.history.slice(-200);
    }
    this.historyIndex = -1;
  }

  public getInputValue(): string {
    return this.inputValue;
  }

  public clearInput(): void {
    this.inputValue = '';
    this.cursor = 0;
    this.suggestions = [];
    this.suggestionIndex = 0;
    this.completionState = null;
    this.historyIndex = -1;
    this.historyDraft = '';
    this.clearHistorySearch();
    this.clearEscapeCancelState();
    this.renderAll();
  }

  public close(): void {
    this.inputFocused = false;
    this.clearInterruptState();
    this.clearEscapeCancelState();
    if (this.suggestionRefreshToken) {
      clearImmediate(this.suggestionRefreshToken);
      this.suggestionRefreshToken = null;
    }
    setOutputSink(null);
    this.screen.program.hideCursor();
    this.screen.destroy();
  }

  private renderAll(): void {
    this.updateLayout();
    this.renderTranscript();
    this.renderSuggestion();
    this.renderInput();
    this.screen.render();
    this.positionCursor();
  }

  private updateLayout(): void {
    const width = Math.max(80, Number(this.screen.width) || 80);
    const height = Math.max(24, Number(this.screen.height) || 24);

    const marginX = Math.max(1, Math.round(width * 0.03));
    const marginY = Math.max(1, Math.round(height * 0.03));
    const gapY = Math.max(1, Math.round(height * 0.02));
    const contentWidth = Math.max(40, width - marginX * 2);
    const availableHeight = Math.max(16, height - marginY * 2 - gapY * 3);

    const minHeights = {
      header: 6,
      transcript: 8,
      suggestion: 3,
      input: 4,
    };

    const heights = this.allocatePanelHeights(availableHeight, minHeights);

    this.applyBoxLayout(this.headerBox, marginY, marginX, contentWidth, heights.header);
    this.applyBoxLayout(this.transcriptBox, marginY + heights.header + gapY, marginX, contentWidth, heights.transcript);
    this.applyBoxLayout(
      this.suggestionBox,
      marginY + heights.header + gapY + heights.transcript + gapY,
      marginX,
      contentWidth,
      heights.suggestion,
    );
    this.applyBoxLayout(
      this.inputBox,
      marginY + heights.header + gapY + heights.transcript + gapY + heights.suggestion + gapY,
      marginX,
      contentWidth,
      heights.input,
    );
  }

  private allocatePanelHeights(
    availableHeight: number,
    minHeights: { header: number; transcript: number; suggestion: number; input: number },
  ): { header: number; transcript: number; suggestion: number; input: number } {
    const heights = { ...minHeights };
    const totalMin = heights.header + heights.transcript + heights.suggestion + heights.input;
    const weights = {
      header: 0.18,
      transcript: 0.48,
      suggestion: 0.14,
      input: 0.08,
    };

    if (availableHeight <= totalMin) {
      const scale = Math.max(0.5, availableHeight / totalMin);
      heights.header = Math.max(4, Math.floor(heights.header * scale));
      heights.transcript = Math.max(4, Math.floor(heights.transcript * scale));
      heights.suggestion = Math.max(4, Math.floor(heights.suggestion * scale));
      heights.input = Math.max(3, Math.floor(heights.input * scale));
      return heights;
    }

    let remaining = availableHeight - totalMin;
    while (remaining > 0) {
      const choices = Object.entries(weights).map(([key, weight]) => ({
        key: key as keyof typeof heights,
        score: weight / (heights[key as keyof typeof heights] - minHeights[key as keyof typeof minHeights] + 1),
      }));
      choices.sort((a, b) => b.score - a.score);
      heights[choices[0].key] += 1;
      remaining -= 1;
    }

    return heights;
  }

  private applyBoxLayout(
    box: blessed.Widgets.BoxElement,
    top: number,
    left: number,
    width: number,
    height: number,
  ): void {
    const nextTop = Math.max(0, top);
    const nextLeft = Math.max(0, left);
    const nextWidth = Math.max(20, width);
    const nextHeight = Math.max(3, height);
    if (box === this.inputBox) {
      this.inputLayout = { top: nextTop, left: nextLeft, width: nextWidth, height: nextHeight };
    }
    (box as any).top = nextTop;
    (box as any).left = nextLeft;
    (box as any).width = nextWidth;
    (box as any).height = nextHeight;
  }

  private renderTranscript(): void {
    const width = Math.max(20, this.innerWidth(this.transcriptBox));
    const height = Math.max(5, this.innerHeight(this.transcriptBox));
    const wrapped = this.wrapTranscript(width);
    const maxOffset = Math.max(0, wrapped.length - height);
    this.transcriptScrollOffset = Math.max(0, Math.min(this.transcriptScrollOffset, maxOffset));
    const start = Math.max(0, wrapped.length - height - this.transcriptScrollOffset);
    const visible = wrapped.slice(start, start + height);
    const footer = this.transcriptHasUnread
      ? chalk.yellow(`New output below · Showing ${start + 1}-${Math.min(start + height, wrapped.length)} of ${wrapped.length} lines`)
      : maxOffset > 0
        ? chalk.gray(`Showing ${start + 1}-${Math.min(start + height, wrapped.length)} of ${wrapped.length} lines`)
        : chalk.gray(' ');
    this.transcriptBox.setContent([...visible, footer].join('\n'));
  }

  private renderSuggestion(): void {
    if (this.historySearchActive) {
      const content = this.renderHistorySearchPanel();
      this.suggestionBox.setContent(content);
      return;
    }
    const label = this.completionState?.mode === 'mention'
      ? '@ mentions'
      : this.completionState?.mode === 'slash'
        ? 'Slash commands'
        : 'Suggestions';
    const content = this.suggestions.length > 0
      ? [
          chalk.gray(`${label} · ${this.suggestions.length} match${this.suggestions.length === 1 ? '' : 'es'}`),
          ...this.suggestions.slice(0, 5).map((item, index) => this.renderSuggestionLine(item, index)),
          chalk.gray('Tab accept · ↑/↓ cycle · Esc clear'),
        ].join('\n')
      : chalk.gray('Type / for commands or @ for files and subagents.');
    this.suggestionBox.setContent(content);
  }

  private queueSuggestionRefresh(): void {
    if (this.suggestionRefreshToken) {
      clearImmediate(this.suggestionRefreshToken);
    }
    this.suggestionRefreshToken = setImmediate(() => {
      this.suggestionRefreshToken = null;
      this.refreshCompletionState();
    });
  }

  private refreshCompletionState(): void {
    this.completionState = this.suggestionResolver ? this.suggestionResolver(this.inputValue, this.cursor) : null;
    this.suggestions = this.completionState?.suggestions ?? [];
    this.suggestionIndex = 0;
    this.historySearchActive = false;
    this.renderAll();
  }

  private applySuggestion(value: string): void {
    const state = this.completionState;
    if (!state) return;
    const before = this.inputValue.slice(0, state.range.start);
    const after = this.inputValue.slice(state.range.end);
    this.inputValue = `${before}${value}${after}`;
    this.cursor = before.length + value.length;
    this.refreshCompletionState();
  }

  private getSelectedSuggestion(): string {
    return this.suggestions[this.suggestionIndex] ?? this.suggestions[0] ?? '';
  }

  private renderSuggestionLine(item: string, index: number): string {
    const marker = index === this.suggestionIndex ? chalk.cyan('>') : chalk.gray(' ');
    const body = index === this.suggestionIndex ? chalk.white(this.truncate(item, 96)) : chalk.gray(this.truncate(item, 96));
    const description = this.getSelectedCompletionItem(index)?.description ?? '';
    if (!description) {
      return `${marker} ${body}`;
    }
    return `${marker} ${body} ${chalk.gray(`- ${this.truncate(description, 56)}`)}`;
  }

  private renderInput(): void {
    const prompt = chalk.cyan('> ');
    const width = Math.max(20, this.innerWidth(this.inputBox));
    const ghost = this.getGhostText();
    const content = this.historySearchActive
      ? this.formatSearchLine(width)
      : this.formatEditorLine(prompt, width, ghost);
    this.inputBox.setContent(content);
  }

  private getGhostText(): string {
    const state = this.completionState;
    if (!state || this.suggestions.length === 0) return '';
    const selected = this.getSelectedSuggestion();
    const active = this.inputValue.slice(state.range.start, state.range.end);
    const typed = this.inputValue.slice(state.range.start, this.cursor);
    if (this.cursor !== state.range.end) return '';
    if (!selected.startsWith(active)) return '';
    return selected.slice(typed.length);
  }

  private formatEditorLine(prompt: string, width: number, ghost: string): string {
    const available = Math.max(1, width - this.visibleLength(prompt));
    const ghostWidth = this.visibleLength(ghost);
    const line = this.inputValue;
    const cursor = Math.max(0, Math.min(this.cursor, line.length));
    const windowWidth = Math.max(1, available - (ghost ? ghostWidth : 0));
    const halfWindow = Math.max(4, Math.floor(windowWidth / 2));
    let start = Math.max(0, cursor - halfWindow);
    const end = Math.min(line.length, start + windowWidth);
    if (end - start < windowWidth) {
      start = Math.max(0, end - windowWidth);
    }
    const visible = line.slice(start, end);
    const cursorOffset = Math.max(0, Math.min(cursor - start, visible.length));
    const before = visible.slice(0, cursorOffset);
    const cursorChar = visible.slice(cursorOffset, cursorOffset + 1);
    const after = visible.slice(cursorOffset + 1);
    const cursorCell = chalk.inverse(cursorChar || ' ');
    const ghostSuffix = ghost ? chalk.dim(ghost) : '';
    return `${prompt}${before}${cursorCell}${after}${ghostSuffix}`;
  }

  private getEditorCursorColumn(prompt: string, width: number): number {
    const available = Math.max(1, width - this.visibleLength(prompt));
    const line = this.inputValue;
    const cursor = Math.max(0, Math.min(this.cursor, line.length));
    const windowWidth = Math.max(1, available - this.visibleLength(this.getGhostText()));
    const halfWindow = Math.max(4, Math.floor(windowWidth / 2));
    let start = Math.max(0, cursor - halfWindow);
    const end = Math.min(line.length, start + windowWidth);
    if (end - start < windowWidth) {
      start = Math.max(0, end - windowWidth);
    }
    const visible = line.slice(start, end);
    const cursorOffset = Math.max(0, Math.min(cursor - start, visible.length));
    return this.visibleLength(prompt) + cursorOffset;
  }

  private positionCursor(): void {
    if (!this.inputFocused) return;
    const prompt = this.historySearchActive ? chalk.yellow('? ') : chalk.cyan('> ');
    const cursorColumn = this.historySearchActive
      ? this.visibleLength(prompt) + this.historySearchQuery.length
      : this.getEditorCursorColumn(prompt, Math.max(20, this.innerWidth(this.inputBox)));
    const row = this.inputLayout.top + 1 + TerminalChatUI.PANEL_PADDING;
    const col = this.inputLayout.left + 1 + TerminalChatUI.PANEL_PADDING + cursorColumn;
    this.screen.program.showCursor();
    this.screen.program.cup(row, col);
  }

  private innerWidth(box: blessed.Widgets.BoxElement): number {
    const width = Math.floor((box.width as number) || (this.screen.width as number) || 80);
    return Math.max(10, width - 2 - TerminalChatUI.PANEL_PADDING * 2);
  }

  private innerHeight(box: blessed.Widgets.BoxElement): number {
    const height = Math.floor((box.height as number) || 3);
    return Math.max(3, height - 2 - TerminalChatUI.PANEL_PADDING * 2);
  }

  private wrapTranscript(width: number): string[] {
    const lines: string[] = [];
    let inCodeBlock = false;
    for (const entry of this.transcriptLines) {
      const pieces = this.formatTranscriptEntry(entry, inCodeBlock);
      inCodeBlock = pieces.inCodeBlock;
      lines.push(...this.wrapLine(pieces.text, width));
    }
    return lines.length > 0 ? lines : [chalk.gray('No conversation yet.')];
  }

  private formatTranscriptEntry(line: string, inCodeBlock: boolean): { text: string; inCodeBlock: boolean } {
    if (line.trim().startsWith('```')) {
      return { text: chalk.gray(line), inCodeBlock: !inCodeBlock };
    }

    if (inCodeBlock) {
      return { text: chalk.gray(line), inCodeBlock };
    }

    if (line.startsWith('Error:')) return { text: chalk.red(line), inCodeBlock };
    if (line.startsWith('Warning:')) return { text: chalk.yellow(line), inCodeBlock };
    if (line.startsWith('Info:')) return { text: chalk.cyan(line), inCodeBlock };
    if (line.startsWith('Debug:')) return { text: chalk.gray(line), inCodeBlock };
    if (/^\s*[-*]\s+/.test(line)) return { text: chalk.white(line), inCodeBlock };
    if (/^\s*#{1,3}\s+/.test(line)) return { text: chalk.bold.white(line), inCodeBlock };
    return { text: line, inCodeBlock };
  }

  private wrapLine(value: string, width: number): string[] {
    const clean = stripAnsi(value).replace(/\s+/g, ' ').trim();
    if (!clean) return [''];
    const words = clean.split(' ');
    const lines: string[] = [];
    let current = '';
    for (const word of words) {
      const next = current ? `${current} ${word}` : word;
      if (stripAnsi(next).length > width && current) {
        lines.push(current);
        current = word;
      } else {
        current = next;
      }
    }
    if (current) lines.push(current);
    return lines;
  }

  private scrollTranscript(delta: number): void {
    const visible = Math.max(5, this.innerHeight(this.transcriptBox));
    const wrapped = this.wrapTranscript(this.innerWidth(this.transcriptBox));
    const maxOffset = Math.max(0, wrapped.length - visible);
    this.transcriptScrollOffset = Math.max(0, Math.min(maxOffset, this.transcriptScrollOffset + delta));
    this.transcriptHasUnread = this.transcriptScrollOffset > 0;
    this.renderAll();
  }

  private scrollTranscriptToStart(): void {
    const visible = Math.max(5, this.innerHeight(this.transcriptBox));
    const total = this.wrapTranscript(this.innerWidth(this.transcriptBox)).length;
    this.transcriptScrollOffset = Math.max(0, total - visible);
    this.transcriptHasUnread = this.transcriptScrollOffset > 0;
    this.renderAll();
  }

  private scrollTranscriptToEnd(): void {
    this.transcriptScrollOffset = 0;
    this.transcriptHasUnread = false;
    this.renderAll();
  }

  private visibleLength(value: string): number {
    return stripAnsi(value).length;
  }

  private truncate(value: string, width: number): string {
    const clean = value.replace(/\s+/g, ' ').trim();
    if (clean.length <= width) return clean;
    return `${clean.slice(0, Math.max(0, width - 1))}…`;
  }

  private handleEditorKey(ch: string | undefined, key: blessed.Widgets.Events.IKeyEventArg | undefined): boolean {
    if (!key) return false;

    if (key.ctrl && key.name === 'c') {
      this.interruptCount += 1;
      if (this.interruptCount >= 2) {
        this.close();
        return true;
      }
      this.armInterruptReset();
      this.appendLine('Info: Press Ctrl+C again to exit.');
      return true;
    }

    if (key.ctrl && key.name === 'r') {
      this.clearInterruptState();
      this.toggleHistorySearch();
      return true;
    }

    if (key.name === 'escape') {
      this.clearInterruptState();
      if (this.taskControls.isRunning?.()) {
        this.escapeCancelCount += 1;
        if (this.escapeCancelCount >= 2) {
          this.taskControls.requestCancel?.();
          this.clearEscapeCancelState();
          this.appendLine('Warning: Cancelling running task...');
        } else {
          this.armEscapeCancelReset();
          this.appendLine('Info: Press Escape again to cancel the running task.');
        }
        return true;
      }
      if (this.historySearchActive) {
        this.clearHistorySearch();
      } else {
        this.clearInput();
      }
      return true;
    }

    if (this.historySearchActive) {
      return this.handleHistorySearchKey(ch, key);
    }

    if (key.name === 'tab') {
      this.refreshCompletionState();
      if (this.suggestions.length > 0) {
        this.applySuggestion(this.getSelectedSuggestion());
      }
      return true;
    }

    if (key.name === 'up' && this.suggestions.length > 0) {
      this.suggestionIndex = (this.suggestionIndex - 1 + this.suggestions.length) % this.suggestions.length;
      this.renderAll();
      return true;
    }

    if (key.name === 'down' && this.suggestions.length > 0) {
      this.suggestionIndex = (this.suggestionIndex + 1) % this.suggestions.length;
      this.renderAll();
      return true;
    }

    if (key.name === 'up' || key.name === 'down') {
      if (this.history.length === 0) return true;
      if (this.historyIndex === -1) {
        this.historyDraft = this.inputValue;
        this.historyIndex = this.history.length - 1;
      } else if (key.name === 'up') {
        this.historyIndex = Math.max(0, this.historyIndex - 1);
      } else if (this.historyIndex < this.history.length - 1) {
        this.historyIndex += 1;
      } else {
        this.historyIndex = -1;
        this.inputValue = this.historyDraft;
        this.cursor = this.inputValue.length;
        this.refreshCompletionState();
        return true;
      }

      if (this.historyIndex >= 0) {
        this.inputValue = this.history[this.historyIndex] ?? '';
        this.cursor = this.inputValue.length;
        this.refreshCompletionState();
      }
      return true;
    }

    if (key.name === 'return' || key.name === 'enter') {
      const next = this.inputValue.trimEnd();
      this.clearInput();
      if (this.inputHandler) {
        void this.inputHandler(next);
      }
      return true;
    }

    if (key.ctrl && key.name === 'a') {
      this.historyIndex = -1;
      this.cursor = 0;
      this.renderAll();
      return true;
    }

    if (key.ctrl && key.name === 'e') {
      this.historyIndex = -1;
      this.cursor = this.inputValue.length;
      this.renderAll();
      return true;
    }

    if (key.ctrl && key.name === 'u') {
      this.historyIndex = -1;
      this.inputValue = this.inputValue.slice(this.cursor);
      this.cursor = 0;
      this.refreshCompletionState();
      return true;
    }

    if (key.name === 'left') {
      this.historyIndex = -1;
      this.cursor = Math.max(0, this.cursor - 1);
      this.renderAll();
      return true;
    }

    if (key.name === 'right') {
      this.historyIndex = -1;
      this.cursor = Math.min(this.inputValue.length, this.cursor + 1);
      this.renderAll();
      return true;
    }

    if (key.name === 'home') {
      this.historyIndex = -1;
      this.cursor = 0;
      this.renderAll();
      return true;
    }

    if (key.name === 'end') {
      this.historyIndex = -1;
      this.cursor = this.inputValue.length;
      this.renderAll();
      return true;
    }

    if (key.name === 'backspace') {
      this.historyIndex = -1;
      if (this.cursor > 0) {
        this.inputValue = `${this.inputValue.slice(0, this.cursor - 1)}${this.inputValue.slice(this.cursor)}`;
        this.cursor -= 1;
        this.refreshCompletionState();
      }
      return true;
    }

    if (key.name === 'delete') {
      this.historyIndex = -1;
      if (this.cursor < this.inputValue.length) {
        this.inputValue = `${this.inputValue.slice(0, this.cursor)}${this.inputValue.slice(this.cursor + 1)}`;
        this.refreshCompletionState();
      }
      return true;
    }

    if (typeof ch === 'string' && ch.length === 1 && !key.ctrl && !key.meta) {
      this.clearInterruptState();
      this.clearEscapeCancelState();
      this.historyIndex = -1;
      this.inputValue = `${this.inputValue.slice(0, this.cursor)}${ch}${this.inputValue.slice(this.cursor)}`;
      this.cursor += 1;
      this.refreshCompletionState();
      return true;
    }

    return false;
  }

  private armInterruptReset(): void {
    if (this.interruptResetToken) {
      clearTimeout(this.interruptResetToken);
    }
    this.interruptResetToken = setTimeout(() => {
      this.clearInterruptState();
    }, 1500);
  }

  private clearInterruptState(): void {
    this.interruptCount = 0;
    if (this.interruptResetToken) {
      clearTimeout(this.interruptResetToken);
      this.interruptResetToken = null;
    }
  }

  private armEscapeCancelReset(): void {
    if (this.escapeCancelResetToken) {
      clearTimeout(this.escapeCancelResetToken);
    }
    this.escapeCancelResetToken = setTimeout(() => {
      this.clearEscapeCancelState();
    }, 1500);
  }

  private clearEscapeCancelState(): void {
    this.escapeCancelCount = 0;
    if (this.escapeCancelResetToken) {
      clearTimeout(this.escapeCancelResetToken);
      this.escapeCancelResetToken = null;
    }
  }

  private handleOutput(entry: OutputEntry): void {
    if (entry.kind === 'raw') {
      this.appendRaw(entry.message);
      return;
    }
    const prefix = entry.level === 'error'
      ? chalk.red('Error')
      : entry.level === 'warn'
        ? chalk.yellow('Warning')
        : entry.level === 'debug'
          ? chalk.gray('Debug')
          : chalk.green('Info');
    this.appendLine(`${prefix}: ${entry.message}`);
  }

  private toggleHistorySearch(): void {
    this.historySearchActive = !this.historySearchActive;
    if (this.historySearchActive) {
      this.historySearchQuery = '';
      this.historySearchResults = this.history.map((_, index) => index).reverse();
      this.historySearchIndex = 0;
    } else {
      this.clearHistorySearch();
    }
    this.renderAll();
  }

  private clearHistorySearch(): void {
    this.historySearchActive = false;
    this.historySearchQuery = '';
    this.historySearchResults = [];
    this.historySearchIndex = 0;
  }

  private handleHistorySearchKey(ch: string | undefined, key: blessed.Widgets.Events.IKeyEventArg): boolean {
    if (key.name === 'escape') {
      this.clearHistorySearch();
      this.renderAll();
      return true;
    }

    if (key.name === 'return' || key.name === 'enter') {
      const value = this.getHistorySearchSelection();
      if (value) {
        this.inputValue = value;
        this.cursor = value.length;
      }
      this.clearHistorySearch();
      this.refreshCompletionState();
      return true;
    }

    if (key.name === 'up') {
      this.historySearchIndex = Math.max(0, this.historySearchIndex - 1);
      this.renderAll();
      return true;
    }

    if (key.name === 'down') {
      this.historySearchIndex = Math.min(Math.max(0, this.historySearchResults.length - 1), this.historySearchIndex + 1);
      this.renderAll();
      return true;
    }

    if (key.name === 'backspace') {
      this.historySearchQuery = this.historySearchQuery.slice(0, -1);
      this.updateHistorySearchResults();
      return true;
    }

    if (typeof ch === 'string' && ch.length === 1 && !key.ctrl && !key.meta) {
      this.historySearchQuery += ch;
      this.updateHistorySearchResults();
      return true;
    }

    return true;
  }

  private updateHistorySearchResults(): void {
    const query = this.historySearchQuery.toLowerCase();
    this.historySearchResults = this.history
      .map((value, index) => ({ value, index }))
      .filter((item) => item.value.toLowerCase().includes(query))
      .map((item) => item.index)
      .reverse();
    this.historySearchIndex = 0;
    this.renderAll();
  }

  private getHistorySearchSelection(): string {
    const index = this.historySearchResults[this.historySearchIndex];
    return typeof index === 'number' ? (this.history[index] ?? '') : '';
  }

  private formatSearchLine(width: number): string {
    const prompt = chalk.yellow('? ');
    const query = this.historySearchQuery || '';
    const selection = this.getHistorySearchSelection();
    const available = Math.max(1, width - this.visibleLength(prompt));
    const visibleQuery = this.truncate(query, Math.max(1, available - 12));
    const cursorCell = chalk.inverse(' ');
    const suffix = selection ? chalk.dim(` ${this.truncate(selection, 32)}`) : '';
    return `${prompt}${visibleQuery}${cursorCell}${suffix}`;
  }

  private renderHistorySearchPanel(): string {
    const selection = this.getHistorySearchSelection();
    const results = this.historySearchResults.slice(0, 5).map((index, displayIndex) => {
      const value = this.history[index] ?? '';
      const marker = displayIndex === this.historySearchIndex ? chalk.cyan('>') : chalk.gray(' ');
      return `${marker} ${this.truncate(value, 96)}`;
    });
    return [
      chalk.yellow(`History search: ${this.historySearchQuery || '(type to search)'}`),
      ...(results.length > 0 ? results : [chalk.gray('No history matches.')]),
      chalk.gray(selection ? `Enter accept · Esc cancel · ${this.historySearchResults.length} match(es)` : 'Enter accept · Esc cancel'),
    ].join('\n');
  }

  private getSelectedCompletionItem(index: number): CompletionItem | undefined {
    const context = this.completionState;
    if (!context?.items) return undefined;
    const selectedValue = this.suggestions[index];
    if (!selectedValue) return undefined;
    return context.items.find((item) => this.decorateCompletionValue(item) === selectedValue);
  }

  private decorateCompletionValue(entry: CompletionItem): string {
    return this.completionState?.mode === 'mention' ? `@${entry.value}` : entry.value;
  }
}
