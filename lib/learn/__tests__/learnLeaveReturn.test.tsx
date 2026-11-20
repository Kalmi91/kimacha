// Leave-and-return break cases (spec: fable-cases.md). Expectations are the spec's, not the current code's: a failing case is a finding.
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
import { countFinishedToday, dayProgressPercent, finishedInBatch } from '@/lib/pcicSession';
import { addDays, sm2NewCard, sm2Review } from '@/lib/sm2';
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
const refocus = async (hook: Hook) => {
  await act(async () => {
    mockFocus!();
    await new Promise((resolve) => setTimeout(resolve, 50));
  });
  return hook;
};
const settle = (ms = 30) => act(async () => { await new Promise((resolve) => setTimeout(resolve, ms)); });
const reopen = async (hook: Hook) => { hook.unmount(); return open(); };

// Card ids: new words are w0.. ; review cards rN sit at the far end (r0 = w14) so they never collide with the new words w0..w4.
const w = (n: number) => `a1-w${n}`;
const r = (n: number) => `a1-w${14 - n}`;
const ws = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => w(from + i));
const ids = (hook: Hook) => hook.result.current.queue.map((c) => c.itemId);
const cur = (hook: Hook) => hook.result.current.current?.itemId;
const tiles = (hook: Hook) => [hook.result.current.sessionAnswered, hook.result.current.sessionNew, hook.result.current.sessionAgain];
const returnAt = (hook: Hook, id: string) => (hook.result.current.queue.find((c) => c.itemId === id) as { returnAt?: number } | undefined)?.returnAt;
const parked = (hook: Hook) => hook.result.current.parkedCards.map((c) => c.itemId);
const bar = (hook: Hook) => {
  const s = hook.result.current;
  return dayProgressPercent(
    finishedInBatch(countFinishedToday([...s.allCards.values()], s.progressQueue, s.today), s.batchBase.day === s.today && s.batchBase.level === s.level ? s.batchBase.n : 0),
    s.queue.length,
  );
};
const dbCard = (id: string) => getDb().getPcicCard(id);
const type = (hook: Hook, text: string) => act(() => { hook.result.current.setTypedAnswer(text); });
const check = (hook: Hook) => act(async () => { await hook.result.current.handleCheck(); });
const grade = (hook: Hook, g: 'good' | 'again') => act(async () => { await hook.result.current.handleGrade(g); });
const grades = async (hook: Hook, g: 'good' | 'again', n: number) => { for (let i = 0; i < n; i++) await grade(hook, g); };
const undo = (hook: Hook) => act(async () => { await hook.result.current.handleUndo(); });
const dontLearn = (hook: Hook) => act(async () => { await hook.result.current.handleDontLearn(); });
const moreNew = (hook: Hook, n: number) => act(() => { hook.result.current.handleMoreNew(n); });
const setSrs = (d: string) => getDb().setSrsDay({ srsDay: d, srsDayStepOn: d });

type AnyFn = (...a: unknown[]) => Promise<unknown>;
const gate = (name: string) => {
  const db = getDb() as unknown as Record<string, AnyFn>;
  const real = db[name].bind(db);
  let release!: () => void;
  const blocked = new Promise<void>((res) => (release = res));
  jest.spyOn(db, name).mockImplementationOnce(async (...a: unknown[]) => { await blocked; return real(...a); });
  return release;
};

// Only Date is faked (timers stay real), so localDateString() and Date.now() follow it.
const FAKE_ALL_BUT_DATE = ['nextTick', 'setImmediate', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'queueMicrotask'] as const;
let t0 = Date.now();
let offsetMs = 0;
const shiftClock = (ms: number) => {
  offsetMs += ms;
  jest.useFakeTimers({ doNotFake: [...FAKE_ALL_BUT_DATE], now: t0 + offsetMs });
};
const advanceDays = (n: number) => shiftClock(n * 86400000);

// The jest-expo environment has no localStorage; answerLog.web needs one (C26 reads the answer log).
if (globalThis.localStorage === undefined) {
  const store = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', {
    value: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => { store.set(k, String(v)); },
      removeItem: (k: string) => { store.delete(k); },
      clear: () => store.clear(),
    },
  });
}

const baseSetup = async () => {
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
  globalThis.localStorage?.clear();
};

beforeEach(async () => {
  t0 = Date.now();
  offsetMs = 0;
  await baseSetup();
});
afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});

it('C01 Grade tapped right after coming back, while the quiet reload is still running', async () => {
  const hook = await open();
  await type(hook, 'palabra0');
  await check(hook);
  const release = gate('getDailyNewLimit');
  await refocus(hook);
  await grade(hook, 'good');
  release();
  await settle();
  expect(cur(hook)).toBe(w(1));
  expect(ids(hook)).toEqual(ws(1, 4));
  expect(ids(hook)).not.toContain(w(0));
  expect(hook.result.current.newRemaining).toBe(4);
  expect(hook.result.current.dueRemaining).toBe(0);
  expect(tiles(hook)).toEqual([1, 1, 0]);
  expect(await dbCard(w(0))).toMatchObject({ state: 'review', reps: 1 });
  expect(hook.result.current.allCards.get(w(0))?.state).toBe('review');
  expect(bar(hook)).toBe(25);
});

it('C02 Tab switch lands between the grade\'s DB write and its queue step', async () => {
  const hook = await open();
  const release = gate('updateStreak');
  let gradeDone!: Promise<void>;
  act(() => { gradeDone = hook.result.current.handleGrade('good'); });
  await settle();
  await refocus(hook);
  release();
  await act(async () => { await gradeDone; });
  await settle();
  expect(cur(hook)).toBe(w(1));
  expect(ids(hook)).toEqual(ws(1, 4));
  expect(hook.result.current.newRemaining).toBe(4);
  expect(tiles(hook)).toEqual([1, 1, 0]);
  expect((await dbCard(w(1)))?.state ?? 'new').toBe('new');
  expect(ids(hook)).toContain(w(1));
});

it('C03 "I\'m tired" pressed on a revealed card, then a tab switch', async () => {
  const db = getDb();
  await db.setTiredButton(true);
  await db.upsertPcicCard({ ...review(r(0), '2025-12-30'), interval: 1 });
  await db.upsertPcicCard({ ...review(r(1), '2025-12-31'), interval: 10 });
  await db.upsertPcicCard({ ...review(r(2), reviewDay), interval: 5 });
  const hook0 = await open();
  expect(cur(hook0)).toBe(r(0));
  await type(hook0, 'x');
  await check(hook0);
  expect(hook0.result.current.grade).not.toBeNull();
  await act(async () => { await hook0.result.current.handleTired(); });
  expect(cur(hook0)).toBe(r(0));
  expect(ids(hook0)).toEqual([r(0), r(1), r(2)]);
  expect(hook0.result.current.grade).not.toBeNull();
  await refocus(hook0);
  expect(cur(hook0)).toBe(r(0));
  expect(hook0.result.current.grade).not.toBeNull();
  expect(hook0.result.current.typedAnswer).toBe('x');
  expect(ids(hook0)).toEqual([r(0), r(1), r(2)]);
  expect(hook0.result.current.tired).toBe(true);
  const hook = await reopen(hook0);
  expect(cur(hook)).toBe(r(0));
  expect(ids(hook)).toEqual([r(0), r(1), r(2)]);
});

it('C04 Undo after "Missed days don\'t pile up" was switched off (clock lag)', async () => {
  const db = getDb();
  await db.setNewWordGate(false);
  const hook = await open();
  expect(ids(hook)).toEqual(ws(0, 4));
  await grade(hook, 'again');
  await db.setNoPileUp(false);
  await refocus(hook);
  await undo(hook);
  expect(ids(hook).filter((id) => id === w(0))).toHaveLength(1);
  expect(ids(hook)[0]).toBe(w(0));
  expect(ids(hook)).toEqual(ws(0, 4));
  expect(hook.result.current.newRemaining).toBe(5);
  expect(hook.result.current.dueRemaining).toBe(0);
  expect(tiles(hook)).toEqual([0, 0, 0]);
  expect((await dbCard(w(0)))?.state ?? 'new').toBe('new');
});

it('C05 "Don\'t learn this" tapped twice fast', async () => {
  const hook = await open();
  const h = hook.result.current;
  await act(async () => {
    const a = h.handleDontLearn();
    const b = h.handleDontLearn();
    await Promise.all([a, b]);
  });
  const expectState = async () => {
    expect((await dbCard(w(0)))?.known).toBe(true);
    expect(!!(await dbCard(w(1)))?.known).toBe(false);
    expect((await dbCard(w(1)))?.state ?? 'new').toBe('new');
    expect(cur(hook)).toBe(w(1));
    expect(ids(hook)).toEqual([w(1), w(2), w(3), w(4), w(5)]);
    expect(hook.result.current.newRemaining).toBe(5);
  };
  await expectState();
  await refocus(hook);
  await expectState();
});

it('C06 Undo of the last review after a tab switch lets new words in before the review is done', async () => {
  await getDb().upsertPcicCard(review(r(0)));
  const hook = await open();
  expect(ids(hook)).toEqual([r(0)]);
  expect(hook.result.current.newRemaining).toBe(0);
  await grade(hook, 'good');
  await refocus(hook);
  await undo(hook);
  expect(cur(hook)).toBe(r(0));
  expect(ids(hook)).toEqual([r(0)]);
  expect(hook.result.current.newRemaining).toBe(0);
  expect(hook.result.current.dueRemaining).toBe(1);
  expect(tiles(hook)).toEqual([0, 0, 0]);
  await grade(hook, 'again');
  expect(cur(hook)).toBe(r(0));
  expect(hook.result.current.newRemaining).toBe(0);
  expect(tiles(hook)).toEqual([1, 0, 1]);
});

it('C07 A word learned today comes back as due the same day after noPileUp is switched off', async () => {
  const hook = await open();
  await type(hook, 'palabra0');
  await check(hook);
  await grade(hook, 'good');
  await getDb().setNoPileUp(false);
  await refocus(hook);
  expect(ids(hook)).not.toContain(w(0));
  expect(ids(hook)).toEqual(ws(1, 4));
  expect(hook.result.current.dueRemaining).toBe(0);
  expect(hook.result.current.newRemaining).toBe(4);
  expect(tiles(hook)).toEqual([1, 1, 0]);
  expect(cur(hook)).toBe(w(1));
});

it('C08 Article pick of the old card stays on the next deck after a level switch', async () => {
  const hook = await open();
  expect(cur(hook)).toBe(w(0));
  act(() => { hook.result.current.setArticlePick('el'); });
  await type(hook, 'gato');
  await act(async () => { await hook.result.current.handleSelectLevel('B1'); });
  expect(cur(hook)).toBe('b1-upper');
  expect(hook.result.current.typedAnswer).toBe('');
  expect(hook.result.current.articlePick).toBe('');
  expect(hook.result.current.grade).toBeNull();
  expect(tiles(hook)).toEqual([0, 0, 0]);
});

it('C09 Language pair switch and back: the other pair\'s order and timers leak in', async () => {
  const db = getDb();
  await db.setNewWordGate(false);
  const hook = await open();
  await grade(hook, 'again');
  expect(ids(hook)).toEqual([w(1), w(2), w(3), w(4), w(0)]);
  const w0Timer = returnAt(hook, w(0));
  expect(w0Timer).toBeDefined();
  await db.setOnboarding('es', 'en');
  await db.setPcicLevel('A1');
  await refocus(hook);
  expect(ids(hook)).toEqual(ws(0, 4));
  await grade(hook, 'good');
  await grade(hook, 'again');
  await db.setOnboarding('en', 'es');
  await db.setPcicLevel('A1');
  await refocus(hook);
  expect(cur(hook)).toBe(w(1));
  expect(ids(hook)).toEqual([w(1), w(2), w(3), w(4), w(0)]);
  expect(returnAt(hook, w(0))).toBe(w0Timer);
  expect(hook.result.current.queue.filter((c) => c.itemId !== w(0) && (c as { returnAt?: number }).returnAt !== undefined)).toHaveLength(0);
  expect(hook.result.current.newRemaining).toBe(4);
  expect(hook.result.current.dueRemaining).toBe(1);
  expect(tiles(hook)).toEqual([0, 0, 0]);
});

it('C10 First open of the day on another level steps the clock past an unfinished level', async () => {
  const db = getDb();
  const yesterday = addDays(day, -1);
  await db.setPcicLevel('B1');
  await db.upsertPcicCard(review(r(0), yesterday));
  await db.upsertPcicCard(review(r(1), day));
  await setSrs(yesterday);
  const hook = await open();
  await act(async () => { await hook.result.current.handleSelectLevel('A1'); });
  expect(ids(hook)).toEqual([r(0)]);
  expect(hook.result.current.dueRemaining).toBe(1);
  expect(hook.result.current.srsDay).toBe(yesterday);
});

it('C11 A card parked by the miss cap blocks the clock the next day', async () => {
  const db = getDb();
  await db.setMissCap(true);
  await setSrs(day);
  await db.upsertPcicCard(review(r(0), day));
  await db.upsertPcicCard(review(r(1), addDays(day, 1)));
  const hook = await open();
  expect(ids(hook)).toEqual([r(0)]);
  await grades(hook, 'again', 4);
  expect(ids(hook)).not.toContain(r(0));
  expect(parked(hook)).toEqual([r(0)]);
  expect(hook.result.current.newRemaining).toBe(5);
  advanceDays(1);
  await refocus(hook);
  // By design (NOPILE): your words move on a day only after you finish that day's reviews, so r1 waits for r0's day.
  expect(ids(hook)).toEqual([r(0)]);
  expect(hook.result.current.srsDay).toBe(day);
  expect(hook.result.current.newRemaining).toBe(0);
  await grade(hook, 'good');
  await refocus(hook);
  // At most one learning day per calendar day: r1 comes on the next calendar day.
  expect(hook.result.current.dueRemaining).toBe(0);
});

it('C12 Grade and "Don\'t learn this" overlap on the same card', async () => {
  const hook = await open();
  const h = hook.result.current;
  const release = gate('updateStreak');
  let gradeDone!: Promise<void>;
  act(() => { gradeDone = h.handleGrade('good'); });
  await settle();
  await act(async () => { await h.handleDontLearn(); });
  release();
  await act(async () => { await gradeDone; });
  await settle();
  const check12 = async () => {
    const skipped = !!(await dbCard(w(0)))?.known;
    expect(cur(hook)).toBe(w(1));
    expect((await dbCard(w(1)))?.state ?? 'new').toBe('new');
    expect(ids(hook)).toContain(w(1));
    expect(hook.result.current.newRemaining).toBe(skipped ? 5 : 4);
    if (skipped) expect((await dbCard(w(0)))?.introducedAt).toBeNull();
    else expect(await dbCard(w(0))).toMatchObject({ state: 'review', introducedAt: day });
    expect(tiles(hook)).toEqual(skipped ? [0, 0, 0] : [1, 1, 0]);
  };
  await check12();
  await refocus(hook);
  await check12();
});

it('C13 Second grade tap from the same render after the first one finished', async () => {
  const hook = await open();
  const h = hook.result.current;
  await act(async () => {
    await h.handleGrade('good');
    await h.handleGrade('good');
  });
  await refocus(hook);
  expect(await dbCard(w(0))).toMatchObject({ reps: 1 });
  expect(cur(hook)).toBe(w(1));
  expect((await dbCard(w(1)))?.state ?? 'new').toBe('new');
  expect(ids(hook)).toEqual(ws(1, 4));
  expect(tiles(hook)).toEqual([1, 1, 0]);
  expect(hook.result.current.newRemaining).toBe(4);
});

it('C14 Turning the new-word gate on while another new word is half typed', async () => {
  const db = getDb();
  await db.setNewWordGate(false);
  const hook = await open();
  await grade(hook, 'again');
  expect(ids(hook)).toEqual([w(1), w(2), w(3), w(4), w(0)]);
  await type(hook, 'pal');
  await db.setNewWordGate(true);
  await refocus(hook);
  expect(cur(hook)).toBe(w(1));
  expect(hook.result.current.typedAnswer).toBe('pal');
  expect(ids(hook)).toEqual([w(1), w(0), w(2), w(3), w(4)]);
  expect(hook.result.current.newRemaining).toBe(4);
});


it('C16 Tab switch in the same tick as the "+5" tap', async () => {
  const hook = await open();
  await grades(hook, 'good', 5);
  const release = gate('setPcicNewBonus');
  await moreNew(hook, 5);
  const expectBatch = () => {
    expect(ids(hook)).toEqual(ws(5, 9));
    expect(hook.result.current.newRemaining).toBe(5);
    expect(hook.result.current.todayNewBudget).toBe(10);
    expect(bar(hook)).toBe(0);
    expect(tiles(hook)).toEqual([5, 5, 0]);
  };
  await refocus(hook);
  expectBatch();
  release();
  await settle();
  await refocus(hook);
  expectBatch();
});

it('C17 Next day with a revealed card and an undo pending', async () => {
  await setSrs(day);
  const hook = await open();
  await grades(hook, 'good', 3);
  await type(hook, 'x');
  await check(hook);
  advanceDays(1);
  await refocus(hook);
  const s = hook.result.current;
  expect(s.srsDay).toBe(addDays(day, 1));
  expect(ids(hook)).toEqual(ws(0, 2));
  expect(s.dueRemaining).toBe(3);
  expect(s.newRemaining).toBe(0);
  expect(cur(hook)).toBe(w(0));
  expect(s.typedAnswer).toBe('');
  expect(s.grade).toBeNull();
  expect(s.lastGraded).toBeNull();
  expect(tiles(hook)).toEqual([0, 0, 0]);
  expect(s.doneToday).toBe(0);
  expect(s.xpToday).toBe(0);
  expect(bar(hook)).toBe(0);
  await grades(hook, 'good', 3);
  expect(hook.result.current.newRemaining).toBe(5);
  expect(ids(hook)).toEqual(ws(3, 7));
  expect(hook.result.current.dueRemaining).toBe(0);
  expect(tiles(hook)).toEqual([3, 0, 0]);
});

it('C18 Several days away with noPileUp on, hook left mounted', async () => {
  const db = getDb();
  await setSrs(day);
  await db.upsertPcicCard(review(r(1), addDays(day, 1)));
  await db.upsertPcicCard(review(r(2), addDays(day, 2)));
  await db.upsertPcicCard(review(r(5), addDays(day, 5)));
  const hook = await open();
  expect(ids(hook)).toEqual(ws(0, 4));
  advanceDays(5);
  await refocus(hook);
  expect(hook.result.current.srsDay).toBe(addDays(day, 1));
  expect(ids(hook)).toEqual([r(1)]);
  expect(hook.result.current.dueRemaining).toBe(1);
  expect(hook.result.current.newRemaining).toBe(0);
  expect(tiles(hook)).toEqual([0, 0, 0]);
  await grade(hook, 'good');
  expect(hook.result.current.newRemaining).toBe(5);
  await refocus(hook);
  expect(hook.result.current.srsDay).toBe(addDays(day, 1));
  expect(ids(hook)).not.toContain(r(2));
  expect(hook.result.current.newRemaining).toBe(5);
  advanceDays(1);
  await refocus(hook);
  expect(hook.result.current.srsDay).toBe(addDays(day, 2));
  expect(ids(hook)).toEqual([r(2)]);
  expect(hook.result.current.newRemaining).toBe(0);
});

const parkR0 = async () => {
  const db = getDb();
  await db.setMissCap(true);
  await db.upsertPcicCard(review(r(0)));
  const hook = await open();
  return hook;
};

it('C19 The miss cap counts across tab switches and the parked card stays parked', async () => {
  const hook0 = await parkR0();
  await grades(hook0, 'again', 2);
  expect(cur(hook0)).toBe(r(0));
  await refocus(hook0);
  await grade(hook0, 'again');
  expect(cur(hook0)).toBe(r(0));
  await refocus(hook0);
  await grade(hook0, 'again');
  const expectParked = () => {
    expect(ids(hook0)).not.toContain(r(0));
    expect(parked(hook0)).toEqual([r(0)]);
    expect(ids(hook0)).toEqual(ws(0, 4));
    expect(hook0.result.current.dueRemaining).toBe(0);
    expect(hook0.result.current.newRemaining).toBe(5);
    expect(tiles(hook0)).toEqual([4, 0, 4]);
  };
  expectParked();
  await refocus(hook0);
  expectParked();
  const hook = await reopen(hook0);
  expect(ids(hook)).toEqual(ws(0, 4));
  expect(parked(hook)).toEqual([r(0)]);
  expect(bar(hook)).toBe(0);
  expect(await dbCard(r(0))).toMatchObject({ state: 'learning', due: reviewDay });
});

it('C20 Miss cap switched off and on again with a parked card', async () => {
  const db = getDb();
  const hook = await parkR0();
  await grades(hook, 'again', 4);
  expect(parked(hook)).toEqual([r(0)]);
  await type(hook, 'pal');
  await db.setMissCap(false);
  await refocus(hook);
  expect(ids(hook)).toEqual([r(0)]);
  expect(hook.result.current.dueRemaining).toBe(1);
  expect(hook.result.current.newRemaining).toBe(0);
  expect(hook.result.current.typedAnswer).toBe('');
  expect(parked(hook)).toEqual([]);
  await db.setMissCap(true);
  await refocus(hook);
  expect(parked(hook)).toEqual([r(0)]);
  expect(ids(hook)).toEqual(ws(0, 4));
  expect(hook.result.current.newRemaining).toBe(5);
  expect(tiles(hook)).toEqual([4, 0, 4]);
});

it('C21 Daily limit lowered while a new word is half typed', async () => {
  const db = getDb();
  await db.setDailyNewLimit(10);
  const hook = await open();
  expect(ids(hook)).toEqual(ws(0, 9));
  await grades(hook, 'good', 3);
  await type(hook, 'pal');
  await db.setDailyNewLimit(5);
  await refocus(hook);
  expect(cur(hook)).toBe(w(3));
  expect(hook.result.current.typedAnswer).toBe('pal');
  expect(ids(hook)).toEqual([w(3), w(4)]);
  expect(hook.result.current.newRemaining).toBe(2);
  expect(hook.result.current.todayNewBudget).toBe(5);
  expect(tiles(hook)).toEqual([3, 3, 0]);
  expect(bar(hook)).toBe(75);
});

it('C22 Daily limit lowered below what was already learned today', async () => {
  const db = getDb();
  await db.setDailyNewLimit(10);
  const hook0 = await open();
  await grades(hook0, 'good', 6);
  await type(hook0, 'pal');
  await db.setDailyNewLimit(5);
  await refocus(hook0);
  expect(ids(hook0)).toEqual([]);
  expect(hook0.result.current.newRemaining).toBe(0);
  expect(hook0.result.current.typedAnswer).toBe('');
  expect(tiles(hook0)).toEqual([6, 6, 0]);
  expect(bar(hook0)).toBe(100);
  expect(hook0.result.current.askMoreNew).toBe(false);
  const hook = await reopen(hook0);
  expect(ids(hook)).toEqual([]);
  expect(hook.result.current.doneToday).toBe(6);
});

it('C23 Daily limit raised on the done screen, then undo', async () => {
  const db = getDb();
  const hook = await open();
  await grades(hook, 'good', 5);
  await db.setDailyNewLimit(10);
  await refocus(hook);
  expect(ids(hook)).toEqual(ws(5, 9));
  expect(hook.result.current.newRemaining).toBe(5);
  expect(tiles(hook)).toEqual([5, 5, 0]);
  expect(bar(hook)).toBeCloseTo(55.6, 1);
  expect(hook.result.current.lastGraded).not.toBeNull();
  await undo(hook);
  expect(cur(hook)).toBe(w(4));
  expect((await dbCard(w(4)))?.state ?? 'new').toBe('new');
  expect(ids(hook)).toEqual(ws(4, 9));
  expect(hook.result.current.newRemaining).toBe(6);
  expect(tiles(hook)).toEqual([4, 4, 0]);
});

it('C24 The "+5" batch across tab switch, reopen and the next day', async () => {
  await setSrs(day);
  const hook0 = await open();
  await grades(hook0, 'good', 5);
  await moreNew(hook0, 5);
  await grades(hook0, 'good', 2);
  const expectBatch = (hook: Hook) => {
    expect(ids(hook)).toEqual(ws(7, 9));
    expect(hook.result.current.newRemaining).toBe(3);
    expect(hook.result.current.todayNewBudget).toBe(10);
    expect(bar(hook)).toBe(50);
  };
  await refocus(hook0);
  expectBatch(hook0);
  const hook = await reopen(hook0);
  expectBatch(hook);
  advanceDays(1);
  await refocus(hook);
  expect(ids(hook)).toHaveLength(7);
  expect(hook.result.current.dueRemaining).toBe(7);
  expect(hook.result.current.newRemaining).toBe(0);
  expect(bar(hook)).toBe(0);
  await grades(hook, 'good', 7);
  expect(hook.result.current.newRemaining).toBe(5);
});

it('C25 Switching "Missed days don\'t pile up" on while a new word is on screen', async () => {
  const db = getDb();
  await db.setNoPileUp(false);
  await db.upsertPcicCard(review(r(0), day));
  await db.upsertPcicCard(review(r(1), day));
  const hook = await open();
  expect(cur(hook)).toBe(r(0));
  await grade(hook, 'good');
  await type(hook, 'pal');
  await db.setNoPileUp(true);
  await refocus(hook);
  expect(cur(hook)).toBe(r(1));
  expect(ids(hook)).toEqual([r(1)]);
  expect(hook.result.current.newRemaining).toBe(0);
  expect(hook.result.current.dueRemaining).toBe(1);
  expect(hook.result.current.typedAnswer).toBe('');
  expect(tiles(hook)).toEqual([1, 0, 0]);
  expect(hook.result.current.askMoreNew).toBe(false);
  await grade(hook, 'good');
  expect(ids(hook)).toEqual(ws(0, 4));
  expect(hook.result.current.newRemaining).toBe(5);
  expect(tiles(hook)).toEqual([2, 0, 0]);
});

it('C26 The fatigue offer across tab switch, reopen and decline', async () => {
  const db = getDb();
  await db.setFatigueDetector(true);
  await db.upsertPcicCard(review(r(0)));
  await db.upsertPcicCard(review(r(1)));
  const hook0 = await open();
  await grades(hook0, 'again', 5);
  expect(hook0.result.current.fatigueOffer).toMatchObject({ reason: 'repeat-misses' });
  const order = ids(hook0);
  const dues = [(await dbCard(r(0)))?.due, (await dbCard(r(1)))?.due];
  await refocus(hook0);
  expect(hook0.result.current.fatigueOffer).toMatchObject({ reason: 'repeat-misses' });
  expect(ids(hook0)).toEqual(order);
  const hook1 = await reopen(hook0);
  expect(hook1.result.current.fatigueOffer).toMatchObject({ reason: 'repeat-misses' });
  expect(ids(hook1)).toEqual(order);
  expect([(await dbCard(r(0)))?.due, (await dbCard(r(1)))?.due]).toEqual(dues);
  await act(async () => { await hook1.result.current.handleFatigueOfferDecline(); });
  expect(hook1.result.current.fatigueOffer).toBeNull();
  await refocus(hook1);
  expect(hook1.result.current.fatigueOffer).toBeNull();
  const hook2 = await reopen(hook1);
  expect(hook2.result.current.fatigueOffer).toBeNull();
});

it('C27 "Again" timer runs out while on another tab', async () => {
  await getDb().setNewWordGate(false);
  const hook0 = await open();
  await grade(hook0, 'again');
  expect(ids(hook0)).toEqual([w(1), w(2), w(3), w(4), w(0)]);
  const timer = returnAt(hook0, w(0));
  expect(timer).toBeDefined();
  await type(hook0, 'pa');
  // waitForAgainTimer: the Date is moved 10 minutes forward (the default delay is 60 s); no real waiting.
  shiftClock(10 * 60 * 1000);
  await refocus(hook0);
  expect(cur(hook0)).toBe(w(1));
  expect(hook0.result.current.typedAnswer).toBe('pa');
  expect(returnAt(hook0, w(0))).toBe(timer);
  await grade(hook0, 'good');
  expect(cur(hook0)).toBe(w(0));
  const hook = await reopen(hook0);
  expect(cur(hook)).toBe(w(0));
  expect(ids(hook)).toEqual([w(0), w(2), w(3), w(4)]);
  expect(hook.result.current.newRemaining).toBe(3);
  expect(hook.result.current.dueRemaining).toBe(1);
});

it('C28 The new-word gate across a reopen', async () => {
  const hook0 = await open();
  const expectGate = (hook: Hook) => {
    expect(cur(hook)).toBe(w(0));
    expect(ids(hook)).toEqual(ws(0, 4));
    expect(hook.result.current.newRemaining).toBe(4);
    expect(hook.result.current.dueRemaining).toBe(1);
  };
  await type(hook0, 'x');
  await check(hook0);
  await grade(hook0, 'again');
  expectGate(hook0);
  const hook = await reopen(hook0);
  expectGate(hook);
  await type(hook, 'x');
  await check(hook);
  await grade(hook, 'again');
  expectGate(hook);
  await refocus(hook);
  expectGate(hook);
  await type(hook, 'palabra0');
  await check(hook);
  await grade(hook, 'good');
  expect(cur(hook)).toBe(w(1));
  expect(ids(hook)).toEqual(ws(1, 4));
  expect((await dbCard(w(0)))?.state).toBe('review');
  expect(tiles(hook)).toEqual([2, 0, 1]);
});

it('C29 "Don\'t learn this", tab switch, then undo', async () => {
  const db = getDb();
  // Case A: no cards.
  const hookA = await open();
  await dontLearn(hookA);
  await refocus(hookA);
  expect(ids(hookA)).toEqual(ws(1, 5));
  expect(hookA.result.current.newRemaining).toBe(5);
  await undo(hookA);
  expect(ids(hookA)).toEqual(ws(0, 4));
  expect(cur(hookA)).toBe(w(0));
  expect(!!(await dbCard(w(0)))?.known).toBe(false);
  const hookA2 = await reopen(hookA);
  expect(ids(hookA2)).toEqual(ws(0, 4));
  hookA2.unmount();
  // Case B: two due reviews.
  await baseSetup();
  await db.upsertPcicCard(review(r(0)));
  await db.upsertPcicCard(review(r(1)));
  const hook = await open();
  await dontLearn(hook);
  await refocus(hook);
  await undo(hook);
  expect(cur(hook)).toBe(r(0));
  expect(ids(hook)).toEqual([r(0), r(1)]);
  expect(hook.result.current.newRemaining).toBe(0);
  const row = await dbCard(r(0));
  expect(row?.due).toBe(reviewDay);
  expect(!!row?.known).toBe(false);
  expect(tiles(hook)).toEqual([0, 0, 0]);
  expect(hook.result.current.doneToday).toBe(0);
});

