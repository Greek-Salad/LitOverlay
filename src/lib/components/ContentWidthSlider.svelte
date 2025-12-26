<script lang="ts">
  import { readingSettings } from '$lib/stores/settings';

  function updateWidth(e: Event) {
    const value = (e.target as HTMLInputElement).valueAsNumber;
    readingSettings.setContentWidth(value);
  }
</script>

<label>
  Ширина: {$readingSettings.contentWidth}px
  <input
    type="range"
    min="600"
    max="2000"
    value={$readingSettings.contentWidth}
    on:input={updateWidth}
  />
</label>