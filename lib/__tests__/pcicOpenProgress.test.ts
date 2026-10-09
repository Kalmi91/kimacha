// az en→es pakli a data/words-open-re váltott
// (o<order> id-tér). A régi w<id> SRS-sorok a pcic_cards táblában maradnak
// (a haladás nem vész el), csak a betöltött korpuszban nincsenek, ezért egyik
// szint nézetében sem jelennek meg. Memory (web) DB, mint lib/__tests__/pcicDb.test.ts.

import { findPcicItem } from '@/data/pcic';
import { getDb } from '../database.web';
import { cardsForLevel } from '../pcicLevels';
import { dropOrphanCards } from '../pcicSession';
import { sm2NewCard } from '../sm2';

describe('régi w<id> haladás a words-open váltás után (PLAN-learn-words-open 3)', () => {
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

  it('a régi w<id> sor megmarad a DB-ben szint-reset után is (a reset csak a betöltött o<order> id-ket törli)', async () => {
    for (const level of ['a1', 'a2', 'b1', 'b2']) {
      await db.resetPcicCards(level);
    }

    const cards = await db.getPcicCards();
    expect(cards.find((c) => c.itemId === 'w7')).toEqual(oldCard);
    expect(cards.find((c) => c.itemId === 'o12')).toBeUndefined();
    expect(cards).toHaveLength(1);
  });

  it('a memóriás szűrés (dropOrphanCards, szint-nézetek) nem nyúl a DB-hez: w7 sehol nem jelenik meg, de megvan', async () => {
    const cards = await db.getPcicCards();

    expect(findPcicItem('w7')).toBeUndefined();
    expect(dropOrphanCards(cards, (id) => findPcicItem(id) !== undefined).map((c) => c.itemId)).toEqual(['o12']);
    for (const view of ['A1', 'A2', 'B1', 'B2'] as const) {
      expect(cardsForLevel(cards, view).map((c) => c.itemId)).toEqual(view === 'A1' ? ['o12'] : []);
    }

    expect((await db.getPcicCards()).map((c) => c.itemId).sort()).toEqual(['o12', 'w7']);
  });

  it('az o<order> id szintje a betöltött korpuszból jön (levelOfItem), nem az id-előtagból', () => {
    const cards = ['o1', 'o150', 'o151', 'o300', 'o301', 'o450', 'o451', 'o600'].map((id) => sm2NewCard(id));

    expect(cardsForLevel(cards, 'A1').map((c) => c.itemId)).toEqual(['o1', 'o150']);
    expect(cardsForLevel(cards, 'A2').map((c) => c.itemId)).toEqual(['o151', 'o300']);
    expect(cardsForLevel(cards, 'B1').map((c) => c.itemId)).toEqual(['o301', 'o450']);
    expect(cardsForLevel(cards, 'B2').map((c) => c.itemId)).toEqual(['o451', 'o600']);
  });
});
