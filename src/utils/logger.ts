import chalk from 'chalk';
import { emitLog, hasOutputSink } from './output.js';

type LogLevel = 'error' | 'info' | 'debug';
const levelOrder: Record<LogLevel, number> = { error: 0, info: 1, debug: 2 };

function currentLevel(): LogLevel {
  const lvl = (globalThis as any).LOG_LEVEL as LogLevel | undefined;
  return lvl && lvl in levelOrder ? lvl : 'info';
}

function shouldLog(level: LogLevel): boolean {
  return levelOrder[level] <= levelOrder[currentLevel()];
}

// In TUI mode (when output sink is active), only use emitLog to send to transcript box
// Don't also write to console to avoid duplicate output
function isTuiMode(): boolean {
  return hasOutputSink();
}

export const logger = {
  info: (msg: string) => {
    if (!shouldLog('info')) return;
    emitLog({ kind: 'log', level: 'info', message: msg });
    // Only write to console if not in TUI mode (no output sink)
    if (!isTuiMode()) {
      if ((globalThis as any).JSON_OUTPUT) {
        console.log(JSON.stringify({ type: 'info', message: msg }));
      } else {
        console.log(chalk.green(msg));
      }
    }
  },
  error: (msg: string) => {
    if (!shouldLog('error')) return;
    emitLog({ kind: 'log', level: 'error', message: msg });
    if (!isTuiMode()) {
      if ((globalThis as any).JSON_OUTPUT) {
        console.log(JSON.stringify({ type: 'error', message: msg }));
      } else {
        console.log(chalk.red(`Error: ${msg}`));
      }
    }
  },
  warn: (msg: string) => {
    emitLog({ kind: 'log', level: 'warn', message: msg });
    if (!isTuiMode()) {
      if ((globalThis as any).JSON_OUTPUT) {
        console.log(JSON.stringify({ type: 'warn', message: msg }));
      } else {
        console.log(chalk.yellow(`Warning: ${msg}`));
      }
    }
  },
  debug: (msg: string) => {
    if (!shouldLog('debug')) return;
    emitLog({ kind: 'log', level: 'debug', message: msg });
    if (!isTuiMode()) {
      if ((globalThis as any).JSON_OUTPUT) {
        console.debug(JSON.stringify({ type: 'debug', message: msg }));
      } else {
        console.debug(chalk.gray(msg));
      }
    }
  },
};
