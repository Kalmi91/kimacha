// NY3 (NYELVTAN.md "Első szelet"): mondat-átírás drill a lecke-drillben. A
// `kinds={['transform']}` mintáját a grammarDrillWhy.test.tsx adja (D3, FB290).

jest.mock('@/lib/database', () => jest.requireActual('@/lib/database.web'));

import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { getDb } from '@/lib/database';
import GrammarDrill from '../grammar/GrammarDrill';
import type { LessonV2 } from '@/lib/grammar/lessonTypes';

jest.mock('@/lib/ThemeContext', () => ({
  useTheme: () => ({ theme: 'light' }),
}));

// A `db.getStrictAccents()` a mount-effektben fut, egy mikrotaszk-fordulóval
// később; a szigor-tesztnek meg kell várnia, mielőtt a mezőt kitölti.
const flush = async () => {
  await act(async () => {
    await Promise.resolve();
  });
};

const lesson: LessonV2 = {
  schema: 2,
  topic: 'test-transform',
  level: 'A2',
  title: { hu: 't', en: 't', es: 't', de: 't' },
  body: [],
  speak: { hu: 'h', en: 'e', es: 's', de: 'd' },
  items: [
    {
      kind: 'transform',
      id: 'tr-01',
      tense: { from: 'presente', to: 'indefinido' },
      prompt: { hu: 'Eszem kenyeret.', en: 'I eat bread.', es: 'Como pan.', de: 'Ich esse Brot.' },
      answer: 'Comí pan.',
      accept: ['Yo comí pan.'],
      wordIds: ['1', '2'],
      why: { hu: 'ok', en: 'why', es: 'porque', de: 'weil' },
    },
    {
      kind: 'transform',
      id: 'tr-02',
      tense: { from: 'presente', to: 'indefinido' },
      prompt: { hu: 'Beszél anyjával.', en: 'She talks to her mother.', es: 'Habla con su madre.', de: 'Sie spricht mit ihrer Mutter.' },
      answer: 'Habló con su madre.',
      wordIds: ['3'],
      why: { hu: 'ok2', en: 'why2', es: 'porque2', de: 'weil2' },
    },
  ],
};

describe('GrammarDrill: transform item', () => {
  it('kinds={["transform"]} shows the sentence, tense badge and input', () => {
    render(<GrammarDrill topic={lesson} learnedLang="es" contentLang="hu" onFinish={jest.fn()} kinds={['transform']} />);
    expect(screen.queryByText('Como pan.')).toBeTruthy();
    expect(screen.queryByText('Presente → Pretérito indefinido')).toBeTruthy();
    expect(screen.queryByTestId('transform-input')).toBeTruthy();
  });

  it('correct answer shows the "Correct" box + why, and next advances', () => {
    const onFinish = jest.fn();
    render(<GrammarDrill topic={lesson} learnedLang="es" contentLang="hu" onFinish={onFinish} kinds={['transform']} />);

    fireEvent.changeText(screen.getByTestId('transform-input'), 'Comí pan.');
    fireEvent.press(screen.getByTestId('transform-check'));
    expect(screen.queryByText('Correct')).toBeTruthy();
    expect(screen.queryByText('ok')).toBeTruthy();

    fireEvent.press(screen.getByTestId('transform-next'));
    expect(screen.queryByText('Habla con su madre.')).toBeTruthy();
  });

  it('wrong answer shows "Correct answer" + the answer + why', () => {
    const onFinish = jest.fn();
    render(<GrammarDrill topic={lesson} learnedLang="es" contentLang="hu" onFinish={onFinish} kinds={['transform']} />);

    fireEvent.changeText(screen.getByTestId('transform-input'), 'como cosas raras');
    fireEvent.press(screen.getByTestId('transform-check'));
    expect(screen.queryByText('Correct answer')).toBeTruthy();
    expect(screen.queryByText('Comí pan.')).toBeTruthy();
    expect(screen.queryByText('ok')).toBeTruthy();
  });

  it('accepts a missing-accent answer loosely, rejects it under strict accents', async () => {
    const db = getDb();
    await db.setOnboarding('hu', 'es');

    await db.setStrictAccents(false);
    const loose = render(<GrammarDrill topic={lesson} learnedLang="es" contentLang="hu" onFinish={jest.fn()} kinds={['transform']} />);
    await flush();
    fireEvent.changeText(screen.getByTestId('transform-input'), 'Comi pan.');
    fireEvent.press(screen.getByTestId('transform-check'));
    expect(screen.queryByText('Correct')).toBeTruthy();
    loose.unmount();

    await db.setStrictAccents(true);
    const strict = render(<GrammarDrill topic={lesson} learnedLang="es" contentLang="hu" onFinish={jest.fn()} kinds={['transform']} />);
    await flush();
    fireEvent.changeText(screen.getByTestId('transform-input'), 'Comi pan.');
    fireEvent.press(screen.getByTestId('transform-check'));
    expect(screen.queryByText('Correct answer')).toBeTruthy();
    strict.unmount();

    await db.setStrictAccents(false);
  });

  it('F toggles the translation on and off', () => {
    render(<GrammarDrill topic={lesson} learnedLang="es" contentLang="hu" onFinish={jest.fn()} kinds={['transform']} />);
    expect(screen.queryByText('Eszem kenyeret.')).toBeFalsy();
    fireEvent.press(screen.getByTestId('transform-f'));
    expect(screen.queryByText('Eszem kenyeret.')).toBeTruthy();
    fireEvent.press(screen.getByTestId('transform-f'));
    expect(screen.queryByText('Eszem kenyeret.')).toBeFalsy();
  });

  it('next advances to the 2nd item with an empty input (key remount), then finishes', () => {
    const onFinish = jest.fn();
    render(<GrammarDrill topic={lesson} learnedLang="es" contentLang="hu" onFinish={onFinish} kinds={['transform']} />);

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
