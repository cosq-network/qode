import { PermissionManager } from '../permissions/manager.js';
import { initializeTools, globalRegistry } from '../tools/index.js';

describe('new bundled tools', () => {
  beforeAll(() => {
    initializeTools();
  });

  test('registers Ionic, MSBuild, NPX, QEMU, and echo tools', () => {
    expect(globalRegistry.getNames()).toEqual(expect.arrayContaining([
      'ionic_create_app',
      'ionic_build',
      'ionic_capacitor_run',
      'msbuild_run',
      'npx_run',
      'echo_update_shell_env',
      'qemu_create_vm',
      'qemu_run_vm',
      'qemu_snapshot',
      'qemu_list_vms',
    ]));
  });

  test('uses existing permission categories for new tools', () => {
    const permissionKeys = [
      'ionic_create_app',
      'ionic_build',
      'ionic_capacitor_run',
      'msbuild_run',
      'npx_run',
      'echo_update_shell_env',
      'qemu_create_vm',
      'qemu_run_vm',
      'qemu_snapshot',
      'qemu_list_vms',
    ].map((name) => globalRegistry.getPermissionKey(name));

    expect(permissionKeys).not.toContain('write');
    expect(permissionKeys).toEqual(expect.arrayContaining(['bash', 'edit', 'read']));
  });

  test('explore mode denies filesystem-mutating QEMU tools through edit permission', () => {
    const manager = new PermissionManager({ edit: 'deny', bash: 'deny', read: 'allow', '*': 'allow' });

    expect(manager.getEffectivePermission('qemu_create_vm')).toBe('deny');
    expect(manager.getEffectivePermission('qemu_snapshot')).toBe('deny');
    expect(manager.getEffectivePermission('qemu_list_vms')).toBe('allow');
  });
});
