// FB448: az articulos-genero lecke el / la feladata és szó-paklija az app összes főneve.
import { buildGrammarRound, grammarRoundItemKind } from '@/lib/games/grammarChoice';
import { isArticleSetItem } from '@/lib/games/content';
import { lessonFor, lessonKinds } from '@/lib/grammar/syllabus';
import { tableCellsForLesson, wordCellsForLesson, WORD_DECK_MIN_CARDS } from '@/lib/grammar/tableDeck';
import {
  ARTICLE_LESSON_ID,
  ARTICLE_ROUND_SIZE,
  articleNounDeckCards,
  articleNounItems,
  articleNouns,
} from '@/lib/grammar/nounArticles';
import type { LessonV2 } from '@/lib/grammar/lessonTypes';

const LANGS = ['hu', 'en', 'es', 'de'] as const;

describe('articleNouns (FB448)', () => {
  const nouns = articleNouns();

  it('az app főneveinek szinte mindegyike: több száz, egyedi', () => {
    expect(nouns.length).toBeGreaterThan(300);
    expect(new Set(nouns.map((n) => n.noun)).size).toBe(nouns.length);
    expect(new Set(nouns.map((n) => n.id)).size).toBe(nouns.length);
  });

  it('agua -> el (a nőnemű szó is «el»-t kap), mesa -> la, többes szám kimarad', () => {
    expect(nouns.find((n) => n.noun === 'agua')?.article).toBe('el');
    expect(nouns.find((n) => n.noun === 'mesa')?.article).toBe('la');
    expect(nouns.find((n) => n.noun === 'vacaciones')).toBeUndefined();
  });
});

describe('articleNounItems (FB448)', () => {
  const items = articleNounItems();

  it('minden tétel egy lyukas szó, el / la opcióval, a helyes index a névelőé', () => {
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

  it('a why és a wrong magyarázat mind a 4 nyelven kitöltött, a rossz opcióra van wrong', () => {
    for (const it of items) {
      const wrongOpt = it.options[1 - it.correct];
      for (const lang of LANGS) {
        expect(it.why[lang]?.trim()).toBeTruthy();
        expect(it.wrong[wrongOpt]?.[lang]?.trim()).toBeTruthy();
      }
    }
  });

  it('az agua magyarázata kimondja a kivételt', () => {
    const agua = items.find((i) => i.sentence === '___ agua')!;
    expect(agua.why.en).toMatch(/feminine/);
    expect(agua.options[agua.correct]).toBe('el');
  });
});

describe('az articulos-genero lecke (FB448)', () => {
  const lesson = lessonFor('es', ARTICLE_LESSON_ID) as LessonV2;

  it('a lecke tételei közt ott a főnév-készlet, a szerzői tételek megvannak', () => {
    const article = lesson.items.filter((i) => isArticleSetItem(i as never));
    expect(article.length).toBe(articleNouns().length);
    expect(lesson.items.length).toBeGreaterThan(article.length + 20);
    expect(lessonKinds('es', ARTICLE_LESSON_ID)).toContain('article');
  });

  it('egy futás pontosan ARTICLE_ROUND_SIZE főnevet ad, seedelt és változó mintával', () => {
    const count = (seed: number) =>
      buildGrammarRound(lesson, seed).filter((r) => grammarRoundItemKind(r) === 'article').map((r) => (r.item as { id: string }).id);
    const a = count(1);
    expect(a).toHaveLength(ARTICLE_ROUND_SIZE);
    expect(count(1)).toEqual(a);
    expect(count(2)).not.toEqual(a);
  });

  it('más leckét nem érint: a sustantivo-numero el / la készlete teljes marad', () => {
    const sn = lessonFor('es', 'sustantivo-numero') as LessonV2;
    const round = buildGrammarRound(sn, 1).filter((r) => grammarRoundItemKind(r) === 'article');
    expect(round).toHaveLength(sn.items.filter((i) => isArticleSetItem(i as never)).length);
  });

  it('a szó-pakli az összes főnév névelővel, tábla-pakli híján szó-pakli módban', () => {
    const cards = wordCellsForLesson(lesson, 'es');
    expect(cards).toEqual(articleNounDeckCards());
    expect(cards.length).toBeGreaterThanOrEqual(WORD_DECK_MIN_CARDS);
    expect(cards.find((c) => c.es === 'el agua')?.en).toBe('water');
    expect(tableCellsForLesson(lesson)).toHaveLength(0);
  });
});
