// UTEMEZO 8: a "Nehézség" ablak DB-oldala, P (hand_cap) és R (gap_laps), és a
// régi FB198-tárcsa (easy/normal/hard) egyszeri áthozatala gap_laps-ba. A
// natív oldal (lib/database.ts) ugyanezt a logikát futtatja SQL felett; itt a
// memória-ikret teszteljük, a repó DB-tesztjeinek szokott mintája szerint
// (lásd lib/__tests__/gameDb.test.ts).

import { getDb } from '../database.web';

describe('difficulty window: hand cap + gap laps (memory db)', () => {
  const db = getDb() as any;

  it('defaults to 5 for both P and R', async () => {
    await db.setOnboarding('hu', 'es');
    expect(await db.getHandCap()).toBe(5);
    expect(await db.getGapLaps()).toBe(5);
  });

  it('clamps the hand cap to 1-10', async () => {
    await db.setHandCap(0);
    expect(await db.getHandCap()).toBe(1);
    await db.setHandCap(99);
    expect(await db.getHandCap()).toBe(10);
  });

  it('clamps the gap laps to 1-30', async () => {
    await db.setGapLaps(0);
    expect(await db.getGapLaps()).toBe(1);
    await db.setGapLaps(99);
    expect(await db.getGapLaps()).toBe(30);
  });

  it('carries the old FB198 dial into gap_laps once, then persists it', async () => {
    // Friss pár, ahol még sem gap_laps, sem requeue_level nincs beírva.
    await db.setOnboarding('en', 'es');
    db.__setRequeueLevelForTest('normal');
    expect(await db.getGapLaps()).toBe(12);
    // Az áthozatal után a régi tárcsa értéke már nem számít, gap_laps a forrás.
    db.__setRequeueLevelForTest('hard');
    expect(await db.getGapLaps()).toBe(12);
  });
});
