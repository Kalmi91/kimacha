// Every card of the Hungarian deck (data/words/hu, A0-C1) carries its example sentence in three languages, and the
// Spanish and English ones must really be Spanish and English: a Hungarian sentence copied into sentence_es / sentence_en
// (it happened to 320 A1 cards) would show Hungarian under a Spanish or English prompt.

type HuFileCard = { id: number; level: string; sentence_es: string; sentence_hu: string; sentence_en: string };

const LEVEL_FILES = ['a0', 'a1', 'a2', 'b1', 'b2', 'c1'];
const cards: HuFileCard[] = LEVEL_FILES.flatMap((file) => require(`@/data/words/hu/${file}.json`) as HuFileCard[]);

// ő and ű exist in Hungarian only (not in Spanish, not in English); ö neither in Spanish.
const HUNGARIAN_ONLY = /[őűŐŰ]/;

describe('the example sentences of the Hungarian deck are in their own language', () => {
  it('has all six level files', () => {
    expect([...new Set(cards.map((c) => c.level))]).toEqual(['A0', 'A1', 'A2', 'B1', 'B2', 'C1']);
  });

  it('sentence_es is not the Hungarian sentence and has no Hungarian-only letter', () => {
    const wrong = cards.filter(
      (c) => !c.sentence_es.trim() || c.sentence_es.trim() === c.sentence_hu.trim() || HUNGARIAN_ONLY.test(c.sentence_es) || /[öÖ]/.test(c.sentence_es),
    );
    expect(wrong.map((c) => `${c.id} ${c.sentence_es}`)).toEqual([]);
  });

  it('sentence_en is not the Hungarian sentence and has no Hungarian-only letter', () => {
    const wrong = cards.filter(
      (c) => !c.sentence_en.trim() || c.sentence_en.trim() === c.sentence_hu.trim() || HUNGARIAN_ONLY.test(c.sentence_en),
    );
    expect(wrong.map((c) => `${c.id} ${c.sentence_en}`)).toEqual([]);
  });

  it('sentence_es and sentence_en are not the same sentence', () => {
    expect(cards.filter((c) => c.sentence_es.trim() === c.sentence_en.trim()).map((c) => c.id)).toEqual([]);
  });
});
