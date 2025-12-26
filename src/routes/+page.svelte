<!-- src/routes/+page.svelte -->
<script lang="ts">
  export let data: { chapters: { num: number; title: string }[] };
  const { chapters } = data;
</script>

<h1>LitOverlay</h1>
<ul class="chapters-list">
  {#each chapters as ch}
    <li><a href="/chapter/{ch.num}">{ch.title}</a></li>
  {/each}
</ul>

<style>
  .chapters-list {
    list-style: none;
    padding: 0;
  }
  .chapters-list li {
    margin: 0.5rem 0;
  }
  .chapters-list a {
    display: block;
    padding: 0.5rem;
    border-radius: 4px;
    transition: background 0.2s;
  }
  .chapters-list a:hover {
    background: var(--hover-bg, rgba(0,0,0,0.05));
  }
</style>