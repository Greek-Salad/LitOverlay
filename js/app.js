// js/app.js

import Utils from "./utils.js";
import ThemeManager from "./theme-manager.js";
import SettingsManager from "./settings-manager.js";
import ChapterLoader from "./chapter-loader.js";
import SearchManager from "./search-manager.js";
import MediaInjector from "./media-injector.js";
import HintInjector from "./hint-injector.js";
import AudioManager from "./audio-manager.js";
import CustomColorPicker from "./color-picker.js";

class ReadingApp {
  constructor() {
    this.themeManager = null;
    this.settingsManager = null;
    this.chapterLoader = null;
    this.searchManager = null;
    this.mediaInjector = null;
    this.isInitialized = false;
    this.initializationError = null;
    this.themeToggleHandler = null;
    this.hintInjector = null;
    this.audioManager = null;
  }

  async init() {
    if (this.isInitialized) return;

    console.log("🚀 Starting Reading App...");

    try {
      this.settingsManager = new SettingsManager();
      this.themeManager = new ThemeManager();

      this.audioManager = new AudioManager();
      window.audioManager = this.audioManager;

      this.mediaInjector = new MediaInjector(
        this.themeManager,
        this.audioManager,
      );
      await this.mediaInjector.init();

      window.mediaInjector = this.mediaInjector;

      this.hintInjector = new HintInjector();
      await this.hintInjector.init();

      window.hintInjector = this.hintInjector;

      this.chapterLoader = new ChapterLoader();
      await this.chapterLoader.init();

      this.searchManager = new SearchManager();

      this.setupUI();
      this.setupScrollProgressIndicator();

      this.isInitialized = true;
      console.log("✅ Reading App fully initialized!");

      this.hideLoadingOverlay();
      window.readingApp = this;

      console.log("🔍 Debug info:");
      console.log("- ThemeManager:", this.themeManager ? "OK" : "NULL");
      console.log("- SettingsManager:", this.settingsManager ? "OK" : "NULL");
      console.log("- ChapterLoader:", this.chapterLoader ? "OK" : "NULL");
      console.log("- SearchManager:", this.searchManager ? "OK" : "NULL");
      console.log("- MediaInjector:", this.mediaInjector ? "OK" : "NULL");

      if (this.chapterLoader) {
        const chapter = this.chapterLoader.getCurrentChapter();
        console.log(`- Current chapter: ${chapter}`);

        if (this.mediaInjector) {
          const mediaRules = this.mediaInjector.mediaRules.filter(
            (r) => r.chapter === chapter,
          );
          console.log(
            `- Media rules for chapter ${chapter}:`,
            mediaRules.length,
          );
        }
      }
    } catch (error) {
      console.error("❌ Failed to initialize app:", error);
      this.showErrorState(error);
      this.hideLoadingOverlay();
    }
  }

  checkRequiredElements() {
    const requiredElements = [
      "chapter-content",
      "reading-area",
      "menu-toggle",
      "theme-toggle",
      "settings-toggle",
    ];

    const missingElements = requiredElements.filter(
      (id) => !document.getElementById(id),
    );

    if (missingElements.length > 0) {
      throw new Error(
        `Missing required DOM elements: ${missingElements.join(", ")}`,
      );
    }
  }

  hideLoadingOverlay() {
    const loadingOverlay = document.getElementById("loading-overlay");
    if (loadingOverlay) {
      loadingOverlay.style.transition =
        "opacity 0.3s ease, visibility 0.3s ease";
      loadingOverlay.style.opacity = "0";
      loadingOverlay.style.visibility = "hidden";

      setTimeout(() => {
        if (loadingOverlay.parentNode) {
          loadingOverlay.remove();
        }
      }, 300);
    }
  }

  setupUI() {
    this.setupMenu();
    this.setupLyricsPanel();
  }

  setupLyricsPanel() {
    const lyricsPanel = document.getElementById("lyrics-panel");
    const closeBtn = document.getElementById("close-lyrics-btn");
    const overlay = document.getElementById("overlay");

    if (closeBtn) {
      closeBtn.addEventListener("click", () => {
        lyricsPanel.classList.remove("open");
        if (overlay) overlay.classList.remove("visible");
      });
    }

    if (overlay) {
      overlay.addEventListener("click", () => {
        lyricsPanel.classList.remove("open");
        overlay.classList.remove("visible");
      });
    }
  }

  setupMenu() {
    const menuToggle = document.getElementById("menu-toggle");
    const closeSidebar = document.getElementById("close-sidebar");
    const overlay = document.getElementById("overlay");
    const sidebar = document.getElementById("sidebar");

    if (menuToggle && sidebar) {
      menuToggle.addEventListener("click", () => {
        sidebar.classList.add("open");
        if (overlay) overlay.classList.add("visible");
      });
    }

    if (closeSidebar && sidebar) {
      closeSidebar.addEventListener("click", () => {
        sidebar.classList.remove("open");
        if (overlay) overlay.classList.remove("visible");
      });
    }

    if (overlay) {
      overlay.addEventListener("click", () => {
        if (sidebar) sidebar.classList.remove("open");
        overlay.classList.remove("visible");

        const settingsPanel = document.getElementById("settings-panel");
        if (settingsPanel) settingsPanel.classList.remove("open");
      });
    }
  }

  setupScrollProgressIndicator() {
    const readingArea = document.querySelector(".reading-area");
    const progressBar = document.getElementById("reading-progress-bar");
    const progressValue = document.getElementById("reading-progress-value");

    if (!readingArea || !progressBar || !progressValue) {
      console.warn("Scroll progress elements not found");
      return;
    }

    const updateProgress = () => {
      const scrollTop = readingArea.scrollTop;
      const clientHeight = readingArea.clientHeight;
      const scrollHeight = readingArea.scrollHeight;
      const maxScrollTop = scrollHeight - clientHeight;

      let scrollPercentage = 0;
      if (maxScrollTop > 0) {
        scrollPercentage = (scrollTop / maxScrollTop) * 100;
        scrollPercentage = Math.min(100, Math.max(0, scrollPercentage));
      }

      progressBar.style.setProperty("--progress-width", `${scrollPercentage}%`);
      progressValue.textContent = `${Math.round(scrollPercentage)}%`;
    };

    const debouncedUpdate = Utils.debounce(updateProgress, 10);
    readingArea.addEventListener("scroll", debouncedUpdate);

    updateProgress();
  }

  setupErrorHandling() {
    window.addEventListener("error", (event) => {
      console.error("Global error:", event.error);
    });

    window.addEventListener("unhandledrejection", (event) => {
      console.error("Unhandled promise rejection:", event.reason);
    });
  }

  showErrorState(error) {
    this.hideLoadingOverlay();
    const contentElement = document.getElementById("chapter-content");
    if (!contentElement) return;

    const errorHTML = `
      <div class="error-chapter">
        <h1 class="chapter-title">Ошибка запуска приложения</h1>
        <p class="chapter-meta">${error.message || "Неизвестная ошибка"}</p>
        
        <div class="error-content">
          <p>Приложение не смогло запуститься. Попробуйте:</p>
          <div class="error-actions">
            <button onclick="location.reload()" class="error-btn">
              Обновить страницу
            </button>
            <button onclick="localStorage.clear(); location.reload()" class="error-btn">
              Очистить данные и обновить
            </button>
          </div>
          <div class="error-details" style="margin-top: 1rem; font-size: 0.8rem; color: #666;">
            <details>
              <summary>Детали ошибки</summary>
              <pre style="text-align: left; margin-top: 0.5rem;">${error.stack || error.toString()}</pre>
            </details>
          </div>
        </div>
      </div>
    `;

    contentElement.innerHTML = errorHTML;
  }

  getThemeManager() {
    return this.themeManager;
  }

  getChapterLoader() {
    return this.chapterLoader;
  }

  getSettingsManager() {
    return this.settingsManager;
  }

  getSearchManager() {
    return this.searchManager;
  }

  getMediaInjector() {
    return this.mediaInjector;
  }

  getHintInjector() {
    return this.hintInjector;
  }

  cleanup() {
    if (this.mediaInjector) {
      this.mediaInjector.cleanup();
    }

    this.isInitialized = false;
    delete window.readingApp;
  }
}

function setupIOSAudioHandling() {
  if (/iPhone|iPad|iPod/.test(navigator.userAgent)) {
    document.addEventListener(
      "touchstart",
      () => {
        const audioContext = new (
          window.AudioContext || window.webkitAudioContext
        )();
        audioContext
          .resume()
          .then(() => {
            audioContext.close();
          })
          .catch((e) => console.log("AudioContext init:", e));
      },
      { once: true },
    );
  }
}

document.addEventListener("DOMContentLoaded", () => {
  console.log("📄 DOM loaded, starting app...");

  setupIOSAudioHandling();

  const app = new ReadingApp();

  setTimeout(() => {
    app.init().catch((error) => {
      console.error("App initialization failed:", error);
      app.showErrorState(error);
      app.hideLoadingOverlay();
    });
  }, 100);

  if (
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1"
  ) {
    window.debugApp = () => {
      console.log("📋 App state:", {
        themeManager: app.themeManager,
        chapterLoader: app.chapterLoader,
        settingsManager: app.settingsManager,
        searchManager: app.searchManager,
        mediaInjector: app.mediaInjector,
        isInitialized: app.isInitialized,
        error: app.initializationError,
      });
    };

    console.log("\n📋 Debug commands available:");
    console.log("window.debugApp() - show app state");
    console.log("window.readingApp - access app instance");
  }
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden && window.readingApp?.mediaInjector) {
    window.readingApp.mediaInjector.stopAllCurrentPlayers();
  }
});

window.addEventListener("beforeunload", () => {
  if (window.readingApp) {
    window.readingApp.mediaInjector?.stopAllCurrentPlayers();
  }
});
