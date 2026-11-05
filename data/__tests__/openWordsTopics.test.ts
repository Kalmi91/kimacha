// data/words-open/topics-a1.json: every A1 Spanish card has a topic, and the topic is one of data/topics/en
// (the reading round takes the five words of one topic, lib/practice/reading.ts).
import topics from '../words-open/topics-a1.json';
import openA1 from '../words-open/a1.json';
import a0 from '../topics/en/a0.json';
import a1 from '../topics/en/a1.json';
import a2 from '../topics/en/a2.json';
import b1 from '../topics/en/b1.json';
import b2 from '../topics/en/b2.json';
import c1 from '../topics/en/c1.json';
import { findPcicItem, setPcicTarget } from '../pcic';

const IDS = new Set([...a0, ...a1, ...a2, ...b1, ...b2, ...c1].map((t) => t.id));
const map = topics as Record<string, string>;

describe('data/words-open/topics-a1.json', () => {
  afterEach(() => setPcicTarget('es'));

  it('every A1 card has a topic, and there is no key without a card', () => {
    const keys = new Set(openA1.map((w) => `o${w.order}`));
    expect(openA1.filter((w) => !map[`o${w.order}`]).map((w) => w.es)).toEqual([]);
    expect(Object.keys(map).filter((k) => !keys.has(k))).toEqual([]);
  });

  it('every topic is a topic id of data/topics/en', () => {
    expect([...new Set(Object.values(map))].filter((t) => !IDS.has(t))).toEqual([]);
  });

  it('PcicItem.topic brings it', () => {
    setPcicTarget('es');
    expect(findPcicItem('o19')?.topic).toBe('house');
  });
});
