jest.mock('@/lib/speech', () => require('@/test-utils/mocks').speechMock());
jest.mock('expo-router', () => require('@/test-utils/mocks').focusEffectRouterMock());
jest.mock('@/lib/answerLog', () => jest.requireActual('@/lib/answerLog.web'));
const mockItems = Array.from({ length: 15 }, (_, i) => ({ id: `a1-w${i}`, es: `palabra${i}`, en: `word${i}`, kind: 'word', section: 'Test', order: i }));
const mockUpper = { ...mockItems[0], id: 'b1-upper' };
jest.mock('@/data/pcic', () => ({
  PCIC_LEVELS: ['A1', 'B1'], PCIC_VIEW_LEVELS: ['A1', 'B1'],
  pcicItemsForLevel: (level: string) => level === 'A1' ? mockItems : [mockUpper],
  findPcicItem: (id: string) => [...mockItems, mockUpper].find((item) => item.id === id),
  levelOfItem: (id: string) => id.startsWith('a1-') ? 'A1' : id === 'b1-upper' ? 'B1' : undefined,
  setPcicTarget: () => {},
}));

import { act, renderHook, waitFor } from '@testing-library/react-native';
import { getDb } from '@/lib/database';
import { RESUME_GAME_ID } from '@/lib/resumeRoute';
import { sm2NewCard, sm2Review } from '@/lib/sm2';
import { localDateString } from '@/lib/usageStats';
import { saveResumeValue } from '@/lib/resumeStore';
import { emptyFatigue, FATIGUE_KEY } from '../fatigue';
import { usePcicSession } from '../usePcicSession';

const day = localDateString();
const reviewDay = '2026-01-01';
const review = (id: string, due = reviewDay) => ({ ...sm2Review(sm2NewCard(id), 'good', '2025-12-31'), due });
const open = async () => {
  const hook = renderHook(() => usePcicSession());
  await waitFor(() => expect(hook.result.current.loading).toBe(false));
  return hook;
};

beforeEach(async () => {
  const db = getDb();
  await db.setOnboarding('en', 'es');
  await db.resetPcicCards();
  await db.resetGameProgress(RESUME_GAME_ID);
  await db.setPcicLevel('A1');
  await db.setDailyNewLimit(5);
  await db.setPcicNewBonus(0, day);
  await db.setNoPileUp(true);
  await db.setSrsDay({ srsDay: reviewDay, srsDayStepOn: reviewDay });
  await db.setMissCap(false);
  await db.setTiredButton(false);
  await db.setFatigueDetector(false);
  await db.setNewWordGate(true);
});

it('keeps reviews and the day on reopening, releases five new words after the last review and restores reviews on undo', async () => {
  const db = getDb();
  await db.upsertPcicCard(review('a1-w0'));
  await db.upsertPcicCard(review('a1-w1', '2026-01-02'));
  const first = await open();
  expect(first.result.current.queue.map((c) => c.itemId)).toEqual(['a1-w0']);
  expect(first.result.current.srsDay).toBe(reviewDay);
  expect(first.result.current.newRemaining).toBe(0);
  first.unmount();
  const hook = await open();
  expect(hook.result.current.queue.map((c) => c.itemId)).toEqual(['a1-w0']);
  expect(hook.result.current.srsDay).toBe(reviewDay);
  await act(async () => { await hook.result.current.handleGrade('good'); });
  expect(hook.result.current.newRemaining).toBe(5);
  expect(hook.result.current.dueRemaining).toBe(0);
  expect(await db.getPcicCard('a1-w0')).toMatchObject({ due: '2026-01-04', lastReview: day });
  await act(async () => { await hook.result.current.handleUndo(); });
  expect(hook.result.current.queue.map((c) => c.itemId)).toEqual(['a1-w0']);
  await act(async () => { await hook.result.current.handleDontLearn(); });
  expect(hook.result.current.newRemaining).toBe(5);
  await act(async () => { await hook.result.current.handleGrade('good'); });
  expect(await db.getPcicCard('a1-w2')).toMatchObject({ due: '2026-01-02', introducedAt: day, lastReview: day });
  expect(hook.result.current.newRemaining).toBe(4);
});

it('advances once after a long break, filtering higher-level and orphan cards exactly like Learn', async () => {
  const db = getDb();
  await db.upsertPcicCard(review('b1-upper'));
  await db.upsertPcicCard(review('orphan'));
  await db.upsertPcicCard(review('a1-w0', '2026-01-02'));
  const first = await open();
  expect(first.result.current.srsDay).toBe('2026-01-02');
  expect(first.result.current.queue.map((c) => c.itemId)).toEqual(['a1-w0']);
  first.unmount();
  const second = await open();
  expect(second.result.current.srsDay).toBe('2026-01-02');
  expect((await db.getSrsDay())?.srsDayStepOn).toBe(day);
});

it('releases the budget on a parked last miss and makes that review return after undo', async () => {
  const db = getDb();
  await db.upsertPcicCard(review('a1-w0'));
  await db.setMissCap(true);
  await db.setPcicNewBonus(5, day);
  await saveResumeValue(db, FATIGUE_KEY, { ...emptyFatigue(day), misses: { 'a1-w0': 3 } });
  const hook = await open();
  await act(async () => { await hook.result.current.handleGrade('again'); });
  expect(hook.result.current.newRemaining).toBe(10);
  expect(hook.result.current.parkedCards.map((c) => c.itemId)).toEqual(['a1-w0']);
  await act(async () => { await hook.result.current.handleUndo(); });
  expect(hook.result.current.newRemaining).toBe(0);
  expect(hook.result.current.current?.itemId).toBe('a1-w0');
});

it('keeps the calendar, mixed queue and bonus offer when switched off', async () => {
  const db = getDb();
  await db.setNoPileUp(false);
  await db.upsertPcicCard(review('a1-w0'));
  const first = await open();
  expect(first.result.current.srsDay).toBe(day);
  expect(first.result.current.newRemaining).toBe(5);
  expect(first.result.current.queue[1].state).toBe('new');
  first.unmount();
  for (const item of mockItems.slice(1, 6)) await db.upsertPcicCard(sm2Review(sm2NewCard(item.id), 'good', day));
  const second = await open();
  expect(second.result.current.askMoreNew).toBe(true);
});

it('keeps the independent new-word gate switch after finishing reviews', async () => {
  await getDb().setSrsDay({ srsDay: reviewDay, srsDayStepOn: day });
  await getDb().setNewWordGate(false);
  const hook = await open();
  await act(async () => { await hook.result.current.handleGrade('again'); });
  expect(hook.result.current.current?.itemId).toBe('a1-w1');
  expect(hook.result.current.newRemaining).toBe(4);
});
