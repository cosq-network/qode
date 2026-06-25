---
name: java
version: 0.1.0
description: "Compile and run Java programs; build and test Maven and Gradle projects."
---

Use this when the user asks to compile, run, build, or test Java code. Maps from the registered Java tools. Preferred sources of truth:
- local registered tools: java_compile_and_run, java_project_build
Every java_run request must map directly to one of those tools.
