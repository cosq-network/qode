---
name: clang
description: "Clang compiler, static analysis, and formatting commands."
tags: [clang, clang-format, clang-tidy, c, c++]
---

Use the installed clang tools when the user wants to compile, format, analyze, or lint C/C++ code.
Preferred tools:
- compile_one with compiler='clang' or 'clang++'
- tool: 'lint_file' with commands including 'clang-tidy'
- tool: 'format_file' with commands including 'clang-format -i' or 'clang-format --style=<style>'
For direct compilation: clang -o <output> <file> or clang++ -o <output> <file>.
Always report the exact command used and any compiler warnings or errors.
Note when clang is not installed if the requested command fails.
