# Qode Implementation Plan

This document outlines a phased roadmap for major Qode improvements, organized by dependency order and implementation difficulty.

---

## Table of Contents

1. [Phase 0: Foundation — Tool System Refactoring](#phase-0-foundation--tool-system-refactoring)
2. [Phase 1: Foundation — Provider System Improvements](#phase-1-foundation--provider-system-improvements)
3. [Phase 2: Foundation — Permission System](#phase-2-foundation--permission-system)
4. [Phase 3: Core — Enhanced Tools (grep, glob, apply_patch, todowrite, web)](#phase-3-core--enhanced-tools)
5. [Phase 4: Core — Compression & Pruning](#phase-4-core--compression--pruning)
6. [Phase 5: Core — Local Model Support](#phase-5-core--local-model-support)
7. [Phase 6: Advanced — Plan Mode & Progress Tracking](#phase-6-advanced--plan-mode--progress-tracking)
8. [Phase 7: Advanced — Subagent Flow](#phase-7-advanced--subagent-flow)
9. [Phase 8: Advanced — Subscription Login](#phase-8-advanced--subscription-login)
10. [Phase 9: Advanced — LLM-Powered Search](#phase-9-advanced--llm-powered-search)
11. [Dependency Graph](#dependency-graph)
12. [Estimated Effort](#estimated-effort)

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

## Dependency Graph

```
Phase 0: Tool System Refactoring
    |
    +---> Phase 1: Provider Improvements
    |         |
    |         +---> Phase 5: Local Model Support
    |
    +---> Phase 2: Permission System
    |         |
    |         +---> Phase 6: Plan Mode
    |         |         |
    |         |         +---> Phase 7: Subagent Flow
    |         |
    |         +---> Phase 7: Subagent Flow (also needs Phase 0)
    |
    +---> Phase 3: Enhanced Tools (grep, glob, apply_patch, todowrite, web)
    |         |
    |         +---> Phase 6: Plan Mode (needs todowrite)
    |
    +---> Phase 4: Compression & Pruning
    |
    +---> Phase 8: Subscription Login (independent)
    |
    +---> Phase 9: LLM-Powered Search (needs Phase 0 for tool registration)
```

### Parallelizable Work
These can be worked on simultaneously after Phase 0:
- Phase 1 (Provider) + Phase 3 (Tools) — no dependencies between them
- Phase 4 (Compression) — independent
- Phase 8 (Subscription Login) — independent
- Phase 9 (LLM-Powered Search) — independent (only needs Phase 0)

### Critical Path
```
Phase 0 → Phase 2 → Phase 6 → Phase 7
```

---

## Estimated Effort

| Phase | Description | Difficulty | Days |
|-------|-------------|------------|------|
| 0 | Tool System Refactoring | Medium | 2–3 |
| 1 | Provider Improvements | Hard | 3–4 |
| 2 | Permission System | Medium | 2–3 |
| 3 | Enhanced Tools | Medium | 2–3 |
| 4 | Compression & Pruning | Medium | 2–3 |
| 5 | Local Model Support | Hard | 3–4 |
| 6 | Plan Mode | Medium | 2–3 |
| 7 | Subagent Flow | Hard | 3–4 |
| 8 | Subscription Login | Hard | 3–4 |
| 9 | LLM-Powered Search | Medium | 2–3 |
| | **Total** | | **24–34 days** |

### Recommended Execution Order

**Sprint 1** (Foundation, ~5 days): Phase 0 + Phase 2
- Get the tool registry and permission system working first
- Everything else builds on these

**Sprint 2** (Core Features, ~5 days): Phase 3 + Phase 4
- Enhanced tools (grep, glob, apply_patch, todowrite, web)
- Compression improvements
- Can be done in parallel

**Sprint 3** (Providers, ~4 days): Phase 1 + Phase 5
- Fix all providers (streaming, tool calling)
- Local model support
- Can be done in parallel

**Sprint 4** (Advanced, ~6 days): Phase 6 + Phase 7
- Plan mode and subagent flow
- Depends on Phases 0, 2, 3

**Sprint 5** (Polish, ~3 days): Phase 8
- Subscription login
- Can be done anytime but lower priority

**Sprint 6** (Search, ~2 days): Phase 9
- LLM-powered semantic search
- Depends only on Phase 0 (tool registry)
- Can be done anytime after Phase 0

---

## Success Criteria

After all phases, Qode should:

1. **Tool System**: Modular, extensible tool registry with 45+ tools
2. **Providers**: Streaming + full tool calling for all providers (Gemini, Anthropic, OpenAI, local)
3. **Permissions**: Granular ask/allow/deny per tool, per mode, per session
4. **Tools**: Production-grade grep, glob, apply_patch, todowrite, webfetch, websearch, semantic_search
5. **Compression**: Intelligent pruning + incremental compression
6. **Local Model**: Working local inference via llama.cpp with the Qwen model
7. **Plan Mode**: Full plan/implementation workflow with Tab switching
8. **Subagents**: Task delegation to explore/general subagents with child sessions
9. **Auth**: OAuth/subscription login for major providers
10. **Search**: TF-IDF semantic search across codebase with ranked results

---

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| llama.cpp binary compatibility | Local model won't work | Ship pre-built binaries for major platforms, fallback to download |
| OAuth security | Token leakage | Use OS keychain, encrypt at rest, never log tokens |
| Provider API changes | Breaking tool calling | Test against live APIs in CI, version pin SDK dependencies |
| Streaming performance | Laggy UX | Use efficient chunked parsing, test with slow connections |
| Subagent complexity | Hard to debug | Extensive logging, `/debug` command to inspect subagent state |
| Permission UX friction | User annoyance | Smart defaults (allow all), remember choices, easy bypass |

---

*Document created: June 22, 2026*
*Last updated: June 22, 2026 — Added Phase 9 (LLM-Powered Search)*
*Author: Qode Implementation Plan*
