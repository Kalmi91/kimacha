// Error spotting / word order / dictation, only in the ser-estar and negacion lessons, marked as trial.
import { grammarKindCounts, isTrialItem } from '@/lib/games/content';
import { buildGrammarRound, grammarRoundItemKind } from '@/lib/games/grammarChoice';
import { lessonFor, lessonKinds, scoredKinds } from '../syllabus';
import { fixedSentence } from '@/components/grammar/NewKinds';
import type { LessonV2 } from '../lessonTypes';

const serEstar = lessonFor('es', 'ser-estar') as LessonV2;
const negacion = lessonFor('es', 'negacion') as LessonV2;

describe('new task kinds in the two trial lessons', () => {
  it('ser-estar: no error spotting, dictation 5, no word order', () => {
    const c = grammarKindCounts(serEstar);
    expect(c.spot).toBe(0);
    expect(c.dictation).toBe(5);
    expect(c.order).toBe(0);
  });

  it('negacion: word order 5 + error spotting 5, no dictation', () => {
    const c = grammarKindCounts(negacion);
    expect(c.order).toBe(5);
    expect(c.spot).toBe(5);
    expect(c.dictation).toBe(0);
  });

  it('every new item is marked trial, and only these two lessons have a new kind', () => {
    for (const lesson of [serEstar, negacion]) {
      const fresh = lesson.items.filter((i) => ['spot', 'order', 'dictation'].includes(i.kind ?? ''));
      expect(fresh.length).toBe(lesson === serEstar ? 5 : 10);
      expect(fresh.every((i) => isTrialItem(i))).toBe(true);
    }
    const others = ['presente-irregular', 'sustantivo-numero', 'gustar', 'por-para', 'perfecto'];
    for (const id of others) {
      const l = lessonFor('es', id)!;
      const c = grammarKindCounts(l);
      expect(c.spot + c.order + c.dictation).toBe(0);
    }
  });

  it('the lessons of the es→en direction have not changed', () => {
    for (const id of ['to_be', 'articles']) {
      const l = lessonFor('en', id)!;
      const c = grammarKindCounts(l);
      expect(c.spot + c.order + c.dictation).toBe(0);
    }
  });

  it('the provisional kinds do not count toward the lesson %', () => {
    expect(scoredKinds(serEstar)).not.toContain('spot');
    expect(scoredKinds(serEstar)).not.toContain('dictation');
    expect(scoredKinds(negacion)).not.toContain('order');
    expect(scoredKinds(negacion)).not.toContain('spot');
    expect(lessonKinds('es', 'ser-estar')).toContain('choice');
  });

  it('the round puts the new items at the end, with their own kind label', () => {
    const round = buildGrammarRound(negacion, 7);
    const kinds = round.map((r) => grammarRoundItemKind(r));
    const firstNew = kinds.findIndex((k) => k === 'order' || k === 'spot');
    expect(firstNew).toBeGreaterThan(0);
    expect(kinds.slice(firstNew).every((k) => k === 'order' || k === 'spot')).toBe(true);
    expect(round.filter((r) => grammarRoundItemKind(r) === 'choice').every((r) => 'options' in r)).toBe(true);
  });
});

describe('fixedSentence', () => {
  it('replaces the wrong word, the punctuation stays in place', () => {
    expect(fixedSentence('Yo soy cansado.', 1, 'estoy')).toBe('Yo estoy cansado.');
    expect(fixedSentence('No veo algo.', 2, 'nada')).toBe('No veo nada.');
  });

  it('an empty option deletes the word, the punctuation goes to the previous word', () => {
    expect(fixedSentence('Nadie no viene.', 1, '')).toBe('Nadie viene.');
    expect(fixedSentence('Nadie viene no.', 2, '')).toBe('Nadie viene.');
  });
});
