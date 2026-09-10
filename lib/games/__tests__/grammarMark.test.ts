import { markAnswerIndex, markTokens } from '../grammarMark';
import { buildGrammarRound } from '../grammarChoice';
import type { GrammarMarkItem, GrammarTopicData } from '../content';

function markItem(over: Partial<GrammarMarkItem> = {}): GrammarMarkItem {
  return {
    id: 'm1',
    kind: 'mark',
    sentence: 'Mi hermana come una manzana.',
    target: 'verb',
    answer: 'come',
    why: { hu: 'w', en: 'w', es: 'w', de: 'w' },
    wrong: {},
    examples: ['El niño lee un libro.'],
    ...over,
  };
}

describe('markTokens', () => {
  it('keeps words and punctuation apart, in order', () => {
    expect(markTokens('El perro come.').map((t) => t.text)).toEqual(['El', ' ', 'perro', ' ', 'come', '.']);
    expect(markTokens('El perro come.').filter((t) => t.isWord).map((t) => t.text)).toEqual([
      'El',
      'perro',
      'come',
    ]);
  });

  it('leaves the opening question mark outside the word', () => {
    expect(markTokens('¿Qué haces?').filter((t) => t.isWord).map((t) => t.text)).toEqual(['Qué', 'haces']);
  });

  it('keeps accents and ñ inside the word', () => {
    expect(markTokens('El niño está frío.').filter((t) => t.isWord).map((t) => t.text)).toEqual([
      'El',
      'niño',
      'está',
      'frío',
    ]);
  });

  it('rebuilds the sentence exactly', () => {
    const sentence = '¿Dónde está mi hermana, la pequeña?';
    expect(markTokens(sentence).map((t) => t.text).join('')).toBe(sentence);
  });
});

describe('markAnswerIndex', () => {
  it('finds the answer regardless of case', () => {
    const item = markItem({ sentence: 'Come pan.', answer: 'come' });
    const tokens = markTokens(item.sentence);
    expect(tokens[markAnswerIndex(item, tokens)].text).toBe('Come');
  });

  it('picks the requested occurrence when the word repeats', () => {
    const item = markItem({ sentence: 'El perro y el gato.', answer: 'el', answerIndex: 1, target: 'article' });
    const tokens = markTokens(item.sentence);
    const idx = markAnswerIndex(item, tokens);
    expect(tokens[idx].text).toBe('el');
    // ...and it is the SECOND article, not the first.
    expect(tokens.slice(0, idx).filter((t) => t.isWord && t.text.toLowerCase() === 'el')).toHaveLength(1);
  });

  it('returns -1 when the answer is not in the sentence', () => {
    const item = markItem({ answer: 'bebe' });
    expect(markAnswerIndex(item, markTokens(item.sentence))).toBe(-1);
  });
});

describe('buildGrammarRound with a mark item', () => {
  const topic = (item: GrammarMarkItem): GrammarTopicData => ({
    topic: 'test',
    level: 'A1',
    title: { hu: 't', en: 't', es: 't', de: 't' },
    rule: { hu: 'r', en: 'r', es: 'r', de: 'r' },
    items: [item],
  });

  it('offers the sentence words in reading order, not shuffled', () => {
    const round = buildGrammarRound(topic(markItem()), 7);
    expect(round[0].options).toEqual(['Mi', 'hermana', 'come', 'una', 'manzana']);
  });

  it('points correctIndex at the word to tap', () => {
    for (let seed = 0; seed < 10; seed++) {
      const round = buildGrammarRound(topic(markItem()), seed);
      expect(round[0].options[round[0].correctIndex]).toBe('come');
    }
  });

  it('reports -1 rather than a wrong word when the answer is missing', () => {
    const round = buildGrammarRound(topic(markItem({ answer: 'bebe' })), 3);
    expect(round[0].correctIndex).toBe(-1);
  });
});
