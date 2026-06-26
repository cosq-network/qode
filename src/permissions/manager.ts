import { isCancel, select } from '@clack/prompts';
import { globalRegistry } from '../tools/index.js';
import type { PermissionLevel, PermissionRules } from '../config.js';

/**
 * PermissionManager evaluates whether a tool call is allowed, denied,
 * or requires user confirmation. It supports:
 *   - Tool-specific rules (e.g. "shell_exec": "ask")
 *   - Category rules (e.g. "edit": "deny" applies to all tools with permissionKey "edit")
 *   - Wildcard rules (e.g. "*": "allow")
 *   - Session-level overrides (allow-all / deny-all during a session)
 *   - Named permission modes (plan, build, explore)
 */
export class PermissionManager {
  private globalRules: PermissionRules;
  private sessionOverrides: Map<string, PermissionLevel> = new Map();
  private sessionBypass = false;

  constructor(globalRules?: PermissionRules) {
    this.globalRules = globalRules ?? {};
  }

  /**
   * Evaluate the effective permission for a tool.
   * Priority: session override > tool-specific > category > wildcard > default (allow).
   */
  getEffectivePermission(toolName: string): PermissionLevel {
    // 1. Session bypass
    if (this.sessionBypass) return 'allow';

    // 2. Session override (exact tool name)
    if (this.sessionOverrides.has(toolName)) {
      return this.sessionOverrides.get(toolName)!;
    }

    // 3. Tool-specific rule (exact match)
    if (this.globalRules[toolName] !== undefined) {
      return this.globalRules[toolName];
    }

    // 4. Tools marked confirmation-required ask by default unless explicitly allowed.
    if (globalRegistry.requiresConfirmation(toolName)) {
      return 'ask';
    }

    // 5. Category rule (via registry permissionKey)
    const permissionKey = globalRegistry.getPermissionKey(toolName);
    if (permissionKey && this.globalRules[permissionKey] !== undefined) {
      return this.globalRules[permissionKey];
    }

    // 6. Wildcard rule
    if (this.globalRules['*'] !== undefined) {
      return this.globalRules['*'];
    }

    // 7. Default: allow
    return 'allow';
  }

  /**
   * Check permission for a tool call. Returns 'allow' or 'deny'.
   * If 'ask', prompts the user and returns based on their response.
   */
  async checkPermission(
    toolName: string,
    args: Record<string, unknown>,
  ): Promise<'allow' | 'deny'> {
    const level = this.getEffectivePermission(toolName);

    if (level === 'allow') return 'allow';
    if (level === 'deny') return 'deny';

    // 'ask' — prompt the user
    return this.promptUser(toolName, args);
  }

  /** Set a session-level override for a specific tool. */
  setSessionOverride(toolName: string, level: PermissionLevel): void {
    this.sessionOverrides.set(toolName, level);
  }

  /** Remove a session-level override for a specific tool. */
  clearSessionOverride(toolName: string): void {
    this.sessionOverrides.delete(toolName);
  }

  /** Enable session bypass — all tools allowed until session ends. */
  enableBypass(): void {
    this.sessionBypass = true;
  }

  /** Disable session bypass. */
  disableBypass(): void {
    this.sessionBypass = false;
  }

  /** Check if session bypass is active. */
  isBypassActive(): boolean {
    return this.sessionBypass;
  }

  /** Get all current session overrides. */
  getSessionOverrides(): Map<string, PermissionLevel> {
    return new Map(this.sessionOverrides);
  }

  /** Clear all session overrides and bypass. */
  resetSession(): void {
    this.sessionOverrides.clear();
    this.sessionBypass = false;
  }

  /** Load a named permission mode from the provided modes map. */
  loadMode(modeName: string, modes?: Record<string, PermissionRules>): boolean {
    if (!modes || !modes[modeName]) return false;
    this.sessionOverrides.clear();
    this.sessionBypass = false;
    const modeRules = modes[modeName];
    for (const [key, level] of Object.entries(modeRules)) {
      this.sessionOverrides.set(key, level);
    }
    return true;
  }

  /** Summarize current effective permissions for all registered tools. */
  summarize(): Array<{ tool: string; permission: PermissionLevel }> {
    const toolNames = globalRegistry.getDefinitions().map((d) => d.function.name);
    const seen = new Set<string>();
    const result: Array<{ tool: string; permission: PermissionLevel }> = [];

    for (const name of toolNames) {
      if (seen.has(name)) continue;
      seen.add(name);
      result.push({ tool: name, permission: this.getEffectivePermission(name) });
    }

    return result;
  }

  /**
   * Prompt the user for permission.
   * Shows tool name + truncated args summary.
   */
  private async promptUser(
    toolName: string,
    args: Record<string, unknown>,
  ): Promise<'allow' | 'deny'> {
    const argsSummary = this.summarizeArgs(args);

    const choices = [
      { label: 'Allow', value: 'allow' as const },
      { label: 'Deny', value: 'deny' as const },
      { label: 'Allow for session', value: 'allow_session' as const },
    ];

    try {
      const decision = await select({
        message: `Allow tool "${toolName}"?${argsSummary ? `\n  Args: ${argsSummary}` : ''}`,
        options: choices,
      });

      if (isCancel(decision)) {
        return 'deny';
      }

      if (decision === 'allow_session') {
        this.sessionOverrides.set(toolName, 'allow');
        return 'allow';
      }

      return decision === 'allow' ? 'allow' : 'deny';
    } catch {
      // If prompt fails (e.g. non-interactive), deny by default
      return 'deny';
    }
  }

  /** Create a short summary of tool args for the permission prompt. */
  private summarizeArgs(args: Record<string, unknown>): string {
    const entries = Object.entries(args);
    if (entries.length === 0) return '';

    const parts = entries.map(([_key, value]) => {
      const str = typeof value === 'string' ? value : JSON.stringify(value);
      return str.length > 60 ? `${str.slice(0, 57)}...` : str;
    });

    return parts.join(', ');
  }
}
