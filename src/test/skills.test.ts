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
    test('loads skills from global, workspace, and bundled directories', async () => {
      const globalDir = path.join(os.homedir(), '.qode', 'skills');
      const workspaceCwd = '/workspace';
      const localDir = path.join(workspaceCwd, '.agents', 'skills');
      const bundledDir = path.resolve(__dirname, '..', 'skills');

      (mockedFs.pathExists as any).mockImplementation(async (p: string) => {
        return (
          p === globalDir ||
          p === localDir ||
          p === bundledDir ||
          (p.includes(path.join(bundledDir, 'bundled-skill-1')) && p.endsWith('SKILL.md')) ||
          p.endsWith('SKILL.md')
        );
      });

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
        if (p === bundledDir) {
          return [
            { name: 'bundled-skill-1', isDirectory: () => true },
          ] as any;
        }
        return [];
      });

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
        if (p.includes('bundled-skill-1')) {
          return `---
name: Bundled Skill 1
description: "Bundled helper"
tags: [bundled, tag3]
---
bundled instructions`;
        }
        throw new Error('Not found');
      });

      const skills = await loadSkills(workspaceCwd);
      expect(skills).toHaveLength(3);
      
      const globalSkill = skills.find(s => s.name === 'Global Skill 1');
      expect(globalSkill).toBeDefined();
      expect(globalSkill?.tags).toEqual(['global', 'tag1']);
      expect(globalSkill?.instructions).toBe('global instructions');

      const bundledSkill = skills.find(s => s.name === 'Bundled Skill 1');
      expect(bundledSkill).toBeDefined();
      expect(bundledSkill?.tags).toEqual(['bundled', 'tag3']);
      expect(bundledSkill?.instructions).toBe('bundled instructions');
    });

    test('bundled skills are available even without global or workspace skills', async () => {
      const workspaceCwd = '/empty-workspace';
      const bundledDir = path.resolve(__dirname, '..', 'skills');

      (mockedFs.pathExists as any).mockImplementation(async (p: string) => {
        if (p === bundledDir) return true;
        if (p.includes('bundled-skill-1') && p.endsWith('SKILL.md')) return true;
        return false;
      });

      (mockedFs.readdir as any).mockImplementation(async (p: string) => {
        if (p === bundledDir || p.includes(bundledDir)) {
          return [
            { name: 'bundled-skill-1', isDirectory: () => true },
          ] as any;
        }
        return [];
      });

      (mockedFs.readFile as any).mockImplementation(async (p: string) => {
        if (p.includes('bundled-skill-1')) {
          return `---
name: Bundled Default Skill
description: "Bundled default helper"
tags: [bundled, default]
---
bundled default instructions`;
        }
        throw new Error('Not found');
      });

      const skills = await loadSkills(workspaceCwd);
      expect(skills).toHaveLength(1);
      expect(skills[0].name).toBe('Bundled Default Skill');
      expect(skills[0].description).toBe('Bundled default helper');
    });

    test('returns empty array when no skill directories exist', async () => {
      (mockedFs.pathExists as any).mockImplementation(async () => false);

      const skills = await loadSkills('/empty-workspace');
      expect(skills).toHaveLength(0);
    });

    test('ignores files and folders without SKILL.md or with load errors', async () => {
      const workspaceCwd = '/workspace';
      const bundledDir = path.join('/bundled', 'skills');
      const localDir = path.join(workspaceCwd, '.agents', 'skills');

      (mockedFs.pathExists as any).mockImplementation(async (p: string) => {
        if (p === localDir || p === bundledDir) return true;
        if (p.includes('valid-skill') && p.endsWith('SKILL.md')) return true;
        return false;
      });

      (mockedFs.readdir as any).mockImplementation(async (p: string) => {
        if (p === localDir || p === bundledDir) {
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

    test('workspace skills override global and bundled skills with the same name', async () => {
      const globalDir = path.join(os.homedir(), '.qode', 'skills');
      const workspaceCwd = '/workspace';
      const localDir = path.join(workspaceCwd, '.agents', 'skills');
      const bundledDir = path.resolve(__dirname, '..', 'skills');

      (mockedFs.pathExists as any).mockImplementation(async (p: string) => {
        return p === globalDir || p === localDir || p === bundledDir || p.endsWith('SKILL.md');
      });

      (mockedFs.readdir as any).mockImplementation(async (p: string) => {
        if (p === globalDir || p === localDir || p === bundledDir) {
          return [{ name: 'shared-skill', isDirectory: () => true }] as any;
        }
        return [];
      });

      (mockedFs.readFile as any).mockImplementation(async (p: string) => {
        if (p.startsWith(localDir)) {
          return `---
name: Shared Skill
---
workspace instructions`;
        }
        if (p.startsWith(globalDir)) {
          return `---
name: Shared Skill
---
global instructions`;
        }
        if (p.startsWith(bundledDir)) {
          return `---
name: Shared Skill
---
bundled instructions`;
        }
        throw new Error('Not found');
      });

      const skills = await loadSkills(workspaceCwd);
      expect(skills).toHaveLength(1);
      expect(skills[0].instructions).toBe('workspace instructions');
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
      {
        name: 'Git Workflows',
        description: 'Git workflow skill covering clone, checkout, merge, tag, diff, cherry-pick, and log.',
        tags: ['git', 'version-control', 'workflows'],
        instructions: 'Git instructions',
        path: '/path/git-workflows',
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
