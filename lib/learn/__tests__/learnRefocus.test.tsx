// Leaving the Learn tab and coming back (blur, then focus) reloads the deck from the DB. A refocus on the same day and
// level must keep where the learner was: the learning clock of the day, the day's new-word budget, the card on screen
// with its typed or revealed answer, the "again" timers, the session tiles and the undo.
jest.mock('@/lib/speech', () => require('@/test-utils/mocks').speechMock());
let mockFocus: (() => void) | null = null;
jest.mock('expo-router', () => ({
  useFocusEffect: (cb: () => void) => {
    const { useEffect } = require('react');
    mockFocus = cb;
    useEffect(cb, []);
  },
}));
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
import { usePcicSession } from '../usePcicSession';

const day = localDateString();
const reviewDay = '2026-01-01';
const review = (id: string, due = reviewDay) => ({ ...sm2Review(sm2NewCard(id), 'good', '2025-12-31'), due });
type Hook = ReturnType<typeof renderHook<ReturnType<typeof usePcicSession>, unknown>>;
const open = async () => {
  const hook = renderHook(() => usePcicSession());
  await waitFor(() => expect(hook.result.current.loading).toBe(false));
  return hook;
};
// A tab switch: the focus callback runs again while the deck stays on screen (no spinner to wait for).
const refocus = async (hook: Hook) => {
  const seq = hook.result.current.queue;
  await act(async () => {
    mockFocus!();
    await new Promise((resolve) => setTimeout(resolve, 50));
  });
  return seq;
};
const ids = (hook: Hook) => hook.result.current.queue.map((c) => c.itemId);

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

it('finishing the leftover reviews and switching tabs keeps the clock, so the new words stay', async () => {
  const db = getDb();
  await db.upsertPcicCard(review('a1-w0'));
  await db.upsertPcicCard(review('a1-w1', '2026-01-02'));
  const hook = await open();
  expect(ids(hook)).toEqual(['a1-w0']);
  await act(async () => { await hook.result.current.handleGrade('good'); });
  expect(hook.result.current.newRemaining).toBe(5);
  await refocus(hook);
  expect(hook.result.current.srsDay).toBe(reviewDay);
  expect(hook.result.current.dueRemaining).toBe(0);
  expect(hook.result.current.newRemaining).toBe(5);
});

it('"Don\'t learn this" on a new word keeps the five-word batch, undo takes the stand-in back out', async () => {
  const db = getDb();
  const hook = await open();
  expect(ids(hook)).toEqual(['a1-w0', 'a1-w1', 'a1-w2', 'a1-w3', 'a1-w4']);
  await act(async () => { await hook.result.current.handleDontLearn(); });
  expect(hook.result.current.newRemaining).toBe(5);
  expect(ids(hook)).toContain('a1-w5');
  expect(await db.getPcicCard('a1-w0')).toMatchObject({ known: true, introducedAt: null });
  await act(async () => { await hook.result.current.handleUndo(); });
  expect(ids(hook)).toEqual(['a1-w0', 'a1-w1', 'a1-w2', 'a1-w3', 'a1-w4']);
  await act(async () => { await hook.result.current.handleDontLearn(); });
  await refocus(hook);
  expect(hook.result.current.newRemaining).toBe(5);
  expect(hook.result.current.current?.itemId).toBe('a1-w1');
});

it('keeps the card on screen with its typed answer, then with its revealed answer', async () => {
  const hook = await open();
  act(() => { hook.result.current.setTypedAnswer('palab'); });
  await refocus(hook);
  expect(hook.result.current.current?.itemId).toBe('a1-w0');
  expect(hook.result.current.typedAnswer).toBe('palab');
  act(() => { hook.result.current.setTypedAnswer('palabra0'); });
  await act(async () => { await hook.result.current.handleCheck(); });
  expect(hook.result.current.grade?.match).toBe('exact');
  await refocus(hook);
  expect(hook.result.current.current?.itemId).toBe('a1-w0');
  expect(hook.result.current.grade?.match).toBe('exact');
  expect(hook.result.current.typedAnswer).toBe('palabra0');
});

it('keeps the "again" timer, the session tiles and the undo across a tab switch', async () => {
  await getDb().setNewWordGate(false);
  const hook = await open();
  act(() => { hook.result.current.setTypedAnswer('x'); });
  await act(async () => { await hook.result.current.handleCheck(); });
  await act(async () => { await hook.result.current.handleGrade('again'); });
  const missed = hook.result.current.queue.find((c) => c.itemId === 'a1-w0') as { returnAt?: number } | undefined;
  expect(missed?.returnAt).toBeDefined();
  expect(hook.result.current.current?.itemId).toBe('a1-w1');
  await refocus(hook);
  expect(hook.result.current.current?.itemId).toBe('a1-w1');
  expect((hook.result.current.queue.find((c) => c.itemId === 'a1-w0') as { returnAt?: number }).returnAt).toBe(missed!.returnAt);
  expect([hook.result.current.sessionAnswered, hook.result.current.sessionNew, hook.result.current.sessionAgain]).toEqual([1, 1, 1]);
  expect(hook.result.current.lastGraded).not.toBeNull();
  await act(async () => { await hook.result.current.handleUndo(); });
  expect(hook.result.current.current?.itemId).toBe('a1-w0');
  expect(hook.result.current.sessionAnswered).toBe(0);
});

it('closing and reopening the app keeps the order and the timer, but starts a fresh card state', async () => {
  const first = await open();
  await act(async () => { await first.result.current.handleGrade('again'); });
  const order = ids(first);
  first.unmount();
  const hook = await open();
  expect(ids(hook)).toEqual(order);
  expect(hook.result.current.typedAnswer).toBe('');
  expect(hook.result.current.lastGraded).toBeNull();
});

it('a missed new word does not hide the rest of the day\'s new words after a tab switch', async () => {
  const hook = await open();
  await act(async () => { await hook.result.current.handleGrade('again'); });
  const before = ids(hook);
  expect(before).toHaveLength(5);
  await refocus(hook);
  expect(ids(hook)).toEqual(before);
  expect(hook.result.current.newRemaining).toBe(4);
});

it('the done screen keeps its tiles after a tab switch', async () => {
  const hook = await open();
  for (let i = 0; i < 5; i++) await act(async () => { await hook.result.current.handleGrade('good'); });
  expect(hook.result.current.queue).toHaveLength(0);
  await refocus(hook);
  expect(hook.result.current.queue).toHaveLength(0);
  expect(hook.result.current.sessionAnswered).toBe(5);
  expect(hook.result.current.sessionNew).toBe(5);
});

it('a progress reset made elsewhere drops the undo on the next refocus', async () => {
  const hook = await open();
  await act(async () => { await hook.result.current.handleGrade('good'); });
  expect(hook.result.current.lastGraded).not.toBeNull();
  await getDb().resetPcicCards();
  await refocus(hook);
  expect(hook.result.current.lastGraded).toBeNull();
});
