import { icon } from "./core/icons.js";
import { ThemeController } from "./core/theme.js";
import {
  clearBookProgress,
  hasMeaningfulProgress,
  loadAgeGate,
  loadLibraryPrefs,
  loadReadState,
  loadReadingProgress,
  saveLibraryPrefs
} from "./core/storage.js";
import { bookUrl, copyText, escapeHtml, formatDate, formatTimeAgo } from "./core/utils.js";
import { loadLibraryBooks, needsAgeGate } from "./data/books.js";
import { showAgeGateModal, toast } from "./ui/modals.js";

class LitOverlayLibraryApp extends HTMLElement {
  constructor() {
    super();
    this.theme = new ThemeController();
    this.books = [];
    this.query = "";
    this.view = loadLibraryPrefs().view;
    this.ageGate = loadAgeGate().value;
  }

  connectedCallback() {
    this.renderShell();
    this.theme.init();
    this.bindShell();
    this.load();
  }

  renderShell() {
    this.innerHTML = `
      <div class="loading-overlay" data-loading>
        <div class="spinner"></div>
        <p>Загрузка библиотеки...</p>
      </div>
      <main class="library-main">
        <header class="library-header">
          <h1>Произведения Греческого Салата</h1>
          <div class="library-actions theme-switcher">
            <button class="icon-btn" type="button" data-theme-toggle aria-label="Переключить тему" title="Переключить тему">${icon("theme", 24)}</button>
          </div>
        </header>
        <section class="library-controls" aria-label="Управление библиотекой">
          <label class="search-shell">
            ${icon("search", 18)}
            <span class="visually-hidden">Поиск по названию и тегам</span>
            <input type="text" data-library-search placeholder="Поиск..." autocomplete="off">
            <button class="search-clear-btn" type="button" data-library-search-clear aria-label="Очистить поиск" title="Очистить поиск" hidden>${icon("close", 16)}</button>
          </label>
          <div class="segmented" role="group" aria-label="Режим отображения">
            <button class="icon-btn" type="button" data-view="list" aria-label="Список" title="Список">${icon("list-view", 18)}</button>
            <button class="icon-btn" type="button" data-view="grid" aria-label="Плитка" title="Плитка">${icon("grid-view", 18)}</button>
          </div>
        </section>
        <section class="continue-section" data-continue hidden></section>
        <section class="books-grid" data-books></section>
      </main>
    `;
  }

  bindShell() {
    this.querySelector("[data-theme-toggle]").addEventListener("click", () => this.theme.toggle());
    const searchInput = this.querySelector("[data-library-search]");
    const clearSearch = this.querySelector("[data-library-search-clear]");
    searchInput.addEventListener("input", (event) => {
      this.query = event.target.value.trim().toLowerCase();
      clearSearch.hidden = !event.target.value;
      this.renderBooks();
    });
    clearSearch.addEventListener("click", () => {
      searchInput.value = "";
      this.query = "";
      clearSearch.hidden = true;
      this.renderBooks();
      searchInput.focus();
    });
    this.querySelectorAll("[data-view]").forEach((button) => {
      button.addEventListener("click", () => {
        this.view = button.dataset.view;
        saveLibraryPrefs({ view: this.view });
        this.renderBooks();
      });
    });
  }

  async load() {
    try {
      const data = await loadLibraryBooks();
      this.books = data.books;
      this.querySelector("[data-loading]").remove();
      this.renderContinue();
      this.renderBooks();
      if (this.books.some(needsAgeGate) && !this.ageGate.confirmed) {
        const confirmed = await showAgeGateModal({ immediate: true });
        this.ageGate = loadAgeGate().value;
        if (!confirmed) this.ageGate.confirmed = false;
        this.renderBooks();
      }
    } catch (error) {
      this.querySelector("[data-loading]")?.remove();
      this.querySelector("[data-books]").innerHTML = `<div class="error-state">Не удалось загрузить библиотеку: ${escapeHtml(error.message)}</div>`;
    }
  }

  renderContinue() {
    const section = this.querySelector("[data-continue]");
    const progress = loadReadingProgress().value;
    const readState = loadReadState();
    const items = Object.entries(progress)
      .filter(([, entry]) => hasMeaningfulProgress(entry))
      .map(([bookId, entry]) => {
        const book = this.books.find((item) => item.id === bookId || item.folderId === bookId);
        return { bookId, book, entry, completed: Boolean(readState.completed[bookId]) };
      })
      .filter((item) => item.book);
    if (!items.length) {
      section.hidden = true;
      section.innerHTML = "";
      return;
    }
    section.hidden = false;
    section.innerHTML = `
      <h2 class="section-title">Продолжить чтение</h2>
      <div class="continue-list">
        ${items.map((item) => this.renderContinueItem(item)).join("")}
      </div>
    `;
    section.querySelectorAll("[data-clear-progress]").forEach((button) => {
      button.addEventListener("click", () => {
        this.showClearProgressConfirm(button);
      });
    });
  }

  showClearProgressConfirm(button) {
    const actions = button.closest(".continue-actions");
    if (!actions) return;
    actions.querySelector(".inline-confirm")?.remove();
    const confirm = document.createElement("div");
    confirm.className = "inline-confirm";
    confirm.innerHTML = `
      <span>Удалить прогресс?</span>
      <button class="text-btn danger compact" type="button" data-confirm-clear>Удалить</button>
      <button class="text-btn compact" type="button" data-cancel-clear>Отмена</button>
    `;
    button.after(confirm);
    confirm.querySelector("[data-confirm-clear]").addEventListener("click", () => {
      clearBookProgress(button.dataset.clearProgress);
      this.renderContinue();
    });
    confirm.querySelector("[data-cancel-clear]").addEventListener("click", () => confirm.remove());
    confirm.querySelector("[data-confirm-clear]").focus();
  }

  renderContinueItem({ bookId, book, entry, completed }) {
    const start = book.hasPreface ? 0 : 1;
    const title = escapeHtml(book.title || bookId);
    const percent = Math.round(entry.scrollPercent || 0);
    return `
      <article class="continue-item">
        <div>
          <p class="continue-title">${title}${completed ? " · прочитано" : ""}</p>
          <div class="continue-meta">
            <span>Глава ${entry.chapter}</span>
            <span>${percent}%</span>
            <span>${formatTimeAgo(entry.timestamp)}</span>
          </div>
        </div>
        <div class="continue-actions">
          <a class="text-btn primary" href="${bookUrl(bookId, entry.chapter, { scrollPercent: percent })}">Продолжить</a>
          <a class="text-btn" href="${bookUrl(bookId, start, { start: true })}">Сначала</a>
          <button class="icon-btn" type="button" data-clear-progress="${bookId}" aria-label="Удалить прогресс" title="Удалить прогресс">${icon("trash", 18)}</button>
        </div>
      </article>
    `;
  }

  renderBooks() {
    const grid = this.querySelector("[data-books]");
    grid.classList.toggle("grid-view", this.view === "grid");
    this.querySelectorAll("[data-view]").forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.view === this.view));
    });
    const books = this.books.filter((book) => this.matches(book));
    if (!books.length) {
      grid.innerHTML = `<div class="empty-state">Ничего не найдено.</div>`;
      return;
    }
    grid.innerHTML = books.map((book) => this.renderBook(book)).join("");
    grid.querySelectorAll("[data-copy-link]").forEach((button) => {
      button.addEventListener("click", async () => {
        const href = new URL(bookUrl(button.dataset.copyLink), window.location.href).href;
        await copyText(href);
        toast("Ссылка скопирована");
      });
    });
    grid.querySelectorAll("[data-blocked-link]").forEach((link) => {
      link.addEventListener("click", async (event) => {
        event.preventDefault();
        const book = this.books.find((item) => item.id === link.dataset.blockedLink);
        const confirmed = await showAgeGateModal({ bookTitle: book?.title ?? "" });
        this.ageGate = loadAgeGate().value;
        if (confirmed) this.renderBooks();
      });
    });
  }

  matches(book) {
    if (!this.query) return true;
    const haystack = [book.title, book.author, ...(book.tags ?? [])].join(" ").toLowerCase();
    return haystack.includes(this.query);
  }

  renderBook(book) {
    const id = book.folderId || book.id;
    const isBlocked = needsAgeGate(book) && !this.ageGate.confirmed;
    const url = bookUrl(id);
    const linkAttrs = isBlocked ? `href="${url}" data-blocked-link="${id}"` : `href="${url}"`;
    const cover = book.cover
      ? `<img class="book-cover" src="./books/${id}/${escapeHtml(book.cover)}" alt="Обложка: ${escapeHtml(book.title)}" loading="lazy">`
      : `<div class="book-cover-placeholder">${escapeHtml((book.title || "?").slice(0, 1))}</div>`;
    const tags = (book.tags ?? []).map((tag) => `<span class="book-tag">${icon("tag", 12)}${escapeHtml(tag)}</span>`).join("");
    const meta = [
      { icon: book.finished ? "check-circle" : "refresh", text: book.finished ? "Завершено" : "В процессе", hint: "Статус произведения" },
      book.writtenDate ? { icon: "calendar", text: formatDate(book.writtenDate), hint: "Дата публикации" } : null,
      { icon: "book-open", text: formatChaptersCount(book.totalChapters ?? 1), hint: "Количество глав" },
      book.hasMedia ? { icon: "audio", text: "аудио", hint: "Есть аудио" } : null,
      book.hasHints ? { icon: "lightbulb", text: "подсказки", hint: "Есть подсказки" } : null
    ].filter(Boolean);
    return `
      <article class="book-card ${isBlocked ? "blocked" : ""}">
        <a class="book-cover-link" ${linkAttrs}>${cover}</a>
        ${Number(book.ageRating) > 0 ? `<span class="age-badge">${escapeHtml(book.ageRating)}+</span>` : ""}
        ${isBlocked ? `<div class="blocked-message">18+ · подтвердите возраст</div>` : ""}
        <div class="book-info">
          <a class="book-title-link" ${linkAttrs}><h2 class="book-title">${escapeHtml(book.title)}</h2></a>
          <p class="book-author">${escapeHtml(book.author || "Автор неизвестен")}</p>
          <p class="book-description">${escapeHtml(book.description || "")}</p>
          <div class="book-tags">${tags}</div>
          <div class="book-meta">${meta.map((item) => `<span class="book-meta-item" title="${escapeHtml(item.hint)}" aria-label="${escapeHtml(`${item.hint}: ${item.text}`)}">${icon(item.icon, 14)}<span>${escapeHtml(item.text)}</span></span>`).join("")}</div>
        </div>
        <div class="book-card-tools">
          <button class="icon-btn" type="button" data-copy-link="${id}" aria-label="Скопировать ссылку" title="Скопировать ссылку">${icon("copy", 18)}</button>
        </div>
      </article>
    `;
  }
}

function formatChaptersCount(count) {
  const value = Number.parseInt(count, 10) || 0;
  return `${value} ${pluralizeChapters(value)}`;
}

function pluralizeChapters(count) {
  const last = count % 10;
  const lastTwo = count % 100;
  if (last === 1 && lastTwo !== 11) return "глава";
  if ([2, 3, 4].includes(last) && ![12, 13, 14].includes(lastTwo)) return "главы";
  return "глав";
}

customElements.define("lo-library-app", LitOverlayLibraryApp);
