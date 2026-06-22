import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger.js';
import type { PermissionRules } from '../config.js';

/** Built-in subagent types. */
export type SubagentType = 'explore' | 'general' | 'custom';

/** Configuration for a subagent. */
export interface SubagentConfig {
  type: SubagentType;
  name: string;
  description: string;
  model?: string;
  permissions: PermissionRules;
  systemPrompt: string;
  maxSteps?: number;
}

/** Status of a subagent execution. */
export type SubagentStatus = 'running' | 'completed' | 'failed';

/** A child session spawned by a subagent. */
export interface ChildSession {
  id: string;
  subagentType: SubagentType;
  subagentName: string;
  status: SubagentStatus;
  prompt: string;
  result?: string;
  error?: string;
  startedAt: string;
  completedAt?: string;
  depth: number;
}

/** Maximum nesting depth for subagents. */
const MAX_DEPTH = 3;

/** Built-in subagent definitions. */
const BUILTIN_SUBAGENTS: Record<string, SubagentConfig> = {
  explore: {
    type: 'explore',
    name: 'explore',
    description: 'Fast, read-only codebase exploration. No edits or shell commands.',
    permissions: {
      file_read: 'allow',
      grep: 'allow',
      glob: 'allow',
      todowrite: 'allow',
      '*': 'deny',
    },
    systemPrompt: `You are an exploration subagent. Your job is to quickly find and analyze code.
You can read files, search code with grep/glob, and use todowrite to track findings.
You CANNOT edit files, run shell commands, or make changes to the codebase.
Be thorough but concise. Return a clear summary of your findings.`,
    maxSteps: 20,
  },
  general: {
    type: 'general',
    name: 'general',
    description: 'Full-access subagent for complex multi-step tasks.',
    permissions: {
      '*': 'allow',
    },
    systemPrompt: `You are a general-purpose subagent with full tool access.
Complete the assigned task thoroughly and return a clear summary of what was done.
Be efficient and focused on the task.`,
    maxSteps: 50,
  },
};

/**
 * Manages subagent lifecycle and child sessions.
 */
export class SubagentManager {
  private childSessions: Map<string, ChildSession> = new Map();
  private customSubagents: Map<string, SubagentConfig> = new Map();

  constructor() {
    // Load built-in subagents
    for (const [name, config] of Object.entries(BUILTIN_SUBAGENTS)) {
      this.customSubagents.set(name, config);
    }
  }

  /** Get a subagent config by name. */
  getSubagent(name: string): SubagentConfig | undefined {
    return this.customSubagents.get(name);
  }

  /** List all available subagent names. */
  listSubagents(): string[] {
    return Array.from(this.customSubagents.keys());
  }

  /** Register a custom subagent. */
  registerSubagent(name: string, config: SubagentConfig): void {
    this.customSubagents.set(name, config);
  }

  /** Create a child session for a subagent task. */
  createChildSession(
    subagentName: string,
    prompt: string,
    parentDepth: number = 0,
  ): ChildSession | null {
    if (parentDepth >= MAX_DEPTH) {
      logger.warn(`Subagent depth limit reached (${MAX_DEPTH}). Cannot spawn "${subagentName}".`);
      return null;
    }

    const config = this.customSubagents.get(subagentName);
    if (!config) {
      logger.warn(`Unknown subagent: ${subagentName}`);
      return null;
    }

    const child: ChildSession = {
      id: uuidv4(),
      subagentType: config.type,
      subagentName,
      status: 'running',
      prompt,
      startedAt: new Date().toISOString(),
      depth: parentDepth + 1,
    };

    this.childSessions.set(child.id, child);
    logger.info(`🔄 Spawned subagent "${subagentName}" (child: ${child.id.slice(0, 8)})`);
    return child;
  }

  /** Mark a child session as completed. */
  completeChildSession(childId: string, result: string): void {
    const child = this.childSessions.get(childId);
    if (child) {
      child.status = 'completed';
      child.result = result;
      child.completedAt = new Date().toISOString();
      logger.info(`✔ Subagent "${child.subagentName}" completed (child: ${childId.slice(0, 8)})`);
    }
  }

  /** Mark a child session as failed. */
  failChildSession(childId: string, error: string): void {
    const child = this.childSessions.get(childId);
    if (child) {
      child.status = 'failed';
      child.error = error;
      child.completedAt = new Date().toISOString();
      logger.error(`✘ Subagent "${child.subagentName}" failed: ${error}`);
    }
  }

  /** Get a child session by ID. */
  getChildSession(childId: string): ChildSession | undefined {
    return this.childSessions.get(childId);
  }

  /** Get all child sessions. */
  getAllChildSessions(): ChildSession[] {
    return Array.from(this.childSessions.values());
  }

  /** Get active (running) child sessions. */
  getActiveChildSessions(): ChildSession[] {
    return this.getAllChildSessions().filter((c) => c.status === 'running');
  }

  /** Get the system prompt for a subagent, including mode info. */
  getSystemPrompt(subagentName: string): string {
    const config = this.customSubagents.get(subagentName);
    return config?.systemPrompt ?? 'You are a helpful assistant.';
  }

  /** Get the permissions for a subagent. */
  getPermissions(subagentName: string): PermissionRules {
    const config = this.customSubagents.get(subagentName);
    return config?.permissions ?? { '*': 'allow' };
  }

  /** Get the max steps for a subagent. */
  getMaxSteps(subagentName: string): number {
    const config = this.customSubagents.get(subagentName);
    return config?.maxSteps ?? 30;
  }

  /** Parse @mentions from user input and return subagent name + cleaned prompt. */
  parseMention(input: string): { subagent: string; prompt: string } | null {
    const match = input.match(/^@(\w+)\s+(.*)/s);
    if (match) {
      const subagent = match[1].toLowerCase();
      if (this.customSubagents.has(subagent)) {
        return { subagent, prompt: match[2] };
      }
    }
    return null;
  }
}

/** Singleton instance. */
let manager: SubagentManager | null = null;

export function getSubagentManager(): SubagentManager {
  if (!manager) {
    manager = new SubagentManager();
  }
  return manager;
}
