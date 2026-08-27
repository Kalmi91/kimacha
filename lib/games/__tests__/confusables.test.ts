import { buildDrillRound, memberFor, reversePrompt, hasListeningDrill } from '../confusables';
import type { ConfusablesSet } from '../content';

function makeSet(): ConfusablesSet {
  return {
    id: 'test-set',
    level: 'A2',
    members: [
      { word: 'sueldo', gloss: { hu: 'fizetés', en: 'salary', es: 'sueldo', de: 'Gehalt' }, examples: ['Mi sueldo es bueno.'] },
      { word: 'suelo', gloss: { hu: 'padló', en: 'floor', es: 'suelo', de: 'Boden' }, examples: ['El suelo está frío.'] },
      { word: 'suelto', gloss: { hu: 'aprópénz', en: 'loose change', es: 'suelto', de: 'Kleingeld' }, examples: ['¿Tienes suelto?'] },
    ],
    drills: [
      { type: 'gap', sentence: 'Cobro mi ___.', correct: 'sueldo' },
      { type: 'gap', sentence: 'El ___ está frío.', correct: 'suelo' },
      { type: 'reverse', correct: 'suelto' },
      { type: 'listening', sentence: 'Suelo comer a las dos.', correct: 'suelo' },
    ],
  };
}

describe('buildDrillRound', () => {
  it('includes every drill exactly once when listening is allowed', () => {
    const round = buildDrillRound(makeSet(), { allowListening: true }, 1);
    expect(round).toHaveLength(4);
  });

  it('excludes listening drills when the device has no voice (FB144 guard)', () => {
    const round = buildDrillRound(makeSet(), { allowListening: false }, 1);
    expect(round).toHaveLength(3);
    expect(round.every((r) => r.drill.type !== 'listening')).toBe(true);
  });

  it('correctIndex always points at the drill\'s own correct member word', () => {
    const set = makeSet();
    for (let seed = 0; seed < 30; seed++) {
      const round = buildDrillRound(set, { allowListening: true }, seed);
      for (const r of round) {
        expect(r.options[r.correctIndex]).toBe(r.drill.correct);
      }
    }
  });

  it('every option is one of the set\'s own members (pool rule)', () => {
    const set = makeSet();
    const memberWords = new Set(set.members.map((m) => m.word));
    const round = buildDrillRound(set, { allowListening: true }, 3);
    for (const r of round) for (const opt of r.options) expect(memberWords.has(opt)).toBe(true);
  });

  it('is deterministic for a given seed', () => {
    const set = makeSet();
    const a = buildDrillRound(set, { allowListening: true }, 9);
    const b = buildDrillRound(set, { allowListening: true }, 9);
    expect(a).toEqual(b);
  });
});

describe('memberFor', () => {
  it('finds a member by its word', () => {
    expect(memberFor(makeSet(), 'suelo')?.gloss.en).toBe('floor');
    expect(memberFor(makeSet(), 'nope')).toBeUndefined();
  });
});

describe('reversePrompt', () => {
  it('builds the prompt from the correct member\'s own gloss, not stored text', () => {
    const set = makeSet();
    const drill = set.drills.find((d) => d.type === 'reverse')!;
    expect(reversePrompt(set, drill, 'hu')).toBe('aprópénz');
    expect(reversePrompt(set, drill, 'en')).toBe('loose change');
  });

  it('falls back to english when the requested language is missing', () => {
    const set = makeSet();
    set.members[2].gloss = { en: 'loose change' } as any;
    const drill = set.drills.find((d) => d.type === 'reverse')!;
    expect(reversePrompt(set, drill, 'de')).toBe('loose change');
  });
});

describe('hasListeningDrill', () => {
  it('detects whether a set has a listening drill', () => {
    expect(hasListeningDrill(makeSet())).toBe(true);
    const noListening = { ...makeSet(), drills: makeSet().drills.filter((d) => d.type !== 'listening') };
    expect(hasListeningDrill(noListening)).toBe(false);
  });
});
