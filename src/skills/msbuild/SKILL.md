---
name: msbuild
description: "MSBuild workflows for .NET and NuGet-based builds."
tags: [msbuild, dotnet, build, solution, project]
---

Use MSBuild tooling when the user asks to build or run MSBuild against a .NET project/solution.
Preferred sources of truth:
- local registered tools: msbuild_run
Every MSBuild action must map directly to one of those tools or another validated MSBuild workflow.
