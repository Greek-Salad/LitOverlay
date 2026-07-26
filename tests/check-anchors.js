// Сверка якорей hint-rules.json и media-rules.json с текстом глав.
//
// Повторяет матчинг движка 1:1:
//  - медиа (MediaInjector.findTarget): якорь должен входить в textContent
//    какого-нибудь <p>/<blockquote> — точно или после normalizeSpaces;
//  - хинты (HintInjector.wrapFirstMatch): контейнер ищется так же, но обёртка
//    требует, чтобы rule.text целиком лежал в ОДНОМ текстовом узле (нельзя
//    пересекать <em>/<u> и прочие inline-теги).
// Дополнительно проверяет, что файлы из media src существуют на диске.
//
// Запуск: npm run check-anchors (входит в npm test).

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const booksDir = join(root, "books");

function normalizeSpaces(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

const NAMED_ENTITIES = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'",
  nbsp: " ", laquo: "«", raquo: "»", mdash: "—", ndash: "–", hellip: "…"
};

function decodeEntities(text) {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&([a-z]+);/gi, (match, name) => NAMED_ENTITIES[name.toLowerCase()] ?? match);
}

// Возвращает блоки <p>/<blockquote> главы: textContent + список текстовых узлов.
function extractBlocks(html) {
  const blocks = [];
  const blockRe = /<(p|blockquote)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  let match;
  while ((match = blockRe.exec(html)) !== null) {
    const inner = match[2];
    // Текстовые узлы: куски между тегами (как их видит TreeWalker).
    const textNodes = inner
      .split(/<[^>]+>/)
      .map((piece) => decodeEntities(piece))
      .filter((piece) => piece.length > 0);
    blocks.push({
      tag: match[1].toLowerCase(),
      textContent: decodeEntities(inner.replace(/<[^>]+>/g, "")),
      textNodes
    });
  }
  return blocks;
}

// Как MediaInjector.findTarget: первый блок с точным вхождением, иначе с normalized.
function findContainer(blocks, anchor) {
  const exact = blocks.find((block) => block.textContent.includes(anchor));
  if (exact) return { block: exact, exact: true };
  const normalized = normalizeSpaces(anchor);
  const loose = blocks.find((block) => normalizeSpaces(block.textContent).includes(normalized));
  return loose ? { block: loose, exact: false } : null;
}

// Подсказка для сломанного якоря: самый длинный префикс, который ещё находится в главе.
function diagnose(anchor, fullText) {
  let low = 0;
  let high = anchor.length;
  while (low < high) {
    const mid = Math.ceil((low + high + 1) / 2) - 1;
    if (mid === low) break;
    if (fullText.includes(anchor.slice(0, mid))) low = mid;
    else high = mid - 1;
  }
  for (let len = Math.min(anchor.length, Math.max(low, high)); len >= 8; len -= 1) {
    const prefix = anchor.slice(0, len);
    const index = fullText.indexOf(prefix);
    if (index !== -1) {
      const context = fullText.slice(index, index + Math.min(anchor.length + 40, 160)).replace(/\s+/g, " ");
      return `совпадает префикс ${len}/${anchor.length} симв.; в тексте: «${context}…»`;
    }
  }
  return "даже начало якоря в главе не найдено";
}

function loadRules(bookPath, file, key) {
  const path = join(bookPath, file);
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8"))[key] || [];
}

const problems = [];
const stats = { books: 0, hints: 0, media: 0, files: 0 };

for (const bookId of readdirSync(booksDir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name)) {
  const bookPath = join(booksDir, bookId);
  const hints = loadRules(bookPath, "hint-rules.json", "hints");
  const media = loadRules(bookPath, "media-rules.json", "media");
  if (!hints && !media) continue;
  stats.books += 1;

  const chapterCache = new Map();
  const getChapter = (number) => {
    if (!chapterCache.has(number)) {
      const file = join(bookPath, "chapters", `${String(number).padStart(2, "0")}.html`);
      if (!existsSync(file)) {
        chapterCache.set(number, null);
      } else {
        const html = readFileSync(file, "utf8");
        chapterCache.set(number, { blocks: extractBlocks(html), fullText: decodeEntities(html.replace(/<[^>]+>/g, " ")) });
      }
    }
    return chapterCache.get(number);
  };

  const seenIds = new Set();
  const checkId = (rule, source) => {
    const id = rule.id;
    if (!id) return;
    if (seenIds.has(id)) problems.push(`[${bookId}] ${source}: дубликат id "${id}"`);
    seenIds.add(id);
  };

  for (const rule of hints || []) {
    stats.hints += 1;
    checkId(rule, "hint");
    const label = `[${bookId}] hint ${rule.id || `"${rule.text}"`} (гл. ${rule.chapter})`;
    const chapter = getChapter(rule.chapter);
    if (!chapter) {
      problems.push(`${label}: файл главы не найден`);
      continue;
    }
    const found = findContainer(chapter.blocks, rule.text);
    if (!found) {
      problems.push(`${label}: текст «${rule.text}» не найден — ${diagnose(rule.text, chapter.fullText)}`);
      continue;
    }
    // Движок оборачивает только целый текстовый узел внутри найденного контейнера.
    const wrappable = found.block.textNodes.some((node) => node.includes(rule.text));
    if (!wrappable) {
      problems.push(`${label}: текст найден в абзаце, но разорван inline-тегом или пробелами — движок не обернёт («${normalizeSpaces(found.block.textContent).slice(0, 80)}…»)`);
    }
  }

  for (const rule of media || []) {
    stats.media += 1;
    checkId(rule, "media");
    const label = `[${bookId}] media ${rule.id || rule.type} (гл. ${rule.chapter})`;
    const chapter = getChapter(rule.chapter);
    if (!chapter) {
      problems.push(`${label}: файл главы не найден`);
      continue;
    }
    if (!findContainer(chapter.blocks, rule.anchor)) {
      problems.push(`${label}: якорь «${rule.anchor}» не найден — ${diagnose(rule.anchor, chapter.fullText)}`);
    }
    for (const src of rule.src || []) {
      stats.files += 1;
      const filePath = join(bookPath, src.replace(/^\.\//, ""));
      if (!existsSync(filePath)) {
        problems.push(`${label}: файл «${src}» отсутствует на диске`);
      }
    }
  }
}

if (problems.length) {
  console.error(`Anchor check failed: ${problems.length} problem(s)\n`);
  for (const problem of problems) console.error(`  ✗ ${problem}`);
  process.exit(1);
}
console.log(`Anchor check passed: ${stats.books} book(s), ${stats.hints} hints, ${stats.media} media rules, ${stats.files} files.`);
