// The typed sentence of the Sentences tab, word by word (Kálmán 2026-10-12): which learned words of the sentence were
// typed right, even when the rest of the answer is wrong. Pure; built on the sentence grader's rules
// (lib/pcicMatch.ts): several accepted answers ("/" and parentheses), the subject pronoun may be left out, and a word
// is right the way a word card is graded (exact, or an accent-only slip while strict accents is off).

import type { PcicTarget } from '@/data/pcic';
import { sentenceTokens } from '@/lib/knownSentence';
import { gradePcicAnswer, pcicAlternatives, suggestedGrade, withoutLeadingSubjectPronoun } from '@/lib/pcicMatch';
import type { SentenceEntry } from '@/lib/sentenceTab';

export interface WordVerdict {
  /** The learned card (item id). */
  id: string;
  /** Every word of the card in the sentence was typed right. */
  right: boolean;
  /** The card is due today: a wrong word then counts as a wrong typed answer. */
  due: boolean;
}

/** The accepted forms of the target sentence, as tokens: each alternative, and each without its leading subject pronoun. */
function variants(entry: SentenceEntry, target: PcicTarget): string[][] {
  const out: string[][] = [];
  for (const alt of pcicAlternatives(entry.target)) {
    out.push(sentenceTokens(alt, target));
    // dropping the subject pronoun is a Spanish rule
    const short = target === 'hu' ? null : withoutLeadingSubjectPronoun(alt);
    if (short) out.push(sentenceTokens(short, target));
  }
  return out.filter((v) => v.length > 0);
}

/** Longest common subsequence of the typed words and the variant: which variant positions the answer got right. */
function matchedPositions(typed: readonly string[], variant: readonly string[], same: (a: string, b: string) => boolean): Set<number> {
  const n = typed.length;
  const m = variant.length;
  const len: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      len[i][j] = same(typed[i], variant[j]) ? len[i + 1][j + 1] + 1 : Math.max(len[i + 1][j], len[i][j + 1]);
    }
  }
  const matched = new Set<number>();
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (same(typed[i], variant[j]) && len[i][j] === len[i + 1][j + 1] + 1) {
      matched.add(j);
      i++;
      j++;
    } else if (len[i + 1][j] >= len[i][j + 1]) i++;
    else j++;
  }
  return matched;
}

/**
 * A verdict per learned card of the sentence, from what was typed. The answer is lined up against the accepted form it
 * is closest to (fewest missing + extra words; a left-out subject pronoun is then not an error and does not count).
 * A card with a word that is not in the closest form (the dropped pronoun) gets no verdict for that word.
 */
export function gradeTypedWords(typed: string, entry: SentenceEntry, target: PcicTarget, strictAccents = false): WordVerdict[] {
  const typedWords = sentenceTokens(typed, target);
  const same = (a: string, b: string) => suggestedGrade(gradePcicAnswer(a, b, strictAccents, target)) === 'good';
  let best: { variant: string[]; matched: Set<number> } | null = null;
  let bestCost = Infinity;
  for (const variant of variants(entry, target)) {
    const matched = matchedPositions(typedWords, variant, same);
    const cost = variant.length - matched.size + (typedWords.length - matched.size);
    // Nothing matched at all (e.g. an empty answer): the full sentence is the form, not the shorter one with no pronoun.
    if (cost < bestCost && !(best && matched.size === 0)) {
      best = { variant, matched };
      bestCost = cost;
    }
  }
  const dueIds = new Set(entry.dueIds);
  const out: WordVerdict[] = [];
  for (const slot of entry.slots) {
    let present = 0;
    let right = 0;
    for (const word of slot.words) {
      const at = best ? best.variant.flatMap((w, p) => (w === word ? [p] : [])) : [];
      if (at.length === 0) continue;
      present++;
      if (at.some((p) => best!.matched.has(p))) right++;
    }
    if (present === 0 && best) continue;
    out.push({ id: slot.id, right: best !== null && present > 0 && right === present, due: dueIds.has(slot.id) });
  }
  return out;
}
