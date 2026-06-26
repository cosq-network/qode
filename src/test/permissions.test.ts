import { PermissionManager } from '../permissions/manager.js';
import { initializeTools } from '../tools/index.js';

describe('PermissionManager', () => {
  let manager: PermissionManager;

  beforeEach(() => {
    initializeTools();
    manager = new PermissionManager();
  });

  test('defaults to allow for unknown tools', () => {
    const level = manager.getEffectivePermission('unknown_tool');
    expect(level).toBe('allow');
  });

  test('setSessionOverride sets tool permission', () => {
    manager.setSessionOverride('shell_exec', 'deny');
    expect(manager.getEffectivePermission('shell_exec')).toBe('deny');
  });

  test('session override takes precedence', () => {
    manager.setSessionOverride('shell_exec', 'allow');
    expect(manager.getEffectivePermission('shell_exec')).toBe('allow');
    manager.setSessionOverride('shell_exec', 'deny');
    expect(manager.getEffectivePermission('shell_exec')).toBe('deny');
  });

  test('clearSessionOverride removes override', () => {
    manager.setSessionOverride('shell_exec', 'deny');
    manager.clearSessionOverride('shell_exec');
    // After clearing, should fall back to default (allow)
    expect(manager.getEffectivePermission('shell_exec')).toBe('allow');
  });

  test('enableBypass allows all tools', () => {
    manager.setSessionOverride('shell_exec', 'deny');
    manager.enableBypass();
    expect(manager.getEffectivePermission('shell_exec')).toBe('allow');
    expect(manager.isBypassActive()).toBe(true);
  });

  test('disableBypass restores overrides', () => {
    manager.setSessionOverride('shell_exec', 'deny');
    manager.enableBypass();
    manager.disableBypass();
    expect(manager.getEffectivePermission('shell_exec')).toBe('deny');
    expect(manager.isBypassActive()).toBe(false);
  });

  test('resetSession clears everything', () => {
    manager.setSessionOverride('shell_exec', 'deny');
    manager.enableBypass();
    manager.resetSession();
    expect(manager.isBypassActive()).toBe(false);
    expect(manager.getEffectivePermission('shell_exec')).toBe('allow');
  });

  test('getSessionOverrides returns current overrides', () => {
    manager.setSessionOverride('shell_exec', 'allow');
    manager.setSessionOverride('write_file', 'deny');
    const overrides = manager.getSessionOverrides();
    expect(overrides.get('shell_exec')).toBe('allow');
    expect(overrides.get('write_file')).toBe('deny');
    expect(overrides.size).toBe(2);
  });

  test('getEffectivePermission returns correct level', () => {
    manager.setSessionOverride('shell_exec', 'allow');
    const level = manager.getEffectivePermission('shell_exec');
    expect(level).toBe('allow');
  });

  test('confirmation-required tools ask by default', () => {
    expect(manager.getEffectivePermission('echo_update_shell_env')).toBe('ask');
  });

  test('explicit tool allow overrides confirmation-required default', () => {
    manager = new PermissionManager({ echo_update_shell_env: 'allow', edit: 'deny' });
    expect(manager.getEffectivePermission('echo_update_shell_env')).toBe('allow');
  });
});
