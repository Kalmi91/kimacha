// The en→es deck switched to data/words-open
// (o<order> id space). The old w<id> SRS rows stay in the pcic_cards table
// (progress is not lost), they are just not in the loaded corpus, so they do not
// appear in any level's view. Memory (web) DB, like lib/__tests__/pcicDb.test.ts.

import { findPcicItem } from '@/data/pcic';
import { getDb } from '../database.web';
import { cardsForLevel } from '../pcicLevels';
import { dropOrphanCards } from '../pcicSession';
import { sm2NewCard } from '../sm2';

describe('old w<id> progress after the words-open switch', () => {
  const db = getDb();
  const oldCard = {
    ...sm2NewCard('w7'),
    state: 'review' as const,
    interval: 30,
    reps: 5,
    due: '2026-11-01',
    introducedAt: '2026-09-01',
  };

  beforeEach(async () => {
    await db.resetPcicCards();
    await db.upsertPcicCard(oldCard);
    await db.upsertPcicCard({ ...sm2NewCard('o12'), state: 'learning', due: '2026-10-01', introducedAt: '2026-10-01' });
  });

  it('the old w<id> row stays in the DB even after a level reset (the reset deletes only the loaded o<order> ids)', async () => {
    for (const level of ['a1', 'a2', 'b1', 'b2', 'c1']) {
      await db.resetPcicCards(level);
    }

    const cards = await db.getPcicCards();
    expect(cards.find((c) => c.itemId === 'w7')).toEqual(oldCard);
    expect(cards.find((c) => c.itemId === 'o12')).toBeUndefined();
    expect(cards).toHaveLength(1);
  });

  it('the in-memory filtering (dropOrphanCards, level views) does not touch the DB: w7 shows nowhere, but it exists', async () => {
    const cards = await db.getPcicCards();

    expect(findPcicItem('w7')).toBeUndefined();
    expect(dropOrphanCards(cards, (id) => findPcicItem(id) !== undefined).map((c) => c.itemId)).toEqual(['o12']);
    for (const view of ['A1', 'A2', 'B1', 'B2', 'C1'] as const) {
      expect(cardsForLevel(cards, view).map((c) => c.itemId)).toEqual(view === 'A1' ? ['o12'] : []);
    }

    expect((await db.getPcicCards()).map((c) => c.itemId).sort()).toEqual(['o12', 'w7']);
  });

  it('the level of an o<order> id comes from the loaded corpus (levelOfItem), not from the id prefix', () => {
    const cards = ['o1', 'o150', 'o151', 'o300', 'o301', 'o450', 'o451', 'o600', 'o1357', 'o3837'].map((id) => sm2NewCard(id));

    expect(cardsForLevel(cards, 'A1').map((c) => c.itemId)).toEqual(['o1', 'o150']);
    expect(cardsForLevel(cards, 'A2').map((c) => c.itemId)).toEqual(['o151', 'o300']);
    expect(cardsForLevel(cards, 'B1').map((c) => c.itemId)).toEqual(['o301', 'o450']);
    expect(cardsForLevel(cards, 'B2').map((c) => c.itemId)).toEqual(['o451', 'o600']);
    expect(cardsForLevel(cards, 'C1').map((c) => c.itemId)).toEqual(['o1357', 'o3837']);
  });
});
