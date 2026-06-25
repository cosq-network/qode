---
name: make
description: "Make-based build workflows and project build helpers."
tags: [make, makefile, build, c, c++]
---

Use Make when the user asks to build a Makefile project or needs standard make workflows.
Preferred tool:
- make_run(target?, jobs?, makefile?, variables?)
If requested, show how to target common goals such as all, clean, test, install, or dist.
Use -j for parallel jobs only when the user asks for faster builds or when safe.
Always show the exact make command, summarize stdout/stderr, and stop if there is a build error.
Note if make is not installed.
