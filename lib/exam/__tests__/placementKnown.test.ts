// A word answered correctly in the placement test is
// graduated (SM-2 review, with the normal first interval), a wrong or skipped one does not change.

import { sm2NewCard, type Sm2Card } from '@/lib/sm2';
import { getDb } from '../../database.web';
import { graduateKnownWords, saveKnownWords } from '../placementKnown';

const TODAY = '2026-10-01';

describe('graduateKnownWords', () => {
  it('az új kártya review lesz, a normál első intervallummal (1 nap)', () => {
    const [card] = graduateKnownWords(['o1'], [], TODAY);
    expect(card).toMatchObject({ itemId: 'o1', state: 'review', interval: 1, due: '2026-10-02', lastReview: TODAY, introducedAt: TODAY });
  });

  it('a tanulás alatti (learning) kártya is graduál', () => {
    const learning: Sm2Card = { ...sm2NewCard('o2'), state: 'learning', step: 0, reps: 1, introducedAt: '2026-09-30', due: TODAY };
    const [card] = graduateKnownWords(['o2'], [learning], TODAY);
    expect(card).toMatchObject({ itemId: 'o2', state: 'review', interval: 1, introducedAt: '2026-09-30' });
  });

  it('a már review kártyához nem nyúl (a meglévő ütemezés többet tud)', () => {
    const review: Sm2Card = { ...sm2NewCard('o3'), state: 'review', interval: 12, due: '2026-10-10', reps: 4 };
    expect(graduateKnownWords(['o3'], [review], TODAY)).toEqual([]);
  });

  it('csak a megadott (helyes) szavakat adja, ismétlődés nélkül', () => {
    const cards = graduateKnownWords(['o4', 'o5', 'o4'], [], TODAY);
    expect(cards.map((c) => c.itemId)).toEqual(['o4', 'o5']);
  });
});

describe('saveKnownWords (memory db)', () => {
  const db = getDb();

  it('a helyes szó kártyája review lesz, a hibás szóé nem keletkezik, a másik kártya nem változik', async () => {
    const other: Sm2Card = { ...sm2NewCard('o20'), state: 'learning', step: 0, reps: 2, due: TODAY, introducedAt: TODAY };
    await db.upsertPcicCard(other);

    const n = await saveKnownWords(db, ['o10', 'o11'], TODAY);

    const cards = await db.getPcicCards();
    const byId = new Map(cards.map((c) => [c.itemId, c]));
    expect(n).toBe(2);
    expect(byId.get('o10')).toMatchObject({ state: 'review', interval: 1 });
    expect(byId.get('o11')).toMatchObject({ state: 'review', interval: 1 });
    // A word answered wrongly ('o12') is not in the list: no card is created.
    expect(byId.has('o12')).toBe(false);
    expect(byId.get('o20')).toMatchObject({ state: 'learning', reps: 2 });
  });

  it('újra lefuttatva ugyanaz (a review kártya nem íródik át)', async () => {
    await saveKnownWords(db, ['o10'], '2026-10-05');
    const card = (await db.getPcicCards()).find((c) => c.itemId === 'o10');
    expect(card).toMatchObject({ state: 'review', lastReview: TODAY, due: '2026-10-02' });
    expect(await saveKnownWords(db, ['o10'], '2026-10-05')).toBe(0);
  });
});
