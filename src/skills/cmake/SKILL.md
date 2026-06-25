---
name: cmake
description: "CMake configure, build, test, and clean workflows."
tags: [cmake, build, test, c, c++]
---

Use CMake when the user asks to configure, build, test, or clean a C/C++ project.
Preferred tools:
- cmake_configure(sourceDir?, buildDir?, buildType?, generator?, cmakeArgs?)
- cmake_build(buildDir?, target?, config?, verbose?)
- cmake_run_tests(buildDir?)
- cmake_clean(buildDir?)
If the user has a CMakeLists.txt, keep build artifacts isolated in a build directory by default.
Show the exact cmake command lines, include output on errors, and summarize configure/build/test results.
If cmake is not installed, say so explicitly.
