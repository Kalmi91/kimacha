import { buildGrammarRound, wrongExplanation } from '../grammarChoice';
import { getGrammarTopics, type GrammarTopicData } from '../content';

function makeTopic(): GrammarTopicData {
  return {
    topic: 'test-topic',
    level: 'A2',
    title: { hu: 't', en: 't', es: 't', de: 't' },
    rule: { hu: 'r', en: 'r', es: 'r', de: 'r' },
    items: [
      {
        id: 'i1',
        sentence: 'Yo ___ estudiante.',
        options: ['soy', 'estoy'],
        correct: 0,
        why: { hu: 'w', en: 'w', es: 'w', de: 'w' },
        wrong: { estoy: { hu: 'x', en: 'x', es: 'x', de: 'x' } },
        examples: ['Ella es médica.'],
      },
      {
        id: 'i2',
        sentence: '___ las tres.',
        options: ['Son', 'Están'],
        correct: 0,
        why: { hu: 'w', en: 'w', es: 'w', de: 'w' },
        wrong: { Están: { hu: 'x', en: 'x', es: 'x', de: 'x' } },
        examples: ['Es la una.'],
      },
      {
        id: 'i3',
        sentence: 'La fiesta ___ aquí.',
        options: ['es', 'está'],
        correct: 0,
        why: { hu: 'w', en: 'w', es: 'w', de: 'w' },
        wrong: { está: { hu: 'x', en: 'x', es: 'x', de: 'x' } },
        examples: ['El examen es aquí.'],
      },
    ],
  };
}

describe('buildGrammarRound', () => {
  it('includes every item exactly once', () => {
    const topic = makeTopic();
    const round = buildGrammarRound(topic, 42);
    expect(round).toHaveLength(3);
    expect(new Set(round.map((r) => r.item.id))).toEqual(new Set(['i1', 'i2', 'i3']));
  });

  it('correctIndex always points at the item\'s own correct option text', () => {
    const topic = makeTopic();
    for (let seed = 0; seed < 30; seed++) {
      const round = buildGrammarRound(topic, seed);
      for (const r of round) {
        const originalCorrectText = r.item.options[r.item.correct];
        expect(r.options[r.correctIndex]).toBe(originalCorrectText);
      }
    }
  });

  it('is deterministic for a given seed', () => {
    const topic = makeTopic();
    const a = buildGrammarRound(topic, 7);
    const b = buildGrammarRound(topic, 7);
    expect(a.map((r) => r.item.id)).toEqual(b.map((r) => r.item.id));
    expect(a.map((r) => r.options)).toEqual(b.map((r) => r.options));
  });

  it('does not always place the correct option at index 0 across seeds (no position bias)', () => {
    const topic = makeTopic();
    const positions = new Set<number>();
    for (let seed = 0; seed < 30; seed++) {
      const round = buildGrammarRound(topic, seed);
      for (const r of round) positions.add(r.correctIndex);
    }
    expect(positions.size).toBeGreaterThan(1);
  });
});

describe('wrongExplanation', () => {
  it('looks up the explanation for a wrong option by its literal text', () => {
    const topic = makeTopic();
    const item = topic.items[0];
    expect(wrongExplanation(item, 'estoy', 'hu')).toBe('x');
    expect(wrongExplanation(item, 'nope', 'hu')).toBeUndefined();
  });
});

// Q1 content batch (GAMES.md 10., token-burn queue): every authored topic has
// to be complete, or the game shows a half-explained rule to the learner.
describe('authored grammar topics are complete (Q1 batch)', () => {
  const topics = getGrammarTopics('es');

  it('offers the A1 topics before the A2 ones', () => {
    expect(topics.length).toBeGreaterThanOrEqual(7);
    const firstA2 = topics.findIndex((t) => t.level === 'A2');
    const lastA1 = topics.map((t) => t.level).lastIndexOf('A1');
    expect(lastA1).toBeLessThan(firstA2);
  });

  it.each(topics.map((t) => [t.topic, t] as const))('%s: rule, items and explanations in 4 languages', (_id, topic) => {
    for (const lang of ['hu', 'en', 'es', 'de']) {
      expect(topic.title[lang]).toBeTruthy();
      expect(topic.rule[lang]).toBeTruthy();
    }
    expect(topic.items.length).toBeGreaterThanOrEqual(10);

    for (const item of topic.items) {
      // Exactly one gap, and a correct index that exists.
      expect(item.sentence.split('___')).toHaveLength(2);
      expect(item.options[item.correct]).toBeTruthy();
      expect(item.examples.length).toBeGreaterThan(0);
      for (const lang of ['hu', 'en', 'es', 'de']) {
        expect(item.why[lang]).toBeTruthy();
      }
      // Every WRONG option must say why it is wrong, in all four languages:
      // GAMES.md 4.11 promises "miért rossz a többi".
      for (const option of item.options) {
        if (option === item.options[item.correct]) continue;
        for (const lang of ['hu', 'en', 'es', 'de']) {
          expect(wrongExplanation(item, option, lang)).toBeTruthy();
        }
      }
    }
  });
});
