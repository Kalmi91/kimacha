import {
  capSentencesToCadence,
  MAX_SENTENCES_PER_SESSION,
  rankSentencesByWordWeakness,
  sentenceSlotCount,
  type WordWeakness,
} from '../sentenceMix';

describe('sentenceSlotCount', () => {
  it('gives one sentence per four word cards', () => {
    expect(sentenceSlotCount(4)).toBe(1);
    expect(sentenceSlotCount(16)).toBe(4);
    expect(sentenceSlotCount(20)).toBe(5);
  });

  it('never goes above the FB99 ceiling of five sentences', () => {
    expect(sentenceSlotCount(24)).toBe(MAX_SENTENCES_PER_SESSION);
    expect(sentenceSlotCount(40)).toBe(MAX_SENTENCES_PER_SESSION);
    expect(sentenceSlotCount(400)).toBe(MAX_SENTENCES_PER_SESSION);
  });

  it('gives no sentence below four due words', () => {
    expect(sentenceSlotCount(0)).toBe(0);
    expect(sentenceSlotCount(3)).toBe(0);
  });

  it('never lets sentences outnumber words (FB89 flood)', () => {
    for (const words of [0, 1, 5, 9, 17, 33]) {
      expect(sentenceSlotCount(words)).toBeLessThanOrEqual(Math.ceil(words / 4));
    }
  });
});

describe('capSentencesToCadence', () => {
  const isSentence = (item: string) => item.startsWith('s');
  const queue = (words: number, sentences: number) => [
    ...Array.from({ length: words }, (_, i) => `w${i}`),
    ...Array.from({ length: sentences }, (_, i) => `s${i}`),
  ];

  it('drops the sentences the remaining words cannot carry (FB99 budget hole)', () => {
    // 3 words left after capNewWords, 12 sentences still due
    const kept = capSentencesToCadence(queue(3, 12), isSentence);
    expect(kept.filter(isSentence)).toEqual([]);
    expect(kept).toHaveLength(3);
  });

  it('keeps at most five sentences however many words are due', () => {
    const kept = capSentencesToCadence(queue(40, 12), isSentence);
    expect(kept.filter(isSentence)).toHaveLength(MAX_SENTENCES_PER_SESSION);
  });

  it('keeps the first (weakest-ranked) sentences and the word order', () => {
    const kept = capSentencesToCadence(['w0', 's0', 'w1', 's1', 'w2', 's2', 'w3'], isSentence);
    expect(kept).toEqual(['w0', 's0', 'w1', 'w2', 'w3']);
  });

  it('leaves a sentence-free queue untouched', () => {
    expect(capSentencesToCadence(queue(6, 0), isSentence)).toEqual(queue(6, 0));
  });
});

describe('rankSentencesByWordWeakness', () => {
  const weakness = new Map<number, WordWeakness>([
    [1, { lapses: 0, difficulty: 2 }],
    [2, { lapses: 5, difficulty: 1 }],
    [3, { lapses: 5, difficulty: 8 }],
    [4, { lapses: 1, difficulty: 9 }],
  ]);

  it('puts the most-failed word first', () => {
    const cards = [
      { word_id: 1, due: '2026-08-01' },
      { word_id: 2, due: '2026-08-01' },
      { word_id: 4, due: '2026-08-01' },
    ];
    expect(rankSentencesByWordWeakness(cards, weakness).map(c => c.word_id)).toEqual([2, 4, 1]);
  });

  it('breaks a lapse tie on FSRS difficulty', () => {
    const cards = [
      { word_id: 2, due: '2026-08-01' },
      { word_id: 3, due: '2026-08-01' },
    ];
    expect(rankSentencesByWordWeakness(cards, weakness).map(c => c.word_id)).toEqual([3, 2]);
  });

  it('falls back to the oldest due date, then input order', () => {
    const cards = [
      { word_id: 9, due: '2026-08-05' },
      { word_id: 8, due: '2026-08-02' },
      { word_id: 7, due: '2026-08-02' },
    ];
    expect(rankSentencesByWordWeakness(cards, weakness).map(c => c.word_id)).toEqual([8, 7, 9]);
  });

  it('treats an unknown word as the strongest, so it sinks', () => {
    const cards = [
      { word_id: 99, due: '2026-08-01' },
      { word_id: 2, due: '2026-08-09' },
    ];
    expect(rankSentencesByWordWeakness(cards, weakness).map(c => c.word_id)).toEqual([2, 99]);
  });
});
