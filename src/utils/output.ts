export type OutputKind = 'log' | 'raw';

export interface OutputEntry {
  kind: OutputKind;
  level?: 'info' | 'warn' | 'error' | 'debug';
  message: string;
}

type OutputSink = (entry: OutputEntry) => void;

let sink: OutputSink | null = null;

export function setOutputSink(nextSink: OutputSink | null): void {
  sink = nextSink;
}

export function hasOutputSink(): boolean {
  return sink !== null;
}

export function writeOutput(message: string): void {
  if (sink) {
    sink({ kind: 'raw', message });
  } else {
    process.stdout.write(message);
  }
}

export function emitLog(entry: OutputEntry): void {
  if (sink) {
    sink(entry);
  }
}
