// Error spotting / word order / dictation, only in the ser-estar and negacion lessons, marked as trial.
import { grammarKindCounts, isTrialItem } from '@/lib/games/content';
import { buildGrammarRound, grammarRoundItemKind } from '@/lib/games/grammarChoice';
import { lessonFor, lessonKinds, scoredKinds } from '../syllabus';
import { fixedSentence } from '@/components/grammar/NewKinds';
import type { LessonV2 } from '../lessonTypes';

const serEstar = lessonFor('es', 'ser-estar') as LessonV2;
const negacion = lessonFor('es', 'negacion') as LessonV2;

describe('new task kinds in the two trial lessons', () => {
  it('ser-estar: no error spotting, dictation 5, word order 5 (E132)', () => {
    const c = grammarKindCounts(serEstar);
    expect(c.spot).toBe(0);
    expect(c.dictation).toBe(5);
    expect(c.order).toBe(5);
  });

  it('negacion: word order 5 + error spotting 5, no dictation', () => {
    const c = grammarKindCounts(negacion);
    expect(c.order).toBe(5);
    expect(c.spot).toBe(5);
    expect(c.dictation).toBe(0);
  });

  it('every new item is marked trial, and the old lessons outside A1 have no new kind', () => {
    for (const lesson of [serEstar, negacion]) {
      const fresh = lesson.items.filter((i) => ['spot', 'order', 'dictation'].includes(i.kind ?? ''));
      expect(fresh.length).toBe(10); // ser-estar: dictation 5 + order 5 (E132); negacion: order 5 + spot 5
      expect(fresh.every((i) => isTrialItem(i))).toBe(true);
    }
    const others = ['por-para', 'perfecto']; // (the A1 topics get word order from E132 on)
    for (const id of others) {
      const l = lessonFor('es', id)!;
      const c = grammarKindCounts(l);
      expect(c.spot + c.order + c.dictation).toBe(0);
    }
  });

  it('the lessons of the esâ†’en direction have not changed', () => {
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
    // the typed task kinds of the A1 task content (opencloze, fix, bank) are new kinds too and follow the same rule
    const isNew = (k: string) => ['order', 'spot', 'opencloze', 'fix', 'bank'].includes(k);
    const firstNew = kinds.findIndex((k) => isNew(k));
    expect(firstNew).toBeGreaterThan(0);
    expect(kinds.slice(firstNew).every((k) => isNew(k))).toBe(true);
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
