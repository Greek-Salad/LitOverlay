// src/app.ts
import { theme } from '$lib/stores/theme';
import { readingSettings } from '$lib/stores/settings';

// Инициализация темы при запуске
theme.init();
readingSettings.init();