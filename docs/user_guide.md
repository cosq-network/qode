# Qode User Guide

Welcome to **Qode** (formerly cosqode/cosqcode) — a professional, lightweight, and multi-provider AI coding assistant CLI. Qode is designed for terminal-based developer pair-programming, equipped with native file operations, context compression, dynamic theme switching, local skill modules, remote registry lookup, inline shell command execution, and an interactive prompt file browser.

---

## Table of Contents
1. [Installation & Setup](#1-installation--setup)
2. [Interface & Visual Theme System](#2-interface--visual-theme-system)
3. [Standard Slash Commands](#3-standard-slash-commands)
4. [Prompt Input Features](#4-prompt-input-features)
5. [Shell Execution Mode (`!`)](#5-shell-execution-mode-)
6. [Interactive File System Browser (`Ctrl+F`)](#6-interactive-file-system-browser-ctrlf)
7. [Skills & Remote Registry Caching](#7-skills--remote-registry-caching)
8. [Configuration & Storage Directory Map](#8-configuration--storage-directory-map)
9. [Authentication](#9-authentication)
10. [Provider Reference](#10-provider-reference)
11. [Project Environment Files](#11-project-environment-files)

---

## 1. Installation & Setup

### Prerequisites
- Node.js (version 18 or higher)

### Installing from GitHub Packages
Install `qode` directly from the published GitHub Package:
```bash
npm install @cosq-network/qode@1.2.1 --registry=https://npm.pkg.github.com
```

- Repository: https://github.com/cosq-network/qode
- Package: https://github.com/cosq-network/qode/pkgs/npm/qode

If the package is private, authenticate first with a GitHub token that has `read:packages` scope:
```bash
npm config set //npm.pkg.github.com/:_authToken=<SECRET_03f4a7ff>
```

Run a locally installed package with:
```bash
npx qode
```

### Storing API Credentials
To set up API keys for your preferred LLM provider, launch the authenticating prompt:
```bash
qode auth
```
This interactive screen lets you save API keys for:
- Google AI Studio (Gemini)
- OpenAI
- Anthropic
- GitHub Models
- DeepSeek API
- OpenRouter
- GroqCloud
- OpenCode Zen
- GitHub Copilot

---

## 2. Interface & Visual Theme System

Each prompt iteration renders a neat visual dashboard header summarizing session states, model parameters, and context usages.

### Theme Switching (`/theme`)
Qode supports several custom color themes for terminal readability. Change your theme on-the-fly:
```text
/theme ocean
```
Available themes:
- `default`
- `ocean`
- `monochrome`
- `sunset`
- `forest`
- `catppuccin-mocha`
- `nord`

### Legacy Terminal Compatibility
Qode checks your terminal's capabilities dynamically. Standard emojis are used on modern systems (macOS Terminal, Linux Terminals, Windows Terminal). In legacy Windows consoles (e.g., cmd.exe), Qode automatically falls back to clean ASCII text headers (like `[DIR]`, `[AI]`, `[TIME]`), keeping interface lines straight and unpolluted.

---

## 3. Standard Slash Commands

Enter slash commands directly into the prompt to manage your sessions, settings, and workspace inputs:

| Command | Usage | Description |
| :--- | :--- | :--- |
| `/help` | `/help` | Lists all supported commands and describes their options. |
| `/model` | `/model <model-name>` | Switch current model in the middle of a chat turn. |
| `/models` | `/models` | List available providers and models. |
| `/review` | `/review <file1> [file2 ...]` | Load file contents and request a detailed AI code review. |
| `/suggest` | `/suggest <description>` | Request code implementation templates or templates. |
| `/search` | `/search [--rebuild] <query>` | Semantic search across codebase. |
| `/compress` | `/compress` | Manually compress oldest message history. |
| `/clear` | `/clear` | Wipes the current message history but retains system prompts. |
| `/sessions` | `/sessions` | Lists all saved sessions, including dates and counts. |
| `/save` | `/save` | Manually saves current session state. |
| `/skills` | `/skills <subcommand>` | View, search, and install local/global skill extensions. |
| `/theme` | `/theme [theme-name]` | Swaps or lists current color palette configurations. |
| `/status` | `/status` | Renders the detailed token statistics and modified files panel. |
| `/copy` | `/copy` | Copies the last assistant response to your clipboard. |
| `/paste` | `/paste` | Pastes clipboard content directly as your prompt. |
| `/cancel` | `/cancel` | Cancels current multiline input accumulation. |
| `/exit` | `/exit` | Saves the session and cleanly exits the CLI app. |

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

### Auth & Config

```text
/auth status                 Show BYOK auth status
/auth list                   List supported providers
/auth set <provider>         Store an API key securely
/auth clear <provider>       Remove stored credentials
/download-status             Check background model download progress
/update-models               Fetch latest model lists from provider APIs
```

---

## 4. Prompt Input Features

### Multiline Prompts (`\`)
For multi-line queries (like pasting long blocks of code or complex tasks), add a trailing backslash `\` at the end of your line and press `Enter`:
```text
Please refactor the following function: \
  function add(a, b) { \
    return a + b; \
  }
```
Use the `/cancel` command on a new line if you wish to discard the multi-line buffer and start over.

### Clipboard Integration Hotkeys
Instead of typing, you can leverage native hotkeys bound to your host clipboard:
- **`Ctrl+K`**: Instantly copies the last response generated by the AI assistant to the system clipboard.
- **`Ctrl+G`**: Instantly reads your system clipboard and triggers a query with the clipboard contents as your prompt.

### Path Suggestions with `@` Prefix

You can reference files or directories directly in your prompt by typing `@` followed by the beginning of the path. The autocomplete will suggest matching entries from the current working directory.

**Examples**

- `@src/ut` → suggests `src/utils/`
- `@README` → suggests `README.md`
- `@docs/` → suggests files inside the `docs/` folder.

Press **Tab** or **Enter** to accept the suggestion, which inserts the full relative path at the cursor.

### File Read Shortcut (`@read`)

Use `@read <file_path>` in the prompt to immediately read a file from disk and show its contents in the chat output:

```text
@read src/chat/loop.ts
```

This works alongside other prompt features like multiline input and clipboard shortcuts, and complements path autocomplete.

---

## 4.1 Path Suggestions with `@` Prefix

You can reference files or directories directly in your prompt by typing `@` followed by the beginning of the path. The autocomplete will suggest matching entries from the current working directory.

**Examples**

- `@src/ut` → suggests `src/utils/`
- `@README` → suggests `README.md`
- `@docs/` → suggests files inside the `docs/` folder.

Press **Tab** or **Enter** to accept the suggestion, which inserts the full relative path at the cursor.

This works alongside other prompt features like multiline input and clipboard shortcuts.

---

## 5. Shell Execution Mode (`!`)

You can run commands directly in your host OS shell without exiting the REPL interface by prefixing your input prompt with an exclamation mark `!`.

### Running Commands
```text
!ls -la
!npm run build
!git diff
```
The standard output (`stdout`) and error streams (`stderr`) are piped directly to your terminal. Control returns instantly to the next REPL prompt loop without executing any LLM inference calls.

### Working Directory Navigation (`!cd`)
Typing `!cd` is handled natively by the parent process. It changes the current directory of the CLI:
```text
!cd src/chat
!!cd ~/Projects/my-app
```
Subsequent tool calls, file reviews, status indicators, and subsequent `!` command executions reflect this directory change.

### Destructive Command Safety Filter
To prevent catastrophic accidental commands inside the prompt loop, Qode implements a regex command validator. If you enter dangerous commands like:
- `rm -rf /` or `rm -rf *`
- `dd if=`
- `mkfs`
- `chmod -R 777`
Qode blocks the command from executing and outputs a security warning.

---

## 6. Interactive File System Browser (`Ctrl+F`)

Qode lets you browse your local workspace filesystem interactively and insert relative file or folder references at your cursor without manually typing long paths.

### Launching the Browser
While typing in your prompt, press **`Ctrl+F`** to open the terminal-based File Browser. Readline input pauses, and the browser draws a live file selector below your input cursor.

### Browser Navigation Mappings
- **`Up Arrow` / `Down Arrow`**: Scroll selection highlighting through files and folders.
- **`Right Arrow` / `Enter` (on Folder)**: Navigate into the selected directory.
- **`Left Arrow` / `Backspace` (or selecting `..`)**: Navigate up to the parent directory.
- **`Space` or `Tab`**: Select the hovered item (file or directory), exit browser mode, and insert its relative path at the prompt cursor.
- **`Enter` (on File)**: Select the file, exit browser mode, and insert its relative path.
- **`Escape` (or `Ctrl+C`)**: Close the browser immediately without modifying your prompt.

### Viewport Scrolling
If a directory contains a large number of files (e.g. 50 files), Qode limits the visible browser frame to **10 items** with a paginated slider description (e.g., `... (showing 1-10 of 42) ...`). This ensures that navigating large project structures doesn't pollute your command history.

---

## 7. Skills & Remote Registry Caching

Skills are modular prompt segments containing guidelines, instructions, or rules that help steer model outputs during reviews or generation tasks.

### Listing & Installing Skills
- `/skills list-local`: Lists all installed global and workspace-scoped skills.
- `/skills list`: Lists available remote packages on the registry.
- `/skills search <query>`: Queries remote packages.
- `/skills install <name> [--global]`: Downloads and installs a skill from the registry.

### Offline Registry Cache Fallback
To ensure complete resilience against network losses, Qode caches registry data locally inside your home configuration folder (`~/.qode/registry-cache.json`).
- If you run `/skills list` or `/skills search` offline, Qode handles fetch exceptions gracefully, loads the cached JSON metadata registry, and displays a warning status (`ℹ Offline mode: using cached skill registry`).

---

## 8. Configuration & Storage Directory Map

All personal configurations, cache stores, and session states are housed locally under your OS home directory:

```text
~/.qode/
├── config.json            # Custom themes, default models, and provider API keys
├── registry-cache.json    # Local copy of the remote skills registry metadata
├── sessions/              # JSON logs of your saved chat history
│   ├── <session-uuid>.json
│   └── ...
└── skills/                # Global custom skills metadata
    ├── python-pep8/
    │   └── SKILL.md
    └── ...
```

Within a specific coding repository, local skills can also be registered inside the workspace:
```text
<your-workspace-dir>/
└── .agents/
    └── skills/            # Project-specific custom skills metadata
        ├── react-testing/
        │   └── SKILL.md
        └── ...
```
These local skills automatically override global custom skills if they share matching filenames.

---

## 9. Authentication

Qode is BYOK-only for API-key providers. Credentials are set up with `/auth set <provider>` inside Qode or `qode auth` from the shell, with keys stored encrypted at `~/.qode/auth.json`. Use `/auth clear <provider>` or `qode auth --reset` to remove stored keys.

GitHub Copilot is an exception: configure it with `qode auth --device github-copilot`. No subscription sign-in is available through chat commands.

Other supported providers can be used with direct environment variables or `.env.qode` files. Full auth guidance is in [`docs/auth.md`](docs/auth.md).

---

## 10. Provider Reference

Detailed provider notes are in `docs/providers/`:
- [Authentication and provider overview](docs/auth.md)
- [Google AI Studio](docs/providers/google-ai-studio.md)
- [OpenAI](docs/providers/openai.md)
- [Anthropic](docs/providers/anthropic.md)
- [GitHub Models](docs/providers/github-models.md)
- [GitHub Copilot](docs/providers/github-copilot.md)
- [DeepSeek API](docs/providers/deepseek-api.md)
- [OpenRouter](docs/providers/openrouter.md)
- [GroqCloud](docs/providers/groqcloud.md)
- [OpenCode Zen](docs/providers/opencode-zen.md)
- [Z.ai](docs/providers/z-ai.md)
- [Local model](docs/providers/local-model.md)

---

## 11. Project Environment Files

Qode can load environment variables from a project-level `.env.qode` file.

### Overview

- Qode looks for `.env.qode` in the current directory and its parent directories.
- It loads the first `.env.qode` it finds, starting from the working directory.
- It also loads `~/.qode.env` if no `.env.qode` was found.
- Existing environment variables are preserved.
- Qode will not overwrite an environment variable that is already set.

### Example `.env.qode`

```text
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
DEEPSEEK_API_KEY=sk-...
OPENROUTER_API_KEY=sk-or-...
GROQ_API_KEY=...
OPENCODE_ZEN_API_KEY=...
```

### Example `~/.qode.env`

```text
OPENAI_API_KEY=sk-...
```

### Search behavior

1. Start from the current working directory.
2. Walk up parent directories looking for `.env.qode`.
3. Stop at the first match and load it.
4. If no `.env.qode` is found, load `~/.qode.env`.
5. If both are missing, Qode continues with existing environment variables.

### Notes

- This feature is intended for project-specific configuration and secrets.
- Do not commit `.env.qode` to version control.
- Prefer `qode auth` for interactive credential management.
- Environment variables take precedence over `.env.qode` values if already present.
