// The sentence-transformation drill in an English lesson (E195): the sentence to rewrite is `prompt.en`, the F button shows
// the learner's translation, the answer is typed, checked and read aloud in English, and the badge and the rewrite label
// use the English form ids. The Spanish behaviour is pinned by grammarDrillTransform.test.tsx.

import { act, fireEvent, render, screen } from '@testing-library/react-native';

import GrammarDrill from '../grammar/GrammarDrill';
import { speak } from '@/lib/speech';
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

const lesson: LessonV2 = {
  schema: 2,
  topic: 'test-transform-en',
  level: 'A1',
  title: { en: 't', es: 't' },
  body: [],
  speak: { en: 'e', es: 's' },
  items: [
    {
      kind: 'transform',
      id: 'tr-en-01',
      tense: { from: 'en-statement', to: 'en-negative' },
      prompt: { en: 'She works in a bank.', es: 'Ella trabaja en un banco.', hu: 'Bankban dolgozik.' },
      answer: 'She does not work in a bank.',
      accept: ["She doesn't work in a bank."],
      wordIds: [],
      why: { en: 'does not + base verb', es: 'does not + verbo base', hu: 'does not + alapalak' },
    },
    {
      kind: 'transform',
      id: 'tr-en-02',
      tense: { from: 'en-statement', to: 'en-question' },
      prompt: { en: 'You live here.', es: 'Vives aquí.' },
      answer: 'Do you live here?',
      wordIds: [],
      why: { en: 'Do + subject + base verb', es: 'Do + sujeto + verbo base' },
    },
  ],
};

const renderEn = (contentLang: string, onFinish = jest.fn()) =>
  render(<GrammarDrill topic={lesson} learnedLang="en" contentLang={contentLang as 'es'} onFinish={onFinish} kinds={['transform']} />);

describe('GrammarDrill: transform item in an English lesson', () => {
  beforeEach(() => (speak as jest.Mock).mockClear());

  it('shows the English sentence, the badge and the rewrite label in the learner language, the input asks for English', async () => {
    renderEn('es');
    await flush();
    expect(screen.queryByText('She works in a bank.')).toBeTruthy();
    expect(screen.queryByText('Ella trabaja en un banco.')).toBeFalsy();
    expect(screen.queryByText('afirmación → negación')).toBeTruthy();
    expect(screen.queryByText('Rewrite in the negación')).toBeTruthy();
    expect(screen.getByTestId('transform-input').props.placeholder).toBe('Type in English');
  });

  it('the labels follow the learner language (hu)', async () => {
    renderEn('hu');
    await flush();
    expect(screen.queryByText('állító mondat → tagadó mondat')).toBeTruthy();
    expect(screen.queryByText('Rewrite in the tagadó mondat')).toBeTruthy();
  });

  it('F shows the translation in the learner language (hu overlay, else es)', async () => {
    const hu = renderEn('hu');
    await flush();
    fireEvent.press(screen.getByTestId('transform-f'));
    expect(screen.queryByText('Bankban dolgozik.')).toBeTruthy();
    hu.unmount();

    renderEn('es');
    await flush();
    fireEvent.press(screen.getByTestId('transform-f'));
    expect(screen.queryByText('Ella trabaja en un banco.')).toBeTruthy();
  });

  it('a right answer (also an accepted contraction) is correct, shows the explanation, and is read aloud in English', async () => {
    renderEn('es');
    await flush();
    fireEvent.changeText(screen.getByTestId('transform-input'), "She doesn't work in a bank.");
    fireEvent.press(screen.getByTestId('transform-check'));
    expect(screen.queryByText('Correct')).toBeTruthy();
    expect(screen.queryByText('does not + verbo base')).toBeTruthy();
    expect(speak).toHaveBeenCalledWith('She does not work in a bank.', 'en-US');
  });

  it('a wrong answer shows the English answer and the explanation, and is read aloud in English', async () => {
    renderEn('es');
    await flush();
    fireEvent.changeText(screen.getByTestId('transform-input'), 'She does not works in a bank.');
    fireEvent.press(screen.getByTestId('transform-check'));
    expect(screen.queryByText('She does not work in a bank.')).toBeTruthy();
    expect(screen.queryByText('does not + verbo base')).toBeTruthy();
    expect(screen.queryByText('Correct')).toBeFalsy();
    expect(speak).toHaveBeenCalledWith('She does not work in a bank.', 'en-US');
  });

  it('next advances to the 2nd English item', async () => {
    renderEn('es');
    await flush();
    fireEvent.changeText(screen.getByTestId('transform-input'), 'She does not work in a bank.');
    fireEvent.press(screen.getByTestId('transform-check'));
    fireEvent.press(screen.getByTestId('transform-next'));
    expect(screen.queryByText('You live here.')).toBeTruthy();
  });
});
