// src/lib/utils/getChapters.ts
import { readdirSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const SRC_DIR = join(__filename, '../../..');
export const CHAPTERS_DIR = join(SRC_DIR, 'lib/data/chapters');

export type Chapter = {
  num: number;
  title: string;
};

export function getChapters(): Chapter[] {
  try {
    const files = readdirSync(CHAPTERS_DIR);
    const chapterFiles = files
      .filter(file => /^\d+\.html$/.test(file))
      .map(file => parseInt(file, 10))
      .sort((a, b) => a - b);

    return chapterFiles.map(num => ({ num, title: `Глава ${num}` }));
  } catch {
    return [];
  }
}