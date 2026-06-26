import fs from 'fs-extra';
import { getCompletionContext } from '../chat/completion.js';

jest.mock('../agents/subagent.js', () => ({
  getSubagentManager: () => ({
    listSubagents: () => ['explore', 'general'],
  }),
}));

describe('completion context', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('returns slash completion range and suggestions', () => {
    const context = getCompletionContext('/per', 4);

    expect(context?.mode).toBe('slash');
    expect(context?.range).toEqual({ start: 0, end: 4 });
    expect(context?.suggestions).toContain('/permissions');
  });

  test('returns friendly auth command suggestions', () => {
    const context = getCompletionContext('/auth set o', '/auth set o'.length);

    expect(context?.mode).toBe('slash');
    expect(context?.suggestions).toContain('/auth set openai');
    expect(context?.suggestions).toContain('/auth set openrouter');
  });

  test('returns mention completion range and file suggestions', () => {
    const entries = [
      { name: 'chat', isDirectory: () => true, isFile: () => false },
      { name: 'config.ts', isDirectory: () => false, isFile: () => true },
    ] as unknown as fs.Dirent[];

    const spy = jest.spyOn(fs, 'readdirSync').mockImplementation((dir: any) => {
      const dirPath = String(dir);
      if (dirPath.endsWith(`${pathSep()}src`)) {
        return entries as any;
      }
      return [] as any;
    });

    const line = 'review @src/ch';
    const context = getCompletionContext(line, line.length);

    expect(context?.mode).toBe('mention');
    expect(context?.range.start).toBe(line.indexOf('@'));
    expect(context?.suggestions).toContain('@src/chat/');

    spy.mockRestore();
  });
});

function pathSep(): string {
  return process.platform === 'win32' ? '\\' : '/';
}
