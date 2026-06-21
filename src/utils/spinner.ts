import ora from 'ora';

/**
 * Run an async function while displaying a spinner.
 * @param message Message to display beside the spinner.
 * @param fn Async function to run.
 */
export async function runWithSpinner<T>(message: string, fn: () => Promise<T>): Promise<T> {
  const spinner = ora({ text: message, spinner: 'dots' }).start();
  try {
    const result = await fn();
    spinner.succeed(`${message} – done`);
    return result;
  } catch (err) {
    spinner.fail(`${message} – failed`);
    throw err;
  }
}
