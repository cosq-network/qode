// src/utils/logger.ts
// Simple logger utility for consistent timestamped logs
export const logger = {
  info: (msg: string) => console.log(`[${new Date().toISOString()}] INFO: ${msg}`),
  error: (msg: string) => console.error(`[${new Date().toISOString()}] ERROR: ${msg}`),
  debug: (msg: string) => {
    // Uncomment for debug output
    // console.debug(`[${new Date().toISOString()}] DEBUG: ${msg}`);
  },
};
