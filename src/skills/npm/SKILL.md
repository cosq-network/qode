---
name: npm
description: "NPM workflow helpers for install, scripts, audits, and dependency checks."
tags: [npm, node, javascript, typescript, dependencies]
---

Use NPM when the user asks to manage dependencies, run scripts, or audit an npm project.
Preferred tools:
- npm_run_script(scriptName)
- npm_list_dependencies()
- npm_check_outdated()
- npm_audit(fix?)
Use npm ci for clean installs when package-lock.json exists and reproducibility matters.
For monorepos or workspaces, mention npm workspaces behavior and common flags when relevant.
Report install failures, script exit codes, outdated packages, and audit findings clearly.
