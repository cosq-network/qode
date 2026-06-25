---
name: pip
description: "Pip package installation, inspection, and environment management workflows."
tags: [pip, python, packages, dependencies]
---

Use pip when the user asks to install packages, inspect installed packages, or manage Python dependencies.
Preferred tools:
- pip_show_package(packageName, venvPath?)
Prefer editable installs only when the user explicitly asks for development mode.
For requirements files, prefer python_install_requirements with the target venv when available.
Report exact pip command, installed versions, conflicts, and environment paths.
Note if pip / python / python3 is missing rather than retrying blindly.
