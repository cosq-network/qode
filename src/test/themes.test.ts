// src/test/themes.test.ts
import { getTheme, THEMES, ICONS } from '../utils/themes.js';

describe('Themes system', () => {
  test('returns default theme when name is missing or invalid', () => {
    const defaultTheme = getTheme();
    expect(defaultTheme.name).toBe('Default (Neon)');

    const invalidTheme = getTheme('non-existent-theme');
    expect(invalidTheme.name).toBe('Default (Neon)');
  });

  test('returns matching theme case-insensitively', () => {
    const oceanTheme = getTheme('OCEAN');
    expect(oceanTheme.name).toBe('Ocean');
    expect(oceanTheme.model).toBe('\x1b[34m');

    const monochromeTheme = getTheme('monochrome');
    expect(monochromeTheme.name).toBe('Monochrome');
    expect(monochromeTheme.borderChar).toBe('\x1b[0m');
  });

  test('contains all expected themes in THEMES', () => {
    expect(THEMES.default).toBeDefined();
    expect(THEMES.ocean).toBeDefined();
    expect(THEMES.monochrome).toBeDefined();
    expect(THEMES.sunset).toBeDefined();
    expect(THEMES.forest).toBeDefined();
  });

  test('defines ICONS with standard emoji or ASCII fallback strings', () => {
    expect(ICONS).toBeDefined();
    expect(ICONS.robot).toBeDefined();
    expect(ICONS.dir).toBeDefined();
    expect(ICONS.file).toBeDefined();
    expect(ICONS.chart).toBeDefined();
    expect(ICONS.clock).toBeDefined();
    expect(ICONS.keyboard).toBeDefined();
  });
});
