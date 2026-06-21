// src/test/registry.test.ts
import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import { fetchRegistry, searchRegistry, installSkill, DEFAULT_REGISTRY_URL } from '../utils/registry.js';

jest.mock('fs-extra');
const mockedFs = fs as jest.Mocked<typeof fs>;

describe('Skills Registry', () => {
  let originalFetch: typeof global.fetch;
  const mockFetch = jest.fn();

  beforeAll(() => {
    originalFetch = global.fetch;
    global.fetch = mockFetch as any;
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const dummyRegistry = {
    skills: [
      {
        name: 'React Testing',
        description: 'Guidance on writing Jest tests for React',
        tags: ['react', 'testing', 'jest'],
        url: 'https://example.com/skills/react-testing.md',
      },
      {
        name: 'Python Lint',
        description: 'PEP8 linting instructions',
        tags: ['python', 'pep8', 'lint'],
        url: 'https://example.com/skills/python-lint.md',
      },
    ],
  };

  describe('fetchRegistry', () => {
    test('fetches registry successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => dummyRegistry,
      });

      const result = await fetchRegistry();
      expect(mockFetch).toHaveBeenCalledWith(DEFAULT_REGISTRY_URL);
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('React Testing');
    });

    test('handles non-ok HTTP status', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const result = await fetchRegistry();
      expect(result).toEqual([]);
    });

    test('handles fetch exceptions', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network failure'));

      const result = await fetchRegistry();
      expect(result).toEqual([]);
    });

    test('falls back to cache if fetch fails and cache exists', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network failure'));
      mockedFs.pathExists.mockResolvedValueOnce(true as never);
      mockedFs.readJson.mockResolvedValueOnce(dummyRegistry.skills as never);

      const result = await fetchRegistry();
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('React Testing');
      expect(mockedFs.readJson).toHaveBeenCalled();
    });
  });

  describe('searchRegistry', () => {
    beforeEach(() => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => dummyRegistry,
      });
    });

    test('filters by name', async () => {
      const results = await searchRegistry('python');
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Python Lint');
    });

    test('filters by description', async () => {
      const results = await searchRegistry('jest');
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('React Testing');
    });

    test('filters by tag', async () => {
      const results = await searchRegistry('pep8');
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Python Lint');
    });

    test('returns empty if query does not match', async () => {
      const results = await searchRegistry('invalid-query');
      expect(results).toHaveLength(0);
    });
  });

  describe('installSkill', () => {
    test('downloads and saves skill to workspace directory', async () => {
      // 1st fetch: registry
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => dummyRegistry,
      });
      // 2nd fetch: skill MD content
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => '# React Testing Skill Instructions',
      });

      const workspaceCwd = '/my-workspace';
      const success = await installSkill('React Testing', workspaceCwd, false);
      expect(success).toBe(true);

      const targetPath = path.join(workspaceCwd, '.agents', 'skills', 'react testing', 'SKILL.md');
      expect(mockedFs.ensureDir).toHaveBeenCalledWith(path.dirname(targetPath));
      expect(mockedFs.writeFile).toHaveBeenCalledWith(targetPath, '# React Testing Skill Instructions', 'utf8');
    });

    test('downloads and saves skill to global directory when global is true', async () => {
      // 1st fetch: registry
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => dummyRegistry,
      });
      // 2nd fetch: skill MD content
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => '# Python Lint Instructions',
      });

      const workspaceCwd = '/my-workspace';
      const success = await installSkill('Python Lint', workspaceCwd, true);
      expect(success).toBe(true);

      const globalPath = path.join(os.homedir(), '.cosqcode', 'skills', 'python lint', 'SKILL.md');
      expect(mockedFs.ensureDir).toHaveBeenCalledWith(path.dirname(globalPath));
      expect(mockedFs.writeFile).toHaveBeenCalledWith(globalPath, '# Python Lint Instructions', 'utf8');
    });

    test('returns false if skill not in registry', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => dummyRegistry,
      });

      const success = await installSkill('Unknown Skill', '/workspace');
      expect(success).toBe(false);
      expect(mockedFs.writeFile).not.toHaveBeenCalled();
    });

    test('returns false if skill download fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => dummyRegistry,
      });
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      const success = await installSkill('React Testing', '/workspace');
      expect(success).toBe(false);
      expect(mockedFs.writeFile).not.toHaveBeenCalled();
    });
  });
});
