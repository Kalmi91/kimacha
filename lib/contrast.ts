import { hexChannels } from './mixColor';

// WCAG relative luminance of a #rgb / #rrggbb color; null for anything else.
function luminance(hex: string): number | null {
  const c = hexChannels(hex);
  if (!c) return null;
  const [r, g, b] = c.map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// WCAG contrast ratio (1..21) of two hex colors; 1 when either is not a hex color.
export function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  if (la === null || lb === null) return 1;
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

// Of the candidate text colors the one that contrasts most with `fill` (the first when they tie or `fill` is not a hex color).
export function textOn(fill: string, first: string, ...rest: string[]): string {
  return rest.reduce((best, c) => (contrastRatio(fill, c) > contrastRatio(fill, best) ? c : best), first);
}
