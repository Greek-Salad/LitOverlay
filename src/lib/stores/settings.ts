// src/lib/stores/settings.ts
import { writable } from 'svelte/store';

export interface ReadingSettings {
  theme: 'light' | 'dark';
  font: {
    family: string; // 'Lato', 'Times New Roman' и т.д.
    size: number;   // в pt (14)
  };
  contentWidth: number; // в px (700)
  colors: {
    text: string; // 'rgb(0,0,0)'
    background: string; // 'rgb(255,255,255)'
  };
}

function createSettingsStore() {
  const DEFAULT: ReadingSettings = {
    theme: 'light',
    font: {
      family: 'Lato',
      size: 14
    },
    contentWidth: 700,
    colors: {
      text: 'rgb(0, 0, 0)',
      background: 'rgb(255, 255, 255)'
    }
  };

  const DARK_PRESET = {
    text: 'rgb(223, 223, 236)',
    background: 'rgb(39, 39, 43)'
  };

  const { subscribe, set, update } = writable<ReadingSettings>(DEFAULT);

  return {
    subscribe,
    set: (value: ReadingSettings) => {
      const validated = { ...value };
      validated.font.size = Math.max(10, Math.min(32, validated.font.size));
      validated.contentWidth = Math.max(600, Math.min(2000, validated.contentWidth));
      set(validated);
      applyStyles(validated);
      localStorage.setItem('readingSettings', JSON.stringify(validated));
    },
    init: () => {
      const saved = localStorage.getItem('readingSettings');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          document.documentElement.className = `theme-${parsed.theme}`;
          set(parsed);
          applyStyles(parsed);
          return;
        } catch (e) {
          console.warn('Invalid settings in localStorage', e);
        }
      }
      set(DEFAULT);
      applyStyles(DEFAULT);
    },
    setTheme: (theme: 'light' | 'dark') => {
      update(settings => {
        settings.theme = theme;
        if (theme === 'light') {
          settings.colors = { text: 'rgb(0, 0, 0)', background: 'rgb(255, 255, 255)' };
        } else {
          settings.colors = DARK_PRESET;
        }
        document.documentElement.className = `theme-${theme}`;
        saveAndApply(settings);
        return settings;
      });
    },
    setFontFamily: (family: string) => {
      update(settings => {
        settings.font.family = family;
        saveAndApply(settings);
        return settings;
      });
    },
    setFontSize: (size: number) => {
      update(settings => {
        settings.font.size = Math.max(10, Math.min(32, size));
        saveAndApply(settings);
        return settings;
      });
    },
    setContentWidth: (width: number) => {
      update(settings => {
        settings.contentWidth = Math.max(600, Math.min(2000, width));
        saveAndApply(settings);
        return settings;
      });
    },
    setColors: (text: string, background: string) => {
      update(settings => {
        settings.colors.text = text;
        settings.colors.background = background;
        // Если цвета не совпадают с пресетами — theme = 'custom'
        if (text === 'rgb(0, 0, 0)' && background === 'rgb(255, 255, 255)') {
          settings.theme = 'light';
        } else if (text === DARK_PRESET.text && background === DARK_PRESET.background) {
          settings.theme = 'dark';
        } else {
          settings.theme = 'light'; // или оставить как есть — твой выбор
        }
        saveAndApply(settings);
        return settings;
      });
    }
  };
}

function saveAndApply(settings: ReadingSettings) {
  localStorage.setItem('readingSettings', JSON.stringify(settings));
  applyStyles(settings);
}

function applyStyles(settings: ReadingSettings) {
  document.documentElement.style.setProperty('--text-color', settings.colors.text);
  document.documentElement.style.setProperty('--bg-color', settings.colors.background);
  document.documentElement.style.setProperty('--font-family', settings.font.family);
  document.documentElement.style.setProperty('--font-size', `${settings.font.size}pt`);
  document.documentElement.style.setProperty('--content-width', `${settings.contentWidth}px`);
}

export const readingSettings = createSettingsStore();