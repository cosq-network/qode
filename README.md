# Qode

**Qode** is a professional, lightweight, and type-safe AI developer pair-programming command-line interface (CLI). Built with TypeScript and Node.js, Qode connects directly with various state-of-the-art AI model providers, equipped with context compression, local skill modules, remote registry integration, interactive filesystem browsing, inline shell executions, and terminal theme settings.

---

## Key Features

- **Multi-Provider & Multi-Model Support**: Connect natively to Gemini, OpenAI, DeepSeek, OpenRouter, Groq, and GitHub Models.
- **Interactive File System Browser (`Ctrl+F`)**: Interactively search and traverse your project directory in-place during prompt typing, selecting and inserting relative file and folder path references directly at the cursor.
- **Inline Shell Execution (`!`)**: Execute shell commands (e.g. `!git status` or `!npm test`) directly inside the chat prompt. Includes process-level directory navigation (`!cd`) and a built-in safety filter blocking destructive command patterns (e.g. `rm -rf`).
- **Context Compression & Sessions**: Automatically or manually compress conversational histories once threshold boundaries are crossed. Save, restore, list, or delete chat sessions via unique UUIDs.
- **Skill Module Integration**: Inject workflow-specific rules, style guides, and instruction scripts to guide review or generation prompts. Built with local workspace overriding and offline-safe remote registry caching.
- **Dynamic Visual Themes & Fallbacks**: Support on-the-fly terminal theme switching (`/theme`) with visual age, files, and token usage headers. Legacy terminal auto-detection switches Unicode emojis to ASCII tags for compatibility.
- **Native Clipboard Hotkeys**: Copy the last generated AI response (`Ctrl+K`) and paste the clipboard as your next prompt (`Ctrl+G`).

---

## Table of Contents
1. [Installation & Build](#installation--build)
2. [API Configuration](#api-configuration)
3. [Supported Model Providers & Models](#supported-model-providers--models)
4. [Prompt Usage & Interactive Features](#prompt-usage--interactive-features)
5. [Slash Commands Reference](#slash-commands-reference)
6. [Interactive File Browser (Ctrl+F)](#interactive-file-browser-ctrlf)
7. [Shell Execution Mode (!)](#shell-execution-mode-)
8. [Testing & Development](#testing--development)
9. [License](#license)

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

### Option B: Environment Variables
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

### 3. DeepSeek API
Highly cost-efficient and performant code generation and reasoning models.
- **Required Env Var**: `DEEPSEEK_API_KEY`
- **Supported Models**:
  - `deepseek-chat` (DeepSeek-V3)
  - `deepseek-reasoner` (DeepSeek-R1)

### 4. GitHub Models
Access hosted developer models via your GitHub Personal Access Token (PAT).
- **Required Env Var**: `GITHUB_MODELS_API_KEY` (or custom PAT)
- **Supported Models**:
  - `gpt-4o`
  - `gpt-4o-mini`
  - `o1-mini`
  - `meta-llama-3-70b`
  - `cohere-command-r-plus`

### 5. OpenRouter
A unified router to query open-weight model architectures (Llama 3, Qwen, Claude, Mistral).
- **Required Env Var**: `OPENROUTER_API_KEY`
- **Supported Models**:
  - `anthropic/claude-3.5-sonnet`
  - `meta-llama/llama-3.1-405b-instruct`
  - `qwen/qwen-2.5-coder-32b-instruct`
  - `google/gemini-2.5-pro`

### 6. GroqCloud
High-speed execution of open-weight developer models.
- **Required Env Var**: `GROQ_API_KEY`
- **Supported Models**:
  - `llama-3.3-70b-versatile`
  - `mixtral-8x7b-instruct-32768`
  - `gemma2-9b-it`

---

### 7. OpenCode (Free)
OpenCode provides free, open-source models for coding and tooling tasks.
- **Required Env Var**: none (no API key needed)
- **Supported Models**:
  - `big-pickle`
  - `deepseek-v4-flash-free`
  - `mimo-v2-5-free`
  - `nemotron-3-ultra-free`
  - `north-mini-code-free`

---
## Pricing, Limits & Quotas

### 8. Z.ai (GLM)
Z.ai provides large language models for coding and general tasks.
- **Required Env Var**: `ZAI_API_KEY`
- **Supported Models**:
  - `GLM-4.7-Flash`
  - `GLM-5.2`

Below is a quick reference matrix for the integrated model providers, covering typical token pricing (USD per 1 M tokens), context window limits, maximum output lengths, and approximate rate limits (requests per minute). Prices and limits are subject to change; always verify on the provider’s official pricing page.
| Provider | Model | Input Price (USD/1M) | Output Price (USD/1M) | Context Window | Max Output | Approx. RPM* |
|---|---|---|---|---|---|---|
| OpenCode (Free) | big-pickle | $0.00 | $0.00 | 200,000 | 65,536 | Unlimited |
| OpenCode (Free) | deepseek-v4-flash-free | $0.00 | $0.00 | 200,000 | 65,536 | Unlimited |
| OpenCode (Free) | mimo-v2-5-free | $0.00 | $0.00 | 200,000 | 65,536 | Unlimited |
| OpenCode (Free) | nemotron-3-ultra-free | $0.00 | $0.00 | 200,000 | 65,536 | Unlimited |
| OpenCode (Free) | north-mini-code-free | $0.00 | $0.00 | 200,000 | 65,536 | Unlimited |
| Claude (Fable) | Claude Fable 5 | $10.00 | $50.00 | 1,000,000 | 128,000 | Varied |
| Claude (Haiku) | Claude Haiku 3.5 | $0.80 | $4.00 | 200,000 | 64,000 | Varied |
| Claude (Haiku) | Claude Haiku 4.5 | $1.00 | $5.00 | 200,000 | 64,000 | Varied |
| Claude (Sonnet) | Claude Sonnet 4.6 | $3.00 | $15.00 | 1,000,000 | 64,000 | Varied |
| Z.ai (GLM) | GLM-4.7-Flash | $0.00 | $0.00 | 1,000,000 | 65,536 | Unlimited |
| Z.ai (GLM) | GLM-5.2 | $1.40 | $4.40 | 1,000,000 | 131,072 | Varied |
| Google AI Studio (Gemini) | Gemini 2.5 Flash | $0.30 | $2.50 | 1,048,576 | 65,536 | 5‑15 (Free), 150‑300 (Tier 1) |
| Google AI Studio (Gemini) | Gemini 3.1 Pro | $2.00 | $12.00 | 1,048,576 | 65,536 | 5‑15 (Free), 150‑300 (Tier 1) |
| OpenAI | gpt‑4o | $2.50 | $10.00 | 128,000† | 128,000† | 3,000 (standard) |
| OpenAI | gpt‑4o‑mini | $0.15 | $0.60 | 128,000† | 128,000† | 3,000 (standard) |
| DeepSeek API | DeepSeek V4 Pro | $1.74 (cache miss) / $0.145 (cache hit) | $3.48 | 1,048,576 | 384,000 | 60‑120 (typical) |
| DeepSeek API | DeepSeek V4 Flash | $0.44 | $0.88 | 1,048,576 | 384,000 | 60‑120 |
| OpenRouter | Various (e.g., Claude‑3.5‑Sonnet, Llama‑3.1‑405B) | Varies* | Varies* | Varies | Varies | Varies |
| GroqCloud | llama‑3.3‑70b‑versatile, mixtral‑8x7b‑instruct‑32768, gemma2‑9b‑it | $0.00‑$0.10* | $0.00‑$0.10* | Up to 128k | Up to 128k | 10,000+ (high‑speed) |
| GitHub Models | gpt‑4o, gpt‑4o‑mini, o1‑mini, meta‑llama‑3‑70b, cohere‑command‑r‑plus | Same as OpenAI | Same as OpenAI | Same as OpenAI | Same as OpenAI | Same as OpenAI |

*RPM values are indicative and depend on your billing tier and project configuration.
†Context limits for OpenAI models are based on the latest OpenAI documentation (≈128 k tokens).

**Sources**: Gemini pricing [1][2], Gemini context [9][10]; OpenAI pricing [12][13]; DeepSeek pricing [5][6]; DeepSeek context [13]; Gemini rate limits [11]; OpenAI rate limits [13]; provider docs.

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

- `/model <model-name>`: Switch the current model (e.g. `/model gpt-4o`).
- `/review <file1> [file2]`: Submits one or more files for code review.
- `/suggest <task>`: Generates a code suggestion based on a task description.
- `/compress`: Forces context compression of the oldest conversation history.
- `/clear`: Wipes message history (retaining system prompt).
- `/sessions`: Lists all saved sessions.
- `/save`: Saves the current session status.
- `/skills <subcommand>`: Manages skill scripts:
  - `/skills list`: Lists available remote skills.
  - `/skills search <query>`: Searches the remote registry.
  - `/skills install <name> [--global]`: Installs a skill global or locally.
  - `/skills list-local`: Lists all installed local and global skills.
- `/theme [theme-name]`: Lists available themes or switches visual configurations.
- `/status`: Renders token usage, active session age, and modified files.
- `/copy`: Copies last response.
- `/paste`: Submits clipboard text.
- `/cancel`: Discards multi-line buffer.
- `/exit`: Saves changes and exits.

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

## Testing & Development

Qode uses Jest for unit testing. To run the test suite (19 test suites, 96 unit tests covering all features):
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
