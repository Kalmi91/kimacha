// SZ2 (SZAVAK.md): a session-sor léptetése értékelés után és visszavonáskor.

import { requeueAfterGrade, requeueAfterUndo } from '../pcicSession';
import { sm2NewCard, sm2Review, addDays, type Sm2Card } from '../sm2';

const TODAY = '2026-09-18';
const TOMORROW = addDays(TODAY, 1);

function reviewCard(overrides: Partial<Sm2Card> = {}): Sm2Card {
  return {
    itemId: 'b1-0001',
    state: 'review',
    step: 0,
    ease: 2.5,
    interval: 10,
    reps: 3,
    lapses: 0,
    due: TODAY,
    lastReview: addDays(TODAY, -10),
    introducedAt: addDays(TODAY, -30),
    ...overrides,
  };
}

describe('requeueAfterGrade', () => {
  it('learning kártya (due === today) a sor végére kerül', () => {
    const before = sm2NewCard('b1-0002');
    const graded = sm2Review(before, 'good', TODAY); // learning, due today
    const other = reviewCard({ itemId: 'b1-0003' });
    const queue = [before, other];

    const next = requeueAfterGrade(queue, graded, TODAY);

    expect(next).toEqual([other, graded]);
  });

  it('review kártya (due holnap) kikerül a sorból', () => {
    const before = reviewCard({ itemId: 'b1-0004', due: TODAY });
    const graded = sm2Review(before, 'good', TODAY); // review -> due later than today
    expect(graded.due).not.toBe(TODAY);
    const other = reviewCard({ itemId: 'b1-0005' });
    const queue = [before, other];

    const next = requeueAfterGrade(queue, graded, TODAY);

    expect(next).toEqual([other]);
  });
});

describe('requeueAfterUndo', () => {
  it('undo learning után: a sor eleje "before", a vége már nem tartalmazza "graded"-et, hossz = eredeti', () => {
    const before = sm2NewCard('b1-0006');
    const graded = sm2Review(before, 'good', TODAY); // learning, due today
    const other = reviewCard({ itemId: 'b1-0007' });
    const queueAfterGrade = requeueAfterGrade([before, other], graded, TODAY); // [other, graded]

    const undone = requeueAfterUndo(queueAfterGrade, before, graded, TODAY);

    expect(undone).toEqual([before, other]);
    expect(undone.length).toBe(2);
    expect(undone.some((c) => c.itemId === graded.itemId && c.state === graded.state)).toBe(false);
  });

  it('undo review után: a sor eleje "before", a többi változatlan', () => {
    const before = reviewCard({ itemId: 'b1-0008', due: TODAY });
    const graded = sm2Review(before, 'good', TODAY); // review -> due later, drops out of queue
    const other = reviewCard({ itemId: 'b1-0009' });
    const queueAfterGrade = requeueAfterGrade([before, other], graded, TODAY); // [other]

    const undone = requeueAfterUndo(queueAfterGrade, before, graded, TODAY);

    expect(undone).toEqual([before, other]);
  });
});
