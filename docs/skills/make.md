# Make skill

## What it does
The make skill supports Makefile-based builds and standard `make` workflows.

## Tools
Key tool:
- `make_run`

## Parameters
Typical inputs include:
- optional `target`,
- optional `jobs`,
- optional `makefile`,
- optional `variables`.

## How to use
Use it when you want Qode to run `make` goals such as `all`, `clean`, `test`, `install`, or `dist`.

Example prompt:
`Run make clean, then build using 4 parallel jobs.`
