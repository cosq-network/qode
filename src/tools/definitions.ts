export const TOOL_DEFINITIONS = [
  // shell_exec
  {
    type: 'function' as const,
    function: {
      name: 'shell_exec',
      description: 'Execute a shell command and return its output.',
      parameters: {
        type: 'object',
        properties: {
          command: { type: 'string', description: 'Full shell command to run' },
          cwd: { type: 'string', description: 'Working directory (optional)' },
        },
        required: ['command'],
      },
    },
  },
  // file_read
  {
    type: 'function' as const,
    function: {
      name: 'file_read',
      description: 'Read a file, respecting .gitignore/.dockerignore.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Relative or absolute path' },
        },
        required: ['path'],
      },
    },
  },
  // file_write
  {
    type: 'function' as const,
    function: {
      name: 'file_write',
      description: 'Write or overwrite a file.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string' },
          content: { type: 'string' },
        },
        required: ['path', 'content'],
      },
    },
  },
  // file_edit
  {
    type: 'function' as const,
    function: {
      name: 'file_edit',
      description: 'Edit a file by replacing the first occurrence of old_string with new_string.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string' },
          old_string: { type: 'string' },
          new_string: { type: 'string' },
        },
        required: ['path', 'old_string', 'new_string'],
      },
    },
  },
  // file_find
  {
    type: 'function' as const,
    function: {
      name: 'file_find',
      description: 'Find files by a substring in their filename, recursively from a directory (default: current). Respects ignore rules.',
      parameters: {
        type: 'object',
        properties: {
          pattern: { type: 'string', description: 'Substring to match in file names' },
          directory: { type: 'string', description: 'Directory to search (default: cwd)' },
        },
        required: ['pattern'],
      },
    },
  },
  // grep
  {
    type: 'function' as const,
    function: {
      name: 'grep',
      description: 'Search for a string inside files recursively, respecting ignore rules. Returns matching lines with file paths.',
      parameters: {
        type: 'object',
        properties: {
          pattern: { type: 'string', description: 'String to search for' },
          directory: { type: 'string', description: 'Directory to search (default: cwd)' },
        },
        required: ['pattern'],
      },
    },
  },
  // run_linter
  {
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
  // run_tests
  {
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
  // code_review
  {
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
  // run_formatter
  {
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
  // install_package
  {
    type: 'function' as const,
    function: {
      name: 'install_package',
      description: 'Install one or more packages using a package manager (npm, pip, nuget, etc.).',
      parameters: {
        type: 'object',
        properties: {
          manager: { type: 'string', description: 'Package manager command, e.g. "npm", "pip"' },
          packages: {
            oneOf: [
              { type: 'string' },
              { type: 'array', items: { type: 'string' } },
            ],
            description: 'Package name(s)',
          },
          cwd: { type: 'string', description: 'Working directory (optional)' },
        },
        required: ['manager', 'packages'],
      },
    },
  },
  // git_command
  {
    type: 'function' as const,
    function: {
      name: 'git_command',
      description: 'Run a git command (e.g., "status", "diff", "log --oneline").',
      parameters: {
        type: 'object',
        properties: {
          command: { type: 'string', description: 'Arguments for git, without the "git" prefix' },
          cwd: { type: 'string', description: 'Working directory (optional)' },
        },
        required: ['command'],
      },
    },
  },
  // create_directory
  {
    type: 'function' as const,
    function: {
      name: 'create_directory',
      description: 'Create a new directory.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Directory path to create' },
        },
        required: ['path'],
      },
    },
  },
  // delete_file_or_dir
  {
    type: 'function' as const,
    function: {
      name: 'delete_file_or_dir',
      description: 'Delete a file or directory (respects ignore rules).',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Path to delete' },
        },
        required: ['path'],
      },
    },
  },
  // git_status
  {
    type: 'function' as const,
    function: {
      name: 'git_status',
      description: 'Get a clean, structured status of the repository (modified, untracked, deleted files).',
      parameters: {
        type: 'object',
        properties: {
          cwd: { type: 'string', description: 'Working directory (optional)' },
        },
      },
    },
  },
  // git_diff
  {
    type: 'function' as const,
    function: {
      name: 'git_diff',
      description: 'Retrieve the diff of unstaged changes (or changes between commits/branches).',
      parameters: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: 'Limit diff to a specific file (optional)' },
          staged: { type: 'boolean', description: 'Show staged changes instead (optional)' },
          compareWith: { type: 'string', description: 'Compare with a specific commit or branch, e.g., HEAD~1 or main (optional)' },
          cwd: { type: 'string', description: 'Working directory (optional)' },
        },
      },
    },
  },
  // git_log
  {
    type: 'function' as const,
    function: {
      name: 'git_log',
      description: 'Retrieve the commit history.',
      parameters: {
        type: 'object',
        properties: {
          limit: { type: 'integer', description: 'Maximum number of commits to return (default: 10)' },
          filePath: { type: 'string', description: 'Filter commits affecting a specific file (optional)' },
          cwd: { type: 'string', description: 'Working directory (optional)' },
        },
      },
    },
  },
  // git_blame
  {
    type: 'function' as const,
    function: {
      name: 'git_blame',
      description: 'Show commit hash, author, and date for each line of a file.',
      parameters: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: 'The file path to blame' },
          startLine: { type: 'integer', description: 'Start line number (optional, 1-indexed)' },
          endLine: { type: 'integer', description: 'End line number (optional, 1-indexed)' },
          cwd: { type: 'string', description: 'Working directory (optional)' },
        },
        required: ['filePath'],
      },
    },
  },
  // git_discard_changes
  {
    type: 'function' as const,
    function: {
      name: 'git_discard_changes',
      description: 'Discard unstaged changes in one or more files, or the entire repository.',
      parameters: {
        type: 'object',
        properties: {
          paths: {
            type: 'array',
            items: { type: 'string' },
            description: 'Paths of files to restore to their last committed state'
          },
          discardAllUnstaged: {
            type: 'boolean',
            description: 'Discard all unstaged changes in the repository (default: false)'
          },
          cwd: { type: 'string', description: 'Working directory (optional)' },
        },
      },
    },
  },
  // git_manage_branch
  {
    type: 'function' as const,
    function: {
      name: 'git_manage_branch',
      description: 'Create, switch, list, or delete branches.',
      parameters: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: ['list', 'create', 'checkout', 'delete'],
            description: 'Action to perform: list, create, checkout, or delete'
          },
          branchName: { type: 'string', description: 'Name of the branch to create, switch to, or delete (optional)' },
          baseBranch: { type: 'string', description: 'Start point branch if creating a new branch (optional)' },
          cwd: { type: 'string', description: 'Working directory (optional)' },
        },
        required: ['action'],
      },
    },
  },
  // git_commit
  {
    type: 'function' as const,
    function: {
      name: 'git_commit',
      description: 'Stage files and commit them with a message.',
      parameters: {
        type: 'object',
        properties: {
          message: { type: 'string', description: 'The commit message' },
          paths: {
            type: 'array',
            items: { type: 'string' },
            description: 'Optional list of files to stage first. If omitted and stageAll is false, commits already-staged files.'
          },
          stageAll: {
            type: 'boolean',
            description: 'Stage all modified files before committing (default: false)'
          },
          cwd: { type: 'string', description: 'Working directory (optional)' },
        },
        required: ['message'],
      },
    },
  },

  // git_clone
  {
    type: 'function' as const,
    function: {
      name: 'git_clone',
      description: 'Clone a repository into a directory.',
      parameters: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'Repository URL to clone' },
          directory: { type: 'string', description: 'Target directory path (optional)' },
          branch: { type: 'string', description: 'Branch to clone (optional)' },
          cwd: { type: 'string', description: 'Working directory (optional)' },
        },
        required: ['url'],
      },
    },
  },

  // git_manage_tag
  {
    type: 'function' as const,
    function: {
      name: 'git_manage_tag',
      description: 'Create, list, or delete git tags.',
      parameters: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: ['create', 'list', 'delete'],
            description: 'Tag action to perform',
          },
          tagName: { type: 'string', description: 'Tag name for create/delete (optional)' },
          message: { type: 'string', description: 'Annotation message for annotated tag (optional)' },
          cwd: { type: 'string', description: 'Working directory (optional)' },
        },
        required: ['action'],
      },
    },
  },

  // git_merge
  {
    type: 'function' as const,
    function: {
      name: 'git_merge',
      description: 'Merge a branch into the current branch.',
      parameters: {
        type: 'object',
        properties: {
          branch: { type: 'string', description: 'Branch to merge into current branch' },
          noFF: { type: 'boolean', description: 'Create a merge commit even when fast-forward is possible (default: false)' },
          noCommit: { type: 'boolean', description: 'Do not auto-commit the merge; just stage/apply changes (default: false)' },
          message: { type: 'string', description: 'Custom merge commit message (optional)' },
          cwd: { type: 'string', description: 'Working directory (optional)' },
        },
        required: ['branch'],
      },
    },
  },

  // git_cherry_pick
  {
    type: 'function' as const,
    function: {
      name: 'git_cherry_pick',
      description: 'Apply changes from an existing commit onto the current branch.',
      parameters: {
        type: 'object',
        properties: {
          commit: { type: 'string', description: 'Commit SHA or ref to cherry-pick' },
          noCommit: { type: 'boolean', description: 'Apply changes without creating a commit (default: false)' },
          cwd: { type: 'string', description: 'Working directory (optional)' },
        },
        required: ['commit'],
      },
    },
  },

  // npm_list_dependencies
  {
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
  // npm_audit
  {
    type: 'function' as const,
    function: {
      name: 'npm_audit',
      description: 'Run security vulnerability audits on the installed dependencies (runs npm audit).',
      parameters: {
        type: 'object',
        properties: {
          fix: { type: 'boolean', description: 'Optionally run npm audit fix to automatically patch simple vulnerability updates (default: false)' },
          cwd: { type: 'string', description: 'Working directory (optional)' },
        },
      },
    },
  },
  // npm_check_outdated
  {
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
  // npm_run_script
  {
    type: 'function' as const,
    function: {
      name: 'npm_run_script',
      description: 'Run a script defined under the scripts field in package.json.',
      parameters: {
        type: 'object',
        properties: {
          scriptName: { type: 'string', description: 'The name of the script, e.g., "build", "lint", "start"' },
          cwd: { type: 'string', description: 'Working directory (optional)' },
        },
        required: ['scriptName'],
      },
    },
  },
  // node_run_file
  {
    type: 'function' as const,
    function: {
      name: 'node_run_file',
      description: 'Execute a JavaScript or TypeScript file directly.',
      parameters: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: 'The file path to execute, e.g., src/utils/test.ts' },
          args: {
            type: 'array',
            items: { type: 'string' },
            description: 'Optional command-line arguments to pass to the script'
          },
          useTsx: { type: 'boolean', description: 'If true, runs TypeScript files using npx tsx (default: true)' },
          cwd: { type: 'string', description: 'Working directory (optional)' },
        },
        required: ['filePath'],
      },
    },
  },
  // node_get_info
  {
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
  // cmake_configure
  {
    type: 'function' as const,
    function: {
      name: 'cmake_configure',
      description: 'Configure the build directory and generate Ninja build files from CMakeLists.txt.',
      parameters: {
        type: 'object',
        properties: {
          sourceDir: { type: 'string', description: 'Directory containing CMakeLists.txt (default: ".")' },
          buildDir: { type: 'string', description: 'Target build directory (default: "build")' },
          buildType: {
            type: 'string',
            enum: ['Debug', 'Release', 'RelWithDebInfo', 'MinSizeRel'],
            description: 'Build configuration profile (default: "Debug")'
          },
          generator: {
            type: 'string',
            enum: ['Ninja', 'Unix Makefiles'],
            description: 'Build system generator (default: "Ninja")'
          },
          cmakeArgs: {
            type: 'array',
            items: { type: 'string' },
            description: 'Optional list of CMake flags or variables, e.g. ["-DBUILD_TESTING=ON"]'
          },
          cwd: { type: 'string', description: 'Working directory (optional)' },
        },
      },
    },
  },
  // cmake_build
  {
    type: 'function' as const,
    function: {
      name: 'cmake_build',
      description: 'Compile the project targets.',
      parameters: {
        type: 'object',
        properties: {
          buildDir: { type: 'string', description: 'The build directory initialized during configuration (default: "build")' },
          target: { type: 'string', description: 'Optional specific target to build (default: build all)' },
          parallel: { type: 'boolean', description: 'If true, runs compilation in parallel (default: true)' },
          cleanFirst: { type: 'boolean', description: 'If true, runs a clean step before compiling (default: false)' },
          cwd: { type: 'string', description: 'Working directory (optional)' },
        },
      },
    },
  },
  // cmake_run_tests
  {
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
  // cmake_clean
  {
    type: 'function' as const,
    function: {
      name: 'cmake_clean',
      description: 'Clean up build output directories or delete the CMake cache.',
      parameters: {
        type: 'object',
        properties: {
          buildDir: { type: 'string', description: 'The build directory (default: "build")' },
          pristineRebuild: { type: 'boolean', description: 'If true, recursively deletes the entire build directory to clean CMake cache (default: false)' },
          cwd: { type: 'string', description: 'Working directory (optional)' },
        },
      },
    },
  },
  // make_run
  {
    type: 'function' as const,
    function: {
      name: 'make_run',
      description: 'Execute Make targets configured in a local Makefile.',
      parameters: {
        type: 'object',
        properties: {
          target: { type: 'string', description: 'The Makefile target to run (optional, e.g. "all", "clean")' },
          jobs: { type: 'integer', description: 'Number of parallel jobs to run (optional)' },
          makefile: { type: 'string', description: 'Path to a custom Makefile using the -f flag (optional)' },
          variables: {
            type: 'array',
            items: { type: 'string' },
            description: 'Optional key-value Makefile variables, e.g. ["CC=clang", "DEBUG=1"]'
          },
          cwd: { type: 'string', description: 'Working directory (optional)' },
        },
      },
    },
  },
  // c_compile_file
  {
    type: 'function' as const,
    function: {
      name: 'c_compile_file',
      description: 'Directly compile a single C or C++ source file using gcc, g++, clang, or clang++.',
      parameters: {
        type: 'object',
        properties: {
          compiler: {
            type: 'string',
            enum: ['gcc', 'g++', 'clang', 'clang++'],
            description: 'Compiler binary to use'
          },
          srcFile: { type: 'string', description: 'Path to C/C++ source file to compile' },
          outFile: { type: 'string', description: 'Output binary or object file path (optional)' },
          includeDirs: {
            type: 'array',
            items: { type: 'string' },
            description: 'Directories to search for header files, mapped to -I (optional)'
          },
          flags: {
            type: 'array',
            items: { type: 'string' },
            description: 'Compiler flag arguments, e.g. ["-Wall", "-O3", "-std=c++20"] (optional)'
          },
          linkLibs: {
            type: 'array',
            items: { type: 'string' },
            description: 'Linker libraries, e.g. ["-lpthread", "-lm"] (optional)'
          },
          cwd: { type: 'string', description: 'Working directory (optional)' },
        },
        required: ['compiler', 'srcFile'],
      },
    },
  },
  // c_analyze_code
  {
    type: 'function' as const,
    function: {
      name: 'c_analyze_code',
      description: 'Run static analysis on C/C++ source files using cppcheck or clang-tidy.',
      parameters: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: 'Path to file or directory to scan' },
          tool: {
            type: 'string',
            enum: ['cppcheck', 'clang-tidy'],
            description: 'Analysis tool to use (default: "cppcheck")'
          },
          extraArgs: {
            type: 'array',
            items: { type: 'string' },
            description: 'Optional list of extra flags to pass to the checker tool'
          },
          cwd: { type: 'string', description: 'Working directory (optional)' },
        },
        required: ['filePath'],
      },
    },
  },
  // grep_regex
  {
    type: 'function' as const,
    function: {
      name: 'grep_regex',
      description: 'Search for text pattern matches inside files using regular expressions.',
      parameters: {
        type: 'object',
        properties: {
          pattern: { type: 'string', description: 'The regular expression pattern to search for' },
          directory: { type: 'string', description: 'Directory to search recursively (default: cwd)' },
          fileExtensions: {
            type: 'array',
            items: { type: 'string' },
            description: 'Optional file extension list to restrict search, e.g. ["ts", "tsx"]'
          },
          caseInsensitive: { type: 'boolean', description: 'Perform case-insensitive matching (default: false)' },
          cwd: { type: 'string', description: 'Working directory (optional)' },
        },
        required: ['pattern'],
      },
    },
  },
  // grep_find_and_replace
  {
    type: 'function' as const,
    function: {
      name: 'grep_find_and_replace',
      description: 'Find and replace a string or regular expression across multiple files.',
      parameters: {
        type: 'object',
        properties: {
          findPattern: { type: 'string', description: 'The string or regular expression to locate' },
          replacement: { type: 'string', description: 'The replacement text' },
          directory: { type: 'string', description: 'Directory to search recursively (default: cwd)' },
          isRegex: { type: 'boolean', description: 'Treat findPattern as a regular expression (default: false)' },
          fileExtensions: {
            type: 'array',
            items: { type: 'string' },
            description: 'Optional file extension list to restrict search, e.g. ["ts", "js"]'
          },
          cwd: { type: 'string', description: 'Working directory (optional)' },
        },
        required: ['findPattern', 'replacement'],
      },
    },
  },
  // file_find_by_metadata
  {
    type: 'function' as const,
    function: {
      name: 'file_find_by_metadata',
      description: 'Find files based on metadata filters like file type, size, or modification times.',
      parameters: {
        type: 'object',
        properties: {
          directory: { type: 'string', description: 'Directory to search recursively (default: cwd)' },
          type: {
            type: 'string',
            enum: ['file', 'directory'],
            description: 'Limit results to files or directories'
          },
          minSize: { type: 'string', description: 'Exclude files smaller than this size, e.g. "10kb", "1.5mb" (optional)' },
          maxSize: { type: 'string', description: 'Exclude files larger than this size, e.g. "500kb", "2mb" (optional)' },
          modifiedWithin: { type: 'string', description: 'Filter files modified within a duration, e.g. "24h", "7d", "30m" (optional)' },
          cwd: { type: 'string', description: 'Working directory (optional)' },
        },
      },
    },
  },
  // python_create_venv
  {
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
  // python_install_requirements
  {
    type: 'function' as const,
    function: {
      name: 'python_install_requirements',
      description: 'Install packages inside a specific Python virtual environment.',
      parameters: {
        type: 'object',
        properties: {
          requirementsFile: { type: 'string', description: 'Path to a requirements.txt file (optional)' },
          packages: {
            type: 'array',
            items: { type: 'string' },
            description: 'Optional list of individual packages to install'
          },
          venvPath: { type: 'string', description: 'The virtual environment directory path (default: ".venv")' },
          cwd: { type: 'string', description: 'Working directory (optional)' },
        },
      },
    },
  },
  // python_list_packages
  {
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
  // python_run_file
  {
    type: 'function' as const,
    function: {
      name: 'python_run_file',
      description: 'Execute a Python script using the python interpreter inside a specific virtual environment.',
      parameters: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: 'The path to the python script to run' },
          args: {
            type: 'array',
            items: { type: 'string' },
            description: 'Optional arguments to pass to the script'
          },
          venvPath: { type: 'string', description: 'The virtual environment directory path (default: ".venv")' },
          cwd: { type: 'string', description: 'Working directory (optional)' },
        },
        required: ['filePath'],
      },
    },
  },
  // pip_show_package
  {
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
  // java_compile_and_run
  {
    type: 'function' as const,
    function: {
      name: 'java_compile_and_run',
      description: 'Compile Java source files or run compiled class files.',
      parameters: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: ['compile', 'run'],
            description: 'Action to perform: compile source files, or run main class'
          },
          sourceFiles: {
            type: 'array',
            items: { type: 'string' },
            description: 'Source files to compile (required for compile action)'
          },
          className: { type: 'string', description: 'Class name with main method to execute (required for run action)' },
          classPath: { type: 'string', description: 'Classpath lookup paths, mapped to -cp (optional)' },
          args: {
            type: 'array',
            items: { type: 'string' },
            description: 'Optional command-line arguments to pass to the Java program'
          },
          cwd: { type: 'string', description: 'Working directory (optional)' },
        },
        required: ['action'],
      },
    },
  },
  // java_project_build
  {
    type: 'function' as const,
    function: {
      name: 'java_project_build',
      description: 'Build Maven or Gradle projects.',
      parameters: {
        type: 'object',
        properties: {
          system: {
            type: 'string',
            enum: ['maven', 'gradle'],
            description: 'The project build system tool to run'
          },
          target: { type: 'string', description: 'The target command or task, e.g. "clean install", "build" (optional)' },
          cwd: { type: 'string', description: 'Working directory (optional)' },
        },
        required: ['system'],
      },
    },
  },
  // dotnet_command
  {
    type: 'function' as const,
    function: {
      name: 'dotnet_command',
      description: 'Configure, build, test, and run .NET projects.',
      parameters: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: ['build', 'run', 'test', 'clean', 'restore', 'publish'],
            description: 'The dotnet command action to execute'
          },
          projectPath: { type: 'string', description: 'Path to a .csproj, .sln, or directory (optional)' },
          configuration: {
            type: 'string',
            enum: ['Debug', 'Release'],
            description: 'Build configuration profile (optional)'
          },
          extraArgs: {
            type: 'array',
            items: { type: 'string' },
            description: 'Optional flags or arguments to pass to the command'
          },
          cwd: { type: 'string', description: 'Working directory (optional)' },
        },
        required: ['action'],
      },
    },
  },
  // flutter_command
  {
    type: 'function' as const,
    function: {
      name: 'flutter_command',
      description: 'Fetch dependencies, build, and test Flutter/Dart applications.',
      parameters: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: ['build', 'test', 'pub_get', 'doctor', 'clean'],
            description: 'The flutter action to execute'
          },
          buildTarget: {
            type: 'string',
            enum: ['apk', 'appbundle', 'ios', 'web', 'macos', 'windows', 'linux'],
            description: 'Target compile platform (required for build action)'
          },
          extraArgs: {
            type: 'array',
            items: { type: 'string' },
            description: 'Optional flags or arguments to pass to the command'
          },
          cwd: { type: 'string', description: 'Working directory (optional)' },
        },
        required: ['action'],
      },
    },
  },
  // create_project
  {
    type: 'function' as const,
    function: {
      name: 'create_project',
      description: 'Scaffold a new project in React, Next.js, Flutter, .NET, Java, Maven, ASP.NET, Flask, Django, etc.',
      parameters: {
        type: 'object',
        properties: {
          template: {
            type: 'string',
            enum: [
              'react',
              'nextjs',
              'flutter',
              'dotnet-console',
              'aspnet-webapi',
              'aspnet-mvc',
              'maven-quickstart',
              'gradle-java',
              'flask',
              'django'
            ],
            description: 'The template framework to use for project creation'
          },
          projectName: { type: 'string', description: 'The name of the new project' },
          outputDir: { type: 'string', description: 'Directory where the project should be created (default: cwd)' },
          extraArgs: {
            type: 'array',
            items: { type: 'string' },
            description: 'Optional flags or arguments to pass to the scaffolding command'
          },
          cwd: { type: 'string', description: 'Working directory (optional)' },
        },
        required: ['template', 'projectName'],
      },
    },
  },
  // todowrite
  {
    type: 'function' as const,
    function: {
      name: 'todowrite',
      description: 'Create and maintain a structured task list for the current coding session. Tracks progress, organizes multi-step work, and surfaces status to the user.',
      parameters: {
        type: 'object',
        properties: {
          todos: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                content: { type: 'string', description: 'Brief description of the task' },
                status: { type: 'string', enum: ['pending', 'in_progress', 'completed', 'cancelled'], description: 'Current status' },
                priority: { type: 'string', enum: ['high', 'medium', 'low'], description: 'Priority level' },
              },
              required: ['content', 'status', 'priority'],
            },
            description: 'The updated task list',
          },
        },
        required: ['todos'],
      },
    },
  },
  // task
  {
    type: 'function' as const,
    function: {
      name: 'task',
      description: 'Delegate a task to a specialized subagent. The subagent runs in its own session with restricted permissions and returns a summary.',
      parameters: {
        type: 'object',
        properties: {
          subagent: {
            type: 'string',
            enum: ['explore', 'general'],
            description: 'The subagent type to delegate to',
          },
          prompt: {
            type: 'string',
            description: 'The task description for the subagent to execute',
          },
        },
        required: ['subagent', 'prompt'],
      },
    },
  },
  // semantic_search
  {
    type: 'function' as const,
    function: {
      name: 'semantic_search',
      description: 'Search the codebase using semantic similarity. Finds code that matches the meaning of your query, not just keywords.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'The search query describing what you are looking for',
          },
          topK: {
            type: 'number',
            description: 'Number of results to return (default: 10)',
          },
          rebuild: {
            type: 'boolean',
            description: 'Force rebuild the search index before searching',
          },
        },
        required: ['query'],
      },
    },
  },
  // ssh_command
  {
    type: 'function' as const,
    function: {
      name: 'ssh_command',
      description: 'Run an SSH command on a remote host.',
      parameters: {
        type: 'object',
        properties: {
          destination: { type: 'string', description: 'Remote target, e.g. user@host' },
          command: { type: 'string', description: 'Remote command to execute' },
          pty: { type: 'boolean', description: 'Request pseudo-tty when possible' },
          extraArgs: { type: 'array', items: { type: 'string' }, description: 'Extra SSH flags' },
          timeoutMs: { type: 'integer', description: 'Command timeout in milliseconds' },
          cwd: { type: 'string', description: 'Working directory (optional)' },
        },
        required: ['destination', 'command'],
      },
    },
  },
  // scp_command
  {
    type: 'function' as const,
    function: {
      name: 'scp_command',
      description: 'Copy files or directories over SSH using SCP.',
      parameters: {
        type: 'object',
        properties: {
          source: { type: 'string', description: 'Source path (can be remote)' },
          destination: { type: 'string', description: 'Destination path (can be remote)' },
          recursive: { type: 'boolean', description: 'Recursive directory copy' },
          extraArgs: { type: 'array', items: { type: 'string' }, description: 'Extra SCP flags' },
          cwd: { type: 'string', description: 'Working directory (optional)' },
        },
        required: ['source', 'destination'],
      },
    },
  },
  // ssh_known_hosts
  {
    type: 'function' as const,
    function: {
      name: 'ssh_known_hosts',
      description: 'Inspect or edit SSH known_hosts entries.',
      parameters: {
        type: 'object',
        properties: {
          action: { type: 'string', enum: ['list', 'search', 'remove'] },
          path: { type: 'string', description: 'Explicit known_hosts path' },
          host: { type: 'string', description: 'Host or host:port pattern' },
        },
        required: ['action'],
      },
    },
  },
];
export type ToolDefinition = typeof TOOL_DEFINITIONS[number];