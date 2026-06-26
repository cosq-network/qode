import { computeInputCursorColumn, computeInputWindowStart } from '../chat/terminal-ui.js';

describe('terminal UI input helpers', () => {
  test('keeps short input anchored at the start', () => {
    expect(computeInputWindowStart(8, 4, 20)).toBe(0);
    expect(computeInputCursorColumn('hello', 5, 0)).toBe(8);
  });

  test('scrolls long input around the cursor', () => {
    const line = 'abcdefghijklmnopqrstuvwxyz';
    const start = computeInputWindowStart(line.length, 24, 10);

    expect(start).toBeGreaterThan(0);
    expect(computeInputCursorColumn(line, 24, start)).toBeLessThanOrEqual(13);
  });

  test('accounts for ghost text when calculating the visible window', () => {
    const line = 'abcdefghijklmnopqrstuvwxyz';
    const withoutGhost = computeInputWindowStart(line.length, 20, 12, 0);
    const withGhost = computeInputWindowStart(line.length, 20, 12, 5);

    expect(withGhost).toBeGreaterThanOrEqual(withoutGhost);
  });
});
