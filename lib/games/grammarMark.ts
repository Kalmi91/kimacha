// Sentence-side logic of the "mark it in the sentence" exercise. The screen
// only renders; tokenization and hit detection live here so they can be
// proven by tests (same scheme as in grammarChoice's round building).

import type { GrammarMarkItem } from './content';

interface MarkToken {
  /** The piece to display, without spaces. */
  text: string;
  /** Whether it is a word (tappable), or punctuation/whitespace. */
  isWord: boolean;
}

// Spanish punctuation goes NEXT TO the word, not into it: the words of "¿Qué haces?" are
// qué/haces, while ¿ and ? are separate, non-tappable pieces. The accent and ñ are
// part of the word, and a hyphenated form (se-lo) stays in one piece.
const WORD_RE = /[\p{L}\p{M}\d]+(?:['’-][\p{L}\p{M}\d]+)*/gu;

/** The sentence's word and non-word pieces, in original order. */
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
 * Which TOKEN is the correct answer, or -1 if the given word is not in the sentence
 * (the audit gates this; at runtime the screen then marks nothing).
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
