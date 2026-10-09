// mistake_batches + mistake_cards on the memory DB, following the
// pattern of pcicDb.test.ts (see its header).

import { getDb } from '../database.web';
import { sm2NewCard } from '../sm2';

describe('mistake_batches + mistake_cards (memory db)', () => {
  const db = getDb();

  it('saveMistakeBatch + getMistakeBatches round-trip, same batchId replaces the content', async () => {
    await db.saveMistakeBatch('2026-09-23-claude', '{"a":1}', '2026-09-23T10:00:00.000Z');
    await db.saveMistakeBatch('2026-09-24-claude', '{"a":2}', '2026-09-24T10:00:00.000Z');
    let batches = await db.getMistakeBatches();
    expect(batches.map((b) => b.batchId)).toEqual(['2026-09-24-claude', '2026-09-23-claude']);

    await db.saveMistakeBatch('2026-09-23-claude', '{"a":3}', '2026-09-25T10:00:00.000Z');
    batches = await db.getMistakeBatches();
    expect(batches).toHaveLength(2);
    expect(batches.find((b) => b.batchId === '2026-09-23-claude')?.json).toBe('{"a":3}');
  });

  it('upsertMistakeCard + getMistakeCards round-trip', async () => {
    const card = { ...sm2NewCard('2026-09-23-claude:w:w1'), state: 'learning' as const, due: '2026-09-23', introducedAt: '2026-09-23' };
    await db.upsertMistakeCard(card);
    const cards = await db.getMistakeCards();
    expect(cards.find((c) => c.itemId === '2026-09-23-claude:w:w1')).toEqual(card);

    const updated = { ...card, state: 'review' as const, interval: 1, due: '2026-09-24' };
    await db.upsertMistakeCard(updated);
    const cards2 = await db.getMistakeCards();
    expect(cards2.filter((c) => c.itemId === '2026-09-23-claude:w:w1')).toHaveLength(1);
    expect(cards2.find((c) => c.itemId === '2026-09-23-claude:w:w1')).toEqual(updated);
  });
});
