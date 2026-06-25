---
name: python3
description: "Python runtime, virtual environment, and script execution workflows."
tags: [python, python3, venv, py]
---

Use Python when the user asks to run scripts, inspect environment, or manage a Python virtual environment.
Preferred tools:
- python_create_venv(venvPath?)
- python_install_requirements(requirementsFile?, packages?, venvPath?)
- python_run_file(filePath, args?, venvPath?)
Prefer python3 first; fall back to python only if python3 is unavailable or explicitly requested.
For scripts, show the exact command, interpreter path, and whether a venv is active.
When an import error occurs, suggest requirements installation or venv activation if applicable.
