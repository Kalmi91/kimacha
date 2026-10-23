// Which sentences make up one round of the Sentences tab (Kálmán 2026-10-12, FB524): SENTENCE_ROUND_SIZE sentences, each
// played through the whole step list (lib/sentenceSteps.ts; only its typing step credits words, lib/sentenceTyping.ts).
// The queue (lib/sentenceTab.ts buildSentenceQueue) is already in priority order: most due words first, then the least
// fresh review. Variety (FB504) is applied on top of that order, and gives way when the pool is too small for it.

import type { PcicTarget } from '@/data/pcic';
import { sentenceTokens } from '@/lib/knownSentence';
import { tileWords } from '@/lib/sentenceCards';
import type { SentenceEntry } from '@/lib/sentenceTab';

/** A word counts toward the "at most 2 sentences" variety rule unless it is one of these small grammar words. */
const FUNCTION_WORDS: Record<PcicTarget, ReadonlySet<string>> = {
  es: new Set([
    'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas', 'lo', 'al', 'del', 'de', 'a', 'en', 'y', 'o', 'u', 'e', 'que',
    'no', 'con', 'por', 'para', 'sin', 'sobre', 'entre', 'se', 'me', 'te', 'le', 'les', 'nos', 'mi', 'tu', 'su', 'mis',
    'tus', 'sus', 'yo', 'tú', 'él', 'ella', 'usted', 'nosotros', 'nosotras', 'vosotros', 'vosotras', 'ellos', 'ellas',
    'ustedes', 'es', 'son', 'está', 'están', 'soy', 'eres', 'estoy', 'estás', 'somos', 'estamos', 'hay', 'muy', 'más',
    'pero', 'si',
  ]),
  en: new Set([
    'the', 'a', 'an', 'of', 'to', 'in', 'on', 'at', 'and', 'or', 'but', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me',
    'him', 'her', 'us', 'them', 'my', 'your', 'his', 'its', 'our', 'their', 'is', 'am', 'are', 'was', 'were', 'be', 'do',
    'does', 'did', "don't", "doesn't", "isn't", "aren't", 'not', 'no', 'with', 'for', 'from', 'by', 'this', 'that',
    'these', 'those', 'there', 'here', 'can', 'will', 'have', 'has', 'had',
  ]),
};

const startOf = (e: SentenceEntry): string => (tileWords(e.target)[0] ?? '').toLowerCase();

/**
 * `level` 0 = full variety, 1 = only the start rule, 2 = none (the pool is too small).
 * Start rule: no more than `maxSame` sentences with the same first word. Word rule: a content word in at most 2 sentences.
 */
function fits(level: number, cand: SentenceEntry, chosen: readonly SentenceEntry[], target: PcicTarget, maxSame: number): boolean {
  if (level >= 2) return true;
  const start = startOf(cand);
  if (chosen.filter((c) => startOf(c) === start).length >= maxSame) return false;
  if (level === 1) return true;
  const words = sentenceTokens(cand.target, target).filter((w) => !FUNCTION_WORDS[target].has(w));
  const sets = chosen.map((c) => new Set(sentenceTokens(c.target, target)));
  return words.every((w) => sets.filter((set) => set.has(w)).length < 2);
}

/** Adds candidates (in their priority order) to `chosen` until `count` is reached: the strictest variety first. */
function fill(chosen: SentenceEntry[], candidates: readonly SentenceEntry[], count: number, target: PcicTarget, maxSame: number): void {
  for (const level of [0, 1, 2]) {
    for (const cand of candidates) {
      if (chosen.length >= count) return;
      if (!chosen.includes(cand) && fits(level, cand, chosen, target, maxSame)) chosen.push(cand);
    }
  }
}

/**
 * The sentences of one round from a priority-ordered queue: the highest-priority ones, variety applied on top (at most
 * half of them share their first word, a content word in at most 2); a pool too small for the rules gives way to them.
 * The result keeps the queue's order.
 */
export function pickSentences(queue: readonly SentenceEntry[], target: PcicTarget, count: number): SentenceEntry[] {
  const maxSame = Math.max(1, Math.floor(count / 2));
  const chosen: SentenceEntry[] = [];
  fill(chosen, queue, count, target, maxSame);
  return queue.filter((e) => chosen.includes(e));
}
