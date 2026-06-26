---
name: echo
description: "Echo-style shell environment updates for bash and zsh startup files."
tags: [echo, env, environment, path, bash, zsh, shell]
---

Use this when the user asks to persistently modify environment variables or PATH entries for bash or zsh.

Preferred tool:
- echo_update_shell_env(action, shells?, variable?, value?, pathEntry?, mode?)

Use `action: "set_env"` with `variable` and `value` to write an exported environment variable.
Use `action: "add_path"` with `pathEntry` to add a directory to PATH; prefer `mode: "prepend"` unless the user asks to append.
Target both bash and zsh unless the user names one shell.
Tell the user that changes apply to new terminal sessions, or after sourcing `.bashrc` or `.zshrc`.
Do not use raw shell redirection for persistent environment changes when this tool can perform the managed update.
