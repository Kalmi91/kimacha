// Mixes two theme colors: `ratio` is the share of `a` (0..1), the rest is `b` (like CSS `color-mix(in srgb, a 42%, b)`).
// Only #rgb and #rrggbb are mixed; anything else (rgba(), a name) cannot be, so the first color comes back unchanged.
const HEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export function hexChannels(hex: string): [number, number, number] | null {
  const m = HEX.exec(hex);
  if (!m) return null;
  const full = m[1].length === 3 ? m[1].replace(/./g, (c) => c + c) : m[1];
  return [parseInt(full.slice(0, 2), 16), parseInt(full.slice(2, 4), 16), parseInt(full.slice(4, 6), 16)];
}

export function mixColor(a: string, b: string, ratio: number): string {
  const ca = hexChannels(a);
  const cb = hexChannels(b);
  if (!ca || !cb) return a;
  const r = Math.min(1, Math.max(0, ratio));
  const hex = (i: number) => Math.round(ca[i] * r + cb[i] * (1 - r)).toString(16).padStart(2, '0');
  return `#${hex(0)}${hex(1)}${hex(2)}`.toUpperCase();
}
