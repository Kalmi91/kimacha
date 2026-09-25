// PLAN-pcic 4. lépés: pcic_cards tábla a memory DB-n (a pattern, amit minden
// más DB-érintő teszt követ ebben a repóban, lásd lib/__tests__/gameDb.test.ts).

import { getDb } from '../database.web';
import { sm2NewCard } from '../sm2';

describe('pcic_cards (memory db)', () => {
  const db = getDb();

  it('upsertPcicCard + getPcicCards round-trip', async () => {
    const card = { ...sm2NewCard('b1-0001'), state: 'learning' as const, due: '2026-09-18', introducedAt: '2026-09-18' };
    await db.upsertPcicCard(card);
    const cards = await db.getPcicCards();
    expect(cards.find(c => c.itemId === 'b1-0001')).toEqual(card);

    const updated = { ...card, state: 'review' as const, interval: 1, due: '2026-09-19' };
    await db.upsertPcicCard(updated);
    const cards2 = await db.getPcicCards();
    expect(cards2.filter(c => c.itemId === 'b1-0001').length).toBe(1);
    expect(cards2.find(c => c.itemId === 'b1-0001')).toEqual(updated);
  });

  it('SZ3: known:true kártya known:true-ként jön vissza', async () => {
    await db.resetPcicCards();
    const card = { ...sm2NewCard('b1-0002'), state: 'review' as const, interval: 60, due: '2026-11-17', introducedAt: '2026-09-18', known: true };
    await db.upsertPcicCard(card);
    const cards = await db.getPcicCards();
    expect(cards.find(c => c.itemId === 'b1-0002')).toEqual(card);
  });

  it('getPcicStats számol total/newIntroducedToday/dueToday/learned', async () => {
    await db.resetPcicCards();
    await db.upsertPcicCard({ ...sm2NewCard('s1'), state: 'review', interval: 25, due: '2026-09-18', introducedAt: '2026-08-01' });
    await db.upsertPcicCard({ ...sm2NewCard('s2'), state: 'review', interval: 5, due: '2026-09-20', introducedAt: '2026-08-01' });
    await db.upsertPcicCard({ ...sm2NewCard('s3'), state: 'learning', due: '2026-09-18', introducedAt: '2026-09-18' });

    const stats = await db.getPcicStats('2026-09-18');
    expect(stats.total).toBe(3);
    expect(stats.newIntroducedToday).toBe(1);
    expect(stats.dueToday).toBe(2); // s1 (review, due today) + s3 (learning, due today)
    expect(stats.learned).toBe(1); // s1: review + interval >= 21
  });

  it('resetPcicCards üres táblát ad', async () => {
    await db.upsertPcicCard(sm2NewCard('r1'));
    await db.resetPcicCards();
    expect(await db.getPcicCards()).toEqual([]);
    expect((await db.getPcicStats('2026-09-18')).total).toBe(0);
  });

  // FB385/386: getPcicNewBonus/setPcicNewBonus round-trip, memory-DB szinten.
  it('getPcicNewBonus/setPcicNewBonus: perzisztál (reload-eset) és naptári nappal lejár', async () => {
    expect(await db.getPcicNewBonus('2026-09-18')).toBe(0);

    await db.setPcicNewBonus(18, '2026-09-18');
    // "Reload": ugyanarra a napra ÚJRA lekérdezve ugyanaz jön, nem nullázódik.
    expect(await db.getPcicNewBonus('2026-09-18')).toBe(18);
    expect(await db.getPcicNewBonus('2026-09-18')).toBe(18);

    // Nap-váltás: a tegnapi bónusz nem számít a következő napon.
    expect(await db.getPcicNewBonus('2026-09-19')).toBe(0);
  });
});
