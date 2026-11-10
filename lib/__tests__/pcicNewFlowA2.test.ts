import { sm2NewCard, sm2Review, pickSm2Session, type Sm2Card } from '@/lib/sm2';
import { mixNewCards, requeueAfterGrade, type QueuedSm2Card } from '@/lib/pcicSession';

// FB636: A2 learner, many due reviews, 15 unseen words. A new word missed earlier today sits (after a reload)
// behind every due review and used to hold all the other new words back.
const TODAY = '2026-11-09';

function replay(reviews: number, fresh: number, missedToday: boolean, pGood = 0.9, cards = 50): number {
  let seed = 7;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const all: Sm2Card[] = [];
  for (let i = 0; i < reviews; i++) {
    all.push({ ...sm2NewCard('r' + i), state: 'review', interval: 3, due: '2026-11-01', lastReview: '2026-10-29', introducedAt: '2026-10-20', reps: 3 });
  }
  if (missedToday) {
    all.push({ ...sm2NewCard('m0'), state: 'learning', due: TODAY, lastReview: TODAY, introducedAt: TODAY, reps: 1 });
  }
  const order = Array.from({ length: fresh }, (_, i) => 'n' + i);
  let queue: QueuedSm2Card[] = mixNewCards(pickSm2Session(all, order, TODAY, 100), TODAY);
  let introduced = 0;
  const seen = new Set<string>();
  for (let n = 1; n <= cards && queue.length; n++) {
    const head = queue[0];
    if (head.state === 'new' && !seen.has(head.itemId)) {
      seen.add(head.itemId);
      introduced++;
    }
    const g = rnd() < pGood ? 'good' : 'again';
    queue = mixNewCards(requeueAfterGrade(queue, sm2Review(head, g, TODAY), TODAY, g, n * 8000, 60), TODAY);
  }
  return introduced;
}

describe('FB636 new words keep coming among many reviews', () => {
  it('A2: a missed new word at the far end does not hold back the 15 unseen words', () => {
    const n = replay(300, 15, true); expect(n).toBeGreaterThanOrEqual(10);
  });
  it('B1 regression: no missed word, same numbers as before', () => {
    expect(replay(300, 15, false)).toBeGreaterThanOrEqual(10);
  });
  it('a missed new word that is near still holds the next one back (one at a time)', () => {
    const q: QueuedSm2Card[] = [
      { ...sm2NewCard('r0'), state: 'review', interval: 3, due: '2026-11-01', introducedAt: '2026-10-20' },
      { ...sm2NewCard('m0'), state: 'learning', due: TODAY, introducedAt: TODAY },
      { ...sm2NewCard('n0') },
    ];
    expect(mixNewCards(q, TODAY).map((c) => c.itemId)).toEqual(['r0', 'm0', 'n0']);
  });
});
