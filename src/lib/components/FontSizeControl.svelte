<script lang="ts">
  import { readingSettings } from '$lib/stores/settings';

  function changeSize(delta: number) {
    readingSettings.setFontSize($readingSettings.font.size + delta);
  }

  function handleInput(e: Event) {
    const value = (e.target as HTMLInputElement).valueAsNumber;
    if (!isNaN(value)) readingSettings.setFontSize(value);
  }
</script>

<div class="font-size-control">
  <span>Размер шрифта: </span>
  <div class="font-field">
    <button class="font-btn" on:click={() => changeSize(-1)}>−</button>
    <input
      min="10"
      max="32"
      step="1"
      class="font-input"
      type="number"
      value={$readingSettings.font.size}
      on:input={handleInput}
    />
    <button class="font-btn" on:click={() => changeSize(1)}>+</button>
  </div>
</div>

<style>
  .font-field {
    display: flex;
    align-items: center;
    background-color: var(--bg-color);
    border-radius: 4px;
  }
  .font-field .font-btn {
    width: 28px;
    height: 28px;
    font-size: 16px;
    background: transparent;
    color: var(--text-color);
    border: none;
    border-radius: 4px;
    cursor: pointer;
  }
  .font-input {
    width: 36px;
    height: 28px;
    padding: 2px 4px;
    font-size: 14px;
    text-align: center;
    background: transparent;
    color: var(--text-color);
    border: none;
    outline: none;
    font-family: inherit;
  }
</style>