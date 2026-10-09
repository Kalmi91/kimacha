// The pcic_cards table on the memory DB (the pattern every
// other DB-touching test in this repo follows, see lib/__tests__/gameDb.test.ts).

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

  it('a known:true card comes back as known:true', async () => {
    await db.resetPcicCards();
    const card = { ...sm2NewCard('b1-0002'), state: 'review' as const, interval: 60, due: '2026-11-17', introducedAt: '2026-09-18', known: true };
    await db.upsertPcicCard(card);
    const cards = await db.getPcicCards();
    expect(cards.find(c => c.itemId === 'b1-0002')).toEqual(card);
  });

  it('resetPcicCards gives an empty table', async () => {
    await db.upsertPcicCard(sm2NewCard('r1'));
    await db.resetPcicCards();
    expect(await db.getPcicCards()).toEqual([]);
  });

  // the pcic_cards table is not tied to a pair (the two
  // directions are told apart by the w<id>/e<id> id prefix, data/pcic.ts), so
  // switching direction (setOnboarding) on its own does not delete the progress of either direction.
  it("a direction change (setOnboarding) does not reset the other direction's cards", async () => {
    await db.resetPcicCards();
    await db.setOnboarding('en', 'es');
    await db.upsertPcicCard({ ...sm2NewCard('w1'), state: 'review', interval: 5, due: '2026-09-20', introducedAt: '2026-09-18' });

    await db.setOnboarding('es', 'en');
    await db.upsertPcicCard({ ...sm2NewCard('e1'), state: 'learning', due: '2026-09-18', introducedAt: '2026-09-18' });

    await db.setOnboarding('en', 'es');
    const cards = await db.getPcicCards();
    expect(cards.find(c => c.itemId === 'w1')?.interval).toBe(5);
    expect(cards.find(c => c.itemId === 'e1')?.state).toBe('learning');
  });

  // pcic_level moved into the per-pair row of learn_settings (it used to be a
  // user_meta singleton), so that on a direction switch both pairs keep their
  // own level.
  it("pcic_level per pair: switching back and forth keeps each direction's own level", async () => {
    await db.setOnboarding('en', 'es');
    await db.setPcicLevel('B1');
    await db.setOnboarding('es', 'en');
    await db.setPcicLevel('A1');

    await db.setOnboarding('en', 'es');
    expect(await db.getPcicLevel()).toBe('B1');
    await db.setOnboarding('es', 'en');
    expect(await db.getPcicLevel()).toBe('A1');
  });

  // The same point: hasPcicLevel is true only if the active pair
  // EXPLICITLY has a chosen level (not because of getPcicLevel's fallback);
  // this is what the Settings direction-switch row / the main tab's load() use
  // to decide whether the level-picker sheet has to be opened.
  it('hasPcicLevel: false for a pair never chosen yet, true after setPcicLevel', async () => {
    await db.setOnboarding('xx', 'yy');
    expect(await db.hasPcicLevel()).toBe(false);
    await db.setPcicLevel('A1');
    expect(await db.hasPcicLevel()).toBe(true);
  });

  // getPcicNewBonus/setPcicNewBonus round-trip, at the memory-DB level.
  it('getPcicNewBonus/setPcicNewBonus: persists (reload case) and expires with the calendar day', async () => {
    expect(await db.getPcicNewBonus('2026-09-18')).toBe(0);

    await db.setPcicNewBonus(18, '2026-09-18');
    // "Reload": querying the same day AGAIN returns the same value, it does not reset to zero.
    expect(await db.getPcicNewBonus('2026-09-18')).toBe(18);
    expect(await db.getPcicNewBonus('2026-09-18')).toBe(18);

    // Day change: yesterday's bonus does not count on the next day.
    expect(await db.getPcicNewBonus('2026-09-19')).toBe(0);
  });
});
