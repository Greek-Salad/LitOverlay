import { error } from '@sveltejs/kit';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { JSDOM } from 'jsdom';
import type { PageServerLoad } from './$types';
import mediaRules from '$lib/data/media-rules.json';
import { parseChapterOnServer } from '$lib/utils/parseChapter';
import { getChapters } from '$lib/utils/getChapters'; // ← добавлен импорт

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const CHAPTERS_DIR = join(__dirname, '../../../lib/data/chapters');

export const load: PageServerLoad = async ({ params }) => {
  const chapterNum = parseInt(params.slug);
  if (isNaN(chapterNum) || chapterNum <= 0) throw error(400, 'Invalid chapter');

  const fileName = chapterNum.toString().padStart(2, '0') + '.html';
  const filePath = join(CHAPTERS_DIR, fileName);

  let rawHtml = '';
  try {
    rawHtml = readFileSync(filePath, 'utf8');
    rawHtml = rawHtml.replace(/<p>\*\*\*<\/p>/g, '<p class="scene-divider">***</p>');
  } catch {
    throw error(404, `Chapter ${chapterNum} not found`);
  }

  let firstH2 = '';
  const titleDoc = new JSDOM(`<div>${rawHtml}</div>`);
  const firstH2El = titleDoc.window.document.querySelector('h2');
  if (firstH2El) {
    firstH2 = firstH2El.textContent?.trim() || '';
  }

  const title = firstH2 || `Глава ${chapterNum}`;

  const chapterMediaRules = mediaRules.media.filter(rule => rule.chapter === chapterNum);
  const blocks = parseChapterOnServer(rawHtml, chapterMediaRules);

  // 🔹 Получаем список всех глав для навигации
  const allChapters = getChapters();
  const currentIndex = allChapters.findIndex(ch => ch.num === chapterNum);

  const prevChapter = currentIndex > 0 ? allChapters[currentIndex - 1] : null;
  const nextChapter = currentIndex < allChapters.length - 1 ? allChapters[currentIndex + 1] : null;

  const isFirst = currentIndex === 0;
  const isLast = currentIndex === allChapters.length - 1;

  return {
    chapterNumber: chapterNum,
    blocks,
    title,
    prevChapter,
    nextChapter,
    isFirst,
    isLast
  };
};