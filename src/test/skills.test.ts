// src/test/skills.test.ts
import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import { parseFrontmatter, loadSkills, matchSkills } from '../utils/skills.js';

jest.mock('fs-extra');
const mockedFs = fs as jest.Mocked<typeof fs>;

describe('Skills system', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('parseFrontmatter', () => {
    test('parses standard frontmatter and body', () => {
      const content = `---
name: React Skill
description: "A skill for React"
tags: [react, jsx, frontend]
---
Hello React!`;
      const result = parseFrontmatter(content);
      expect(result.frontmatter).toEqual({
        name: 'React Skill',
        description: 'A skill for React',
        tags: ['react', 'jsx', 'frontend'],
      });
      expect(result.body).toBe('Hello React!');
    });

    test('returns empty frontmatter if missing delimiter', () => {
      const content = 'No frontmatter here';
      const result = parseFrontmatter(content);
      expect(result.frontmatter).toEqual({});
      expect(result.body).toBe('No frontmatter here');
    });

    test('strips quotes from string values', () => {
      const content = `---
name: 'Single Quotes'
description: "Double Quotes"
---
body content`;
      const result = parseFrontmatter(content);
      expect(result.frontmatter).toEqual({
        name: 'Single Quotes',
        description: 'Double Quotes',
      });
    });
  });

  describe('loadSkills', () => {
    test('loads skills from global and workspace directories', async () => {
      const globalDir = path.join(os.homedir(), '.cosqcode', 'skills');
      const workspaceCwd = '/workspace';
      const localDir = path.join(workspaceCwd, '.agents', 'skills');

      // Mock paths existence
      (mockedFs.pathExists as any).mockImplementation(async (p: string) => {
        return p === globalDir || p === localDir || p.endsWith('SKILL.md');
      });

      // Mock readdir
      (mockedFs.readdir as any).mockImplementation(async (p: string) => {
        if (p === globalDir) {
          return [
            { name: 'global-skill-1', isDirectory: () => true },
          ] as any;
        }
        if (p === localDir) {
          return [
            { name: 'local-skill-1', isDirectory: () => true },
          ] as any;
        }
        return [];
      });

      // Mock readFile
      (mockedFs.readFile as any).mockImplementation(async (p: string) => {
        if (p.includes('global-skill-1')) {
          return `---
name: Global Skill 1
description: "Global helper"
tags: [global, tag1]
---
global instructions`;
        }
        if (p.includes('local-skill-1')) {
          return `---
name: Local Skill 1
description: "Local helper"
tags: [local, tag2]
---
local instructions`;
        }
        throw new Error('Not found');
      });

      const skills = await loadSkills(workspaceCwd);
      expect(skills).toHaveLength(2);
      
      const globalSkill = skills.find(s => s.name === 'Global Skill 1');
      expect(globalSkill).toBeDefined();
      expect(globalSkill?.tags).toEqual(['global', 'tag1']);
      expect(globalSkill?.instructions).toBe('global instructions');

      const localSkill = skills.find(s => s.name === 'Local Skill 1');
      expect(localSkill).toBeDefined();
      expect(localSkill?.tags).toEqual(['local', 'tag2']);
      expect(localSkill?.instructions).toBe('local instructions');
    });

    test('local workspace skill overrides global skill with same name', async () => {
      const globalDir = path.join(os.homedir(), '.cosqcode', 'skills');
      const workspaceCwd = '/workspace';
      const localDir = path.join(workspaceCwd, '.agents', 'skills');

      (mockedFs.pathExists as any).mockImplementation(async () => true);

      (mockedFs.readdir as any).mockImplementation(async (p: string) => {
        if (p === globalDir) {
          return [{ name: 'same-name', isDirectory: () => true }] as any;
        }
        if (p === localDir) {
          return [{ name: 'same-name', isDirectory: () => true }] as any;
        }
        return [];
      });

      (mockedFs.readFile as any).mockImplementation(async (p: string) => {
        if (p.includes('global-skill-same-name') || p.includes(path.join(globalDir, 'same-name'))) {
          return `---
name: Override Me
description: "Global description"
tags: [global]
---
global body`;
        }
        return `---
name: Override Me
description: "Local description"
tags: [local]
---
local body`;
      });

      const skills = await loadSkills(workspaceCwd);
      expect(skills).toHaveLength(1);
      expect(skills[0].description).toBe('Local description');
      expect(skills[0].tags).toEqual(['local']);
      expect(skills[0].instructions).toBe('local body');
    });

    test('ignores files and folders without SKILL.md or with load errors', async () => {
      const workspaceCwd = '/workspace';
      const localDir = path.join(workspaceCwd, '.agents', 'skills');

      (mockedFs.pathExists as any).mockImplementation(async (p: string) => {
        if (p === localDir) return true;
        if (p.includes('valid-skill') && p.endsWith('SKILL.md')) return true;
        return false;
      });

      (mockedFs.readdir as any).mockImplementation(async (p: string) => {
        if (p === localDir) {
          return [
            { name: 'no-skill-md', isDirectory: () => true },
            { name: 'valid-skill', isDirectory: () => true },
            { name: 'error-skill', isDirectory: () => true },
            { name: 'not-a-directory', isDirectory: () => false },
          ] as any;
        }
        return [];
      });

      (mockedFs.readFile as any).mockImplementation(async (p: string) => {
        if (p.includes('valid-skill')) {
          return `---
name: Valid Skill
---
Valid Instructions`;
        }
        throw new Error('Read error');
      });

      const skills = await loadSkills(workspaceCwd);
      expect(skills).toHaveLength(1);
      expect(skills[0].name).toBe('Valid Skill');
    });
  });

  describe('matchSkills', () => {
    const dummySkills = [
      {
        name: 'React and NextJS',
        description: 'Frontend library and framework for web apps',
        tags: ['react', 'nextjs', 'frontend'],
        instructions: 'React instructions',
        path: '/path/react',
      },
      {
        name: 'Python Flask',
        description: 'Backend web API microframework using Python language',
        tags: ['python', 'flask', 'api'],
        instructions: 'Flask instructions',
        path: '/path/flask',
      },
    ];

    test('matches by direct tag word boundary', () => {
      const matched = matchSkills('I want to build a react app', dummySkills);
      expect(matched).toHaveLength(1);
      expect(matched[0].name).toBe('React and NextJS');
    });

    test('matches by name case-insensitively', () => {
      const matched = matchSkills('show me python flask instructions', dummySkills);
      expect(matched).toHaveLength(1);
      expect(matched[0].name).toBe('Python Flask');
    });

    test('matches by description keywords (at least 50% overlap of words >3 chars)', () => {
      // "Backend web API microframework using Python language"
      // Long words: backend, microframework, using, python, language (5 words)
      // Prompt with 3 words matching: backend microframework language
      const matched = matchSkills('backend microframework language', dummySkills);
      expect(matched).toHaveLength(1);
      expect(matched[0].name).toBe('Python Flask');
    });

    test('does not match description if under 50% overlap', () => {
      // Long words: backend, microframework, using, python, language (5 words)
      // Prompt with 1 word matching: backend
      const matched = matchSkills('only backend word', dummySkills);
      expect(matched).toHaveLength(0);
    });

    test('no matches for unrelated prompts', () => {
      const matched = matchSkills('java maven application', dummySkills);
      expect(matched).toHaveLength(0);
    });
  });
});
