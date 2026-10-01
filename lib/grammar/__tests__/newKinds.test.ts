// PLAN-fb0929 7. lépés (D1): hibakereső / szórend / diktálás, csak a ser-estar és a negacion leckében, trial jelöléssel.
import { grammarKindCounts, isTrialItem } from '@/lib/games/content';
import { buildGrammarRound, grammarRoundItemKind } from '@/lib/games/grammarChoice';
import { lessonFor, lessonHasTrial, lessonKinds, scoredKinds } from '../syllabus';
import { fixedSentence } from '@/components/grammar/NewKinds';
import type { LessonV2 } from '../lessonTypes';

const serEstar = lessonFor('es', 'ser-estar') as LessonV2;
const negacion = lessonFor('es', 'negacion') as LessonV2;

describe('új feladat-fajták a két próba-leckében', () => {
  it('ser-estar: hibakereső nincs (FB435), diktálás 5, szórend nincs', () => {
    const c = grammarKindCounts(serEstar);
    expect(c.spot).toBe(0);
    expect(c.dictation).toBe(5);
    expect(c.order).toBe(0);
  });

  it('negacion: szórend 5 + hibakereső 5, diktálás nincs', () => {
    const c = grammarKindCounts(negacion);
    expect(c.order).toBe(5);
    expect(c.spot).toBe(5);
    expect(c.dictation).toBe(0);
  });

  it('minden új tétel trial jelölésű, és csak ebben a két leckében van új fajta', () => {
    for (const lesson of [serEstar, negacion]) {
      const fresh = lesson.items.filter((i) => ['spot', 'order', 'dictation'].includes(i.kind ?? ''));
      expect(fresh.length).toBe(lesson === serEstar ? 5 : 10);
      expect(fresh.every((i) => isTrialItem(i))).toBe(true);
      expect(lessonHasTrial(lesson)).toBe(true);
    }
    const others = ['presente-irregular', 'sustantivo-numero', 'gustar', 'por-para', 'perfecto'];
    for (const id of others) {
      const l = lessonFor('es', id)!;
      expect(lessonHasTrial(l)).toBe(false);
      const c = grammarKindCounts(l);
      expect(c.spot + c.order + c.dictation).toBe(0);
    }
  });

  it('az es→en irány leckéi nem változtak', () => {
    for (const id of ['to_be', 'articles']) {
      const l = lessonFor('en', id)!;
      const c = grammarKindCounts(l);
      expect(c.spot + c.order + c.dictation).toBe(0);
    }
  });

  it('az ideiglenes fajták nem számítanak a lecke %-ába', () => {
    expect(scoredKinds(serEstar)).not.toContain('spot');
    expect(scoredKinds(serEstar)).not.toContain('dictation');
    expect(scoredKinds(negacion)).not.toContain('order');
    expect(scoredKinds(negacion)).not.toContain('spot');
    expect(lessonKinds('es', 'ser-estar')).toContain('choice');
  });

  it('a kör az új tételeket a végére teszi, saját fajta-címkével', () => {
    const round = buildGrammarRound(negacion, 7);
    const kinds = round.map((r) => grammarRoundItemKind(r));
    const firstNew = kinds.findIndex((k) => k === 'order' || k === 'spot');
    expect(firstNew).toBeGreaterThan(0);
    expect(kinds.slice(firstNew).every((k) => k === 'order' || k === 'spot')).toBe(true);
    expect(round.filter((r) => grammarRoundItemKind(r) === 'choice').every((r) => 'options' in r)).toBe(true);
  });
});

describe('fixedSentence', () => {
  it('a hibás szót cseréli, az írásjel a helyén marad', () => {
    expect(fixedSentence('Yo soy cansado.', 1, 'estoy')).toBe('Yo estoy cansado.');
    expect(fixedSentence('No veo algo.', 2, 'nada')).toBe('No veo nada.');
  });

  it('üres opció a szót törli, az írásjel az előző szóra kerül', () => {
    expect(fixedSentence('Nadie no viene.', 1, '')).toBe('Nadie viene.');
    expect(fixedSentence('Nadie viene no.', 2, '')).toBe('Nadie viene.');
  });
});
