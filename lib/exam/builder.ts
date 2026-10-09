// Builder of the level exam items. The old (4afeb8c^) lib/examBuilder.ts built from the old
// data/words vocabulary and the data/exams JSON; this one builds ONLY from the level's
// LEARNED words (SM-2 `review`) and the level's finished grammar lessons.
//
// North star (docs/NORTH-STAR.md): never a sentence with an unknown word. Word-based
// sentences (assembling, typing, reading) pass through the gate in lib/knownSentence.ts
// (learned word + the tenses unlocked by finished lessons + free words; the tenseGate
// structure rule runs there too), the trap tiles come from learned words.
// Pure module: no database, no loaded corpus, the caller supplies the data.

import type { PcicItem, PcicTarget } from '@/data/pcic';
import { nearMissDistractors } from '@/lib/distractors';
import { isSentenceKnown, type ResolvedTense } from '@/lib/knownSentence';
import { learnedEntries, tileWords } from '@/lib/sentenceCards';
import { hashString, shuffleArray, shuffleOptions } from '@/lib/shuffle';
import type { Sm2Card } from '@/lib/sm2';
import type { GapSource } from './grammarItems';
import type { ExamItem } from './types';
import { isExamLearned } from './unlock';

/**
 * Speaking items in the exam. Open question: how many of the 30 should be speaking is not
 * decided yet; the default is 4. Speaking takes its slots from words (-2) and grammar (-2) so the total does not grow.
 */
export const EXAM_SPEAK_COUNT = 4;
/** Item count per kind: 10 word, 10 grammar, 6 reading, EXAM_SPEAK_COUNT speaking = 30. */
export const EXAM_BLUEPRINT = { wordType: 5, match: 2, sentOrder: 2, sentType: 1, speak: EXAM_SPEAK_COUNT, gap: 10, reading: 6 } as const;
export const MATCH_PAIRS = 4;
const MIN_SENTENCE_WORDS = 3;
const MAX_SENTENCE_WORDS = 9;

interface ExamBuildInput {
  target: PcicTarget;
  /** The level's cards (the caller supplies them from the loaded corpus). */
  items: PcicItem[];
  /** All SM-2 cards; only the level's learned cards count. */
  cards: Sm2Card[];
  /** Tenses unlocked by finished lessons (matters only for a Spanish target language). */
  tenses: ReadonlySet<ResolvedTense>;
  /** Gap items of the level's finished lessons (lib/exam/grammarItems.ts). */
  gapSources: GapSource[];
  /**
   * Item lookup by id. The vocabulary of the sentence gate is built from ALL learned words, earlier levels' too
   * (an A2 sentence contains A1 words): if not given, the level's items count (for A1 this is the same).
   */
  lookup?: (id: string) => PcicItem | undefined;
  seed: number;
}

interface SentencePair {
  itemId: string;
  source: string;
  target: string;
}

function wordCount(sentence: string): number {
  return tileWords(sentence).length;
}

export function buildExam(input: ExamBuildInput): ExamItem[] {
  const { target, items, cards, gapSources, seed } = input;
  const byId = new Map(items.map((i) => [i.id, i]));
  const learnedCards = cards.filter((c) => byId.has(c.itemId) && isExamLearned(c));
  // The word source order is shuffled from the seed: the same seed gives the same exam.
  const learned = shuffleArray(
    learnedCards.map((c) => byId.get(c.itemId)!),
    hashString(`words:${seed}`),
  );
  const promptOf = (it: PcicItem) => (target === 'es' ? it.en : it.es);
  const answerOf = (it: PcicItem) => (target === 'es' ? it.es : it.en);

  // Sentence pool: only example sentences whose every word is learned or free.
  const ctx = {
    learned: learnedEntries(cards.filter(isExamLearned), target, input.lookup ?? ((id) => byId.get(id))),
    tenses: target === 'es' ? input.tenses : undefined,
  };
  const pool: SentencePair[] = [];
  for (const it of learned) {
    const src = (target === 'es' ? it.exampleEn : it.exampleEs)?.trim();
    const tgt = (target === 'es' ? it.exampleEs : it.exampleEn)?.trim();
    if (!src || !tgt) continue;
    const n = wordCount(tgt);
    if (n < MIN_SENTENCE_WORDS || n > MAX_SENTENCE_WORDS) continue;
    if (!isSentenceKnown(tgt, target, ctx)) continue;
    pool.push({ itemId: it.id, source: src, target: tgt });
  }
  const usedSentences = new Set<string>();
  const takeSentences = (n: number): SentencePair[] => {
    const out: SentencePair[] = [];
    for (const p of pool) {
      if (out.length >= n) break;
      if (usedSentences.has(p.itemId)) continue;
      usedSentences.add(p.itemId);
      out.push(p);
    }
    return out;
  };

  const vocab = learned.map((it) => answerOf(it).split(' / ')[0]);
  const ordered = takeSentences(EXAM_BLUEPRINT.sentOrder);
  const typed = takeSentences(EXAM_BLUEPRINT.sentType);
  const spoken = takeSentences(EXAM_BLUEPRINT.speak);

  // Reading: a target-language text made of two learned sentences; the correct answer is the source-language
  // translation of both sentences, in the wrong answers one half is the translation of a different learned sentence.
  const rest = pool.filter((p) => !usedSentences.has(p.itemId));
  const readingBlock: ExamItem[] = [];
  const readingCount = Math.min(EXAM_BLUEPRINT.reading, Math.floor(rest.length / 2));
  for (let k = 0; k < readingCount; k++) {
    const a = rest[2 * k];
    const b = rest[2 * k + 1];
    usedSentences.add(a.itemId);
    usedSentences.add(b.itemId);
    const others = pool.filter((p) => p.itemId !== a.itemId && p.itemId !== b.itemId && p.source !== a.source && p.source !== b.source);
    if (others.length < 2) break;
    const x = others[(2 * k) % others.length];
    const y = others[(2 * k + 1) % others.length];
    const { options, correctIndex } = shuffleOptions(
      [`${a.source} ${b.source}`, `${a.source} ${x.source}`, `${y.source} ${b.source}`],
      0,
      hashString(`reading:${a.itemId}:${b.itemId}:${seed}`),
    );
    readingBlock.push({
      kind: 'reading_mc',
      skill: 'reading',
      itemIds: [a.itemId, b.itemId],
      text: `${a.target} ${b.target}`,
      options,
      correctIndex,
    });
  }

  // If the sentence pool is small (e.g. no finished tense lesson yet), the missing sentence items
  // are replaced with word typing so that the word section does not get shorter.
  const sentenceShortfall = EXAM_BLUEPRINT.sentOrder + EXAM_BLUEPRINT.sentType - ordered.length - typed.length;
  const usedWords = new Set<string>();
  const wordType: ExamItem[] = [];
  // The host word of a sentence item cannot also be asked on its own (the tile / the text would give away the answer).
  const askable = learned.filter((it) => !usedSentences.has(it.id));
  for (const it of askable) {
    if (wordType.length >= EXAM_BLUEPRINT.wordType + sentenceShortfall) break;
    usedWords.add(it.id);
    wordType.push({ kind: 'word_type', skill: 'words', itemId: it.id, prompt: promptOf(it), hint: it.hint, answer: answerOf(it) });
  }

  // Matching: unambiguous, single-meaning words (no hint, slash alternative or parenthesis);
  // within a group there is no repetition on either side.
  const matchable = (it: PcicItem) => {
    const a = answerOf(it);
    const p = promptOf(it);
    return !it.hint && !!a && !!p && !/[/(]/.test(a) && !/[/(]/.test(p);
  };
  const matches: ExamItem[] = [];
  const free = askable.filter((it) => !usedWords.has(it.id) && matchable(it));
  for (let m = 0; m < EXAM_BLUEPRINT.match; m++) {
    const lefts = new Set<string>();
    const rights = new Set<string>();
    const group: PcicItem[] = [];
    for (let i = 0; i < free.length && group.length < MATCH_PAIRS; i++) {
      const it = free[i];
      const l = answerOf(it).toLowerCase();
      const r = promptOf(it).toLowerCase();
      if (usedWords.has(it.id) || lefts.has(l) || rights.has(r)) continue;
      lefts.add(l);
      rights.add(r);
      group.push(it);
    }
    if (group.length < MATCH_PAIRS) break;
    for (const it of group) usedWords.add(it.id);
    matches.push({
      kind: 'match',
      skill: 'words',
      itemIds: group.map((it) => it.id),
      pairs: group.map((it) => ({ left: answerOf(it), right: promptOf(it) })),
    });
  }

  const sentOrder: ExamItem[] = ordered.map((p) => {
    const answerTokens = tileWords(p.target);
    return {
      kind: 'sent_order',
      skill: 'words',
      itemId: p.itemId,
      prompt: p.source,
      answerTokens,
      sentence: p.target,
      distractors: nearMissDistractors(answerTokens, vocab, target),
    };
  });
  const sentType: ExamItem[] = typed.map((p) => ({ kind: 'sent_type', skill: 'words', itemId: p.itemId, prompt: p.source, answer: p.target }));

  const wordsBlock = shuffleArray([...wordType, ...matches, ...sentOrder, ...sentType], hashString(`order:${seed}`));

  // Grammar: the gap items of the finished lessons, taken round-robin per lesson so that one lesson does not supply everything.
  const queues = new Map<string, GapSource[]>();
  for (const g of shuffleArray(gapSources, hashString(`gap:${seed}`))) {
    queues.set(g.topicId, [...(queues.get(g.topicId) ?? []), g]);
  }
  const grammarBlock: ExamItem[] = [];
  const lists = [...queues.values()];
  while (grammarBlock.length < EXAM_BLUEPRINT.gap && lists.some((q) => q.length > 0)) {
    for (const q of lists) {
      const g = q.shift();
      if (!g || grammarBlock.length >= EXAM_BLUEPRINT.gap) continue;
      const { options, correctIndex } = shuffleOptions(g.options, g.correct, hashString(`${g.topicId}:${g.itemId}:${seed}`));
      grammarBlock.push({ kind: 'gap_mc', skill: 'grammar', topicId: g.topicId, sentence: g.sentence, options, correctIndex });
    }
  }

  // Speaking: a learned sentence that passed the same sentence gate, to be said from the source language.
  const speakBlock: ExamItem[] = spoken.map((p) => ({ kind: 'speak', skill: 'speaking', itemId: p.itemId, prompt: p.source, expected: p.target, mode: 'translate' }));

  return [...wordsBlock, ...grammarBlock, ...readingBlock, ...speakBlock];
}
