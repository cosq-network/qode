# GCC skill

## What it does
The GCC skill is for compiling C and C++ source files with GCC-style compiler workflows.

## Tools
It is supported through native-build tooling for single-file compilation flows.

## Parameters
Typical inputs include:
- source file,
- compiler selection or preset,
- optional compiler args,
- optional output file.

## How to use
Use it when you need direct `gcc` or `g++` compilation or compiler diagnostics.

## Example usage
Compile a C++ program:
```text
Compile main.cpp with g++ and produce ./bin/app.
```

Run with warnings:
```text
Compile main.c with gcc using -Wall -Wextra and show warnings.
```
