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
- **Secure Credential Storage**: Encrypted provider credentials with masked interactive setup.
- **Local Model Support**: Run models locally via llama.cpp with auto-download and server management.
- **Interactive File System Browser (`Ctrl+F`)**: Interactively search and traverse your project directory in-place during prompt typing.
- **Inline Shell Execution (`!`)**: Execute shell commands directly inside the chat prompt with built-in safety filtering.
- **Context Compression & Sessions**: Automatically or manually compress conversational histories with intelligent pruning.
- **Skill Module Integration**: Inject workflow-specific rules and instruction scripts with local workspace and remote registry support.
- **Default Theme**: `Default`
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
Install `qode` directly from GitHub Packages using npm:
```bash
npm install @cosq-network/qode --registry=https://npm.pkg.github.com
```
If the package is private, authenticate first with a GitHub token that has `read:packages` scope:
```bash
npm config set //npm.pkg.github.com/:_authToken=<SECRET_03f4a7ff> GitHub token with read:packages scope)
```
If you have GitHub Packages configured in your `~/.npmrc`, you can omit the `--registry` flag.

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
qode auth
```
This masks your input keys and stores them securely in encrypted credentials (`~/.qode/auth.json`) using the built-in auth storage. Use `qode auth --reset` to remove stored keys.

### Option B: Environment Variables
You can export provider API keys in your active shell or within a `.env` file in your working directory:
```bash
export GOOGLE_API_KEY=***
export OPENAI_API_KEY=***
export DEEPSEEK_API_KEY=***
export OPENROUTER_API_KEY=***
export GROQ_API_KEY=***
export GITHUB_MODELS_API_KEY=***
```
Qode reads these at runtime from the standard environment and never writes them to disk.

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

### 9. GitHub Copilot
GitHub Copilot is supported only as a device-code/subscription flow. Configure it from the CLI:
```bash
qode auth --device github-copilot
```
Usage from chat is not available for this provider.

### 10. OpenCode (Free)
OpenCode provides free, open-source models for coding and tooling tasks.
- **Required Env Var**: none (no API key needed)
- **Supported Models**:
  - `big-pickle`
  - `deepseek-v4-flash-free`
  - `mimo-v2-5-free`
  - `nemotron-3-ultra-free`
  - `north-mini-code-free`

### 11. Local Models (llama.cpp)
Run models locally on your machine using llama.cpp.
- **Prerequisite**: install `llama-server` from `llama.cpp` (for example, `brew install llama.cpp` on macOS). Qode auto-detects the binary at startup. If it is missing, local mode cannot be used even when the model file is already downloaded.
- **Setup**: enable in config (`~/.qode/config.json`):
  ```json
  { "localModel": { "enabled": true, "autoStart": true } }
  ```
- **Downloaded models**: Qode can download built-in GGUF model files such as the Qwen 2.5 Coder models and DeepSeek Coder V2 Lite into `~/.qode/models/`. The first suitable downloaded model is used as the default local model.
- **Use in Qode**: after enabling local mode and ensuring `llama-server` is installed, run `qode use Local <model-name>` to make the local model the active chat backend.

---

### Authentication

Qode is BYOK-only for API-key providers. Credentials are set up via `qode auth`, with keys stored encrypted at `~/.qode/auth.json`. Use `qode auth --reset` to remove stored keys.

GitHub Copilot is an exception: configure it with `qode auth --device github-copilot`. No subscription sign-in is available through chat commands.

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
/models                      List available providers and models
/compress [--keep N]         Force context compression
/clear                       Clear conversation (keep system)
/save                        Save the current session
/sessions                    List saved sessions
/status                      Show session dashboard (tokens, duration, changed files)
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
/search [--rebuild] <query>  Semantic search across codebase
/task <subagent> <prompt>    Delegate task to a subagent
@<subagent> <prompt>         Delegate via mention (e.g. @explore <task>)
!<command>                   Execute a shell command inline
```

### Skills & Models

```text
/skills [cmd]                Manage skills (list, search, install, list-local)
/skills list                 List registry skills
/skills search <query>       Search registry for skills
/skills install <name> [--global]
/skills list-local           List workspace + global installed skills
/download-status             Check background model download progress
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


