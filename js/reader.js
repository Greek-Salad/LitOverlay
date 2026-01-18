"use strict";

const Utils = {
  saveToStorage(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.warn("Failed to save to localStorage:", error);
      return false;
    }
  },

  loadFromStorage(key, defaultValue = null) {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch (error) {
      console.warn("Failed to load from localStorage:", error);
      return defaultValue;
    }
  },

  hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16),
        }
      : null;
  },

  isDarkColor(color) {
    const rgb = this.hexToRgb(color);
    if (!rgb) return false;

    const brightness = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
    return brightness < 128;
  },

  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  },
};

class CustomColorPicker {
  constructor(options = {}) {
    this.options = {
      target: options.target,
      currentColor: options.currentColor || "#ffffff",
      onSelect: options.onSelect || (() => {}),
      position: options.position || "center",
    };

    this.color = this.options.currentColor;
    this.hsl = this.rgbToHsl(this.hexToRgb(this.color));
    this.init();
  }

  init() {
    this.createPopup();
    this.setupEventListeners();
    this.updateSliders();
    this.positionPopup();
  }

  createPopup() {
    this.popup = document.createElement("div");
    this.popup.className = "custom-color-picker";
    this.popup.innerHTML = `
            <div class="color-picker-header">
                <h4>Выбор цвета</h4>
                <button class="close-picker" aria-label="Закрыть">×</button>
            </div>
            <div class="color-picker-body">
                <div class="color-preview" style="background-color: ${this.color}"></div>
                <div class="hsl-controls">
                    <div class="hsl-slider">
                        <label>Оттенок (H)</label>
                        <input type="range" class="hue-slider" min="0" max="360" value="${this.hsl.h}">
                        <span class="hue-value">${this.hsl.h}°</span>
                    </div>
                    <div class="hsl-slider">
                        <label>Насыщенность (S)</label>
                        <input type="range" class="saturation-slider" min="0" max="100" value="${this.hsl.s}">
                        <span class="saturation-value">${this.hsl.s}%</span>
                    </div>
                    <div class="hsl-slider">
                        <label>Яркость (L)</label>
                        <input type="range" class="lightness-slider" min="0" max="100" value="${this.hsl.l}">
                        <span class="lightness-value">${this.hsl.l}%</span>
                    </div>
                </div>
                <div class="color-presets">
                    <div class="preset-title">Быстрые цвета:</div>
                    <div class="preset-grid">
                        <button class="color-preset" style="background-color: #ffffff" data-color="#ffffff"></button>
                        <button class="color-preset" style="background-color: #f8f9fa" data-color="#f8f9fa"></button>
                        <button class="color-preset" style="background-color: #e9ecef" data-color="#e9ecef"></button>
                        <button class="color-preset" style="background-color: #dee2e6" data-color="#dee2e6"></button>
                        <button class="color-preset" style="background-color: #ced4da" data-color="#ced4da"></button>
                        <button class="color-preset" style="background-color: #000000" data-color="#000000"></button>
                        <button class="color-preset" style="background-color: #212529" data-color="#212529"></button>
                        <button class="color-preset" style="background-color: #343a40" data-color="#343a40"></button>
                        <button class="color-preset" style="background-color: #495057" data-color="#495057"></button>
                        <button class="color-preset" style="background-color: #6c757d" data-color="#6c757d"></button>
                        <button class="color-preset" style="background-color: #1e88e5" data-color="#1e88e5"></button>
                        <button class="color-preset" style="background-color: #43a047" data-color="#43a047"></button>
                    </div>
                </div>
                <div class="color-picker-actions">
                    <button class="cancel-btn">Отмена</button>
                    <button class="apply-btn">Применить</button>
                </div>
            </div>
        `;

    document.body.appendChild(this.popup);
  }

  positionPopup() {
    const popupRect = this.popup.getBoundingClientRect();
    const padding = 20;

    let top = (window.innerHeight - popupRect.height) / 2;
    let left = (window.innerWidth - popupRect.width) / 2;

    top = Math.max(
      padding,
      Math.min(top, window.innerHeight - popupRect.height - padding),
    );
    left = Math.max(
      padding,
      Math.min(left, window.innerWidth - popupRect.width - padding),
    );

    this.popup.style.top = `${top}px`;
    this.popup.style.left = `${left}px`;

    setTimeout(() => {
      this.popup.classList.add("positioned");
    }, 10);
  }

  setupEventListeners() {
    const hueSlider = this.popup.querySelector(".hue-slider");
    const saturationSlider = this.popup.querySelector(".saturation-slider");
    const lightnessSlider = this.popup.querySelector(".lightness-slider");

    const updateFromSliders = () => {
      this.hsl = {
        h: parseInt(hueSlider.value),
        s: parseInt(saturationSlider.value),
        l: parseInt(lightnessSlider.value),
      };

      this.color = this.hslToHex(this.hsl);
      this.updatePreview();
      this.updateValueDisplays();
    };

    hueSlider.addEventListener("input", updateFromSliders);
    saturationSlider.addEventListener("input", updateFromSliders);
    lightnessSlider.addEventListener("input", updateFromSliders);

    const presets = this.popup.querySelectorAll(".color-preset");
    presets.forEach((preset) => {
      preset.addEventListener("click", () => {
        const color = preset.dataset.color;
        this.setColor(color);
      });
    });

    this.popup
      .querySelector(".close-picker")
      .addEventListener("click", () => this.close());
    this.popup
      .querySelector(".cancel-btn")
      .addEventListener("click", () => this.close());
    this.popup.querySelector(".apply-btn").addEventListener("click", () => {
      this.options.onSelect(this.color);
      this.close();
    });

    document.addEventListener("click", (e) => {
      if (
        this.popup &&
        !this.popup.contains(e.target) &&
        e.target !== this.options.target
      ) {
        this.close();
      }
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && this.popup.parentNode) {
        this.close();
      }
    });
  }

  updatePreview() {
    const preview = this.popup.querySelector(".color-preview");
    if (preview) {
      preview.style.backgroundColor = this.color;
    }
  }

  updateValueDisplays() {
    const hueValue = this.popup.querySelector(".hue-value");
    const saturationValue = this.popup.querySelector(".saturation-value");
    const lightnessValue = this.popup.querySelector(".lightness-value");

    if (hueValue) hueValue.textContent = `${this.hsl.h}°`;
    if (saturationValue) saturationValue.textContent = `${this.hsl.s}%`;
    if (lightnessValue) lightnessValue.textContent = `${this.hsl.l}%`;
  }

  updateSliders() {
    const hueSlider = this.popup.querySelector(".hue-slider");
    const saturationSlider = this.popup.querySelector(".saturation-slider");
    const lightnessSlider = this.popup.querySelector(".lightness-slider");

    if (hueSlider) hueSlider.value = this.hsl.h;
    if (saturationSlider) saturationSlider.value = this.hsl.s;
    if (lightnessSlider) lightnessSlider.value = this.hsl.l;

    this.updateValueDisplays();
  }

  setColor(color) {
    const rgb = this.hexToRgb(color);
    if (!rgb) return;

    this.color = color;
    this.hsl = this.rgbToHsl(rgb);
    this.updatePreview();
    this.updateSliders();
  }

  hexToRgb(hex) {
    return Utils.hexToRgb(hex);
  }

  rgbToHsl(rgb) {
    let r = rgb.r / 255;
    let g = rgb.g / 255;
    let b = rgb.b / 255;

    let max = Math.max(r, g, b);
    let min = Math.min(r, g, b);
    let h,
      s,
      l = (max + min) / 2;

    if (max === min) {
      h = s = 0;
    } else {
      let d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

      switch (max) {
        case r:
          h = (g - b) / d + (g < b ? 6 : 0);
          break;
        case g:
          h = (b - r) / d + 2;
          break;
        case b:
          h = (r - g) / d + 4;
          break;
      }

      h /= 6;
    }

    return {
      h: Math.round(h * 360),
      s: Math.round(s * 100),
      l: Math.round(l * 100),
    };
  }

  hslToHex(hsl) {
    let h = hsl.h / 360;
    let s = hsl.s / 100;
    let l = hsl.l / 100;

    let r, g, b;

    if (s === 0) {
      r = g = b = l;
    } else {
      const hue2rgb = (p, q, t) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1 / 6) return p + (q - p) * 6 * t;
        if (t < 1 / 2) return q;
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
        return p;
      };

      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;

      r = hue2rgb(p, q, h + 1 / 3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1 / 3);
    }

    const toHex = (c) => {
      const hex = Math.round(c * 255).toString(16);
      return hex.length === 1 ? "0" + hex : hex;
    };

    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }

  open() {
    this.popup.style.display = "block";
    this.positionPopup();
    setTimeout(() => {
      this.popup.classList.add("open");
    }, 10);
  }

  close() {
    this.popup.classList.remove("open");
    setTimeout(() => {
      if (this.popup.parentNode) {
        this.popup.parentNode.removeChild(this.popup);
      }
    }, 300);
  }
}

class ThemeManager {
  constructor() {
    this.PRESETS = {
      light: {
        bg: "#ffffff",
        text: "#000000",
      },
      dark: {
        bg: "#202124",
        text: "#e8eaed",
      },
    };

    this.currentPreset = "light";
    this.customColors = { ...this.PRESETS.light };
    this.isApplying = false;
    this.init();
  }

  init() {
    this.loadSavedState();
    this.applyTheme();
    this.setupEventListeners();
    console.log("✅ ThemeManager initialized");
  }

  loadSavedState() {
    const savedPreset = Utils.loadFromStorage("themePreset", "light");
    const savedColors = Utils.loadFromStorage(
      "themeColors",
      this.PRESETS.light,
    );

    this.currentPreset = savedPreset;
    this.customColors = savedColors;
  }

  saveState() {
    Utils.saveToStorage("themePreset", this.currentPreset);
    Utils.saveToStorage("themeColors", this.customColors);
  }

  applyTheme() {
    if (this.isApplying) return;
    this.isApplying = true;

    try {
      document.body.setAttribute("data-theme", this.currentPreset);

      this.updateDerivedColors();

      this.updateIcons();

      this.updateColorPreviews();

      this.updatePresetButtons();

      this.updateAudioPlayerIcons();

      this.saveState();

      console.log(
        `🎨 Applied theme preset: ${this.currentPreset}, colors:`,
        this.customColors,
      );
    } catch (error) {
      console.error("Error applying theme:", error);
    } finally {
      this.isApplying = false;
    }
  }

  updateDerivedColors() {
    const root = document.documentElement;
    const bgColor = this.customColors.bg;
    const textColor = this.customColors.text;
    const isBgDark = Utils.isDarkColor(bgColor);
    const isTextDark = Utils.isDarkColor(textColor);

    try {
      root.style.setProperty("--bg-color", bgColor);
      root.style.setProperty("--text-color", textColor);

      const sidebarBg = this.adjustColor(bgColor, isBgDark ? 0.05 : -0.05);
      root.style.setProperty("--sidebar-bg", sidebarBg);
      root.style.setProperty("--sidebar-text", textColor);

      const settingsBg = this.adjustColor(bgColor, isBgDark ? 0.05 : -0.05);
      root.style.setProperty("--settings-bg", settingsBg);
      root.style.setProperty("--settings-text", textColor);

      const toolbarBg = this.adjustColor(bgColor, isBgDark ? 0.03 : -0.03);
      root.style.setProperty("--toolbar-bg", toolbarBg);

      const btnBg = this.adjustColor(bgColor, isBgDark ? 0.1 : -0.1);
      root.style.setProperty("--btn-bg", btnBg);
      root.style.setProperty("--btn-text", textColor);

      const btnHover = this.adjustColor(btnBg, 0.1);
      root.style.setProperty("--btn-hover", btnHover);

      const btnActive = this.adjustColor(btnBg, 0.15);
      root.style.setProperty("--btn-active", btnActive);

      const borderColor = this.adjustColor(bgColor, isBgDark ? 0.15 : -0.15);
      root.style.setProperty("--border-color", borderColor);

      const linkColor = this.adjustColor(textColor, isTextDark ? -0.3 : 0.3);
      root.style.setProperty("--link-color", linkColor);
      root.style.setProperty("--link-hover", this.adjustColor(linkColor, 0.1));

      const highlightOpacity = isBgDark ? 0.2 : 0.1;
      const highlightColor = this.mixColors(
        textColor,
        bgColor,
        highlightOpacity,
      );
      root.style.setProperty("--highlight-bg", highlightColor);

      const progressBg = this.adjustColor(bgColor, isBgDark ? 0.1 : -0.1);
      const progressFill = this.adjustColor(linkColor, isBgDark ? 0.1 : -0.1);

      root.style.setProperty("--progress-bg", progressBg);
      root.style.setProperty("--progress-fill", progressFill);
      root.style.setProperty("--player-bg", bgColor);
      root.style.setProperty("--player-border", borderColor);
    } catch (error) {
      console.error("Error updating derived colors:", error);
    }
  }

  adjustColor(color, amount) {
    try {
      const hex = color.replace("#", "");
      const num = parseInt(hex, 16);

      let r = (num >> 16) + Math.round(amount * 255);
      let g = ((num >> 8) & 0x00ff) + Math.round(amount * 255);
      let b = (num & 0x0000ff) + Math.round(amount * 255);

      r = Math.min(Math.max(r, 0), 255);
      g = Math.min(Math.max(g, 0), 255);
      b = Math.min(Math.max(b, 0), 255);

      return `#${(b | (g << 8) | (r << 16)).toString(16).padStart(6, "0")}`;
    } catch (error) {
      console.error("Error adjusting color:", error);
      return color;
    }
  }

  mixColors(color1, color2, weight) {
    try {
      const hex1 = color1.replace("#", "");
      const hex2 = color2.replace("#", "");

      const rgb1 = {
        r: parseInt(hex1.substr(0, 2), 16),
        g: parseInt(hex1.substr(2, 2), 16),
        b: parseInt(hex1.substr(4, 2), 16),
      };

      const rgb2 = {
        r: parseInt(hex2.substr(0, 2), 16),
        g: parseInt(hex2.substr(2, 2), 16),
        b: parseInt(hex2.substr(4, 2), 16),
      };

      const r = Math.round(rgb1.r * weight + rgb2.r * (1 - weight));
      const g = Math.round(rgb1.g * weight + rgb2.g * (1 - weight));
      const b = Math.round(rgb1.b * weight + rgb2.b * (1 - weight));

      return `rgb(${r}, ${g}, ${b})`;
    } catch (error) {
      console.error("Error mixing colors:", error);
      return color1;
    }
  }

  updateIcons() {
    const isBgDark = Utils.isDarkColor(this.customColors.bg);
    const isTextDark = Utils.isDarkColor(this.customColors.text);

    const iconSuffix = isTextDark ? "black" : "white";

    const menuIcon = document.getElementById("menu-icon");
    if (menuIcon) {
      menuIcon.src = `./icons/menu-${iconSuffix}.svg`;
    }

    const themeIcon = document.getElementById("theme-icon");
    if (themeIcon) {
      themeIcon.src = `./icons/${isBgDark ? "sun" : "moon"}.svg`;
      themeIcon.alt = isBgDark
        ? "Переключить на светлую тему"
        : "Переключить на тёмную тему";
    }
  }

  updateAudioPlayerIcons() {
    const isBgDark = Utils.isDarkColor(this.customColors.bg);

    const iconColor = isBgDark ? "#ffffff" : "#333333";

    document.querySelectorAll(".custom-audio-player svg").forEach((svg) => {
      svg.style.fill = iconColor;
    });

    console.log(`🎨 Updated audio player icons to: ${iconColor}`);
  }

  updateAudioPlayerIconsForElement(singlePlayerElement) {
    if (!singlePlayerElement) {
      console.warn(
        "ThemeManager: Cannot update icons, player element is null or undefined.",
      );
      return;
    }
    const isBgDark = Utils.isDarkColor(this.customColors.bg);
    const iconColor = isBgDark ? "#ffffff" : "#333333";
    singlePlayerElement.querySelectorAll("svg").forEach((svg) => {
      svg.style.fill = iconColor;
    });
  }

  updateColorPreviews() {
    const bgPicker = document.getElementById("bg-color-picker");
    const textPicker = document.getElementById("text-color-picker");

    if (bgPicker) {
      bgPicker.dataset.color = this.customColors.bg;
      const preview = bgPicker.querySelector(".color-preview");
      if (preview) {
        preview.style.backgroundColor = this.customColors.bg;
      }
    }

    if (textPicker) {
      textPicker.dataset.color = this.customColors.text;
      const preview = textPicker.querySelector(".color-preview");
      if (preview) {
        preview.style.backgroundColor = this.customColors.text;
      }
    }
  }

  updatePresetButtons() {
    const presetButtons = document.querySelectorAll(".theme-preset-btn");
    presetButtons.forEach((btn) => {
      if (btn.dataset.theme === this.currentPreset) {
        btn.classList.add("active");
      } else {
        btn.classList.remove("active");
      }
    });
  }

  setupEventListeners() {
    const themeToggle = document.getElementById("theme-toggle");
    if (themeToggle) {
      themeToggle.addEventListener("click", (e) => {
        e.stopPropagation();
        this.togglePreset();
      });
    }

    const presetButtons = document.querySelectorAll(".theme-preset-btn");
    presetButtons.forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const preset = btn.dataset.theme;
        this.applyPreset(preset);
      });
    });

    const bgPicker = document.getElementById("bg-color-picker");
    const textPicker = document.getElementById("text-color-picker");

    if (bgPicker) {
      bgPicker.addEventListener("click", (e) => {
        e.stopPropagation();
        this.openCustomColorPicker("bg");
      });
    }

    if (textPicker) {
      textPicker.addEventListener("click", (e) => {
        e.stopPropagation();
        this.openCustomColorPicker("text");
      });
    }
  }

  togglePreset() {
    const newPreset = this.currentPreset === "light" ? "dark" : "light";
    this.applyPreset(newPreset);
  }

  applyPreset(preset) {
    if (!this.PRESETS[preset] || this.currentPreset === preset) return;

    console.log(`🎯 Applying preset: ${preset}`);

    this.currentPreset = preset;

    this.customColors = { ...this.PRESETS[preset] };

    this.applyTheme();
  }

  openCustomColorPicker(type) {
    const currentColor = this.customColors[type];
    const targetElement = document.getElementById(`${type}-color-picker`);

    const picker = new CustomColorPicker({
      target: targetElement,
      currentColor: currentColor,
      onSelect: (color) => {
        this.setCustomColor(type, color);
      },
      position: "center",
    });

    picker.open();
  }

  setCustomColor(type, color) {
    if (!color || this.customColors[type] === color) return;

    console.log(`🎨 Setting custom ${type} color: ${color}`);

    this.customColors[type] = color;

    const matchesLight =
      JSON.stringify(this.customColors) === JSON.stringify(this.PRESETS.light);
    const matchesDark =
      JSON.stringify(this.customColors) === JSON.stringify(this.PRESETS.dark);

    if (matchesLight) {
      this.currentPreset = "light";
    } else if (matchesDark) {
      this.currentPreset = "dark";
    } else {
      this.currentPreset = "custom";
    }

    this.applyTheme();
  }

  getCurrentPreset() {
    return this.currentPreset;
  }

  getCustomColors() {
    return { ...this.customColors };
  }
}

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

      for (let i = 1; i <= this.totalChapters; i++) {
          const chapterInfo = this.chapterFiles.find((c) => c.number === i && c.exists);
          if (!chapterInfo) continue;

          try {
              const response = await fetch(`./chapters/${chapterInfo.filename}`, {
                  cache: "no-cache",
                  method: "GET"
              });

              if (!response.ok) {
                  throw new Error(`HTTP ${response.status}`);
              }

              const html = await response.text();
              const tempDoc = new DOMParser().parseFromString(html, "text/html");
              const firstH2 = tempDoc.querySelector("h2");

              if (firstH2) {
                  this.chapterTitles[i] = firstH2.textContent.trim();
                  console.log(`📚 Title for chapter ${i}: ${this.chapterTitles[i]}`);
              } else {
                  this.chapterTitles[i] = `Глава ${i}`;
                  console.log(`📚 Title for chapter ${i} not found, using fallback: ${this.chapterTitles[i]}`);
              }
          } catch (error) {
              console.error(`Error loading title for chapter ${i}:`, error);
              this.chapterTitles[i] = `Глава ${i}`;
          }
      }
      console.log("📚 Finished loading chapter titles:", this.chapterTitles);
  }

  async scanChapters() {
    this.chapterFiles = [];
    const maxChapters = 99;

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
      }
    }

    this.totalChapters = this.chapterFiles.length;

    if (this.totalChapters === 0) {
      console.log("No chapters found, creating placeholder");
      this.createPlaceholderChapter();
      this.totalChapters = 1;
    }

    console.log(`📚 Total chapters found: ${this.totalChapters}`);
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
                <h1 class="chapter-title">Загрузка главы...</h1>
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

      const item = document.createElement("a");
      item.className = `chapter-item ${isActive ? "active" : ""}`;
      item.href = "#";
      item.dataset.chapter = i;
      item.innerHTML = `
                <span class="chapter-item-title">Глава ${i}</span>
            `;

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

    if (
      this.currentChapter === chapterNumber &&
      currentContentElement &&
      currentContentElement.innerHTML.trim() !== "" &&
      !currentContentElement.innerHTML.includes("Загрузка главы")
    ) {
      console.log(`📖 Already on chapter ${chapterNumber}, skipping reload`);
      this.updateNavigationUI();
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
        let chapterTitle = `Глава ${chapterNumber}`;

        const tempDoc = new DOMParser().parseFromString(content, "text/html");
        const firstH2 = tempDoc.querySelector("h2");

        if (firstH2) {
          chapterTitle = firstH2.textContent.trim();
        }

        currentContentElement.innerHTML = content;
        this.updateNavigationUI();

        const breadcrumb = document.getElementById("current-chapter-title");
        if (breadcrumb) {
          breadcrumb.textContent = chapterTitle;
          document.title = `${chapterTitle} - Читальный движок`;
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
      }
    } catch (error) {
      console.error("Error loading chapter:", error);
      if (currentContentElement) {
        currentContentElement.innerHTML = this.createErrorChapter(chapterNumber);
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
        prevChapterTitle = this.chapterTitles[this.currentChapter - 1] || `Глава ${this.currentChapter - 1}`;
    }

    if (this.currentChapter < this.totalChapters) {
        nextChapterTitle = this.chapterTitles[this.currentChapter + 1] || `Глава ${this.currentChapter + 1}`;
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
      breadcrumb.textContent = this.chapterTitles[this.currentChapter] || `Глава ${this.currentChapter}`;
    }
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
      h2.style.margin = "2rem 0 1rem";
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

class SettingsManager {
  constructor() {
    this.settings = {
      fontFamily: "Lato",
      fontSize: 16,
      textWidth: 800,
      lastChapter: 1,
    };

    this.init();
  }

  init() {
    this.loadSettings();
    this.setupControls();
    this.applySettings();
    console.log("✅ SettingsManager initialized");
  }

  loadSettings() {
    const saved = Utils.loadFromStorage("readerSettings", {});
    this.settings = { ...this.settings, ...saved };
  }

  saveSettings() {
    Utils.saveToStorage("readerSettings", this.settings);
  }

  setupControls() {
    const fontSelect = document.getElementById("font-family");
    if (fontSelect) {
      fontSelect.value = this.settings.fontFamily;
      fontSelect.addEventListener("change", (e) => {
        this.setFontFamily(e.target.value);
      });
    }

    const fontSizeSlider = document.getElementById("font-size");
    const fontSizeValue = document.getElementById("font-size-value");
    if (fontSizeSlider && fontSizeValue) {
      fontSizeSlider.value = this.settings.fontSize;
      fontSizeValue.textContent = `${this.settings.fontSize}px`;

      fontSizeSlider.addEventListener("input", (e) => {
        const size = parseInt(e.target.value);
        fontSizeValue.textContent = `${size}px`;
        this.setFontSize(size);
      });
    }

    const widthSlider = document.getElementById("text-width");
    const widthValue = document.getElementById("text-width-value");
    if (widthSlider && widthValue) {
      widthSlider.value = this.settings.textWidth;
      widthValue.textContent = `${this.settings.textWidth}px`;

      widthSlider.addEventListener("input", (e) => {
        const width = parseInt(e.target.value);
        widthValue.textContent = `${width}px`;
        this.setTextWidth(width);
      });
    }

    this.setupSettingsPanel();
  }

  setupSettingsPanel() {
    const settingsToggle = document.getElementById("settings-toggle");
    const closeSettings = document.getElementById("close-settings");
    const overlay = document.getElementById("overlay");
    const settingsPanel = document.getElementById("settings-panel");

    if (settingsToggle) {
      settingsToggle.addEventListener("click", (e) => {
        e.stopPropagation();
        this.toggleSettings();
      });
    }

    if (closeSettings) {
      closeSettings.addEventListener("click", (e) => {
        e.stopPropagation();
        this.closeSettings();
      });
    }

    if (overlay) {
      overlay.addEventListener("click", (e) => {
        e.stopPropagation();
        this.closeSettings();
      });
    }
  }

  toggleSettings() {
    const settingsPanel = document.getElementById("settings-panel");
    const overlay = document.getElementById("overlay");

    if (!settingsPanel || !overlay) return;

    if (settingsPanel.classList.contains("open")) {
      this.closeSettings();
    } else {
      this.openSettings();
    }
  }

  openSettings() {
    const settingsPanel = document.getElementById("settings-panel");
    const overlay = document.getElementById("overlay");
    const sidebar = document.getElementById("sidebar");

    if (settingsPanel && overlay) {
      if (sidebar) sidebar.classList.remove("open");

      settingsPanel.classList.add("open");
      overlay.classList.add("visible");
    }
  }

  closeSettings() {
    const settingsPanel = document.getElementById("settings-panel");
    const overlay = document.getElementById("overlay");

    if (settingsPanel && overlay) {
      settingsPanel.classList.remove("open");
      overlay.classList.remove("visible");
    }
  }

  applySettings() {
    this.applyFontFamily();

    document.documentElement.style.setProperty(
      "--font-size",
      `${this.settings.fontSize}px`,
    );
    document.body.style.fontSize = `${this.settings.fontSize}px`;

    const contentElement = document.getElementById("chapter-content");
    if (contentElement) {
      contentElement.style.maxWidth = `${this.settings.textWidth}px`;
    }

    console.log("✅ Applied settings:", this.settings);
  }

  applyFontFamily() {
    const fontFamily = this.settings.fontFamily;

    let fontStyle = document.getElementById("dynamic-font-style");
    if (!fontStyle) {
      fontStyle = document.createElement("style");
      fontStyle.id = "dynamic-font-style";
      document.head.appendChild(fontStyle);
    }

    fontStyle.textContent = `
            body, .chapter-content, .reading-area, .settings-content {
                font-family: '${fontFamily}', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            }
            
            .settings-select, .color-input, code, pre {
                font-family: 'SourceCodePro', '${fontFamily}', monospace;
            }
        `;

    document.documentElement.style.setProperty(
      "--font-family",
      `'${fontFamily}', sans-serif`,
    );
  }

  setFontFamily(fontFamily) {
    if (this.settings.fontFamily === fontFamily) return;
    this.settings.fontFamily = fontFamily;
    this.applyFontFamily();
    this.saveSettings();
  }

  setFontSize(fontSize) {
    if (this.settings.fontSize === fontSize) return;
    this.settings.fontSize = fontSize;
    this.applySettings();
    this.saveSettings();
  }

  setTextWidth(width) {
    if (this.settings.textWidth === width) return;
    this.settings.textWidth = width;
    this.applySettings();
    this.saveSettings();
  }

  setLastChapter(chapter) {
    if (this.settings.lastChapter === chapter) return;
    this.settings.lastChapter = chapter;
    this.saveSettings();
  }
}

class ReadingApp {
  constructor() {
    this.themeManager = null;
    this.chapterLoader = null;
    this.settingsManager = null;
    this.init();
  }

  async init() {
    console.log("🚀 Starting Reading App...");

    try {
      this.settingsManager = new SettingsManager();
      this.themeManager = new ThemeManager();
      this.chapterLoader = new ChapterLoader();

      await this.chapterLoader.init();

      this.setupUI();

      this.readingAreaElement = document.querySelector('.reading-area');
      this.progressBarElement = document.getElementById('reading-progress-bar');

      if (!this.readingAreaElement) {
         console.warn("ReadingApp: .reading-area element not found for scroll progress indicator.");
      }
      if (!this.progressBarElement) {
         console.warn("ReadingApp: #reading-progress-bar element not found for scroll progress indicator.");
      }

      this.setupScrollProgressIndicator();

      console.log("✅ Reading App ready!");

      window.readingApp = this;
    } catch (error) {
      console.error("❌ Failed to initialize app:", error);
    }
  }

  setupScrollProgressIndicator() {
    if (!this.readingAreaElement || !this.progressBarElement) {
        console.warn("ReadingApp: Cannot setup scroll progress indicator, elements not found.");
        return;
    }

    const debouncedUpdateProgress = Utils.debounce(() => {
        this.updateReadingProgress();
    }, 10);

    this.readingAreaElement.addEventListener('scroll', debouncedUpdateProgress);

    this.updateReadingProgress();
  }

  updateReadingProgress() {
    if (!this.readingAreaElement || !this.progressBarElement) {
        console.warn("ReadingApp: Cannot update scroll progress, elements not found.");
        return;
    }

    const element = this.readingAreaElement;

    let scrollTop = element.scrollTop;
    let clientHeight = element.clientHeight;
    let scrollHeight = element.scrollHeight;

    let maxScrollTop = scrollHeight - clientHeight;

    let scrollPercentage = 0;
    if (maxScrollTop > 0) {
        scrollPercentage = (scrollTop / maxScrollTop) * 100;
        scrollPercentage = Math.min(100, Math.max(0, scrollPercentage));
    } else {
        scrollPercentage = 0;
    }

    this.progressBarElement.style.width = `${scrollPercentage}%`;
    const progressTextElement = document.getElementById('reading-progress-text');
    if (progressTextElement) {
        const roundedPercentage = Math.round(scrollPercentage);
        progressTextElement.textContent = `Прочтено: ${roundedPercentage}%`;
    }
  }

  setupUI() {
    this.setupMenu();
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

  getThemeManager() {
    return this.themeManager;
  }

  getChapterLoader() {
    return this.chapterLoader;
  }

  getSettingsManager() {
    return this.settingsManager;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  console.log("📄 DOM loaded, starting app...");
  const app = new ReadingApp();

  setTimeout(() => {
    if (window.readingApp) {
      console.log("\n📋 Available console commands:");
      console.log("readingApp.getThemeManager().togglePreset()");
      console.log("readingApp.getChapterLoader().goToChapter(1)");
    }
  }, 1000);
});

window.debugChapterLoader = function () {
  if (window.readingApp && window.readingApp.chapterLoader) {
    console.log("📚 ChapterLoader state:", {
      current: window.readingApp.chapterLoader.currentChapter,
      total: window.readingApp.chapterLoader.totalChapters,
      files: window.readingApp.chapterLoader.chapterFiles,
    });
    return window.readingApp.chapterLoader;
  }
  console.warn("Reading app not initialized");
  return null;
};

window.forceLoadChapter = function (chapterNumber) {
  if (window.readingApp && window.readingApp.chapterLoader) {
    console.log(`🔄 Forcing load of chapter ${chapterNumber}`);
    return window.readingApp.chapterLoader.goToChapter(chapterNumber);
  }
  console.error("Cannot force load - app not initialized");
};

window.addEventListener("load", () => {
  console.log("🌐 Page fully loaded");
  if (window.readingApp && window.readingApp.chapterLoader) {
    const savedChapter = Utils.loadFromStorage("lastChapter", 1);
    setTimeout(() => {
      window.readingApp.chapterLoader.goToChapter(savedChapter);
    }, 500);
  }
});