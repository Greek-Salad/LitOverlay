<script lang="ts">
  import { readingSettings } from '$lib/stores/settings';

  function rgbToHex(rgb: string): string {
    const match = rgb.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (!match) return '#000000';
    const r = parseInt(match[1], 10);
    const g = parseInt(match[2], 10);
    const b = parseInt(match[3], 10);
    return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
  }

  function hexToRgb(hex: string): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgb(${r}, ${g}, ${b})`;
  }

  function setText(e: Event) {
    const hex = (e.target as HTMLInputElement).value;
    readingSettings.setColors(hexToRgb(hex), $readingSettings.colors.background);
  }

  function setBackground(e: Event) {
    const hex = (e.target as HTMLInputElement).value;
    readingSettings.setColors($readingSettings.colors.text, hexToRgb(hex));
  }
</script>

<div>
  <label>
    Текст: {$readingSettings.colors.text}
    <input type="color" value={rgbToHex($readingSettings.colors.text)} on:input={setText} />
  </label>
  <label>
    Фон: {$readingSettings.colors.background}
    <input type="color" value={rgbToHex($readingSettings.colors.background)} on:input={setBackground} />
  </label>
</div>