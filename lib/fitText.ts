import { useWindowDimensions } from 'react-native';

// a spanyol szavak és a spanyol felület
// feliratai hosszabbak az angolnál, és a natív Text egy sor-konténerben nem
// törik a hosszú szót, ezért a nagy betűs szövegek kilógtak vagy a bal széle
// levágódott ("reason (justification)" -> "eason"). A web nem ismeri az
// `adjustsFontSizeToFit`-et, ezért ez a közös helper hossz szerint lépcsőzi a
// betűméretet: a legnagyobb lépcsőt választja, amin a leghosszabb szó még
// elfér egy sorban, és a teljes szöveg legfeljebb `maxLines` sorba törik.

// A Theme.fontSize skála + a kártyák 32-es nagy szava.
export const FIT_STEPS = [32, 28, 22, 18, 16, 14, 12] as const;

// Egy karakter átlagos szélessége em-ben (latin, félkövér / normál), szándékosan
// óvatos: inkább egy lépcsővel kisebb betű, mint egy levágott szó.
const CHAR_EM_BOLD = 0.62;
const CHAR_EM_REGULAR = 0.55;
const CAPS_EXTRA_EM = 0.08;

interface FitOptions {
  /** A kívánt (legnagyobb) betűméret. */
  base: number;
  /** Az elérhető szélesség dp-ben (ablak-szélesség mínusz padding / testvérek). */
  width: number;
  /** Legfeljebb ennyi sor (alap: 3). */
  maxLines?: number;
  /** Rendszer-betűméret szorzó (alap: 1). */
  fontScale?: number;
  /** Félkövér szöveg (alap: igen). */
  bold?: boolean;
  /** A legkisebb megengedett méret (alap: 12). */
  min?: number;
  /** Nagybetűs megjelenítés (textTransform: uppercase): a betűk szélesebbek. */
  caps?: boolean;
}

// Szóhatárok: szóköz, per-jel és kötőjel után törhet a sor (a natív Text is így tör).
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
    // mohó sortörés a becsült karakterszámmal
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

// Hook: az ablak-szélességből és a rendszer betűméretből számol. `reserve` a
// szélesség, amit a paddingek / testvér elemek visznek el.
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
