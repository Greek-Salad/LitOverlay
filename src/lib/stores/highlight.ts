// src/lib/stores/highlight.ts
import { writable } from 'svelte/store';

export type HighlightState = {
  activeElementId: string | null;
  highlightColor: string;
};

function createHighlightStore() {
  const { subscribe, set } = writable<HighlightState>({ activeElementId: null, highlightColor: '' });

  return {
    subscribe,
    setActiveElement: (elementId: string, highlightColor: string) => {
      set({ activeElementId: elementId, highlightColor });
    },
    clear: () => {
      set({ activeElementId: null, highlightColor: '' });
    }
  };
}

export const highlight = createHighlightStore();