# Qode

**Qode** is a professional, lightweight, and type-safe AI developer pair-programming command-line interface (CLI). Built with TypeScript and Node.js, Qode connects directly with various state-of-the-art AI model providers, equipped with context compression, local skill modules, remote registry integration, interactive filesystem browsing, inline shell executions, terminal theme settings, and advanced AI-powered features including plan mode, subagent delegation, semantic search, and local model support.

---

## Key Features

- **Multi-Provider & Multi-Model Support**: Connect natively to Gemini, OpenAI, Anthropic, DeepSeek, OpenRouter, Groq, GitHub Models, and local models via llama.cpp.
- **Tool Registry System**: Modular, extensible tool registry with 50+ tools organized by category (file, shell, search, git, build, web, planning).
- **Permission System**: Granular ask/allow/deny permissions per tool, per mode, per session with built-in modes (plan, build, explore).
- **Plan Mode**: Read-only analysis mode for planning without making changes, with progress tracking via todowrite.
- **Subagent Flow**: Delegate tasks to specialized subagents (explore, general) with isolated sessions and restricted permissions.
- **LLM-Powered Semantic Search**: Search codebase by meaning using TF-IDF embeddings, not just keywords.
- **Subscription Login**: OAuth/device-code authentication for Google AI Studio, OpenAI, Anthropic, and GitHub Copilot.
- **Local Model Support**: Run models locally via llama.cpp with auto-download and server management.
- **Interactive File System Browser (`Ctrl+F`)**: Interactively search and traverse your project directory in-place during prompt typing.
- **Inline Shell Execution (`!`)**: Execute shell commands directly inside the chat prompt with built-in safety filtering.
- **Context Compression & Sessions**: Automatically or manually compress conversational histories with intelligent pruning.
- **Skill Module Integration**: Inject workflow-specific rules and instruction scripts with local workspace and remote registry support.
- **Dynamic Visual Themes & Fallbacks**: Support on-the-fly terminal theme switching with Unicode/ASCII fallbacks.
- **Native Clipboard Hotkeys**: Copy last response (`Ctrl+K`) and paste as prompt (`Ctrl+G`).

---

## Table of Contents
1. [Installation & Build](#installation--build)
2. [API Configuration](#api-configuration)
3. [Supported Model Providers & Models](#supported-model-providers--models)
4. [Advanced Features](#advanced-features)
5. [Prompt Usage & Interactive Features](#prompt-usage--interactive-features)
6. [Slash Commands Reference](#slash-commands-reference)
7. [Interactive File Browser (Ctrl+F)](#interactive-file-browser-ctrlf)
8. [Shell Execution Mode (!)](#shell-execution-mode-)
9. [Testing & Development](#testing--development)
10. [License](#license)

---

## Installation & Build

### 1. Build from Source
Ensure you have Node.js (v18+) and git installed:
```bash
git clone https://github.com/qode/qode.git
cd qode
npm install
npm run build
```

### 2. Run the CLI
Start the CLI prompt directly using Node:
```bash
node dist/index.js
```
Or start via the built-in npm start script:
```bash
npm start
```

### 3. Global Linking (Optional)
To run the `qode` command globally on your system:
```bash
npm link
# You can now launch it anywhere by running:
qode
```

---

## API Configuration

Qode loads provider configurations and API keys from standard environment variables, falling back to a local JSON configuration file if environment variables are not set.

### Option A: Interactive Setup (Recommended)
Configure API keys interactively from the CLI:
```bash
qode auth
```
This masks your input keys and writes them directly to the Qode global config file at `~/.qode/config.json`.

### Option B: Subscription Login
Connect to providers using OAuth or device code flows:
```bash
/connect Google AI Studio    # API key setup
/connect OpenAI              # Device code flow
/connect GitHub Copilot      # Device code flow
/auth status                 # Show all providers
/auth logout <provider>      # Remove credentials
```

### Option C: Environment Variables
You can export provider API keys in your active shell or within a `.env` file in your working directory:
```bash
export GOOGLE_API_KEY="AIzaSy..."
export OPENAI_API_KEY="sk-proj-..."
export DEEPSEEK_API_KEY="sk-ds-..."
export OPENROUTER_API_KEY="sk-or-..."
export GROQ_API_KEY="gsk_..."
export GITHUB_MODELS_API_KEY="ghu_..."
```

---

## Supported Model Providers & Models

Qode is built to support a wide array of LLM endpoints. You can query models on-the-fly using the `/model <model-name>` command.

### 1. Google AI Studio (Gemini)
Highly optimized for large context windows, code translation, and reasoning tasks.
- **Required Env Var**: `GOOGLE_API_KEY`
- **Supported Models**:
  - `Gemini 2.5 Flash` (Default)
  - `Gemini 2.5 Pro`
  - `Gemini 1.5 Pro`
  - `Gemini 1.5 Flash`

### 2. OpenAI API
State-of-the-art GPT models for general programming and high-complexity reasoning.
- **Required Env Var**: `OPENAI_API_KEY`
- **Supported Models**:
  - `gpt-4o`
  - `gpt-4o-mini`
  - `o1`
  - `o1-mini`
  - `gpt-4-turbo`

### 3. Anthropic (Claude)
Advanced AI models for coding, analysis, and complex reasoning tasks.
- **Required Env Var**: `ANTHROPIC_API_KEY`
- **Supported Models**:
  - `claude-sonnet-4-20250514`
  - `claude-3-5-sonnet-20241022`
  - `claude-3-5-haiku-20241022`

### 4. DeepSeek API
Highly cost-efficient and performant code generation and reasoning models.
- **Required Env Var**: `DEEPSEEK_API_KEY`
- **Supported Models**:
  - `deepseek-chat` (DeepSeek-V3)
  - `deepseek-reasoner` (DeepSeek-R1)

### 5. GitHub Models
Access hosted developer models via your GitHub Personal Access Token (PAT).
- **Required Env Var**: `GITHUB_MODELS_API_KEY` (or custom PAT)
- **Supported Models**:
  - `gpt-4o`
  - `gpt-4o-mini`
  - `o1-mini`
  - `meta-llama-3-70b`
  - `cohere-command-r-plus`

### 6. OpenRouter
A unified router to query open-weight model architectures (Llama 3, Qwen, Claude, Mistral).
- **Required Env Var**: `OPENROUTER_API_KEY`
- **Supported Models**:
  - `anthropic/claude-3.5-sonnet`
  - `meta-llama/llama-3.1-405b-instruct`
  - `qwen/qwen-2.5-coder-32b-instruct`
  - `google/gemini-2.5-pro`

### 7. GroqCloud
High-speed execution of open-weight developer models.
- **Required Env Var**: `GROQ_API_KEY`
- **Supported Models**:
  - `llama-3.3-70b-versatile`
  - `mixtral-8x7b-instruct-32768`
  - `gemma2-9b-it`

### 8. OpenCode (Free)
OpenCode provides free, open-source models for coding and tooling tasks.
- **Required Env Var**: none (no API key needed)
- **Supported Models**:
  - `big-pickle`
  - `deepseek-v4-flash-free`
  - `mimo-v2-5-free`
  - `nemotron-3-ultra-free`
  - `north-mini-code-free`

### 9. Local Models (llama.cpp)
Run models locally on your machine using llama.cpp.
- **Setup**: Enable in config (`~/.qode/config.json`):
  ```json
  { "localModel": { "enabled": true, "autoStart": true } }
  ```
- **Supported Models** (auto-download):
  - `Qwen 2.5 0.5B` (tiny, fastest)
  - `Qwen 2.5 1.5B` (small)
  - `Qwen 2.5 3B` (medium, recommended)
  - `DeepSeek Coder V2 Lite` (code-optimized)

---

## Advanced Features

### Plan Mode
Switch to plan mode for read-only analysis without making changes:
```bash
/mode plan              # Switch to plan mode
/mode build             # Switch back to build mode
/plan show              # View active plan
/plan export            # Export plan as markdown
```

In plan mode, file edits and shell commands are denied. Use the `todowrite` tool to track plan progress.

### Subagent Delegation
Delegate tasks to specialized subagents:
```bash
/task explore "Find all authentication patterns in the codebase"
@explore find auth patterns
```

**Built-in subagents:**
- `explore`: Read-only codebase exploration (file_read, grep, glob, todowrite)
- `general`: Full access for complex multi-step tasks

### Semantic Search
Search your codebase by meaning, not just keywords:
```bash
/search authentication patterns
/search --rebuild database queries
```

Or use the `semantic_search` tool via the AI assistant. Uses TF-IDF embeddings with cosine similarity.

### Local Model Support
Run AI models locally without API keys:
```bash
/model local             # Switch to local model
```

The server auto-starts on launch if configured. Supports GPU offloading and configurable context sizes.

### Authentication
Manage provider credentials:
```bash
/connect Google AI Studio    # Set up API key
/connect GitHub Copilot      # Device code flow
/auth status                 # Show all providers
/auth logout OpenAI          # Remove credentials
```

---

## Prompt Usage & Interactive Features

### Multiline Input Accumulation
If you need to enter complex prompt sequences, write a trailing backslash `\` at the end of the line. The prompt will switch to `... ` input accumulation. Type `/cancel` to abort:
```text
[Gemini 2.5 Flash] > Create a TypeScript interface for a tree node: \
...   export interface TreeNode<T> { \
...     value: T; \
...     children: TreeNode<T>[]; \
...   }
```

### Keyboard Clipboard Hotkeys
Qode supports instant clipboard interactions bound directly to your CLI prompt:
- **`Ctrl+K`**: Copies the last assistant response to your clipboard (equivalent to running `/copy`).
- **`Ctrl+G`**: Pastes current clipboard contents directly into the readline input and submits it as your next prompt (equivalent to running `/paste`).

---

## Slash Commands Reference

Enter slash commands directly into the prompt to manage your session lifecycle:

### Session Management
- `/model <model-name>`: Switch the current model (e.g. `/model gpt-4o`).
- `/review <file1> [file2]`: Submits one or more files for code review.
- `/suggest <task>`: Generates a code suggestion based on a task description.
- `/compress [--keep N]`: Forces context compression (N = messages to keep).
- `/clear`: Wipes message history (retaining system prompt).
- `/sessions`: Lists all saved sessions.
- `/save`: Saves the current session status.
- `/status`: Renders token usage, session age, mode, plan progress, and modified files.

### Permissions & Modes
- `/permissions [list|set|mode|clear]`: View/set tool permissions.
- `/allow-all`: Allow all tools for this session.
- `/deny-all`: Disable permission bypass.
- `/mode [plan|build]`: Switch agent mode or show current mode.

### Planning
- `/plan [show|clear|export]`: Manage active plan.
- `/task <subagent> <prompt>`: Delegate task to a subagent.

### Search
- `/search [--rebuild] <query>`: Semantic search across codebase.

### Authentication
- `/connect <provider>`: Set up authentication for a provider.
- `/auth [status|logout]`: Manage authentication.

### Skills
- `/skills list`: Lists available remote skills.
- `/skills search <query>`: Searches the remote registry.
- `/skills install <name> [--global]`: Installs a skill global or locally.
- `/skills list-local`: Lists all installed local and global skills.

### Other
- `/theme [theme-name]`: Lists available themes or switches visual configurations.
- `/copy`: Copies last response.
- `/paste`: Submits clipboard text.
- `/cancel`: Discards multi-line buffer.
- `/exit`: Saves changes and exits.

### @Mentions
Delegate to subagents via @mention syntax:
```bash
@explore find all API endpoints
@general refactor the authentication module
```

---

## Interactive File Browser (`Ctrl+F`)

While typing your prompt in the command line, press **`Ctrl+F`** to launch the interactive file system browser. Readline input pauses, and a file browser is rendered in-place:

1. **Traversing Directories**:
   - `Up Arrow` / `Down Arrow`: Scroll selection highlight.
   - `Right Arrow` or `Enter` (on Folder): Navigate inside the folder.
   - `Left Arrow` or `Backspace` (or selecting `..`): Move up to the parent directory.
2. **Selecting Elements**:
   - `Space` or `Tab`: Select the highlighted file or directory, close the browser, and write its relative path at the prompt cursor.
   - `Enter` (on File): Select the file, close the browser, and write its relative path.
3. **Closing Browser**:
   - `Escape` (or `Ctrl+C`): Close the browser immediately without modifying your prompt.

*Note: The browser uses a 10-line viewport scroll system. When navigating large folder trees, only 10 items are shown at a time to prevent terminal pollution.*

---

## Shell Execution Mode (`!`)

To run standard shell commands without leaving your prompt loop, prefix your line with `!`:

```text
[Gemini 2.5 Flash] > !git diff
[Gemini 2.5 Flash] > !npm run build
[Gemini 2.5 Flash] > !cd src/test && npm test
```

### Directory Navigation (`!cd`)
Typing `!cd <path>` changes the current working directory of the active Qode CLI process, updating all subsequent commands, file browsers, and file review scopes. `~` paths are resolved to your OS home folder.

### Safe Shield Blocker
Qode features a safety check to prevent accidental destructive command typing. High-risk commands such as `rm -rf /`, `rm -rf *`, `dd if=`, and `mkfs` are blocked, displaying a safety warning.

---

## Configuration

### Config File
Qode stores configuration at `~/.qode/config.json`:

```json
{
  "defaultModel": "Gemini 2.5 Flash",
  "autoCompress": true,
  "compressThreshold": 0.8,
  "theme": "default",
  "maxToolCalls": 50,
  "permissions": {
    "*": "allow"
  },
  "permissionModes": {
    "plan": { "edit": "deny", "bash": "ask", "read": "allow", "*": "allow" },
    "build": { "*": "allow" },
    "explore": { "edit": "deny", "bash": "deny", "read": "allow", "*": "allow" }
  },
  "compression": {
    "keepMessages": 4,
    "keepSystem": true,
    "pruneAfterMessages": 20,
    "pruneMaxChars": 120
  },
  "localModel": {
    "enabled": false,
    "autoStart": false,
    "port": 8080,
    "contextSize": 32768
  }
}
```

### Data Storage
- `~/.qode/config.json` — Main configuration
- `~/.qode/auth.json` — Encrypted authentication credentials
- `~/.qode/sessions/` — Saved chat sessions
- `~/.qode/models/` — Downloaded local models
- `.qode/search-index.json` — Semantic search index (per workspace)

---

## Testing & Development

Qode uses Jest for unit testing. To run the test suite (20 test suites, 102 unit tests covering all features):
```bash
npm test
```

To run a lint check:
```bash
npm run lint
```

---

## License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) document for details. Developed by Benoy Bose `<benoybose@cosq.net>`, from COSQ Network Private Limited.
