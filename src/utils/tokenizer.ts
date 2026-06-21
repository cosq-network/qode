import { get_encoding } from 'tiktoken';

// Use cl100k_base encoding (used by GPT-4/ChatGPT; a reasonable default)
const enc = get_encoding('cl100k_base');

export function countTokens(text: string): number {
  return enc.encode(text).length;
}

// Free the encoding when done (optional, call on exit)
process.on('exit', () => {
  enc.free();
});