# Qode

**Qode** is a professional, lightweight, and type-safe AI developer pair-programming command-line interface (CLI). Built with TypeScript and Node.js, Qode connects directly with various state-of-the-art AI model providers, equipped with context compression, local skill modules, remote registry integration, interactive filesystem browsing, inline shell executions, terminal theme settings, and advanced AI-powered features including plan mode, subagent delegation, and semantic search.

---

## Key Features

- **Multi-Provider & Multi-Model Support**: Connect natively to Gemini, OpenAI, Anthropic, DeepSeek, OpenRouter, OpenCode Zen, and Z.ai.
- **Tool Registry System**: Modular, extensible tool registry with 50+ tools organized by category (file, shell, search, git, build, web, planning).
- **Permission System**: Granular ask/allow/deny permissions per tool, per mode, per session with built-in modes (plan, build, explore).
- **Plan Mode**: Read-only analysis mode for planning without making changes, with progress tracking via todowrite.
- **Subagent Flow**: Delegate tasks to specialized subagents (explore, general) with isolated sessions and restricted permissions.
- **Context Fusion Panel**: Compare model outputs side-by-side using `/compare`.
- **Agentic Workspace Map**: Generate structural repo digests instantly via `/workspace` or `@workspace`.
- **Terminal Diff Theater**: Interactive before/after diff modal for accepting or reverting automated code edits.
- **Tool Audit Trail**: Transparent session logging of all tool executions (`/audit`).
- **LLM-Powered Semantic Search**: Search codebase by meaning using TF-IDF embeddings, not just keywords.
- **Secure Credential Storage**: Encrypted provider credentials with masked interactive setup.
- **Interactive File System Browser (`Ctrl+F`)**: Interactively search and traverse your project directory in-place during prompt typing.
- **Inline Shell Execution (`!`)**: Execute shell commands directly inside the chat prompt with built-in safety filtering.
- **Context Compression & Sessions**: Automatically or manually compress conversational histories with intelligent pruning.
- **Interactive Terminal UI**: Dynamic header panel tracks session tokens and elapsed time. Scrollable transcript with full markdown rendering, intuitive keyboard navigation (Shift+Up/Down, PageUp/Down), and native OS text selection.
- **Skill Module Integration**: Inject workflow-specific rules and instruction scripts with local workspace and remote registry support, now with skill removal support.
- **Available Themes**: `Default`, `Ocean`, `Monochrome`, `Sunset`, `Forest`, `Catppuccin Mocha`, `Nord`
- **Theme Command**: `/theme <name>` or `/theme` to list themes
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

## CLI Reference

```bash
qode --help                  # show CLI help
qode chat                    # start an interactive coding session
qode chat -r <id>            # resume a specific session
qode chat -m <model>         # start with an initial model
qode models                  # list available providers and models
qode update-models           # fetch the latest model lists from providers
qode auth                    # setup or update stored API keys
qode auth --reset            # remove stored API keys
qode use <provider> <model>  # switch default provider and model
qode sessions                # list saved sessions
qode session-delete <id>     # delete a saved session

# Global options
qode --json                  # output machine-readable JSON
qode --log-level <level>     # set log level: error | info | debug
```

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

### 2. Install from GitHub Packages (Optional)
1. **Install globally**:
   ```bash
   npm install -g @cosq-network/qode
   ```

2. **Run Qode**:
   ```bash
   qode
   ```
   *On your first run, Qode will automatically launch an interactive **Setup Wizard** to help you select a provider, choose a model, and securely enter your API key.*

### 3. Run the CLI
Start the CLI prompt directly using Node after building from source:
```bash
node dist/index.js
```
Or start via the built-in npm start script:
```bash
npm start
```
If you installed via GitHub Packages, you can run it via:
```bash
npx qode
```

### 4. Global Linking (Optional)
To run the `qode` command globally on your system:
```bash
npm link
# You can now launch it anywhere by running:
qode
```

---

## API Configuration

Qode is BYOK-only for API-key providers. Provider keys are loaded from environment variables, from `qode auth`, or from project-level `.env.qode` files. Qode does not support subscription sign-in from the chat.

### Option A: Interactive API Key Setup (API-key providers)
Configure API keys interactively from the CLI:
```bash
qode setup
```
This masks your input keys and stores them securely in encrypted credentials (`~/.qode/auth.json`) using the built-in auth storage. Use `qode auth --reset` to remove stored keys.

### Option B: Environment Variables
You can export provider API keys in your active shell or within a `.env` file in your working directory:
```bash
export GOOGLE_API_KEY=***
export OPENAI_API_KEY=***
export DEEPSEEK_API_KEY=***
export OPENROUTER_API_KEY=***
export OPENROUTER_API_KEY=***
export GITHUB_MODELS_API_KEY=***
```
Qode reads these at runtime from the standard environment and never writes them to disk.

---

## Supported Model Providers & Models

Qode is built to support a wide array of LLM endpoints. You can query models on-the-fly using the `/model <model-name>` command.

### 1. Google AI Studio (Gemini)
Highly optimized for large context windows, code translation, and reasoning tasks. Offers a generous perpetual free tier for developers.
- **Required Env Var**: `GOOGLE_API_KEY`
- **Supported Models**:
  - `Gemini 2.5 Flash`
  - `Gemini 2.5 Pro`
  - `Gemini 3.1 Pro Preview`
  - `Gemini 3.5 Flash`

### 2. OpenAI API
State-of-the-art GPT models for general programming and high-complexity reasoning. (Pay-as-you-go, no perpetual free tier).
- **Required Env Var**: `OPENAI_API_KEY`
- **Supported Models**:
  - `gpt-4o`
  - `gpt-4o-mini`
  - `o1`
  - `o1-mini`
  - `gpt-4-turbo`

### 3. Anthropic (Claude)
Advanced AI models for coding, analysis, and complex reasoning tasks. (Pay-as-you-go, no perpetual free tier).
- **Required Env Var**: `ANTHROPIC_API_KEY`
- **Supported Models**:
  - `claude-sonnet-4-20250514`
  - `claude-3-5-sonnet-20241022`
  - `claude-3-5-haiku-20241022`

### 4. DeepSeek API
Highly cost-efficient and performant code generation and reasoning models. (Pay-as-you-go).
- **Required Env Var**: `DEEPSEEK_API_KEY`
- **Supported Models**:
  - `deepseek-chat` (DeepSeek-V3)
  - `deepseek-reasoner` (DeepSeek-R1)

### 5. OpenRouter
A unified router to query open-weight model architectures (Llama 3, Qwen, Claude, Mistral). Many community-hosted models are completely free.
- **Required Env Var**: `OPENROUTER_API_KEY`
- **Supported Models**:
  - `anthropic/claude-3.5-sonnet`
  - `meta-llama/llama-3.1-405b-instruct`
  - `qwen/qwen-2.5-coder-32b-instruct`
  - `google/gemini-2.5-pro`

### 6. OpenCode Zen
OpenCode Zen provides hosted models for coding and tooling tasks. All currently integrated models are completely free to use.
- **Required Env Var**: `OPENCODE_ZEN_API_KEY`
- **Supported Models**:
  - `big-pickle`
  - `deepseek-v4-flash-free`
  - `nemotron-3-ultra-free`

### Authentication

Qode is BYOK-only for API-key providers. Credentials are set up via `qode setup`, with keys stored encrypted at `~/.qode/auth.json`. Use `qode auth --reset` to remove stored keys.

---

## Advanced Features

### Interactive File System Browser (`Ctrl+F`)
Open an interactive file browser during prompt input without leaving the chat flow. Use it to locate files, copy their paths, or reference project structure while you are typing.

### Inline Shell Execution (`!`)
Run shell commands without exiting the chat. Prefix any prompt with `!` to execute that command in the current working directory.

### Context Compression & Sessions
Qode compresses conversational history when it nears the context limit. You can also force compression manually with `/compress`.

### Semantic Search
Search codebase files by meaning rather than filename only. Use `/search <query>` from inside an active session.

### Subagent Delegation
Delegate work to subagents using `/task <subagent> <prompt>` or `@<subagent> <prompt>` inside the chat.

---

## Prompt Usage & Interactive Features

- **Model switching**: `/model <model>` changes the active model for the current session.
- **Slash commands**: use built-in commands for review, search, plan management, permissions, sessions, skills, and auth.
- **Theme switching**: `/theme [name]` lists available themes or switches to the chosen theme.
- **Mentions**: `@explore <task>` delegates a task to an explore subagent.
- **File read shortcut**: `@read <file_path>` reads a file into the chat output.
- **Shell inline**: `!cmd` runs a shell command inline.
- **Clipboard**: `Ctrl+K` copies the last response; `Ctrl+G` pastes clipboard content as a prompt.

---

## Slash Commands Reference

### Core Session

```text
/model <model>               Switch the active model
/model                       List available models
/search [--rebuild] <query>  Semantic search across codebase
/compress [--keep N]         Force context compression
/clear                       Clear conversation (keep system)
/save                        Save the current session
/sessions                    List saved sessions
/status                      Show session dashboard (tokens, duration, changed files)
/workspace                   Show live structural digest of the active repository
/audit                       Review tool execution audit trail
```

### Agent Behavior & Permissions

```text
/mode [plan|build]           Switch agent mode or show current mode
/plan [show|clear|export]    Manage the active plan
/permissions [cmd]           View/set tool permissions
/allow-all                   Allow all tools for this session
/deny-all                    Disable permission bypass
```

### Review & Generation

```text
/review <file...>            Review one or more files
/suggest <description>       Generate a code suggestion
/compare <prompt>            Compare responses from two configured providers
/setup                       Launch the interactive Setup Wizard to re-configure providers/models
/auth status                 Check BYOK auth status across all providers
/task <subagent> <prompt>    Delegate task to a subagent
@<subagent> <prompt>         Delegate via mention (e.g. @explore <task>)
/@read <file_path>           Read a file into the chat output
@workspace                   Inject workspace structural digest into the prompt
!<command>                   Execute a shell command inline
```

### Auth & Config

```text
/auth status                 Show BYOK auth status
/auth list                   List supported providers
/auth set <provider>         Store an API key securely
/auth clear <provider>       Remove stored credentials
```

### Skills & Models

```text
/skills [cmd]                Manage skills (list, search, install, list-local, suggest)
/skills list                 List registry skills
/skills search <query>       Search registry for skills
/skills suggest              Suggest skills based on repository tech stack
/skills install <name> [--global]
/skills list-local           List workspace + global installed skills
/update-models               Fetch latest model lists from provider APIs
```

---

## Interactive File Browser (Ctrl+F)

When you press `Ctrl+F`, Qode opens an interactive browser overlay. This lets you:

- traverse directories
- search filenames
- paste paths back into the prompt

Use it as a quick way to reference files by path without copy-pasting from your terminal.

---

## Shell Execution Mode (!)

Enter a shell command by prefixing your input with `!`:

```text
!git status
!npm test
!ls -la src
```

This is useful for one-off checks while keeping the conversation and context intact.

---

## Testing & Development

```bash
npm test
npm run lint
npm run build
```

---

## License

MIT
