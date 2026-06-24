export interface ThemePalette {
  name: string;
  model: string;
  dir: string;
  context: string;
  files: string;
  borderChar: string;
  headerBg?: string;
  accent?: string;
  error?: string;
  warn?: string;
  info?: string;
  code?: string;
  dim?: string;
}

export const THEMES: Record<string, ThemePalette> = {
  default: {
    name: 'Default (Tokyo Night)',
    model: '\x1b[38;2;122;162;247m',
    dir: '\x1b[38;2;158;206;106m',
    context: '\x1b[38;2;187;154;247m',
    files: '\x1b[38;2;255;158;100m',
    borderChar: '\x1b[38;2;86;95;137m',
    headerBg: '#1a1b26',
    accent: '\x1b[38;2;122;162;247m',
    error: '\x1b[38;2;247;118;142m',
    warn: '\x1b[38;2;224;175;104m',
    info: '\x1b[38;2;125;207;255m',
    code: '\x1b[38;2;86;95;137m',
    dim: '\x1b[38;2;86;95;137m',
  },
  ocean: {
    name: 'Ocean',
    model: '\x1b[38;2;52;178;201m',
    dir: '\x1b[38;2;128;203;196m',
    context: '\x1b[38;2;179;136;255m',
    files: '\x1b[38;2;240;200;120m',
    borderChar: '\x1b[38;2;68;142;176m',
    headerBg: '#0d1b2a',
    accent: '\x1b[38;2;52;178;201m',
    error: '\x1b[38;2;239;83;80m',
    warn: '\x1b[38;2;255;202;40m',
    info: '\x1b[38;2;79;195;247m',
    code: '\x1b[38;2;68;142;176m',
    dim: '\x1b[38;2;68;142;176m',
  },
  monochrome: {
    name: 'Monochrome',
    model: '\x1b[1;37m',
    dir: '\x1b[37m',
    context: '\x1b[1;37m',
    files: '\x1b[2;37m',
    borderChar: '\x1b[2;37m',
    headerBg: '#1a1a1a',
    accent: '\x1b[1;37m',
    error: '\x1b[1;31m',
    warn: '\x1b[1;33m',
    info: '\x1b[37m',
    code: '\x1b[2;37m',
    dim: '\x1b[2;37m',
  },
  sunset: {
    name: 'Sunset',
    model: '\x1b[38;2;255;107;107m',
    dir: '\x1b[38;2;250;195;100m',
    context: '\x1b[38;2;200;120;200m',
    files: '\x1b[38;2;255;160;60m',
    borderChar: '\x1b[38;2;180;100;50m',
    headerBg: '#1a0f0a',
    accent: '\x1b[38;2;255;160;60m',
    error: '\x1b[38;2;255;80;80m',
    warn: '\x1b[38;2;255;200;50m',
    info: '\x1b[38;2;255;180;100m',
    code: '\x1b[38;2;140;90;60m',
    dim: '\x1b[38;2;140;90;60m',
  },
  forest: {
    name: 'Forest',
    model: '\x1b[38;2;130;200;130m',
    dir: '\x1b[38;2;100;180;100m',
    context: '\x1b[38;2;200;180;100m',
    files: '\x1b[38;2;100;200;200m',
    borderChar: '\x1b[38;2;80;130;80m',
    headerBg: '#0d1f0d',
    accent: '\x1b[38;2;130;200;130m',
    error: '\x1b[38;2;220;80;80m',
    warn: '\x1b[38;2;200;180;80m',
    info: '\x1b[38;2;100;200;200m',
    code: '\x1b[38;2;80;130;80m',
    dim: '\x1b[38;2;80;130;80m',
  },
  catppuccin: {
    name: 'Catppuccin Mocha',
    model: '\x1b[38;2;137;180;250m',
    dir: '\x1b[38;2;166;227;161m',
    context: '\x1b[38;2;203;166;247m',
    files: '\x1b[38;2;249;226;175m',
    borderChar: '\x1b[38;2;88;91;112m',
    headerBg: '#11111b',
    accent: '\x1b[38;2;137;180;250m',
    error: '\x1b[38;2;210;15;57m',
    warn: '\x1b[38;2;249;226;175m',
    info: '\x1b[38;2;137;220;235m',
    code: '\x1b[38;2;88;91;112m',
    dim: '\x1b[38;2;88;91;112m',
  },
  nord: {
    name: 'Nord',
    model: '\x1b[38;2;136;192;208m',
    dir: '\x1b[38;2;163;190;140m',
    context: '\x1b[38;2;180;142;173m',
    files: '\x1b[38;2;235;203;139m',
    borderChar: '\x1b[38;2;76;86;106m',
    headerBg: '#2e3440',
    accent: '\x1b[38;2;136;192;208m',
    error: '\x1b[38;2;191;97;106m',
    warn: '\x1b[38;2;235;203;139m',
    info: '\x1b[38;2;136;192;208m',
    code: '\x1b[38;2;76;86;106m',
    dim: '\x1b[38;2;76;86;106m',
  },
};

export function getTheme(name?: string): ThemePalette {
  if (name && THEMES[name.toLowerCase()]) {
    return THEMES[name.toLowerCase()];
  }
  return THEMES.default;
}

const isWindows = process.platform === 'win32';
const hasWT = !!process.env.WT_SESSION;
const supportsEmoji = !isWindows || hasWT || process.env.TERM_PROGRAM === 'vscode' || process.env.TERM === 'xterm-256color';

export const ICONS = {
  robot: supportsEmoji ? '◆' : 'AI',
  dir: supportsEmoji ? '📁' : 'DIR',
  file: supportsEmoji ? '📄' : 'FILE',
  chart: supportsEmoji ? '📊' : 'INFO',
  clock: supportsEmoji ? '🕒' : 'TIME',
  keyboard: supportsEmoji ? '⌨' : 'KEYS',
};
