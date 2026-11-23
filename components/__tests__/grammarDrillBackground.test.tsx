// FB710 + FB711: the drill paints its own background on every item, so a page change never shows another colour through.

import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import GrammarDrill from '../grammar/GrammarDrill';
import type { LessonV2 } from '@/lib/grammar/lessonTypes';

jest.mock('@/lib/ThemeContext', () => ({
  useTheme: () => ({ theme: 'light' }),
}));
jest.mock('@/lib/speech', () => ({
  ...jest.requireActual('@/lib/speech'),
  speak: jest.fn(),
}));

const flush = async () => {
  await act(async () => {
    await Promise.resolve();
  });
};

const choice = (id: string) => ({
  id,
  sentence: 'Ayer yo ___ pan.',
  options: ['comí', 'como'],
  correctIndex: 0,
  wrong: {},
  tense: { from: 'presente' as const, to: 'indefinido' as const },
  why: { en: 'x', es: 'x' },
});

const lesson = { schema: 2, topic: 'bg', level: 'A1', title: { en: 't', es: 't' }, body: [], speak: { en: 'e', es: 's' }, items: [choice('c1'), choice('c2')] } as unknown as LessonV2;

const bg = () => StyleSheet.flatten(screen.getByTestId('grammar-drill-scroll').props.style)?.backgroundColor;

describe('GrammarDrill background', () => {
  it('the scroller keeps the same background across an item change', async () => {
    render(<GrammarDrill topic={lesson} learnedLang="es" contentLang="en" onFinish={jest.fn()} kinds={['choice']} />);
    await flush();
    const first = bg();
    expect(first).toBeTruthy();
    fireEvent.press(screen.getByText('comí'));
    await flush();
    fireEvent.press(screen.getByTestId('grammar-next'));
    await flush();
    expect(bg()).toBe(first);
  });
});
