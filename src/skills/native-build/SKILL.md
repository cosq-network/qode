---
name: native-build
description: "C/C++ project build workflows using cmake, make, gcc, g++, clang, clang++, and ctest."
tags: [cmake, make, gcc, clang, c, c++, build]
---

Use the installed native build tools when the user asks to configure, build, test, clean, or compile C/C++ code:
- cmake_configure(sourceDir?, buildDir?, buildType?, generator?, cmakeArgs?)
- cmake_build(buildDir?, target?, config?, verbose?)
- cmake_run_tests(buildDir?)
- cmake_clean(buildDir?)
- make_run(target?, jobs?, makefile?, variables?)
- compile_one(compiler, sourceFile?, output?, args?)

Prefer cmake_* for CMake projects, make_run for Makefile projects, and compile_one for single-file compilation.
Show the exact commands executed and summarize build output, test results, and errors.
Mention if tools are missing (cmake, make, gcc, g++, clang, clang++, ctest) when relevant.
