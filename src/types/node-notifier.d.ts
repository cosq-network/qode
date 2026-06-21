// src/types/node-notifier.d.ts

declare module 'node-notifier' {
  interface NotifierOptions {
    title?: string;
    message: string;
    icon?: string;
    sound?: boolean | string;
    wait?: boolean;
    // other fields can be added as needed
  }
  function notify(options: NotifierOptions): void;
  export = { notify };
}
