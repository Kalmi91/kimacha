import { findPcicItem, pcicItemsForViewLevel, setPcicTarget, type PcicItem, type PcicTarget } from '@/data/pcic';
import { resetFormIndex } from '../grammar/tenseGate';
import { unknownTokens } from '../knownSentence';
import {
  INITIAL_CADENCE,
  NEW_WORDS_PER_SENTENCE,
  learnedEntries,
  nextSentenceStep,
  stripSentencePunct,
  tileWords,
  type CadenceState,
  type SentenceDeps,
} from '../sentenceCards';
import type { Sm2Card } from '../sm2';

beforeEach(() => resetFormIndex());
afterAll(() => setPcicTarget('es'));

function card(itemId: string, over: Partial<Sm2Card> = {}): Sm2Card {
  return {
    itemId,
    state: 'review',
    step: 0,
    ease: 2.5,
    interval: 1,
    reps: 1,
    lapses: 0,
    due: '',
    lastReview: null,
    introducedAt: null,
    ...over,
  };
}

function item(id: string, es: string, en: string, exampleEs?: string, exampleEn?: string): PcicItem {
  return { id, es, en, kind: 'word', section: 'test', order: 0, exampleEs, exampleEn };
}

const ITEMS: PcicItem[] = [
  item('w1', 'el libro', 'the book', 'El libro y la mesa.', 'The book and the table.'),
  item('w2', 'la mesa', 'the table', 'La mesa y el libro.', 'The table and the book.'),
  item('w3', 'el gato', 'the cat', 'El gato y el perro.', 'The cat and the dog.'),
  item('w4', 'la casa', 'the house', 'La casa y la mesa.', 'The house and the table.'),
  item('w5', 'el perro', 'the dog'),
  item('w6', 'la silla', 'the chair', 'La silla y la mesa.', 'The chair and the table.'),
  item('w7', 'el vaso', 'the glass', 'El vaso y la casa.', 'The glass and the house.'),
  item('w8', 'la luz', 'the light', 'La luz y el vaso.', 'The light and the glass.'),
];
const BY_ID = new Map(ITEMS.map((i) => [i.id, i]));

function deps(learnedIds: string[], over: Partial<SentenceDeps> = {}): SentenceDeps {
  return {
    target: 'es',
    cards: learnedIds.map((id) => card(id)),
    findItem: (id) => BY_ID.get(id),
    vocab: () => ITEMS.map((i) => i.es),
    ...over,
  };
}

function feed(state: CadenceState, ids: string[], d: SentenceDeps) {
  let cur = state;
  let last: ReturnType<typeof nextSentenceStep> = { state, card: null };
  for (const id of ids) {
    last = nextSentenceStep(cur, id, d);
    cur = last.state;
  }
  return last;
}

describe('stripSentencePunct / tileWords', () => {
  it('strips punctuation and collapses spaces', () => {
    expect(stripSentencePunct('¿Dónde  está el libro?')).toBe('Dónde está el libro');
  });

  it('lowercases only the first tile and drops punctuation', () => {
    expect(tileWords('El libro, Ana.')).toEqual(['el', 'libro', 'Ana']);
  });
});

describe('learnedEntries', () => {
  it('keeps only learned cards whose item exists, with the target-language form', () => {
    const entries = learnedEntries(
      [card('w1'), card('w2', { state: 'new' }), card('w3', { state: 'learning', lapses: 1 }), card('nope')],
      'es',
      (id) => BY_ID.get(id),
    );
    expect(entries.map((e) => e.text)).toEqual(['el libro', 'el gato']);
  });

  it('uses the English form for the es to en direction', () => {
    const entries = learnedEntries([card('w1')], 'en', (id) => BY_ID.get(id));
    expect(entries.map((e) => e.text)).toEqual(['the book']);
  });
});

describe('nextSentenceStep cadence', () => {
  const D = deps(['w1', 'w2', 'w3', 'w4', 'w6', 'w7', 'w8']);

  it('produces no card before the 4th new word', () => {
    const r = feed(INITIAL_CADENCE, ['w1', 'w2', 'w3'], D);
    expect(r.card).toBeNull();
    expect(r.state.recent).toEqual(['w1', 'w2', 'w3']);
    expect(NEW_WORDS_PER_SENTENCE).toBe(4);
  });

  it('gives a tile card on the 4th new word, from a group word that passes the gate', () => {
    const r = feed(INITIAL_CADENCE, ['w1', 'w2', 'w3', 'w4'], D);
    expect(r.card?.kind).toBe('tiles');
    // w1 passes: libro and mesa are both learned
    expect(r.card?.itemId).toBe('w1');
    expect(r.card?.target).toBe('El libro y la mesa.');
    expect(r.card?.source).toBe('The book and the table.');
    if (r.card?.kind === 'tiles') {
      expect(r.card.targetWords).toEqual(['el', 'libro', 'y', 'la', 'mesa']);
      expect(r.card.trapWords.length).toBeLessThanOrEqual(3);
      for (const w of r.card.trapWords) expect(r.card.targetWords).not.toContain(w.toLowerCase());
    }
    expect(r.state.recent).toEqual([]);
  });

  it('alternates: tile card, then a typing card, then a tile card again', () => {
    const first = feed(INITIAL_CADENCE, ['w1', 'w2', 'w3', 'w4'], D);
    const second = feed(first.state, ['w6', 'w7', 'w8', 'w1'], D);
    expect(second.card?.kind).toBe('typing');
    const third = feed(second.state, ['w1', 'w2', 'w4', 'w6'], D);
    expect(third.card?.kind).toBe('tiles');
  });

  it('skips a group word with no example and takes the next passing one', () => {
    const r = feed(INITIAL_CADENCE, ['w5', 'w6', 'w7', 'w8'], D);
    expect(r.card?.itemId).toBe('w6');
  });

  it('gives no card and resets the counter when no sentence passes the gate; next kind stays', () => {
    const d = deps(['w5']);
    const r = feed({ recent: [], next: 'typing' }, ['w1', 'w2', 'w3', 'w4'], d);
    expect(r.card).toBeNull();
    expect(r.state).toEqual({ recent: [], next: 'typing' });
  });

  it('does not count review cards: only the ids passed in advance the counter', () => {
    const r = nextSentenceStep(INITIAL_CADENCE, 'w1', D);
    expect(r.state.recent).toEqual(['w1']);
  });
});

describe('real corpus: a produced sentence never has an unknown word', () => {
  const cases: { target: PcicTarget; levels: ('A1' | 'A2')[] }[] = [
    { target: 'es', levels: ['A1'] },
    { target: 'en', levels: ['A1'] },
  ];

  for (const { target, levels } of cases) {
    it(`${target}: every card from a full deck walk-through passes the gate`, () => {
      setPcicTarget(target);
      resetFormIndex();
      const order = levels.flatMap((l) => pcicItemsForViewLevel(l)).map((i) => i.id);
      const learned = new Map<string, Sm2Card>();
      let state = INITIAL_CADENCE;
      let produced = 0;
      for (const id of order) {
        learned.set(id, card(id));
        const d: SentenceDeps = {
          target,
          cards: learned.values(),
          findItem: findPcicItem,
          vocab: () => order.map((i) => findPcicItem(i)?.[target] ?? ''),
        };
        const r = nextSentenceStep(state, id, d);
        state = r.state;
        if (r.card) {
          produced += 1;
          const ctx = { learned: learnedEntries(learned.values(), target, findPcicItem) };
          expect(unknownTokens(r.card.target, target, ctx)).toEqual([]);
        }
      }
      // es: the walk-through must yield cards. en: the invariant above is all
      // that is required (the English free-word list is deliberately small).
      if (target === 'es') expect(produced).toBeGreaterThan(0);
    });
  }
});
