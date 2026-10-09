import { buildGrammarRound, isChoiceRoundItem, wrongExplanation } from '../grammarChoice';
import { getGrammarTopics, isMarkItem, type GrammarGapItem, type GrammarTopicData } from '../content';

function makeTopic(): GrammarTopicData {
  return {
    schema: 2,
    topic: 'test-topic',
    level: 'A2',
    title: { hu: 't', en: 't', es: 't', de: 't' },
    body: [],
    speak: { hu: 's', en: 's', es: 's', de: 's' },
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
      const round = buildGrammarRound(topic, seed).filter(isChoiceRoundItem);
      for (const r of round) {
        if (isMarkItem(r.item)) continue;
        const originalCorrectText = r.item.options[r.item.correct];
        expect(r.options[r.correctIndex]).toBe(originalCorrectText);
      }
    }
  });

  it('is deterministic for a given seed', () => {
    const topic = makeTopic();
    const a = buildGrammarRound(topic, 7).filter(isChoiceRoundItem);
    const b = buildGrammarRound(topic, 7).filter(isChoiceRoundItem);
    expect(a.map((r) => r.item.id)).toEqual(b.map((r) => r.item.id));
    expect(a.map((r) => r.options)).toEqual(b.map((r) => r.options));
  });

  it('does not always place the correct option at index 0 across seeds (no position bias)', () => {
    const topic = makeTopic();
    const positions = new Set<number>();
    for (let seed = 0; seed < 30; seed++) {
      const round = buildGrammarRound(topic, seed).filter(isChoiceRoundItem);
      for (const r of round) positions.add(r.correctIndex);
    }
    expect(positions.size).toBeGreaterThan(1);
  });
});

describe('wrongExplanation', () => {
  it('looks up the explanation for a wrong option by its literal text', () => {
    const topic = makeTopic();
    const item = topic.items[0] as GrammarGapItem;
    expect(wrongExplanation(item, 'estoy', 'hu')).toBe('x');
    expect(wrongExplanation(item, 'nope', 'hu')).toBeUndefined();
  });
});

describe('authored grammar topics', () => {
  const topics = getGrammarTopics('es');

  it('offers the A1 topics before the A2 ones', () => {
    expect(topics.length).toBeGreaterThanOrEqual(7);
    const firstA2 = topics.findIndex((t) => t.level === 'A2');
    const lastA1 = topics.map((t) => t.level).lastIndexOf('A1');
    expect(lastA1).toBeLessThan(firstA2);
  });
});
