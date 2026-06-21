// src/utils/spinner.ts

/**
 * Run an async function while displaying a spinner.
 * Lazy loads the 'ora' spinner to avoid ESM import issues under Jest.
 * In test environments a no‑op spinner is used.
 */
export async function runWithSpinner<T>(message: string, fn: () => Promise<T>): Promise<T> {
  let spinner: { succeed: (msg: string) => void; fail: (msg: string) => void };
  if (process.env.NODE_ENV === 'test') {
    // No‑op spinner for tests
    spinner = { succeed: () => {}, fail: () => {} } as any;
  } else {
    // Lazy import of ora
    const oraModule = await import('ora');
    spinner = oraModule.default({ text: message, spinner: 'dots' }).start();
  }
  try {
    const result = await fn();
    spinner.succeed(`${message} – done`);
    return result;
  } catch (err) {
    spinner.fail(`${message} – failed`);
    throw err;
  }
}
