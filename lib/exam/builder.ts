// PLAN-vizsga A. szakasz 2. lépés (Kálmán, 2026-10-01, A7 b + a 4. követelmény):
// a szintvizsga tételeinek építője. A régi (4afeb8c^) lib/examBuilder.ts a régi
// data/words szókészletből és a data/exams JSON-ból épített; ez CSAK a szint
// TANULT szavaiból (SM-2 `review`) és a szint kész nyelvtani leckéiből.
//
// Észak-csillag (docs/NORTH-STAR.md): soha mondat ismeretlen szóval. A szó-alapú
// mondatok (összerakás, beírás, olvasás) a lib/knownSentence.ts kapuján mennek át
// (tanult szó + a kész leckékkel feloldott igeidő + szabad szavak; a tenseGate
// szerkezet-szabálya is ott fut), a csapda-csempék a tanult szavakból jönnek.
// Tiszta modul: nincs adatbázis, nincs betöltött korpusz, a hívó adja az adatot.

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
 * Szóbeli tétel a vizsgában (13. lépés). DÖNTÉS KELL: hány legyen a 30-ból, Kálmán nem döntötte el; az
 * alapérték 4. A szóbeli a szó (-2) és a nyelvtan (-2) rovására kerül a 30-ba, hogy az összes tétel ne nőjön.
 */
export const EXAM_SPEAK_COUNT = 4;
/** Tételszám fajtánként: 10 szó, 10 nyelvtan, 6 olvasás, EXAM_SPEAK_COUNT szóbeli = 30. */
export const EXAM_BLUEPRINT = { wordType: 5, match: 2, sentOrder: 2, sentType: 1, speak: EXAM_SPEAK_COUNT, gap: 10, reading: 6 } as const;
export const MATCH_PAIRS = 4;
const MIN_SENTENCE_WORDS = 3;
const MAX_SENTENCE_WORDS = 9;

interface ExamBuildInput {
  target: PcicTarget;
  /** A szint kártyái (a hívó a betöltött korpuszból adja). */
  items: PcicItem[];
  /** Az összes SM-2 kártya; csak a szint tanult kártyái számítanak. */
  cards: Sm2Card[];
  /** A kész leckékkel feloldott igeidők (csak spanyol célnyelven számít). */
  tenses: ReadonlySet<ResolvedTense>;
  /** A szint kész leckéinek gap tételei (lib/exam/grammarItems.ts). */
  gapSources: GapSource[];
  /**
   * Tétel az azonosítóból. A mondat-kapu szókincse MINDEN tanult szóból épül, a korábbi szintekéből is
   * (egy A2 mondatban ott az A1 szó): ha nincs megadva, a szint tételei számítanak (A1-nél ez ugyanaz).
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
  // A szóforrás-sorrend a seedből keveredik: ugyanaz a seed ugyanazt a vizsgát adja.
  const learned = shuffleArray(
    learnedCards.map((c) => byId.get(c.itemId)!),
    hashString(`words:${seed}`),
  );
  const promptOf = (it: PcicItem) => (target === 'es' ? it.en : it.es);
  const answerOf = (it: PcicItem) => (target === 'es' ? it.es : it.en);

  // Mondat-készlet: csak olyan példamondat, aminek minden szava tanult vagy szabad.
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

  // Olvasás (A7 b): két tanult mondatból álló célnyelvi szöveg; a jó válasz a két mondat kiinduló
  // nyelvű fordítása, a rossz válaszokban az egyik fele más tanult mondat fordítása.
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

  // Ha a mondat-készlet kevés (pl. még nincs kész igeidő-lecke), a hiányzó mondat-tételek
  // szó-beírásra cserélődnek, hogy a szó-rész hossza ne essen vissza.
  const sentenceShortfall = EXAM_BLUEPRINT.sentOrder + EXAM_BLUEPRINT.sentType - ordered.length - typed.length;
  const usedWords = new Set<string>();
  const wordType: ExamItem[] = [];
  // A mondat-tételek gazda-szava nem kérdezhető külön is (a csempe / a szöveg elárulná a választ).
  const askable = learned.filter((it) => !usedSentences.has(it.id));
  for (const it of askable) {
    if (wordType.length >= EXAM_BLUEPRINT.wordType + sentenceShortfall) break;
    usedWords.add(it.id);
    wordType.push({ kind: 'word_type', skill: 'words', itemId: it.id, prompt: promptOf(it), hint: it.hint, answer: answerOf(it) });
  }

  // Párosítás: egyértelmű, egy jelentésű szavak (nincs hint, perjeles alternatíva, zárójel),
  // egy csoporton belül egyik oldalon sincs ismétlődés.
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

  // Nyelvtan: a kész leckék gap tételei, leckénként körbe-körbe véve, hogy ne egy lecke adja az egészet.
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

  // Szóbeli (13. lépés): ugyanazon a mondat-kapun átment tanult mondat, a kiinduló nyelvről kell elmondani.
  const speakBlock: ExamItem[] = spoken.map((p) => ({ kind: 'speak', skill: 'speaking', itemId: p.itemId, prompt: p.source, expected: p.target, mode: 'translate' }));

  return [...wordsBlock, ...grammarBlock, ...readingBlock, ...speakBlock];
}
