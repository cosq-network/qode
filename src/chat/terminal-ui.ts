import blessed from 'blessed';
import chalk from 'chalk';
import stripAnsi from 'strip-ansi';
import { setOutputSink, type OutputEntry } from '../utils/output.js';
import { THEMES, type ThemePalette } from '../utils/themes.js';
import type { CompletionContext } from './completion.js';
import { renderMarkdown } from '../utils/markdown.js';
import { getRecentFiles } from '../utils/files.js';

// Constants for maintainability
const MAX_TRANSCRIPT_LINES = 500;
const MAX_HISTORY_ENTRIES = 200;
const MIN_TERMINAL_WIDTH = 10;
const MIN_TERMINAL_HEIGHT = 5;
const MAX_WRAP_CACHE_SIZE = 10;

/**
 * Get display width of a string, accounting for ANSI escape sequences.
 * This is a simplified version that works with Jest.
 */
function getStringWidth(str: string): number {
  // Remove ANSI escape sequences and get length
  // For most terminals, ASCII characters are width 1
  const stripped = stripAnsi(str);
  
  // Count characters, treating most as width 1
  // This is a simplification - a full implementation would handle
  // CJK characters, combining characters, etc.
  let width = 0;
  for (let i = 0; i < stripped.length; i++) {
    const char = stripped[i];
    // Handle some known wide characters (CJK, emoji, etc.)
    // This is a simplified check - in production you'd want a full implementation
    if (char >= '\u1100' && char <= '\u11ff') { // Hangul
      width += 2;
    } else if (char >= '\u4e00' && char <= '\u9fff') { // CJK
      width += 2;
    } else if (char >= '\ud800' && char <= '\udbff') { // Surrogate pairs (emoji)
      width += 2;
      i++; // Skip the next character (low surrogate)
    } else {
      width += 1;
    }
  }
  return width;
}

export function computeInputWindowStart(
  lineLength: number,
  cursorPos: number,
  availableWidth: number,
  ghostDisplayWidth = 0,
): number {
  const windowWidth = Math.max(1, availableWidth - ghostDisplayWidth);
  const halfWindow = Math.max(4, Math.floor(windowWidth / 2));
  const safeCursor = Math.max(0, Math.min(cursorPos, lineLength));
  let start = Math.max(0, safeCursor - halfWindow);
  const end = Math.min(lineLength, start + windowWidth);
  if (end - start < windowWidth) {
    start = Math.max(0, end - windowWidth);
  }
  return start;
}

export function computeInputCursorColumn(line: string, cursorPos: number, visibleStart: number, promptColumns = 3): number {
  const safeCursor = Math.max(0, Math.min(cursorPos, line.length));
  const safeStart = Math.max(0, Math.min(visibleStart, safeCursor));
  return promptColumns + getStringWidth(line.slice(safeStart, safeCursor));
}

/**
 * ANSI-aware string slicing that doesn't split escape sequences.
 * This is a simplified version since slice-ansi is ESM-only and doesn't work with Jest.
 */
function sliceAnsiSafe(str: string, start: number, end?: number): string {
  if (end === undefined) {
    end = str.length;
  }
  
  // If the string has no ANSI codes, use regular slice
  if (!str.includes('\x1b')) {
    return str.slice(start, end);
  }
  
  let result = '';
  let inEscape = false;
  let charCount = 0;
  
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    
    if (char === '\x1b') {
      // Start of ANSI escape sequence
      inEscape = true;
      result += char;
      continue;
    }
    
    if (inEscape) {
      // Inside ANSI escape sequence - include all characters until 'm'
      result += char;
      if (char === 'm') {
        inEscape = false;
      }
      continue;
    }
    
    // Count non-ANSI characters
    if (charCount >= start && charCount < end) {
      result += char;
    }
    charCount++;
  }
  
  return result;
}


export interface ChatUIState {
  cwd: string;
  modelName: string;
  providerName: string;
  mode: string;
  tokenUsage: string;
  recentFiles: string;
  suggestion?: string;
}

// Cache for lazy wrapping to avoid recomputing word wrap for same width
interface WrapCacheEntry {
  width: number;
  lines: string[];
}

// Interface for streaming state
interface StreamingState {
  isStreaming: boolean;
  currentChunk: string;
  streamId: string;
}

interface ThemeColors {
  headerBg: string;
  headerFg: string;
  borderFg: string;
  transcriptBg: string;
  inputBg: string;
  inputFg: string;
  promptFg: string;
  suggestionBg: string;
  suggestionFg: string;
  userTag: string;
  assistantTag: string;
  systemTag: string;
  errorFg: string;
  warnFg: string;
  infoFg: string;
  codeFg: string;
  dimFg: string;
  accentFg: string;
}

/**
 * Convert ThemePalette from themes.ts to ThemeColors for internal use.
 * Maps ANSI color codes to hex values where needed.
 */
function paletteToColors(palette: ThemePalette): ThemeColors {
  // Helper to convert ANSI color code to hex
  const ansiToHex = (ansi: string): string => {
    // Simple mapping for known colors; keep ANSI codes as-is for terminal compatibility
    const mappings: Record<string, string> = {
      '\x1b[38;2;122;162;247m': '#7aa2f7',
      '\x1b[38;2;158;206;106m': '#9ece6a',
      '\x1b[38;2;187;154;247m': '#bb9af7',
      '\x1b[38;2;255;158;100m': '#ff9e64',
      '\x1b[38;2;247;118;142m': '#f7768e',
      '\x1b[38;2;224;175;104m': '#e0af68',
      '\x1b[38;2;79;195;247m': '#7dcfff',
      '\x1b[38;2;86;95;137m': '#565f89',
      '\x1b[1;37m': '#ffffff',
      '\x1b[37m': '#d4d4d4',
      '\x1b[2;37m': '#808080',
      '\x1b[1;31m': '#ff0000',
      '\x1b[31m': '#ff5555',
      '\x1b[1;33m': '#ffff00',
      '\x1b[33m': '#ffff55',
    };
    const ansiEscape = '\x1b';
    return mappings[ansi] || ansi.replace(new RegExp(ansiEscape + '\[[0-9;]*m', 'g'), '').trim() || '#ffffff';
  };

  // Strip ANSI codes for color values that are hex
  const clean = (val?: string): string => {
    if (!val) return DARK_THEME.dimFg;
    if (/^#/.test(val)) return val;
    return ansiToHex(val);
  };

  return {
    headerBg: clean(palette.headerBg) || DARK_THEME.headerBg,
    headerFg: clean(palette.model) || DARK_THEME.headerFg,
    borderFg: clean(palette.borderChar) || DARK_THEME.borderFg,
    transcriptBg: clean(palette.headerBg) || DARK_THEME.transcriptBg,
    inputBg: clean(palette.headerBg) || DARK_THEME.inputBg,
    inputFg: clean(palette.model) || DARK_THEME.inputFg,
    promptFg: clean(palette.accent) || DARK_THEME.promptFg,
    suggestionBg: clean(palette.headerBg) || DARK_THEME.suggestionBg,
    suggestionFg: clean(palette.dim) || DARK_THEME.suggestionFg,
    userTag: clean(palette.model) || DARK_THEME.userTag,
    assistantTag: clean(palette.dir) || DARK_THEME.assistantTag,
    systemTag: clean(palette.context) || DARK_THEME.systemTag,
    errorFg: clean(palette.error) || DARK_THEME.errorFg,
    warnFg: clean(palette.warn) || DARK_THEME.warnFg,
    infoFg: clean(palette.info) || DARK_THEME.infoFg,
    codeFg: clean(palette.code) || DARK_THEME.codeFg,
    dimFg: clean(palette.dim) || DARK_THEME.dimFg,
    accentFg: clean(palette.accent) || DARK_THEME.accentFg,
  };
}


const DARK_THEME: ThemeColors = {
  headerBg: '#1a1b26',
  headerFg: '#a9b1d6',
  borderFg: '#565f89',
  transcriptBg: '#1a1b26',
  inputBg: '#15161e',
  inputFg: '#c0caf5',
  promptFg: '#7aa2f7',
  suggestionBg: '#1a1b26',
  suggestionFg: '#9aa5ce',
  userTag: '#7aa2f7',
  assistantTag: '#9ece6a',
  systemTag: '#bb9af7',
  errorFg: '#f7768e',
  warnFg: '#e0af68',
  infoFg: '#7dcfff',
  codeFg: '#565f89',
  dimFg: '#565f89',
  accentFg: '#ff9e64',
};



export class TerminalChatUI {
  private screen: blessed.Widgets.Screen;
  private startTime = Date.now();
  private headerTimer: NodeJS.Timeout | null = null;
  private headerBox: blessed.Widgets.BoxElement;
  private transcriptBox: blessed.Widgets.BoxElement;
  private inputBox: blessed.Widgets.BoxElement;
  private suggestionsBox: blessed.Widgets.BoxElement;
  private recentFilesBox: blessed.Widgets.BoxElement;

  private transcriptLines: string[] = [];
  private transcriptScrollOffset = 0;
  private transcriptHasUnread = false;
  private isAtBottom = true;

  // Performance optimization: lazy wrapping cache
  private wrapCache: WrapCacheEntry[] = [];
  private lastWrapWidth = 0;

  // Performance optimization: debounced render queue
  private renderQueue: (() => void)[] = [];
  private renderQueueToken: NodeJS.Timeout | null = null;
  private isRendering = false;

  // Streaming state for smart output formatting
  private streamingState: StreamingState = {
    isStreaming: false,
    currentChunk: '',
    streamId: '',
  };

  // Collapsible output state
  private collapsedOutputs: Set<string> = new Set();

  private inputValue = '';
  private cursor = 0;
  private inputFocused = false;

  private history: string[] = [];
  private historyIndex = -1;
  private historyDraft = '';
  private historySearchActive = false;
  private historySearchQuery = '';
  private historySearchResults: number[] = [];
  private historySearchIndex = 0;

  private suggestions: string[] = [];
  private suggestionIndex = 0;
  private completionState: CompletionContext | null = null;
  private suggestionRefreshToken: NodeJS.Immediate | null = null;
  private suggestionResolver: ((value: string, cursor: number) => CompletionContext | null) | null = null;
  private inputWindowStart = 0;

  private inputHandler: ((value: string) => Promise<void>) | null = null;

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

  private colors: ThemeColors;
  private themeName: string;
  private lastState: ChatUIState | null = null;

  // Store references to event listeners for cleanup
  private keypressHandler: ((ch: string, key: any) => void) | null = null;
  private scrollHandler: (() => void) | null = null;
  private screenKeyBindings: Array<{ key: string; handler: () => void }> = [];

  constructor() {
    this.colors = DARK_THEME;
    this.themeName = 'default';
    // Import getRecentFiles for recent files panel
    // (import placed at top of file)


    try {
      this.screen = blessed.screen({
      smartCSR: true,
      dockBorders: true,
      fullUnicode: true,
      warnings: false,
      cursor: {
        artificial: false,
        shape: 'underline',
        blink: true,
        color: 'white',
      },
      forceUnicode: true,
      autoPadding: true,
      tabSize: 2,
    });

    this.screen.key(['C-q'], () => {
      this.close();
      process.exit(0);
    });

    const bgHex = this.colors.transcriptBg;
    const bFg = this.colors.borderFg;

    this.headerBox = blessed.box({
      parent: this.screen,
      top: 0,
      left: 0,
      width: '100%',
      height: 3,
      border: { type: 'line' },
      tags: false,
      style: {
        fg: this.colors.headerFg,
        bg: bgHex,
        border: { fg: bFg, bold: true },
      },
      content: '',
    });

    this.transcriptBox = blessed.box({
      parent: this.screen,
      top: 3,
      left: 0,
      width: '75%',
      // Bottom offset will be adjusted dynamically based on suggestions visibility.
      bottom: 5,
      border: { type: 'line' },
      tags: false,
      scrollable: true,
      alwaysScroll: true,
      scrollbar: {
        ch: '▐',
        style: { fg: this.colors.dimFg },
      },
      style: {
        fg: this.colors.inputFg,
        bg: bgHex,
        border: { fg: bFg, bold: true },
      },
      content: '',
    });

    // Panel for recent changed files (right side, 25% width)
    this.recentFilesBox = blessed.box({
      parent: this.screen,
      top: 3,
      left: '75%',
      width: '25%',
      // Bottom offset will be adjusted dynamically.
      bottom: 5,
      border: { type: 'line' },
      tags: false,
      scrollable: true,
      alwaysScroll: true,
      style: {
        fg: this.colors.inputFg,
        bg: bgHex,
        border: { fg: bFg, bold: true },
      },
      content: '',
    });

    this.suggestionsBox = blessed.box({
      parent: this.screen,
      bottom: 5,
      left: 0,
      width: '100%',
      height: 3,
      border: { type: 'line' },
      tags: false,
      hidden: true,
      style: {
        fg: this.colors.suggestionFg,
        bg: bgHex,
        border: { fg: bFg, bold: true },
      },
      content: '',
    });

    this.inputBox = blessed.box({
      parent: this.screen,
      bottom: 0,
      left: 0,
      width: '100%',
      height: 5,
      border: { type: 'line' },
      tags: false,
      style: {
        fg: this.colors.inputFg,
        bg: this.colors.inputBg,
        border: { fg: bFg, bold: true },
      },
      content: '',
    });

    this.setupInputHandling();
    this.setupTranscriptScroll();
    this.enableSelectionCopy();
    this.headerTimer = setInterval(() => {
      this.queueRender();
    }, 1000);
    this.renderAll();


    setOutputSink((entry) => this.handleOutput(entry));
    } catch (error) {
      // If constructor fails, clean up any partially created resources.
      this.safeClose();
      throw error;
    }
  }

  public focus(): void {
    this.inputFocused = true;
    this.screen.program.showCursor();
    this.queueRender();
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
    this.lastState = state;
    this.renderHeader(state);
    if (state.suggestion) {
      this.suggestions = [state.suggestion];
      this.suggestionIndex = 0;
    }
    // Refresh recent files panel asynchronously
    this.refreshRecentFiles();
    this.queueRender();
  }

  // Async method to update recent files panel
  private async refreshRecentFiles(): Promise<void> {
    try {
      const recent = await getRecentFiles(process.cwd(), 5);
      const content = recent.map((f: string) => `- ${f}`).join('\n');
      this.recentFilesBox.setContent(content);
      // Ensure UI updates
      this.screen.render();
    } catch (e) {
      // Fail silently; panel will remain empty
    }
  }

  public appendLine(line: string): void {
    if (!line.trim()) return;
    
    // Smart Output Formatting: Handle very long lines by making them collapsible
    const maxLineLength = 500; // Characters per line threshold for collapsing
    if (line.length > maxLineLength) {
      // Split long lines and make them collapsible
      const collapsedLines = this.createCollapsibleOutput(line, 5); // Show 5 lines max
      for (const collapsedLine of collapsedLines) {
        this.transcriptLines.push(collapsedLine);
      }
    } else {
      this.transcriptLines.push(line);
    }
    
    if (this.transcriptLines.length > MAX_TRANSCRIPT_LINES) {
      this.transcriptLines = this.transcriptLines.slice(-MAX_TRANSCRIPT_LINES);
    }
    if (this.isAtBottom) {
      this.scrollToBottom();
    } else {
      this.transcriptHasUnread = true;
    }
    
    // Invalidate cache when new content is added
    this.invalidateWrapCache();
    this.queueRender();
  }

  public appendRaw(text: string): void {
    const lines = text.split(/\r?\n/);
    for (const line of lines) {
      this.appendLine(line);
    }
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
    this.queueRender();
  }

  public getInputValue(): string {
    return this.inputValue;
  }

  public setSuggestion(text: string): void {
    this.suggestions = text ? [text] : [];
    this.suggestionIndex = 0;
    this.queueRender();
  }

  public recordHistory(value: string): void {
    const normalized = value.trim();
    if (!normalized) return;
    if (this.history[this.history.length - 1] === normalized) return;
    this.history.push(normalized);
    if (this.history.length > MAX_HISTORY_ENTRIES) {
      this.history = this.history.slice(-MAX_HISTORY_ENTRIES);
    }
    this.historyIndex = -1;
  }

  public close(): void {
    this.safeClose();
  }

  private safeClose(): void {
    this.inputFocused = false;

    // Clean up event listeners to prevent memory leaks
    if (this.screen && this.keypressHandler) {
      this.screen.off('keypress', this.keypressHandler);
      this.keypressHandler = null;
    }

    if (this.transcriptBox && this.scrollHandler) {
      this.transcriptBox.off('scroll', this.scrollHandler);
      this.scrollHandler = null;
    }

    // Clean up screen key bindings - blessed doesn't expose unkey in the type definitions
    // We track them for documentation but can't programmatically remove them
    this.screenKeyBindings = [];

    this.clearInterruptState();
    this.clearEscapeCancelState();
    if (this.headerTimer) {
      clearInterval(this.headerTimer);
      this.headerTimer = null;
    }
    if (this.suggestionRefreshToken) {
      clearImmediate(this.suggestionRefreshToken);
      this.suggestionRefreshToken = null;
    }
    setOutputSink(null);
    this.screen?.program?.hideCursor();
    this.screen?.destroy();
  }

  public setTheme(name: string): void {
    this.themeName = name;
    const palette = THEMES[name.toLowerCase()] || THEMES.default;
    this.colors = paletteToColors(palette);
    this.queueRender();
  }

  private renderHeader(state: ChatUIState): void {
    const appName = chalk.bold.hex(this.colors.accentFg)('qode');
    const separator = chalk.hex(this.colors.dimFg)(' │ ');

    const modeDot = state.mode === 'plan'
      ? chalk.hex('#e0af68')('○')
      : chalk.hex('#9ece6a')('●');

    const provider = state.providerName && state.providerName !== 'N/A'
      ? ` ${chalk.hex(this.colors.dimFg)(`(${state.providerName})`)}`
      : '';

    const displayModel = state.modelName || 'No model selected';
    
    const elapsedSecs = Math.floor((Date.now() - this.startTime) / 1000);
    const h = Math.floor(elapsedSecs / 3600);
    const m = Math.floor((elapsedSecs % 3600) / 60);
    const s = elapsedSecs % 60;
    const durationStr = h > 0
      ? `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
      : `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;

    const duration = chalk.hex(this.colors.infoFg || '#7dcfff')(`🕒 ${durationStr}`);

    const left = ` ${appName}${separator}${chalk.bold(displayModel)}${provider}${separator}${modeDot}${separator}${duration}`;

    let tokenStr = '0 / 0';
    if (state.tokenUsage) {
      const parts = state.tokenUsage.split('/');
      if (parts.length === 2) {
        const used = parseInt(parts[0].trim(), 10) || 0;
        const max = parseInt(parts[1].trim(), 10) || 0;
        const usedFormatted = used.toLocaleString();
        const maxFormatted = max.toLocaleString();
        if (max > 0) {
          const percent = (used / max) * 100;
          const tokenPercentStr = `${percent.toFixed(2)}%`;
          tokenStr = `${usedFormatted} / ${maxFormatted} (${tokenPercentStr})`;
        } else {
          tokenStr = `${usedFormatted} tokens`;
        }
      }
    }
    const right = `${chalk.hex(this.colors.dimFg)('Tokens: ')}${chalk.bold(tokenStr)} `;

    const width = this.innerWidth();
    const leftLen = stripAnsi(left).length;
    const rightLen = stripAnsi(right).length;
    const padding = Math.max(1, width - leftLen - rightLen - 2);
    const line = `${left}${' '.repeat(padding)}${right}`;

    this.headerBox.setContent(line);
  }

  public showSetupFlow(): Promise<import('./setup-ui.js').SetupResult | null> {
    return import('./setup-ui.js').then(m => m.runSetupTUI(this.screen, this.colors));
  }

  public async showDiffTheater(file: string, beforeContent: string, afterContent: string): Promise<'accept' | 'revert'> {
    return new Promise((resolve) => {
      const box = blessed.box({
        parent: this.screen,
        width: '90%',
        height: '90%',
        top: 'center',
        left: 'center',
        border: 'line',
        tags: true,
        scrollable: true,
        alwaysScroll: true,
        scrollbar: { ch: '▐', style: { fg: this.colors.dimFg } },
        style: {
          bg: this.colors.headerBg,
          fg: this.colors.inputFg,
          border: { fg: this.colors.accentFg, bold: true },
        }
      });

      let showAfter = true;
      let expand = false;

      const renderDiff = () => {
        let contentStr = '';
        if (expand) {
          contentStr = showAfter ? afterContent : beforeContent;
        } else {
          // crude line limit for non-expanded
          const lines = (showAfter ? afterContent : beforeContent).split('\n');
          contentStr = lines.slice(0, 100).join('\n') + (lines.length > 100 ? '\n... (truncated, press E to expand)' : '');
        }

        const viewState = showAfter ? '{green-fg}AFTER EDIT{/}' : '{red-fg}BEFORE EDIT{/}';
        box.setContent(`{bold}Terminal Diff Theater: ${file}{/}\nState: ${viewState} (Toggle: 'T')\nControls: [A]ccept, [R]evert, [E]xpand, [T]oggle, [Up/Down] Scroll\n\n${contentStr.replace(/\{/g, '\\{').replace(/\}/g, '\\}')}`);
        this.screen.render();
      };

      renderDiff();

      const keyHandler = (ch: any, key: any) => {
        if (!key) return;
        const name = key.name;
        if (name === 'a' || name === 'enter') {
          this.screen.remove(box);
          ['a', 'enter', 'r', 'escape', 'e', 't', 'up', 'down'].forEach(k => this.screen.unkey(k as any, keyHandler));
          this.screen.render();
          resolve('accept');
        } else if (name === 'r' || name === 'escape') {
          this.screen.remove(box);
          ['a', 'enter', 'r', 'escape', 'e', 't', 'up', 'down'].forEach(k => this.screen.unkey(k as any, keyHandler));
          this.screen.render();
          resolve('revert');
        } else if (name === 't') {
          showAfter = !showAfter;
          renderDiff();
        } else if (name === 'e') {
          expand = !expand;
          renderDiff();
        } else if (name === 'up') {
          box.scroll(-1);
          this.screen.render();
        } else if (name === 'down') {
          box.scroll(1);
          this.screen.render();
        }
      };

      this.screen.key(['a', 'enter', 'r', 'escape', 'e', 't', 'up', 'down'], keyHandler);
      box.focus();
    });
  }

  private renderTranscript(): void {
    const width = Math.max(MIN_TERMINAL_WIDTH, this.innerWidth());
    const height = Math.max(MIN_TERMINAL_HEIGHT, this.innerHeight());
    
    // Use lazy wrapping cache for performance
    const wrapped = this.wrapLines(width);
    const totalLines = wrapped.length;
    
    // Virtual rendering: only render visible lines
    const viewTop = Math.max(0, totalLines - height - this.transcriptScrollOffset);
    const visible = wrapped.slice(viewTop, viewTop + height);
    
    // Only pad if we have fewer lines than the view height
    const padded = visible.length < height
      ? [...visible, ...Array(height - visible.length).fill('')]
      : visible;

    const hasContent = this.transcriptLines.length > 0;

    if (this.isAtBottom && hasContent) {
      this.transcriptBox.setScrollPerc(100);
    }

    // Invalidate cache if we're at different scroll positions
    // This ensures we don't show stale content
    if (this.lastWrapWidth !== width) {
      this.lastWrapWidth = width;
    }

    const content = padded.join('\n');
    this.transcriptBox.setContent(content);

    // Add streaming indicator if currently streaming
    if (this.streamingState.isStreaming && !this.isAtBottom) {
      const streamingIndicator = chalk.hex(this.colors.accentFg)('● Streaming...');
      const lastLine = padded[padded.length - 1] || '';
      if (lastLine !== streamingIndicator) {
        padded[padded.length - 1] = streamingIndicator;
        this.transcriptBox.setContent(padded.join('\n'));
      }
    }
    
    if (this.transcriptHasUnread && !this.isAtBottom && !this.streamingState.isStreaming) {
      const unreadCount = Math.min(this.transcriptScrollOffset, 100); // Limit displayed count
      const indicator = chalk.hex(this.colors.warnFg)(`▸ ${unreadCount} more lines below`);
      const lastLine = padded[padded.length - 1] || '';
      if (lastLine !== indicator) {
        padded[padded.length - 1] = indicator;
        this.transcriptBox.setContent(padded.join('\n'));
      }
    }
  }

  private updatePanelLayout(): void {
    // Determine if suggestions box is visible (not hidden) and has a numeric height.
    const suggestionsVisible = !this.suggestionsBox.hidden && Number(this.suggestionsBox.height) > 0;
    const baseBottom = 5; // Height of input box area.
    const bottomOffset = suggestionsVisible ? baseBottom + Number(this.suggestionsBox.height) : baseBottom;
    this.transcriptBox.bottom = bottomOffset;
    this.recentFilesBox.bottom = bottomOffset;
    // Re-render to apply the new layout.
    this.screen.render();
  }

  private renderSuggestions(): void {
    if (this.historySearchActive) {
      const content = this.renderHistorySearchPreview();
      this.suggestionsBox.setContent(content);
      this.suggestionsBox.height = 3;
      this.suggestionsBox.show();
      this.updatePanelLayout();
      return;
    }
      
    if (this.completionState && this.suggestions.length > 0) {
      const total = this.suggestions.length;
      // Determine how many suggestions can be shown based on screen height.
      const maxVisible = Math.min(
        total,
        Math.max(2, Math.floor((Number(this.screen.height) - 8) / 2))
      );
      // Center the current suggestion in the view when possible.
      let start = this.suggestionIndex - Math.floor(maxVisible / 2);
      if (start < 0) start = 0;
      if (start + maxVisible > total) start = Math.max(0, total - maxVisible);

      const visible = this.suggestions.slice(start, start + maxVisible);
      const showTop = start > 0;
      const showBottom = start + maxVisible < total;

      const lines: string[] = [];
      if (showTop) lines.push(chalk.hex(this.colors.dimFg)('  ⋮'));

      for (let i = 0; i < visible.length; i++) {
        const idx = start + i;
        const item = visible[i];
        const isSel = idx === this.suggestionIndex;
        const prefix = isSel ? chalk.hex(this.colors.accentFg)('▸') : ' ';
        const styled = isSel
          ? chalk.bgHex('#3b4261').hex('#c0caf5')(` ${item} `)
          : chalk.hex(this.colors.suggestionFg)(` ${item} `);
        lines.push(`${prefix} ${styled}`);
      }

      if (showBottom) lines.push(chalk.hex(this.colors.dimFg)('  ⋮'));

      this.suggestionsBox.setContent(lines.join('\n'));
      const sugHeight = Math.max(3, lines.length + 2);
      this.suggestionsBox.height = sugHeight;
      this.suggestionsBox.show();
      this.updatePanelLayout();
      return;
    }

    this.suggestionsBox.hide();
    // Reset height to zero and update layout to keep panels equal
    this.suggestionsBox.height = 0;
    this.updatePanelLayout();
  }

  private renderHistorySearchPreview(): string {
    const selection = this.getHistorySearchSelection();
    const matchCount = this.historySearchResults.length;
    const query = this.historySearchQuery || chalk.hex(this.colors.dimFg)('type to search');
    const preview = selection
      ? chalk.hex(this.colors.dimFg)(` ${this.truncate(selection, 40)}`)
      : '';
    return `${chalk.bold.hex(this.colors.promptFg)('⌕')} ${query}${preview} ${chalk.hex(this.colors.dimFg)(`(${matchCount})`)}`;
  }

  private renderInput(): void {
    // Enhanced prompt with bold styling for better visibility
    const prompt = chalk.bold.hex(this.colors.promptFg)('❯');
    const width = Math.max(MIN_TERMINAL_WIDTH, this.innerWidth());

    if (this.historySearchActive) {
      const query = this.historySearchQuery || '';
      const cursorChar = chalk.inverse(' ');
      this.inputBox.setContent(`\n${chalk.bold.hex(this.colors.warnFg)('⌕')} ${query}${cursorChar}`);
      return;
    }

    const line = this.inputValue;
    const cursorPos = Math.max(0, Math.min(this.cursor, line.length));
    const ghost = this.getGhostText();
    const ghostDisplayWidth = getStringWidth(ghost);
    const available = Math.max(1, width - 2);
    const windowWidth = Math.max(1, available - ghostDisplayWidth);
    const start = computeInputWindowStart(line.length, cursorPos, available, ghostDisplayWidth);
    const end = Math.min(line.length, start + windowWidth);
    this.inputWindowStart = start;

    // Use ANSI-aware slicing
    const before = sliceAnsiSafe(line, start, cursorPos);
    const cursorChar = line[cursorPos] || ' ';
    const after = sliceAnsiSafe(line, cursorPos, end);
    
    const cursorCell = chalk.inverse(cursorChar);
    const ghostSuffix = ghost ? chalk.hex(this.colors.dimFg)(ghost) : '';
    const lineContent = `${before}${cursorCell}${after}${ghostSuffix}`;

    this.inputBox.setContent(`\n${prompt} ${lineContent}`);
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

  private queueRender(): void {
    // Add current render to queue
    this.renderQueue.push(() => this.executeRender());
    
    // If already processing or have a timeout, don't create another
    if (this.isRendering || this.renderQueueToken) {
      return;
    }
    
    // Start the debounced render cycle
    this.processRenderQueue();
  }

  private processRenderQueue(): void {
    if (this.renderQueue.length === 0) {
      this.isRendering = false;
      this.renderQueueToken = null;
      return;
    }
    
    // Process all queued renders and clear the queue
    const renders = [...this.renderQueue];
    this.renderQueue = [];
    this.isRendering = true;
    
    // Execute the last render (this ensures we don't do redundant work)
    const lastRender = renders[renders.length - 1];
    lastRender();
    
    // Reset state after execution
    this.isRendering = false;
  }

  private executeRender(): void {
    const bgHex = this.colors.transcriptBg;
    const bFg = this.colors.borderFg;

    this.headerBox.style.bg = bgHex;
    this.transcriptBox.style.bg = bgHex;
    this.suggestionsBox.style.bg = bgHex;
    this.inputBox.style.bg = this.colors.inputBg;

    for (const box of [this.headerBox, this.transcriptBox, this.suggestionsBox, this.inputBox]) {
      if (box.style.border) {
        (box.style.border as { fg: string }).fg = bFg;
      }
    }

    if (this.inputFocused && this.inputBox.style.border) {
      (this.inputBox.style.border as { fg: string }).fg = this.colors.promptFg;
    }

    if (this.lastState) {
      this.renderHeader(this.lastState);
    }
    this.renderSuggestions();
    this.transcriptBox.position.bottom = this.suggestionsBox.hidden
      ? 5
      : 5 + (this.suggestionsBox.height as number);
    this.renderTranscript();
    this.renderInput();
    this.screen.render();
    this.positionCursor();
  }

  private renderAll(): void {
    // For immediate renders (like initial setup), use direct rendering
    this.executeRender();
  }

  private positionCursor(): void {
    if (!this.inputFocused) return;
    const screenH = Math.floor(Number(this.screen.height) || 24);
    const screenW = Math.floor(Number(this.screen.width) || 80);
    const inputContentRow = Math.max(1, screenH - 3);
    const line = this.historySearchActive ? this.historySearchQuery : this.inputValue;
    const cursorPos = this.historySearchActive ? line.length : Math.max(0, Math.min(this.cursor, line.length));
    
    // Use string-width for accurate display width
    const visibleStart = this.historySearchActive ? 0 : this.inputWindowStart;
    const col = Math.min(screenW - 1, computeInputCursorColumn(line, cursorPos, visibleStart));
    this.screen.program.showCursor();
    this.screen.program.cup(inputContentRow, col);
  }

  private innerWidth(): number {
    const w = Math.floor(Number(this.screen.width) || 80);
    return Math.max(MIN_TERMINAL_WIDTH, w - 2);
  }

  private innerHeight(): number {
    const h = Math.floor(Number(this.screen.height) || 24);
    const sugH = this.suggestionsBox.hidden ? 0 : (this.suggestionsBox.height as number);
    const used = 3 + sugH + 5 + 2;
    return Math.max(MIN_TERMINAL_HEIGHT, h - used);
  }

  private wrapLines(width: number): string[] {
    // Check cache first
    const cacheEntry = this.wrapCache.find(entry => entry.width === width);
    if (cacheEntry) {
      return cacheEntry.lines;
    }
    
    const result: string[] = [];
    let inCodeBlock = false;

    for (const line of this.transcriptLines) {
      if (line.trimStart().startsWith('```')) {
        inCodeBlock = !inCodeBlock;
        result.push(chalk.hex(this.colors.codeFg)(line));
        continue;
      }

      if (inCodeBlock) {
        result.push(chalk.hex(this.colors.codeFg)(line));
        continue;
      }

      const formatted = this.formatLine(line);
      const wrapped = this.wordWrap(formatted, width);
      result.push(...wrapped);
    }

    if (this.streamingState.isStreaming && this.streamingState.currentChunk) {
      const markdown = renderMarkdown(this.streamingState.currentChunk);
      const lines = markdown.split('\n');
      for (const line of lines) {
        result.push(...this.wordWrap(line, width));
      }
    }

    if (result.length === 0) {
      result.push(chalk.hex(this.colors.dimFg)('Start a conversation — type /help for commands'));
    }

    // Update cache
    this.wrapCache.push({ width, lines: result });
    
    // Limit cache size
    if (this.wrapCache.length > MAX_WRAP_CACHE_SIZE) {
      this.wrapCache.shift();
    }
    
    return result;
  }

  private formatLine(line: string, isCollapsed: boolean = false): string {
    // Streaming chunk formatting
    if (this.streamingState.isStreaming && line.includes(this.streamingState.streamId)) {
      return chalk.hex(this.colors.accentFg)(line);
    }

    // Collapsible output formatting
    if (line.startsWith('┌─') || line.startsWith('├─') || line.startsWith('└─')) {
      return chalk.hex(this.colors.borderFg)(line);
    }

    // Collapsed content indicator
    if (isCollapsed && line.includes('... [collapsed]')) {
      return chalk.hex(this.colors.dimFg)(line);
    }

    // More flexible patterns for log levels
    if (/^(?:Error|❌|✖|✘)[:\s]/i.test(line)) return chalk.hex(this.colors.errorFg)(line);
    if (/^(?:Warning|Warn|⚠|⚡)[:\s]/i.test(line)) return chalk.hex(this.colors.warnFg)(line);
    if (/^(?:Info|Info:|Information)[:\s]/i.test(line)) return chalk.hex(this.colors.infoFg)(line);
    if (/^(?:Debug|Trace|Verbose)[:\s]/i.test(line)) return chalk.hex(this.colors.dimFg)(line);

    // Headings (1-6 levels)
    if (/^\s*#{1,6}\s+/.test(line)) return chalk.bold.hex(this.colors.accentFg)(line);
    
    // List items (bullet, number, or other markers)
    if (/^\s*[-*+•]\s+/.test(line)) return chalk.hex(this.colors.inputFg)(line);
    if (/^\s*\d+[.)]\s+/.test(line)) return chalk.hex(this.colors.inputFg)(line);

    // Code blocks and inline code
    if (line.startsWith('```') || line.endsWith('```')) {
      return chalk.hex(this.colors.codeFg)(line);
    }

    // Role prefixes
    if (line.startsWith('[User]') || line.startsWith('User:')) return chalk.hex(this.colors.userTag)(line);
    if (line.startsWith('[Assistant]') || line.startsWith('Assistant:')) return chalk.hex(this.colors.assistantTag)(line);
    if (line.startsWith('[System]') || line.startsWith('System:')) return chalk.hex(this.colors.systemTag)(line);

    // Smart formatting: detect and highlight important patterns
    // Tool calls and results
    if (/^tool_/i.test(line)) return chalk.hex(this.colors.accentFg)(line);
    if (/^result:/i.test(line)) return chalk.hex(this.colors.accentFg)(line);

    // File paths and URLs
    if (/^\//.test(line) || /^https?:\/\//.test(line)) {
      return chalk.hex(this.colors.infoFg)(line);
    }

    return line;
  }

  private wordWrap(text: string, width: number): string[] {
    // Use getStringWidth for accurate display width measurement
    if (getStringWidth(text) <= width) return [text];

    const lines: string[] = [];
    let remaining = text;
    
    while (getStringWidth(remaining) > width) {
      let breakPoint = 0;
      let currentWidth = 0;
      let lastSpacePos = -1;
      
      for (let i = 0; i < remaining.length; i++) {
        const char = remaining[i];
        
        // Handle ANSI escape sequences
        if (char === '\x1b') {
          // Find the end of the ANSI sequence (ends with 'm')
          const endSeq = remaining.indexOf('m', i);
          if (endSeq !== -1) {
            i = endSeq;
          }
          continue;
        }
        
        const charWidth = getStringWidth(char);
        
        if (currentWidth + charWidth > width) {
          // We've exceeded the width
          if (lastSpacePos > 0 && currentWidth > width * 0.3) {
            // Use the last space if it's not too close to the start
            breakPoint = lastSpacePos;
          } else {
            // No good space found, break here
            breakPoint = i;
          }
          break;
        }
        
        if (char === ' ') {
          lastSpacePos = i;
        }
        
        currentWidth += charWidth;
      }
      
      if (breakPoint === 0 && getStringWidth(remaining) > width) {
        // No break point found, force break at width
        let charCount = 0;
        let accumulatedWidth = 0;
        for (let i = 0; i < remaining.length && accumulatedWidth < width; i++) {
          const char = remaining[i];
          if (char === '\x1b') {
            const endSeq = remaining.indexOf('m', i);
            if (endSeq !== -1) i = endSeq;
            continue;
          }
          accumulatedWidth += getStringWidth(char);
          if (accumulatedWidth <= width) {
            charCount = i + 1;
          }
        }
        breakPoint = charCount;
      }
      
      if (breakPoint <= 0) {
        breakPoint = Math.min(remaining.length, Math.floor(width));
      }
      
      // Use ANSI-aware slicing
      const before = sliceAnsiSafe(remaining, 0, breakPoint).replace(/\s*$/, '');
      const after = sliceAnsiSafe(remaining, breakPoint).replace(/^\s+/, '');
      lines.push(before);
      remaining = after || '';
    }
    
    if (remaining) lines.push(remaining);
    return lines;
  }

  private setupInputHandling(): void {
    const inputKeys: Record<string, (ch: string, key: any) => boolean> = {
      'C-k': () => { void this.actions.onCopy?.(); return true; },
      'C-g': () => { void this.actions.onPaste?.(); return true; },
      'C-f': () => { void this.actions.onBrowser?.(); return true; },
      'C-o': () => { void this.sessionControls.onToggleMode?.(); return true; },
      'f2': () => { void this.sessionControls.onSave?.(); return true; },
      'f3': () => { void this.sessionControls.onStatus?.(); return true; },
      'C-t': () => { this.toggleCollapsedOutputs(); return true; }, // Toggle collapsed outputs
    };

    for (const [key, handler] of Object.entries(inputKeys)) {
      this.screen.key([key], (ch, k) => { handler(ch, k); });
      this.screenKeyBindings.push({ key, handler: () => handler('', {}) });
    }

    this.screen.key(['resize'], () => {
      this.queueRender();
    });
    this.screenKeyBindings.push({ key: 'resize', handler: () => this.queueRender() });

    this.screen.key(['pageup'], () => {
      const height = this.innerHeight();
      // Scroll up to see older messages (positive delta increases offset from bottom)
      this.scrollBy(Math.max(3, Math.floor(height * 0.5)));
    });
    this.screenKeyBindings.push({ key: 'pageup', handler: () => this.scrollBy(Math.max(3, Math.floor(this.innerHeight() * 0.5))) });

    this.screen.key(['pagedown'], () => {
      const height = this.innerHeight();
      // Scroll down to see newer messages (negative delta decreases offset from bottom)
      this.scrollBy(-Math.max(3, Math.floor(height * 0.5)));
    });
    this.screenKeyBindings.push({ key: 'pagedown', handler: () => this.scrollBy(-Math.max(3, Math.floor(this.innerHeight() * 0.5))) });

    this.screen.key(['home'], () => this.scrollToTop());
    this.screenKeyBindings.push({ key: 'home', handler: () => this.scrollToTop() });

    this.screen.key(['end'], () => this.scrollToBottom());
    this.screenKeyBindings.push({ key: 'end', handler: () => this.scrollToBottom() });

    this.screen.key(['C-r'], () => {
      this.toggleHistorySearch();
      return true;
    });
    this.screenKeyBindings.push({ key: 'C-r', handler: () => this.toggleHistorySearch() });

    this.screen.key(['escape'], (_ch: any, _key: any) => {
      if (this.historySearchActive) {
        this.clearHistorySearch();
        this.renderAll();
        return;
      }

      if (this.taskControls.isRunning?.()) {
        this.escapeCancelCount++;
        if (this.escapeCancelCount >= 2) {
          this.taskControls.requestCancel?.();
          this.clearEscapeCancelState();
          this.appendLine(chalk.hex(this.colors.warnFg)('⚠ Cancelling running task...'));
        } else {
          this.armEscapeCancelReset();
          this.appendLine(chalk.hex(this.colors.infoFg)('· Press Escape again to cancel the running task.'));
        }
        return;
      }

      if (this.inputValue || this.suggestions.length > 0) {
        this.clearInput();
      }
    });
    this.screenKeyBindings.push({ key: 'escape', handler: () => {} }); // Complex handler, can't easily replicate

    this.screen.key(['tab'], () => {
      if (this.historySearchActive) {
        this.acceptHistorySearch();
        return;
      }
      if (this.completionState && this.suggestions.length >= 1 && this.suggestionIndex >= 0) {
        this.applySuggestion(this.getSelectedSuggestion());
      }
    });
    this.screenKeyBindings.push({ key: 'tab', handler: () => {} });

    let upDownTimeout: NodeJS.Timeout | null = null;
    let upBurst = 0;
    let downBurst = 0;

    this.screen.key(['up'], () => {
      upBurst++;
      if (upDownTimeout) clearTimeout(upDownTimeout);
      upDownTimeout = setTimeout(() => {
        if (upBurst > 1) {
          this.transcriptBox.scroll(-(upBurst * 2));
          this.queueRender();
        } else if (upBurst === 1) {
          if (this.suggestions.length > 0 && !this.historySearchActive) {
            this.suggestionIndex = (this.suggestionIndex - 1 + this.suggestions.length) % this.suggestions.length;
            this.queueRender();
          } else {
            this.navigateHistory(-1);
          }
        }
        upBurst = 0;
        downBurst = 0;
      }, 20);
    });

    this.screen.key(['down'], () => {
      downBurst++;
      if (upDownTimeout) clearTimeout(upDownTimeout);
      upDownTimeout = setTimeout(() => {
        if (downBurst > 1) {
          this.transcriptBox.scroll(downBurst * 2);
          this.queueRender();
        } else if (downBurst === 1) {
          if (this.suggestions.length > 0 && !this.historySearchActive) {
            this.suggestionIndex = (this.suggestionIndex + 1) % this.suggestions.length;
            this.queueRender();
          } else {
            this.navigateHistory(1);
          }
        }
        upBurst = 0;
        downBurst = 0;
      }, 20);
    });
    this.screenKeyBindings.push({ key: 'down', handler: () => {} });

    this.screen.key(['left'], () => {
      this.historyIndex = -1;
      this.cursor = Math.max(0, this.cursor - 1);
      this.queueRender();
    });
    this.screenKeyBindings.push({ key: 'left', handler: () => {} });

    this.screen.key(['right'], () => {
      this.historyIndex = -1;
      this.cursor = Math.min(this.inputValue.length, this.cursor + 1);
      this.queueRender();
    });
    this.screenKeyBindings.push({ key: 'right', handler: () => {} });

    this.screen.key(['backspace'], () => {
      this.historyIndex = -1;
      if (this.historySearchActive) {
        this.historySearchQuery = this.historySearchQuery.slice(0, -1);
        this.updateHistorySearchResults();
        return;
      }
      if (this.cursor > 0) {
        this.inputValue = `${this.inputValue.slice(0, this.cursor - 1)}${this.inputValue.slice(this.cursor)}`;
        this.cursor -= 1;
        this.refreshCompletionState();
      }
    });
    this.screenKeyBindings.push({ key: 'backspace', handler: () => {} });

    this.screen.key(['delete'], () => {
      this.historyIndex = -1;
      if (this.cursor < this.inputValue.length) {
        this.inputValue = `${this.inputValue.slice(0, this.cursor)}${this.inputValue.slice(this.cursor + 1)}`;
        this.refreshCompletionState();
      }
    });
    this.screenKeyBindings.push({ key: 'delete', handler: () => {} });

    this.screen.key(['C-a', 'home'], () => {
      this.historyIndex = -1;
      this.cursor = 0;
      this.queueRender();
    });
    this.screenKeyBindings.push({ key: 'C-a', handler: () => {} });

    this.screen.key(['C-e', 'end'], () => {
      this.historyIndex = -1;
      this.cursor = this.inputValue.length;
      this.queueRender();
    });
    this.screenKeyBindings.push({ key: 'C-e', handler: () => {} });

    this.screen.key(['C-u'], () => {
      this.historyIndex = -1;
      this.inputValue = this.inputValue.slice(this.cursor);
      this.cursor = 0;
      this.refreshCompletionState();
    });
    this.screenKeyBindings.push({ key: 'C-u', handler: () => {} });

    this.screen.key(['C-w'], () => {
      this.historyIndex = -1;
      const before = this.inputValue.slice(0, this.cursor);
      const after = this.inputValue.slice(this.cursor);
      const spaceIdx = before.lastIndexOf(' ');
      this.inputValue = `${before.slice(0, Math.max(0, spaceIdx))}${after}`;
      this.cursor = Math.max(0, spaceIdx);
      this.refreshCompletionState();
    });
    this.screenKeyBindings.push({ key: 'C-w', handler: () => {} });

    this.screen.key(['C-d'], () => {
      if (this.inputValue.length === 0) {
        this.close();
        process.exit(0);
      }
    });
    this.screenKeyBindings.push({ key: 'C-d', handler: () => {} });

    this.screen.key(['enter'], () => {
      if (this.historySearchActive) {
        this.acceptHistorySearch();
        return;
      }
      const next = this.inputValue.trimEnd();
      this.clearInput();
      if (this.inputHandler && next) {
        // Handle promise rejections
        this.inputHandler(next).catch((error) => {
          this.appendLine(chalk.hex(this.colors.errorFg)(`Error: ${error instanceof Error ? error.message : String(error)}`));
        });
      }
    });
    this.screenKeyBindings.push({ key: 'enter', handler: () => {} });

    this.screen.key(['C-c'], (_ch: any, _key: any) => {
      this.interruptCount++;
      if (this.interruptCount >= 2) {
        this.close();
        process.exit(0);
      }
      this.armInterruptReset();
      this.appendLine(chalk.hex(this.colors.infoFg)('· Press Ctrl+C again to exit.'));
    });
    this.screenKeyBindings.push({ key: 'C-c', handler: () => {} });

    // Catch-all for printable character input
    this.keypressHandler = (ch, key) => {
      if (!this.inputFocused) return;
      if (!key || !ch) return;
      if (key.ctrl || key.meta) return;

      // Skip keys that have dedicated screen.key() handlers
      switch (key.name) {
        case 'escape': case 'tab': case 'enter': case 'return':
        case 'up': case 'down': case 'left': case 'right':
        case 'backspace': case 'delete': case 'home': case 'end':
        case 'pageup': case 'pagedown':
        case 'f1': case 'f2': case 'f3': case 'f4': case 'f5': case 'f6':
        case 'f7': case 'f8': case 'f9': case 'f10': case 'f11': case 'f12':
          return;
      }

      if (this.historySearchActive) {
        this.historySearchQuery += ch;
        this.updateHistorySearchResults();
        return;
      }

      this.historyIndex = -1;
      this.inputValue = `${this.inputValue.slice(0, this.cursor)}${ch}${this.inputValue.slice(this.cursor)}`;
      this.cursor += ch.length;
      this.refreshCompletionState();
    };
    this.screen.on('keypress', this.keypressHandler);
  }

  private setupTranscriptScroll(): void {
    this.transcriptBox.on('wheeldown', () => {
      // Scroll down (newer messages)
      this.scrollBy(-3);
    });
    this.transcriptBox.on('wheelup', () => {
      // Scroll up (older messages)
      this.scrollBy(3);
    });
    // Enable clipboard copy of transcript content (Ctrl+Y)
    this.screen.key(['C-y'], () => {
      try {
        const content = this.transcriptBox.getContent();
        // Write to system clipboard using clipboardy
        const clipboardy = require('clipboardy');
        clipboardy.writeSync(content);
        // Optional visual feedback
        this.transcriptBox.setContent(content + '\n[Copied to clipboard]');
        this.screen.render();
        setTimeout(() => {
          // Remove feedback after a short delay
          this.transcriptBox.setContent(content);
          this.screen.render();
        }, 1500);
      } catch (e) {
        // Fail silently if clipboard unavailable
      }
    });

    // Scroll shortcuts for transcriptBox (compatible across OS)
    const scrollStep = 1;
    this.screen.key(['up', 'k'], () => {
      this.transcriptBox.scroll(-scrollStep);
      this.screen.render();
    });
    this.screen.key(['down', 'j'], () => {
      this.transcriptBox.scroll(scrollStep);
      this.screen.render();
    });
    this.screen.key(['pageup'], () => {
      this.transcriptBox.scroll(-Number(this.transcriptBox.height));
      this.screen.render();
    });
    this.screen.key(['pagedown'], () => {
      this.transcriptBox.scroll(Number(this.transcriptBox.height));
      this.screen.render();
    });
    this.screen.key(['home'], () => {
      this.transcriptBox.scrollTo(0);
      this.screen.render();
    });
    this.screen.key(['end'], () => {
      this.transcriptBox.scrollTo(this.transcriptBox.getScrollHeight());
      this.screen.render();
    });

    this.scrollHandler = () => {
      const scrollPerc = this.transcriptBox.getScrollPerc();
      this.isAtBottom = scrollPerc >= 99;
      if (this.isAtBottom) {
        this.transcriptHasUnread = false;
        this.transcriptScrollOffset = 0;
      }
      this.queueRender();
    };
    this.transcriptBox.on('scroll', this.scrollHandler);
  }

  private scrollBy(delta: number): void {
    const total = this.wrapLines(this.innerWidth()).length;
    const height = this.innerHeight();
    const maxOffset = Math.max(0, total - height);
    this.transcriptScrollOffset = Math.max(0, Math.min(maxOffset, this.transcriptScrollOffset + delta));
    this.isAtBottom = this.transcriptScrollOffset === 0;
    this.transcriptHasUnread = this.transcriptScrollOffset > 0 && !this.isAtBottom;
    this.queueRender();
  }

  private scrollToTop(): void {
    const total = this.wrapLines(this.innerWidth()).length;
    const height = this.innerHeight();
    this.transcriptScrollOffset = Math.max(0, total - height);
    // Fix: isAtBottom should be true if we can see all content (maxOffset === 0)
    this.isAtBottom = this.transcriptScrollOffset === 0;
    this.transcriptHasUnread = false;
    this.queueRender();
  }

  private scrollToBottom(): void {
    this.transcriptScrollOffset = 0;
    this.isAtBottom = true;
    this.transcriptHasUnread = false;
    this.queueRender();
  }

  private refreshCompletionState(): void {
    this.completionState = this.suggestionResolver
      ? this.suggestionResolver(this.inputValue, this.cursor)
      : null;
    this.suggestions = this.completionState?.suggestions ?? [];
    this.suggestionIndex = Math.min(this.suggestionIndex, Math.max(this.suggestions.length - 1, 0));
    this.historySearchActive = false;
    this.queueRender();
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

  private applySuggestion(value: string): void {
    const state = this.completionState;
    if (!state) return;
    // Only apply if different from current range
    const currentRange = this.inputValue.slice(state.range.start, state.range.end);
    if (currentRange === value) return;
    
    const before = this.inputValue.slice(0, state.range.start);
    const after = this.inputValue.slice(state.range.end);
    this.inputValue = `${before}${value}${after}`;
    this.cursor = before.length + value.length;
    this.refreshCompletionState();
  }

  private getSelectedSuggestion(): string {
    return this.suggestions[this.suggestionIndex] ?? this.suggestions[0] ?? '';
  }

  private navigateHistory(direction: -1 | 1): void {
    if (this.history.length === 0) return;

    if (this.historyIndex === -1) {
      this.historyDraft = this.inputValue;
      this.historyIndex = direction === -1 ? this.history.length - 1 : 0;
    } else {
      const newIndex = this.historyIndex + direction;
      if (newIndex < 0 || newIndex >= this.history.length) {
        this.historyIndex = -1;
        this.inputValue = this.historyDraft;
        this.cursor = this.inputValue.length;
        this.refreshCompletionState();
        return;
      }
      this.historyIndex = newIndex;
    }

    if (this.historyIndex >= 0 && this.historyIndex < this.history.length) {
      this.inputValue = this.history[this.historyIndex];
      this.cursor = this.inputValue.length;
      this.refreshCompletionState();
    }
  }

  private toggleHistorySearch(): void {
    this.historySearchActive = !this.historySearchActive;
    if (this.historySearchActive) {
      this.historySearchQuery = '';
      this.historySearchResults = this.history.map((_, i) => i).reverse();
      this.historySearchIndex = 0;
    } else {
      this.clearHistorySearch();
    }
    this.queueRender();
  }

  private clearHistorySearch(): void {
    this.historySearchActive = false;
    this.historySearchQuery = '';
    this.historySearchResults = [];
    this.historySearchIndex = 0;
  }

  private updateHistorySearchResults(): void {
    const query = this.historySearchQuery.toLowerCase();
    this.historySearchResults = this.history
      .map((value, i) => ({ value, i }))
      .filter((item) => item.value.toLowerCase().includes(query))
      .map((item) => item.i)
      .reverse();
    this.historySearchIndex = 0;
    this.queueRender();
  }

  private getHistorySearchSelection(): string {
    const idx = this.historySearchResults[this.historySearchIndex];
    return typeof idx === 'number' ? (this.history[idx] ?? '') : '';
  }

  private acceptHistorySearch(): void {
    const value = this.getHistorySearchSelection();
    if (value) {
      this.inputValue = value;
      this.cursor = value.length;
    }
    this.clearHistorySearch();
    this.refreshCompletionState();
  }

  private handleOutput(entry: OutputEntry): void {
    if (entry.level === 'debug') return;
    
    // Handle streaming chunks
    if (entry.kind === 'raw' && this.streamingState.isStreaming) {
      this.streamingState.currentChunk += entry.message;
      this.invalidateWrapCache();
      this.queueRender();
      return;
    }
    
    // Handle raw messages (non-streaming)
    if (entry.kind === 'raw') {
      const markdown = renderMarkdown(entry.message);
      this.appendRaw(markdown);
      return;
    }
    
    // Handle streaming start/end indicators
    const icon = entry.level === 'error'
      ? chalk.hex(this.colors.errorFg)('✖')
      : entry.level === 'warn'
        ? chalk.hex(this.colors.warnFg)('⚠')
        : chalk.hex(this.colors.dimFg)('·');
    
    const message = entry.message;
    
    // Detect streaming indicators in messages
    if (message.includes('Streaming...') || message.includes('streaming')) {
      this.streamingState = {
        isStreaming: true,
        currentChunk: '',
        streamId: `stream_${Date.now()}`,
      };
    } else if (message.includes('Stream complete') || message.includes('stream ended')) {
      const markdown = renderMarkdown(this.streamingState.currentChunk);
      this.appendRaw(markdown);
      this.streamingState = {
        isStreaming: false,
        currentChunk: '',
        streamId: '',
      };
    }
    
    this.appendLine(`${icon} ${message}`);
  }

  private armInterruptReset(): void {
    if (this.interruptResetToken) clearTimeout(this.interruptResetToken);
    this.interruptResetToken = setTimeout(() => this.clearInterruptState(), 1500);
  }

  private clearInterruptState(): void {
    this.interruptCount = 0;
    if (this.interruptResetToken) {
      clearTimeout(this.interruptResetToken);
      this.interruptResetToken = null;
    }
  }

  private armEscapeCancelReset(): void {
    if (this.escapeCancelResetToken) clearTimeout(this.escapeCancelResetToken);
    this.escapeCancelResetToken = setTimeout(() => this.clearEscapeCancelState(), 1500);
  }

  private clearEscapeCancelState(): void {
    this.escapeCancelCount = 0;
    if (this.escapeCancelResetToken) {
      clearTimeout(this.escapeCancelResetToken);
      this.escapeCancelResetToken = null;
    }
  }

  private visibleLength(value: string): number {
    return getStringWidth(value);
  }

  private truncate(value: string, width: number): string {
    const clean = value.replace(/\s+/g, ' ').trim();
    const displayWidth = getStringWidth(clean);
    if (displayWidth <= width) return clean;
    // Use ANSI-aware slicing for proper truncation
    return sliceAnsiSafe(clean, 0, Math.max(0, width - 1)) + '…';
  }

  // Smart Output Formatting: Methods for collapsible outputs
  private createCollapsibleOutput(content: string, maxLines: number = 10): string[] {
    const lines = content.split('\n');
    if (lines.length <= maxLines) {
      return lines;
    }
    
    const collapsedId = `collapsed_${Date.now()}`;
    this.collapsedOutputs.add(collapsedId);
    
    const visibleLines = lines.slice(0, maxLines);
    const hiddenCount = lines.length - maxLines;
    
    return [
      ...visibleLines,
      chalk.hex(this.colors.dimFg)(`... [${hiddenCount} more lines collapsed] ${chalk.hex(this.colors.accentFg)(`[+]`)}`),
    ];
  }

  private toggleCollapsedOutput(collapsedId: string): void {
    if (this.collapsedOutputs.has(collapsedId)) {
      this.collapsedOutputs.delete(collapsedId);
    } else {
      this.collapsedOutputs.add(collapsedId);
    }
    this.queueRender();
  }

  private toggleCollapsedOutputs(): void {
    // Toggle all collapsed outputs
    if (this.collapsedOutputs.size > 0) {
      this.collapsedOutputs.clear();
    } else {
      // This would require tracking all collapsible items, for now just show a message
      this.appendLine(chalk.hex(this.colors.infoFg)('No collapsed outputs to expand'));
    }
    this.queueRender();
  }

  // Performance Optimization: Invalidate wrap cache when content changes significantly
  private invalidateWrapCache(): void {
    this.wrapCache = [];
    this.lastWrapWidth = 0;
  }

  private enableSelectionCopy(): void {
    let startEvent: any = null;

    const setupBoxEvents = (box: any) => {
      box.on('mousedown', (data: any) => {
        startEvent = data;
      });

      box.on('mouseup', (data: any) => {
        if (!startEvent) return;
        const endEvent = data;

        if (
          typeof startEvent.x === 'number' &&
          typeof startEvent.y === 'number' &&
          typeof endEvent.x === 'number' &&
          typeof endEvent.y === 'number'
        ) {
          const borderOffset = 1;
          const startX = Math.max(1, startEvent.x - (box.al || 0) - borderOffset + 1);
          const startY = Math.max(1, startEvent.y - (box.at || 0) - borderOffset + 1);
          const endX = Math.max(1, endEvent.x - (box.al || 0) - borderOffset + 1);
          const endY = Math.max(1, endEvent.y - (box.at || 0) - borderOffset + 1);

          if (startX !== endX || startY !== endY) {
            const text = this.extractSelection(box, { x: startX, y: startY }, { x: endX, y: endY });
            if (text && text.trim().length > 0) {
              try {
                const clipboardy = require('clipboardy');
                clipboardy.writeSync(text);
                this.showCopyAlert('Copied to clipboard');
              } catch (e) {
                // Fail silently
              }
            }
          }
        }
        startEvent = null;
      });
    };

    if (this.transcriptBox) {
      setupBoxEvents(this.transcriptBox);
    }
    if (this.inputBox) {
      setupBoxEvents(this.inputBox);
    }
  }

  private extractSelection(
    box: any,
    start: { x: number; y: number },
    end: { x: number; y: number }
  ): string {
    const content = box.getContent ? box.getContent() : '';
    const separator = (content.includes('\\n') && !content.includes('\n')) ? '\\n' : '\n';
    const lines = content.split(/\r?\n|\\n/);
    if (lines.length === 0) return '';

    let startY = start.y - 1;
    let endY = end.y - 1;
    let startX = start.x - 1;
    let endX = end.x - 1;

    if (startY > endY || (startY === endY && startX > endX)) {
      const tempY = startY; startY = endY; endY = tempY;
      const tempX = startX; startX = endX; endX = tempX;
    }

    startY = Math.max(0, Math.min(startY, lines.length - 1));
    endY = Math.max(0, Math.min(endY, lines.length - 1));

    if (startY === endY) {
      const line = lines[startY] || '';
      const s = Math.max(0, Math.min(startX, line.length));
      const e = (startX > 0) ? endX + 1 : endX;
      return line.substring(s, e);
    } else {
      const result: string[] = [];
      for (let y = startY; y <= endY; y++) {
        const line = lines[y] || '';
        if (y === startY) {
          result.push(line.substring(startX));
        } else if (y === endY) {
          result.push(line.substring(0, endX));
        } else {
          result.push(line);
        }
      }
      return result.join(separator);
    }
  }

  private showCopyAlert(message: string): void {
    const alertBox = blessed.box({
      parent: this.screen,
      top: 'center',
      left: 'center',
      width: Math.max(24, message.length + 4),
      height: 3,
      border: { type: 'line' },
      style: {
        fg: this.colors.accentFg || '#7aa2f7',
        bg: this.colors.transcriptBg,
        border: { fg: this.colors.accentFg || '#7aa2f7' }
      },
      content: `\n ${message}`,
      align: 'center'
    });
    this.screen.render();
    setTimeout(() => {
      alertBox.destroy();
      this.screen.render();
    }, 1500);
  }
}
