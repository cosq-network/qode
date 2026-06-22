import fs from 'fs-extra';
import path from 'path';
import { exec, execFile } from 'child_process';
import { runCmake, runCtest, runExecutable, getVenvBinary, getCwd, MAX_BUFFER } from '../helpers.js';
import { globalRegistry } from '../registry.js';
import type { RegisteredTool } from '../registry.js';

// ---------------------------------------------------------------------------
// Code Quality Tools
// ---------------------------------------------------------------------------

const runLinter: RegisteredTool = {
  definition: {
    type: 'function' as const,
    function: {
      name: 'run_linter',
      description: 'Run a linter on a file/directory. Example linter commands: "eslint --format=compact", "pylint --output-format=text", "clang-tidy".',
      parameters: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: 'File or directory to lint' },
          linter: { type: 'string', description: 'Linter command with flags' },
          cwd: { type: 'string', description: 'Working directory (optional)' },
        },
        required: ['filePath', 'linter'],
      },
    },
  },
  metadata: { category: 'build', permissionKey: 'bash' },
  execute: async (args) => {
    const { filePath, linter, cwd: wd } = args;
    if (!filePath || !linter) return { output: '', error: 'filePath and linter required.' };
    const cmd = `${linter} ${filePath}`;
    const output = await new Promise<string>((resolve) => {
      exec(cmd, { cwd: (wd as string) || getCwd(), maxBuffer: MAX_BUFFER }, (err, stdout, stderr) => {
        if (err) resolve(`Linter error:\n${stderr || err.message}`);
        else resolve(stdout || stderr || 'Linter completed with no output.');
      });
    });
    if (output.startsWith('Linter error:')) return { output: '', error: output.slice(14) };
    return { output };
  },
};

const runTests: RegisteredTool = {
  definition: {
    type: 'function' as const,
    function: {
      name: 'run_tests',
      description: 'Run project tests with a command like "npm test", "pytest", "dotnet test".',
      parameters: {
        type: 'object',
        properties: {
          testCommand: { type: 'string', description: 'Full test command' },
          cwd: { type: 'string', description: 'Working directory (optional)' },
        },
        required: ['testCommand'],
      },
    },
  },
  metadata: { category: 'build', permissionKey: 'bash' },
  execute: async (args) => {
    const { testCommand, cwd: wd } = args;
    if (!testCommand) return { output: '', error: 'testCommand required.' };
    const output = await new Promise<string>((resolve) => {
      exec(testCommand as string, { cwd: (wd as string) || getCwd(), maxBuffer: MAX_BUFFER }, (err, stdout, stderr) => {
        if (err) resolve(`Tests failed:\nSTDOUT:\n${stdout}\nSTDERR:\n${stderr}`);
        else resolve(stdout || 'All tests passed.');
      });
    });
    if (output.startsWith('Tests failed:')) return { output: '', error: output };
    return { output };
  },
};

const codeReview: RegisteredTool = {
  definition: {
    type: 'function' as const,
    function: {
      name: 'code_review',
      description: 'Perform a code review on provided code. The assistant will analyse and produce a structured review.',
      parameters: {
        type: 'object',
        properties: {
          code: { type: 'string', description: 'Full source code' },
          language: { type: 'string', description: 'Programming language' },
          reviewFocus: { type: 'string', description: 'Optional focus (security, performance, etc.)' },
        },
        required: ['code', 'language'],
      },
    },
  },
  metadata: { category: 'build', permissionKey: 'read' },
  execute: async () => {
    return { output: 'Code review requested. The assistant will now perform the review.' };
  },
};

const runFormatter: RegisteredTool = {
  definition: {
    type: 'function' as const,
    function: {
      name: 'run_formatter',
      description: 'Run a code formatter on a file (e.g., "prettier --write", "black", "clang-format -i").',
      parameters: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: 'File to format' },
          formatter: { type: 'string', description: 'Formatter command with flags' },
          cwd: { type: 'string', description: 'Working directory (optional)' },
        },
        required: ['filePath', 'formatter'],
      },
    },
  },
  metadata: { category: 'build', permissionKey: 'bash' },
  execute: async (args) => {
    const { filePath, formatter, cwd: wd } = args;
    if (!filePath || !formatter) return { output: '', error: 'filePath and formatter required.' };
    const cmd = `${formatter} ${filePath}`;
    const output = await new Promise<string>((resolve) => {
      exec(cmd, { cwd: (wd as string) || getCwd(), maxBuffer: MAX_BUFFER }, (err, stdout, stderr) => {
        if (err) resolve(`Formatter error:\n${stderr || err.message}`);
        else resolve(stdout || 'File formatted successfully.');
      });
    });
    if (output.startsWith('Formatter error:')) return { output: '', error: output.slice(16) };
    return { output };
  },
};

const installPackage: RegisteredTool = {
  definition: {
    type: 'function' as const,
    function: {
      name: 'install_package',
      description: 'Install one or more packages using a package manager (npm, pip, nuget, etc.).',
      parameters: {
        type: 'object',
        properties: {
          manager: { type: 'string', description: 'Package manager command, e.g. "npm", "pip"' },
          packages: {
            oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }],
            description: 'Package name(s)',
          },
          cwd: { type: 'string', description: 'Working directory (optional)' },
        },
        required: ['manager', 'packages'],
      },
    },
  },
  metadata: { category: 'build', permissionKey: 'bash' },
  execute: async (args) => {
    const { manager, packages, cwd: wd } = args;
    if (!manager || !packages) return { output: '', error: 'manager and packages required.' };
    const pkgList = Array.isArray(packages) ? packages.join(' ') : packages;
    const cmd = `${manager} install ${pkgList}`;
    const output = await new Promise<string>((resolve) => {
      exec(cmd, { cwd: (wd as string) || getCwd(), maxBuffer: MAX_BUFFER }, (err, stdout, stderr) => {
        if (err) resolve(`Installation failed:\n${stderr || err.message}`);
        else resolve(stdout || 'Package(s) installed.');
      });
    });
    if (output.startsWith('Installation failed:')) return { output: '', error: output };
    return { output };
  },
};

// ---------------------------------------------------------------------------
// Node.js Tools
// ---------------------------------------------------------------------------

const npmListDependencies: RegisteredTool = {
  definition: {
    type: 'function' as const,
    function: {
      name: 'npm_list_dependencies',
      description: 'Retrieve a list of the dependencies and devDependencies currently installed in the workspace.',
      parameters: {
        type: 'object',
        properties: {
          cwd: { type: 'string', description: 'Working directory (optional)' },
        },
      },
    },
  },
  metadata: { category: 'build', permissionKey: 'bash' },
  execute: async (args) => {
    const { runNpm } = await import('../helpers.js');
    const result = await runNpm(['list', '--depth=0'], args.cwd as string | undefined);
    return { output: result };
  },
};

const npmAudit: RegisteredTool = {
  definition: {
    type: 'function' as const,
    function: {
      name: 'npm_audit',
      description: 'Run security vulnerability audits on the installed dependencies (runs npm audit).',
      parameters: {
        type: 'object',
        properties: {
          fix: { type: 'boolean', description: 'Optionally run npm audit fix (default: false)' },
          cwd: { type: 'string', description: 'Working directory (optional)' },
        },
      },
    },
  },
  metadata: { category: 'build', permissionKey: 'bash' },
  execute: async (args) => {
    const { runNpm } = await import('../helpers.js');
    const npmArgs = ['audit'];
    if (args.fix) npmArgs.push('fix');
    const result = await runNpm(npmArgs, args.cwd as string | undefined);
    return { output: result };
  },
};

const npmCheckOutdated: RegisteredTool = {
  definition: {
    type: 'function' as const,
    function: {
      name: 'npm_check_outdated',
      description: 'Identify dependencies that are out of date (runs npm outdated).',
      parameters: {
        type: 'object',
        properties: {
          cwd: { type: 'string', description: 'Working directory (optional)' },
        },
      },
    },
  },
  metadata: { category: 'build', permissionKey: 'bash' },
  execute: async (args) => {
    const { runNpm } = await import('../helpers.js');
    const result = await runNpm(['outdated'], args.cwd as string | undefined);
    return { output: result };
  },
};

const npmRunScript: RegisteredTool = {
  definition: {
    type: 'function' as const,
    function: {
      name: 'npm_run_script',
      description: 'Run a script defined under the scripts field in package.json.',
      parameters: {
        type: 'object',
        properties: {
          scriptName: { type: 'string', description: 'The name of the script' },
          cwd: { type: 'string', description: 'Working directory (optional)' },
        },
        required: ['scriptName'],
      },
    },
  },
  metadata: { category: 'build', permissionKey: 'bash' },
  execute: async (args) => {
    const { runNpm } = await import('../helpers.js');
    const { scriptName, cwd: wd } = args;
    if (!scriptName) return { output: '', error: 'scriptName is required for npm_run_script.' };
    const result = await runNpm(['run', scriptName as string], wd as string | undefined);
    return { output: result };
  },
};

const nodeRunFile: RegisteredTool = {
  definition: {
    type: 'function' as const,
    function: {
      name: 'node_run_file',
      description: 'Execute a JavaScript or TypeScript file directly.',
      parameters: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: 'The file path to execute' },
          args: { type: 'array', items: { type: 'string' }, description: 'Optional command-line arguments' },
          useTsx: { type: 'boolean', description: 'If true, runs TypeScript files using npx tsx (default: true)' },
          cwd: { type: 'string', description: 'Working directory (optional)' },
        },
        required: ['filePath'],
      },
    },
  },
  metadata: { category: 'build', permissionKey: 'bash' },
  execute: async (args) => {
    const { filePath, args: fileArgs, useTsx, cwd: wd } = args;
    if (!filePath) return { output: '', error: 'filePath is required for node_run_file.' };
    const cwdDir = getCwd();
    const resolvedPath = path.resolve((wd as string) || cwdDir, filePath as string);
    const argList = (fileArgs as string[]) || [];
    const escapedArgs = argList.map((a) => `"${a.replace(/(["\\$])/g, '\\$1')}"`).join(' ');
    const isTs = (filePath as string).endsWith('.ts') || (filePath as string).endsWith('.tsx');
    const runWithTsx = useTsx !== false && isTs;
    const cmd = runWithTsx
      ? `npx tsx "${resolvedPath}" ${escapedArgs}`
      : `node "${resolvedPath}" ${escapedArgs}`;

    const output = await new Promise<string>((resolve) => {
      exec(cmd, { cwd: (wd as string) || cwdDir, maxBuffer: MAX_BUFFER }, (err, stdout, stderr) => {
        if (err) resolve(`Execution error:\n${stderr || err.message}\nSTDOUT:\n${stdout}`);
        else resolve(stdout || stderr || 'Executed successfully with no output.');
      });
    });
    if (output.startsWith('Execution error:')) return { output: '', error: output };
    return { output };
  },
};

const nodeGetInfo: RegisteredTool = {
  definition: {
    type: 'function' as const,
    function: {
      name: 'node_get_info',
      description: 'Gather environment details like Node.js version, NPM/Yarn version, and OS type.',
      parameters: {
        type: 'object',
        properties: {
          cwd: { type: 'string', description: 'Working directory (optional)' },
        },
      },
    },
  },
  metadata: { category: 'build', permissionKey: 'read' },
  execute: async (args) => {
    const wd = args.cwd as string | undefined;
    const getVer = (cmd: string): Promise<string> => {
      return new Promise((resolve) => {
        exec(cmd, { cwd: wd || getCwd() }, (err, stdout) => {
          resolve(err ? 'not installed' : stdout.trim());
        });
      });
    };
    const nodeVer = await getVer('node -v');
    const npmVer = await getVer('npm -v');
    const yarnVer = await getVer('yarn -v');
    const osType = process.platform;
    const osArch = process.arch;
    return {
      output: [
        `Node.js: ${nodeVer}`,
        `NPM: ${npmVer}`,
        `Yarn: ${yarnVer}`,
        `OS Platform: ${osType}`,
        `OS Architecture: ${osArch}`,
      ].join('\n'),
    };
  },
};

// ---------------------------------------------------------------------------
// C/C++ Build Tools
// ---------------------------------------------------------------------------

const cmakeConfigure: RegisteredTool = {
  definition: {
    type: 'function' as const,
    function: {
      name: 'cmake_configure',
      description: 'Configure the build directory and generate Ninja build files from CMakeLists.txt.',
      parameters: {
        type: 'object',
        properties: {
          sourceDir: { type: 'string', description: 'Directory containing CMakeLists.txt (default: ".")' },
          buildDir: { type: 'string', description: 'Target build directory (default: "build")' },
          buildType: { type: 'string', enum: ['Debug', 'Release', 'RelWithDebInfo', 'MinSizeRel'], description: 'Build configuration profile (default: "Debug")' },
          generator: { type: 'string', enum: ['Ninja', 'Unix Makefiles'], description: 'Build system generator (default: "Ninja")' },
          cmakeArgs: { type: 'array', items: { type: 'string' }, description: 'Optional list of CMake flags' },
          cwd: { type: 'string', description: 'Working directory (optional)' },
        },
      },
    },
  },
  metadata: { category: 'build', permissionKey: 'bash' },
  execute: async (args) => {
    const { sourceDir, buildDir, buildType, generator, cmakeArgs, cwd: wd } = args;
    const configureArgs = [
      '-S', (sourceDir as string) || '.',
      '-B', (buildDir as string) || 'build',
      '-G', (generator as string) || 'Ninja',
      `-DCMAKE_BUILD_TYPE=${(buildType as string) || 'Debug'}`,
      ...((cmakeArgs as string[]) || []),
    ];
    const result = await runCmake(configureArgs, wd as string | undefined);
    if (result.startsWith('CMake error:')) return { output: '', error: result };
    return { output: result };
  },
};

const cmakeBuild: RegisteredTool = {
  definition: {
    type: 'function' as const,
    function: {
      name: 'cmake_build',
      description: 'Compile the project targets.',
      parameters: {
        type: 'object',
        properties: {
          buildDir: { type: 'string', description: 'The build directory (default: "build")' },
          target: { type: 'string', description: 'Optional specific target to build' },
          parallel: { type: 'boolean', description: 'If true, runs compilation in parallel (default: true)' },
          cleanFirst: { type: 'boolean', description: 'If true, runs a clean step before compiling (default: false)' },
          cwd: { type: 'string', description: 'Working directory (optional)' },
        },
      },
    },
  },
  metadata: { category: 'build', permissionKey: 'bash' },
  execute: async (args) => {
    const { buildDir, target, parallel, cleanFirst, cwd: wd } = args;
    const buildArgs = ['--build', (buildDir as string) || 'build'];
    if (cleanFirst) buildArgs.push('--clean-first');
    if (parallel !== false) buildArgs.push('--parallel');
    if (target) buildArgs.push('--target', target as string);
    const result = await runCmake(buildArgs, wd as string | undefined);
    if (result.startsWith('CMake error:')) return { output: '', error: result };
    return { output: result };
  },
};

const cmakeRunTests: RegisteredTool = {
  definition: {
    type: 'function' as const,
    function: {
      name: 'cmake_run_tests',
      description: 'Run unit tests configured in CMake using the ctest utility.',
      parameters: {
        type: 'object',
        properties: {
          buildDir: { type: 'string', description: 'The build directory (default: "build")' },
          testNamePattern: { type: 'string', description: 'Run specific tests matching a regex pattern (optional)' },
          parallelJobs: { type: 'integer', description: 'Number of parallel test jobs (optional)' },
          cwd: { type: 'string', description: 'Working directory (optional)' },
        },
      },
    },
  },
  metadata: { category: 'build', permissionKey: 'bash' },
  execute: async (args) => {
    const { buildDir, testNamePattern, parallelJobs, cwd: wd } = args;
    const ctestArgs = ['--test-dir', (buildDir as string) || 'build'];
    if (testNamePattern) ctestArgs.push('-R', testNamePattern as string);
    if (parallelJobs !== undefined) ctestArgs.push('-j', String(parallelJobs));
    else ctestArgs.push('-j');
    const result = await runCtest(ctestArgs, wd as string | undefined);
    if (result.startsWith('CTest error:')) return { output: '', error: result };
    return { output: result };
  },
};

const cmakeClean: RegisteredTool = {
  definition: {
    type: 'function' as const,
    function: {
      name: 'cmake_clean',
      description: 'Clean up build output directories or delete the CMake cache.',
      parameters: {
        type: 'object',
        properties: {
          buildDir: { type: 'string', description: 'The build directory (default: "build")' },
          pristineRebuild: { type: 'boolean', description: 'If true, recursively deletes the entire build directory (default: false)' },
          cwd: { type: 'string', description: 'Working directory (optional)' },
        },
      },
    },
  },
  metadata: { category: 'build', permissionKey: 'bash' },
  execute: async (args) => {
    const { buildDir, pristineRebuild, cwd: wd } = args;
    const bDir = (buildDir as string) || 'build';
    if (pristineRebuild) {
      const resolvedBuildDir = path.resolve((wd as string) || getCwd(), bDir);
      try {
        await fs.remove(resolvedBuildDir);
        return { output: `Build directory ${resolvedBuildDir} successfully removed.` };
      } catch (e: unknown) {
        const errMsg = e instanceof Error ? e.message : String(e);
        return { output: '', error: `Error removing build directory: ${errMsg}` };
      }
    } else {
      const result = await runCmake(['--build', bDir, '--target', 'clean'], wd as string | undefined);
      if (result.startsWith('CMake error:')) return { output: '', error: result };
      return { output: result };
    }
  },
};

const makeRun: RegisteredTool = {
  definition: {
    type: 'function' as const,
    function: {
      name: 'make_run',
      description: 'Execute Make targets configured in a local Makefile.',
      parameters: {
        type: 'object',
        properties: {
          target: { type: 'string', description: 'The Makefile target to run (optional)' },
          jobs: { type: 'integer', description: 'Number of parallel jobs to run (optional)' },
          makefile: { type: 'string', description: 'Path to a custom Makefile using the -f flag (optional)' },
          variables: { type: 'array', items: { type: 'string' }, description: 'Optional key-value Makefile variables' },
          cwd: { type: 'string', description: 'Working directory (optional)' },
        },
      },
    },
  },
  metadata: { category: 'build', permissionKey: 'bash' },
  execute: async (args) => {
    const { target, jobs, makefile, variables, cwd: wd } = args;
    const makeArgs: string[] = [];
    if (makefile) makeArgs.push('-f', makefile as string);
    if (jobs !== undefined) makeArgs.push('-j', String(jobs));
    if (variables && (variables as string[]).length > 0) makeArgs.push(...(variables as string[]));
    if (target) makeArgs.push(target as string);
    const result = await runExecutable('make', makeArgs, wd as string | undefined);
    return { output: result };
  },
};

const cCompileFile: RegisteredTool = {
  definition: {
    type: 'function' as const,
    function: {
      name: 'c_compile_file',
      description: 'Directly compile a single C or C++ source file using gcc, g++, clang, or clang++.',
      parameters: {
        type: 'object',
        properties: {
          compiler: { type: 'string', enum: ['gcc', 'g++', 'clang', 'clang++'], description: 'Compiler binary to use' },
          srcFile: { type: 'string', description: 'Path to C/C++ source file to compile' },
          outFile: { type: 'string', description: 'Output binary or object file path (optional)' },
          includeDirs: { type: 'array', items: { type: 'string' }, description: 'Directories to search for header files (optional)' },
          flags: { type: 'array', items: { type: 'string' }, description: 'Compiler flag arguments (optional)' },
          linkLibs: { type: 'array', items: { type: 'string' }, description: 'Linker libraries (optional)' },
          cwd: { type: 'string', description: 'Working directory (optional)' },
        },
        required: ['compiler', 'srcFile'],
      },
    },
  },
  metadata: { category: 'build', permissionKey: 'bash' },
  execute: async (args) => {
    const { compiler, srcFile, outFile, includeDirs, flags, linkLibs, cwd: wd } = args;
    if (!compiler) return { output: '', error: 'compiler is required for c_compile_file.' };
    if (!srcFile) return { output: '', error: 'srcFile is required for c_compile_file.' };
    const compileArgs: string[] = [];
    if (includeDirs && (includeDirs as string[]).length > 0) {
      (includeDirs as string[]).forEach((dir) => compileArgs.push(`-I${dir}`));
    }
    if (flags && (flags as string[]).length > 0) compileArgs.push(...(flags as string[]));
    compileArgs.push(srcFile as string);
    if (outFile) compileArgs.push('-o', outFile as string);
    if (linkLibs && (linkLibs as string[]).length > 0) compileArgs.push(...(linkLibs as string[]));
    const result = await runExecutable(compiler as string, compileArgs, wd as string | undefined);
    return { output: result };
  },
};

const cAnalyzeCode: RegisteredTool = {
  definition: {
    type: 'function' as const,
    function: {
      name: 'c_analyze_code',
      description: 'Run static analysis on C/C++ source files using cppcheck or clang-tidy.',
      parameters: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: 'Path to file or directory to scan' },
          tool: { type: 'string', enum: ['cppcheck', 'clang-tidy'], description: 'Analysis tool to use (default: "cppcheck")' },
          extraArgs: { type: 'array', items: { type: 'string' }, description: 'Optional list of extra flags' },
          cwd: { type: 'string', description: 'Working directory (optional)' },
        },
        required: ['filePath'],
      },
    },
  },
  metadata: { category: 'build', permissionKey: 'bash' },
  execute: async (args) => {
    const { filePath, tool, extraArgs, cwd: wd } = args;
    if (!filePath) return { output: '', error: 'filePath is required for c_analyze_code.' };
    const checker = (tool as string) || 'cppcheck';
    const checkerArgs: string[] = [];
    if (checker === 'cppcheck') checkerArgs.push('--enable=all', '--inconclusive');
    if (extraArgs && (extraArgs as string[]).length > 0) checkerArgs.push(...(extraArgs as string[]));
    checkerArgs.push(filePath as string);
    const result = await runExecutable(checker, checkerArgs, wd as string | undefined);
    return { output: result };
  },
};

// ---------------------------------------------------------------------------
// Python Tools
// ---------------------------------------------------------------------------

const pythonCreateVenv: RegisteredTool = {
  definition: {
    type: 'function' as const,
    function: {
      name: 'python_create_venv',
      description: 'Create a Python virtual environment.',
      parameters: {
        type: 'object',
        properties: {
          venvPath: { type: 'string', description: 'The path to create the virtual environment in (default: ".venv")' },
          cwd: { type: 'string', description: 'Working directory (optional)' },
        },
      },
    },
  },
  metadata: { category: 'build', permissionKey: 'bash' },
  execute: async (args) => {
    const { venvPath, cwd: wd } = args;
    const vPath = (venvPath as string) || '.venv';
    const cwdDir = (wd as string) || getCwd();
    const output = await new Promise<string>((resolve) => {
      execFile('python3', ['-m', 'venv', vPath], { cwd: cwdDir, maxBuffer: MAX_BUFFER }, (err, _stdout, _stderr) => {
        if (err) {
          execFile('python', ['-m', 'venv', vPath], { cwd: cwdDir, maxBuffer: MAX_BUFFER }, (err2, _stdout2, stderr2) => {
            if (err2) resolve(`Error creating venv: ${stderr2 || err2.message}`);
            else resolve(`Virtual environment created at ${vPath}`);
          });
        } else {
          resolve(`Virtual environment created at ${vPath}`);
        }
      });
    });
    if (output.startsWith('Error:')) return { output: '', error: output };
    return { output };
  },
};

const pythonInstallRequirements: RegisteredTool = {
  definition: {
    type: 'function' as const,
    function: {
      name: 'python_install_requirements',
      description: 'Install packages inside a specific Python virtual environment.',
      parameters: {
        type: 'object',
        properties: {
          requirementsFile: { type: 'string', description: 'Path to a requirements.txt file (optional)' },
          packages: { type: 'array', items: { type: 'string' }, description: 'Optional list of individual packages to install' },
          venvPath: { type: 'string', description: 'The virtual environment directory path (default: ".venv")' },
          cwd: { type: 'string', description: 'Working directory (optional)' },
        },
      },
    },
  },
  metadata: { category: 'build', permissionKey: 'bash' },
  execute: async (args) => {
    const { requirementsFile, packages, venvPath, cwd: wd } = args;
    const vPath = (venvPath as string) || '.venv';
    const cwdDir = (wd as string) || getCwd();
    const pipBin = getVenvBinary(path.resolve(cwdDir, vPath), 'pip');
    const pipArgs = ['install'];
    if (packages && (packages as string[]).length > 0) {
      pipArgs.push(...(packages as string[]));
    } else {
      pipArgs.push('-r', (requirementsFile as string) || 'requirements.txt');
    }
    const output = await new Promise<string>((resolve) => {
      execFile(pipBin, pipArgs, { cwd: cwdDir, maxBuffer: MAX_BUFFER }, (err, stdout, stderr) => {
        if (err) resolve(`Pip installation error: ${stderr || err.message}\nSTDOUT:\n${stdout}`);
        else resolve(stdout || stderr || 'Packages installed successfully.');
      });
    });
    if (output.startsWith('Pip installation error:')) return { output: '', error: output };
    return { output };
  },
};

const pythonListPackages: RegisteredTool = {
  definition: {
    type: 'function' as const,
    function: {
      name: 'python_list_packages',
      description: 'Retrieve a list of installed Python packages inside the virtual environment.',
      parameters: {
        type: 'object',
        properties: {
          venvPath: { type: 'string', description: 'The virtual environment directory path (default: ".venv")' },
          cwd: { type: 'string', description: 'Working directory (optional)' },
        },
      },
    },
  },
  metadata: { category: 'build', permissionKey: 'bash' },
  execute: async (args) => {
    const { venvPath, cwd: wd } = args;
    const vPath = (venvPath as string) || '.venv';
    const cwdDir = (wd as string) || getCwd();
    const pipBin = getVenvBinary(path.resolve(cwdDir, vPath), 'pip');
    const output = await new Promise<string>((resolve) => {
      execFile(pipBin, ['list'], { cwd: cwdDir, maxBuffer: MAX_BUFFER }, (err, stdout, stderr) => {
        if (err) resolve(`Pip list error: ${stderr || err.message}\nSTDOUT:\n${stdout}`);
        else resolve(stdout || stderr || 'No packages found.');
      });
    });
    if (output.startsWith('Pip list error:')) return { output: '', error: output };
    return { output };
  },
};

const pythonRunFile: RegisteredTool = {
  definition: {
    type: 'function' as const,
    function: {
      name: 'python_run_file',
      description: 'Execute a Python script using the python interpreter inside a specific virtual environment.',
      parameters: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: 'The path to the python script to run' },
          args: { type: 'array', items: { type: 'string' }, description: 'Optional arguments to pass to the script' },
          venvPath: { type: 'string', description: 'The virtual environment directory path (default: ".venv")' },
          cwd: { type: 'string', description: 'Working directory (optional)' },
        },
        required: ['filePath'],
      },
    },
  },
  metadata: { category: 'build', permissionKey: 'bash' },
  execute: async (args) => {
    const { filePath, args: pyArgs, venvPath, cwd: wd } = args;
    if (!filePath) return { output: '', error: 'filePath is required for python_run_file.' };
    const vPath = (venvPath as string) || '.venv';
    const cwdDir = (wd as string) || getCwd();
    const pythonBin = getVenvBinary(path.resolve(cwdDir, vPath), 'python');
    const fileArgs = (pyArgs as string[]) || [];
    const output = await new Promise<string>((resolve) => {
      execFile(pythonBin, [filePath as string, ...fileArgs], { cwd: cwdDir, maxBuffer: MAX_BUFFER }, (err, stdout, stderr) => {
        if (err) resolve(`Python execution error: ${stderr || err.message}\nSTDOUT:\n${stdout}`);
        else resolve(stdout || stderr || 'Success');
      });
    });
    if (output.startsWith('Python execution error:')) return { output: '', error: output };
    return { output };
  },
};

const pipShowPackage: RegisteredTool = {
  definition: {
    type: 'function' as const,
    function: {
      name: 'pip_show_package',
      description: 'View detailed metadata about an installed Python package.',
      parameters: {
        type: 'object',
        properties: {
          packageName: { type: 'string', description: 'The name of the package to show' },
          venvPath: { type: 'string', description: 'The virtual environment directory path (default: ".venv")' },
          cwd: { type: 'string', description: 'Working directory (optional)' },
        },
        required: ['packageName'],
      },
    },
  },
  metadata: { category: 'build', permissionKey: 'bash' },
  execute: async (args) => {
    const { packageName, venvPath, cwd: wd } = args;
    if (!packageName) return { output: '', error: 'packageName is required for pip_show_package.' };
    const vPath = (venvPath as string) || '.venv';
    const cwdDir = (wd as string) || getCwd();
    const pipBin = getVenvBinary(path.resolve(cwdDir, vPath), 'pip');
    const result = await runExecutable(pipBin, ['show', packageName as string], wd as string | undefined);
    return { output: result };
  },
};

// ---------------------------------------------------------------------------
// Java Tools
// ---------------------------------------------------------------------------

const javaCompileAndRun: RegisteredTool = {
  definition: {
    type: 'function' as const,
    function: {
      name: 'java_compile_and_run',
      description: 'Compile Java source files or run compiled class files.',
      parameters: {
        type: 'object',
        properties: {
          action: { type: 'string', enum: ['compile', 'run'], description: 'Action to perform' },
          sourceFiles: { type: 'array', items: { type: 'string' }, description: 'Source files to compile' },
          className: { type: 'string', description: 'Class name with main method to execute' },
          classPath: { type: 'string', description: 'Classpath lookup paths' },
          args: { type: 'array', items: { type: 'string' }, description: 'Optional command-line arguments' },
          cwd: { type: 'string', description: 'Working directory (optional)' },
        },
        required: ['action'],
      },
    },
  },
  metadata: { category: 'build', permissionKey: 'bash' },
  execute: async (args) => {
    const { action, sourceFiles, className, classPath, args: javaArgs, cwd: wd } = args;
    if (!action) return { output: '', error: 'action is required for java_compile_and_run.' };
    if (action === 'compile') {
      if (!sourceFiles || (sourceFiles as string[]).length === 0) return { output: '', error: 'sourceFiles required for java compile action.' };
      const javacArgs: string[] = [];
      if (classPath) javacArgs.push('-cp', classPath as string);
      javacArgs.push(...(sourceFiles as string[]));
      const result = await runExecutable('javac', javacArgs, wd as string | undefined);
      return { output: result };
    } else if (action === 'run') {
      if (!className) return { output: '', error: 'className required for java run action.' };
      const javaExecArgs: string[] = [];
      if (classPath) javaExecArgs.push('-cp', classPath as string);
      javaExecArgs.push(className as string);
      if (javaArgs && (javaArgs as string[]).length > 0) javaExecArgs.push(...(javaArgs as string[]));
      const result = await runExecutable('java', javaExecArgs, wd as string | undefined);
      return { output: result };
    }
    return { output: '', error: `invalid action "${action}".` };
  },
};

const javaProjectBuild: RegisteredTool = {
  definition: {
    type: 'function' as const,
    function: {
      name: 'java_project_build',
      description: 'Build Maven or Gradle projects.',
      parameters: {
        type: 'object',
        properties: {
          system: { type: 'string', enum: ['maven', 'gradle'], description: 'The project build system tool to run' },
          target: { type: 'string', description: 'The target command or task' },
          cwd: { type: 'string', description: 'Working directory (optional)' },
        },
        required: ['system'],
      },
    },
  },
  metadata: { category: 'build', permissionKey: 'bash' },
  execute: async (args) => {
    const { system, target, cwd: wd } = args;
    if (!system) return { output: '', error: 'system is required for java_project_build.' };
    if (system === 'maven') {
      const t = ((target as string) || 'clean install').trim().split(/\s+/);
      const result = await runExecutable('mvn', t, wd as string | undefined);
      return { output: result };
    } else if (system === 'gradle') {
      const t = ((target as string) || 'build').trim().split(/\s+/);
      const cwdDir = (wd as string) || getCwd();
      const isWin = process.platform === 'win32';
      const localWrapper = isWin ? 'gradlew.bat' : 'gradlew';
      const localWrapperPath = path.resolve(cwdDir, localWrapper);
      const hasWrapper = await fs.pathExists(localWrapperPath);
      const gradleBin = hasWrapper ? localWrapperPath : 'gradle';
      const result = await runExecutable(gradleBin, t, wd as string | undefined);
      return { output: result };
    }
    return { output: '', error: `invalid build system "${system}".` };
  },
};

// ---------------------------------------------------------------------------
// .NET Tools
// ---------------------------------------------------------------------------

const dotnetCommand: RegisteredTool = {
  definition: {
    type: 'function' as const,
    function: {
      name: 'dotnet_command',
      description: 'Configure, build, test, and run .NET projects.',
      parameters: {
        type: 'object',
        properties: {
          action: { type: 'string', enum: ['build', 'run', 'test', 'clean', 'restore', 'publish'], description: 'The dotnet command action to execute' },
          projectPath: { type: 'string', description: 'Path to a .csproj, .sln, or directory (optional)' },
          configuration: { type: 'string', enum: ['Debug', 'Release'], description: 'Build configuration profile (optional)' },
          extraArgs: { type: 'array', items: { type: 'string' }, description: 'Optional flags or arguments' },
          cwd: { type: 'string', description: 'Working directory (optional)' },
        },
        required: ['action'],
      },
    },
  },
  metadata: { category: 'build', permissionKey: 'bash' },
  execute: async (args) => {
    const { action, projectPath, configuration, extraArgs, cwd: wd } = args;
    if (!action) return { output: '', error: 'action is required for dotnet_command.' };
    const dotnetArgs = [action as string];
    if (projectPath) dotnetArgs.push(projectPath as string);
    if (configuration) dotnetArgs.push('-c', configuration as string);
    if (extraArgs && (extraArgs as string[]).length > 0) dotnetArgs.push(...(extraArgs as string[]));
    const result = await runExecutable('dotnet', dotnetArgs, wd as string | undefined);
    return { output: result };
  },
};

// ---------------------------------------------------------------------------
// Flutter Tools
// ---------------------------------------------------------------------------

const flutterCommand: RegisteredTool = {
  definition: {
    type: 'function' as const,
    function: {
      name: 'flutter_command',
      description: 'Fetch dependencies, build, and test Flutter/Dart applications.',
      parameters: {
        type: 'object',
        properties: {
          action: { type: 'string', enum: ['build', 'test', 'pub_get', 'doctor', 'clean'], description: 'The flutter action to execute' },
          buildTarget: { type: 'string', enum: ['apk', 'appbundle', 'ios', 'web', 'macos', 'windows', 'linux'], description: 'Target compile platform (required for build action)' },
          extraArgs: { type: 'array', items: { type: 'string' }, description: 'Optional flags or arguments' },
          cwd: { type: 'string', description: 'Working directory (optional)' },
        },
        required: ['action'],
      },
    },
  },
  metadata: { category: 'build', permissionKey: 'bash' },
  execute: async (args) => {
    const { action, buildTarget, extraArgs, cwd: wd } = args;
    if (!action) return { output: '', error: 'action is required for flutter_command.' };
    const flutterArgs = [action as string];
    if (action === 'build') {
      if (!buildTarget) return { output: '', error: 'buildTarget is required for build action.' };
      flutterArgs.push(buildTarget as string);
    }
    if (extraArgs && (extraArgs as string[]).length > 0) flutterArgs.push(...(extraArgs as string[]));
    const result = await runExecutable('flutter', flutterArgs, wd as string | undefined);
    return { output: result };
  },
};

// ---------------------------------------------------------------------------
// Project Scaffolding
// ---------------------------------------------------------------------------

const createProject: RegisteredTool = {
  definition: {
    type: 'function' as const,
    function: {
      name: 'create_project',
      description: 'Scaffold a new project in React, Next.js, Flutter, .NET, Java, Maven, ASP.NET, Flask, Django, etc.',
      parameters: {
        type: 'object',
        properties: {
          template: {
            type: 'string',
            enum: ['react', 'nextjs', 'flutter', 'dotnet-console', 'aspnet-webapi', 'aspnet-mvc', 'maven-quickstart', 'gradle-java', 'flask', 'django'],
            description: 'The template framework to use for project creation',
          },
          projectName: { type: 'string', description: 'The name of the new project' },
          outputDir: { type: 'string', description: 'Directory where the project should be created (default: cwd)' },
          extraArgs: { type: 'array', items: { type: 'string' }, description: 'Optional flags or arguments' },
          cwd: { type: 'string', description: 'Working directory (optional)' },
        },
        required: ['template', 'projectName'],
      },
    },
  },
  metadata: { category: 'project', permissionKey: 'edit' },
  execute: async (args) => {
    const { template, projectName, outputDir, extraArgs, cwd: wd } = args;
    if (!template) return { output: '', error: 'template is required for create_project.' };
    if (!projectName) return { output: '', error: 'projectName is required for create_project.' };
    const cwdDir = (wd as string) || getCwd();
    const parentDir = path.resolve(cwdDir, (outputDir as string) || '.');

    if (template === 'flask') {
      const targetDir = path.join(parentDir, projectName as string);
      try {
        await fs.ensureDir(targetDir);
        const appPy = [
          'from flask import Flask',
          'app = Flask(__name__)',
          '',
          '@app.route("/")',
          'def index():',
          '    return "Hello, Flask!"',
          '',
          'if __name__ == "__main__":',
          '    app.run(debug=True)',
        ].join('\n');
        await fs.writeFile(path.join(targetDir, 'app.py'), appPy, 'utf8');
        await fs.writeFile(path.join(targetDir, 'requirements.txt'), 'flask\n', 'utf8');
        return { output: `Flask project "${projectName}" successfully scaffolded at ${targetDir}` };
      } catch (e: unknown) {
        const errMsg = e instanceof Error ? e.message : String(e);
        return { output: '', error: `Error scaffolding Flask project: ${errMsg}` };
      }
    }

    let binary = '';
    let cmdArgs: string[] = [];
    const userExtra = (extraArgs as string[]) || [];

    if (template === 'react') {
      binary = 'npm';
      cmdArgs = ['create', 'vite@latest', projectName as string, '--', '--template', 'react', ...userExtra];
    } else if (template === 'nextjs') {
      binary = 'npx';
      cmdArgs = ['-y', 'create-next-app@latest', projectName as string, '--use-npm', '--typescript', '--eslint', '--src-dir', '--app', '--import-alias', '@/*', '--tailwind', ...userExtra];
    } else if (template === 'flutter') {
      binary = 'flutter';
      const cleanName = (projectName as string).toLowerCase().replace(/[^a-z0-9_]/g, '_');
      cmdArgs = ['create', '--project-name', cleanName, projectName as string, ...userExtra];
    } else if (template === 'dotnet-console') {
      binary = 'dotnet';
      cmdArgs = ['new', 'console', '-n', projectName as string, '-o', projectName as string, ...userExtra];
    } else if (template === 'aspnet-webapi') {
      binary = 'dotnet';
      cmdArgs = ['new', 'webapi', '-n', projectName as string, '-o', projectName as string, ...userExtra];
    } else if (template === 'aspnet-mvc') {
      binary = 'dotnet';
      cmdArgs = ['new', 'mvc', '-n', projectName as string, '-o', projectName as string, ...userExtra];
    } else if (template === 'maven-quickstart') {
      binary = 'mvn';
      cmdArgs = ['archetype:generate', '-DgroupId=com.example', `-DartifactId=${projectName}`, '-DarchetypeArtifactId=maven-archetype-quickstart', '-DinteractiveMode=false', ...userExtra];
    } else if (template === 'gradle-java') {
      binary = 'gradle';
      cmdArgs = ['init', '--type', 'java-application', '--dsl', 'groovy', '--project-name', projectName as string, ...userExtra];
    } else if (template === 'django') {
      binary = 'django-admin';
      cmdArgs = ['startproject', projectName as string, ...userExtra];
    } else {
      return { output: '', error: `unsupported project template "${template}".` };
    }

    await fs.ensureDir(parentDir);
    const result = await runExecutable(binary, cmdArgs, parentDir);
    return { output: result };
  },
};

/** Register all build and project tools. */
export function registerBuildTools(): void {
  // Code quality
  globalRegistry.register(runLinter);
  globalRegistry.register(runTests);
  globalRegistry.register(codeReview);
  globalRegistry.register(runFormatter);
  globalRegistry.register(installPackage);
  // Node.js
  globalRegistry.register(npmListDependencies);
  globalRegistry.register(npmAudit);
  globalRegistry.register(npmCheckOutdated);
  globalRegistry.register(npmRunScript);
  globalRegistry.register(nodeRunFile);
  globalRegistry.register(nodeGetInfo);
  // C/C++
  globalRegistry.register(cmakeConfigure);
  globalRegistry.register(cmakeBuild);
  globalRegistry.register(cmakeRunTests);
  globalRegistry.register(cmakeClean);
  globalRegistry.register(makeRun);
  globalRegistry.register(cCompileFile);
  globalRegistry.register(cAnalyzeCode);
  // Python
  globalRegistry.register(pythonCreateVenv);
  globalRegistry.register(pythonInstallRequirements);
  globalRegistry.register(pythonListPackages);
  globalRegistry.register(pythonRunFile);
  globalRegistry.register(pipShowPackage);
  // Java
  globalRegistry.register(javaCompileAndRun);
  globalRegistry.register(javaProjectBuild);
  // .NET
  globalRegistry.register(dotnetCommand);
  // Flutter
  globalRegistry.register(flutterCommand);
  // Scaffolding
  globalRegistry.register(createProject);
}
