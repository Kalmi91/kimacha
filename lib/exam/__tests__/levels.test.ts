// The A2, B1 and B2 level exams with the same
// rule as A1: unlock = 80% of the level's cards learned (SM-2 `review`) + one
// finished grammar lesson of the level; pass = 80%; items only from the level's learned words and finished lessons.

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

describe('the levels of the level exam', () => {
  it('all four levels have an exam, from A1 to B2', () => {
    expect(EXAM_LEVELS).toEqual(LEVELS);
  });

  it('levelHasLesson: with Spanish as the target there is a lesson on every level, es→en has them on B1 and B2 too (since the English B1 and B2 lessons)', () => {
    for (const level of LEVELS) expect(levelHasLesson(level, 'es')).toBe(true);
    expect(levelHasLesson('B1', 'en')).toBe(true);
    expect(levelHasLesson('B2', 'en')).toBe(true);
  });
});

describe.each(LEVELS)('%s exam unlock (80% learned words + one finished lesson of the level)', (level) => {
  const total = () => ids(level).length;
  const needed = () => Math.ceil((total() * EXAM_UNLOCK_PCT) / 100);

  it('80% of the level cards + one finished level lesson opens it', () => {
    const cards = ids(level).slice(0, needed()).map(review);
    const status = examStatusFor(level, 'es', cards, [doneRow(topicsOf(level)[0])]);
    expect(status).toMatchObject({ level, total: total(), needed: needed(), missing: 0, lessonDone: true, unlocked: true });
  });

  it('one learned word fewer: locked, and exactly 1 is missing', () => {
    const cards = ids(level).slice(0, needed() - 1).map(review);
    const status = examStatusFor(level, 'es', cards, [doneRow(topicsOf(level)[0])]);
    expect(status).toMatchObject({ missing: 1, lessonDone: true, unlocked: false });
  });

  it('enough words, but no finished level lesson: locked (a lesson of another level does not count)', () => {
    const cards = ids(level).map(review);
    const other = LEVELS.find((l) => l !== level) as PcicLevel;
    const status = examStatusFor(level, 'es', cards, [doneRow(topicsOf(other)[0])]);
    expect(status).toMatchObject({ missing: 0, lessonDone: false, unlocked: false });
  });

  it('learned words of another level do not open it', () => {
    const other = LEVELS.find((l) => l !== level) as PcicLevel;
    const status = examStatusFor(level, 'es', ids(other).map(review), [doneRow(topicsOf(level)[0])]);
    expect(status).toMatchObject({ learned: 0, unlocked: false });
  });
});

describe.each(LEVELS)('%s exam items: only from the learned words and finished lessons of the level', (level) => {
  // The learner has gone through the earlier levels: the words of the previous levels are learned, their lessons are done.
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
  // The rest of the level's cards exist but are not learned: their words must not get into an item.
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

  it('the 30 items per the plan come together (word, grammar, reading)', () => {
    expect(exam).toHaveLength(30);
    expect(kind('word_type')).toBe(EXAM_BLUEPRINT.wordType);
    expect(kind('gap_mc')).toBe(EXAM_BLUEPRINT.gap);
    expect(kind('reading_mc')).toBeGreaterThan(0);
  });

  it('every word-based item comes from a learned card of the level, no unlearned word anywhere', () => {
    const used = exam.flatMap((i) => ('itemId' in i ? [i.itemId] : 'itemIds' in i ? i.itemIds : []));
    expect(used.length).toBeGreaterThan(0);
    for (const id of used) expect(learnedOfLevel.has(id)).toBe(true);
    for (const it of unlearned) expect(used).not.toContain(it.id);
  });

  it('every word of the sentence items is learned (of earlier levels too) or free', () => {
    const ctx = { learned: learnedEntries(cards, 'es', findPcicItem), tenses };
    const sentences = exam.flatMap((i) =>
      i.kind === 'sent_order' ? [i.answerTokens.join(' ')] : i.kind === 'sent_type' ? [i.answer] : i.kind === 'reading_mc' ? [i.text] : [],
    );
    expect(sentences.length).toBeGreaterThan(2);
    for (const sentence of sentences) expect(unknownTokens(sentence, 'es', ctx)).toEqual([]);
  });

  it('grammar items come from the finished lessons of the level (and the levels finished before it)', () => {
    const gaps = exam.filter((i): i is Extract<ExamItem, { kind: 'gap_mc' }> => i.kind === 'gap_mc');
    // The level's exam asks only from the lessons of ITS OWN level, those of the previous levels are not included.
    for (const g of gaps) expect(topicsOf(level)).toContain(g.topicId);
  });
});

describe('pass mark: 80%', () => {
  it('24 right out of 30 passes, 23 does not (the same threshold on every level)', () => {
    expect(EXAM_PASS_PCT).toBe(80);
    expect(examPassed(24, 30)).toBe(true);
    expect(examPassed(23, 30)).toBe(false);
  });
});
