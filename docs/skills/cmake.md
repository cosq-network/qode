# CMake skill

## What it does
The cmake skill configures and drives CMake-based C/C++ builds.

## Tools
It maps to native-build tools such as `cmake_configure`, `cmake_build`, `cmake_run_tests`, and `cmake_clean`.

## How to use
Use it when you need to:
- configure a build directory,
- run CMake with a specific generator or cached options,
- build a target or configuration,
- run CTest and report failures.

**Examples**

- Configure this cmake project for a Release build.
- Build the tests target in an existing build directory.
