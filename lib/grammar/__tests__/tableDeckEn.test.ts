// The es→en direction's "practise words" deck is built from the English
// vocabulary (question = Spanish word, answer = English word); the Spanish direction is unchanged.
import enA0 from '@/data/words/en/a0.json';
import enA1 from '@/data/words/en/a1.json';
import enA2 from '@/data/words/en/a2.json';
import { lessonFor } from '../syllabus';
import { WORD_DECK_MIN_CARDS, wordCellsForLesson } from '../tableDeck';
import type { Lang4, LessonV2 } from '../lessonTypes';

interface EnWord {
  es: string;
  en: string;
  pos?: string;
  topic?: string;
}

const A0 = enA0 as unknown as EnWord[];
const A1 = enA1 as unknown as EnWord[];
const A2 = enA2 as unknown as EnWord[];
const l4 = (s: string): Lang4 => ({ hu: s, en: s, es: s, de: s });

// A single English word that is ONLY on the A2 list (not yet taught at A1).
const seenLow = new Set([...A0, ...A1].map((w) => w.en.trim().toLowerCase()));
const isSingle = (w: EnWord) => /^[a-z]+$/.test(w.en);
const a2Only = A2.filter((w) => isSingle(w) && !seenLow.has(w.en) && w.pos !== 'phrase')[0];
const a1Nouns = A1.filter((w) => isSingle(w) && w.pos === 'noun' && !['dog', 'the'].includes(w.en)).slice(0, 12);

function synthetic(level: LessonV2['level'], sentences: string[], extra: Partial<LessonV2> = {}): LessonV2 {
  return {
    schema: 2,
    topic: 'zz-synthetic',
    level,
    title: l4('t'),
    body: [{ kind: 'list', items: [{ text: l4('x'), examples: sentences.map((s) => ({ es: s, tr: l4(s) })) }] }],
    speak: l4('s'),
    items: [],
    ...extra,
  };
}

describe('wordCellsForLesson es→en direction', () => {
  it('A1 lesson (to_be): the question is Spanish, the answer English, there are enough cards for the deck button', () => {
    const cards = wordCellsForLesson(lessonFor('en', 'to_be'), 'en');
    expect(cards.length).toBeGreaterThanOrEqual(WORD_DECK_MIN_CARDS);
    expect(cards[0]).toEqual({ id: expect.any(String), es: 'yo soy', en: 'I am' });
    for (const c of cards) {
      expect(c.es.trim()).not.toBe('');
      expect(c.en.trim()).not.toBe('');
      expect(c.es.toLowerCase()).not.toBe(c.en.toLowerCase());
      // the English side is ASCII-lettered (no Spanish accent / ¿ ¡ in the answer)
      expect(c.en).not.toMatch(/[áéíóúñ¿¡]/i);
    }
  });

  it('A2 lesson (going_to): the cards come from within the lesson level and tied to the lesson', () => {
    const lesson = lessonFor('en', 'going_to');
    expect(lesson).toBeDefined();
    expect(lesson!.level).toBe('A2');
    const cards = wordCellsForLesson(lesson, 'en');
    expect(cards.length).toBeGreaterThanOrEqual(WORD_DECK_MIN_CARDS);
    const enAnswers = new Set(cards.map((c) => c.en.toLowerCase()));
    expect(enAnswers.has('am going to')).toBe(true);
  });

  it('the ids and the English answers are unique (the card state keys on the id)', () => {
    for (const id of ['to_be', 'articles', 'present_simple', 'going_to', 'past_simple_regular']) {
      const lesson = lessonFor('en', id);
      if (!lesson) continue;
      const cards = wordCellsForLesson(lesson, 'en');
      expect(new Set(cards.map((c) => c.id)).size).toBe(cards.length);
      expect(new Set(cards.map((c) => c.en.trim().toLowerCase())).size).toBe(cards.length);
    }
  });

  it('within the lesson level: the A2-only word is not in an A1 lesson, it is in an A2 lesson (from a sentence)', () => {
    expect(a2Only).toBeDefined();
    const sentence = `We like ${a2Only.en} very much.`;
    const a1 = wordCellsForLesson(synthetic('A1', [sentence]), 'en');
    const a2 = wordCellsForLesson(synthetic('A2', [sentence]), 'en');
    expect(a1.some((c) => c.en === a2Only.en)).toBe(false);
    expect(a2.find((c) => c.en === a2Only.en)).toEqual({ id: `word::${a2Only.en}`, es: a2Only.es, en: a2Only.en });
  });

  it('the content single words of the sentence are cards, the closed-class words are not', () => {
    const words = a1Nouns.map((w) => w.en);
    const cards = wordCellsForLesson(synthetic('A1', [`I am the ${words.slice(0, 6).join(' and ')}.`, `They are in ${words.slice(6, 12).join(', ')}.`]), 'en');
    for (const w of a1Nouns) expect(cards.some((c) => c.en === w.en && c.es === w.es)).toBe(true);
    for (const closed of ['i', 'am', 'the', 'and', 'they', 'are', 'in']) {
      expect(cards.some((c) => c.en.toLowerCase() === closed)).toBe(false);
    }
  });

  it("the glossary is the author's choice: the question is gloss.es, the answer the English word; a non-existent form is left out", () => {
    const lesson = synthetic('A1', [], {
      glossary: [
        { word: 'university', gloss: { hu: 'egyetem', en: 'university', es: 'universidad', de: 'Universität' } },
        { word: 'blorf', gloss: { hu: 'nem létező alak', en: 'not a real form', es: 'forma inexistente', de: 'keine reale Form' } },
      ],
    });
    const cards = wordCellsForLesson(lesson, 'en');
    expect(cards[0]).toEqual({ id: 'glossary::university', es: 'universidad', en: 'university' });
    expect(cards.some((c) => c.en === 'blorf')).toBe(false);
  });

  it('words tied to the lesson topic, within its level (the topic field of the word list)', () => {
    const colors = wordCellsForLesson(synthetic('A1', [], { topic: 'colors' }), 'en');
    expect(colors.length).toBeGreaterThanOrEqual(WORD_DECK_MIN_CARDS);
    expect(colors.every((c) => c.id.startsWith('topic::'))).toBe(true);
    // the "travel" topic is only on the A2 list: empty in an A1 lesson, present in an A2 lesson
    expect(wordCellsForLesson(synthetic('A1', [], { topic: 'travel' }), 'en')).toHaveLength(0);
    expect(wordCellsForLesson(synthetic('A2', [], { topic: 'travel' }), 'en').length).toBeGreaterThanOrEqual(WORD_DECK_MIN_CARDS);
    // focusTopic binds in the same way
    expect(wordCellsForLesson(synthetic('A1', [], { focusTopic: 'colors' }), 'en').length).toBeGreaterThanOrEqual(WORD_DECK_MIN_CARDS);
  });

  it('if there are not enough English words, the deck stays below the button threshold (not empty-reversed, but hidden)', () => {
    const few = wordCellsForLesson(synthetic('A1', ['It is fine.']), 'en');
    expect(few.length).toBeLessThan(WORD_DECK_MIN_CARDS);
    expect(wordCellsForLesson(null, 'en')).toEqual([]);
    expect(wordCellsForLesson(undefined, 'en')).toEqual([]);
  });
});

describe('wordCellsForLesson Spanish direction (en→es, hu→es) unchanged', () => {
  it('the default and the explicit "es" give the same, and the cards come from PCIC / the glossary: the question is English, the answer Spanish', () => {
    for (const id of ['ser-estar', 'gustar', 'clases-de-palabras']) {
      const lesson = lessonFor('es', id);
      expect(wordCellsForLesson(lesson)).toEqual(wordCellsForLesson(lesson, 'es'));
      expect(wordCellsForLesson(lesson)).toEqual(wordCellsForLesson(lesson, 'hu'));
    }
  });

  // the Spanish word deck is built only from the table's words,
  // so instead of the earlier fixed samples (ser-estar 30 cards, glossary::boda...) the
  // invariant: none of the cards is a glossary-only word, and the counts are below the threshold.
  it('the deck of ser-estar, gustar, articulos-genero no longer contains glossary-only words', () => {
    const cards = wordCellsForLesson(lessonFor('es', 'ser-estar'));
    expect(cards.some((c) => c.id === 'glossary::boda' || c.id === 'glossary::fiesta')).toBe(false);
    expect(cards.length).toBeLessThan(WORD_DECK_MIN_CARDS);
    expect(wordCellsForLesson(lessonFor('es', 'gustar')).length).toBeLessThan(WORD_DECK_MIN_CARDS);
    expect(wordCellsForLesson(lessonFor('es', 'articulos-genero')).length).toBeLessThan(WORD_DECK_MIN_CARDS);
  });
});

