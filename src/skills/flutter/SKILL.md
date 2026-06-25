---
name: flutter
description: "Flutter/Dart project workflows: build, test, pub get, doctor, and clean."
tags: [flutter, dart, mobile, web, build, test]
---

Use Flutter when the user asks to build, test, fetch dependencies, diagnose environment, or clean a Flutter/Dart project.
Preferred tools:
- flutter_command(action='build'|'test'|'pub_get'|'doctor'|'clean', buildTarget?, extraArgs?)
For build, require buildTarget and show the selected device/platform if Flutter reports it.
For doctor, show the key health checks and any issues found.
For pub get, mention added/updated packages and conflicts when visible.
Report build errors, test failures, and platform/toolchain issues clearly.
