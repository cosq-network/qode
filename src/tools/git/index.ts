import { runGit } from '../helpers.js';
import { globalRegistry } from '../registry.js';
import type { RegisteredTool } from '../registry.js';

const gitCommand: RegisteredTool = {
  definition: {
    type: 'function' as const,
    function: {
      name: 'git_command',
      description: 'Run a git command (e.g., "status", "diff", "log --oneline").',
      parameters: {
        type: 'object',
        properties: {
          gitArgs: {
            type: 'string',
            description: 'Arguments for git, without the "git" prefix',
          },
          cwd: { type: 'string', description: 'Working directory (optional)' },
        },
        required: ['gitArgs'],
      },
    },
  },
  metadata: { category: 'git', permissionKey: 'bash' },
  execute: async (args) => {
    const { gitArgs, cwd: wd } = args;
    if (!gitArgs) return { output: '', error: 'gitArgs required (e.g., "status", "log --oneline").' };
    const result = await runGit((gitArgs as string).split(/\s+/), wd as string | undefined);
    if (result.startsWith('Git error:')) return { output: '', error: result.slice(10) };
    return { output: result };
  },
};

const gitStatus: RegisteredTool = {
  definition: {
    type: 'function' as const,
    function: {
      name: 'git_status',
      description:
        'Get a clean, structured status of the repository (modified, untracked, deleted files).',
      parameters: {
        type: 'object',
        properties: {
          cwd: { type: 'string', description: 'Working directory (optional)' },
        },
      },
    },
  },
  metadata: { category: 'git', permissionKey: 'bash' },
  execute: async (args) => {
    const result = await runGit(['status'], args.cwd as string | undefined);
    if (result.startsWith('Git error:')) return { output: '', error: result.slice(10) };
    return { output: result };
  },
};

const gitDiff: RegisteredTool = {
  definition: {
    type: 'function' as const,
    function: {
      name: 'git_diff',
      description:
        'Retrieve the diff of unstaged changes (or changes between commits/branches).',
      parameters: {
        type: 'object',
        properties: {
          filePath: {
            type: 'string',
            description: 'Limit diff to a specific file (optional)',
          },
          staged: {
            type: 'boolean',
            description: 'Show staged changes instead (optional)',
          },
          compareWith: {
            type: 'string',
            description:
              'Compare with a specific commit or branch, e.g., HEAD~1 or main (optional)',
          },
          cwd: { type: 'string', description: 'Working directory (optional)' },
        },
      },
    },
  },
  metadata: { category: 'git', permissionKey: 'bash' },
  execute: async (args) => {
    const { staged, compareWith, filePath, cwd: wd } = args;
    const gitArgs = ['diff'];
    if (staged) gitArgs.push('--cached');
    if (compareWith) gitArgs.push(compareWith as string);
    if (filePath) gitArgs.push('--', filePath as string);
    const result = await runGit(gitArgs, wd as string | undefined);
    if (result.startsWith('Git error:')) return { output: '', error: result.slice(10) };
    return { output: result };
  },
};

const gitLog: RegisteredTool = {
  definition: {
    type: 'function' as const,
    function: {
      name: 'git_log',
      description: 'Retrieve the commit history.',
      parameters: {
        type: 'object',
        properties: {
          limit: {
            type: 'integer',
            description: 'Maximum number of commits to return (default: 10)',
          },
          filePath: {
            type: 'string',
            description: 'Filter commits affecting a specific file (optional)',
          },
          cwd: { type: 'string', description: 'Working directory (optional)' },
        },
      },
    },
  },
  metadata: { category: 'git', permissionKey: 'bash' },
  execute: async (args) => {
    const { limit, filePath, cwd: wd } = args;
    const count = limit !== undefined ? (limit as number) : 10;
    const gitArgs = ['log', `-${count}`, '--oneline'];
    if (filePath) gitArgs.push('--', filePath as string);
    const result = await runGit(gitArgs, wd as string | undefined);
    if (result.startsWith('Git error:')) return { output: '', error: result.slice(10) };
    return { output: result };
  },
};

const gitBlame: RegisteredTool = {
  definition: {
    type: 'function' as const,
    function: {
      name: 'git_blame',
      description: 'Show commit hash, author, and date for each line of a file.',
      parameters: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: 'The file path to blame' },
          startLine: {
            type: 'integer',
            description: 'Start line number (optional, 1-indexed)',
          },
          endLine: {
            type: 'integer',
            description: 'End line number (optional, 1-indexed)',
          },
          cwd: { type: 'string', description: 'Working directory (optional)' },
        },
        required: ['filePath'],
      },
    },
  },
  metadata: { category: 'git', permissionKey: 'bash' },
  execute: async (args) => {
    const { filePath, startLine, endLine, cwd: wd } = args;
    if (!filePath) return { output: '', error: 'filePath is required for git_blame.' };
    const gitArgs = ['blame'];
    if (startLine !== undefined && endLine !== undefined) {
      gitArgs.push('-L', `${startLine},${endLine}`);
    } else if (startLine !== undefined) {
      gitArgs.push('-L', `${startLine},`);
    }
    gitArgs.push(filePath as string);
    const result = await runGit(gitArgs, wd as string | undefined);
    if (result.startsWith('Git error:')) return { output: '', error: result.slice(10) };
    return { output: result };
  },
};

const gitDiscardChanges: RegisteredTool = {
  definition: {
    type: 'function' as const,
    function: {
      name: 'git_discard_changes',
      description:
        'Discard unstaged changes in one or more files, or the entire repository.',
      parameters: {
        type: 'object',
        properties: {
          paths: {
            type: 'array',
            items: { type: 'string' },
            description:
              'Paths of files to restore to their last committed state',
          },
          discardAllUnstaged: {
            type: 'boolean',
            description:
              'Discard all unstaged changes in the repository (default: false)',
          },
          cwd: { type: 'string', description: 'Working directory (optional)' },
        },
      },
    },
  },
  metadata: { category: 'git', permissionKey: 'bash', requiresConfirmation: true },
  execute: async (args) => {
    const { paths, discardAllUnstaged, cwd: wd } = args;
    if (discardAllUnstaged) {
      const result = await runGit(['restore', '.'], wd as string | undefined);
      if (result.startsWith('Git error:')) return { output: '', error: result.slice(10) };
      return { output: result };
    } else if (paths && (paths as string[]).length > 0) {
      const result = await runGit(['restore', ...(paths as string[])], wd as string | undefined);
      if (result.startsWith('Git error:')) return { output: '', error: result.slice(10) };
      return { output: result };
    } else {
      return { output: '', error: 'either paths or discardAllUnstaged must be specified.' };
    }
  },
};

const gitManageBranch: RegisteredTool = {
  definition: {
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
            description:
              'Action to perform: list, create, checkout, or delete',
          },
          branchName: {
            type: 'string',
            description:
              'Name of the branch to create, switch to, or delete (optional)',
          },
          baseBranch: {
            type: 'string',
            description: 'Start point branch if creating a new branch (optional)',
          },
          cwd: { type: 'string', description: 'Working directory (optional)' },
        },
        required: ['action'],
      },
    },
  },
  metadata: { category: 'git', permissionKey: 'bash' },
  execute: async (args) => {
    const { action, branchName, baseBranch, cwd: wd } = args;
    if (!action) return { output: '', error: 'action is required for git_manage_branch.' };
    if (action === 'list') {
      const result = await runGit(['branch'], wd as string | undefined);
      if (result.startsWith('Git error:')) return { output: '', error: result.slice(10) };
      return { output: result };
    }
    if (!branchName) return { output: '', error: `branchName is required for ${action} action.` };

    if (action === 'create') {
      const gitArgs = ['branch', branchName as string];
      if (baseBranch) gitArgs.push(baseBranch as string);
      const result = await runGit(gitArgs, wd as string | undefined);
      if (result.startsWith('Git error:')) return { output: '', error: result.slice(10) };
      return { output: result };
    }
    if (action === 'checkout') {
      const result = await runGit(['checkout', branchName as string], wd as string | undefined);
      if (result.startsWith('Git error:')) return { output: '', error: result.slice(10) };
      return { output: result };
    }
    if (action === 'delete') {
      const result = await runGit(['branch', '-d', branchName as string], wd as string | undefined);
      if (result.startsWith('Git error:')) return { output: '', error: result.slice(10) };
      return { output: result };
    }
    return { output: '', error: `invalid branch action "${action}".` };
  },
};

const gitCommit: RegisteredTool = {
  definition: {
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
            description:
              'Optional list of files to stage first. If omitted and stageAll is false, commits already-staged files.',
          },
          stageAll: {
            type: 'boolean',
            description:
              'Stage all modified files before committing (default: false)',
          },
          cwd: { type: 'string', description: 'Working directory (optional)' },
        },
        required: ['message'],
      },
    },
  },
  metadata: { category: 'git', permissionKey: 'bash' },
  execute: async (args) => {
    const { message, paths, stageAll, cwd: wd } = args;
    if (!message) return { output: '', error: 'message is required for git_commit.' };

    if (stageAll) {
      const addResult = await runGit(['add', '-A'], wd as string | undefined);
      if (addResult.startsWith('Git error:')) return { output: '', error: `Error staging all files: ${addResult}` };
    } else if (paths && (paths as string[]).length > 0) {
      const addResult = await runGit(['add', ...(paths as string[])], wd as string | undefined);
      if (addResult.startsWith('Git error:')) return { output: '', error: `Error staging paths: ${addResult}` };
    }

    const result = await runGit(['commit', '-m', message as string], wd as string | undefined);
    if (result.startsWith('Git error:')) return { output: '', error: result.slice(10) };
    return { output: result };
  },
};

/** Register all git tools. */
export function registerGitTools(): void {
  globalRegistry.register(gitCommand);
  globalRegistry.register(gitStatus);
  globalRegistry.register(gitDiff);
  globalRegistry.register(gitLog);
  globalRegistry.register(gitBlame);
  globalRegistry.register(gitDiscardChanges);
  globalRegistry.register(gitManageBranch);
  globalRegistry.register(gitCommit);
}
