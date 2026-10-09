// The articulos-genero lesson's el / la exercise covers every noun in the app. The exercise also
// carries the noun's meaning (tr), and the word deck is gone (the deck is again the lesson's own words).
import { buildGrammarRound, grammarRoundItemKind } from '@/lib/games/grammarChoice';
import { isArticleSetItem } from '@/lib/games/content';
import { lessonFor, lessonKinds } from '@/lib/grammar/syllabus';
import { tableCellsForLesson, wordCellsForLesson, WORD_DECK_MIN_CARDS } from '@/lib/grammar/tableDeck';
import {
  ARTICLE_LESSON_ID,
  ARTICLE_ROUND_SIZE,
  articleNounItems,
  articleNouns,
} from '@/lib/grammar/nounArticles';
import type { LessonV2 } from '@/lib/grammar/lessonTypes';

const LANGS = ['hu', 'en', 'es', 'de'] as const;

describe('articleNouns (FB448)', () => {
  const nouns = articleNouns();

  it('nearly all nouns of the app: several hundred, unique', () => {
    expect(nouns.length).toBeGreaterThan(300);
    expect(new Set(nouns.map((n) => n.noun)).size).toBe(nouns.length);
    expect(new Set(nouns.map((n) => n.id)).size).toBe(nouns.length);
  });

  it('agua -> el (the feminine word also gets «el»), mesa -> la, plurals left out', () => {
    expect(nouns.find((n) => n.noun === 'agua')?.article).toBe('el');
    expect(nouns.find((n) => n.noun === 'mesa')?.article).toBe('la');
    expect(nouns.find((n) => n.noun === 'vacaciones')).toBeUndefined();
  });
});

describe('articleNounItems (FB448)', () => {
  const items = articleNounItems();

  it('every item is a gap word, with el / la options, the right index is the article one', () => {
    const nouns = articleNouns();
    expect(items).toHaveLength(nouns.length);
    items.forEach((it, i) => {
      expect(it.set).toBe('article');
      expect(it.sentence).toBe(`___ ${nouns[i].noun}`);
      expect(it.options).toEqual(['el', 'la']);
      expect(it.options[it.correct]).toBe(nouns[i].article);
    });
    expect(new Set(items.map((i) => i.id)).size).toBe(items.length);
  });

  it('the why and wrong explanations are filled in all 4 languages, wrong exists for the wrong option', () => {
    for (const it of items) {
      const wrongOpt = it.options[1 - it.correct];
      for (const lang of LANGS) {
        expect(it.why[lang]?.trim()).toBeTruthy();
        expect(it.wrong[wrongOpt]?.[lang]?.trim()).toBeTruthy();
      }
    }
  });

  // the noun's meaning from words-open (hu / en / de, English for es), shown after the answer.
  it('every item has a meaning (tr) in all 4 languages, the English one is the en field of words-open', () => {
    for (const it of items) {
      for (const lang of LANGS) expect(it.tr?.[lang]?.trim()).toBeTruthy();
    }
    const agua = items.find((i) => i.sentence === '___ agua')!;
    expect(agua.tr?.en).toBe('water');
    expect(agua.tr?.es).toBe('water');
  });

  it('the explanation of agua states the exception', () => {
    const agua = items.find((i) => i.sentence === '___ agua')!;
    expect(agua.why.en).toMatch(/feminine/);
    expect(agua.options[agua.correct]).toBe('el');
  });
});

describe('the articulos-genero lesson', () => {
  const lesson = lessonFor('es', ARTICLE_LESSON_ID) as LessonV2;

  it('among the lesson items is the noun set, the authored items are present', () => {
    const article = lesson.items.filter((i) => isArticleSetItem(i as never));
    expect(article.length).toBe(articleNouns().length);
    expect(lesson.items.length).toBeGreaterThan(article.length + 20);
    expect(lessonKinds('es', ARTICLE_LESSON_ID)).toContain('article');
  });

  it('one run gives exactly ARTICLE_ROUND_SIZE nouns, with a seeded and a varying sample', () => {
    const count = (seed: number) =>
      buildGrammarRound(lesson, seed).filter((r) => grammarRoundItemKind(r) === 'article').map((r) => (r.item as { id: string }).id);
    const a = count(1);
    expect(a).toHaveLength(ARTICLE_ROUND_SIZE);
    expect(count(1)).toEqual(a);
    expect(count(2)).not.toEqual(a);
  });

  it('it does not touch another lesson: the el / la set of sustantivo-numero stays complete', () => {
    const sn = lessonFor('es', 'sustantivo-numero') as LessonV2;
    const round = buildGrammarRound(sn, 1).filter((r) => grammarRoundItemKind(r) === 'article');
    expect(round).toHaveLength(sn.items.filter((i) => isArticleSetItem(i as never)).length);
  });

  it('no noun deck, the lesson deck is the lesson own words (below the threshold), and no table deck either', () => {
    const cards = wordCellsForLesson(lesson, 'es');
    expect(cards.length).toBeLessThan(WORD_DECK_MIN_CARDS);
    expect(cards.some((c) => c.id.startsWith('noun::'))).toBe(false);
    expect(tableCellsForLesson(lesson)).toHaveLength(0);
  });
});
