import { buildMythRound } from '../myth';
import type { MythItem } from '../content';

function makeItems(): MythItem[] {
  const tracks: MythItem['track'][] = ['common', 'body', 'mexico', 'language'];
  const items: MythItem[] = [];
  let n = 0;
  for (const track of tracks) {
    for (let i = 0; i < 5; i++) {
      n++;
      items.push({
        id: `${track}-${i}`,
        level: 'A1',
        track,
        claim: { es: `Claim ${n}` },
        verdict: n % 2 === 0 ? 'true' : 'myth',
        explanation: { hu: 'x', en: 'x', es: 'x', de: 'x' },
        source: { label: 'Test' },
      });
    }
  }
  return items;
}

describe('buildMythRound', () => {
  it('only includes items from enabled tracks', () => {
    const items = makeItems();
    const round = buildMythRound(items, ['body'], undefined, 1);
    expect(round.length).toBe(5);
    expect(round.every((i) => i.track === 'body')).toBe(true);
  });

  it('includes every enabled-track item exactly once when length is undefined (endless)', () => {
    const items = makeItems();
    const round = buildMythRound(items, ['common', 'mexico'], undefined, 2);
    expect(round.length).toBe(10);
    expect(new Set(round.map((i) => i.id)).size).toBe(10);
  });

  it('caps the round at the given length', () => {
    const items = makeItems();
    const round = buildMythRound(items, ['common', 'body', 'mexico', 'language'], 10, 3);
    expect(round.length).toBe(10);
  });

  it('does not exceed the pool size when length is larger than the pool', () => {
    const items = makeItems();
    const round = buildMythRound(items, ['body'], 20, 4);
    expect(round.length).toBe(5);
  });

  it('is deterministic for a given seed', () => {
    const items = makeItems();
    const a = buildMythRound(items, ['common', 'body', 'mexico', 'language'], 10, 42);
    const b = buildMythRound(items, ['common', 'body', 'mexico', 'language'], 10, 42);
    expect(a.map((i) => i.id)).toEqual(b.map((i) => i.id));
  });

  it('returns an empty array when no tracks are enabled', () => {
    const items = makeItems();
    const round = buildMythRound(items, [], 10, 1);
    expect(round).toEqual([]);
  });
});
