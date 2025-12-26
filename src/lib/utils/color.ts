export function getBrightness(rgb: string): number {
  const match = rgb.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  if (!match) return 0;
  const r = parseInt(match[1], 10) / 255;
  const g = parseInt(match[2], 10) / 255;
  const b = parseInt(match[3], 10) / 255;

  const r2 = r <= 0.03928 ? r / 12.92 : Math.pow((r + 0.055) / 1.055, 2.4);
  const g2 = g <= 0.03928 ? g / 12.92 : Math.pow((g + 0.055) / 1.055, 2.4);
  const b2 = b <= 0.03928 ? b / 12.92 : Math.pow((b + 0.055) / 1.055, 2.4);

  return 0.2126 * r2 + 0.7152 * g2 + 0.0722 * b2;
}

export function adjustColor(rgb: string, isLight: boolean): string {
  const match = rgb.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  if (!match) return rgb;
  let r = parseInt(match[1], 10);
  let g = parseInt(match[2], 10);
  let b = parseInt(match[3], 10);

  if (isLight) {
    r = Math.max(0, r - 40);
    g = Math.max(0, g - 40);
    b = Math.max(0, b - 40);
  } else {
    r = Math.min(255, r + 40);
    g = Math.min(255, g + 40);
    b = Math.min(255, b + 40);
  }

  return `rgb(${r}, ${g}, ${b})`;
}