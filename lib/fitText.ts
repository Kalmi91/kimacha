import { useWindowDimensions } from 'react-native';

// Spanish words and Spanish UI
// labels are longer than English ones, and native Text in a row container does not
// break a long word, so large-type texts overflowed or had their left edge
// clipped ("reason (justification)" -> "eason"). The web does not support
// `adjustsFontSizeToFit`, so this shared helper steps the font size down by
// text length: it picks the largest step at which the longest word still
// fits on one line and the whole text wraps into at most `maxLines` lines.

// The Theme.fontSize scale + the 32 px large word on the cards.
export const FIT_STEPS = [32, 28, 22, 18, 16, 14, 12] as const;

// Average width of one character in em (Latin, bold / regular), deliberately
// conservative: better a font one step smaller than a clipped word.
const CHAR_EM_BOLD = 0.62;
const CHAR_EM_REGULAR = 0.55;
const CAPS_EXTRA_EM = 0.08;

interface FitOptions {
  /** The desired (largest) font size. */
  base: number;
  /** The available width in dp (window width minus padding / siblings). */
  width: number;
  /** At most this many lines (default: 3). */
  maxLines?: number;
  /** System font-size multiplier (default: 1). */
  fontScale?: number;
  /** Bold text (default: yes). */
  bold?: boolean;
  /** The smallest allowed size (default: 12). */
  min?: number;
  /** Uppercase display (textTransform: uppercase): the letters are wider. */
  caps?: boolean;
}

// Word boundaries: a line may break after a space, slash or hyphen (native Text breaks the same way).
function tokens(text: string): string[] {
  return (text.match(/[^\s/-]+[\s/-]*/g) ?? []).map((w) => w.replace(/\s+$/, ''));
}

export function fitFontSize(text: string, opts: FitOptions): number {
  const { base, width, maxLines = 3, fontScale = 1, bold = true, min = 12, caps = false } = opts;
  const words = tokens(text);
  if (words.length === 0 || width <= 0) return base;
  const em = (bold ? CHAR_EM_BOLD : CHAR_EM_REGULAR) + (caps ? CAPS_EXTRA_EM : 0);
  const candidates = [base, ...FIT_STEPS.filter((s) => s < base && s >= min)];
  for (const size of candidates) {
    const charPx = size * fontScale * em;
    const perLine = Math.floor(width / charPx);
    if (perLine < 1) continue;
    const longest = Math.max(...words.map((w) => w.length));
    if (longest > perLine) continue;
    // greedy line wrapping using the estimated character count
    let lines = 1;
    let used = 0;
    for (const w of words) {
      const need = w.length + (used > 0 ? 1 : 0);
      if (used + need > perLine) {
        lines += 1;
        used = w.length;
      } else {
        used += need;
      }
    }
    if (lines <= maxLines) return size;
  }
  return Math.min(candidates[candidates.length - 1], base);
}

// Hook: computes from the window width and the system font size. `reserve` is the
// width taken up by paddings / sibling elements.
export function useFitFontSize(
  text: string,
  opts: { base: number; reserve?: number; maxLines?: number; bold?: boolean; min?: number; caps?: boolean },
): number {
  const { width, fontScale } = useWindowDimensions();
  return fitFontSize(text, {
    base: opts.base,
    width: width - (opts.reserve ?? 64),
    maxLines: opts.maxLines,
    bold: opts.bold,
    min: opts.min,
    caps: opts.caps,
    fontScale,
  });
}
