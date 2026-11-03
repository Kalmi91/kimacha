// The Sentences tab with German as the target: the learned-words gate with German forms, the grammar level of the learner
// (never a tense above it) and the cards that own a detached verb prefix.

import type { PcicItem } from '@/data/pcic';
import { setActiveSource } from '@/lib/languagePair';
import { learnerLevel, nextSentenceStep, sentenceLevel, INITIAL_CADENCE } from '@/lib/sentenceCards';
import { buildSentenceQueue } from '@/lib/sentenceTab';
import { sm2NewCard, type Sm2Card } from '@/lib/sm2';

const TODAY = '2026-10-12';

const mk = (n: number, de: string, pos: PcicItem['pos'], exampleDe: string, exampleEn: string): PcicItem => ({
  id: `d${n}`, es: de, en: de, de, kind: 'word', section: '', order: n, pos, exampleEs: exampleEn, exampleEn, exampleDe,
});

const ITEMS: PcicItem[] = [
  mk(1, 'aufstehen', 'verb', 'Ich stehe um sieben Uhr auf.', 'I get up at seven.'),
  mk(2, 'sieben', 'num', 'Es ist sieben.', 'It is seven.'),
  mk(3, 'die Uhr', 'noun', 'Die Uhr ist hier.', 'The clock is here.'),
  mk(4, 'sein', 'verb', 'Ich bin hier.', 'I am here.'),
  mk(5, 'hier', 'adv', 'Hier ist es.', 'It is here.'),
  mk(6, 'malen', 'verb', 'Ich habe die Uhr gemalt.', 'I painted the clock.'),
  mk(7, 'arbeiten', 'verb', 'Mein Vater arbeitete hier.', 'My father worked here.'),
  mk(8, 'der Vater', 'noun', 'Der Vater ist hier.', 'The father is here.'),
  mk(9, 'haben', 'verb', 'Ich habe Hunger.', 'I am hungry.'),
];
const byId = new Map(ITEMS.map((i) => [i.id, i]));
const findItem = (id: string) => byId.get(id);
const LEVELS: Record<string, string> = { d1: 'A1', d2: 'A1', d3: 'A1', d4: 'A1', d5: 'A1', d6: 'A1', d7: 'B1', d8: 'A1', d9: 'A1' };
const levelOf = (id: string) => LEVELS[id];

const learned = (item: PcicItem): Sm2Card => ({
  ...sm2NewCard(item.id), state: 'review', interval: 3, reps: 2, due: '2026-10-20', lastReview: '2026-10-09', introducedAt: '2026-10-09',
});
const queue = (ids: number[], extra: Partial<Parameters<typeof buildSentenceQueue>[0]> = {}) =>
  buildSentenceQueue({ target: 'de', cards: ids.map((n) => learned(ITEMS[n - 1])), items: ITEMS, findItem, levelOf, today: TODAY, ...extra });

beforeEach(() => setActiveSource('en'));
afterEach(() => setActiveSource(null));

describe('buildSentenceQueue, target German', () => {
  it('offers a sentence once all its words are learned, with the English prompt', () => {
    const q = queue([4, 5]);
    expect(q.map((e) => e.itemId)).toEqual(['d4', 'd5'].filter((id) => q.some((e) => e.itemId === id)));
    expect(q.find((e) => e.itemId === 'd4')).toMatchObject({ target: 'Ich bin hier.', source: 'I am here.' });
    expect(queue([4]).map((e) => e.itemId)).toEqual([]); // "hier" is not learned
  });

  it('a card owns the detached prefix form of its separable verb', () => {
    const q = queue([1, 2, 3]);
    const entry = q.find((e) => e.itemId === 'd1');
    expect(entry?.target).toBe('Ich stehe um sieben Uhr auf.');
    expect(entry?.wordIds).toEqual(expect.arrayContaining(['d1', 'd2', 'd3']));
    expect(entry?.slots.find((s) => s.id === 'd1')?.words).toEqual(expect.arrayContaining(['stehe']));
  });

  it('the grammar level: a perfect of a rarer verb needs A2 (a learned card of that level), a preterite B1', () => {
    // malen is not among the commonest A1 perfect verbs
    expect(queue([3, 6, 9]).some((e) => e.itemId === 'd6')).toBe(false);
    const a2: Record<string, string> = { ...LEVELS, d6: 'A2' };
    expect(queue([3, 6, 9], { levelOf: (id) => a2[id] }).some((e) => e.itemId === 'd6')).toBe(true);
    // a B1 card is learned: the learner is at B1, the preterite sentence of its own B1 item may come
    expect(queue([4, 5, 7, 8]).some((e) => e.itemId === 'd7')).toBe(true);
    // but not while the learner's level is still A1
    expect(queue([4, 5, 7, 8], { levelOf: (id) => (id === 'd7' ? 'A1' : LEVELS[id]) }).some((e) => e.itemId === 'd7')).toBe(false);
  });
});

describe('the learner level', () => {
  it('is the highest deck level among the learned cards, A1 at least; a sentence is held to its own item level too', () => {
    expect(learnerLevel([learned(ITEMS[0])], levelOf)).toBe('A1');
    expect(learnerLevel([learned(ITEMS[0]), learned(ITEMS[6])], levelOf)).toBe('B1');
    expect(learnerLevel([sm2NewCard('d7')], levelOf)).toBe('A1'); // not learned
    expect(learnerLevel([learned(ITEMS[0])])).toBe('A1');
    expect(sentenceLevel('B1', 'd1', levelOf)).toBe('A1');
    expect(sentenceLevel('A1', 'd7', levelOf)).toBe('A1');
    expect(sentenceLevel('B1', 'd7', levelOf)).toBe('B1');
  });

  it('the Words tab sentence card follows the same gate', () => {
    const cards = [4, 5, 6, 3, 9].map((n) => learned(ITEMS[n - 1]));
    const deps = { target: 'de' as const, cards, findItem, levelOf, vocab: () => ['hier', 'sein'] };
    // four new words, all malen: its sentence has a perfect of a verb above A1
    const run = (d: typeof deps) => {
      let state = INITIAL_CADENCE;
      let card = null as ReturnType<typeof nextSentenceStep>['card'];
      for (let i = 0; i < 4; i++) ({ state, card } = nextSentenceStep(state, 'd6', d));
      return card;
    };
    expect(run(deps)).toBeNull();
    expect(run({ ...deps, levelOf: (id) => (id === 'd6' ? 'A2' : LEVELS[id]) })?.itemId).toBe('d6');
  });
});
