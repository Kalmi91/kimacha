// Which sentences make up one round of the Sentences tab (Kálmán 2026-10-12, FB524): SENTENCE_ROUND_SIZE sentences, each
// on its own rung of the ladder (lib/sentenceLadder.ts) and played through that rung's steps (lib/sentenceSteps.ts; only the
// typing step credits words, lib/sentenceTyping.ts). The queue (lib/sentenceTab.ts buildSentenceQueue) is already in priority
// order: most due words first, then the least fresh review (equals in seeded random order, recent sentences last). A sentence already on rung 2 or 3 comes before a fresh one, and a
// round takes at most MAX_PER_RUNG sentences of one rung while others are available (FB569: a varied round). Variety (FB504)
// is applied on top of that order, and gives way when the pool is too small for it.

import type { PcicTarget } from '@/data/pcic';
import { sentenceTokens } from '@/lib/knownSentence';
import { tileWords } from '@/lib/sentenceCards';
import { shuffleArray } from '@/lib/shuffle';
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
  hu: new Set([
    'a', 'az', 'egy', 'és', 'is', 'de', 'vagy', 'hogy', 'nem', 'én', 'te', 'ő', 'mi', 'ti', 'ők', 'van', 'vagyok',
    'vagy', 'vagyunk', 'vagytok', 'vannak', 'volt', 'itt', 'ott', 'meg', 'el', 'ki', 'be', 'fel', 'le', 'már', 'még',
    'nagyon', 'ez', 'az', 'ezt', 'azt',
  ]),
  de: new Set([
    'der', 'die', 'das', 'den', 'dem', 'des', 'ein', 'eine', 'einen', 'einem', 'einer', 'und', 'oder', 'aber', 'nicht',
    'kein', 'keine', 'ich', 'du', 'er', 'sie', 'es', 'wir', 'ihr', 'mich', 'dich', 'ihn', 'uns', 'euch', 'mein', 'meine',
    'dein', 'deine', 'sein', 'seine', 'ist', 'bin', 'bist', 'sind', 'seid', 'war', 'hat', 'habe', 'hast', 'haben', 'in',
    'im', 'an', 'am', 'auf', 'zu', 'zum', 'zur', 'mit', 'von', 'vom', 'für', 'aus', 'bei', 'nach', 'hier', 'da', 'dort',
    'sehr', 'auch', 'noch', 'schon', 'dies', 'diese',
  ]),
};

/** The seed of a new round (FB587). A function so that a screen test can pin it: undefined = the old fixed order. */
export const roundSeed = (): number | undefined => Date.now();

/** A round takes at most this many sentences of the same rung while sentences of other rungs are available. */
export const MAX_PER_RUNG = 2;

const rungOf = (e: SentenceEntry): number => e.rung ?? 1;

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

/**
 * Adds candidates to `chosen` until `count` is reached: the rung cap first (`caps`: the same rung at most that often), within it
 * the strictest variety first. Each pick is the best fitting candidate: a started sentence before a fresh one, then the most
 * `focus` words, then the most due words NOT yet covered by the sentences already chosen (FB587: as many different due words
 * as possible); equals keep the candidates' order (the queue's priority, recent last, seeded random).
 */
function fill(chosen: SentenceEntry[], candidates: readonly SentenceEntry[], count: number, target: PcicTarget, maxSame: number, caps: readonly number[], focus?: ReadonlySet<string>): void {
  const score = (e: SentenceEntry, covered: ReadonlySet<string>): number[] => [
    rungOf(e) > 1 ? 1 : 0,
    focus ? e.wordIds.filter((id) => focus.has(id)).length : 0,
    e.dueIds.filter((id) => !covered.has(id)).length,
  ];
  const beats = (a: number[], b: number[]): boolean => {
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] > b[i];
    return false;
  };
  for (const cap of caps) {
    for (const level of [0, 1, 2]) {
      while (chosen.length < count) {
        const covered = new Set(chosen.flatMap((c) => c.dueIds));
        let best: SentenceEntry | undefined;
        let bestScore: number[] = [];
        for (const cand of candidates) {
          if (chosen.includes(cand) || chosen.filter((c) => rungOf(c) === rungOf(cand)).length >= cap || !fits(level, cand, chosen, target, maxSame)) continue;
          const sc = score(cand, covered);
          if (!best || beats(sc, bestScore)) {
            best = cand;
            bestScore = sc;
          }
        }
        if (!best) break;
        chosen.push(best);
      }
      if (chosen.length >= count) return;
    }
  }
}

/**
 * The sentences of one round from a priority-ordered queue: the started ones (rung 2 or 3) before the fresh ones, then the
 * ones that cover the most different due words (`focus` words first), at most MAX_PER_RUNG of one rung (a pool with one rung
 * only has no cap), variety applied on top (at most half of them share their first word, a content word in at most 2); a pool
 * too small for the rules gives way to them. With a `seed` the round is in seeded random order (FB587), without it in the
 * queue's order.
 */
export function pickSentences(queue: readonly SentenceEntry[], target: PcicTarget, count: number, opts: { seed?: number; focus?: ReadonlySet<string> } = {}): SentenceEntry[] {
  const maxSame = Math.max(1, Math.floor(count / 2));
  const chosen: SentenceEntry[] = [];
  const ordered = [...queue.filter((e) => rungOf(e) > 1), ...queue.filter((e) => rungOf(e) === 1)];
  const caps = new Set(queue.map(rungOf)).size > 1 ? [MAX_PER_RUNG, Infinity] : [Infinity];
  fill(chosen, ordered, count, target, maxSame, caps, opts.focus);
  const inQueueOrder = queue.filter((e) => chosen.includes(e));
  return opts.seed === undefined ? inQueueOrder : shuffleArray(inQueueOrder, opts.seed);
}
