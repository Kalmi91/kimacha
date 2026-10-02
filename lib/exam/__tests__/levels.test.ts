// PLAN-vizsga A. szakasz 4. lépés (Kálmán, 2026-10-01): az A2, B1 és B2 szintvizsga ugyanazzal a
// szabállyal, mint az A1: feloldás = a szint kártyáinak 80%-a tanult (SM-2 `review`) + a szint egy
// kész nyelvtani leckéje; átmenés 80%; a tételek csak a szint tanult szavaiból és kész leckéiből.

import { findPcicItem, pcicItemsForLevel, setPcicTarget, type PcicLevel } from '@/data/pcic';
import { hasLesson, syllabusForLevel } from '@/lib/grammar/syllabus';
import { resolvedTensesFromLessons, unknownTokens } from '@/lib/knownSentence';
import { learnedEntries } from '@/lib/sentenceCards';
import { sm2NewCard, type Sm2Card } from '@/lib/sm2';
import { buildExam, EXAM_BLUEPRINT } from '../builder';
import { a1SeedCards } from '../devSeed';
import { gapSourcesForLevel } from '../grammarItems';
import { examPassed, EXAM_PASS_PCT } from '../score';
import { EXAM_LEVELS, type ExamItem } from '../types';
import { examStatusFor, EXAM_UNLOCK_PCT, levelHasLesson } from '../unlock';

const LEVELS: PcicLevel[] = ['A1', 'A2', 'B1', 'B2'];
const TODAY = '2026-10-01';

const ids = (level: PcicLevel) => pcicItemsForLevel(level).map((i) => i.id);
const review = (itemId: string): Sm2Card => ({ ...sm2NewCard(itemId), state: 'review', interval: 3, due: '2026-10-05' });
const topicsOf = (level: PcicLevel) => syllabusForLevel(level, 'es').filter((t) => hasLesson('es', t.id)).map((t) => t.id);
const doneRow = (topicId: string) => ({ itemId: topicId, state: 'done', data: { correct: 1, total: 1 } });

beforeEach(() => setPcicTarget('es'));
afterAll(() => setPcicTarget('es'));

describe('a szintvizsga szintjei', () => {
  it('mind a négy szintnek van vizsgája, A1-től B2-ig', () => {
    expect(EXAM_LEVELS).toEqual(LEVELS);
  });

  it('levelHasLesson: spanyol célnyelven minden szinten van lecke, es→en B1-en van (az angol B1 leckék óta), B2-n nincs (ott nincs vizsga-sor)', () => {
    for (const level of LEVELS) expect(levelHasLesson(level, 'es')).toBe(true);
    expect(levelHasLesson('B1', 'en')).toBe(true);
    expect(levelHasLesson('B2', 'en')).toBe(false);
  });
});

describe.each(LEVELS)('%s vizsga feloldása (80% tanult szó + egy kész lecke a szintről)', (level) => {
  const total = () => ids(level).length;
  const needed = () => Math.ceil((total() * EXAM_UNLOCK_PCT) / 100);

  it('a szint kártyáinak 80%-a + egy kész szint-lecke nyitja', () => {
    const cards = ids(level).slice(0, needed()).map(review);
    const status = examStatusFor(level, 'es', cards, [doneRow(topicsOf(level)[0])]);
    expect(status).toMatchObject({ level, total: total(), needed: needed(), missing: 0, lessonDone: true, unlocked: true });
  });

  it('eggyel kevesebb tanult szó: zárva, és pontosan 1 hiányzik', () => {
    const cards = ids(level).slice(0, needed() - 1).map(review);
    const status = examStatusFor(level, 'es', cards, [doneRow(topicsOf(level)[0])]);
    expect(status).toMatchObject({ missing: 1, lessonDone: true, unlocked: false });
  });

  it('elég szó, de nincs kész szint-lecke: zárva (másik szint leckéje nem számít)', () => {
    const cards = ids(level).map(review);
    const other = LEVELS.find((l) => l !== level) as PcicLevel;
    const status = examStatusFor(level, 'es', cards, [doneRow(topicsOf(other)[0])]);
    expect(status).toMatchObject({ missing: 0, lessonDone: false, unlocked: false });
  });

  it('másik szint tanult szavai nem nyitják', () => {
    const other = LEVELS.find((l) => l !== level) as PcicLevel;
    const status = examStatusFor(level, 'es', ids(other).map(review), [doneRow(topicsOf(level)[0])]);
    expect(status).toMatchObject({ learned: 0, unlocked: false });
  });
});

describe.each(LEVELS)('%s vizsga tételei: csak a szint tanult szavaiból és kész leckéiből', (level) => {
  // A tanuló végigjárta az addigi szinteket: az előző szintek szavai tanultak, a leckéik készek.
  const upTo = LEVELS.slice(0, LEVELS.indexOf(level) + 1);
  const allTopics = upTo.flatMap(topicsOf);
  const cards: Sm2Card[] = [];
  const learnedOfLevel = new Set<string>();
  for (const l of upTo) {
    for (const c of a1SeedCards(ids(l), TODAY)) {
      cards.push(c);
      if (l === level) learnedOfLevel.add(c.itemId);
    }
  }
  // A szint kártyáinak többi része létezik, de nem tanult: azok szavai nem kerülhetnek tételbe.
  const unlearned = pcicItemsForLevel(level).filter((i) => !learnedOfLevel.has(i.id));
  const tenses = resolvedTensesFromLessons(allTopics);
  const exam = buildExam({
    target: 'es',
    items: pcicItemsForLevel(level),
    cards,
    tenses,
    gapSources: gapSourcesForLevel(level, 'es', allTopics),
    lookup: findPcicItem,
    seed: 7,
  });
  const kind = (k: ExamItem['kind']) => exam.filter((i) => i.kind === k).length;

  it('a terv szerinti 30 tétel áll össze (szó, nyelvtan, olvasás)', () => {
    expect(exam).toHaveLength(30);
    expect(kind('word_type')).toBe(EXAM_BLUEPRINT.wordType);
    expect(kind('gap_mc')).toBe(EXAM_BLUEPRINT.gap);
    expect(kind('reading_mc')).toBeGreaterThan(0);
  });

  it('minden szó-alapú tétel a szint tanult kártyájából jön, a nem tanult szó sehol nincs', () => {
    const used = exam.flatMap((i) => ('itemId' in i ? [i.itemId] : 'itemIds' in i ? i.itemIds : []));
    expect(used.length).toBeGreaterThan(0);
    for (const id of used) expect(learnedOfLevel.has(id)).toBe(true);
    for (const it of unlearned) expect(used).not.toContain(it.id);
  });

  it('a mondat-tételek minden szava tanult (a korábbi szinteké is) vagy szabad', () => {
    const ctx = { learned: learnedEntries(cards, 'es', findPcicItem), tenses };
    const sentences = exam.flatMap((i) =>
      i.kind === 'sent_order' ? [i.answerTokens.join(' ')] : i.kind === 'sent_type' ? [i.answer] : i.kind === 'reading_mc' ? [i.text] : [],
    );
    expect(sentences.length).toBeGreaterThan(2);
    for (const sentence of sentences) expect(unknownTokens(sentence, 'es', ctx)).toEqual([]);
  });

  it('a nyelvtani tételek a szint (és az előtte kész szintek) kész leckéiből jönnek', () => {
    const gaps = exam.filter((i): i is Extract<ExamItem, { kind: 'gap_mc' }> => i.kind === 'gap_mc');
    // A szint vizsgája csak a SAJÁT szint leckéiből kérdez, az előző szinteké nem kerül bele.
    for (const g of gaps) expect(topicsOf(level)).toContain(g.topicId);
  });
});

describe('átmenés: 80%', () => {
  it('30 tételből 24 jó átmegy, 23 nem (minden szinten ugyanaz a küszöb)', () => {
    expect(EXAM_PASS_PCT).toBe(80);
    expect(examPassed(24, 30)).toBe(true);
    expect(examPassed(23, 30)).toBe(false);
  });
});
