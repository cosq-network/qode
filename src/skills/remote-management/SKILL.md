---
name: remote-management
version: 0.1.0
description: "Run remote commands over SSH, manage SFTP actions, manage SSH known_hosts, multiplex screen attachments, and query conninfo."
---

Use this when the user asks to SSH, transfer files, inspect known hosts, attach screens, or query connection data. Maps from the registered remote/ssh tools. Preferred sources of truth:
- local registered tools: ssh_command, scp_command, sftp_command, ssh_known_hosts, ssh_pubkey_scan, ssh_mux_client_control, ssh_connection_close_all, ssh_connection_conninfo_summary, screen_attach, terminal_session, terminal_command_queue, sftp_full_directory_listing
Every remote-pilot Run request must map directly to one of those tools. Agent rules: summarize oddness, de-PII metadata, flag secrets inside artifacts, and reject destructive writes unless the user upgrades intent.
