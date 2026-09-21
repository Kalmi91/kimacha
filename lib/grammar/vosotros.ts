// FB357 (grammar:indefinido-10-verbos:drill), Kálmán 2026-09-21: "get rid of
// vosotros from exercises". Vosotros stays in the lesson's reference tables
// (body `table` blocks, lib/grammar/lessonTypes.ts LessonBlock); this module
// is the ONE place that decides whether a DRILL ITEM counts as a vosotros
// exercise, so it can be dropped from the round the learner actually plays
// (lib/games/grammarChoice.ts buildGrammarRound is the single load site).
//
// The endings list is the standard Spanish vosotros paradigm across
// presente/indefinido/imperfecto/futuro/condicional (subjuntivo shares its
// endings with presente: -éis for -ar, -áis for -er/-ir, both already in the
// list, so no separate subjuntivo entries are needed). Checked against every
// item in data/games/grammar/es/*.json (43 files): applying it to every word
// of a full sentence has exactly two false positives in this corpus,
// "país"/"países" and "dieciséis"/"veintiséis" happen to end the same way as
// a vosotros verb but are not verbs, so both are excluded explicitly rather
// than guessed around.
import type { GrammarGapItem, GrammarItem } from '../games/content';

const VOSOTROS_ENDINGS = [
  'asteis', 'isteis', 'abais', 'íais', 'aréis', 'eréis', 'iréis',
  'aríais', 'eríais', 'iríais', 'áis', 'éis', 'ís',
];

const NOT_VOSOTROS_WORDS = new Set(['país', 'países', 'dieciséis', 'veintiséis']);

const WORD_RE = /[A-Za-zÁÉÍÓÚáéíóúñÑ]+/g;

function hasVosotrosEnding(text: string): boolean {
  const words = text.match(WORD_RE) ?? [];
  for (const w of words) {
    const wl = w.toLowerCase();
    if (NOT_VOSOTROS_WORDS.has(wl)) continue;
    if (VOSOTROS_ENDINGS.some((e) => wl.endsWith(e))) return true;
  }
  return false;
}

// The literal pronoun, "vosotros"/"vosotras" anywhere, or the object pronoun
// "os" as its own word (trailing space, per the task spec) followed by more
// text. The trailing-space requirement matters: comparativos-superlativos'
// match pair "tanto/a/os/as ... como" contains "os" only as a slash-separated
// suffix, never as its own word, so it correctly does NOT match.
//
// A plain `\bos\s` false-positives here: JS's `\b`/`\w` are ASCII-only, so an
// accented letter right before "os" (niñOS, añOS...) reads as a "boundary"
// and "os" looks like its own word (posesivos po-09: "Los niños tienen ___
// mochilas." was wrongly flagged via "niños"). Spelling out "start-of-string
// or a non-Spanish-letter" before "os" (no lookbehind, so it also runs on
// Hermes/older engines) fixes it: a Spanish letter right before "os" blocks
// the match.
const OS_PRONOUN_RE = /(^|[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ])os\s/i;

function hasVosotrosPronoun(text: string): boolean {
  return /vosotr/i.test(text) || OS_PRONOUN_RE.test(text);
}

/**
 * True if a drill item IS a vosotros exercise. `form`: the `person` field
 * says so (the reliable signal for this kind), or its `answer` is a
 * vosotros-alak. `transform`: no person field, so the `answer`/`accept`
 * conjugation or the `prompt`'s pronoun decide. `choice` (gap/mark): only
 * the CORRECT answer counts, a vosotros form used as a WRONG distractor
 * (e.g. presente-regular pr-06, teaching "this isn't it, that's vosotros")
 * is legitimate content, not an exercise that asks for vosotros. `match`
 * (see filterVosotrosPairs below, pair-level not item-level) and `why`
 * (out of FB357's scope, not an item the learner has to conjugate) are
 * never excluded here.
 */
export function isVosotrosItem(item: GrammarItem): boolean {
  switch (item.kind) {
    case 'form':
      return /vosotr/i.test(item.person) || hasVosotrosEnding(item.answer);
    case 'transform':
      return (
        hasVosotrosEnding(item.answer) ||
        (item.accept ?? []).some((a) => hasVosotrosEnding(a) || hasVosotrosPronoun(a)) ||
        hasVosotrosPronoun(item.prompt.es)
      );
    case 'mark':
      return hasVosotrosEnding(item.answer) || hasVosotrosPronoun(item.sentence);
    case 'match':
    case 'why':
      return false;
    default: {
      // GrammarGapItem: `kind` is undefined or 'gap', the only member left
      // once the cases above are excluded.
      const gap = item as GrammarGapItem;
      const correctOption = gap.options[gap.correct];
      return (correctOption !== undefined && hasVosotrosEnding(correctOption)) || hasVosotrosPronoun(gap.sentence);
    }
  }
}

/** The item list with every vosotros item (isVosotrosItem) dropped. */
export function filterVosotros<T extends GrammarItem>(items: T[]): T[] {
  return items.filter((item) => !isVosotrosItem(item));
}

/**
 * A `match` item keeps its shape but drops any pair whose Spanish side is a
 * vosotros form/pronoun ("A match itemek párjaiból a vosotros-pár esik ki, a
 * többi pár marad").
 */
export function filterVosotrosPairs<T extends { pairs: { es: string }[] }>(item: T): T {
  const pairs = item.pairs.filter((p) => !hasVosotrosEnding(p.es) && !hasVosotrosPronoun(p.es));
  if (pairs.length === item.pairs.length) return item;
  return { ...item, pairs };
}
