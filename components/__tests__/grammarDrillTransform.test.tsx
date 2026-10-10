// sentence-transformation drill in the lesson drill. The pattern for `kinds={['transform']}`
// comes from grammarDrillWhy.test.tsx.

jest.mock('@/lib/database', () => jest.requireActual('@/lib/database.web'));

import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { getDb } from '@/lib/database';
import GrammarDrill from '../grammar/GrammarDrill';
import type { LessonV2 } from '@/lib/grammar/lessonTypes';

jest.mock('@/lib/ThemeContext', () => ({
  useTheme: () => ({ theme: 'light' }),
}));

// `db.getStrictAccents()` runs in the mount effect, one microtask turn later; the strictness
// test has to wait for it before it fills in the field.
const flush = async () => {
  await act(async () => {
    await Promise.resolve();
  });
};

const lesson: LessonV2 = {
  schema: 2,
  topic: 'test-transform',
  level: 'A2',
  title: { en: 't', es: 't' },
  body: [],
  speak: { en: 'e', es: 's' },
  items: [
    {
      kind: 'transform',
      id: 'tr-01',
      tense: { from: 'presente', to: 'indefinido' },
      prompt: { en: 'I eat bread.', es: 'Como pan.' },
      answer: 'Comí pan.',
      accept: ['Yo comí pan.'],
      wordIds: ['1', '2'],
      why: { en: 'why', es: 'porque' },
    },
    {
      kind: 'transform',
      id: 'tr-02',
      tense: { from: 'presente', to: 'indefinido' },
      prompt: { en: 'She talks to her mother.', es: 'Habla con su madre.' },
      answer: 'Habló con su madre.',
      wordIds: ['3'],
      why: { en: 'why2', es: 'porque2' },
    },
  ],
};

describe('GrammarDrill: transform item', () => {
  it('kinds={["transform"]} shows the sentence, tense badge and input', async () => {
    render(<GrammarDrill topic={lesson} learnedLang="es" contentLang="en" onFinish={jest.fn()} kinds={['transform']} />);
    await flush();
    expect(screen.queryByText('Como pan.')).toBeTruthy();
    expect(screen.queryByText('Presente → Pretérito perfecto simple')).toBeTruthy();
    expect(screen.queryByTestId('transform-input')).toBeTruthy();
  });

  it('correct answer shows the "Correct" box + why, and next advances', async () => {
    const onFinish = jest.fn();
    render(<GrammarDrill topic={lesson} learnedLang="es" contentLang="en" onFinish={onFinish} kinds={['transform']} />);
    await flush();

    fireEvent.changeText(screen.getByTestId('transform-input'), 'Comí pan.');
    fireEvent.press(screen.getByTestId('transform-check'));
    expect(screen.queryByText('Correct')).toBeTruthy();
    expect(screen.queryByText('why')).toBeTruthy();

    fireEvent.press(screen.getByTestId('transform-next'));
    expect(screen.queryByText('Habla con su madre.')).toBeTruthy();
  });

  it('wrong answer shows "Correct answer" + the answer + why', async () => {
    const onFinish = jest.fn();
    render(<GrammarDrill topic={lesson} learnedLang="es" contentLang="en" onFinish={onFinish} kinds={['transform']} />);
    await flush();

    fireEvent.changeText(screen.getByTestId('transform-input'), 'como cosas raras');
    fireEvent.press(screen.getByTestId('transform-check'));
    expect(screen.queryByText('Correct answer')).toBeTruthy();
    expect(screen.queryByText('Comí pan.')).toBeTruthy();
    expect(screen.queryByText('why')).toBeTruthy();
  });

  it('accepts a missing-accent answer loosely, rejects it under strict accents', async () => {
    const db = getDb();
    await db.setOnboarding('hu', 'es');

    await db.setStrictAccents(false);
    const loose = render(<GrammarDrill topic={lesson} learnedLang="es" contentLang="en" onFinish={jest.fn()} kinds={['transform']} />);
    await flush();
    fireEvent.changeText(screen.getByTestId('transform-input'), 'Comi pan.');
    fireEvent.press(screen.getByTestId('transform-check'));
    expect(screen.queryByText('Correct')).toBeTruthy();
    loose.unmount();

    await db.setStrictAccents(true);
    const strict = render(<GrammarDrill topic={lesson} learnedLang="es" contentLang="en" onFinish={jest.fn()} kinds={['transform']} />);
    await flush();
    fireEvent.changeText(screen.getByTestId('transform-input'), 'Comi pan.');
    fireEvent.press(screen.getByTestId('transform-check'));
    expect(screen.queryByText('Correct answer')).toBeTruthy();
    strict.unmount();

    await db.setStrictAccents(false);
  });

  it('F toggles the translation on and off', async () => {
    render(<GrammarDrill topic={lesson} learnedLang="es" contentLang="en" onFinish={jest.fn()} kinds={['transform']} />);
    await flush();
    expect(screen.queryByText('I eat bread.')).toBeFalsy();
    fireEvent.press(screen.getByTestId('transform-f'));
    expect(screen.queryByText('I eat bread.')).toBeTruthy();
    fireEvent.press(screen.getByTestId('transform-f'));
    expect(screen.queryByText('I eat bread.')).toBeFalsy();
  });

  it('next advances to the 2nd item with an empty input (key remount), then finishes', async () => {
    const onFinish = jest.fn();
    render(<GrammarDrill topic={lesson} learnedLang="es" contentLang="en" onFinish={onFinish} kinds={['transform']} />);
    await flush();

    fireEvent.changeText(screen.getByTestId('transform-input'), 'Comí pan.');
    fireEvent.press(screen.getByTestId('transform-check'));
    fireEvent.press(screen.getByTestId('transform-next'));

    expect((screen.getByTestId('transform-input') as any).props.value).toBe('');

    fireEvent.changeText(screen.getByTestId('transform-input'), 'Habló con su madre.');
    fireEvent.press(screen.getByTestId('transform-check'));
    fireEvent.press(screen.getByTestId('transform-next'));

    expect(onFinish).toHaveBeenCalledWith(2, 2);
  });
});
