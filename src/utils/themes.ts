// src/utils/themes.ts
export interface ThemePalette {
  name: string;
  model: string;      // ANSI escape sequence
  dir: string;        // ANSI escape sequence
  context: string;    // ANSI escape sequence
  files: string;      // ANSI escape sequence
  borderChar: string; // Color of the border
}

export const THEMES: Record<string, ThemePalette> = {
  default: {
    name: 'Default (Neon)',
    model: '\x1b[36m',   // Cyan
    dir: '\x1b[33m',     // Yellow
    context: '\x1b[32m', // Green
    files: '\x1b[35m',   // Purple/Magenta
    borderChar: '\x1b[90m', // Dark Gray
  },
  ocean: {
    name: 'Ocean',
    model: '\x1b[34m',   // Blue
    dir: '\x1b[36m',     // Cyan
    context: '\x1b[32m', // Green
    files: '\x1b[96m',   // Light Cyan
    borderChar: '\x1b[34m', // Blue
  },
  monochrome: {
    name: 'Monochrome',
    model: '\x1b[1m',    // Bold
    dir: '\x1b[0m',      // Standard
    context: '\x1b[1m',  // Bold
    files: '\x1b[2m',    // Dim
    borderChar: '\x1b[0m', // Standard
  },
  sunset: {
    name: 'Sunset',
    model: '\x1b[31m',   // Red
    dir: '\x1b[33m',     // Yellow
    context: '\x1b[35m', // Magenta
    files: '\x1b[91m',   // Light Red
    borderChar: '\x1b[33m', // Yellow
  },
  forest: {
    name: 'Forest',
    model: '\x1b[32m',   // Green
    dir: '\x1b[92m',     // Light Green
    context: '\x1b[33m', // Yellow
    files: '\x1b[36m',   // Cyan
    borderChar: '\x1b[32m', // Green
  }
};

export function getTheme(name?: string): ThemePalette {
  if (name && THEMES[name.toLowerCase()]) {
    return THEMES[name.toLowerCase()];
  }
  return THEMES.default;
}
