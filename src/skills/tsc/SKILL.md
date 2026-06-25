---
name: tsc
description: "TypeScript project check, compile, and watch workflows."
tags: [typescript, tsc, compile, check]
---

Use TypeScript tooling when the user asks to type-check, compile, or watch a TS/TSX project.
Preferred tools:
- tsc_command(action='check'|'compile'|'watch', project?)
For simple checks, use tsc_command(action='check', project='tsconfig.json') or the nearest tsconfig.
For full compilation, use tsc_command(action='compile').
Use watch only when explicitly requested.
Summarize emitted JS files, type errors, and diagnostics; do not silently ignore compiler warnings.
