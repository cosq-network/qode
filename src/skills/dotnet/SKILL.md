---
name: dotnet
description: ".NET project build, test, run, clean, restore, and publish workflows."
tags: [dotnet, csharp, fsharp, vb, build, test]
---

Use dotnet when the user asks to build, test, run, clean, restore, or publish a .NET project or solution.
Preferred tools:
- dotnet_command(action='build'|'run'|'test'|'clean'|'restore'|'publish', projectPath?, configuration?, extraArgs?)
Prefer projectPath as a .csproj/.sln when available; otherwise dotnet will infer the project in the current directory.
For run actions, mention the selected framework and runtime if the output includes it.
For test actions, summarize passed/failed/total when readable.
Report restore/build failures, test failures, and publish artifacts with paths when available.
