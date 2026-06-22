const cancelToken = Symbol('clack-cancel');

export const intro = (): void => undefined;
export const outro = (): void => undefined;
export const note = (): void => undefined;

export const log = {
  info: (): void => undefined,
  warn: (): void => undefined,
  error: (): void => undefined,
};

export const spinner = () => ({
  start: (): void => undefined,
  stop: (): void => undefined,
  message: (): void => undefined,
});

export async function confirm(): Promise<boolean> {
  return true;
}

export async function select<T extends { value: unknown }>(options: { options: T[] }): Promise<unknown> {
  return options.options[0]?.value;
}

export async function password(): Promise<string> {
  return '';
}

export async function text(): Promise<string> {
  return '';
}

export function isCancel(value: unknown): boolean {
  return value === cancelToken;
}

export const __cancelToken = cancelToken;
