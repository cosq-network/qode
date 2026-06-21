// src/utils/logger.ts
// Simple logger utility for consistent timestamped logs
export const logger = {
  info: (msg: string) => console.log(msg),
  error: (msg: string) => console.error(`\x1b[31mError:\x1b[0m ${msg}`),
  debug: (_msg: string) => {
    // Uncomment for debug output
    // console.debug(_msg);
  },
};
