<!-- src/lib/components/FontFamilySelector.svelte -->
<script lang="ts">
  import { readingSettings } from '$lib/stores/settings';
  import { onMount } from 'svelte';

  const fontGroups = [
    { label: 'с засечками', fonts: ['Liberation Serif', 'Antiqua'] },
    { label: 'без засечек', fonts: ['Lato', 'Liberation Sans', 'Roboto', 'Whitney'] },
    { label: 'моноширинные', fonts: ['Source Code Pro'] }
  ];

  let isOpen = false;
  let currentFont = $readingSettings.font.family;

  // Подписываемся на изменения (например, извне)
  $: currentFont = $readingSettings.font.family;

  function select(font: string) {
    readingSettings.setFontFamily(font);
    isOpen = false;
  }

  function toggle() {
    isOpen = !isOpen;
  }

  // Закрывать по клику вне
  onMount(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.font-selector')) {
        isOpen = false;
      }
    };
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  });
</script>

<div class="font-selector" style="position: relative; display: inline-block;">
  <!-- Триггер -->
  <button
    type="button"
    on:click={toggle}
    aria-haspopup="listbox"
    aria-expanded={isOpen}
    class="selector-button"
  >
    {currentFont}
  </button>

  <!-- Выпадающий список -->
  {#if isOpen}
    <ul
      role="listbox"
      aria-label="Выбор гарнитуры шрифта"
      class="font-dropdown"
    >
      {#each fontGroups as group}
        <li role="presentation" class="font-group-label">{group.label}</li>
        {#each group.fonts as font}
          <li
            role="option"
            aria-selected={font === currentFont}
            on:click={() => select(font)}
            on:keydown={(e) => { if (e.key === 'Enter' || e.key === ' ') select(font); }}
            tabindex="0"
            class="font-option"
            style="font-family: '{font}', sans-serif;"
          >
            {font}
          </li>
        {/each}
      {/each}
    </ul>
  {/if}
</div>

<style>
  .selector-button {
    background: var(--bg-color);
    color: var(--text-color);
    border: 1px solid var(--border-color, #ccc);
    border-radius: 4px;
    padding: 6px 10px;
    font-family: inherit;
    font-size: inherit;
    cursor: pointer;
    min-width: 120px;
    text-align: left;
  }

  .selector-button:hover {
    background: var(--hover-bg, #f0f0f0);
  }

  .font-dropdown {
    position: absolute;
    top: 100%;
    left: 0;
    margin: 4px 0 0;
    padding: 6px 0;
    background: var(--bg-color);
    border: 1px solid var(--border-color, #ccc);
    border-radius: 4px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    z-index: 1000;
    max-height: 300px;
    overflow-y: auto;
    overflow-x: hidden;
    list-style: none;

    min-width: 100%;
    width: max-content;
    white-space: nowrap;
    width: -moz-max-content;
    width: -webkit-max-content;
  }

  .font-group-label {
    padding: 6px 10px;
    font-size: 0.85em;
    color: var(--text-muted, #888);
    font-weight: bold;
    user-select: none;
  }

  .font-option {
    padding: 8px 10px;
    cursor: pointer;
    user-select: none;
  }

  .font-option:hover {
    background: var(--hover-bg, #f0f0f0);
  }

  .font-option[aria-selected="true"] {
    background: var(--selected-bg, #e0e0e0);
  }

  /* Поддержка темной темы */
  :global(.theme-light) .font-selector {
    --border-color: #ccc;
    --hover-bg: #f0f0f0;
    --selected-bg: #e0e0e0;
    --text-muted: #888;
  }

  :global(.theme-dark) .font-selector {
    --border-color: #444;
    --hover-bg: #333;
    --selected-bg: #444;
    --text-muted: #aaa;
  }
</style>