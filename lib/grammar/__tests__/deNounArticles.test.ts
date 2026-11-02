// The artikel-genus lesson's der / die / das task covers every singular noun of the German deck (twin of the
// articulos-genero test in nounArticles.test.ts): options, explanations in all four texts, the meaning shown after
// the answer, a seeded sample of ARTICLE_ROUND_SIZE nouns per run, and no effect on another lesson.
import { buildGrammarRound, grammarRoundItemKind } from '@/lib/games/grammarChoice';
import { isArticleSetItem } from '@/lib/games/content';
import { lessonFor, lessonKinds } from '@/lib/grammar/syllabus';
import { tableCellsForLesson, wordCellsForLesson } from '@/lib/grammar/tableDeck';
import {
  ARTICLE_LESSON_ID,
  ARTICLE_LESSON_ID_DE,
  ARTICLE_ROUND_SIZE,
  articleNounItemsDe,
  articleNounsDe,
  isArticleLesson,
} from '@/lib/grammar/nounArticles';
import type { LessonV2 } from '@/lib/grammar/lessonTypes';

const LANGS = ['en', 'es', 'hu', 'de'] as const;

describe('articleNounsDe', () => {
  const nouns = articleNounsDe();

  it('hundreds of nouns of the German deck, each noun once, with its own id', () => {
    expect(nouns.length).toBeGreaterThan(300);
    expect(new Set(nouns.map((n) => n.noun)).size).toBe(nouns.length);
    expect(new Set(nouns.map((n) => n.id)).size).toBe(nouns.length);
    expect(nouns.every((n) => /^d\d+$/.test(n.id))).toBe(true);
  });

  it('Hund -> der, Katze -> die, Auto -> das; plural-only and several-word cards are left out', () => {
    expect(nouns.find((n) => n.noun === 'Hund')?.article).toBe('der');
    expect(nouns.find((n) => n.noun === 'Zeit')?.article).toBe('die');
    expect(nouns.find((n) => n.noun === 'Haus')?.article).toBe('das');
    expect(nouns.find((n) => n.noun === 'Leute')).toBeUndefined();
    expect(nouns.find((n) => n.noun.includes(' '))).toBeUndefined();
  });
});

describe('articleNounItemsDe', () => {
  const items = articleNounItemsDe();

  it('every item is a gap word with der / die / das, the right index is the article one', () => {
    const nouns = articleNounsDe();
    expect(items).toHaveLength(nouns.length);
    items.forEach((it, i) => {
      expect(it.set).toBe('article');
      expect(it.sentence).toBe(`___ ${nouns[i].noun}`);
      expect(it.options).toEqual(['der', 'die', 'das']);
      expect(it.options[it.correct]).toBe(nouns[i].article);
      expect(Object.keys(it.wrong).sort()).toEqual(it.options.filter((o) => o !== nouns[i].article).sort());
    });
    expect(new Set(items.map((i) => i.id)).size).toBe(items.length);
  });

  it('the why and wrong explanations are written out in all four texts, never the English ones copied', () => {
    for (const it of items) {
      const article = it.options[it.correct];
      for (const lang of LANGS) {
        expect(it.why[lang]?.trim()).toBeTruthy();
        for (const wrongOpt of Object.keys(it.wrong)) expect(it.wrong[wrongOpt][lang]?.trim()).toBeTruthy();
      }
      expect(it.why.de).toContain(`${article} ${it.sentence.replace('___ ', '')}`);
      expect(it.why.hu).not.toBe(it.why.en);
      expect(it.why.es).not.toBe(it.why.en);
    }
  });

  it('every item has a meaning (tr) in English, Spanish and Hungarian, shown after the answer', () => {
    for (const it of items) for (const lang of ['en', 'es', 'hu'] as const) expect(it.tr?.[lang]?.trim()).toBeTruthy();
    const hund = items.find((i) => i.sentence === '___ Hund')!;
    expect(hund.tr?.es).toBe('el perro');
    expect(hund.tr?.hu).toBe('kutya');
  });

  it('states a rule only where it is true: -ung is feminine, -chen is neuter, a weekday is masculine', () => {
    const why = (noun: string) => items.find((i) => i.sentence === `___ ${noun}`)?.why.en;
    for (const it of items) {
      const noun = it.sentence.replace('___ ', '');
      const article = it.options[it.correct];
      if (/rule|ending in|Days of the week/i.test(it.why.en)) {
        if (/feminine/.test(it.why.en)) expect([noun, article]).toEqual([noun, 'die']);
        if (/neuter/.test(it.why.en)) expect([noun, article]).toEqual([noun, 'das']);
        if (/masculine/.test(it.why.en)) expect([noun, article]).toEqual([noun, 'der']);
      }
    }
    expect(why('Mädchen')).toMatch(/-chen are neuter/);
    expect(why('Montag')).toMatch(/Days of the week/);
  });
});

describe('the artikel-genus lesson', () => {
  const lesson = lessonFor('de', ARTICLE_LESSON_ID_DE) as LessonV2;

  it('among the lesson items is the noun set, the authored items are present, and the article kind has its button', () => {
    const article = lesson.items.filter((i) => isArticleSetItem(i as never));
    expect(article.length).toBe(articleNounsDe().length);
    expect(lesson.items.length).toBeGreaterThan(article.length + 20);
    expect(lessonKinds('de', ARTICLE_LESSON_ID_DE)).toEqual(['choice', 'article', 'form', 'why']);
  });

  it('one run gives exactly ARTICLE_ROUND_SIZE nouns, with a seeded and a varying sample', () => {
    const count = (seed: number) =>
      buildGrammarRound(lesson, seed).filter((r) => grammarRoundItemKind(r) === 'article').map((r) => (r.item as { id: string }).id);
    const a = count(1);
    expect(a).toHaveLength(ARTICLE_ROUND_SIZE);
    expect(count(1)).toEqual(a);
    expect(count(2)).not.toEqual(a);
  });

  it('only the two article lessons carry the task, and the German lesson keeps no table deck and no word deck', () => {
    expect(isArticleLesson(ARTICLE_LESSON_ID)).toBe(true);
    expect(isArticleLesson(ARTICLE_LESSON_ID_DE)).toBe(true);
    expect(isArticleLesson('plural-nomen')).toBe(false);
    const plural = lessonFor('de', 'plural-nomen') as LessonV2;
    expect(plural.items.some((i) => isArticleSetItem(i as never))).toBe(false);
    expect(tableCellsForLesson(lesson, 'de')).toHaveLength(0);
    expect(wordCellsForLesson(lesson, 'de')).toHaveLength(0);
  });
});
