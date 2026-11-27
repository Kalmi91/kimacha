// FB753: in the brutal skin the starred part of a form example is ink, heavier and underlined, never the accent fill as text.
import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import GrammarDrill from '../grammar/GrammarDrill';
import { PALETTE_FILLS } from '@/constants/GrammarPalettes';
import type { LessonV2 } from '@/lib/grammar/lessonTypes';
import { getDb } from '@/lib/database';
import { ThemeProvider } from '@/lib/ThemeContext';
import { makeFlush } from '@/test-utils/flush';

const flush = makeFlush(3);

const lesson: LessonV2 = {
  schema: 2,
  topic: 'test-form-examples',
  level: 'A1',
  title: { en: 't', es: 't' },
  body: [
    {
      kind: 'table',
      id: 'ser-presente',
      title: { en: 'ser', es: 'ser' },
      header: [
        { en: 'Person', es: 'Persona' },
        { en: 'ser', es: 'ser' },
      ],
      rows: [['nosotros', 'somos']],
    },
  ],
  speak: { en: 'e', es: 's' },
  items: [{ id: 'form-01', kind: 'form', verb: 'ser', person: 'nosotros', answer: 'somos', table: 'ser-presente', examples: ['Nosotros *somos* amigos.'] }],
};

describe('form examples, brutal skin', () => {
  it('the starred part is ink (not the accent fill), heavier and underlined', async () => {
    await getDb().setGrammarPalette('brand');
    render(
      <ThemeProvider>
        <GrammarDrill topic={lesson} learnedLang="es" contentLang="en" onFinish={jest.fn()} kinds={['form']} />
      </ThemeProvider>
    );
    await flush();
    fireEvent.changeText(screen.getByTestId('formInput'), 'somos');
    fireEvent.press(screen.getByTestId('formCheck'));
    const line = screen.getByTestId('form-example-0');
    const starred = line.children.find((c) => typeof c !== 'string' && (c as { props: { style?: unknown } }).props?.style) as unknown as {
      props: { style: unknown };
    };
    const lineStyle = StyleSheet.flatten(line.props.style);
    const style = StyleSheet.flatten(starred.props.style as never) as Record<string, unknown>;
    expect(style.color).toBe(lineStyle.color);
    expect(style.color).not.toBe(PALETTE_FILLS.brand.a);
    expect(style.textDecorationLine).toBe('underline');
    expect(style.fontWeight).toBe('900');
  });
});
