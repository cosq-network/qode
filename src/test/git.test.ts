// src/test/git.test.ts
const { executeToolCall } = require('../tools/exec');
const { execFile } = require('child_process');

// Mock child_process.execFile globally
jest.mock('child_process', () => ({
  execFile: jest.fn((file, args, options, callback) => {
    // Standard mock behavior: return success with args in output
    setImmediate(() => callback(null, `Mocked git output for args: ${args.join(' ')}`, ''));
    return { pid: 123 };
  }),
}));

const execFileMock = execFile as unknown as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('Git Tools', () => {
  it('git_status should execute correctly', async () => {
    const result = await executeToolCall('git_status', {});
    expect(execFileMock).toHaveBeenCalledTimes(1);
    expect(execFileMock.mock.calls[0][0]).toBe('git');
    expect(execFileMock.mock.calls[0][1]).toEqual(['status']);
    expect(result).toBe('Mocked git output for args: status');
  });

  it('git_diff should handle different parameters', async () => {
    // Test unstaged diff
    await executeToolCall('git_diff', {});
    expect(execFileMock.mock.calls[0][1]).toEqual(['diff']);

    jest.clearAllMocks();

    // Test staged/cached diff for specific file and commit
    await executeToolCall('git_diff', {
      staged: true,
      compareWith: 'HEAD~1',
      filePath: 'src/index.ts',
    });
    expect(execFileMock.mock.calls[0][1]).toEqual(['diff', '--cached', 'HEAD~1', '--', 'src/index.ts']);
  });

  it('git_log should format limit and filePath options', async () => {
    await executeToolCall('git_log', { limit: 5, filePath: 'package.json' });
    expect(execFileMock.mock.calls[0][1]).toEqual(['log', '-5', '--oneline', '--', 'package.json']);
  });

  it('git_blame should accept file details', async () => {
    await executeToolCall('git_blame', {
      filePath: 'tsconfig.json',
      startLine: 10,
      endLine: 20,
    });
    expect(execFileMock.mock.calls[0][1]).toEqual(['blame', '-L', '10,20', 'tsconfig.json']);
  });

  it('git_discard_changes should restore target paths or all unstaged', async () => {
    await executeToolCall('git_discard_changes', { paths: ['file1.ts', 'file2.ts'] });
    expect(execFileMock.mock.calls[0][1]).toEqual(['restore', 'file1.ts', 'file2.ts']);

    jest.clearAllMocks();

    await executeToolCall('git_discard_changes', { discardAllUnstaged: true });
    expect(execFileMock.mock.calls[0][1]).toEqual(['restore', '.']);
  });

  it('git_manage_branch should execute checkout, create, delete, and list', async () => {
    // List
    await executeToolCall('git_manage_branch', { action: 'list' });
    expect(execFileMock.mock.calls[0][1]).toEqual(['branch']);

    jest.clearAllMocks();

    // Create
    await executeToolCall('git_manage_branch', {
      action: 'create',
      branchName: 'new-feature',
      baseBranch: 'main',
    });
    expect(execFileMock.mock.calls[0][1]).toEqual(['branch', 'new-feature', 'main']);

    jest.clearAllMocks();

    // Checkout
    await executeToolCall('git_manage_branch', {
      action: 'checkout',
      branchName: 'new-feature',
    });
    expect(execFileMock.mock.calls[0][1]).toEqual(['checkout', 'new-feature']);

    jest.clearAllMocks();

    // Delete
    await executeToolCall('git_manage_branch', {
      action: 'delete',
      branchName: 'new-feature',
    });
    expect(execFileMock.mock.calls[0][1]).toEqual(['branch', '-d', 'new-feature']);
  });

  it('git_commit should stage and commit correctly', async () => {
    // Commit with stageAll
    await executeToolCall('git_commit', {
      message: 'feat: add git tools',
      stageAll: true,
    });
    expect(execFileMock).toHaveBeenCalledTimes(2);
    expect(execFileMock.mock.calls[0][1]).toEqual(['add', '-A']);
    expect(execFileMock.mock.calls[1][1]).toEqual(['commit', '-m', 'feat: add git tools']);

    jest.clearAllMocks();

    // Commit specific paths
    await executeToolCall('git_commit', {
      message: 'fix: build script',
      paths: ['package.json'],
    });
    expect(execFileMock).toHaveBeenCalledTimes(2);
    expect(execFileMock.mock.calls[0][1]).toEqual(['add', 'package.json']);
    expect(execFileMock.mock.calls[1][1]).toEqual(['commit', '-m', 'fix: build script']);
  });
});
