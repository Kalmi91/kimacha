// PLAN-hibaim.md 2. lépés (deck.ts teszt): kártya-építés a mintafájlból,
// session-választás és az előre kijelölt értékelés.

import sample from './__fixtures__/sample.json';
import { validateMistakesPayload } from './format';
import { cardsForBatch, pickMistakeSession, suggestedMistakeGrade } from './deck';
import { sm2NewCard } from '../sm2';

function batch() {
  const result = validateMistakesPayload(sample);
  if (!result.ok) throw new Error(result.error);
  return result.batch;
}

describe('cardsForBatch', () => {
  it('builds sentence/word/drill cards with the id scheme from PLAN-hibaim.md, skipping doubtful sentences', () => {
    const cards = cardsForBatch(batch());

    // 3 sentences in the fixture, 1 doubtful (s3) -> only 2 sentence cards.
    const sentenceCards = cards.filter((c) => c.kind === 'sentence');
    expect(sentenceCards.map((c) => c.cardId)).toEqual([
      '2026-09-23-sample:s:s1',
      '2026-09-23-sample:s:s2',
    ]);

    const wordCards = cards.filter((c) => c.kind === 'word');
    expect(wordCards.map((c) => c.cardId)).toEqual([
      '2026-09-23-sample:w:w1',
      '2026-09-23-sample:w:w2',
    ]);

    const drillCards = cards.filter((c) => c.kind === 'drill');
    expect(drillCards.map((c) => c.cardId)).toEqual([
      '2026-09-23-sample:d:yo-form:d1',
      '2026-09-23-sample:d:ser-estar:d1',
      '2026-09-23-sample:d:ser-estar:d2',
    ]);
  });

  it('resolves the sentence/drill patternRule from the pattern, carries the old wrong sentence', () => {
    const cards = cardsForBatch(batch());
    const s2 = cards.find((c) => c.cardId === '2026-09-23-sample:s:s2')!;
    expect(s2.prompt).toBe("That's fine.");
    expect(s2.answer).toBe('Eso está bien.');
    expect(s2.wrong).toBe('Eso es bien.');
    expect(s2.patternRule).toBe('A temporary state or condition uses estar, not ser: está bien, estoy confundido.');

    const word = cards.find((c) => c.cardId === '2026-09-23-sample:w:w1')!;
    expect(word.wrong).toBeUndefined();
    expect(word.patternRule).toBeUndefined();

    const drill = cards.find((c) => c.cardId === '2026-09-23-sample:d:yo-form:d1')!;
    expect(drill.promptEn).toBe("But I don't have tomato.");
  });
});

describe('pickMistakeSession', () => {
  it('with no progress yet, every card is new (capped at newLimit)', () => {
    const cards = cardsForBatch(batch());
    const session = pickMistakeSession([], cards, '2026-09-23', 2);
    expect(session).toHaveLength(2);
    expect(session.every((c) => c.state === 'new')).toBe(true);
  });

  it('a due review card comes before new cards', () => {
    const cards = cardsForBatch(batch());
    const dueCard = { ...sm2NewCard(cards[0].cardId), state: 'review' as const, due: '2026-09-23' };
    const session = pickMistakeSession([dueCard], cards, '2026-09-23', 20);
    expect(session[0].itemId).toBe(cards[0].cardId);
  });
});

describe('suggestedMistakeGrade', () => {
  it('picks "good" on an exact match', () => {
    expect(suggestedMistakeGrade('Eso está bien.', 'Eso está bien.')).toBe('good');
    // FB132-style accent forgiveness stays the default (strictAccents off).
    expect(suggestedMistakeGrade('esta bien', 'está bien')).toBe('good');
  });

  it('picks "again" on a wrong or empty answer', () => {
    expect(suggestedMistakeGrade('Eso es bien.', 'Eso está bien.')).toBe('again');
    expect(suggestedMistakeGrade('', 'Eso está bien.')).toBe('again');
  });
});
