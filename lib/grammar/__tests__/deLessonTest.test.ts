// The lesson test of the German course asks the form items as typed questions that keep the umlaut and the ß
// (twin of the form drill's rule, components/__tests__/deFormDrill.test.tsx).
import { getGrammarTopic } from '@/lib/games/content';
import { buildLessonTest } from '../lessonTest';

describe('German lessons: the lesson test', () => {
  it('asks the form items as typed questions that keep the umlaut and the ß; the other courses ask them as before', () => {
    const lesson = getGrammarTopic('de', 'plural-nomen')!;
    const forms = buildLessonTest(lesson, { seed: 1, learnedLang: 'de', contentLang: 'en', size: 9999 }).filter(
      (q) => q.view.card === 'type',
    );
    expect(forms.length).toBeGreaterThan(0);
    for (const q of forms) expect(q.view).toMatchObject({ card: 'type', keepUmlauts: true });

    const es = getGrammarTopic('es', 'presente-regular')!;
    const esForms = buildLessonTest(es, { seed: 1, learnedLang: 'es', contentLang: 'en', size: 9999 }).filter((q) => q.view.card === 'type');
    expect(esForms.length).toBeGreaterThan(0);
    for (const q of esForms) expect('keepUmlauts' in q.view).toBe(false);
  });
});
