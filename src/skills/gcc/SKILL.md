---
name: gcc
description: "GNU compiler collection workflows for C and C++."
tags: [gcc, g++, c, c++, compile]
---

Use GCC when the user asks to compile C or C++ code with gcc or g++.
Preferred tool:
- compile_one with compiler='gcc' or 'g++'
For direct compilation examples: gcc -o <output> <file> or g++ -o <output> <file>.
Mention common diagnostic flags only when asked or when errors suggest it: -Wall -Wextra -pedantic.
Always report the exact command used and any warnings or errors.
Note when gcc or g++ is not installed if the command fails.
