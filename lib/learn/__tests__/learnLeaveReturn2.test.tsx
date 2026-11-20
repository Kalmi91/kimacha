// Leave-and-return break cases, round 2 (spec: fable-cases-2.md, C31-C57). Expectations are the spec's, not the current code's: a failing case is a finding.
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
import { Platform } from 'react-native';
import { getDb } from '@/lib/database';
import { RESUME_GAME_ID } from '@/lib/resumeRoute';
import { loadResumeValue } from '@/lib/resumeStore';
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
  // XP is not part of the card reset: zero the totals around today (C33, C51 read xpToday).
  for (let i = -1; i <= 3; i++) {
    const d = localDateString(new Date(Date.now() + i * 86400000));
    const tenths = await db.getDailyXpTenths(d);
    if (tenths) await db.addDailyXpTenths(d, -tenths);
  }
  globalThis.localStorage?.clear();
};

beforeEach(async () => {
  t0 = Date.now();
  offsetMs = 0;
  // The in-memory DB is shared by all tests: wipe the es-en pair too (earlier cases write cards and settings there).
  await getDb().setOnboarding('es', 'en');
  await getDb().resetPcicCards();
  await baseSetup();
});
afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});


// New helpers of round 2.
const switchLevel = (hook: Hook, lvl: 'A1' | 'B1') => act(async () => { await hook.result.current.handleSelectLevel(lvl); });
const xp = (hook: Hook) => hook.result.current.xpToday;
const fatigueSaved = () => loadResumeValue(getDb(), 'fatigue') as Promise<{ tired: boolean; misses: Record<string, number>; parked: string[] }>;
const asWeb = () => jest.replaceProperty(Platform, 'OS', 'web');
// Per-pair settings (after a pair switch the switches are set again for the new pair).
const pairSettings = async (o: { newGate?: boolean; missCap?: boolean; noPileUp?: boolean; srs?: string } = {}) => {
  const db = getDb();
  await db.setPcicLevel('A1');
  await db.setDailyNewLimit(5);
  await db.setPcicNewBonus(0, day);
  await db.setNoPileUp(o.noPileUp ?? true);
  await db.setSrsDay({ srsDay: o.srs ?? reviewDay, srsDayStepOn: o.srs ?? reviewDay });
  await db.setMissCap(o.missCap ?? false);
  await db.setTiredButton(false);
  await db.setFatigueDetector(false);
  await db.setNewWordGate(o.newGate ?? true);
};
const switchPair = async (hook: Hook | null, a: string, b: string, o: Parameters<typeof pairSettings>[0] = {}) => {
  await getDb().setOnboarding(a, b);
  await pairSettings(o);
  if (hook) await refocus(hook);
};
// "park load at X": load() stops at its first call of X, everything it read before X is already in hand.
const parkLoad = async (name: string) => {
  const release = gate(name);
  act(() => { mockFocus!(); });
  await settle(15);
  return release;
};
// gate('setGameProgress') narrowed to calls whose item id is `key`; only the first such call is parked.
const gateResume = (key: string) => {
  const db = getDb() as unknown as Record<string, AnyFn>;
  const real = db.setGameProgress.bind(db);
  let release!: () => void;
  const blocked = new Promise<void>((res) => (release = res));
  let done = false;
  jest.spyOn(db, 'setGameProgress').mockImplementation(async (...a: unknown[]) => {
    if (!done && (a[1] === key || String(a[1]).startsWith(key + ':'))) { done = true; await blocked; }
    return real(...a);
  });
  return release;
};
const noDup = (list: string[]) => expect(new Set(list).size).toBe(list.length);

it('C31 Level switch and back: the missed card\'s timer and the card on screen are lost', async () => {
  await getDb().setNewWordGate(false);
  const hook0 = await open();
  expect(ids(hook0)).toEqual(ws(0, 4));
  await grade(hook0, 'again');
  expect(ids(hook0)).toEqual([w(1), w(2), w(3), w(4), w(0)]);
  const T = returnAt(hook0, w(0));
  expect(T).toBeDefined();
  await switchLevel(hook0, 'B1');
  await switchLevel(hook0, 'A1');
  const expectBack = (hook: Hook) => {
    expect(cur(hook)).toBe(w(1));
    expect(ids(hook)).toEqual([w(1), w(2), w(3), w(4), w(0)]);
    expect(returnAt(hook, w(0))).toBe(T);
    expect(hook.result.current.queue.filter((c) => c.itemId !== w(0) && (c as { returnAt?: number }).returnAt !== undefined)).toHaveLength(0);
    expect(hook.result.current.newRemaining).toBe(4);
    expect(hook.result.current.dueRemaining).toBe(1);
    expect(hook.result.current.typedAnswer).toBe('');
  };
  expectBack(hook0);
  expect(tiles(hook0)).toEqual([0, 0, 0]);
  const hook = await reopen(hook0);
  expectBack(hook);
});

it('C32 "+5" batch bar after a level switch and back', async () => {
  const hook0 = await open();
  await grades(hook0, 'good', 5);
  await moreNew(hook0, 5);
  expect(ids(hook0)).toEqual(ws(5, 9));
  expect(bar(hook0)).toBe(0);
  await grade(hook0, 'good');
  expect(bar(hook0)).toBe(25);
  await switchLevel(hook0, 'B1');
  expect(bar(hook0)).toBe(0);
  expect(ids(hook0)).toEqual(['b1-upper']);
  expect(hook0.result.current.batchBase).not.toEqual({ day, level: 'A1', n: 5 });
  await switchLevel(hook0, 'A1');
  const expectBatch = (hook: Hook) => {
    expect(ids(hook)).toEqual(ws(6, 9));
    expect(hook.result.current.newRemaining).toBe(4);
    expect(hook.result.current.todayNewBudget).toBe(10);
    expect(hook.result.current.batchBase).toEqual({ day, level: 'A1', n: 5 });
    expect(bar(hook)).toBe(25);
  };
  expectBatch(hook0);
  const hook = await reopen(hook0);
  expectBatch(hook);
});

it('C33 Undo finishes while the quiet reload is parked', async () => {
  const hook0 = await open();
  await type(hook0, 'palabra0');
  await check(hook0);
  await grade(hook0, 'good');
  const x1 = xp(hook0);
  expect(x1).toBeGreaterThan(0);
  const release = await parkLoad('getDailyNewLimit');
  await undo(hook0);
  release();
  await settle();
  const expectUndone = async (hook: Hook, withTiles: boolean) => {
    expect(cur(hook)).toBe(w(0));
    expect(ids(hook)).toEqual(ws(0, 4));
    expect(hook.result.current.newRemaining).toBe(5);
    expect(hook.result.current.dueRemaining).toBe(0);
    expect((await dbCard(w(0)))?.state ?? 'new').toBe('new');
    expect(hook.result.current.allCards.get(w(0))?.state).not.toBe('review');
    expect(hook.result.current.doneToday).toBe(0);
    expect(xp(hook)).toBe(0);
    expect(bar(hook)).toBe(0);
    if (withTiles) expect(tiles(hook)).toEqual([0, 0, 0]);
  };
  await expectUndone(hook0, true);
  await refocus(hook0);
  await expectUndone(hook0, true);
  const hook = await reopen(hook0);
  await expectUndone(hook, false);
});

it('C34 Screen left open past midnight, then a grade without any tab switch', async () => {
  await setSrs(day);
  const hook = await open();
  expect(ids(hook)).toEqual(ws(0, 4));
  await grades(hook, 'good', 2);
  advanceDays(1);
  await type(hook, 'palabra2');
  await check(hook);
  await grade(hook, 'good');
  expect((await dbCard(w(2)))?.introducedAt).toBe(addDays(day, 1));
  await refocus(hook);
  expect(hook.result.current.today).toBe(addDays(day, 1));
  expect(ids(hook)).toEqual([w(0), w(1)]);
  expect(ids(hook)).not.toContain(w(2));
  expect(hook.result.current.dueRemaining).toBe(2);
  expect(hook.result.current.newRemaining).toBe(0);
  expect(cur(hook)).toBe(w(0));
  expect(hook.result.current.doneToday).toBeGreaterThanOrEqual(1);
  await grades(hook, 'good', 2);
  expect(hook.result.current.newRemaining).toBe(4);
  expect(ids(hook)).not.toContain(w(2));
});

it('C35 Level switch while a grade is still being saved', async () => {
  const hook = await open();
  expect(cur(hook)).toBe(w(0));
  const release = gate('updateStreak');
  let gradeDone!: Promise<void>;
  act(() => { gradeDone = hook.result.current.handleGrade('good'); });
  await settle();
  // Not awaited inside one act: if the switch waits for the parked grade, awaiting it before the release would hang.
  let switched!: Promise<void>;
  act(() => { switched = hook.result.current.handleSelectLevel('B1'); });
  await settle(50);
  release();
  await act(async () => { await gradeDone; await switched; });
  await settle();
  const s = hook.result.current;
  expect(s.level).toBe('B1');
  expect(ids(hook)).toEqual(['b1-upper']);
  expect(ids(hook).some((id) => id.startsWith('a1-'))).toBe(false);
  expect([...s.allCards.keys()].some((id) => id.startsWith('a1-'))).toBe(false);
  expect(cur(hook)).toBe('b1-upper');
  expect(s.typedAnswer).toBe('');
  expect(s.doneToday).toBe(0);
  expect(bar(hook)).toBe(0);
  expect(tiles(hook)).toEqual([0, 0, 0]);
  await switchLevel(hook, 'A1');
  expect(ids(hook)).toEqual(ws(1, 4));
  expect(await dbCard(w(0))).toMatchObject({ state: 'review', reps: 1 });
  expect(hook.result.current.newRemaining).toBe(4);
});

it('C36 Undo tapped twice fast', async () => {
  const hook0 = await open();
  await grade(hook0, 'good');
  const x1 = xp(hook0);
  await grade(hook0, 'good');
  const h = hook0.result.current;
  await act(async () => {
    const a = h.handleUndo();
    const b = h.handleUndo();
    await Promise.all([a, b]);
  });
  const expectOne = async (hook: Hook) => {
    expect(cur(hook)).toBe(w(1));
    expect(ids(hook)).toEqual(ws(1, 4));
    expect(tiles(hook)).toEqual([1, 1, 0]);
    expect(xp(hook)).toBe(x1);
    expect(hook.result.current.doneToday).toBe(1);
    expect(hook.result.current.newRemaining).toBe(4);
    expect((await dbCard(w(0)))?.state).toBe('review');
    expect((await dbCard(w(1)))?.state ?? 'new').toBe('new');
    expect(hook.result.current.lastGraded).toBeNull();
  };
  await expectOne(hook0);
  await refocus(hook0);
  await expectOne(hook0);
  const hook = await reopen(hook0);
  expect(ids(hook)).toEqual(ws(1, 4));
  expect(xp(hook)).toBe(x1);
});

it('C37 "+5" tapped while the quiet reload is parked', async () => {
  const hook0 = await open();
  await grades(hook0, 'good', 5);
  const release = await parkLoad('getExamResults');
  await moreNew(hook0, 5);
  release();
  await settle();
  const expectBatch = async (hook: Hook, withTiles: boolean) => {
    expect(ids(hook)).toEqual(ws(5, 9));
    expect(hook.result.current.newRemaining).toBe(5);
    expect(hook.result.current.todayNewBudget).toBe(10);
    expect(bar(hook)).toBe(0);
    expect(await getDb().getPcicNewBonus(day)).toBe(5);
    if (withTiles) expect(tiles(hook)).toEqual([5, 5, 0]);
  };
  await expectBatch(hook0, true);
  await refocus(hook0);
  await expectBatch(hook0, true);
  const hook = await reopen(hook0);
  await expectBatch(hook, false);
});

it('C38 "Don\'t learn this" tapped while the quiet reload is parked', async () => {
  const hook = await open();
  const release = await parkLoad('getDailyNewLimit');
  await dontLearn(hook);
  expect(ids(hook)).toEqual(ws(1, 5));
  release();
  await settle();
  expect(cur(hook)).toBe(w(1));
  expect(ids(hook)).toEqual(ws(1, 5));
  expect(ids(hook)).not.toContain(w(0));
  expect((await dbCard(w(0)))?.known).toBe(true);
  expect(hook.result.current.newRemaining).toBe(5);
  expect(tiles(hook)).toEqual([0, 0, 0]);
  expect(hook.result.current.lastGraded).not.toBeNull();
  await undo(hook);
  expect(cur(hook)).toBe(w(0));
  expect(ids(hook)).toEqual(ws(0, 4));
  expect(!!(await dbCard(w(0)))?.known).toBe(false);
  expect(hook.result.current.newRemaining).toBe(5);
});

// Grades 'again' on whichever card is current until every id of `want` is parked (max 12 grades).
const againUntilParked = async (hook: Hook, want: string[]) => {
  for (let i = 0; i < 12 && !want.every((id) => parked(hook).includes(id)); i++) await grade(hook, 'again');
};

it('C39 Undo of the parking miss after the miss cap was switched off wipes the day\'s miss counts', async () => {
  const db = getDb();
  await db.setMissCap(true);
  await db.upsertPcicCard(review(r(0)));
  await db.upsertPcicCard(review(r(1)));
  const hook = await open();
  expect(cur(hook)).toBe(r(0));
  // r0's fourth miss last: the queue alternates r0, r1, r0, r1, r0, r1, r0.
  await grades(hook, 'again', 7);
  expect(parked(hook)).toEqual([r(0)]);
  await db.setMissCap(false);
  await refocus(hook);
  await undo(hook);
  expect(ids(hook).filter((id) => id === r(0))).toHaveLength(1);
  await db.setMissCap(true);
  await refocus(hook);
  expect((await fatigueSaved()).misses).toEqual({ [r(0)]: 3, [r(1)]: 3 });
  expect(parked(hook)).toEqual([]);
  await againUntilParked(hook, [r(0), r(1)]);
  expect([...parked(hook)].sort()).toEqual([r(0), r(1)].sort());
  expect(ids(hook)).toEqual(ws(0, 4));
  expect(hook.result.current.dueRemaining).toBe(0);
});

it('C40 Undo of the parking miss after a tab switch lets the new words stay', async () => {
  const db = getDb();
  await db.setMissCap(true);
  await db.upsertPcicCard(review(r(0)));
  const hook0 = await open();
  await grades(hook0, 'again', 4);
  expect(parked(hook0)).toEqual([r(0)]);
  expect(ids(hook0)).toEqual(ws(0, 4));
  await refocus(hook0);
  await undo(hook0);
  expect(cur(hook0)).toBe(r(0));
  expect(ids(hook0)).toEqual([r(0)]);
  expect(hook0.result.current.newRemaining).toBe(0);
  expect(hook0.result.current.dueRemaining).toBe(1);
  expect(parked(hook0)).toEqual([]);
  expect(tiles(hook0)).toEqual([3, 0, 3]);
  expect((await fatigueSaved()).misses[r(0)]).toBe(3);
  const hook = await reopen(hook0);
  expect(ids(hook)).toEqual([r(0)]);
  expect(hook.result.current.newRemaining).toBe(0);
});

it('C41 A late Check from the old render reveals the previous card\'s answer on the new card', async () => {
  const hook = await open();
  expect(cur(hook)).toBe(w(0));
  await type(hook, 'palabra0');
  const h = hook.result.current;
  await check(hook);
  await grade(hook, 'good');
  expect(cur(hook)).toBe(w(1));
  await act(async () => { await h.handleCheck(); });
  const s = hook.result.current;
  expect(s.typedAnswer).not.toBe('palabra0');
  if (s.grade) {
    expect(s.grade.best).toBe('palabra1');
    expect(s.grade.match).not.toBe('exact');
  } else {
    expect(s.typedAnswer).toBe('');
  }
  await refocus(hook);
  expect(cur(hook)).toBe(w(1));
  expect((await dbCard(w(1)))?.state ?? 'new').toBe('new');
  expect(tiles(hook)).toEqual([1, 1, 0]);
});

it('C42 Snapshot and miss counts of one pair leak into the other pair on the web store', async () => {
  asWeb();
  const db = getDb();
  await pairSettings({ newGate: false, missCap: true });
  await db.upsertPcicCard(review(r(0)));
  await switchPair(null, 'es', 'en', { newGate: false, missCap: true });
  await db.upsertPcicCard(review(r(0)));
  await switchPair(null, 'en', 'es', { newGate: false, missCap: true });
  const hook = await open();
  expect(cur(hook)).toBe(r(0));
  await grades(hook, 'again', 4);
  expect(parked(hook)).toEqual([r(0)]);
  expect(ids(hook)).toEqual(ws(0, 4));
  await grade(hook, 'again');
  expect(ids(hook)).toEqual([w(1), w(2), w(3), w(4), w(0)]);
  const T = returnAt(hook, w(0));
  expect(T).toBeDefined();
  await settle();
  await switchPair(hook, 'es', 'en', { newGate: false, missCap: true });
  expect(cur(hook)).toBe(r(0));
  expect(parked(hook)).toEqual([]);
  expect(hook.result.current.queue.filter((c) => (c as { returnAt?: number }).returnAt !== undefined)).toHaveLength(0);
  expect(Object.keys((await fatigueSaved())?.misses ?? {})).toHaveLength(0);
  expect(tiles(hook)).toEqual([0, 0, 0]);
  await switchPair(hook, 'en', 'es', { newGate: false, missCap: true });
  expect(parked(hook)).toEqual([r(0)]);
  expect(ids(hook)).toEqual([w(1), w(2), w(3), w(4), w(0)]);
  expect(returnAt(hook, w(0))).toBe(T);
});

const tiredCards = async () => {
  const db = getDb();
  await db.setTiredButton(true);
  await db.upsertPcicCard({ ...review(r(0), '2025-12-30'), interval: 1 });
  await db.upsertPcicCard({ ...review(r(1), '2025-12-31'), interval: 10 });
  await db.upsertPcicCard({ ...review(r(2), reviewDay), interval: 5 });
};

it('C43 "I\'m tired" pressed while the quiet reload is parked', async () => {
  await tiredCards();
  const hook0 = await open();
  expect(cur(hook0)).toBe(r(0));
  const release = await parkLoad('getNoPileUp');
  await act(async () => { await hook0.result.current.handleTired(); });
  expect(ids(hook0)).toEqual([r(1), r(2), r(0)]);
  release();
  await settle();
  const expectTired = async (hook: Hook) => {
    expect(hook.result.current.tired).toBe(true);
    expect(ids(hook)).toEqual([r(1), r(2), r(0)]);
    expect(cur(hook)).toBe(r(1));
    expect((await fatigueSaved()).tired).toBe(true);
  };
  await expectTired(hook0);
  const hook = await reopen(hook0);
  await expectTired(hook);
});

it('C44 A review graded today is due again the same day after noPileUp is switched off', async () => {
  const db = getDb();
  await db.upsertPcicCard({ ...review(r(0)), interval: 1 });
  const hook0 = await open();
  expect(ids(hook0)).toEqual([r(0)]);
  await type(hook0, 'palabra14');
  await check(hook0);
  await grade(hook0, 'good');
  await db.setNoPileUp(false);
  await refocus(hook0);
  const expectDone = (hook: Hook) => {
    expect(ids(hook)).not.toContain(r(0));
    expect(hook.result.current.dueRemaining).toBe(0);
    expect(ids(hook)).toEqual(ws(0, 4));
    expect(hook.result.current.doneToday).toBe(1);
  };
  expectDone(hook0);
  expect(tiles(hook0)).toEqual([1, 0, 0]);
  const hook = await reopen(hook0);
  expectDone(hook);
});

it('C45 Hidden article pick: article buttons switched off, a new day, another pair', async () => {
  const db = getDb();
  // Case A
  const hookA = await open();
  act(() => { hookA.result.current.setArticlePick('el'); });
  await db.setArticlePicker(false);
  await refocus(hookA);
  expect(hookA.result.current.articlePick).toBe('');
  await type(hookA, 'palabra0');
  await check(hookA);
  expect(hookA.result.current.typedAnswer).toBe('palabra0');
  expect(hookA.result.current.grade?.match).toBe('exact');
  hookA.unmount();
  await db.setArticlePicker(true);
  // Case C
  await baseSetup();
  const hookC = await open();
  act(() => { hookC.result.current.setArticlePick('el'); });
  await switchPair(hookC, 'es', 'en');
  expect(hookC.result.current.articlePick).toBe('');
  expect(hookC.result.current.typedAnswer).toBe('');
  hookC.unmount();
  // Case B (last: it moves the clock)
  await baseSetup();
  const hookB = await open();
  act(() => { hookB.result.current.setArticlePick('el'); });
  await type(hookB, 'x');
  advanceDays(1);
  await refocus(hookB);
  expect(hookB.result.current.articlePick).toBe('');
  expect(hookB.result.current.typedAnswer).toBe('');
  expect(hookB.result.current.grade).toBeNull();
});

it('C46 Late taps from an old render after the first action finished (skip and undo)', async () => {
  // Case A
  const hookA = await open();
  const hA = hookA.result.current;
  await act(async () => { await hA.handleGrade('good'); });
  await act(async () => { await hA.handleDontLearn(); });
  await refocus(hookA);
  expect(await dbCard(w(0))).toMatchObject({ state: 'review', reps: 1 });
  expect(!!(await dbCard(w(0)))?.known).toBe(false);
  expect(cur(hookA)).toBe(w(1));
  expect((await dbCard(w(1)))?.state ?? 'new').toBe('new');
  expect(ids(hookA)).toEqual(ws(1, 4));
  expect(tiles(hookA)).toEqual([1, 1, 0]);
  expect(hookA.result.current.newRemaining).toBe(4);
  hookA.unmount();
  // Case B
  await baseSetup();
  const hookB = await open();
  await grade(hookB, 'good');
  const hB = hookB.result.current;
  await grade(hookB, 'good');
  await act(async () => { await hB.handleUndo(); });
  await refocus(hookB);
  expect((await dbCard(w(0)))?.state).toBe('review');
  noDup(ids(hookB));
  const state = JSON.stringify({ ids: ids(hookB), tiles: tiles(hookB) });
  expect([
    JSON.stringify({ ids: ws(1, 4), tiles: [1, 1, 0] }),
    JSON.stringify({ ids: ws(2, 4), tiles: [2, 2, 0] }),
  ]).toContain(state);
});

it('C47 Undo while the next grade is still being saved', async () => {
  const hook = await open();
  await grade(hook, 'good');
  const release = gate('updateStreak');
  let gradeDone!: Promise<void>;
  act(() => { gradeDone = hook.result.current.handleGrade('good'); });
  await settle();
  await undo(hook);
  release();
  await act(async () => { await gradeDone; });
  await settle();
  const expectConsistent = async () => {
    let reviewRows = 0;
    for (let i = 0; i < 5; i++) {
      const state = (await dbCard(w(i)))?.state ?? 'new';
      if (state === 'review') reviewRows++;
      expect(ids(hook).includes(w(i))).toBe(state === 'new');
    }
    noDup(ids(hook));
    expect(tiles(hook)[0]).toBe(reviewRows);
    expect([
      JSON.stringify({ ids: ws(2, 4), tiles: [2, 2, 0] }),
      JSON.stringify({ ids: ws(1, 4), tiles: [1, 1, 0] }),
    ]).toContain(JSON.stringify({ ids: ids(hook), tiles: tiles(hook) }));
  };
  await expectConsistent();
  await refocus(hook);
  await expectConsistent();
});

it('C48 "More new words?" answered with +5, then a tab switch in the same tick', async () => {
  const db = getDb();
  await db.setNoPileUp(false);
  await db.setDailyNewLimit(1);
  await setSrs(day);
  await db.upsertPcicCard(review(r(0), day));
  await db.upsertPcicCard(review(r(1), day));
  const hook = await open();
  for (let i = 0; i < 6 && !hook.result.current.askMoreNew; i++) await grade(hook, 'good');
  expect(hook.result.current.askMoreNew).toBe(true);
  const release = gate('setPcicNewBonus');
  act(() => { hook.result.current.handleAskMoreNew(5); });
  const expectBatch = () => {
    expect(hook.result.current.askMoreNew).toBe(false);
    expect(ids(hook).filter((id) => id !== r(0) && id !== r(1))).toEqual(ws(1, 5));
    expect(hook.result.current.newRemaining).toBe(5);
    expect(hook.result.current.todayNewBudget).toBe(6);
  };
  expectBatch();
  await refocus(hook);
  expectBatch();
  release();
  await settle();
  await refocus(hook);
  expectBatch();
});

it('C49 One learning clock: A1\'s leftover reviews hide B1\'s review that is due today', async () => {
  const db = getDb();
  const yesterday = addDays(day, -1);
  await db.upsertPcicCard(review(r(0), yesterday));
  await db.upsertPcicCard(review('b1-upper', day));
  await setSrs(yesterday);
  const hook = await open();
  expect(ids(hook)).toEqual([r(0)]);
  await switchLevel(hook, 'B1');
  expect(ids(hook)).toEqual(['b1-upper']);
  expect(hook.result.current.dueRemaining).toBe(1);
  await switchLevel(hook, 'A1');
  await grade(hook, 'good');
  await switchLevel(hook, 'B1');
  expect(ids(hook)).toEqual(['b1-upper']);
  expect(hook.result.current.dueRemaining).toBe(1);
});

it('C50 One learning clock: the other pair\'s first open of the day', async () => {
  const db = getDb();
  const yesterday = addDays(day, -1);
  await pairSettings({ srs: yesterday });
  await db.upsertPcicCard(review(r(0), yesterday));
  await db.upsertPcicCard(review(r(1), day));
  await switchPair(null, 'es', 'en', { srs: yesterday });
  const hook = await open();
  expect(ids(hook)).toEqual(ws(0, 4));
  await grade(hook, 'good');
  await switchPair(hook, 'en', 'es', { srs: yesterday });
  expect(ids(hook)).toEqual([r(0)]);
  expect(hook.result.current.dueRemaining).toBe(1);
  expect(hook.result.current.srsDay).toBe(yesterday);
  await switchPair(hook, 'es', 'en', { srs: day });
  expect(hook.result.current.srsDay).toBe(day);
  expect(ids(hook)).toEqual(ws(1, 4));
  expect(ids(hook)).not.toContain(w(0));
});

it('C51 A grade whose save is still pending when the day changes', async () => {
  await setSrs(day);
  const hook = await open();
  const release = gate('updateStreak');
  let gradeDone!: Promise<void>;
  act(() => { gradeDone = hook.result.current.handleGrade('good'); });
  await settle();
  advanceDays(1);
  await refocus(hook);
  release();
  await act(async () => { await gradeDone; });
  await settle();
  const expectNewDay = async () => {
    const s = hook.result.current;
    expect(s.today).toBe(addDays(day, 1));
    expect(ids(hook)).toEqual([w(0)]);
    expect(cur(hook)).toBe(w(0));
    expect(s.newRemaining).toBe(0);
    expect(s.dueRemaining).toBe(1);
    expect(tiles(hook)).toEqual([0, 0, 0]);
    expect(s.doneToday).toBe(0);
    expect(bar(hook)).toBe(0);
    expect(xp(hook)).toBe(0);
    expect(s.lastGraded).toBeNull();
  };
  await expectNewDay();
  await refocus(hook);
  await expectNewDay();
});

it('C52 Undo after the daily limit was lowered below what is learned', async () => {
  const db = getDb();
  const hook0 = await open();
  await grades(hook0, 'good', 3);
  await db.setDailyNewLimit(2);
  await refocus(hook0);
  expect(ids(hook0)).toEqual([]);
  expect(tiles(hook0)).toEqual([3, 3, 0]);
  expect(bar(hook0)).toBe(100);
  expect(hook0.result.current.lastGraded).not.toBeNull();
  const expectUndone = async (hook: Hook, withTiles: boolean) => {
    expect(cur(hook)).toBe(w(2));
    expect(ids(hook)).toEqual([w(2)]);
    expect(hook.result.current.doneToday).toBe(2);
    expect((await dbCard(w(2)))?.state ?? 'new').toBe('new');
    if (withTiles) expect(tiles(hook)).toEqual([2, 2, 0]);
  };
  await undo(hook0);
  await expectUndone(hook0, true);
  await refocus(hook0);
  await expectUndone(hook0, true);
  const hook = await reopen(hook0);
  await expectUndone(hook, false);
});

it('C53 Cold reopen right after a miss, before the snapshot write landed', async () => {
  await getDb().setNewWordGate(false);
  const hook0 = await open();
  await settle();
  const release = gateResume('learn');
  await grade(hook0, 'again');
  expect(ids(hook0)).toEqual([w(1), w(2), w(3), w(4), w(0)]);
  const T = returnAt(hook0, w(0));
  expect(T).toBeDefined();
  const hook = await reopen(hook0);
  expect(cur(hook)).toBe(w(1));
  expect(cur(hook)).not.toBe(w(0));
  release();
  await settle();
  await refocus(hook);
  expect(ids(hook)).toEqual([w(1), w(2), w(3), w(4), w(0)]);
  expect(returnAt(hook, w(0))).toBe(T);
});

it('C54 Fatigue offer accepted, then tab switch, reopen, detector off', async () => {
  const db = getDb();
  await db.setFatigueDetector(true);
  await db.upsertPcicCard({ ...review(r(0)), interval: 1 });
  await db.upsertPcicCard({ ...review(r(1)), interval: 10 });
  await db.upsertPcicCard({ ...review(r(2)), interval: 5 });
  const hook0 = await open();
  for (let i = 0; i < 15 && !hook0.result.current.fatigueOffer; i++) await grade(hook0, 'again');
  expect(hook0.result.current.fatigueOffer).not.toBeNull();
  const dues = [(await dbCard(r(0)))?.due, (await dbCard(r(1)))?.due, (await dbCard(r(2)))?.due];
  const h = hook0.result.current;
  await act(async () => { await Promise.all([h.handleFatigueOfferAccept(), h.handleFatigueOfferAccept()]); });
  const expectAccepted = async (hook: Hook) => {
    expect(hook.result.current.fatigueOffer).toBeNull();
    expect(hook.result.current.tired).toBe(true);
    const noTimer = hook.result.current.queue.filter((c) => (c as { returnAt?: number }).returnAt === undefined).map((c) => c.itemId);
    expect(noTimer).toEqual([r(1), r(2), r(0)].filter((id) => noTimer.includes(id)));
    expect([(await dbCard(r(0)))?.due, (await dbCard(r(1)))?.due, (await dbCard(r(2)))?.due]).toEqual(dues);
    expect((await fatigueSaved()).tired).toBe(true);
  };
  await expectAccepted(hook0);
  await refocus(hook0);
  await expectAccepted(hook0);
  const hook = await reopen(hook0);
  await expectAccepted(hook);
  const c = cur(hook);
  await type(hook, 'pal');
  await db.setFatigueDetector(false);
  await refocus(hook);
  expect(hook.result.current.fatigueOffer).toBeNull();
  expect(hook.result.current.tired).toBe(false);
  expect(cur(hook)).toBe(c);
  expect(hook.result.current.typedAnswer).toBe('pal');
});

it('C55 "+5", then undo of the last word of the first batch, then reopen', async () => {
  const hook0 = await open();
  await grades(hook0, 'good', 4);
  const x4 = xp(hook0);
  await grade(hook0, 'good');
  const x5 = xp(hook0);
  await moreNew(hook0, 5);
  expect(ids(hook0)).toEqual(ws(5, 9));
  await undo(hook0);
  const expectUndone = async (hook: Hook) => {
    expect(cur(hook)).toBe(w(4));
    expect((await dbCard(w(4)))?.state ?? 'new').toBe('new');
    expect(ids(hook)).toEqual(ws(4, 9));
    expect(hook.result.current.newRemaining).toBe(6);
    expect(hook.result.current.todayNewBudget).toBe(10);
    expect(tiles(hook)).toEqual([4, 4, 0]);
    expect(xp(hook)).toBe(x4);
    expect(bar(hook)).toBe(0);
  };
  await expectUndone(hook0);
  await refocus(hook0);
  await expectUndone(hook0);
  await grade(hook0, 'good');
  const expectBatch = (hook: Hook) => {
    expect(ids(hook)).toEqual(ws(5, 9));
    expect(xp(hook)).toBe(x5);
    expect(bar(hook)).toBe(0);
  };
  expectBatch(hook0);
  expect(tiles(hook0)).toEqual([5, 5, 0]);
  const hook = await reopen(hook0);
  expectBatch(hook);
});

it('C56 "I\'m tired" double tap, and the button switched off in Settings mid-card', async () => {
  const db = getDb();
  await tiredCards();
  const hook = await open();
  expect(cur(hook)).toBe(r(0));
  const h = hook.result.current;
  await act(async () => { await Promise.all([h.handleTired(), h.handleTired()]); });
  const expectAgree = async () => {
    const tired = hook.result.current.tired;
    expect(tired).toBe((await fatigueSaved()).tired);
    expect(ids(hook)).toEqual(tired ? [r(1), r(2), r(0)] : [r(0), r(1), r(2)]);
  };
  await expectAgree();
  await refocus(hook);
  await expectAgree();
  if (!hook.result.current.tired) await act(async () => { await hook.result.current.handleTired(); });
  const c = cur(hook);
  await type(hook, 'pal');
  await db.setTiredButton(false);
  await refocus(hook);
  expect(hook.result.current.tired).toBe(false);
  expect(hook.result.current.showTired).toBe(false);
  expect(cur(hook)).toBe(c);
  expect(hook.result.current.typedAnswer).toBe('pal');
  expect(ids(hook)).toEqual([c, ...[r(0), r(1), r(2)].filter((id) => id !== c)]);
  const hook2 = await reopen(hook);
  expect(hook2.result.current.tired).toBe(false);
  expect([...ids(hook2)].sort()).toEqual([r(0), r(1), r(2)].sort());
});

it('C57 Level picked again while the first level switch is still loading', async () => {
  const hook0 = await open();
  await type(hook0, 'pal');
  const release = gate('getDailyNewLimit');
  let first!: Promise<void>;
  act(() => { first = hook0.result.current.handleSelectLevel('B1'); });
  await settle(20);
  await act(async () => { await hook0.result.current.handleSelectLevel('A1'); });
  release();
  await act(async () => { await first; });
  await settle();
  const expectA1 = async (hook: Hook, withTiles: boolean) => {
    expect(hook.result.current.level).toBe('A1');
    expect(await getDb().getPcicLevel()).toBe('A1');
    expect(ids(hook)).toEqual(ws(0, 4));
    expect(cur(hook)).toBe(w(0));
    expect(ids(hook).some((id) => id.startsWith('b1-'))).toBe(false);
    if (withTiles) expect(tiles(hook)).toEqual([0, 0, 0]);
  };
  await expectA1(hook0, true);
  const hook = await reopen(hook0);
  await expectA1(hook, false);
});
