import { adjustHex, lightOrDark, mix } from "./utils.js";
import { loadTheme, saveTheme, STANDARD_THEMES } from "./storage.js";

export class ThemeController {
  constructor() {
    this.state = loadTheme().value;
  }

  init() {
    this.apply(this.state.preset, this.state.colors, false);
  }

  toggle() {
    const current = this.state.preset;
    if (current === "custom") {
      const next = lightOrDark(this.state.colors.bg) === "dark" ? "light" : "dark";
      this.apply(next, STANDARD_THEMES[next]);
      return;
    }
    const next = current === "light" ? "dark" : "light";
    this.apply(next, STANDARD_THEMES[next]);
  }

  setPreset(preset) {
    const safe = preset === "light" ? "light" : "dark";
    this.apply(safe, STANDARD_THEMES[safe]);
  }

  setCustomColors(colors) {
    this.apply("custom", colors);
  }

  apply(preset, colors, persist = true) {
    this.state = { preset, colors };
    const root = document.documentElement;
    const body = document.body;
    root.setAttribute("data-theme", preset);
    body?.setAttribute("data-theme", preset);
    this.applyVariables(colors);
    this.updateMeta(colors.bg);
    this.updateIcons();
    if (persist) saveTheme(preset, colors);
  }

  applyVariables(colors) {
    const root = document.documentElement;
    const mode = lightOrDark(colors.bg);
    const darkSurface = mix(colors.bg, "#ffffff", 0.08);
    const lightSurface = mix(colors.bg, "#000000", 0.04);
    const surface = mode === "dark" ? darkSurface : lightSurface;
    const hover = mode === "dark" ? mix(colors.bg, "#ffffff", 0.15) : mix(colors.bg, "#000000", 0.08);
    const border = mode === "dark" ? mix(colors.bg, "#ffffff", 0.22) : mix(colors.bg, "#000000", 0.16);
    const link = mode === "dark" ? "#8ab4f8" : "#1a73e8";
    const vars = {
      "--bg-color": colors.bg,
      "--text-color": colors.text,
      "--sidebar-bg": surface,
      "--sidebar-text": colors.text,
      "--toolbar-bg": mode === "dark" ? mix(colors.bg, "#ffffff", 0.05) : mix(colors.bg, "#000000", 0.03),
      "--toolbar-border": border,
      "--settings-bg": surface,
      "--settings-text": colors.text,
      "--btn-bg": mode === "dark" ? mix(colors.bg, "#ffffff", 0.12) : mix(colors.bg, "#000000", 0.05),
      "--btn-text": colors.text,
      "--btn-hover": hover,
      "--btn-active": mode === "dark" ? mix(colors.bg, "#ffffff", 0.22) : mix(colors.bg, "#000000", 0.13),
      "--border-color": border,
      "--link-color": link,
      "--link-hover": mode === "dark" ? "#aecbfa" : "#0d62d9",
      "--highlight-bg": mode === "dark" ? "rgba(138, 180, 248, 0.2)" : "rgba(26, 115, 232, 0.1)",
      "--overlay": mode === "dark" ? "rgba(0, 0, 0, 0.7)" : "rgba(0, 0, 0, 0.5)",
      "--progress-bg": mode === "dark" ? mix(colors.bg, "#ffffff", 0.13) : mix(colors.bg, "#000000", 0.05),
      "--progress-fill": link,
      "--player-bg": colors.bg,
      "--player-border": adjustHex(colors.bg, mode === "dark" ? 0.15 : -0.15),
      "--hint-text-color": mode === "dark" ? "#ffb74d" : "#d35400"
    };
    for (const [name, value] of Object.entries(vars)) root.style.setProperty(name, value);
  }

  updateMeta(color) {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", color);
  }

  updateIcons() {
    const show = this.state.preset === "light" ? "show-moon" : "show-sun";
    document.querySelectorAll(".theme-icon").forEach((icon) => {
      icon.classList.toggle("show-moon", show === "show-moon");
      icon.classList.toggle("show-sun", show === "show-sun");
    });
  }
}
