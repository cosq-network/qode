---
name: node
description: "Node.js runtime and script execution workflows."
tags: [node, javascript, typescript, runtime]
---

Use Node.js when the user asks to run JS/TS files, check runtime environment, or execute one-off scripts.
Preferred tools:
- node_run_file(filePath, args?, useTsx?)
- node_get_info()
Prefer node_run_file for user scripts, demo files, and quick executions.
For TypeScript execution, rely on npx tsx transparently via node_run_file unless the user requests a different runner.
Always report stdout, stderr, exit status, and Node version/toolchain details when diagnosing runtime issues.
