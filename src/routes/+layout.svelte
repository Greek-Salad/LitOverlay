<script lang="ts">
  import BurgerMenu from '$lib/components/BurgerMenu.svelte';
  import FontFamilySelector from '$lib/components/FontFamilySelector.svelte';
  import FontSizeControl from '$lib/components/FontSizeControl.svelte';
  import ContentWidthSlider from '$lib/components/ContentWidthSlider.svelte';
  import ColorPickers from '$lib/components/ColorPickers.svelte';
  import ThemeToggle from '$lib/components/ThemeToggle.svelte';
  import { readingSettings } from '$lib/stores/settings';

  // Инициализация
  import { onMount } from 'svelte';
  export let data: { chapters?: any[] };
  onMount(() => {
    readingSettings.init();
  });
</script>

<header class="app-header">
  <BurgerMenu chapters={data.chapters} />

  <div class="controls-center">
    <FontFamilySelector />
    <FontSizeControl />
    <ContentWidthSlider />
  </div>

  <div class="controls-right">
    <ColorPickers />
    <ThemeToggle />
  </div>
</header>

<slot />

<style>
  .app-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.75rem 1rem;
    background: var(--bg-color);
    color: var(--text-color);
    border-bottom: 1px solid rgba(0,0,0,0.1);
  }
  .controls-center {
    display: flex;
    gap: 12px;
    align-items: center;
  }
  .controls-right {
    display: flex;
    gap: 12px;
    align-items: center;
  }
</style>