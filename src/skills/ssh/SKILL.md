---
name: ssh
description: "Remote host workflows using SSH, SCP, SFTP, and multiplexer sessions (tmux/screen/byobu/zellij)."
tags: [ssh, scp, sftp, remote, tmux, screen]
---

Use SSH when the user asks to connect to a remote host, copy files securely, manage SFTP bundles, or reuse persistent sessions with a terminal multiplexer.
Preferred tools:
- ssh_command(destination, command?, pty?, extraArgs?, timeoutMs?)
- scp_command(source, destination, recursive?, extraArgs?)
- sftp_command(action='get'|'put'|'list'|'delete', source, destination?, extraArgs?)
- terminal_session(action='create'|'attach'|'list'|'destroy', multiplexer?, sessionName?)
- ssh_shell(host, user?, port?, identityFile?)
For reuse, prefer multiplexers and named sessions over ad-hoc commands.
Report only sanitized connection summaries and errors; never show raw credentials, identity files, or secrets.
