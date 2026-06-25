---
name: terminal
version: 0.1.0
description: "Control local and pseudo-terminals: run commands, inspect shell history, create terminals, keep pty sessions alive."
---

Use this when the user asks to run a terminal, inspect terminal history, or manage a terminal session for logs. Maps from the registered terminal tools. Preferred sources of truth:
- local registered tools: terminal_exec_command, terminal_shell_history_list, terminal_create_terminal, terminal_ensure_pty_ready
Every terminal_run request must map directly to one of those tools.
