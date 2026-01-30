// js/chapter-loader.js

import Utils from "./utils.js";

class ChapterLoader {
  constructor() {
    this.currentChapter = 1;
    this.totalChapters = 0;
    this.chapterFiles = [];
    this.chapterTitles = {};
  }

  async init() {
    try {
      await this.scanChapters();
      await this.loadChapterTitles();
      console.log(
        `✅ ChapterLoader initialized, found ${this.totalChapters} chapters`,
      );

      this.createChapterNavigation();
      this.setupNavigation();
      this.updateNavigationUI();

      const lastChapter = Utils.loadFromStorage("lastChapter", 1);
      await this.goToChapter(lastChapter);
    } catch (error) {
      console.error("❌ Failed to initialize ChapterLoader:", error);
      this.createPlaceholderChapter();
    }
  }

  async loadChapterTitles() {
    console.log("📚 Loading chapter titles...");
    this.chapterTitles = {};

    for (const chapter of this.chapterFiles) {
      try {
        const response = await fetch(`./chapters/${chapter.filename}`, {
          cache: "no-cache",
        });

        if (response.ok) {
          const html = await response.text();
          const parser = new DOMParser();
          const doc = parser.parseFromString(html, "text/html");
          const h2 = doc.querySelector("h2");

          if (h2 && h2.textContent.trim()) {
            this.chapterTitles[chapter.number] = h2.textContent.trim();
          } else {
            this.chapterTitles[chapter.number] = `Глава ${chapter.number}`;
          }
        }
      } catch (error) {
        this.chapterTitles[chapter.number] = `Глава ${chapter.number}`;
      }
    }

    console.log("📚 Finished loading chapter titles:", this.chapterTitles);
  }

  async scanChapters() {
    this.chapterFiles = [];
    const maxChapters = 33;

    for (let i = 1; i <= maxChapters; i++) {
      try {
        const padded = i.toString().padStart(2, "0");
        const response = await fetch(`./chapters/${padded}.html`, {
          cache: "no-cache",
          method: "HEAD",
        });

        if (response.ok) {
          this.chapterFiles.push({
            number: i,
            filename: `${padded}.html`,
            exists: true,
          });
        }
      } catch (error) {
        console.log(`Chapter ${i} not found.`);
      }
    }

    this.totalChapters = this.chapterFiles.length;

    if (this.totalChapters === 0) {
      console.log("No chapters found, creating placeholder");
      this.createPlaceholderChapter();
      this.totalChapters = 1;
    }

    console.log(`📚 Total chapters found: ${this.totalChapters}`);
    return this.totalChapters;
  }

  createPlaceholderChapter() {
    const placeholder = `
            <div class="placeholder-chapter">
                <h1 class="chapter-title">Добро пожаловать в читальный движок</h1>
                <p class="chapter-meta">Создайте файлы глав в папке chapters/</p>
                
                <div class="placeholder-content">
                    <p>Чтобы начать работу, добавьте файлы глав в папку <code>chapters/</code>.</p>
                    <p>Файлы должны называться <code>01.html</code>, <code>02.html</code> и так далее.</p>
                    
                    <h3>Пример содержимого главы:</h3>
                    <pre><code>&lt;h1 class="chapter-title"&gt;Название главы&lt;/h1&gt;
&lt;p class="chapter-meta"&gt;Описание или дата&lt;/p&gt;

&lt;p&gt;Содержимое главы...&lt;/p&gt;</code></pre>
                    
                    <div class="note">
                        <strong>Примечание:</strong> После добавления файлов обновите страницу.
                    </div>
                </div>
            </div>
        `;

    localStorage.setItem("chapter_1_cache", placeholder);
  }

  async loadChapter(chapterNumber) {
    if (chapterNumber < 1) {
      console.warn(
        `Chapter number ${chapterNumber} is invalid, using chapter 1`,
      );
      chapterNumber = 1;
    }

    if (chapterNumber > this.totalChapters) {
      console.warn(
        `Chapter number ${chapterNumber} exceeds total chapters (${this.totalChapters}), using last chapter`,
      );
      chapterNumber = this.totalChapters;
    }

    console.log(
      `📖 Loading chapter ${chapterNumber} (total: ${this.totalChapters})`,
    );

    this.currentChapter = chapterNumber;
    this.saveLastChapter();

    try {
      const chapterInfo = this.chapterFiles.find(
        (c) => c.number === chapterNumber && c.exists,
      );

      if (!chapterInfo) {
        throw new Error(`Chapter ${chapterNumber} not found`);
      }

      const response = await fetch(`./chapters/${chapterInfo.filename}`, {
        cache: "no-cache",
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      let html = await response.text();

      if (window.hintInjector) {
        html = await window.hintInjector.injectHints(html, chapterNumber);
      }

      if (window.mediaInjector) {
        html = await window.mediaInjector.injectMedia(html, chapterNumber);
      }

      return html;
    } catch (error) {
      console.error(`Error loading chapter ${chapterNumber}:`, error);
      return this.createErrorChapter(chapterNumber);
    }
  }

  createErrorChapter(chapterNumber) {
    if (chapterNumber === 0) {
      return `
            <div class="placeholder-chapter">
                <h1 class="chapter-title">Загрузка глав...</h1>
                <div class="loading">
                    <div class="spinner"></div>
                </div>
            </div>
        `;
    }

    return `
        <div class="error-chapter">
            <h1 class="chapter-title">Ошибка загрузки главы ${chapterNumber}</h1>
            <p class="chapter-meta">Файл chapters/${chapterNumber.toString().padStart(2, "0")}.html не найден</p>
            
            <div class="error-content">
                <p>Эта глава не существует или повреждена.</p>
                <div class="error-actions">
                    <button onclick="window.readingApp.getChapterLoader().goToChapter(1)" 
                            class="error-btn">
                        Перейти к главе 1
                    </button>
                    <button onclick="location.reload()" class="error-btn">
                        Обновить страницу
                    </button>
                </div>
            </div>
        </div>
    `;
  }

  saveLastChapter() {
    Utils.saveToStorage("lastChapter", this.currentChapter);
  }

  setupNavigation() {
    const prevBtn = document.getElementById("prev-chapter");
    const nextBtn = document.getElementById("next-chapter");

    if (prevBtn) {
      prevBtn.addEventListener("click", () => this.goToPreviousChapter());
    }

    if (nextBtn) {
      nextBtn.addEventListener("click", () => this.goToNextChapter());
    }
  }

  createChapterNavigation() {
    const navElement = document.getElementById("chapter-nav");
    if (!navElement) return;

    navElement.innerHTML = "";

    for (let i = 1; i <= this.totalChapters; i++) {
      const chapterInfo = this.chapterFiles.find((c) => c.number === i);
      if (!chapterInfo || !chapterInfo.exists) continue;

      const isActive = i === this.currentChapter;
      const chapterTitle = this.chapterTitles[i] || `Глава ${i}`;

      const item = document.createElement("a");
      item.className = `chapter-item ${isActive ? "active" : ""}`;
      item.href = "#";
      item.dataset.chapter = i;
      item.innerHTML = `<span class="chapter-item-title">${chapterTitle}</span>`;

      item.addEventListener("click", (e) => {
        e.preventDefault();
        this.goToChapter(i);

        if (window.innerWidth < 768) {
          const sidebar = document.getElementById("sidebar");
          const overlay = document.getElementById("overlay");

          if (sidebar) sidebar.classList.remove("open");
          if (overlay) overlay.classList.remove("visible");
        }
      });

      navElement.appendChild(item);
    }
  }

  refreshActiveChapterInNav() {
    const navElement = document.getElementById("chapter-nav");
    if (!navElement) return;

    const allItems = navElement.querySelectorAll(".chapter-item");
    allItems.forEach((item) => {
      item.classList.remove("active");
    });

    const currentItem = navElement.querySelector(
      `[data-chapter="${this.currentChapter}"]`,
    );
    if (currentItem) {
      currentItem.classList.add("active");
    }

    console.log(`📍 Updated active chapter in nav: ${this.currentChapter}`);
  }

  async goToPreviousChapter() {
    if (this.currentChapter > 1) {
      await this.goToChapter(this.currentChapter - 1);
    }
  }

  async goToNextChapter() {
    if (this.currentChapter < this.totalChapters) {
      await this.goToChapter(this.currentChapter + 1);
    }
  }

  async goToChapter(chapterNumber) {
    chapterNumber = parseInt(chapterNumber);
    if (chapterNumber < 1) chapterNumber = 1;
    if (chapterNumber > this.totalChapters) chapterNumber = this.totalChapters;

    const currentContentElement = document.getElementById("chapter-content");

    if (currentContentElement && window.mediaInjector) {
      window.mediaInjector.stopAllCurrentPlayers();
    }

    const hasContent =
      currentContentElement &&
      currentContentElement.children.length > 0 &&
      !currentContentElement.querySelector(
        ".loading, .placeholder-chapter, .error-chapter",
      );

    if (this.currentChapter === chapterNumber && hasContent) {
      console.log(
        `📖 Already on chapter ${chapterNumber} with content, skipping reload`,
      );
      this.updateNavigationUI();
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    console.log(`📖 Loading chapter ${chapterNumber}...`);

    this.currentChapter = chapterNumber;
    this.saveLastChapter();

    if (currentContentElement) {
      currentContentElement.innerHTML = `
        <div class="loading">
          <div class="spinner"></div>
          <p>Загрузка главы ${chapterNumber}...</p>
        </div>
      `;
    }

    try {
      const content = await this.loadChapter(chapterNumber);

      if (currentContentElement) {
        let chapterTitle =
          this.chapterTitles[chapterNumber] || `Глава ${chapterNumber}`;

        const tempDoc = new DOMParser().parseFromString(content, "text/html");
        const firstH2 = tempDoc.querySelector("h2");
        if (firstH2 && firstH2.textContent.trim()) {
          chapterTitle = firstH2.textContent.trim();
          this.chapterTitles[chapterNumber] = chapterTitle;
        }

        currentContentElement.innerHTML = content;
        this.updateNavigationUI();

        const breadcrumb = document.getElementById("current-chapter-title");
        if (breadcrumb) {
          breadcrumb.textContent = `Глава ${chapterNumber}`;
          document.title = `${chapterTitle} - LitOverlay`;
        }

        window.scrollTo({ top: 0, behavior: "smooth" });

        this.setupParagraphHighlighting();
        this.centerSpecialElements();

        if (window.mediaInjector) {
          window.mediaInjector.reinitializeAudioPlayersInContainer(
            currentContentElement,
          );
        } else {
          console.warn(
            "ChapterLoader: MediaInjector not found when trying to reinitialize players.",
          );
        }

        this.refreshActiveChapterInNav();
        if (window.hintInjector) {
          window.hintInjector.setupHintTooltips();
        }
      }
    } catch (error) {
      console.error("Error loading chapter:", error);
      if (currentContentElement) {
        currentContentElement.innerHTML =
          this.createErrorChapter(chapterNumber);
        this.updateNavigationUI();
      }
    }
  }

  updateNavigationUI() {
    const prevBtn = document.getElementById("prev-chapter");
    const nextBtn = document.getElementById("next-chapter");
    const breadcrumb = document.getElementById("current-chapter-title");

    let prevChapterTitle = `Глава ${this.currentChapter - 1}`;
    let nextChapterTitle = `Глава ${this.currentChapter + 1}`;

    if (this.currentChapter > 1) {
      prevChapterTitle =
        this.chapterTitles[this.currentChapter - 1] ||
        `Глава ${this.currentChapter - 1}`;
    }

    if (this.currentChapter < this.totalChapters) {
      nextChapterTitle =
        this.chapterTitles[this.currentChapter + 1] ||
        `Глава ${this.currentChapter + 1}`;
    }

    if (prevBtn) {
      prevBtn.disabled = this.currentChapter <= 1;
      prevBtn.innerHTML =
        this.currentChapter > 1
          ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M15.41 16.59L10.83 12l4.58-4.59L14 6l-6 6 6 6 1.41-1.41z"/>
                </svg> ${prevChapterTitle}`
          : `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M15.41 16.59L10.83 12l4.58-4.59L14 6l-6 6 6 6 1.41-1.41z"/>
                </svg> Начало`;
    }

    if (nextBtn) {
      nextBtn.disabled = this.currentChapter >= this.totalChapters;
      nextBtn.innerHTML =
        this.currentChapter < this.totalChapters
          ? `${nextChapterTitle} 
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z"/>
                </svg>`
          : `Конец 
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z"/>
                </svg>`;
    }

    if (breadcrumb) {
      const chapterTitle =
        this.chapterTitles[this.currentChapter] ||
        `Глава ${this.currentChapter}`;
      const shortTitle =
        chapterTitle.length > 30
          ? chapterTitle.substring(0, 27) + "..."
          : chapterTitle;
      breadcrumb.textContent = shortTitle;
    }

    this.refreshActiveChapterInNav();
  }

  setupParagraphHighlighting() {
    const contentElement = document.getElementById("chapter-content");
    if (!contentElement) return;

    const paragraphs = contentElement.querySelectorAll("p");

    paragraphs.forEach((paragraph) => {
      if (!this.isParagraphHighlightable(paragraph)) {
        paragraph.classList.add("no-highlight");
        return;
      }

      paragraph.classList.add("highlightable");

      paragraph.addEventListener("click", () => {
        const currentlyHighlighted =
          contentElement.querySelector("p.highlighted");

        if (paragraph.classList.contains("highlighted")) {
          paragraph.classList.remove("highlighted");
        } else {
          if (currentlyHighlighted) {
            currentlyHighlighted.classList.remove("highlighted");
          }

          paragraph.classList.add("highlighted");
        }
      });
    });
  }

  isParagraphHighlightable(paragraph) {
    const text = paragraph.textContent.trim();

    if (
      text === "***" ||
      text === "---" ||
      text === "* * *" ||
      text === "- - -" ||
      text === "•••" ||
      text === "···" ||
      /^[*\-•…]{3,}$/.test(text)
    ) {
      return false;
    }

    if (!text || text === "" || text === " ") {
      return false;
    }

    if (/^[\s\n\r]*$/.test(text)) {
      return false;
    }

    const htmlContent = paragraph.innerHTML.trim();
    if (
      htmlContent === "<br>" ||
      htmlContent === "<br/>" ||
      htmlContent === "<br />"
    ) {
      return false;
    }

    if (paragraph.querySelector("img, audio, video, iframe, object, embed")) {
      return false;
    }

    return true;
  }

  centerSpecialElements() {
    const contentElement = document.getElementById("chapter-content");
    if (!contentElement) return;

    const h2Elements = contentElement.querySelectorAll("h2");
    h2Elements.forEach((h2) => {
      h2.style.textAlign = "center";
      h2.classList.add("centered-heading");
    });

    const paragraphs = contentElement.querySelectorAll("p");
    paragraphs.forEach((p) => {
      const text = p.textContent.trim();

      if (
        text === "***" ||
        text === "---" ||
        text === "* * *" ||
        text === "- - -"
      ) {
        p.style.textAlign = "center";
        p.style.fontWeight = "bold";
        p.style.opacity = "0.7";
        p.style.margin = "2rem 0";
        p.style.fontSize = "1.2em";
        p.classList.add("divider-paragraph");
      }

      const cleanText = text.replace(/\*/g, "").replace(/-/g, "").trim();
      if (cleanText === "" && (text.includes("*") || text.includes("-"))) {
        p.style.textAlign = "center";
        p.classList.add("divider-paragraph");
      }
    });

    const mediaContainers = contentElement.querySelectorAll(
      ".media-container, .audio-player-container",
    );
    mediaContainers.forEach((container) => {
      container.style.marginLeft = "auto";
      container.style.marginRight = "auto";
      container.style.maxWidth = "600px";

      const player = container.querySelector(".custom-audio-player");
      if (player) {
        player.style.marginLeft = "auto";
        player.style.marginRight = "auto";
        player.style.maxWidth = "600px";
        player.style.textAlign = "left";
      }
    });

    const images = contentElement.querySelectorAll(
      "img:not(.play-icon):not(.pause-icon):not(.volume-icon):not(.muted-icon)",
    );
    images.forEach((img) => {
      img.style.display = "block";
      img.style.marginLeft = "auto";
      img.style.marginRight = "auto";
    });
  }

  getCurrentChapter() {
    return this.currentChapter;
  }

  getTotalChapters() {
    return this.totalChapters;
  }
}

export default ChapterLoader;
