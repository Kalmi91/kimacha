import { MemoryDB } from '@/lib/database.web';
import { advanceLearnSrsDay, loadSrsDay, readSrsDay, stepSrsDay } from '../srsDay';
import { addDays, sm2NewCard, sm2Review, sm2MarkKnown } from '@/lib/sm2';
import { continueLearnSession, pickLearnSession, requeueAfterGrade, requeueAfterUndo, skipReplacement } from '@/lib/pcicSession';
import { arrangeQueue, emptyFatigue } from '../fatigue';
import { DEFAULT_DAILY_NEW_LIMIT } from '@/lib/usageStats';

const calendarDay = '2026-11-17';
const srsDay = '2026-11-07';
const saved = { srsDay, srsDayStepOn: srsDay };
const review = (id: string, due = srsDay) => ({ ...sm2Review(sm2NewCard(id), 'good', '2026-11-01'), due });
const order = ['due', ...Array.from({ length: 10 }, (_, i) => `new-${i}`)];
const opts = { srsDay, calendarDay, noPileUp: true, newLimit: 5 };

describe('the learning clock', () => {
  it('initializes on the calendar day and steps once per day when reviews are empty', () => {
    expect(stepSrsDay(null, srsDay, false)).toEqual(saved);
    const next = stepSrsDay(saved, '2026-11-08', false);
    expect(next).toEqual({ srsDay: '2026-11-08', srsDayStepOn: '2026-11-08' });
    expect(stepSrsDay(next, '2026-11-09', false).srsDay).toBe('2026-11-09');
  });

  it('does not advance an unfinished review day, and finishing it later the same day does not step either', () => {
    const blocked = stepSrsDay(saved, calendarDay, true);
    expect(blocked).toEqual({ srsDay, srsDayStepOn: calendarDay });
    expect(stepSrsDay(blocked, calendarDay, false)).toEqual(blocked);
    expect(stepSrsDay(blocked, addDays(calendarDay, 1), false)).toEqual({ srsDay: '2026-11-08', srsDayStepOn: addDays(calendarDay, 1) });
  });

  it('adds exactly one day after ten missed days, never twice on the same calendar day', () => {
    const next = stepSrsDay(saved, calendarDay, false);
    expect(next).toEqual({ srsDay: '2026-11-08', srsDayStepOn: calendarDay });
    expect(stepSrsDay(next, calendarDay, false)).toEqual(next);
  });

  it('clamps a clock rollback and uses the calendar when disabled', () => {
    expect(stepSrsDay(saved, '2026-11-02', false)).toEqual({ srsDay: '2026-11-02', srsDayStepOn: '2026-11-02' });
    expect(stepSrsDay(saved, calendarDay, true, false)).toEqual({ srsDay: calendarDay, srsDayStepOn: calendarDay });
    expect(stepSrsDay({ srsDay: calendarDay, srsDayStepOn: srsDay }, calendarDay, false).srsDay).toBe(calendarDay);
  });

  it.each([null, {}, { srsDay: 'broken', srsDayStepOn: srsDay }, { srsDay: '2026-02-30', srsDayStepOn: srsDay }])('ignores invalid stored values: %p', (value) => {
    expect(readSrsDay(value, calendarDay)).toEqual({ srsDay: calendarDay, srsDayStepOn: calendarDay });
  });

  it('persists only on Learn load, ignores parked cards and isolates language pairs', async () => {
    const db = new MemoryDB();
    await db.setOnboarding('en', 'es');
    await db.setSrsDay(saved);
    expect(await loadSrsDay(db, calendarDay)).toBe(srsDay);
    expect(await db.getSrsDay()).toEqual(saved);
    expect(await advanceLearnSrsDay(db, calendarDay, [review('due')], ['due'])).toBe('2026-11-08');
    expect(await advanceLearnSrsDay(db, calendarDay, [review('due', '2026-11-08')])).toBe('2026-11-08');
    expect(await advanceLearnSrsDay(db, calendarDay, [])).toBe('2026-11-08');
    await db.setOnboarding('hu', 'es');
    expect(await db.getSrsDay()).toBeNull();
    expect(await advanceLearnSrsDay(db, calendarDay, [])).toBe(calendarDay);
    await db.setOnboarding('en', 'es');
    expect(await loadSrsDay(db, calendarDay)).toBe('2026-11-08');
    await db.setNoPileUp(false);
    expect(await advanceLearnSrsDay(db, calendarDay, [review('due')])).toBe(calendarDay);
    expect(await loadSrsDay(db, calendarDay)).toBe(calendarDay);
    // Switched off, the clock follows the calendar; switching back on does not bring the old lag back.
    expect(await db.getSrsDay()).toEqual({ srsDay: calendarDay, srsDayStepOn: calendarDay });
    await db.setNoPileUp(true);
    expect(await loadSrsDay(db, calendarDay)).toBe(calendarDay);
    expect(await advanceLearnSrsDay(db, calendarDay, [review('due')])).toBe(calendarDay);
  });

  it('a Learn load on a blocked day stamps the day, so a refocus after the last review keeps the clock', async () => {
    const db = new MemoryDB();
    await db.setOnboarding('en', 'es');
    await db.setSrsDay(saved);
    expect(await advanceLearnSrsDay(db, calendarDay, [review('due')])).toBe(srsDay);
    expect(await db.getSrsDay()).toEqual({ srsDay, srsDayStepOn: calendarDay });
    expect(await advanceLearnSrsDay(db, calendarDay, [review('relearned', addDays(srsDay, 1))])).toBe(srsDay);
    expect(await advanceLearnSrsDay(db, addDays(calendarDay, 1), [review('relearned', addDays(srsDay, 2))])).toBe('2026-11-08');
  });

  it('keeps one clock per level: A1 leftover reviews stay, the first B1 load of the day steps to the calendar day', async () => {
    const db = new MemoryDB();
    await db.setOnboarding('en', 'es');
    await db.setSrsDay(saved);
    expect(await advanceLearnSrsDay(db, calendarDay, [review('due')], [], 'A1')).toBe(srsDay);
    expect(await advanceLearnSrsDay(db, calendarDay, [], [], 'B1')).toBe('2026-11-08');
    expect(await advanceLearnSrsDay(db, calendarDay, [review('due')], [], 'A1')).toBe(srsDay);
    expect(await db.getSrsDay()).toEqual(saved);
  });

  it('a level without its own clock is seeded from the legacy value and steps once', async () => {
    const db = new MemoryDB();
    await db.setOnboarding('en', 'es');
    await db.setSrsDay(saved);
    expect(await advanceLearnSrsDay(db, calendarDay, [], [], 'A1')).toBe('2026-11-08');
    expect(await advanceLearnSrsDay(db, calendarDay, [], [], 'A1')).toBe('2026-11-08');
    await db.setPcicLevel('A1');
    expect(await loadSrsDay(db, calendarDay)).toBe('2026-11-08');
  });
});

describe('reviews before new words', () => {
  it('offers zero new cards while reviews remain, then the five-card budget in the same session', () => {
    const card = review('due');
    expect(pickLearnSession([card], order, opts)).toEqual([card]);
    const missed = sm2Review(card, 'again', srsDay, calendarDay);
    const waiting = requeueAfterGrade([card], missed, srsDay, 'again');
    expect(continueLearnSession(waiting, [missed], order, opts, new Set(['due']))).toEqual(waiting);
    const graded = sm2Review(missed, 'good', srsDay, calendarDay);
    const fresh = continueLearnSession([], [graded], order, opts, new Set(['due']));
    expect(fresh.map((c) => c.itemId)).toEqual(order.slice(1, 6));
    const undone = requeueAfterUndo(fresh, card, graded, srsDay);
    expect(continueLearnSession(undone, [card], order, opts, new Set(['due']))).toEqual([card]);
  });

  it('respects calendar introductions, bonus and parked reviews', () => {
    const cards = [review('due'), sm2Review(sm2NewCard('new-0'), 'good', srsDay, calendarDay)];
    const next = pickLearnSession(cards, order, { ...opts, newLimit: 7, parked: ['due'] });
    expect(next).toHaveLength(6);
    expect(next.every((c) => c.state === 'new')).toBe(true);
    expect(continueLearnSession([cards[0]], cards, order, { ...opts, parked: ['due'] }, new Set(['due']))).toHaveLength(4);
  });

  it('retains the independent new-word gate in the new-word phase and the legacy mix when disabled', () => {
    const missed = sm2Review(sm2NewCard('new-0'), 'again', srsDay, calendarDay);
    const queue = [sm2NewCard('new-1'), missed];
    const continued = continueLearnSession(queue, [missed], order, opts, new Set());
    expect(arrangeQueue(continued, calendarDay, emptyFatigue(calendarDay), { tiredButton: false, missCap: false, newGate: true })[0]).toBe(missed);
    expect(arrangeQueue(continued, calendarDay, emptyFatigue(calendarDay), { tiredButton: false, missCap: false, newGate: false })).toEqual(queue);
    const legacy = pickLearnSession([review('due')], order, { ...opts, noPileUp: false });
    expect(legacy.filter((c) => c.state === 'new')).toHaveLength(5);
    expect(continueLearnSession(legacy, [], order, { ...opts, noPileUp: false }, new Set(['due']))).toBe(legacy);
  });

  it('a skipped new word ("Don\'t learn this") keeps the budget and the next new word takes its place', () => {
    const newOrder = order.slice(1);
    const queue = pickLearnSession([], newOrder, opts);
    expect(queue.map((c) => c.itemId)).toEqual(newOrder.slice(0, 5));
    const known = sm2MarkKnown(queue[0], srsDay, calendarDay);
    const rest = requeueAfterGrade(queue, known, srsDay);
    expect(pickLearnSession([known], newOrder, opts).map((c) => c.itemId)).toEqual(newOrder.slice(1, 6));
    expect(skipReplacement(rest, [known], newOrder, opts)?.itemId).toBe('new-5');
    expect(skipReplacement(rest, [known], newOrder.slice(0, 5), opts)).toBeNull();
  });

  it('schedules against the learning clock but records introductions and reviews on the calendar', async () => {
    const card = sm2Review(sm2NewCard('new'), 'good', srsDay, calendarDay);
    expect(card).toMatchObject({ due: addDays(srsDay, 1), lastReview: calendarDay, introducedAt: calendarDay });
    expect(sm2MarkKnown(sm2NewCard('known'), srsDay, calendarDay)).toMatchObject({ due: addDays(srsDay, 60), lastReview: calendarDay, introducedAt: null });
    expect(sm2MarkKnown(card, srsDay, addDays(calendarDay, 3)).introducedAt).toBe(calendarDay);
    expect(DEFAULT_DAILY_NEW_LIMIT).toBe(5);
    const db = new MemoryDB();
    expect(await db.getDailyNewLimit()).toBe(5);
    await db.setDailyNewLimit(20);
    expect(await db.getDailyNewLimit()).toBe(20);
  });
});
