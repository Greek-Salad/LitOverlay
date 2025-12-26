<script lang="ts">
  export let chapters: { num: number; title: string }[] = [];

  import { readingSettings } from '$lib/stores/settings';
  import { onMount, onDestroy } from 'svelte';

  let isOpen = false;

  function toggle() {
    isOpen = !isOpen;
  }

  // Закрывать по Esc
  onMount(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') isOpen = false;
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  });
</script>

<button
  on:click={toggle}
  aria-label="Open menu"
  style="background:none; border:none; cursor:pointer;"
>
  <img
    alt=""
    src="/icons/menu-{$readingSettings.theme === 'dark' ? 'white' : 'black'}.svg"
    width="20"
    height="20"
  />
</button>

<!-- Всегда в DOM, но скрыт по умолчанию -->
<button
  type="button"
  class="overlay {isOpen ? 'open' : ''}"
  on:click={toggle}
  aria-label="Close menu"
  aria-hidden={!isOpen}
  style="background:none; border:none; padding:0; margin:0; cursor:pointer;"
></button>

<nav
  class="sidebar {isOpen ? 'open' : ''}"
  style="top: 79px;"
  aria-hidden={!isOpen}
>
  <button on:click={toggle} style="float:right; background:none; border:none; cursor:pointer;">✕</button>
  <h3>Главы</h3>
  <ul>
    {#each chapters as ch}
      <li><a href="/chapter/{ch.num}">{ch.title}</a></li>
    {/each}
  </ul>
</nav>

<style>
  .sidebar {
    position: fixed;
    top: 0;
    left: -250px;
    width: 250px;
    height: 100%;
    background: var(--bg-color);
    color: var(--text-color);
    padding: 1rem;
    z-index: 1000;
    transition: left 0.3s ease;
	box-sizing: border-box;
	border: 1px solid var(--border-color);
  }

  .sidebar.open {
    left: 0;
  }

  .sidebar button {
	color: var(--text-color);
  }

  .overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
    opacity: 0;
    visibility: hidden;
    transition:
      opacity 0.3s,
      visibility 0.3s;
    z-index: 999;
    pointer-events: none;
  }

  .overlay.open {
    opacity: 1;
    visibility: visible;
    pointer-events: auto;
  }
</style>