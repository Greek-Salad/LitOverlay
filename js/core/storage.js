import { clamp, isValidHex } from "./utils.js";

export const LEGACY_KEYS = {
  readerSettings: "readerSettings",
  themePreset: "themePreset",
  themeColors: "themeColors",
  readingProgress: "readingProgress",
  ageGateConfirmed: "ageGateConfirmed",
  ageGateConfirmedTimestamp: "ageGateConfirmedTimestamp"
};

export const V2_KEYS = {
  audio: "litoverlay:v2:audio",
  readState: "litoverlay:v2:readState",
  library: "litoverlay:v2:library"
};

export const DEFAULT_READER_SETTINGS = {
  fontFamily: "Lato",
  fontSize: 16,
  textWidth: 800,
  lineHeight: 1.6,
  lastChapter: 1
};

export const DEFAULT_THEME_COLORS = {
  bg: "#202124",
  text: "#e8eaed"
};

export const STANDARD_THEMES = {
  light: { bg: "#f7f8f4", text: "#242424" },
  dark: DEFAULT_THEME_COLORS
};

const AGE_GATE_TTL = 24 * 60 * 60 * 1000;

function readJson(key, fallback, warnings = []) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw);
  } catch (error) {
    warnings.push({ key, message: `Повреждённый JSON в ${key}` });
    return fallback;
  }
}

function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function loadReaderSettings() {
  const warnings = [];
  const raw = readJson(LEGACY_KEYS.readerSettings, {}, warnings);
  const settings = { ...DEFAULT_READER_SETTINGS, ...(raw && typeof raw === "object" ? raw : {}) };
  return {
    value: {
      ...settings,
      fontSize: clamp(settings.fontSize, 12, 24),
      textWidth: clamp(settings.textWidth, 400, 1200),
      lineHeight: clamp(settings.lineHeight, 1.2, 2.4),
      lastChapter: Number.isFinite(Number(settings.lastChapter)) ? Number(settings.lastChapter) : 1
    },
    raw,
    warnings
  };
}

export function getLegacyLastChapter(rawSettings) {
  if (!rawSettings || typeof rawSettings !== "object" || !Object.hasOwn(rawSettings, "lastChapter")) return null;
  const chapter = Number.parseInt(String(rawSettings.lastChapter), 10);
  if (!Number.isInteger(chapter) || chapter < 0) return null;
  return chapter === DEFAULT_READER_SETTINGS.lastChapter ? null : chapter;
}

export function saveReaderSettings(settings) {
  const current = loadReaderSettings().raw;
  writeJson(LEGACY_KEYS.readerSettings, { ...(current && typeof current === "object" ? current : {}), ...settings });
}

export function loadTheme() {
  const warnings = [];
  const preset = readJson(LEGACY_KEYS.themePreset, "dark", warnings);
  const colors = readJson(LEGACY_KEYS.themeColors, DEFAULT_THEME_COLORS, warnings);
  const safePreset = ["light", "dark", "custom"].includes(preset) ? preset : "dark";
  const safeColors = {
    bg: isValidHex(colors?.bg) ? colors.bg : DEFAULT_THEME_COLORS.bg,
    text: isValidHex(colors?.text) ? colors.text : DEFAULT_THEME_COLORS.text
  };
  return {
    value: {
      preset: safePreset,
      colors: safePreset === "custom" ? safeColors : (STANDARD_THEMES[safePreset] ?? DEFAULT_THEME_COLORS)
    },
    raw: { preset, colors },
    warnings
  };
}

export function saveTheme(preset, colors) {
  writeJson(LEGACY_KEYS.themePreset, preset);
  writeJson(LEGACY_KEYS.themeColors, {
    bg: isValidHex(colors?.bg) ? colors.bg : DEFAULT_THEME_COLORS.bg,
    text: isValidHex(colors?.text) ? colors.text : DEFAULT_THEME_COLORS.text
  });
}

export function loadReadingProgress() {
  const warnings = [];
  const raw = readJson(LEGACY_KEYS.readingProgress, {}, warnings);
  const value = {};
  if (raw && typeof raw === "object") {
    for (const [bookId, entry] of Object.entries(raw)) {
      if (!entry || typeof entry !== "object") continue;
      const chapter = Number(entry.chapter);
      const scrollPercent = Number(entry.scrollPercent);
      const timestamp = Number(entry.timestamp);
      if (!Number.isFinite(chapter)) continue;
      value[bookId] = {
        chapter,
        scrollPercent: clamp(scrollPercent, 0, 100),
        timestamp: Number.isFinite(timestamp) ? timestamp : 0
      };
    }
  }
  return { value, raw, warnings };
}

export function saveReadingProgress(progress) {
  writeJson(LEGACY_KEYS.readingProgress, progress);
}

export function saveBookProgress(bookId, entry) {
  const progress = loadReadingProgress().value;
  progress[bookId] = {
    chapter: Number(entry.chapter),
    scrollPercent: Math.round(clamp(entry.scrollPercent, 0, 100)),
    timestamp: Number(entry.timestamp) || Date.now()
  };
  saveReadingProgress(progress);
}

export function clearBookProgress(bookId) {
  const progress = loadReadingProgress().value;
  delete progress[bookId];
  saveReadingProgress(progress);
}

export function hasMeaningfulProgress(entry) {
  return Boolean(entry && (Number(entry.chapter) > 0 || Number(entry.scrollPercent) > 3));
}

export function loadAgeGate() {
  const warnings = [];
  const confirmed = readJson(LEGACY_KEYS.ageGateConfirmed, false, warnings);
  const timestamp = Number(readJson(LEGACY_KEYS.ageGateConfirmedTimestamp, 0, warnings));
  const valid = confirmed === true && Number.isFinite(timestamp) && Date.now() - timestamp < AGE_GATE_TTL;
  return { value: { confirmed: valid, timestamp }, raw: { confirmed, timestamp }, warnings };
}

export function saveAgeGateConfirmed() {
  writeJson(LEGACY_KEYS.ageGateConfirmed, true);
  writeJson(LEGACY_KEYS.ageGateConfirmedTimestamp, Date.now());
}

export function expireAgeGate() {
  writeJson(LEGACY_KEYS.ageGateConfirmed, false);
}

export function loadAudioSettings() {
  const data = readJson(V2_KEYS.audio, {});
  return {
    volume: clamp(data?.volume ?? 0.8, 0, 1),
    muted: Boolean(data?.muted)
  };
}

export function saveAudioSettings(settings) {
  const current = loadAudioSettings();
  writeJson(V2_KEYS.audio, { ...current, ...settings });
}

export function loadReadState() {
  const data = readJson(V2_KEYS.readState, {});
  return {
    completed: data?.completed && typeof data.completed === "object" ? data.completed : {},
    highlights: data?.highlights && typeof data.highlights === "object" ? data.highlights : {}
  };
}

export function saveReadState(state) {
  const current = loadReadState();
  writeJson(V2_KEYS.readState, { ...current, ...state });
}

export function markBookCompleted(bookId) {
  const state = loadReadState();
  state.completed[bookId] = Date.now();
  saveReadState(state);
}

export function saveHighlightedParagraph(bookId, chapter, paragraphIndex) {
  const state = loadReadState();
  state.highlights[bookId] = { chapter, paragraphIndex };
  saveReadState(state);
}

export function clearHighlightedParagraph(bookId) {
  const state = loadReadState();
  delete state.highlights[bookId];
  saveReadState(state);
}

export function loadLibraryPrefs() {
  const data = readJson(V2_KEYS.library, {});
  return {
    view: data?.view === "grid" ? "grid" : "list"
  };
}

export function saveLibraryPrefs(prefs) {
  writeJson(V2_KEYS.library, { ...loadLibraryPrefs(), ...prefs });
}
