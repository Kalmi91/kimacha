// FB714: a transform item names the target tense in the question line, in everyday words too (FB700's map),
// for indefinido -> imperfecto and imperfecto -> indefinido alike.

import { act, render, screen } from '@testing-library/react-native';

import GrammarDrill from '../grammar/GrammarDrill';
import type { LessonV2 } from '@/lib/grammar/lessonTypes';

jest.mock('@/lib/ThemeContext', () => ({
  useTheme: () => ({ theme: 'light' }),
}));

const flush = async () => {
  await act(async () => {
    await Promise.resolve();
  });
};

const item = (id: string, from: 'indefinido' | 'imperfecto', to: 'indefinido' | 'imperfecto') => ({
  kind: 'transform' as const,
  id,
  tense: { from, to },
  prompt: { en: 'Ayer comí pan.', es: 'Ayer comí pan.' },
  answer: 'Antes comía pan.',
  wordIds: [],
  why: { en: 'x', es: 'x' },
});

const lesson = (it: ReturnType<typeof item>): LessonV2 => ({
  schema: 2,
  topic: 'test-transform-target',
  level: 'A1',
  title: { en: 't', es: 't' },
  body: [],
  speak: { en: 'e', es: 's' },
  items: [it],
});

const show = (it: ReturnType<typeof item>) =>
  render(<GrammarDrill topic={lesson(it)} learnedLang="es" contentLang="en" onFinish={jest.fn()} kinds={['transform']} />);

describe('GrammarDrill: transform item names the target tense', () => {
  it('indefinido -> imperfecto: the question says imperfect and "used to / was doing"', async () => {
    show(item('t1', 'indefinido', 'imperfecto'));
    await flush();
    expect(screen.queryByText('Rewrite in the imperfect · Past (used to / was doing)')).toBeTruthy();
  });

  it('imperfecto -> indefinido: the question says preterite and "finished action"', async () => {
    show(item('t2', 'imperfecto', 'indefinido'));
    await flush();
    expect(screen.queryByText('Rewrite in the preterite · Past (finished action)')).toBeTruthy();
  });
});
