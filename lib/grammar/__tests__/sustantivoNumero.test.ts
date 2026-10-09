// Irregular plurals and the el / la article chooser in the sustantivo-numero lesson.
import lessonJson from '@/data/games/grammar/es/sustantivo-numero.json';
import { grammarKindCounts, isArticleSetItem, type GrammarGapItem } from '@/lib/games/content';
import { buildGrammarRound, grammarRoundItemKind } from '@/lib/games/grammarChoice';
import { lessonKinds } from '../syllabus';
import type { LessonV2 } from '../lessonTypes';

const lesson = lessonJson as unknown as LessonV2;
const articleItems = lesson.items.filter((i) => isArticleSetItem(i)) as GrammarGapItem[];

describe('sustantivo-numero: el / la set', () => {
  it('it has at least 20 nouns, with its own button (article), not among the sentence tasks', () => {
    const counts = grammarKindCounts(lesson);
    expect(counts.article).toBeGreaterThanOrEqual(20);
    expect(counts.article).toBe(articleItems.length);
    expect(counts.choice).toBeGreaterThanOrEqual(12);
    expect(lessonKinds('es', 'sustantivo-numero')).toContain('article');
  });

  it('the tricky nouns are all present: problema, día, mapa, agua, mano, foto, moto, radio', () => {
    const nouns = articleItems.map((i) => i.sentence.toLowerCase());
    for (const noun of ['problema', 'día', 'mapa', 'agua', 'mano', 'foto', 'moto', 'radio']) {
      expect(nouns.some((s) => s.includes(` ${noun} `) || s.includes(` ${noun}.`))).toBe(true);
    }
  });

  it('every item chooses between el / la, the right one is first (the round shuffles), and has an explanation in all four languages', () => {
    for (const item of articleItems) {
      expect(item.options).toHaveLength(2);
      expect(item.options.map((o) => o.toLowerCase()).sort()).toEqual(['el', 'la']);
      expect(item.sentence).toContain('___');
      expect(item.correct).toBe(0);
      for (const lang of ['hu', 'en', 'es', 'de']) {
        expect(item.why[lang]).toBeTruthy();
        expect(item.wrong[item.options[1]][lang]).toBeTruthy();
      }
    }
  });

  it('the right article is really right: the tricky nouns', () => {
    const correctArticleOf = (noun: string) => {
      const item = articleItems.find((i) => new RegExp(`(^|\\s)___ ${noun}[ .]`, 'i').test(i.sentence));
      return item?.options[item.correct].toLowerCase();
    };
    expect(correctArticleOf('problema')).toBe('el');
    expect(correctArticleOf('día')).toBe('el');
    expect(correctArticleOf('mapa')).toBe('el');
    expect(correctArticleOf('agua')).toBe('el');
    expect(correctArticleOf('mano')).toBe('la');
    expect(correctArticleOf('foto')).toBe('la');
    expect(correctArticleOf('moto')).toBe('la');
    expect(correctArticleOf('radio')).toBe('la');
  });

  it('for the article kind the round gives only the el / la items, the choice kind does not contain them', () => {
    const round = buildGrammarRound(lesson, 1);
    const article = round.filter((r) => grammarRoundItemKind(r) === 'article');
    const choice = round.filter((r) => grammarRoundItemKind(r) === 'choice');
    expect(article).toHaveLength(articleItems.length);
    expect(choice.some((r) => isArticleSetItem(r.item as GrammarGapItem))).toBe(false);
  });
});

describe('sustantivo-numero: irregular plurals', () => {
  const tableRows = (lesson.body.find((b) => b.kind === 'table' && b.id === 'plural') as { rows: string[][] }).rows;
  const forms = lesson.items.filter((i) => i.kind === 'form') as { person: string; answer: string }[];
  const answerOf = (person: string) => forms.find((f) => f.person === person)?.answer;

  it('the lesson has an irregular block: -z → -ces, unchanged -s, accent shift, carácter', () => {
    const titles = lesson.body.map((b) => ('title' in b && b.title ? b.title.en : ''));
    expect(titles).toContain('Irregular plurals');
    const block = lesson.body.find((b) => b.kind === 'list' && b.title?.en === 'Irregular plurals') as {
      items: { text: { en: string } }[];
    };
    const text = block.items.map((i) => i.text.en).join(' ');
    for (const w of ['la vez → las veces', 'la luz → las luces', 'el pez → los peces', 'el lunes → los lunes', 'la crisis → las crisis', 'el joven → los jóvenes', 'el examen → los exámenes', 'la canción → las canciones', 'carácter → los caracteres']) {
      expect(text).toContain(w);
    }
  });

  it('the conjugation task asks the irregular forms, and the helper table contains them too', () => {
    expect(answerOf('la vez')).toBe('las veces');
    expect(answerOf('el pez')).toBe('los peces');
    expect(answerOf('la crisis')).toBe('las crisis');
    expect(answerOf('el joven')).toBe('los jóvenes');
    expect(answerOf('el carácter')).toBe('los caracteres');
    const flat = tableRows.map((r) => r.join('>'));
    expect(flat).toContain('el carácter>los caracteres');
    expect(flat).toContain('la vez>las veces');
  });
});
