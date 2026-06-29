import fs from 'fs-extra';
import path from 'path';
import { getSubagentManager } from '../agents/subagent.js';
import { getModelCompletionEntries } from '../providers/models.js';

export type CompletionMode = 'slash' | 'mention';

export interface CompletionItem {
  value: string;
  description?: string;
  group?: string;
}

export interface CompletionState {
  mode: CompletionMode;
  suggestions: string[];
  token: string;
  items?: CompletionItem[];
}

export interface CompletionContext extends CompletionState {
  range: {
    start: number;
    end: number;
  };
}

export function getCompletionState(line: string): CompletionState | null {
  const context = getCompletionContext(line);
  if (!context) return null;
  return {
    mode: context.mode,
    suggestions: context.suggestions,
    token: context.token,
  };
}

export function getCompletionContext(line: string, cursor = line.length): CompletionContext | null {
  const safeCursor = Math.max(0, Math.min(cursor, line.length));
  const leadingWhitespace = line.match(/^\s*/)?.[0]?.length ?? 0;
  const slashStart = leadingWhitespace;

  if (line.slice(slashStart).startsWith('/')) {
    const commandText = line.slice(slashStart, safeCursor);
    const tokenEnd = getTokenEnd(line, safeCursor);
    const commandItems = getSlashCommandItems();
    const suggestions = getSlashSuggestions(commandText);
    return {
      mode: 'slash',
      token: line.slice(slashStart, tokenEnd),
      suggestions: suggestions.length > 0 ? suggestions : getSlashCommandList(),
      items: commandItems,
      range: {
        start: slashStart,
        end: tokenEnd,
      },
    };
  }

  const mentionBounds = getMentionBounds(line, safeCursor);
  if (mentionBounds) {
    const token = line.slice(mentionBounds.start, mentionBounds.end);
    const mentionPrefix = token.slice(1);
    const mentionSuggestions = getMentionSuggestions(mentionPrefix).map((item) => `@${item.value}`);
    return {
      mode: 'mention',
      token,
      suggestions: mentionSuggestions,
      items: getMentionSuggestionItems(mentionPrefix),
      range: mentionBounds,
    };
  }

  return null;
}

export function getSlashCommandList(): string[] {
  return getSlashCommandItems().map((item) => item.value);
}

export function getSlashSuggestions(input: string): string[] {
  const [command, ...rest] = input.split(/\s+/);
  const prefix = rest.join(' ');
  const groups: Record<string, CompletionItem[]> = {
    '/auth': [
      { value: '/auth status', description: 'Show configured BYOK providers' },
      { value: '/auth list', description: 'List supported auth providers' },
      { value: '/auth set openai', description: 'Store an OpenAI API key securely' },
      { value: '/auth set gemini', description: 'Store a Google AI Studio key securely' },
      { value: '/auth set anthropic', description: 'Store an Anthropic API key securely' },
      { value: '/auth set openrouter', description: 'Store an OpenRouter API key securely' },

      { value: '/auth set deepseek', description: 'Store a DeepSeek API key securely' },

      { value: '/auth clear openai', description: 'Remove stored OpenAI credentials' },
      { value: '/auth clear gemini', description: 'Remove stored Google AI Studio credentials' },
    ],
    '/connect': [
      { value: '/connect openai', description: 'Alias for /auth set openai' },
      { value: '/connect gemini', description: 'Alias for /auth set gemini' },
      { value: '/connect anthropic', description: 'Alias for /auth set anthropic' },
      { value: '/connect openrouter', description: 'Alias for /auth set openrouter' },
      { value: '/connect groq', description: 'Alias for /auth set groq' },
    ],
    '/mode': [
      { value: '/mode build', description: 'Allow tool use and edits' },
      { value: '/mode plan', description: 'Plan only, edits restricted' },
    ],
    '/plan': [
      { value: '/plan show', description: 'Display the active plan' },
      { value: '/plan clear', description: 'Clear the active plan' },
      { value: '/plan export', description: 'Export the active plan' },
    ],
    '/permissions': [
      { value: '/permissions list', description: 'List permission rules' },
      { value: '/permissions set', description: 'Set a permission rule' },
      { value: '/permissions mode', description: 'Switch permission preset' },
      { value: '/permissions clear', description: 'Clear custom rules' },
    ],
    '/skills': [
      { value: '/skills help', description: 'Show skill commands' },
      { value: '/skills list', description: 'List installed skills' },
      { value: '/skills search', description: 'Search the registry' },
      { value: '/skills suggest', description: 'Suggest skills for this repo' },
      { value: '/skills install', description: 'Install a skill' },
      { value: '/skills list-local', description: 'Show local skills' },
    ],
    '/search': [
      { value: '/search --rebuild', description: 'Rebuild the search index' },
    ],
    '/model': getModelCompletionEntries().map((model) => ({
      value: `/model ${model.value}`,
      description: model.description,
    })),
  };

  if (!input.endsWith(' ') && rest.length === 0) {
    if (groups[command]) {
      return groups[command].map((item) => item.value);
    }
    return getSlashCommandList().filter((c) => c.startsWith(command));
  }

  const options = groups[command];
  if (!options) {
    return [];
  }

  return options
    .map((option) => option.value)
    .filter((option) => option.slice(command.length).trimStart().startsWith(prefix))
    .map((option) => option);
}

export function getMentionSuggestions(prefix: string): CompletionItem[] {
  return getMentionSuggestionItems(prefix);
}

export function getSlashCommandItems(): CompletionItem[] {
  return [
    { value: '/model', description: 'Switch the active model', group: 'core' },
    { value: '/review', description: 'Review files or diffs', group: 'core' },
    { value: '/suggest', description: 'Generate a code suggestion', group: 'core' },
    { value: '/search', description: 'Search the codebase', group: 'core' },
    { value: '/compress', description: 'Compress conversation context', group: 'session' },
    { value: '/clear', description: 'Clear the current conversation', group: 'session' },
    { value: '/sessions', description: 'List saved sessions', group: 'session' },
    { value: '/save', description: 'Save the current session', group: 'session' },
    { value: '/skills', description: 'Manage skills and registry', group: 'workspace' },
    { value: '/theme', description: 'Switch CLI theme', group: 'workspace' },
    { value: '/status', description: 'Show session status', group: 'session' },
    { value: '/copy', description: 'Copy the last assistant response', group: 'session' },
    { value: '/paste', description: 'Paste clipboard content', group: 'session' },
    { value: '/permissions', description: 'Inspect or change permissions', group: 'workspace' },
    { value: '/allow-all', description: 'Allow all tools for this session', group: 'workspace' },
    { value: '/deny-all', description: 'Disable permission bypass', group: 'workspace' },
    { value: '/mode', description: 'Switch build or plan mode', group: 'session' },
    { value: '/plan', description: 'Manage the active plan', group: 'session' },
    { value: '/workspace', description: 'Show live repository digest', group: 'workspace' },
    { value: '/task', description: 'Delegate work to a subagent', group: 'agent' },
    { value: '/connect', description: 'Set up BYOK auth provider (alias for /auth set)', group: 'auth' },
    { value: '/auth', description: 'Manage BYOK API keys securely', group: 'auth' },
    { value: '/models', description: 'List available models', group: 'core' },
    { value: '/exit', description: 'Exit the application', group: 'session' },
    { value: '/cancel', description: 'Cancel multiline input', group: 'session' },
  ];
}

function getMentionSuggestionItems(prefix: string): CompletionItem[] {
  const subagentManager = getSubagentManager();
  const subagentMatches = subagentManager
    .listSubagents()
    .filter((name) => name.startsWith(prefix))
    .map((name) => ({
      value: name,
      description: 'Subagent',
      group: 'agent',
    }));

  const workspaceMatch = 'workspace'.startsWith(prefix) ? [{
    value: 'workspace',
    description: 'Inject structural digest of repository',
    group: 'workspace',
  }] : [];

  const fileMatches = getPathSuggestions(prefix);

  return Array.from(
    new Map<string, CompletionItem>([
      ...subagentMatches.map((item) => [item.value, item] as const),
      ...workspaceMatch.map((item) => [item.value, item] as const),
      ...fileMatches.map((item) => [item.value, item] as const),
    ]).values(),
  );
}

function getMentionBounds(line: string, cursor: number): { start: number; end: number } | null {
  const start = findTokenStart(line, cursor);
  const end = getTokenEnd(line, cursor);
  if (start === end) return null;
  const token = line.slice(start, end);
  if (!token.startsWith('@')) return null;
  return { start, end };
}

function findTokenStart(line: string, cursor: number): number {
  let index = cursor;
  while (index > 0 && !/\s/.test(line[index - 1] ?? '')) {
    index--;
  }
  return index;
}

function getTokenEnd(line: string, cursor: number): number {
  let index = cursor;
  while (index < line.length && !/\s/.test(line[index] ?? '')) {
    index++;
  }
  return index;
}

function getPathSuggestions(prefix: string): CompletionItem[] {
  const normalizedPrefix = prefix.replace(/\\/g, '/');
  const cwd = process.cwd();
  const hasPathSeparator = normalizedPrefix.includes('/');
  const baseDir = hasPathSeparator ? path.dirname(normalizedPrefix) : '';
  const partial = hasPathSeparator ? path.basename(normalizedPrefix) : normalizedPrefix;
  const searchDir = hasPathSeparator ? path.resolve(cwd, baseDir || '.') : cwd;

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(searchDir, { withFileTypes: true });
  } catch {
    return [];
  }

  return entries
    .filter((entry) => entry.name.startsWith(partial))
    .map((entry) => {
      const relPath = hasPathSeparator
        ? path.posix.join(baseDir || '', entry.name)
        : entry.name;
      const value = `${relPath}${entry.isDirectory() ? '/' : ''}`;
      return {
        value,
        description: entry.isDirectory() ? 'Directory' : 'File',
        group: 'path',
      };
    })
    .sort((a, b) => a.value.localeCompare(b.value));
}
