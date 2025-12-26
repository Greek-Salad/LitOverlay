<script lang="ts">
  import { readingSettings } from '$lib/stores/settings';
  import { onMount } from 'svelte';

  let currentTheme: 'light' | 'dark' = 'light';

  onMount(() => {
    const unsubscribe = readingSettings.subscribe(settings => {
      currentTheme = settings.theme;
    });
    return unsubscribe;
  });

  function toggleTheme() {
    readingSettings.setTheme(currentTheme === 'light' ? 'dark' : 'light');
  }
</script>

<button
  on:click={toggleTheme}
  aria-label="Toggle theme"
  title="Switch between light and dark theme"
  style="background:none; border:none; cursor:pointer; padding: 4px; border-radius: 4px;"
>
  {#if currentTheme === 'light'}
    <img src="/icons/moon.svg" alt="Switch to dark theme" width="32" height="32" />
  {:else}
    <img src="/icons/sun.svg" alt="Switch to light theme" width="32" height="32" />
  {/if}
</button>