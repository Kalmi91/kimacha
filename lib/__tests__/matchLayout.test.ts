// the matching drill (a) pairs the essential part (ii-match-01: only the
// verb form), (b) no pair stands in its own row in the right column.
import fs from 'fs';
import path from 'path';

import { hashString, shuffleNoFixedPoints } from '../shuffle';

type Item = { id: string; kind?: string; pairs?: { es: string; en: string }[] };

const ROOT = path.join(__dirname, '..', '..', 'data', 'games', 'grammar');

function matchItems(): Item[] {
  const out: Item[] = [];
  for (const lang of fs.readdirSync(ROOT)) {
    const dir = path.join(ROOT, lang);
    if (!fs.statSync(dir).isDirectory()) continue;
    for (const f of fs.readdirSync(dir).filter((n) => n.endsWith('.json'))) {
      const j = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) as { items?: Item[] };
      for (const it of j.items ?? []) if (it.kind === 'match') out.push(it);
    }
  }
  return out;
}

describe('match drill layout', () => {
  const items = matchItems();

  it('finds the authored match items', () => {
    expect(items.length).toBeGreaterThan(50);
  });

  it('FB442: no pair sits in its own row on the right-hand side', () => {
    for (const it of items) {
      const order = shuffleNoFixedPoints(it.pairs!.length, hashString(it.id));
      order.forEach((p, i) => expect([it.id, p === i]).toEqual([it.id, false]));
    }
  });

  it('FB441: ii-match-01 pairs the verb forms only (one Spanish word per pair)', () => {
    const it = items.find((i) => i.id === 'ii-match-01')!;
    expect(it.pairs!.length).toBeGreaterThanOrEqual(5);
    for (const p of it.pairs!) expect(p.es.trim().split(/\s+/)).toHaveLength(1);
  });
});
