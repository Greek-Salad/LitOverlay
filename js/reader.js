import { icon } from "./core/icons.js";
import {
  clearHighlightedParagraph,
  getLegacyLastChapter,
  loadAgeGate,
  loadReadState,
  loadReaderSettings,
  loadReadingProgress,
  markBookCompleted,
  saveBookProgress,
  saveHighlightedParagraph,
  saveReaderSettings,
  hasMeaningfulProgress
} from "./core/storage.js";
import { ThemeController } from "./core/theme.js";
import {
  $,
  $$,
  bookUrl,
  clamp,
  debounce,
  escapeHtml,
  getBookIdFromLocation,
  parseHex,
  parseChapterNumber,
  rewriteChapterMediaPaths,
  resolveMediaPath
} from "./core/utils.js";
import {
  ChapterResolver,
  loadBookInfo,
  loadHintRules,
  loadMediaRules,
  needsAgeGate
} from "./data/books.js";
import { showAgeGateModal, showResumeModal } from "./ui/modals.js";
import { SearchManager } from "./reader/search.js";
import { AudioController } from "./reader/audio.js";
import { MediaInjector } from "./reader/media.js";
import { HintInjector } from "./reader/hints.js";
import { CustomColorPicker } from "./reader/color-picker.js";

class LitOverlayReaderApp extends HTMLElement {
  constructor() {
    super();
    this.theme = new ThemeController();
    this.bookId = getBookIdFromLocation() || "mondschein";
    this.currentChapter = null;
    this.warnings = [];
    this.titleLoadingStarted = false;
    this.progressFrame = 0;
    this.saveProgress = debounce(() => this.persistProgress(), 1000);
  }

  connectedCallback() {
    this.renderShell();
    this.theme.init();
    this.bindShell();
    this.init().catch((error) => this.renderError(error));
  }

  renderShell() {
    this.innerHTML = `
      <div class="reader-shell">
        <aside class="sidebar" data-sidebar aria-hidden="true">
          <div class="panel-header">
            <button class="icon-btn" type="button" data-close-sidebar aria-label="Закрыть оглавление">${icon("close", 24)}</button>
            <h2>Оглавление</h2>
          </div>
          <nav class="chapter-list" data-chapter-list aria-label="Навигация по главам"></nav>
        </aside>
        <main class="main-content">
          <header class="toolbar">
            <div class="toolbar-left">
              <button class="icon-btn" type="button" data-menu-toggle aria-label="Открыть оглавление">${icon("menu", 24)}</button>
              <button class="icon-btn" type="button" data-home aria-label="На главную" title="На главную">${icon("home", 24)}</button>
              <div class="breadcrumb"><span data-breadcrumb>Загрузка...</span></div>
            </div>
            <div class="toolbar-center">
              <div class="search-controls" data-search-controls>
                <button class="icon-btn" type="button" data-search-prev aria-label="Предыдущее вхождение" title="Предыдущее вхождение">${icon("chevron-left", 16)}</button>
                <div class="search-field-container">
                  <input class="search-input" data-search-input type="text" placeholder="Поиск в тексте..." spellcheck="false" autocomplete="off">
                  <button class="search-clear-btn" type="button" data-search-clear aria-label="Очистить поиск" title="Очистить поиск" hidden>${icon("close", 16)}</button>
                  <div class="search-status" data-search-status aria-live="polite"></div>
                </div>
                <button class="icon-btn" type="button" data-search-next aria-label="Следующее вхождение" title="Следующее вхождение">${icon("chevron-right", 16)}</button>
              </div>
              <button class="icon-btn" type="button" data-audio-toggle aria-label="Аудиоплеер">${icon("audio", 20)}</button>
              <div class="audio-dropdown" data-audio-dropdown><div data-audio-content></div></div>
            </div>
            <div class="toolbar-right">
              <button class="icon-btn warnings-btn" type="button" data-warnings aria-label="Предупреждения" title="Предупреждения" hidden>${icon("warning", 20)}</button>
              <div class="reader-progress" data-progress-bar>
                <span class="reader-progress-label">Прочтено: </span><span data-progress>0%</span>
              </div>
              <div class="theme-switcher">
                <button class="icon-btn" type="button" data-theme-toggle aria-label="Переключить тему">${icon("theme", 20)}</button>
              </div>
              <button class="icon-btn" type="button" data-settings-toggle aria-label="Настройки">${icon("settings", 20)}</button>
            </div>
            <div class="warnings-popover" data-warnings-popover hidden></div>
          </header>
          <div class="reader-body">
            <div class="chapter-loading-overlay visible" data-loading>
              <div class="spinner"></div>
              <p>Загрузка главы...</p>
            </div>
            <article class="reading-area" data-reading-area>
              <div class="chapter-content" data-chapter-content role="article"></div>
              <footer class="chapter-navigation">
                <div class="chapter-navigation-inner">
                  <button class="nav-btn" type="button" data-prev>${icon("chevron-left", 16)} <span>Начало</span></button>
                  <button class="nav-btn" type="button" data-next><span>Следующая глава</span> ${icon("chevron-right", 16)}</button>
                </div>
              </footer>
            </article>
          </div>
        </main>
        <aside class="settings-panel" data-settings aria-hidden="true">
          <div class="panel-header">
            <h3>Настройки</h3>
            <button class="icon-btn" type="button" data-close-settings aria-label="Закрыть настройки">${icon("close", 20)}</button>
          </div>
          <div class="settings-content">
            <section class="settings-group">
              <h4>Шрифт</h4>
              <select class="settings-select" data-font-family>
                <option value="Lato">Lato (по умолчанию)</option>
                <option value="Antiqua">Antiqua</option>
                <option value="LiberationSans">Liberation Sans</option>
                <option value="LiberationSerif">Liberation Serif</option>
                <option value="Roboto">Roboto</option>
                <option value="SourceCodePro">Source Code Pro</option>
                <option value="Whitney">Whitney</option>
              </select>
              <div class="range-control">
                <label for="font-size"><span>Размер шрифта</span><span data-font-size-label>16px</span></label>
                <input class="settings-slider" id="font-size" data-font-size type="range" min="12" max="24" step="1">
              </div>
            </section>
            <section class="settings-group">
              <h4>Ширина текста</h4>
              <div class="range-control">
                <label for="text-width"><span>Ширина</span><span data-text-width-label>800px</span></label>
                <input class="settings-slider" id="text-width" data-text-width type="range" min="400" max="1200" step="50">
              </div>
            </section>
            <section class="settings-group">
              <h4>Цвета</h4>
              <div class="color-controls">
                <div class="color-control">
                  <span class="color-control-label">Фон</span>
                  <button class="color-picker-btn" type="button" data-color-picker="bg" aria-label="Выбрать цвет фона">
                    <span class="color-preview" data-color-preview="bg"></span>
                    <span class="color-value" data-color-value="bg">#202124</span>
                  </button>
                </div>
                <div class="color-control">
                  <span class="color-control-label">Текст</span>
                  <button class="color-picker-btn" type="button" data-color-picker="text" aria-label="Выбрать цвет текста">
                    <span class="color-preview" data-color-preview="text"></span>
                    <span class="color-value" data-color-value="text">#e8eaed</span>
                  </button>
                </div>
              </div>
              <div class="preset-row">
                <button class="preset-btn" type="button" data-theme-preset="light">Светлая</button>
                <button class="preset-btn" type="button" data-theme-preset="dark">Тёмная</button>
              </div>
            </section>
            <section class="settings-group">
              <h4>Межстрочный интервал</h4>
              <div class="range-control">
                <label for="line-height"><span>Интервал</span><span data-line-height-label>1.6</span></label>
                <input class="settings-slider" id="line-height" data-line-height type="range" min="1.2" max="2.4" step="0.1">
              </div>
              <div class="line-height-presets">
                <button class="preset-btn" type="button" data-line-height-preset="1.4">Плотный</button>
                <button class="preset-btn" type="button" data-line-height-preset="1.6">Стандарт</button>
                <button class="preset-btn" type="button" data-line-height-preset="1.8">Просторный</button>
                <button class="preset-btn" type="button" data-line-height-preset="2.0">Воздушный</button>
              </div>
            </section>
          </div>
        </aside>
        <aside class="lyrics-panel" data-lyrics aria-hidden="true">
          <div class="panel-header">
            <h3 data-lyrics-title>Текст</h3>
            <button class="icon-btn" type="button" data-close-lyrics aria-label="Закрыть текст">${icon("close", 20)}</button>
          </div>
          <div class="lyrics-content" data-lyrics-content></div>
        </aside>
        <div class="overlay" data-overlay></div>
      </div>
    `;
  }

  bindShell() {
    this.nodes = {
      sidebar: $("[data-sidebar]", this),
      settings: $("[data-settings]", this),
      lyrics: $("[data-lyrics]", this),
      overlay: $("[data-overlay]", this),
      loading: $("[data-loading]", this),
      readingArea: $("[data-reading-area]", this),
      content: $("[data-chapter-content]", this),
      chapterList: $("[data-chapter-list]", this),
      breadcrumb: $("[data-breadcrumb]", this),
      progressBar: $("[data-progress-bar]", this),
      progress: $("[data-progress]", this),
      warnings: $("[data-warnings]", this),
      warningsPopover: $("[data-warnings-popover]", this),
      audioDropdown: $("[data-audio-dropdown]", this),
      audioContent: $("[data-audio-content]", this)
    };
    $("[data-menu-toggle]", this).addEventListener("click", () => this.openPanel("sidebar"));
    $("[data-close-sidebar]", this).addEventListener("click", () => this.closePanels());
    $("[data-settings-toggle]", this).addEventListener("click", () => this.openPanel("settings"));
    $("[data-close-settings]", this).addEventListener("click", () => this.closePanels());
    $("[data-close-lyrics]", this).addEventListener("click", () => this.closePanels());
    $("[data-overlay]", this).addEventListener("click", () => this.closePanels());
    $("[data-home]", this).addEventListener("click", () => window.location.assign("./index.html"));
    $("[data-theme-toggle]", this).addEventListener("click", () => {
      this.theme.toggle();
      this.syncThemeControls();
    });
    const audioToggle = $("[data-audio-toggle]", this);
    audioToggle.addEventListener("click", (event) => {
      event.stopPropagation();
      this.nodes.audioDropdown.classList.toggle("open");
    });
    this.nodes.audioDropdown.addEventListener("click", (event) => {
      if (event.target.closest("[data-audio-close]")) this.nodes.audioDropdown.classList.remove("open");
      event.stopPropagation();
    });
    document.addEventListener("click", (event) => {
      if (!this.nodes.audioDropdown.classList.contains("open")) return;
      if (audioToggle.contains(event.target) || this.nodes.audioDropdown.contains(event.target)) return;
      this.nodes.audioDropdown.classList.remove("open");
    });
    $("[data-warnings]", this).addEventListener("click", () => this.toggleWarnings());
    $("[data-prev]", this).addEventListener("click", () => this.goToAdjacent("prev"));
    $("[data-next]", this).addEventListener("click", () => this.goToAdjacent("next"));
    this.nodes.readingArea.addEventListener("scroll", () => {
      this.queueProgressUpdate();
      this.saveProgress();
    });
    document.addEventListener("keydown", (event) => this.handleGlobalKeys(event));
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) this.audio?.pauseAll();
    });
    window.addEventListener("beforeunload", () => this.audio?.pauseAll());
  }

  async init() {
    const readerSettings = loadReaderSettings();
    this.settings = readerSettings.value;
    this.legacyLastChapter = getLegacyLastChapter(readerSettings.raw);
    this.applyReaderSettings();
    this.bindSettings();
    this.info = await loadBookInfo(this.bookId);
    document.title = `${this.info.title} - LitOverlay`;
    if (needsAgeGate(this.info) && !loadAgeGate().value.confirmed) {
      const confirmed = await showAgeGateModal({ bookTitle: this.info.title, immediate: true });
      if (!confirmed) {
        window.location.assign("./index.html");
        return;
      }
    }
    const [mediaRules, hintRules] = await Promise.all([
      loadMediaRules(this.bookId),
      loadHintRules(this.bookId)
    ]);
    this.mediaRules = mediaRules;
    this.hintRules = hintRules;
    this.audio = new AudioController({
      bookId: this.bookId,
      onLyrics: (track) => this.showLyrics(track),
      onPlaybackStart: () => this.nodes.audioDropdown.classList.add("open"),
      reportWarning: (warning) => this.reportWarning(warning)
    });
    this.audio.attachGlobal(this.nodes.audioContent);
    this.resolver = new ChapterResolver(this.bookId, this.info);
    this.renderChapterList();
    this.initSearch();
    await this.openInitialChapter();
    this.resolveChaptersInBackground();
  }

  initSearch() {
    this.search = new SearchManager({
      input: $("[data-search-input]", this),
      status: $("[data-search-status]", this),
      prevButton: $("[data-search-prev]", this),
      nextButton: $("[data-search-next]", this),
      clearButton: $("[data-search-clear]", this),
      scrollContainer: this.nodes.readingArea,
      content: this.nodes.content
    });
  }

  async openInitialChapter() {
    const params = new URLSearchParams(window.location.search);
    const requested = parseChapterNumber(params.get("chapter"));
    const scroll = Number(params.get("scroll"));
    if (requested !== null) {
      await this.goToChapter(requested, { scrollPercent: Number.isFinite(scroll) ? scroll : 0 });
      return;
    }
    const progress = loadReadingProgress().value[this.bookId];
    if (hasMeaningfulProgress(progress)) {
      const title = progress.chapter === 0 ? "Предисловие" : `Глава ${progress.chapter}`;
      const result = await showResumeModal(progress, title);
      if (result === "home") {
        window.location.assign("./index.html");
        return;
      }
      if (result === "resume") {
        await this.goToChapter(progress.chapter, { scrollPercent: progress.scrollPercent });
        return;
      }
    }
    if (this.legacyLastChapter !== null) {
      const chapter = await this.resolver.resolveNumber(this.legacyLastChapter);
      if (chapter) {
        await this.goToChapter(chapter.number, { scrollPercent: 0 });
        return;
      }
    }
    const first = await this.resolver.resolveFirstAvailable();
    if (!first) throw new Error("В книге не найдено ни одной главы");
    await this.goToChapter(first.number, { scrollPercent: 0 });
  }

  async goToChapter(chapterNumber, options = {}) {
    this.nodes.loading.classList.add("visible");
    this.search?.clear();
    this.hints?.destroy();
    this.warnings = [];
    this.updateWarnings();
    try {
      let chapter = await this.resolver.resolveNumber(chapterNumber);
      if (!chapter) {
        await this.resolver.resolve();
        const nearest = this.resolver.getNearest(Number(chapterNumber));
        chapter = this.resolver.getChapter(nearest);
      }
      if (!chapter) throw new Error(`Глава ${chapterNumber} не найдена`);
      const number = chapter.number;
      const html = await this.resolver.loadChapterHtml(number);
      this.nodes.content.innerHTML = html;
      rewriteChapterMediaPaths(this.nodes.content, this.bookId);
      this.currentChapter = number;
      if (number > 0) {
        const reportWarning = (warning) => this.reportWarning(warning);
        new MediaInjector({
          bookId: this.bookId,
          rules: this.mediaRules,
          audioController: this.audio,
          reportWarning
        }).apply(number, this.nodes.content);
        this.hints = new HintInjector({
          rules: this.hintRules,
          reportWarning
        });
        this.hints.apply(number, this.nodes.content);
      }
      this.renderChapterList();
      this.postProcessChapter();
      this.setupParagraphHighlighting();
      this.updateNavigation();
      this.updateUrl(number);
      await this.restoreScroll(options.scrollPercent || 0);
      this.persistProgress();
    } catch (error) {
      this.renderError(error);
    } finally {
      this.nodes.loading.classList.remove("visible");
    }
  }

  updateUrl(number) {
    const params = new URLSearchParams();
    params.set("id", this.bookId);
    params.set("chapter", String(number));
    history.replaceState(null, "", `./book.html?${params.toString()}`);
  }

  async restoreScroll(percent) {
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const max = Math.max(0, this.nodes.readingArea.scrollHeight - this.nodes.readingArea.clientHeight);
    this.nodes.readingArea.scrollTop = max * (clamp(percent, 0, 100) / 100);
    this.updateProgressIndicator();
  }

  renderChapterList() {
    if (!this.resolver.chapters.length) {
      this.nodes.chapterList.innerHTML = `<div class="chapter-list-loading">Загрузка оглавления...</div>`;
      return;
    }
    this.nodes.chapterList.innerHTML = this.resolver.chapters.map((chapter) => `
      <a class="chapter-item" href="${bookUrl(this.bookId, chapter.number)}" data-chapter="${chapter.number}">
        ${escapeHtml(chapter.title)}
      </a>
    `).join("");
    this.nodes.chapterList.querySelectorAll("[data-chapter]").forEach((link) => {
      link.addEventListener("click", (event) => {
        event.preventDefault();
        this.closePanels();
        this.goToChapter(Number(link.dataset.chapter));
      });
    });
  }

  async resolveChaptersInBackground() {
    if (this.chapterResolveStarted) return;
    this.chapterResolveStarted = true;
    try {
      await this.resolver.resolve({
        onBatch: () => {
          this.renderChapterList();
          this.updateNavigation();
        }
      });
      this.renderChapterList();
      this.updateNavigation();
      await this.loadTitlesInBackground();
    } catch (error) {
      this.reportWarning({ type: "chapter-list", id: "chapter-list", chapter: this.currentChapter ?? 0, anchor: "Оглавление" });
    }
  }

  async loadTitlesInBackground() {
    if (this.titleLoadingStarted) return;
    this.titleLoadingStarted = true;
    for (const chapter of this.resolver.chapters) {
      try {
        const title = await this.resolver.loadTitle(chapter.number);
        const link = this.nodes.chapterList.querySelector(`[data-chapter="${chapter.number}"]`);
        if (link && title) link.textContent = title;
        this.updateNavigation();
        await new Promise((resolve) => window.setTimeout(resolve, 20));
      } catch (error) {
        this.reportWarning({ type: "chapter-title", id: `chapter-${chapter.number}`, chapter: chapter.number, anchor: "Заголовок главы" });
      }
    }
  }

  updateNavigation() {
    const number = this.currentChapter;
    this.nodes.breadcrumb.textContent = number === 0 ? "Предисловие" : `Глава ${number}`;
    this.nodes.chapterList.querySelectorAll("[data-chapter]").forEach((link) => {
      link.classList.toggle("active", Number(link.dataset.chapter) === number);
    });
    const { prev, next } = this.resolver.getAdjacent(number);
    const prevBtn = $("[data-prev]", this);
    const nextBtn = $("[data-next]", this);
    prevBtn.disabled = !prev;
    nextBtn.disabled = !next;
    const prevLabel = prev ? this.formatChapterNavLabel(prev) : "Начало";
    const nextLabel = next ? this.formatChapterNavLabel(next) : "Конец";
    prevBtn.innerHTML = `${icon("chevron-left", 16)} <span>${escapeHtml(prevLabel)}</span>`;
    nextBtn.innerHTML = `<span>${escapeHtml(nextLabel)}</span> ${icon("chevron-right", 16)}`;
  }

  formatChapterNavLabel(chapter) {
    const fallback = chapter.number === 0 ? "Предисловие" : `Глава ${chapter.number}`;
    return String(chapter.title || "").trim() || fallback;
  }

  goToAdjacent(direction) {
    const adjacent = this.resolver.getAdjacent(this.currentChapter);
    const chapter = adjacent[direction];
    if (chapter) this.goToChapter(chapter.number);
  }

  postProcessChapter() {
    this.nodes.content.querySelectorAll("h2").forEach((heading) => heading.classList.add("centered-heading"));
    this.nodes.content.querySelectorAll("p").forEach((paragraph) => {
      const text = paragraph.textContent.trim();
      if (/^(\*{3}|-{3}|\*\s\*\s\*|-\s-\s-)$/.test(text) || /^[*\-\s]+$/.test(text)) {
        paragraph.classList.add("centered-break");
      }
    });
  }

  setupParagraphHighlighting() {
    const state = loadReadState();
    const saved = state.highlights[this.bookId];
    const paragraphs = this.nodes.content.querySelectorAll("p");
    paragraphs.forEach((paragraph, index) => {
      const text = paragraph.textContent.trim();
      const isBreak = !text || paragraph.classList.contains("centered-break");
      const hasMedia = paragraph.querySelector("img, audio, video, iframe, .media-container");
      if (isBreak || hasMedia) return;
      paragraph.classList.add("highlightable");
      if (saved && Number(saved.chapter) === this.currentChapter && Number(saved.paragraphIndex) === index) {
        paragraph.classList.add("highlighted");
      }
      paragraph.addEventListener("click", () => {
        const active = paragraph.classList.contains("highlighted");
        paragraphs.forEach((item) => item.classList.remove("highlighted"));
        if (active) {
          clearHighlightedParagraph(this.bookId);
        } else {
          paragraph.classList.add("highlighted");
          saveHighlightedParagraph(this.bookId, this.currentChapter, index);
        }
      });
    });
  }

  updateProgressIndicator() {
    const max = Math.max(1, this.nodes.readingArea.scrollHeight - this.nodes.readingArea.clientHeight);
    const percent = Math.round((this.nodes.readingArea.scrollTop / max) * 100);
    this.nodes.progress.textContent = `${clamp(percent, 0, 100)}%`;
    this.nodes.progressBar.style.setProperty("--progress-width", `${clamp(percent, 0, 100)}%`);
    if (this.resolver.resolvedAll && this.currentChapter === this.resolver.getLastChapterNumber() && percent >= 99) {
      markBookCompleted(this.bookId);
    }
  }

  queueProgressUpdate() {
    if (this.progressFrame) return;
    this.progressFrame = window.requestAnimationFrame(() => {
      this.progressFrame = 0;
      this.updateProgressIndicator();
    });
  }

  persistProgress() {
    if (this.currentChapter === null) return;
    const max = Math.max(1, this.nodes.readingArea.scrollHeight - this.nodes.readingArea.clientHeight);
    const percent = Math.round((this.nodes.readingArea.scrollTop / max) * 100);
    saveBookProgress(this.bookId, {
      chapter: this.currentChapter,
      scrollPercent: percent,
      timestamp: Date.now()
    });
  }

  reportWarning(warning) {
    if (
      warning.chapter !== undefined
      && this.currentChapter !== null
      && Number(warning.chapter) !== Number(this.currentChapter)
      && !["chapter-list", "chapter-title"].includes(warning.type)
    ) {
      return;
    }
    const key = `${warning.type}:${warning.id ?? ""}:${warning.chapter ?? ""}:${warning.anchor ?? ""}:${warning.src ?? ""}`;
    if (this.warnings.some((item) => `${item.type}:${item.id ?? ""}:${item.chapter ?? ""}:${item.anchor ?? ""}:${item.src ?? ""}` === key)) return;
    this.warnings.push(warning);
    this.updateWarnings();
  }

  updateWarnings() {
    this.nodes.warnings.hidden = this.warnings.length === 0;
    this.nodes.warnings.classList.toggle("has-warnings", this.warnings.length > 0);
    this.nodes.warnings.setAttribute("aria-expanded", "false");
    this.nodes.warnings.setAttribute(
      "aria-label",
      this.warnings.length ? `Предупреждения: ${this.warnings.length}` : "Предупреждения"
    );
    this.nodes.warningsPopover.hidden = true;
  }

  toggleWarnings() {
    if (!this.warnings.length) return;
    const hidden = this.nodes.warningsPopover.hidden;
    this.nodes.warningsPopover.hidden = !hidden;
    this.nodes.warnings.setAttribute("aria-expanded", String(hidden));
    if (hidden) {
      this.nodes.warningsPopover.innerHTML = `
        <h4>Предупреждения главы</h4>
        <ul>
          ${this.warnings.map((warning) => `<li>${this.formatWarning(warning)}</li>`).join("")}
        </ul>
      `;
    }
  }

  formatWarning(warning) {
    const chapter = warning.chapter !== undefined ? `Глава ${escapeHtml(String(warning.chapter))}: ` : "";
    if (warning.type === "media") {
      return `${chapter}media: не найден anchor «${escapeHtml(warning.anchor || "")}»`;
    }
    if (warning.type === "hint") {
      return `${chapter}hint: не найден текст «${escapeHtml(warning.anchor || "")}»`;
    }
    if (warning.type === "media-file") {
      return `${chapter}media: не загрузился файл «${escapeHtml(warning.src || "")}»`;
    }
    if (warning.type === "audio-file") {
      return `${chapter}audio: не загрузился файл «${escapeHtml(warning.src || "")}»`;
    }
    if (warning.type === "media-timeout") {
      return `${chapter}media: файл не загрузился за отведённое время «${escapeHtml(warning.src || warning.anchor || "")}»`;
    }
    if (warning.type === "chapter-list") {
      return "reader: не удалось обновить оглавление";
    }
    if (warning.type === "chapter-title") {
      return `${chapter}reader: не удалось прочитать заголовок главы`;
    }
    return `${chapter}${escapeHtml(warning.type || "warning")}: ${escapeHtml(warning.anchor || warning.src || "")}`;
  }

  openPanel(name) {
    this.closePanels();
    const panel = this.nodes[name];
    panel.classList.add("open");
    panel.setAttribute("aria-hidden", "false");
    this.nodes.overlay.classList.add("visible");
  }

  closePanels() {
    this.colorPicker?.close();
    [this.nodes.sidebar, this.nodes.settings, this.nodes.lyrics].forEach((panel) => {
      panel.classList.remove("open");
      panel.setAttribute("aria-hidden", "true");
    });
    this.nodes.overlay.classList.remove("visible");
  }

  bindSettings() {
    const set = (selector, value) => {
      const node = $(selector, this);
      if (node) node.value = value;
    };
    set("[data-font-family]", this.settings.fontFamily);
    set("[data-font-size]", this.settings.fontSize);
    set("[data-text-width]", this.settings.textWidth);
    set("[data-line-height]", this.settings.lineHeight);
    this.updateSettingLabels();
    this.syncThemeControls();
    $("[data-font-family]", this).addEventListener("change", (event) => this.updateReaderSetting("fontFamily", event.target.value));
    $("[data-font-size]", this).addEventListener("input", (event) => this.updateReaderSetting("fontSize", Number(event.target.value)));
    $("[data-text-width]", this).addEventListener("input", (event) => this.updateReaderSetting("textWidth", Number(event.target.value)));
    $("[data-line-height]", this).addEventListener("input", (event) => this.updateReaderSetting("lineHeight", Number(event.target.value)));
    $$("[data-line-height-preset]", this).forEach((button) => {
      button.addEventListener("click", () => this.updateReaderSetting("lineHeight", Number(button.dataset.lineHeightPreset)));
    });
    $$("[data-theme-preset]", this).forEach((button) => {
      button.addEventListener("click", () => {
        this.theme.setPreset(button.dataset.themePreset);
        this.syncThemeControls();
      });
    });
    $$("[data-color-picker]", this).forEach((button) => {
      button.addEventListener("click", () => this.openColorPicker(button.dataset.colorPicker));
    });
  }

  updateReaderSetting(key, value) {
    this.settings = { ...this.settings, [key]: value };
    saveReaderSettings(this.settings);
    this.applyReaderSettings();
    this.updateSettingLabels();
  }

  applyReaderSettings() {
    const root = document.documentElement;
    root.style.setProperty("--font-family", `"${this.settings.fontFamily}", system-ui, -apple-system, sans-serif`);
    root.style.setProperty("--font-size", `${this.settings.fontSize}px`);
    root.style.setProperty("--text-width", `${this.settings.textWidth}px`);
    root.style.setProperty("--line-height", String(this.settings.lineHeight));
  }

  updateSettingLabels() {
    $("[data-font-size-label]", this).textContent = `${this.settings.fontSize}px`;
    $("[data-text-width-label]", this).textContent = `${this.settings.textWidth}px`;
    $("[data-line-height-label]", this).textContent = String(this.settings.lineHeight);
    $("[data-font-size]", this).value = this.settings.fontSize;
    $("[data-text-width]", this).value = this.settings.textWidth;
    $("[data-line-height]", this).value = this.settings.lineHeight;
    $$("[data-font-size], [data-text-width], [data-line-height]", this).forEach((slider) => {
      const min = Number(slider.min);
      const max = Number(slider.max);
      const value = Number(slider.value);
      const percent = max > min ? ((value - min) / (max - min)) * 100 : 0;
      slider.style.setProperty("--slider-percent", `${clamp(percent, 0, 100)}%`);
    });
  }

  openColorPicker(kind) {
    const key = kind === "text" ? "text" : "bg";
    this.colorPicker?.close();
    const picker = new CustomColorPicker({
      label: key === "bg" ? "Цвет фона" : "Цвет текста",
      color: this.theme.state.colors[key],
      onApply: (color) => this.updateCustomColors({ [key]: color }),
      onClose: () => {
        if (this.colorPicker === picker) this.colorPicker = null;
      }
    });
    this.colorPicker = picker;
  }

  updateCustomColors(colors) {
    const bg = colors.bg || this.theme.state.colors.bg;
    const text = colors.text || this.theme.state.colors.text;
    this.theme.setCustomColors({ bg, text });
    this.syncThemeControls();
  }

  syncThemeControls() {
    const colors = this.theme.state.colors;
    for (const key of ["bg", "text"]) {
      const preview = $(`[data-color-preview="${key}"]`, this);
      const value = $(`[data-color-value="${key}"]`, this);
      const button = $(`[data-color-picker="${key}"]`, this);
      if (preview) preview.style.backgroundColor = colors[key];
      if (value) value.textContent = colors[key].toUpperCase();
      if (button) {
        button.dataset.color = colors[key];
        button.style.setProperty("--color-picker-bg", colors[key]);
        button.style.setProperty("--color-picker-text", colorButtonTextColor(colors[key]));
      }
    }
  }

  async showLyrics(track) {
    this.openPanel("lyrics");
    $("[data-lyrics-title]", this).textContent = track.rawTitle || "Текст";
    const content = $("[data-lyrics-content]", this);
    content.textContent = "Загрузка...";
    if (/\.(txt|lrc)$/i.test(track.lyrics.trim())) {
      try {
        const response = await fetch(resolveMediaPath(this.bookId, track.lyrics.trim()));
        content.textContent = response.ok ? await response.text() : "Текст не найден.";
      } catch (error) {
        content.textContent = "Не удалось загрузить текст.";
      }
    } else {
      content.textContent = track.lyrics || "Текст отсутствует.";
    }
  }

  handleGlobalKeys(event) {
    const target = event.target;
    if (event.key === "Escape" && this.nodes.audioDropdown.classList.contains("open")) {
      this.nodes.audioDropdown.classList.remove("open");
      return;
    }
    const interactive = target instanceof Element && target.closest("button, a, input, textarea, select, [role='slider'], [contenteditable='true']");
    if (interactive) return;
    if (event.code === "Space") {
      event.preventDefault();
      this.audio?.toggle();
    }
    if (event.key.toLowerCase() === "m") this.audio?.setMuted(!this.audio.settings.muted);
    if (event.ctrlKey && event.key === "ArrowRight") this.audio?.next();
    if (event.ctrlKey && event.key === "ArrowLeft") this.audio?.previous();
  }

  renderError(error) {
    this.nodes?.loading?.classList.remove("visible");
    const message = error?.message || String(error);
    if (this.nodes?.content) {
      this.nodes.content.innerHTML = `
        <div class="error-state">
          <h2>Не удалось открыть книгу</h2>
          <p>${escapeHtml(message)}</p>
          <details>
            <summary>Технические детали</summary>
            <pre>${escapeHtml(error?.stack || "")}</pre>
          </details>
          <button class="text-btn" type="button" data-reload>Обновить страницу</button>
        </div>
      `;
      this.nodes.content.querySelector("[data-reload]")?.addEventListener("click", () => window.location.reload());
    } else {
      this.innerHTML = `<div class="error-state">${escapeHtml(message)}</div>`;
    }
  }
}

function colorButtonTextColor(hex) {
  const rgb = parseHex(hex);
  if (!rgb) return "var(--btn-text)";
  const hsl = rgbToHsl(rgb);
  const brightness = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
  const inverseLightness = 100 - hsl.l;
  let lightness = brightness > 155
    ? Math.min(inverseLightness, 18)
    : Math.max(inverseLightness, 88);
  if (Math.abs(lightness - hsl.l) < 45) {
    lightness = brightness > 155 ? 12 : 92;
  }
  return `hsl(${hsl.h} ${hsl.s}% ${lightness}%)`;
}

function rgbToHsl(rgb) {
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const diff = max - min;
    s = l > 0.5 ? diff / (2 - max - min) : diff / (max + min);
    if (max === r) h = (g - b) / diff + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / diff + 2;
    else h = (r - g) / diff + 4;
    h /= 6;
  }
  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100)
  };
}

customElements.define("lo-reader-app", LitOverlayReaderApp);
