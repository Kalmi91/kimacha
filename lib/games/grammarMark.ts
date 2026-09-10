// FB219: a „jelöld meg a mondatban" feladat mondat-oldali logikája. A képernyő
// csak rajzol; a tokenizálás és a találat-eldöntés itt él, hogy teszttel
// bizonyítható legyen (ugyanaz a séma, mint a grammarChoice round-építésénél).

import type { GrammarMarkItem } from './content';

export interface MarkToken {
  /** A megjelenítendő darab, szóköz nélkül. */
  text: string;
  /** Szó-e (koppintható), vagy írásjel/szóköz. */
  isWord: boolean;
}

// A spanyol írásjelek a szó MELLÉ kerülnek, nem bele: „¿Qué haces?" három szava
// qué/haces, a ¿ és a ? külön, nem koppintható darab. Az ékezet és a ñ a szó
// része, a kötőjeles alak (se-lo) egyben marad.
const WORD_RE = /[\p{L}\p{M}\d]+(?:['’-][\p{L}\p{M}\d]+)*/gu;

/** A mondat szó- és nem-szó darabjai, eredeti sorrendben. */
export function markTokens(sentence: string): MarkToken[] {
  const out: MarkToken[] = [];
  let last = 0;
  for (const match of sentence.matchAll(WORD_RE)) {
    const start = match.index ?? 0;
    if (start > last) out.push({ text: sentence.slice(last, start), isWord: false });
    out.push({ text: match[0], isWord: true });
    last = start + match[0].length;
  }
  if (last < sentence.length) out.push({ text: sentence.slice(last), isWord: false });
  return out;
}

function normalize(text: string): string {
  return text.toLocaleLowerCase('es');
}

/**
 * Hányadik TOKEN a helyes válasz, vagy -1, ha a megadott szó nincs a mondatban
 * (az audit ezt kapuzza, futásidőben a képernyő ilyenkor nem jelöl semmit).
 */
export function markAnswerIndex(item: GrammarMarkItem, tokens: MarkToken[]): number {
  const wanted = normalize(item.answer.trim());
  let seen = 0;
  const occurrence = item.answerIndex ?? 0;
  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    if (!tok.isWord || normalize(tok.text) !== wanted) continue;
    if (seen === occurrence) return i;
    seen++;
  }
  return -1;
}
