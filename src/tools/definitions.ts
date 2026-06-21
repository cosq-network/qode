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
          gitArgs: { type: 'string', description: 'Arguments for git, without the "git" prefix' },
          cwd: { type: 'string', description: 'Working directory (optional)' },
        },
        required: ['gitArgs'],
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
];
export type ToolDefinition = typeof TOOL_DEFINITIONS[number];