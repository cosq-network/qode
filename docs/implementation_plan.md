# Qode Implementation Plan

This document outlines a phased roadmap for major Qode improvements, organized by dependency order and implementation difficulty. Updated to address feature gaps identified in comparison with OpenAI Codex CLI (v0.142, 92K stars, Rust).

---

## Table of Contents

### Completed Phases (Phases 0–9)
1. [Phase 0: Foundation — Tool System Refactoring](#phase-0-foundation--tool-system-refactoring) ✅
2. [Phase 1: Foundation — Provider System Improvements](#phase-1-foundation--provider-system-improvements) ✅
3. [Phase 2: Foundation — Permission System](#phase-2-foundation--permission-system) ✅
4. [Phase 3: Core — Enhanced Tools (grep, glob, apply_patch, todowrite, web)](#phase-3-core--enhanced-tools) ✅
5. [Phase 4: Core — Compression & Pruning](#phase-4-core--compression--pruning) ✅
6. [Phase 5: Core — Local Model Support](#phase-5-core--local-model-support) ✅
7. [Phase 6: Advanced — Plan Mode & Progress Tracking](#phase-6-advanced--plan-mode--progress-tracking) ✅
8. [Phase 7: Advanced — Subagent Flow](#phase-7-advanced--subagent-flow) ✅
9. [Phase 8: Advanced — Subscription Login](#phase-8-advanced--subscription-login) ✅
10. [Phase 9: Advanced — LLM-Powered Search](#phase-9-advanced--llm-powered-search) ✅

### New Phases (Phases 10–21)
11. [Phase 10: Security — Sandboxed Execution](#phase-10-security--sandboxed-execution)
12. [Phase 11: Ecosystem — MCP Protocol Support](#phase-11-ecosystem--mcp-protocol-support)
13. [Phase 12: Ecosystem — Plugin & Extension System](#phase-12-ecosystem--plugin--extension-system)
14. [Phase 13: Performance — Parallel Tool Execution](#phase-13-performance--parallel-tool-execution)
15. [Phase 14: UX — Interactive TUI & Themes](#phase-14-ux--interactive-tui--themes)
16. [Phase 15: UX — Session Management & Archival](#phase-15-ux--session-management--archival)
17. [Phase 16: Platform — Windows Support](#phase-16-platform--windows-support)
18. [Phase 17: Operations — Diagnostics & Health Checks](#phase-17-operations--diagnostics--health-checks)
19. [Phase 18: UX — Memory & Context System](#phase-18-ux--memory--context-system)
20. [Phase 19: Safety — Lifecycle Hooks](#phase-19-safety--lifecycle-hooks)
21. [Phase 20: UX — Checkpoints & Undo](#phase-20-ux--checkpoints--undo)
22. [Phase 21: UX — Effort & Fallback Models](#phase-21-ux--effort--fallback-models)

### Reference
23. [Dependency Graph](#dependency-graph)
24. [Estimated Effort](#estimated-effort)
25. [Competitive Gap Analysis](#competitive-gap-analysis)

---

## Phase 0: Foundation — Tool System Refactoring

**Goal**: Replace the monolithic switch statement with a dynamic tool registry. This is the prerequisite for all other phases — permissions, new tools, and subagents all require a modular tool system.

**Difficulty**: Medium | **Estimated effort**: 2–3 days

### Current State
- `src/tools/exec.ts`: 1,349-line monolithic switch statement (`executeToolCall()`)
- `src/tools/definitions.ts`: Flat array of 41 tool definitions
- `src/chat/tool-handler.ts`: Bypasses MCP routing, calls `executeToolCall()` directly
- All tool results are strings, no structured output

### Tasks

#### 0.1 Create Tool Registry Pattern
- [ ] Create `src/tools/registry.ts` with a `ToolRegistry` class
- [ ] Each tool registers itself with: name, definition, execute function, metadata
- [ ] Metadata includes: `category`, `permissionKey`, `outputType` (string/structured), `requiresConfirmation`
- [ ] Tool definitions become co-located with their implementations (not separate files)
- [ ] Registry provides: `register()`, `get(name)`, `list()`, `execute(name, args)`

```typescript
// Target interface for registered tools
interface RegisteredTool {
  definition: ToolDefinition;
  execute: (args: Record<string, unknown>) => Promise<ToolResult>;
  metadata: {
    category: string;           // 'file', 'git', 'shell', 'search', etc.
    permissionKey: string;      // maps to permission config
    outputType: 'text' | 'structured';
    requiresConfirmation?: boolean;
  };
}
```

#### 0.2 Refactor Existing Tools
- [ ] Convert each tool case from the switch statement into a registered tool module
- [ ] Group tools by category in `src/tools/` subdirectories:
  - `src/tools/file/` — file_read, file_write, file_edit, file_find, delete_file_or_dir
  - `src/tools/shell/` — shell_exec, exec_file
  - `src/tools/search/` — grep, grep_regex, grep_find_and_replace, file_find_by_metadata
  - `src/tools/git/` — all git tools
  - `src/tools/build/` — cmake, make, gcc, python, java, dotnet, flutter
  - `src/tools/project/` — create_project, install_package
- [ ] Each tool file exports a function that registers with the global registry

#### 0.3 Fix Tool Handler MCP Bypass
- [ ] `src/chat/tool-handler.ts` currently calls `executeToolCall()` directly (line 38)
- [ ] Change to call `engine.executeTool()` which checks MCP first, then built-in
- [ ] This ensures MCP tools are never bypassed

#### 0.4 Add Structured Tool Results
- [ ] Define `ToolResult` interface:
```typescript
interface ToolResult {
  output: string;           // display text
  error?: string;           // error message if failed
  metadata?: Record<string, unknown>; // structured data (e.g., file paths changed)
  truncated?: boolean;      // whether output was truncated
}
```
- [ ] Update `tool-handler.ts` to handle `ToolResult` vs plain string
- [ ] Backwards compatible: existing tools can still return plain strings

#### 0.5 Add Tool Call Limit
- [ ] Add `maxToolCalls` config option (default: 50)
- [ ] Track tool calls in `processTurn()` and break the loop with a warning if exceeded
- [ ] Prevents infinite loops from runaway models

### Files Modified
- `src/tools/registry.ts` (new)
- `src/tools/exec.ts` (refactored — switch cases become registry entries)
- `src/tools/definitions.ts` (refactored — definitions move to tool modules)
- `src/chat/tool-handler.ts` (uses engine.executeTool, handles ToolResult)
- `src/chat/processor.ts` (adds tool call limit)
- `src/config.ts` (adds maxToolCalls)

---

## Phase 1: Foundation — Provider System Improvements

**Goal**: Add streaming, full tool calling support for all providers, and configurable parameters. Required before plan mode, subagents, and better UX.

**Difficulty**: Hard | **Estimated effort**: 3–4 days

### Current State
- `src/providers/base.ts`: Abstract `LLMProvider` with only `chat()` (no streaming)
- `GeminiProvider`: No tool calling support (line 33: "no native tool calls in this example")
- `AnthropicProvider`: No tool calling support (line 18: `_tools` parameter is ignored)
- All providers hardcode temperature, maxTokens, have no abort support
- No multimodal support (content is always string)

### Tasks

#### 1.1 Add Streaming to Base Provider
- [ ] Add optional `stream()` method to `LLMProvider`:
```typescript
abstract class LLMProvider {
  // Existing
  abstract chat(messages: LLMMessage[], tools?: ToolDefinition[]): Promise<ChatResponse>;
  
  // New — optional override
  stream?(messages: LLMMessage[], tools?: ToolDefinition[], signal?: AbortSignal): AsyncGenerator<StreamChunk>;
}
```
- [ ] Define `StreamChunk` type:
```typescript
interface StreamChunk {
  type: 'text' | 'tool_call' | 'tool_call_start' | 'done' | 'error';
  content?: string;
  toolCall?: ToolCall;
  usage?: TokenUsage;
}
```
- [ ] Add `AbortSignal` support for cancellation

#### 1.2 Fix Gemini Tool Calling
- [ ] Rewrite `GeminiProvider.chat()` to use the Gemini function calling API
- [ ] Map `ToolDefinition[]` to Gemini `FunctionDeclaration[]`
- [ ] Parse Gemini function call responses into `ToolCall[]`
- [ ] Handle Gemini's `FunctionResponse` for tool results
- [ ] Use `@google/generative-ai` SDK's `generateContent` with `tools` parameter

#### 1.3 Fix Anthropic Tool Calling
- [ ] Rewrite `AnthropicProvider.chat()` to use Anthropic's tool use API
- [ ] Map `ToolDefinition[]` to Anthropic `tool` parameter format
- [ ] Parse Anthropic tool_use blocks into `ToolCall[]`
- [ ] Handle Anthropic's `tool_result` content blocks
- [ ] Remove hardcoded `max_tokens: 1024` — make configurable

#### 1.4 Add Configurable Provider Parameters
- [ ] Extend `LLMProvider` constructor or chat method:
```typescript
interface ProviderOptions {
  temperature?: number;    // 0.0–1.0
  maxTokens?: number;
  topP?: number;
  stopSequences?: string[];
}
```
- [ ] Pass options through from config

#### 1.5 Improve Token Counting
- [ ] Add `countToolTokens()` method for counting tokens in tool-heavy messages
- [ ] Add per-provider token counting strategies:
  - OpenAI/OpenAI-compat: keep `gpt-tokenizer`
  - Gemini: use `@google/generative-ai`'s `countTokens()` API
  - Anthropic: use `@anthropic-ai/sdk`'s token counting
- [ ] Cache token counts for messages that haven't changed

#### 1.6 Add Provider Streaming to Processor
- [ ] Update `processTurn()` to use `stream()` when available
- [ ] Print text chunks as they arrive (no waiting for full response)
- [ ] Handle tool calls from stream events
- [ ] Fallback to non-streaming if `stream()` not available

### Files Modified
- `src/providers/base.ts` (stream interface, StreamChunk, ProviderOptions)
- `src/providers/gemini.ts` (full tool calling rewrite)
- `src/providers/anthropic.ts` (full tool calling rewrite)
- `src/providers/openai-compat.ts` (streaming, configurable params)
- `src/providers/opencode.ts` (streaming, configurable params)
- `src/chat/processor.ts` (streaming support, abort support)

---

## Phase 2: Foundation — Permission System

**Goal**: Implement ask/allow/deny permissions for tool execution. Required for plan mode (which denies edits), subagents (which have restricted tool access), and enterprise use.

**Difficulty**: Medium | **Estimated effort**: 2–3 days

### Current State
- No permission system — all tools execute unconditionally
- `QodeConfig` has no permission fields
- No way to restrict tool access per-agent or per-session

### Tasks

#### 2.1 Extend Config with Permissions
- [ ] Add permission fields to `QodeConfig`:
```typescript
interface QodeConfig {
  // ... existing fields
  
  // New
  permissions?: {
    [toolName: string]: 'allow' | 'ask' | 'deny';
  };
  // Or per-category:
  bash?: 'allow' | 'ask' | 'deny';
  edit?: 'allow' | 'ask' | 'deny';
  read?: 'allow' | 'ask' | 'deny';
}
```
- [ ] Default permissions: `allow` for all tools (backwards compatible)
- [ ] Support wildcard patterns: `"git_*": "ask"`

#### 2.2 Create Permission Manager
- [ ] Create `src/permissions/manager.ts`:
```typescript
class PermissionManager {
  constructor(config: QodeConfig);
  
  async checkPermission(
    toolName: string, 
    args: Record<string, unknown>,
    context?: { session: Session }
  ): Promise<'allow' | 'deny'>;
  
  // If 'ask', prompt user with tool name + args summary
  private async promptUser(toolName: string, args: Record<string, unknown>): Promise<boolean>;
}
```
- [ ] Use `inquirer` for permission prompts (already a dependency)
- [ ] Show truncated args in prompt (not full output)
- [ ] Remember "allow for session" option

#### 2.3 Integrate with Tool Execution
- [ ] In `engine.executeTool()`, check `permissionManager.checkPermission()` before execution
- [ ] If denied, return error message to LLM ("Permission denied for tool X")
- [ ] If user declines, return user-friendly message
- [ ] Wire permission manager into ChatEngine

#### 2.4 Add Per-Mode Permissions
- [ ] Support different permission sets for different modes:
```typescript
interface ModePermissions {
  plan: { edit: 'deny', bash: 'ask', read: 'allow', ... };
  build: { '*': 'allow' };
  explore: { edit: 'deny', bash: 'deny', read: 'allow', ... };
}
```
- [ ] Store active mode's permissions in Session
- [ ] Switch permissions when mode changes

#### 2.5 Add Session-Level Permission Override
- [ ] Allow user to change permissions during session: `/permissions edit ask`
- [ ] Allow temporary bypass: `/allow-all` (reverts on session end)
- [ ] Show current permissions in `/status`

### Files Modified
- `src/config.ts` (permission config interface)
- `src/permissions/manager.ts` (new)
- `src/chat/engine.ts` (integrates PermissionManager)
- `src/chat/loop.ts` (new slash commands for permissions)
- `src/chat/session.ts` (stores active permissions)

---

## Phase 3: Core — Enhanced Tools

**Goal**: Add grep improvements, glob, apply_patch, todowrite, webfetch, and websearch tools.

**Difficulty**: Medium | **Estimated effort**: 2–3 days

### Current State
- `grep`: Simple string search, no regex, no context lines
- `grep_regex`: Exists but basic
- No glob pattern matching tool
- No apply_patch tool
- No todowrite tool
- No web access tools

### Tasks

#### 3.1 Enhanced grep Tool
- [ ] Rewrite `grep` tool with full regex support
- [ ] Add options: context lines, file extension filter, case insensitive, max results
- [ ] Use `ripgrep` if available (like OpenCode), fallback to Node.js implementation
- [ ] Return structured results: `{ file, line, column, match, context }`
- [ ] Add `include`/`exclude` glob patterns
- [ ] Respect `.gitignore` (already handled by ignore module)

#### 3.2 Add glob Tool
- [ ] New tool: `glob` — find files by pattern
- [ ] Parameters: `pattern` (glob string), `path` (optional directory), `maxDepth`
- [ ] Return sorted by modification time (most recent first)
- [ ] Use `fast-glob` or Node.js `fs.glob` (Node 22+)
- [ ] Respect `.gitignore`

#### 3.3 Add apply_patch Tool
- [ ] New tool: `apply_patch` — apply unified diff patches
- [ ] Parameters: `patch` (unified diff text) or `patches` (array of patches)
- [ ] Support: add file, update file, delete file, move file
- [ ] Parse diff format, validate, then apply
- [ ] Create backup before applying (configurable)
- [ ] Verify result with file checksums

#### 3.4 Improve file_edit Tool
- [ ] Support multiple edits in a single call
- [ ] Add `replaceAll` option for replacing all occurrences
- [ ] Return which lines were changed
- [ ] Better error messages when oldString not found

#### 3.5 Add todowrite Tool
- [ ] New tool: `todowrite` — create and update todo lists
- [ ] Parameters: `todos` array of `{ content, status: 'pending'|'in_progress'|'completed', priority }`
- [ ] Store todos in session state
- [ ] Display todo list in status header
- [ ] Support `todoread` to read current todos

#### 3.6 Add webfetch Tool
- [ ] New tool: `webfetch` — fetch web page content
- [ ] Parameters: `url`, `format` ('text' | 'markdown' | 'html')
- [ ] Use `node-fetch` or built-in `fetch` (Node 18+)
- [ ] Convert HTML to markdown using `turndown` or similar
- [ ] Truncate large responses
- [ ] Respect robots.txt (optional)

#### 3.7 Add websearch Tool
- [ ] New tool: `websearch` — search the web
- [ ] Parameters: `query`, `numResults` (default 5)
- [ ] Integrate with a search API (DuckDuckGo, Bing, or Exa)
- [ ] Return structured results: `{ title, url, snippet }`
- [ ] Optional: use webfetch to get full content of top results

#### 3.8 Update Tool Definitions
- [ ] Register all new tools in the registry (from Phase 0)
- [ ] Add permission keys for new tools
- [ ] Update `tool-handler.ts` for structured results from new tools

### Files Modified
- `src/tools/search/grep.ts` (rewrite)
- `src/tools/search/glob.ts` (new)
- `src/tools/file/apply_patch.ts` (new)
- `src/tools/file/file_edit.ts` (enhanced)
- `src/tools/utils/todowrite.ts` (new)
- `src/tools/web/webfetch.ts` (new)
- `src/tools/web/websearch.ts` (new)
- `src/config.ts` (web search API key config)
- `package.json` (add turndown, fast-glob if needed)

---

## Phase 4: Core — Compression & Pruning

**Goal**: Improve context management with selective pruning, configurable compression, and incremental summarization.

**Difficulty**: Medium | **Estimated effort**: 2–3 days

### Current State
- `session.ts`: Basic compression — summarizes everything except system + last 4 messages
- No tool output pruning — large outputs stay forever
- Fixed 4-message window — not configurable
- Full re-summarization each time (expensive)
- No message importance scoring

### Tasks

#### 4.1 Add Tool Output Pruning
- [ ] After each turn, prune old tool outputs beyond a configurable age
- [ ] Strategy: Keep tool outputs for last N messages, truncate older ones to summary
- [ ] Add `pruneToolOutputs()` method to Session:
```typescript
pruneToolOutputs(keepLastN: number = 10): void {
  // For tool messages older than keepLastN:
  // Replace content with "[Tool output pruned — was N chars]"
}
```
- [ ] Config option: `pruneAfterMessages` (default: 20)

#### 4.2 Configurable Compression Window
- [ ] Add `compressKeepMessages` config option (default: 4)
- [ ] Add `compressKeepSystem` config option (default: true)
- [ ] Allow user to configure via `/compress --keep 6`

#### 4.3 Add Message Importance Scoring
- [ ] Score messages by type:
  - System prompt: infinity (never compress)
  - User messages with tool calls: high
  - Assistant responses with code: high
  - Pure conversation: normal
  - Tool results: low (prunable)
- [ ] When compressing, preserve high-importance messages
- [ ] Use importance to decide which messages to summarize vs drop

#### 4.4 Implement Incremental Compression
- [ ] Instead of full re-summarize, track what's already been summarized
- [ ] Maintain a `summaryHash` or `summaryMessageCount`
- [ ] On compression, only summarize new messages since last compression
- [ ] Append new summary to existing summary

#### 4.5 Add Compression Stats
- [ ] Track compression events in session metadata:
```typescript
compressionHistory: Array<{
  timestamp: string;
  messagesBefore: number;
  messagesAfter: number;
  tokensBefore: number;
  tokensAfter: number;
}>;
```
- [ ] Show compression stats in `/status`

#### 4.6 Improve Summary Quality
- [ ] Use a more detailed summarization prompt
- [ ] Include key decisions, code snippets, and file paths in summary
- [ ] Preserve important context like "we decided to use X because Y"

### Files Modified
- `src/chat/session.ts` (pruning, incremental compression, importance scoring)
- `src/config.ts` (new compression config options)
- `src/chat/loop.ts` (compression stats in /status)

---

## Phase 5: Core — Local Model Support

**Goal**: Enable Qode to use the downloaded Qwen model via llama.cpp for offline/free inference.

**Difficulty**: Hard | **Estimated effort**: 3–4 days

### Current State
- Qode downloads `Qwen2.5-Coder-0.5B-Instruct.gguf` on every startup
- Model saved to `~/.qode/models/`
- No llama.cpp integration — model is downloaded but never used
- No local model provider

### Tasks

#### 5.1 Add llama.cpp Server Integration
- [ ] Bundle or detect `llama-server` binary (from llama.cpp)
- [ ] On startup, if model exists, optionally start `llama-server` in background:
```typescript
const server = spawn('llama-server', [
  '-m', '~/.qode/models/Qwen2.5-Coder-0.5B-Instruct.gguf',
  '--port', '8080',
  '--ctx-size', '32768',
]);
```
- [ ] Health check endpoint before accepting connections
- [ ] Graceful shutdown on process exit

#### 5.2 Create LocalModelProvider
- [ ] New provider: `src/providers/local.ts`
- [ ] Uses OpenAI-compatible API (llama-server exposes `/v1/chat/completions`)
- [ ] Extends `OpenAICompatProvider` with local base URL
- [ ] Auto-detect model capabilities (tool calling support, context size)

#### 5.3 Add Local Model Discovery
- [ ] Scan `~/.qode/models/` for `.gguf` files
- [ ] Parse model metadata (name, size, quantization)
- [ ] Show available local models in `qode models`
- [ ] Allow downloading additional models from HuggingFace

#### 5.4 Add Model Download Manager
- [ ] New module: `src/models/downloader.ts`
- [ ] Support downloading from HuggingFace URLs
- [ ] Progress bar during download
- [ ] Checksum verification
- [ ] Resume interrupted downloads
- [ ] Track download status in `~/.qode/models/status.json`

#### 5.5 Config for Local Model
- [ ] Add to config:
```typescript
localModel?: {
  enabled: boolean;
  modelPath?: string;      // override auto-detect
  port?: number;           // llama-server port (default: 8080)
  contextSize?: number;    // default: 32768
  autoStart?: boolean;     // start server on qode launch
};
```
- [ ] Add `/model local` command to switch to local model

#### 5.6 Hybrid Mode
- [ ] Allow using local model for lightweight tasks (compression, title generation)
- [ ] Use cloud model for main coding tasks
- [ ] Configurable routing: `smallModel: 'local'` vs `model: 'gemini-2.5-flash'`

### Files Modified
- `src/providers/local.ts` (new)
- `src/models/downloader.ts` (new, refactored from existing download logic in slash.ts)
- `src/config.ts` (localModel config)
- `src/chat/engine.ts` (local model provider creation)
- `src/index.ts` (optional llama-server startup)
- `package.json` (no new deps — uses existing openai SDK)

---

## Phase 6: Advanced — Plan Mode & Progress Tracking

**Goal**: Implement a plan mode where the AI analyzes and suggests without making changes, with progress tracking for multi-step tasks.

**Difficulty**: Medium | **Estimated effort**: 2–3 days

### Prerequisites
- Phase 2 (Permission System) — needed to deny edit/bash in plan mode
- Phase 3 (todowrite tool) — needed for progress tracking

### Tasks

#### 6.1 Add Mode System
- [ ] Define mode concept in session:
```typescript
type AgentMode = 'build' | 'plan';

interface ModeConfig {
  name: string;
  systemPrompt: string;
  permissions: { [tool: string]: 'allow' | 'ask' | 'deny' };
}
```
- [ ] Built-in modes:
  - `build`: Full access (current default behavior)
  - `plan`: Read-only, no edits, no shell execution
- [ ] Store active mode in Session

#### 6.2 Plan Mode Implementation
- [ ] Plan mode system prompt:
```
You are in PLAN MODE. You can analyze code, read files, search, and create plans.
You CANNOT make any file edits or execute shell commands.
When asked to implement something, provide a detailed plan with:
1. Files to create/modify
2. Exact changes needed
3. Order of operations
4. Potential risks or considerations
Use the todowrite tool to track plan progress.
```
- [ ] Plan mode permissions:
```typescript
{
  edit: 'deny',
  write: 'deny', 
  bash: 'deny',
  file_edit: 'deny',
  file_write: 'deny',
  delete_file_or_dir: 'deny',
  shell_exec: 'deny',
  // Read-only tools allowed
  file_read: 'allow',
  grep: 'allow',
  glob: 'allow',
  todowrite: 'allow',
}
```

#### 6.3 Mode Switching
- [ ] Add `Tab` key handler to switch between plan/build modes
- [ ] Update status header to show current mode
- [ ] Add `/mode plan` and `/mode build` slash commands
- [ ] Show mode indicator: `[PLAN]` or `[BUILD]` in prompt

#### 6.4 Plan Progress Tracking
- [ ] Use `todowrite` tool to create plan steps
- [ ] Store plan in session:
```typescript
interface Plan {
  steps: Array<{
    id: string;
    description: string;
    status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
    files?: string[];
  }>;
  createdAt: string;
  completedAt?: string;
}
```
- [ ] Display plan progress in status header:
```
[PLAN] Step 3/7: Modify authentication module ████████░░░░ 43%
```
- [ ] Update progress as user confirms or completes steps

#### 6.5 Plan-to-Implementation Flow
- [ ] When in plan mode, user can say "go ahead" or "implement this"
- [ ] System switches to build mode and sends the plan as context
- [ ] LLM implements the plan step by step
- [ ] Progress updates as each step completes

#### 6.6 Plan Commands
- [ ] `/plan show` — display current plan
- [ ] `/plan clear` — clear current plan
- [ ] `/plan export` — export plan as markdown
- [ ] `/mode` — show current mode and available modes

### Files Modified
- `src/chat/session.ts` (mode state, plan storage)
- `src/chat/loop.ts` (Tab handler, mode commands, status updates)
- `src/chat/processor.ts` (mode-aware permissions)
- `src/permissions/manager.ts` (mode-based permission sets)

---

## Phase 7: Advanced — Subagent Flow

**Goal**: Implement subagent invocation where the primary agent can delegate tasks to specialized subagents (explore, general, etc.).

**Difficulty**: Hard | **Estimated effort**: 3–4 days

### Prerequisites
- Phase 0 (Tool Registry) — subagents need their own tool sets
- Phase 2 (Permission System) — subagents have restricted permissions
- Phase 1 (Provider Streaming) — subagents should stream results

### Tasks

#### 7.1 Define Subagent System
- [ ] Define subagent types:
```typescript
type SubagentType = 'explore' | 'general' | 'custom';

interface SubagentConfig {
  type: SubagentType;
  name: string;
  description: string;
  model?: string;                    // override primary model
  permissions: { [tool: string]: 'allow' | 'ask' | 'deny' };
  systemPrompt: string;
  maxSteps?: number;
}
```
- [ ] Built-in subagents:
  - `explore`: Read-only, fast codebase exploration (no edits, no shell)
  - `general`: Full access, for complex multi-step tasks
  - `custom`: User-defined via config

#### 7.2 Subagent Task Tool
- [ ] Add `task` tool that primary agents can call:
```typescript
{
  name: 'task',
  description: 'Delegate a task to a specialized subagent',
  parameters: {
    type: 'object',
    properties: {
      subagent: { type: 'string', enum: ['explore', 'general'] },
      prompt: { type: 'string', description: 'Task description for the subagent' },
    },
    required: ['subagent', 'prompt']
  }
}
```
- [ ] When primary agent calls `task`, spawn subagent session
- [ ] Subagent gets its own message history, permissions, and tool set
- [ ] Subagent result returned to primary agent

#### 7.3 Child Session Management
- [ ] Subagent creates a child session (linked to parent)
- [ ] Parent session tracks child sessions:
```typescript
childSessions: Array<{
  id: string;
  subagentType: SubagentType;
  status: 'running' | 'completed' | 'failed';
  result?: string;
}>;
```
- [ ] Navigate between parent/child sessions
- [ ] Subagent can spawn its own children (limited depth)

#### 7.4 Subagent UI
- [ ] Show subagent activity in status header:
```
[EXPLORE] Searching for auth patterns... (child: abc-123)
```
- [ ] Allow user to interrupt subagent: `/interrupt`
- [ ] Show subagent results inline

#### 7.5 Subagent @Mention
- [ ] Allow `@explore` or `@general` in user messages
- [ ] Automatically invokes the subagent with the user's prompt
- [ ] Returns result to user (not just to primary agent)

#### 7.6 Custom Subagents
- [ ] Allow users to define custom subagents in config:
```typescript
subagents?: {
  [name: string]: {
    description: string;
    model?: string;
    permissions: { [tool: string]: 'allow' | 'ask' | 'deny' };
    systemPrompt: string;
  };
};
```
- [ ] Or via markdown files in `.agents/subagents/<name>.md`

### Files Modified
- `src/agents/subagent.ts` (new — SubagentManager class)
- `src/agents/builtins.ts` (new — explore, general subagent definitions)
- `src/tools/utils/task.ts` (new — task tool)
- `src/chat/session.ts` (child session tracking)
- `src/chat/engine.ts` (subagent creation, tool filtering)
- `src/chat/loop.ts` (@mention parsing, child session navigation)
- `src/config.ts` (subagent config)

---

## Phase 8: Advanced — Subscription Login

**Goal**: Implement OAuth/subscription-based authentication for Google AI Studio, OpenAI, Anthropic, and GitHub Copilot — similar to OpenCode's `/connect` flow.

**Difficulty**: Hard | **Estimated effort**: 3–4 days

### Tasks

#### 8.1 Auth System Architecture
- [ ] Create `src/auth/` module:
```typescript
interface AuthProvider {
  name: string;
  type: 'api-key' | 'oauth' | 'device-code';
  
  // For API key
  setupApiKey?(): Promise<string>;
  
  // For OAuth
  startOAuth?(): Promise<AuthSession>;
  handleCallback?(callback: string): Promise<AuthTokens>;
  
  // For device code
  startDeviceCode?(): Promise<DeviceCodeSession>;
  pollDeviceCode?(session: DeviceCodeSession): Promise<AuthTokens>;
  
  // Common
  validateCredentials(tokens: AuthTokens): Promise<boolean>;
  refreshToken?(tokens: AuthTokens): Promise<AuthTokens>;
}
```
- [ ] Store auth data in `~/.qode/auth.json`

#### 8.2 Google AI Studio OAuth
- [ ] Implement Google OAuth 2.0 flow
- [ ] Open browser for Google consent screen
- [ ] Callback on localhost:PORT
- [ ] Exchange code for tokens
- [ ] Store access + refresh tokens
- [ ] Auto-refresh on expiry

#### 8.3 OpenAI Subscription Login
- [ ] Support ChatGPT Plus/Pro subscription login
- [ ] Device code flow (like OpenCode)
- [ ] Open browser at `chatgpt.com/authorize`
- [ ] Poll for completion
- [ ] Store session tokens

#### 8.4 Anthropic Subscription Login
- [ ] Support Claude Pro/Max subscription
- [ ] Device code or OAuth flow
- [ ] Store tokens for API access

#### 8.5 GitHub Copilot Login
- [ ] Device code flow via `github.com/login/device`
- [ ] Exchange device code for Copilot token
- [ ] Use Copilot token for model access
- [ ] Auto-refresh token

#### 8.6 Unified Auth UI
- [ ] `/connect` command to set up any provider
- [ ] Interactive provider selection
- [ ] `/auth status` to show configured providers
- [ ] `/auth logout <provider>` to remove credentials

#### 8.7 Token Storage & Security
- [ ] Encrypt tokens at rest (use OS keychain if available)
- [ ] Fallback to encrypted JSON file
- [ ] Token refresh on background thread
- [ ] Handle token expiry gracefully

### Files Modified
- `src/auth/` (new directory)
- `src/auth/provider.ts` (base interface)
- `src/auth/google.ts` (Google OAuth)
- `src/auth/openai.ts` (OpenAI device code)
- `src/auth/anthropic.ts` (Anthropic auth)
- `src/auth/github.ts` (GitHub Copilot)
- `src/auth/storage.ts` (encrypted token storage)
- `src/config.ts` (auth config)
- `src/chat/loop.ts` (connect/auth commands)
- `package.json` (add open (for browser), keytar (for keychain))

---

## Phase 9: Advanced — LLM-Powered Search

**Goal**: Implement semantic search across the codebase using TF-IDF embeddings and vector similarity, allowing users and agents to find code by meaning rather than just keywords.

**Difficulty**: Medium | **Estimated effort**: 2–3 days

### Prerequisites
- Phase 0 (Tool Registry) — needed to register the semantic_search tool

### Tasks

#### 9.1 Vector Store
- [ ] Create `src/search/vector-store.ts` with `VectorDocument` and `SearchResult` types
- [ ] Implement `VectorStore` class with:
  - `addDocument()` / `removeDocument()` for managing documents
  - `computeIDF()` for inverse document frequency calculation
  - `computeTFIDF()` for term frequency-inverse document frequency vectors
  - `cosineSimilarity()` for comparing vectors
  - `search(query, topK)` for finding similar documents
  - `save()` / `load()` for persistence to disk

#### 9.2 Code Indexer
- [ ] Create `src/search/indexer.ts` with:
  - `indexFile()` — index a single file with chunking (50 lines, 10 overlap)
  - `indexDirectory()` — recursively index a directory
  - `buildIndex()` — build index for the workspace
  - `loadIndex()` — load existing index from `.qode/search-index.json`
  - `searchIndex()` — search the index
- [ ] Respect `.gitignore` and ignore patterns
- [ ] Skip non-code files (binaries, images, etc.)
- [ ] Skip common non-code directories (node_modules, .git, dist, build)

#### 9.3 Semantic Search Tool
- [ ] Create `src/tools/semantic-search/index.ts` with `semantic_search` tool:
  ```typescript
  {
    name: 'semantic_search',
    description: 'Search the codebase using semantic similarity',
    parameters: {
      query: string,      // Search query
      topK?: number,      // Results to return (default: 10)
      rebuild?: boolean   // Force rebuild index
    }
  }
  ```
- [ ] Register tool in `src/tools/index.ts`
- [ ] Add tool definition to `src/tools/definitions.ts`

#### 9.4 Search Command
- [ ] Add `/search [--rebuild] <query>` command to `src/chat/loop.ts`
- [ ] Show ranked results with file locations and similarity scores
- [ ] Show preview of matching code (first 3-5 lines)
- [ ] Auto-build index if not exists

### Files Modified
- `src/search/` (new directory)
- `src/search/vector-store.ts` (new — VectorStore class)
- `src/search/indexer.ts` (new — code indexing)
- `src/tools/semantic-search/index.ts` (new — semantic_search tool)
- `src/tools/index.ts` (register semantic_search tool)
- `src/tools/definitions.ts` (add semantic_search definition)
- `src/chat/loop.ts` (/search command)

### How It Works

1. **Indexing**: When `/search` is run or `semantic_search` is called, the indexer:
   - Recursively scans the workspace for code files
   - Respects `.gitignore` patterns
   - Chunks large files into 50-line segments with 10-line overlap
   - Computes TF-IDF vectors for each chunk/file
   - Saves the index to `.qode/search-index.json`

2. **Searching**: When a query is made:
   - Computes TF-IDF vector for the query
   - Calculates cosine similarity against all indexed documents
   - Returns top-K results sorted by similarity score
   - Shows file location, similarity percentage, and code preview

3. **TF-IDF Embeddings**: Uses Term Frequency-Inverse Document Frequency:
   - **TF (Term Frequency)**: How often a term appears in a document
   - **IDF (Inverse Document Frequency)**: How rare a term is across all documents
   - **TF-IDF**: Product of TF and IDF, weights rare terms higher
   - **Cosine Similarity**: Measures angle between vectors (0-1 scale)

---

## Phase 10: Security — Sandboxed Execution

**Goal**: Isolate agent-executed commands from the host system. Codex's primary security differentiator — bubblewrap + Docker sandboxing.

**Difficulty**: Hard | **Estimated effort**: 4–5 days

### Current State
- No sandboxing — all commands run directly on host
- Only safety: `containsDangerousPatterns()` blocks ~15 known dangerous patterns
- No network isolation, no filesystem isolation

### Tasks

#### 10.1 Bubblewrap Sandbox (Linux)
- [ ] Detect `bwrap` availability
- [ ] Sandbox profile: network disabled, read-only root FS, private `/tmp`
- [ ] Bind-mount workspace into sandbox
- [ ] Add config: `sandbox.mode: 'off' | 'bubblewrap' | 'docker'`

#### 10.2 Docker Devcontainer Sandbox
- [ ] Detect Docker, create minimal `Dockerfile`
- [ ] Mount workspace read-only, bind-mount changed files
- [ ] Auto-build image on first run, `--rm` for cleanup

#### 10.3 Sandbox Profiles
- [ ] `networkAccess: boolean`, `filesystemAccess: 'none' | 'workspace' | 'full'`
- [ ] Default: workspace-only, no network
- [ ] Per-tool sandbox override (`git` needs network)

#### 10.4 Sandbox UI
- [ ] Show sandbox status in `/status`
- [ ] Add `/sandbox [mode]` command

### Files Modified
- `src/sandbox/bubblewrap.ts` (new)
- `src/sandbox/docker.ts` (new)
- `src/sandbox/profiles.ts` (new)
- `src/tools/shell/index.ts` (sandbox wrapping)
- `src/config.ts`

---

## Phase 11: Ecosystem — MCP Protocol Support

**Goal**: Integrate Model Context Protocol to connect with 9,000+ MCP servers. Codex's largest ecosystem advantage.

**Difficulty**: Hard | **Estimated effort**: 5–6 days

### Tasks

#### 11.1 MCP Client
- [ ] Create `src/mcp/client.ts` — JSON-RPC over stdio/SSE/WebSocket
- [ ] Implement `initialize`, `tools/list`, `tools/call`
- [ ] Handle stdio transport (spawn server, read/write JSON-RPC)

#### 11.2 MCP Tool Bridge
- [ ] Register MCP tools in `ToolRegistry` as `mcp__server__tool`
- [ ] Proxy tool calls via `tools/call`
- [ ] Convert MCP results to `ToolResult`

#### 11.3 MCP Configuration
- [ ] Config: `mcp.servers[]`, `mcp.autoConnect`, `mcp.timeout`, `mcp.maxConcurrent`
- [ ] Add `/mcp list`, `/mcp add`, `/mcp remove` commands

#### 11.4 MCP Server Marketplace
- [ ] Pre-configure: `@anthropic/mcp-filesystem`, `mcp-git`, `mcp-sqlite`, `mcp-fetch`, `mcp-puppeteer`
- [ ] `qode mcp install <server-name>`

#### 11.5 Parallel MCP Calls
- [ ] `Promise.allSettled()` for concurrent independent calls
- [ ] Respect `maxConcurrent` limit

### Files Modified
- `src/mcp/client.ts` (new)
- `src/mcp/transport.ts` (new)
- `src/mcp/config.ts` (new)
- `src/tools/registry.ts` (MCP bridge)
- `src/chat/loop.ts` (MCP commands)

---

## Phase 12: Ecosystem — Plugin & Extension System

**Goal**: Plugin system for custom tools, skills, and workflows. Codex has 9,000+ marketplace plugins.

**Difficulty**: Hard | **Estimated effort**: 4–5 days

### Tasks

#### 12.1 Plugin Architecture
- [ ] Define `QodePlugin` interface with lifecycle hooks: `onSessionStart`, `onToolCall`, `onToolResult`
- [ ] Extension points: tools, permissions, systemPrompt, commands
- [ ] Support npm packages, local directories, git repos

#### 12.2 Plugin Marketplace
- [ ] `qode plugin search/install/remove`
- [ ] Auto-update on startup (configurable)

#### 12.3 Hook System
- [ ] `preToolCall`, `postToolCall`, `preMessage`, `postMessage`, `onError`
- [ ] Priority ordering for hooks

#### 12.4 Built-in Plugins
- [ ] `@qode/lint-runner`, `@qode/test-runner`, `@qode/git-auto-commit`
- [ ] `@qode/slack-notifier`, `@qode/jira-integration`

### Files Modified
- `src/plugins/loader.ts` (new)
- `src/plugins/manager.ts` (new)
- `src/plugins/marketplace.ts` (new)
- `src/chat/loop.ts` (plugin commands)

---

## Phase 13: Performance — Parallel Tool Execution

**Goal**: Execute independent tool calls concurrently. Codex cuts execution time nearly in half with parallel calls.

**Difficulty**: Medium | **Estimated effort**: 2–3 days

### Tasks

#### 13.1 Dependency Analysis
- [ ] Analyze tool calls: same-file writes = dependent, independent reads = parallelizable
- [ ] Build dependency graph from tool call list

#### 13.2 Parallel Execution Engine
- [ ] `src/tools/executor.ts` with `executeBatch()` using `Promise.allSettled()`
- [ ] `maxConcurrency` config (default: 4)
- [ ] Fall back to sequential if dependencies exist

#### 13.3 Git Worktree Parallelism
- [ ] Create temporary worktrees for file-heavy operations
- [ ] Merge results back, clean up

### Files Modified
- `src/tools/executor.ts` (new)
- `src/chat/processor.ts` (parallel handling)
- `src/chat/engine.ts` (dependency analysis)
- `src/config.ts` (maxConcurrency)

---

## Phase 14: UX — Interactive TUI & Themes

**Goal**: Rich terminal UI with syntax highlighting, markdown rendering, themes. Codex has OSC 8 links, theme system, status bar.

**Difficulty**: Medium | **Estimated effort**: 3–4 days

### Tasks

#### 14.1 Markdown Rendering
- [ ] Code blocks with syntax highlighting (`marked` + `highlight.js`)
- [ ] Bold, italic, tables, lists, OSC 8 links

#### 14.2 Syntax Highlighting
- [ ] `highlight.js` or `shiki` for language detection
- [ ] TypeScript, Python, Rust, Go, etc.

#### 14.3 Status Bar
- [ ] Persistent bottom bar: `[Model] │ Plan: Step 3/7 │ Sandbox: on │ Tokens: 12.3K`

#### 14.4 Theme System
- [ ] Built-in: `default`, `monokai`, `dracula`, `solarized`, `minimal`
- [ ] `/theme <name>` command

#### 14.5 Interactive Elements
- [ ] Progress bars, file picker with preview, confirmation prompts

### Files Modified
- `src/ui/renderer.ts` (new)
- `src/ui/highlighter.ts` (new)
- `src/ui/statusbar.ts` (new)
- `src/ui/themes.ts` (new)
- `package.json` (add `marked`, `highlight.js`)

---

## Phase 15: UX — Session Management & Archival

**Goal**: Session persistence, search, archival, deletion. Codex has archival, deletion with confirmation, session search.

**Difficulty**: Medium | **Estimated effort**: 2–3 days

### Tasks

#### 15.1 Session Archival
- [ ] `/archive`, `qode archive <id>`, `/unarchive`
- [ ] Archived sessions excluded from `resume`

#### 15.2 Session Deletion
- [ ] `/delete` with confirmation, `--force` flag
- [ ] Clean up child sessions

#### 15.3 Session Search
- [ ] `/sessions search <query>` by model, date, directory, content

#### 15.4 Session Export/Import
- [ ] `/sessions export/import`, markdown export
- [ ] `/import` from Claude Code

#### 15.5 Session Stats
- [ ] Track tokens, tool calls, files modified, duration, cost estimate

### Files Modified
- `src/sessions/manager.ts` (new)
- `src/sessions/search.ts` (new)
- `src/chat/session.ts` (archival, stats)
- `src/chat/loop.ts` (commands)

---

## Phase 16: Platform — Windows Support

**Goal**: Full Windows support with sandboxing, PowerShell, path handling.

**Difficulty**: Hard | **Estimated effort**: 4–5 days

### Tasks

#### 16.1 Path Handling
- [ ] Audit all file ops for Windows paths, `path.join()` consistency
- [ ] Handle drive letters, UNC paths

#### 16.2 Shell Integration
- [ ] Detect PowerShell vs cmd.exe vs Git Bash
- [ ] Adapt commands for PowerShell syntax

#### 16.3 Windows Sandbox
- [ ] Windows Sandbox or Docker Desktop for isolation

#### 16.4 CI/CD
- [ ] Add Windows to CI matrix

### Files Modified
- `src/tools/shell/index.ts` (PowerShell)
- `src/tools/file/index.ts` (path handling)
- `src/sandbox/windows.ts` (new)
- `.github/workflows/ci.yml`

---

## Phase 17: Operations — Diagnostics & Health Checks

**Goal**: Diagnostic tools for troubleshooting. Codex has `codex doctor` and feature flags.

**Difficulty**: Easy | **Estimated effort**: 1–2 days

### Tasks

#### 17.1 Doctor Command
- [ ] `qode doctor` checks: Node version, deps, API keys, provider connectivity, sandbox, MCP, disk space

#### 17.2 Debug Mode
- [ ] `--debug` flag: verbose logging to `~/.qode/debug.log`

#### 17.3 Health Monitoring
- [ ] Track provider latency, error rates, show in `/status`

#### 17.4 Crash Reporting
- [ ] Capture exceptions to `~/.qode/crashes/`

### Files Modified
- `src/commands/doctor.ts` (new)
- `src/utils/health.ts` (new)
- `src/utils/crash.ts` (new)
- `src/index.ts` (debug flag)

---

## Phase 18: UX — Memory & Context System

**Goal**: Persistent project memory and intelligent context management. Claude Code has CLAUDE.md (project constitution), `/compact` (context compaction), `/context` (usage reporting), and session titles.

**Difficulty**: Medium | **Estimated effort**: 2–3 days

### Current State
- No project-level memory file — each session starts fresh
- Context compression exists but no `/compact` command or `/context` usage reporting
- Session names not auto-generated

### Tasks

#### 18.1 QODE.md Project Memory
- [ ] Create `QODE.md` convention (like Claude Code's `CLAUDE.md`)
- [ ] Auto-load `QODE.md` from project root on session start
- [ ] Append as system message (not replace system prompt)
- [ ] Support hierarchical loading: `~/.qode/QODE.md` (global) + `./QODE.md` (project)
- [ ] Add `/init` command to generate starter `QODE.md`
- [ ] Add `/memory` command to view/edit loaded memory

```markdown
# QODE.md example
## Project
- TypeScript monorepo with pnpm workspaces
- Node.js 18+, ESM modules

## Conventions
- Use named exports, not default exports
- Prefer `const` over `let`
- Error messages start with capital letter

## Commands
- `pnpm test` — run test suite
- `pnpm lint` — run ESLint
- `pnpm build` — build all packages
```

#### 18.2 Context Compaction Command
- [ ] Add `/compact` command to force context compression
- [ ] Show before/after token count
- [ ] Support `/compact --aggressive` for aggressive compression
- [ ] Auto-suggest compaction when context usage > 80%

#### 18.3 Context Usage Reporting
- [ ] Add `/context` command to show:
  - Current context usage (tokens used / max)
  - Percentage used
  - Breakdown: system prompt, messages, tool outputs
  - Estimated messages until compaction needed
- [ ] Show in status bar: `Context: 45% (89K/200K)`

#### 18.4 Session Titles
- [ ] Auto-generate session titles from first user message
- [ ] Show in `/sessions list` and `--resume` picker
- [ ] Allow manual rename: `/title <new-title>`

#### 18.5 Auto-Memory
- [ ] After significant interactions, suggest saving key decisions to `QODE.md`
- [ ] "Should I remember this for future sessions? (y/n)"
- [ ] User can approve/reject memory suggestions

### Files Modified
- `src/memory/loader.ts` (new — QODE.md loader)
- `src/memory/suggester.ts` (new — auto-memory suggestions)
- `src/chat/loop.ts` (/compact, /context, /init, /memory, /title commands)
- `src/chat/session.ts` (session titles, context tracking)
- `src/config.ts` (memory config)

---

## Phase 19: Safety — Lifecycle Hooks

**Goal**: Deterministic scripts that fire at defined lifecycle points for security and automation. Claude Code has hooks as a first-class security checkpoint.

**Difficulty**: Medium | **Estimated effort**: 2–3 days

### Current State
- No hook system — no way to run custom logic before/after tool calls
- No security checkpoints beyond pattern blocking
- No automation hooks for linting, testing, etc.

### Tasks

#### 19.1 Hook Architecture
- [ ] Define hook types:
```typescript
type HookEvent =
  | 'PreToolUse'        // Before tool execution (security checkpoint)
  | 'PostToolUse'       // After tool execution
  | 'PreMessage'        // Before sending to LLM
  | 'PostMessage'       // After receiving from LLM
  | 'OnError'           // On error
  | 'SessionStart'      // On session start
  | 'SessionEnd';       // On session end

interface Hook {
  event: HookEvent;
  command: string;          // shell command to run
  timeout?: number;         // ms, default 5000
  filter?: {                // optional filter
    toolName?: string;      // only fire for this tool
    pattern?: string;       // regex pattern to match args
  };
}
```

#### 19.2 Hook Configuration
- [ ] Config in `~/.qode/config.json`:
```json
{
  "hooks": [
    {
      "event": "PreToolUse",
      "command": "echo 'About to run tool: $TOOL_NAME'",
      "filter": { "toolName": "shell_exec" }
    },
    {
      "event": "PostToolUse",
      "command": "npx eslint --fix $FILE_PATH",
      "filter": { "toolName": "file_write" }
    }
  ]
}
```
- [ ] Also support `.qode/hooks.json` in project root

#### 19.3 Hook Execution
- [ ] Run hook commands via `child_process.exec()`
- [ ] Pass tool name, args, and result as environment variables
- [ ] `PreToolUse` hooks can block execution (exit code 1 = block)
- [ ] Timeout handling (kill hook after timeout)
- [ ] Capture hook stdout/stderr for debugging

#### 19.4 Built-in Hook Patterns
- [ ] Auto-lint after file writes (PreToolUse with eslint)
- [ ] Auto-format after file writes (prettier)
- [ ] Block shell commands matching dangerous patterns
- [ ] Log all tool calls to audit file

#### 19.5 Hook Commands
- [ ] `/hooks list` — show configured hooks
- [ ] `/hooks test <event>` — test a hook
- [ ] `/hooks enable/disable` — toggle hooks

### Files Modified
- `src/hooks/manager.ts` (new — hook execution engine)
- `src/hooks/config.ts` (new — hook configuration)
- `src/chat/loop.ts` (/hooks commands)
- `src/chat/engine.ts` (hook integration points)
- `src/config.ts` (hook config interface)

---

## Phase 20: UX — Checkpoints & Undo

**Goal**: Automatic snapshots before changes with easy undo. Claude Code snapshots state automatically — press Escape twice to rewind when something breaks.

**Difficulty**: Medium | **Estimated effort**: 2–3 days

### Current State
- No automatic snapshots
- No undo mechanism — changes are permanent
- Manual `git stash` required for rollback

### Tasks

#### 20.1 Checkpoint System
- [ ] Auto-create checkpoint before each tool call that modifies files:
```typescript
interface Checkpoint {
  id: string;
  timestamp: string;
  description: string;          // auto-generated from tool call
  filesChanged: string[];       // file paths modified
  gitHash?: string;             // if git is available
  messageIndex: number;         // position in message history
}
```
- [ ] Store checkpoints in `~/.qode/checkpoints/`
- [ ] Keep last N checkpoints (configurable, default: 20)

#### 20.2 Undo Mechanism
- [ ] Add `/undo` command to revert to last checkpoint
- [ ] Add `/undo <n>` to revert to Nth checkpoint back
- [ ] Restore files from checkpoint snapshot
- [ ] Optionally revert message history to checkpoint point

#### 20.3 Checkpoint UI
- [ ] Show checkpoint creation in status: `[Checkpoint: abc-123 — 3 files modified]`
- [ ] `/checkpoints list` — show recent checkpoints with file counts
- [ ] `/checkpoints diff <id>` — show what changed since checkpoint

#### 20.4 Git Integration
- [ ] If git is available, create git stash before changes
- [ ] Restore from stash on `/undo`
- [ ] Fallback to file snapshots if not in git repo

#### 20.5 Checkpoint Cleanup
- [ ] Auto-clean checkpoints older than 7 days
- [ ] `/checkpoints clean` to manually clean
- [ ] Respect `maxCheckpoints` config

### Files Modified
- `src/checkpoints/manager.ts` (new — checkpoint creation/restoration)
- `src/checkpoints/storage.ts` (new — checkpoint persistence)
- `src/chat/loop.ts` (/undo, /checkpoints commands)
- `src/chat/engine.ts` (auto-checkpoint before modifications)
- `src/config.ts` (checkpoint config)

---

## Phase 21: UX — Effort & Fallback Models

**Goal**: Control reasoning depth and handle model unavailability. Claude Code has `/effort` slider and up to 3 fallback models.

**Difficulty**: Easy | **Estimated effort**: 1–2 days

### Current State
- No effort/reasoning control — always full reasoning
- No fallback model — if primary fails, session fails
- No way to trade quality for speed/cost

### Tasks

#### 21.1 Effort Levels
- [ ] Add `/effort` command with levels:
  - `low` — fast, minimal reasoning (good for simple tasks)
  - `medium` — balanced (default)
  - `high` — deep reasoning (good for complex tasks)
  - `xhigh` — maximum reasoning (hardest tasks)
- [ ] Pass effort level to provider as `reasoning_effort` or `thinking_budget`
- [ ] Show current effort in status: `[Effort: high]`
- [ ] Persist effort level per session

#### 21.2 Effort Configuration
- [ ] Config option:
```typescript
interface EffortConfig {
  default: 'low' | 'medium' | 'high' | 'xhigh';
  perModel?: Record<string, string>;  // model-specific defaults
}
```
- [ ] `/effort auto` — let model decide based on task complexity

#### 21.3 Fallback Models
- [ ] Config option:
```typescript
interface FallbackConfig {
  models: string[];    // up to 3 fallback models, tried in order
  retryCount: number;  // retries per model before trying next
}
```
- [ ] Example config:
```json
{
  "fallback": {
    "models": ["gpt-4o", "claude-sonnet-4-20250514", "deepseek-chat"],
    "retryCount": 1
  }
}
```

#### 21.4 Fallback Logic
- [ ] On provider error (503, 429, timeout), try next model
- [ ] Log fallback events: `[Fallback: Gemini 2.5 Pro unavailable, trying gpt-4o]`
- [ ] Show fallback status in `/status`
- [ ] Configurable per-provider retry counts

#### 21.5 Safe Mode
- [ ] Add `--safe-mode` flag to start with all customizations disabled:
  - No QODE.md loaded
  - No hooks, plugins, or MCP servers
  - No custom commands or agents
  - Default permissions only
- [ ] Useful for troubleshooting broken configurations
- [ ] `/safe-mode` command to enter safe mode mid-session

### Files Modified
- `src/providers/base.ts` (effort parameter support)
- `src/chat/engine.ts` (fallback logic)
- `src/chat/loop.ts` (/effort command, safe mode)
- `src/config.ts` (effort, fallback config)
- `src/index.ts` (--safe-mode flag)

---

## Phase 22: Advanced — Background Tasks

**Goal**: Run long-running commands without blocking the conversation. Claude Code has `run_in_background` flag on Bash tool.

**Difficulty**: Medium | **Estimated effort**: 2–3 days

### Current State
- All shell commands block the conversation
- No way to run long tasks in background
- No task management

### Tasks

#### 22.1 Background Execution
- [ ] Add `runInBackground` option to shell_exec tool
- [ ] When enabled, spawn process and return task ID immediately
- [ ] Continue conversation while task runs

#### 22.2 Task Management
- [ ] Store background tasks in `~/.qode/background/`:
```typescript
interface BackgroundTask {
  id: string;
  command: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  startedAt: string;
  completedAt?: string;
  exitCode?: number;
  output: string;           // captured stdout/stderr
  pid: number;
}
```

#### 22.3 Task Commands
- [ ] `/tasks list` — show running and recent background tasks
- [ ] `/tasks status <id>` — check task status and output
- [ ] `/tasks cancel <id>` — kill a running task
- [ ] `/tasks output <id>` — show task output
- [ ] `/tasks clean` — remove completed tasks

#### 22.4 Task Notifications
- [ ] When a background task completes, show notification:
  ```
  [Background task abc-123 completed: npm test — exit code 0]
  ```
- [ ] If task fails, show error prominently
- [ ] Agent can poll task status via a tool call

#### 22.5 Agent-Driven Background Tasks
- [ ] Agent can start background tasks via tool call:
  ```
  Bash(command="npm run build", run_in_background=true)
  ```
- [ ] Agent receives task ID and can poll for completion
- [ ] Useful for long builds, test suites, deployments

### Files Modified
- `src/background/manager.ts` (new — task lifecycle)
- `src/background/storage.ts` (new — task persistence)
- `src/tools/shell/index.ts` (runInBackground option)
- `src/chat/loop.ts` (/tasks commands)
- `src/chat/engine.ts` (background task integration)

---

## Dependency Graph

**Goal**: Remote execution, background tasks, headless operation. Codex has `codex exec`, app-server, remote-control WebSocket.

**Difficulty**: Hard | **Estimated effort**: 4–5 days

### Tasks

#### 19.1 Headless Execution
- [ ] `qode exec <prompt>` with `--json`, `--timeout`, exit codes

#### 19.2 App Server Mode
- [ ] `qode app-server --listen ws://0.0.0.0:3000`
- [ ] Multi-client WebSocket, session management

#### 19.3 Remote Control
- [ ] `qode remote --remote ws://host:port`

#### 19.4 CI/CD Integration
- [ ] GitHub Action for `qode exec`

#### 19.5 Background Tasks
- [ ] `qode background <prompt>`, `background list/status/cancel`

### Files Modified
- `src/commands/exec.ts` (new)
- `src/server/app-server.ts` (new)
- `src/commands/remote.ts` (new)
- `src/commands/background.ts` (new)
- `.github/actions/qode/` (new)

---

## Dependency Graph

```
Phase 0: Tool System Refactoring ✅
    |
    +---> Phase 1: Provider Improvements ✅
    |         |
    |         +---> Phase 5: Local Model Support ✅
    |
    +---> Phase 2: Permission System ✅
    |         |
    |         +---> Phase 6: Plan Mode ✅
    |         |         |
    |         |         +---> Phase 7: Subagent Flow ✅
    |         |
    |         +---> Phase 7: Subagent Flow (also needs Phase 0) ✅
    |
    +---> Phase 3: Enhanced Tools ✅
    |         |
    |         +---> Phase 6: Plan Mode (needs todowrite) ✅
    |
    +---> Phase 4: Compression & Pruning ✅
    |
    +---> Phase 8: Subscription Login ✅
    |
    +---> Phase 9: LLM-Powered Search ✅

Phase 10: Sandboxed Execution
    |
    +---> Phase 11: MCP Protocol Support (sandboxed MCP calls)

Phase 11: MCP Protocol Support
    |
    +---> Phase 12: Plugin System (plugins can use MCP tools)
    |
    +---> Phase 13: Parallel Execution (parallel MCP calls)

Phase 12: Plugin System
    |
    +---> Phase 17: Diagnostics (plugin health checks)

Phase 19: Lifecycle Hooks (depends on Phase 12 for hook integration)

Phase 14: TUI & Themes (independent)
Phase 15: Session Management (independent)
Phase 16: Windows Support (independent)
Phase 17: Diagnostics (depends on Phase 12)
Phase 18: Memory & Context (independent)
Phase 20: Checkpoints (depends on Phase 0 for tool registration)
Phase 21: Effort & Fallback (depends on Phase 1 for provider effort support)
Phase 22: Background Tasks (independent)
```

### Parallelizable Work
- Phase 10 (Sandbox) — independent
- Phase 11 (MCP) — independent
- Phase 14 (TUI) — independent
- Phase 15 (Sessions) — independent
- Phase 16 (Windows) — independent
- Phase 17 (Diagnostics) — independent
- Phase 18 (Memory) — independent
- Phase 20 (Checkpoints) — independent
- Phase 22 (Background) — independent

### Critical Path
```
Phase 0 → Phase 10 → Phase 11 → Phase 13
Phase 0 → Phase 19 (Hooks)
Phase 0 → Phase 20 (Checkpoints)
```

---

## Estimated Effort

| Phase | Description | Difficulty | Days | Status |
|-------|-------------|------------|------|--------|
| 0 | Tool System Refactoring | Medium | 2–3 | ✅ Done |
| 1 | Provider Improvements | Hard | 3–4 | ✅ Done |
| 2 | Permission System | Medium | 2–3 | ✅ Done |
| 3 | Enhanced Tools | Medium | 2–3 | ✅ Done |
| 4 | Compression & Pruning | Medium | 2–3 | ✅ Done |
| 5 | Local Model Support | Hard | 3–4 | ✅ Done |
| 6 | Plan Mode | Medium | 2–3 | ✅ Done |
| 7 | Subagent Flow | Hard | 3–4 | ✅ Done |
| 8 | Subscription Login | Hard | 3–4 | ✅ Done |
| 9 | LLM-Powered Search | Medium | 2–3 | ✅ Done |
| 10 | Sandboxed Execution | Hard | 4–5 | Pending |
| 11 | MCP Protocol Support | Hard | 5–6 | Pending |
| 12 | Plugin System | Hard | 4–5 | Pending |
| 13 | Parallel Execution | Medium | 2–3 | Pending |
| 14 | TUI & Themes | Medium | 3–4 | Pending |
| 15 | Session Management | Medium | 2–3 | Pending |
| 16 | Windows Support | Hard | 4–5 | Pending |
| 17 | Diagnostics | Easy | 1–2 | Pending |
| 18 | Memory & Context | Medium | 2–3 | Pending |
| 19 | Lifecycle Hooks | Medium | 2–3 | Pending |
| 20 | Checkpoints & Undo | Medium | 2–3 | Pending |
| 21 | Effort & Fallback | Easy | 1–2 | Pending |
| 22 | Background Tasks | Medium | 2–3 | Pending |
| | **Total (All)** | | **58–78** | |
| | **Total (Remaining)** | | **34–44** | |

### Recommended Execution Order

**Sprint 1** (Security, ~5 days): Phase 10
- Sandboxing is critical for production use

**Sprint 2** (Ecosystem, ~8 days): Phase 11 + Phase 12
- MCP support unlocks 9,000+ servers
- Plugin system enables community contributions

**Sprint 3** (Performance, ~5 days): Phase 13 + Phase 14
- Parallel execution for speed
- TUI for better UX

**Sprint 4** (Safety & Memory, ~7 days): Phase 19 + Phase 18 + Phase 20
- Lifecycle hooks for security
- Memory system for project context
- Checkpoints for undo

**Sprint 5** (Polish, ~5 days): Phase 15 + Phase 17 + Phase 21
- Session management + diagnostics + effort/fallback

**Sprint 6** (Platform, ~5 days): Phase 16 + Phase 22
- Windows support + background tasks

---

## Competitive Gap Analysis

| Feature | Qode (Current) | Claude Code | Gap | Priority |
|---------|----------------|-------------|-----|----------|
| **Sandboxing** | Pattern blocking | OS-level filesystem + network | Critical | P0 |
| **MCP Support** | None | 6,000+ servers | Critical | P0 |
| **Memory File** | None | CLAUDE.md project constitution | High | P1 |
| **Lifecycle Hooks** | None | PreToolUse, PostToolUse, etc. | High | P1 |
| **Context Compaction** | Auto only | `/compact`, `/context` commands | Medium | P2 |
| **Checkpoints/Undo** | None | Auto-snapshots, Escape to rewind | Medium | P2 |
| **Effort Levels** | None | `/effort low/medium/high/xhigh` | Medium | P2 |
| **Fallback Models** | None | Up to 3 fallback models | Medium | P2 |
| **Background Tasks** | None | `run_in_background` on Bash | Medium | P2 |
| **Safe Mode** | None | `--safe-mode` troubleshooting | Low | P3 |
| **Session Titles** | None | Auto-generated from first message | Low | P3 |
| **Auto-Memory** | None | Suggest saving key decisions | Low | P3 |

### Where Qode Already Wins
- ✅ Model flexibility (9 providers + local vs Claude-only)
- ✅ Subagent delegation (explore, general with isolated sessions)
- ✅ Semantic search (TF-IDF codebase search, Claude has none)
- ✅ Local model support (llama.cpp with auto-download)
- ✅ Tool variety (~50 tools vs ~15 built-in)
- ✅ Plan mode with structured step tracking
- ✅ Pricing (free + API costs vs $20–200/mo)

### Where Claude Code Leads
- 🏆 Model quality (Opus 4.8, 88.6% SWE-bench)
- 🏆 1M context window
- 🏆 Agent Teams (multi-agent orchestration)
- 🏆 Dynamic workflows (fan-out across agents)
- 🏆 Auto mode (classifier-based safety)
- 🏆 Sandboxing (OS-level isolation)
- 🏆 MCP ecosystem (6,000+ servers)
- 🏆 CLAUDE.md memory (persistent project context)
- 🏆 Hooks (deterministic security checkpoints)
- 🏆 Checkpoints (automatic snapshots + undo)
- 🏆 Effort levels (dial in reasoning depth)
- 🏆 Fallback models (resilience)
- 🏆 Background tasks (non-blocking execution)
- 🏆 Code review (`/code-review`, `/ultrareview`)
- 🏆 Enterprise features (Bedrock, Vertex, Foundry)

---

## Success Criteria

After all phases, Qode should:

1. **Tool System**: Modular, extensible tool registry with 50+ tools
2. **Providers**: Streaming + full tool calling for all providers (Gemini, Anthropic, OpenAI, local)
3. **Permissions**: Granular ask/allow/deny per tool, per mode, per session
4. **Security**: Sandboxed execution (bubblewrap/Docker) + lifecycle hooks for untrusted commands
5. **Ecosystem**: MCP protocol support with 9,000+ servers + plugin marketplace
6. **Performance**: Parallel tool execution with dependency analysis
7. **UX**: Rich TUI with markdown rendering, syntax highlighting, themes
8. **Memory**: QODE.md project memory + auto-memory suggestions + context compaction
9. **Safety**: Lifecycle hooks (PreToolUse, PostToolUse) + checkpoints/undo + safe mode
10. **Resilience**: Fallback models + effort levels + background tasks
11. **Sessions**: Archival, deletion, search, export/import, session titles
12. **Platform**: Windows support + diagnostics (`qode doctor`)

---

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Sandbox performance overhead | Slow tool execution | Benchmark, offer `off` mode, cache sandbox state |
| MCP server instability | Tool failures | Timeout handling, server health checks, retry logic |
| Plugin security | Malicious plugins | Code signing, permission sandboxing, review process |
| Parallel race conditions | Data corruption | File-level locking, dependency analysis |
| Hook security | Malicious hook scripts | Sandboxed hook execution, hook allowlisting |
| Checkpoint storage | Disk space usage | Auto-cleanup, configurable retention |
| Fallback model cascade | Increased latency | Limit to 3 fallbacks, exponential backoff |
| Memory file conflicts | Conflicting QODE.md files | Hierarchical loading, merge strategy |
| TUI complexity | Terminal compatibility | Graceful degradation, ASCII fallbacks |
| Windows path issues | Broken file operations | Extensive path testing, `path.normalize()` usage |

---

*Document created: June 22, 2026*
*Last updated: June 22, 2026 — Added Phases 18–22 based on Claude Code competitive analysis*
*Author: Qode Implementation Plan*
