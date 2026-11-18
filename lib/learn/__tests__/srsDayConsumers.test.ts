import type { PcicItem } from '@/data/pcic';
import { getDb } from '@/lib/database';
import { practiceCandidates } from '@/lib/practice/gapFill';
import { pickGameWords } from '@/lib/practice/gameRound';
import { pickStory, type Story } from '@/lib/practice/stories';
import { recordPracticeResult } from '@/lib/practice/halfStep';
import { gradeMistakeCard } from '@/lib/mistakes/grade';
import { introduceNewWord } from '@/lib/sentenceNewWord';
import { isDueCard } from '@/lib/sentenceTab';
import { addDays, sm2NewCard, sm2Review } from '@/lib/sm2';
import { loadSrsDay } from '../srsDay';

const calendarDay = '2026-11-17';
const srsDay = '2026-11-07';
const saved = { srsDay, srsDayStepOn: srsDay };
const review = (id: string, due = srsDay, introducedAt = '2026-10-01') => ({
  ...sm2Review(sm2NewCard(id), 'good', introducedAt), due,
});

beforeEach(async () => {
  const db = getDb();
  await db.setOnboarding('en', 'es');
  await db.resetPcicCards();
  await db.setNoPileUp(true);
  await db.setSrsDay(saved);
  await db.setDailyNewLimit(5);
  await db.setPcicNewBonus(0, calendarDay);
});

it('selects due Practice words by SRS day but recent introductions by calendar day', async () => {
  const cards = [review('due'), review('later', addDays(srsDay, 1)),
    review('old', addDays(srsDay, 2), srsDay), review('recent', addDays(srsDay, 3), calendarDay)];
  const day = await loadSrsDay(getDb(), calendarDay);
  expect(practiceCandidates(cards, day, calendarDay).map((c) => c.itemId)).toEqual(['due', 'recent']);
  const findItem = (id: string): PcicItem => ({ id, es: id, en: id, kind: 'word', section: 'Test', order: 0 });
  expect(pickGameWords({ cards, today: calendarDay, srsDay: day, findItem, min: 1 }).map((i) => i.id)).toEqual(['due', 'recent']);
  expect(cards.map((c) => isDueCard(c, day))).toEqual([true, false, false, false]);
  expect(await getDb().getSrsDay()).toEqual(saved);
});

it('prioritizes reading stories using the SRS day rather than missed calendar days', () => {
  const items: PcicItem[] = [
    { id: 'book', en: 'book', es: 'libro', kind: 'word', section: 'Test', order: 0 },
    { id: 'cup', en: 'cup', es: 'taza', kind: 'word', section: 'Test', order: 1 },
  ];
  const stories: Story[] = items.map((item) => ({ id: item.id, level: 'A1',
    sentences: [{ en: `${item.en}.`, es: `${item.es}.`, word: item.id, form: item.en }] }));
  const deps = { target: 'en' as const, today: calendarDay, srsDay,
    cards: [review('book', addDays(srsDay, 1)), review('cup')],
    tenses: new Set<never>(), findItem: (id: string) => items.find((item) => item.id === id) };
  const known = new Set(['book', 'cup']);
  expect(pickStory(deps, known, stories)?.story.id).toBe('cup');
  expect(pickStory({ ...deps, srsDay: calendarDay }, known, stories)?.story.id).toBe('book');
});

it('moves due Practice cards on the SRS clock without advancing cards due only on the calendar', async () => {
  const db = getDb();
  await db.upsertPcicCard({ ...review('due'), halfSteps: 1 });
  await db.upsertPcicCard({ ...review('later', addDays(srsDay, 1)), halfSteps: 1 });
  await recordPracticeResult('due', 'correct', calendarDay);
  await recordPracticeResult('later', 'correct', calendarDay);
  expect(await db.getPcicCard('due')).toMatchObject({ due: addDays(srsDay, 3), lastReview: calendarDay });
  expect(await db.getPcicCard('later')).toMatchObject({ due: addDays(srsDay, 1), lastReview: '2026-10-01' });
  await recordPracticeResult('later', 'wrongTyped', calendarDay);
  await recordPracticeResult('later', 'wrongTyped', calendarDay);
  expect(await db.getPcicCard('later')).toMatchObject({ due: srsDay, state: 'learning', lastReview: calendarDay });
  expect(await db.getSrsDay()).toEqual(saved);
});

it('schedules sentence introductions and mistakes on the stored day, keeping daily metadata on the calendar', async () => {
  const db = getDb();
  expect(await introduceNewWord(db, 'new', calendarDay)).toBe('introduced');
  expect(await db.getPcicCard('new')).toMatchObject({ due: addDays(srsDay, 1), introducedAt: calendarDay, lastReview: calendarDay });
  expect(await gradeMistakeCard(review('mistake'), 'again', calendarDay)).toMatchObject({ due: srsDay, lastReview: calendarDay });
  expect(await db.getSrsDay()).toEqual(saved);
  await db.setNoPileUp(false);
  expect(await introduceNewWord(db, 'legacy', calendarDay)).toBe('introduced');
  expect(await db.getPcicCard('legacy')).toMatchObject({ due: addDays(calendarDay, 1), introducedAt: calendarDay });
  expect(await db.getSrsDay()).toEqual(saved);
});
