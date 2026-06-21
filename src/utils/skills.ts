// src/utils/skills.ts
import fs from 'fs-extra';
import path from 'path';
import os from 'os';

export interface Skill {
  name: string;
  description: string;
  tags: string[];
  instructions: string;
  path: string;
}

export function parseFrontmatter(content: string): {
  frontmatter: Record<string, any>;
  body: string;
} {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) {
    return { frontmatter: {}, body: content };
  }
  const yamlContent = match[1];
  const body = match[2];
  const frontmatter: Record<string, any> = {};
  
  yamlContent.split('\n').forEach(line => {
    const colonIndex = line.indexOf(':');
    if (colonIndex > 0) {
      const key = line.slice(0, colonIndex).trim();
      let value = line.slice(colonIndex + 1).trim();
      
      // Parse array syntax like [tag1, tag2]
      if (value.startsWith('[') && value.endsWith(']')) {
        frontmatter[key] = value.slice(1, -1).split(',').map(s => s.trim()).filter(Boolean);
      } else {
        // Strip optional surrounding quotes
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        frontmatter[key] = value;
      }
    }
  });
  
  return { frontmatter, body };
}

export async function loadSkills(workspaceCwd: string): Promise<Skill[]> {
  const skills: Skill[] = [];
  const globalSkillsDir = path.join(os.homedir(), '.qode', 'skills');
  const workspaceSkillsDir = path.join(workspaceCwd, '.agents', 'skills');
  
  const scanDir = async (dir: string) => {
    if (!(await fs.pathExists(dir))) return;
    const items = await fs.readdir(dir, { withFileTypes: true });
    for (const item of items) {
      if (item.isDirectory()) {
        const skillPath = path.join(dir, item.name);
        const skillMdPath = path.join(skillPath, 'SKILL.md');
        if (await fs.pathExists(skillMdPath)) {
          try {
            const rawContent = await fs.readFile(skillMdPath, 'utf8');
            const { frontmatter, body } = parseFrontmatter(rawContent);
            const name = frontmatter.name || item.name;
            const description = frontmatter.description || '';
            const tags = Array.isArray(frontmatter.tags) ? frontmatter.tags : [];
            skills.push({
              name,
              description,
              tags: tags.map((t: string) => t.toLowerCase()),
              instructions: body.trim(),
              path: skillPath,
            });
          } catch {
            // Skip invalid skills
          }
        }
      }
    }
  };
  
  await scanDir(globalSkillsDir);
  await scanDir(workspaceSkillsDir);
  
  // Return unique skills by name (workspace overrides global)
  const uniqueSkills: Record<string, Skill> = {};
  skills.forEach(skill => {
    uniqueSkills[skill.name.toLowerCase()] = skill;
  });
  return Object.values(uniqueSkills);
}

export function matchSkills(prompt: string, skills: Skill[]): Skill[] {
  const normalizedPrompt = prompt.toLowerCase();
  return skills.filter(skill => {
    // 1. Direct tag match (e.g. word boundary checks on tags)
    const hasTagMatch = skill.tags.some(tag => {
      const regex = new RegExp(`\\b${escapeRegExp(tag)}\\b`, 'i');
      return regex.test(normalizedPrompt);
    });
    if (hasTagMatch) return true;
    
    // 2. Name match
    const nameRegex = new RegExp(`\\b${escapeRegExp(skill.name.toLowerCase())}\\b`, 'i');
    if (nameRegex.test(normalizedPrompt)) return true;
    
    // 3. Keyword descriptions match (if at least 50% of the long words in description are found in prompt)
    const words = skill.description.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    if (words.length > 0) {
      const descriptionMatchCount = words.filter(word => normalizedPrompt.includes(word)).length;
      if (descriptionMatchCount / words.length >= 0.5) return true;
    }
    
    return false;
  });
}

function escapeRegExp(str: string) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
