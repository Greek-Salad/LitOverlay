// js/theme-manager.js

import Utils from "./utils.js";
import { THEME_PRESETS } from "./constants.js";
import CustomColorPicker from "./color-picker.js";

class ThemeManager {
  constructor() {
    this.PRESETS = {
      light: { ...THEME_PRESETS.light },
      dark: { ...THEME_PRESETS.dark },
    };
    this.currentPreset = "light";
    this.customColors = { ...THEME_PRESETS.light };
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
      THEME_PRESETS.light,
    );

    this.currentPreset = savedPreset;
    this.customColors = savedColors;
    console.log("📝 Loaded theme:", {
      preset: this.currentPreset,
      colors: this.customColors,
    });
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

      this.applyMainColors();

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

  applyMainColors() {
    const root = document.documentElement;
    const { bg: bgColor, text: textColor } = this.customColors;

    root.style.setProperty("--bg-color", bgColor);
    root.style.setProperty("--text-color", textColor);

    const isBgDark = Utils.isDarkColor(bgColor);
    console.log("🎨 Theme colors:", { bgColor, textColor, isBgDark });

    const adjust = (color, amount) => this.adjustColor(color, amount);

    root.style.setProperty(
      "--sidebar-bg",
      adjust(bgColor, isBgDark ? 0.05 : -0.05),
    );
    root.style.setProperty("--sidebar-text", textColor);

    root.style.setProperty(
      "--settings-bg",
      adjust(bgColor, isBgDark ? 0.05 : -0.05),
    );
    root.style.setProperty("--settings-text", textColor);

    root.style.setProperty(
      "--toolbar-bg",
      adjust(bgColor, isBgDark ? 0.03 : -0.03),
    );

    const btnBg = adjust(bgColor, isBgDark ? 0.1 : -0.1);
    root.style.setProperty("--btn-bg", btnBg);
    root.style.setProperty("--btn-text", textColor);
    root.style.setProperty("--btn-hover", adjust(btnBg, 0.1));
    root.style.setProperty("--btn-active", adjust(btnBg, 0.15));

    root.style.setProperty(
      "--border-color",
      adjust(bgColor, isBgDark ? 0.15 : -0.15),
    );

    const isTextDark = Utils.isDarkColor(textColor);
    const linkColor = adjust(textColor, isTextDark ? -0.3 : 0.3);
    root.style.setProperty("--link-color", linkColor);
    root.style.setProperty("--link-hover", adjust(linkColor, 0.1));

    const highlightColor = isBgDark
      ? "rgba(138, 180, 248, 0.2)"
      : "rgba(26, 115, 232, 0.1)";
    root.style.setProperty("--highlight-bg", highlightColor);

    root.style.setProperty(
      "--progress-bg",
      adjust(bgColor, isBgDark ? 0.1 : -0.1),
    );
    root.style.setProperty("--progress-fill", linkColor);

    root.style.setProperty("--player-bg", bgColor);
    root.style.setProperty(
      "--player-border",
      adjust(bgColor, isBgDark ? 0.15 : -0.15),
    );

    if (isBgDark) {
      root.style.setProperty("--hint-text-color", "#ffb74d");
    } else {
      root.style.setProperty("--hint-text-color", "#d35400");
    }
  }

  adjustColor(color, amount) {
    try {
      const hex = color.replace("#", "");
      if (hex.length === 3) {
        const hex6 = hex
          .split("")
          .map((c) => c + c)
          .join("");
        return this.adjustColor(`#${hex6}`, amount);
      }

      const num = parseInt(hex, 16);
      let r = (num >> 16) & 0xff;
      let g = (num >> 8) & 0xff;
      let b = num & 0xff;

      const adjustment = Math.round(amount * 255);
      r = Utils.clamp(r + adjustment, 0, 255);
      g = Utils.clamp(g + adjustment, 0, 255);
      b = Utils.clamp(b + adjustment, 0, 255);

      return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
    } catch (error) {
      console.error("Error adjusting color:", error, color, amount);
      return color;
    }
  }

  updateIcons() {
    const isBgDark = Utils.isDarkColor(this.customColors.bg);
    const iconSuffix = isBgDark ? "white" : "black";

    const menuIcon = document.getElementById("menu-icon");
    if (menuIcon) {
      menuIcon.src = `./icons/menu-${iconSuffix}.svg`;
    }

    const themeIcon = document.getElementById("theme-icon");
    if (themeIcon) {
      const newIcon = isBgDark ? "sun" : "moon";
      themeIcon.src = `./icons/${newIcon}.svg`;
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
  }

  updateAudioPlayerIconsForElement(playerElement) {
    if (!playerElement) return;

    const isBgDark = Utils.isDarkColor(this.customColors.bg);
    const iconColor = isBgDark ? "#ffffff" : "#333333";

    playerElement.querySelectorAll("svg").forEach((svg) => {
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
      const isActive = btn.dataset.theme === this.currentPreset;
      btn.classList.toggle("active", isActive);
    });
  }

  setupEventListeners() {
    const themeToggle = document.getElementById("theme-toggle");
    if (themeToggle) {
      themeToggle.addEventListener("click", (e) => {
        e.preventDefault();
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
    if (this.currentPreset === "custom") {
      const isBgDark = Utils.isDarkColor(this.customColors.bg);
      const newPreset = isBgDark ? "light" : "dark";
      this.applyPreset(newPreset);
    } else {
      const newPreset = this.currentPreset === "light" ? "dark" : "light";
      this.applyPreset(newPreset);
    }
  }

  applyPreset(preset) {
    if (!this.PRESETS[preset]) {
      console.warn(`Unknown preset: ${preset}`);
      return;
    }

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
    console.log(`🎨 Before change:`, { ...this.customColors });
    console.log(`🎨 Preset light:`, { ...this.PRESETS.light });

    this.customColors[type] = color;
    console.log(`🎨 After change:`, { ...this.customColors });

    const matchesLight = this.colorsMatch(
      this.customColors,
      this.PRESETS.light,
    );
    const matchesDark = this.colorsMatch(this.customColors, this.PRESETS.dark);

    console.log(
      `🎨 Matches light:`,
      matchesLight,
      `Matches dark:`,
      matchesDark,
    );

    if (matchesLight) {
      this.currentPreset = "light";
      console.log("🎨 Colors match light preset exactly");
    } else if (matchesDark) {
      this.currentPreset = "dark";
      console.log("🎨 Colors match dark preset exactly");
    } else {
      this.currentPreset = "custom";
      console.log("🎨 Colors are custom");
    }

    this.applyTheme();
  }

  colorsMatch(colors1, colors2) {
    const normalize = (color) =>
      color.toLowerCase().replace(/#/g, "").padStart(6, "0");
    return (
      normalize(colors1.bg) === normalize(colors2.bg) &&
      normalize(colors1.text) === normalize(colors2.text)
    );
  }

  getCurrentPreset() {
    return this.currentPreset;
  }

  getCustomColors() {
    return { ...this.customColors };
  }
}

export default ThemeManager;
