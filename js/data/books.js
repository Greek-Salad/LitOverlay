import {
  chapterCandidates,
  fetchJson,
  fetchText,
  sanitizeTrustedHtml,
  urlExists
} from "../core/utils.js";

export function needsAgeGate(book) {
  const rating = Number(book?.ageRating ?? 0);
  return book?.showAgeGate === true || rating >= 18;
}

export async function loadLibraryBooks() {
  const index = await fetchJson("./books/index.json");
  const books = Array.isArray(index.books) ? index.books : [];
  if (books.every((book) => typeof book === "string")) {
    const infos = await Promise.all(books.map(async (bookId) => {
      const info = await loadBookInfo(bookId);
      return { ...info, id: info.id || bookId, folderId: bookId };
    }));
    return { lastUpdated: index.lastUpdated ?? null, books: infos };
  }
  return {
    lastUpdated: index.lastUpdated ?? null,
    books: books.map((book) => ({ ...book, folderId: book.id }))
  };
}

export async function loadBookInfo(bookId) {
  const info = await fetchJson(`./books/${bookId}/info.json`);
  return { ...info, id: info.id || bookId, folderId: bookId };
}

export async function loadMediaRules(bookId) {
  const data = await fetchJson(`./books/${bookId}/media-rules.json`, { media: [] });
  return Array.isArray(data.media) ? data.media : [];
}

export async function loadHintRules(bookId) {
  const data = await fetchJson(`./books/${bookId}/hint-rules.json`, { hints: [] });
  return Array.isArray(data.hints) ? data.hints : [];
}

export class ChapterResolver {
  constructor(bookId, info) {
    this.bookId = bookId;
    this.info = info;
    this.chapters = [];
    this.fileByNumber = new Map();
    this.titleByNumber = new Map();
    this.absentNumbers = new Set();
    this.resolvePromises = new Map();
    this.preferredChapterWidth = null;
    this.resolvedAll = false;
  }

  async resolve() {
    const max = this.getMaxChapterNumber();
    const numbers = [0];
    for (let number = 1; number <= max; number += 1) numbers.push(number);
    for (const number of numbers) {
      await this.resolveNumber(number);
    }
    this.resolvedAll = true;
    return this.chapters;
  }

  getMaxChapterNumber() {
    return Math.max(1, Number.parseInt(this.info.totalChapters ?? 1, 10) || 1);
  }

  async resolveNumber(number) {
    const normalized = Number.parseInt(String(number), 10);
    if (!Number.isInteger(normalized) || normalized < 0) return null;
    if (this.fileByNumber.has(normalized)) return this.getChapter(normalized);
    if (this.absentNumbers.has(normalized)) return null;
    if (this.resolvePromises.has(normalized)) return this.resolvePromises.get(normalized);
    const promise = this.findFile(normalized).then((file) => {
      this.resolvePromises.delete(normalized);
      if (!file) {
        this.absentNumbers.add(normalized);
        return null;
      }
      return this.addChapter(normalized, file);
    });
    this.resolvePromises.set(normalized, promise);
    return promise;
  }

  async resolveFirstAvailable() {
    const preface = await this.resolveNumber(0);
    if (preface) return preface;
    const max = this.getMaxChapterNumber();
    for (let number = 1; number <= max; number += 1) {
      const chapter = await this.resolveNumber(number);
      if (chapter) return chapter;
    }
    return null;
  }

  addChapter(number, file) {
    if (this.fileByNumber.has(number)) return this.getChapter(number);
    const chapter = {
      number,
      file,
      title: this.titleByNumber.get(number) || (number === 0 ? "Предисловие" : `Глава ${number}`)
    };
    this.chapters.push(chapter);
    this.chapters.sort((left, right) => left.number - right.number);
    this.fileByNumber.set(number, file);
    this.titleByNumber.set(number, chapter.title);
    return chapter;
  }

  getChapter(number) {
    return this.chapters.find((chapter) => chapter.number === number) || null;
  }

  async findFile(number) {
    for (const candidate of this.orderedCandidates(number)) {
      const path = this.pathFor(candidate);
      if (await urlExists(path)) {
        this.rememberCandidatePattern(number, candidate);
        return candidate;
      }
    }
    return null;
  }

  orderedCandidates(number) {
    const candidates = chapterCandidates(number);
    if (!this.preferredChapterWidth) return candidates;
    return [...candidates].sort((left, right) => {
      const leftMatch = this.candidateWidth(left) === this.preferredChapterWidth ? 0 : 1;
      const rightMatch = this.candidateWidth(right) === this.preferredChapterWidth ? 0 : 1;
      return leftMatch - rightMatch;
    });
  }

  rememberCandidatePattern(number, candidate) {
    if (Number(number) >= 10) return;
    this.preferredChapterWidth = this.candidateWidth(candidate);
  }

  candidateWidth(candidate) {
    return String(candidate).replace(/\.html$/i, "").length;
  }

  pathFor(file) {
    return `./books/${this.bookId}/chapters/${file}`;
  }

  has(number) {
    return this.fileByNumber.has(number);
  }

  getFile(number) {
    return this.fileByNumber.get(number);
  }

  getFirstChapterNumber() {
    return this.chapters[0]?.number ?? 1;
  }

  getLastChapterNumber() {
    return this.chapters[this.chapters.length - 1]?.number ?? 1;
  }

  getNearest(number) {
    if (this.has(number)) return number;
    if (number === 0 && this.has(1)) return 1;
    const available = this.chapters.map((chapter) => chapter.number);
    if (!available.length) return 1;
    return available.reduce((best, current) => Math.abs(current - number) < Math.abs(best - number) ? current : best, available[0]);
  }

  getAdjacent(number) {
    const index = this.chapters.findIndex((chapter) => chapter.number === number);
    return {
      prev: index > 0 ? this.chapters[index - 1] : null,
      next: index >= 0 && index < this.chapters.length - 1 ? this.chapters[index + 1] : null
    };
  }

  async loadTitle(number) {
    const file = this.getFile(number);
    if (!file) return null;
    const html = await fetchText(this.pathFor(file));
    const doc = new DOMParser().parseFromString(html, "text/html");
    const title = doc.querySelector("h1, h2")?.textContent?.trim();
    const fallback = number === 0 ? "Предисловие" : `Глава ${number}`;
    const resolved = title || fallback;
    this.titleByNumber.set(number, resolved);
    const chapter = this.chapters.find((item) => item.number === number);
    if (chapter) chapter.title = resolved;
    return resolved;
  }

  async loadChapterHtml(number) {
    const file = this.getFile(number);
    if (!file) throw new Error(`Глава ${number} не найдена`);
    const html = await fetchText(this.pathFor(file));
    return sanitizeTrustedHtml(html);
  }
}
