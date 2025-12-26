<!-- src/routes/chapter/[slug]/+page.svelte -->
<script lang="ts">
  import { readingSettings } from '$lib/stores/settings';
  import { highlight } from '$lib/stores/highlight';
  import { getBrightness, adjustColor } from '$lib/utils/color';
  import CustomAudioPlayer from '$lib/components/CustomAudioPlayer.svelte';

  export let data: any;

  $: blocks = data?.blocks ?? [];
  $: pageTitle = data?.title ?? 'LitOverlay';
  let currentTheme: 'light' | 'dark' | undefined = 'light';

  // Подписка на тему
  $: currentTheme =
    $readingSettings.theme === 'dark' || $readingSettings.theme === 'light'
      ? ($readingSettings.theme as 'light' | 'dark')
      : undefined;

  // Вычисляем цвет подсветки при изменении фона
  $: highlightColor = (() => {
    const bgColor = $readingSettings.colors.background;
    const isLight = getBrightness(bgColor) > 0.4;
    return adjustColor(bgColor, isLight);
  })();

  $: if (data) {
    highlight.clear();
  }

  // Функция обработки клика по блоку
  function handleBlockClick(event: Event, index: number) {
    const id = `block-${index}`;
    if ($highlight.activeElementId === id) {
      // Повторный клик — снимаем подсветку
      highlight.clear();
    } else {
      // Новый блок — подсвечиваем
      highlight.setActiveElement(id, highlightColor);
    }
  }

  // Обработка Enter/Space для доступа с клавиатуры
  function handleBlockKeydown(e: KeyboardEvent, index: number) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleBlockClick(e, index);
    }
  }

  // Снимаем подсветку по Esc
  import { onMount } from 'svelte';
  onMount(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') highlight.clear();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  });
</script>

<svelte:head>
  <title>{pageTitle}</title>
</svelte:head>

<main class="chapter-content">
  {#each blocks as block, i}
    <div
      class="clickable-block"
      class:highlighted={$highlight.activeElementId === `block-${i}`}
      style:background-color={$highlight.activeElementId === `block-${i}`
        ? $highlight.highlightColor
        : 'transparent'}
      on:click={(e) => handleBlockClick(e, i)}
      on:keydown={(e) => handleBlockKeydown(e, i)}
      tabindex="0"
      role="button"
      aria-label="Подсветить фрагмент"
    >
      {#if block.type === 'html'}
        {@html block.content}
      {:else if block.type === 'audio'}
        <CustomAudioPlayer src={block.src} title={block.title} theme={currentTheme} />
      {:else if block.type === 'image'}
        <p>
          <img
            src={block.src}
            alt="Изображение"
            style="max-width:100%; height:auto; border-radius:8px;"
          />
        </p>
      {/if}
    </div>
  {/each}

  <!-- Навигация по главам -->
  {#if data.prevChapter || data.nextChapter}
    <div
      class="chapter-nav"
      style:justify-content={
        data.isFirst ? 'flex-end' :
        data.isLast ? 'flex-start' :
        'space-between'
      }
    >
      {#if data.prevChapter}
        <a href="/chapter/{data.prevChapter.num}" class="nav-btn prev">
          ← {data.prevChapter.title}
        </a>
      {/if}
      {#if data.nextChapter}
        <a href="/chapter/{data.nextChapter.num}" class="nav-btn next">
          {data.nextChapter.title} →
        </a>
      {/if}
    </div>
  {/if}
</main>

<style>
  .clickable-block {
    cursor: pointer;
    padding: 0.25rem 0;
    border-radius: 4px;
    transition: background-color 0.3s ease;
    outline: none;
    margin-block-start: 0.5em;
    margin-block-end: 0.5em;
  }

  .clickable-block:hover {
    background-color: rgba(0, 0, 0, 0.05);
  }

  :global(.theme-dark) .clickable-block:hover {
    background-color: rgba(255, 255, 255, 0.05);
  }

  .chapter-nav {
    display: flex;
    margin-top: 3rem;
    padding-top: 1.5rem;
    border-top: 1px solid var(--border-color);
  }

  .nav-btn {
    display: inline-block;
    padding: 0.5rem 1rem;
    background: var(--bg-color);
    color: var(--link-color);
    text-decoration: none;
    border-radius: 4px;
    transition: background 0.2s;
  }

  .nav-btn:hover {
    background: var(--hover-bg, rgba(0,0,0,0.05));
  }
</style>