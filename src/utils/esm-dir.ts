import path from 'path';
import { fileURLToPath } from 'url';
export const ESM_DIR = typeof __dirname !== 'undefined' ? __dirname : path.dirname(fileURLToPath((import.meta as any).url));
