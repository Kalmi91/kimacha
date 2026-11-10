// A typed form task of the level test is ONE question (FB642-646): the item's own `q`, else one generated from its data.

import { render, screen } from '@testing-library/react-native';

import TestQuestionView from '@/components/grammar/TestQuestionView';
import { buildLessonTest, type LessonTestQuestion } from '@/lib/grammar/lessonTest';
import { formTask } from '@/lib/grammar/resultDetail';
import { lessonFor } from '@/lib/grammar/syllabus';
import type { FormItem, LessonBlock } from '@/lib/grammar/lessonTypes';
import { ThemeProvider } from '@/lib/ThemeContext';

const FOUR: { topic: string; id: string; question: string }[] = [
  { topic: 'quien-a-quien', id: 'qq-form-09', question: 'What is the indirect object pronoun for él / usted (masculine)?' },
  { topic: 'ir-a-infinitivo', id: 'ir-form-01', question: 'What is the yo form of ir a? (without the infinitive)' },
  { topic: 'tener-expresiones', id: 'te-form-06', question: 'How do you say "to be cold (a person)" with tener?' },
  { topic: 'tu-usted', id: 'tu-form-11', question: 'What is the form of querer for ustedes?' },
];

const build = (topic: string, contentLang: string): LessonTestQuestion[] =>
  buildLessonTest(lessonFor('es', topic)!, { seed: 1, learnedLang: 'es', contentLang, size: 9999 });

describe('the four items of FB642-646 on the question card', () => {
  it.each(FOUR)('$id shows only its question above the input', ({ topic, id, question }) => {
    const q = build(topic, 'en').find((x) => x.id === id)!;
    render(
      <ThemeProvider>
        <TestQuestionView q={q} learnedLang="es" strictAccents={false} instant onDone={jest.fn()} />
      </ThemeProvider>
    );
    expect(screen.getByTestId('exam-prompt')).toHaveTextContent(question);
    expect(screen.queryByTestId('exam-hint')).toBeNull();
    expect(screen.queryByTestId('exam-heading')).toBeNull();
    expect(screen.queryByTestId('exam-label')).toBeNull();
    // the old pieces ("verb · person") are gone
    expect(screen.queryByText(/ · /)).toBeNull();
    expect(q.review.question).toBe(question);
  });

  it('the Spanish content language gets the Spanish question with its inverted mark', () => {
    const q = build('quien-a-quien', 'es').find((x) => x.id === 'qq-form-09')!;
    expect(q.view).toMatchObject({ prompt: '¿Cuál es el pronombre de objeto indirecto para «él / usted (masculino)»?' });
  });

  it('answer, accepted forms and ids are unchanged', () => {
    const q = build('ir-a-infinitivo', 'en').find((x) => x.id === 'ir-form-01')!;
    expect(q.view).toMatchObject({ answer: 'voy a' });
  });
});

describe('formTask (the generated question)', () => {
  const pick = (l: Record<string, string>) => l.en;
  const person = { kind: 'table', id: 't', title: { en: 'Verbs', es: 'Verbos' }, header: [{ en: 'Person', es: 'Persona' }, { en: 'to speak', es: 'hablar' }], rows: [['yo', 'hablo']] } as unknown as Extract<LessonBlock, { kind: 'table' }>;
  const plain = { kind: 'table', id: 't2', title: { en: 'Plural', es: 'Plural' }, header: [{ en: 'Singular', es: 'Singular' }, { en: 'Plural noun', es: 'Plural' }], rows: [['el libro', 'los libros']] } as unknown as Extract<LessonBlock, { kind: 'table' }>;
  const item = (over: Partial<FormItem>): FormItem => ({ kind: 'form', id: 'x', verb: 'hablar', person: 'yo', answer: 'hablo', table: 't', ...over });

  it('a verb table: form of the verb (with its meaning) for the person', () => {
    expect(formTask(item({}), person, pick).question).toBe('What is the form of hablar (to speak) for yo?');
  });

  it('no table: verb and person only', () => {
    expect(formTask(item({}), undefined, pick).question).toBe('What is the form of hablar for yo?');
  });

  it('another table: the asked column, the person and the table title', () => {
    expect(formTask(item({ verb: 'Plural', person: 'el libro', table: 't2' }), plain, pick).question).toBe('What is the plural noun for el libro? (Plural)');
  });

  it('the cell is not in the table: verb and person', () => {
    expect(formTask(item({ verb: 'Plural', person: 'la mesa', table: 't2' }), plain, pick).question).toBe('What is the form of Plural for la mesa?');
  });

  it('the item\'s own q wins, in the content language', () => {
    const own = item({ q: { en: 'What is it?', es: '¿Qué es?' } });
    expect(formTask(own, person, pick).question).toBe('What is it?');
    expect(formTask(own, person, (l) => l.es).question).toBe('¿Qué es?');
  });
});
