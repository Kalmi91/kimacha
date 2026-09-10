// FB219: the "tap the word class inside the sentence" drill, walked the way a
// learner walks it: read the prompt, tap a word, see the verdict.
import { fireEvent, render, screen } from '@testing-library/react-native';

import GrammarDrill from '../grammar/GrammarDrill';
import type { GrammarTopicData } from '@/lib/games/content';

jest.mock('@/lib/ThemeContext', () => ({
  useTheme: () => ({ theme: 'light' }),
}));

const topic: GrammarTopicData = {
  topic: 'test-mark',
  level: 'A1',
  title: { hu: 't', en: 't', es: 't', de: 't' },
  rule: { hu: 'r', en: 'r', es: 'r', de: 'r' },
  items: [
    {
      id: 'm1',
      kind: 'mark',
      sentence: 'Mi hermana come una manzana.',
      target: 'verb',
      answer: 'come',
      why: { hu: 'Az IGE a cselekvés.', en: 'w', es: 'w', de: 'w' },
      wrong: {
        hermana: { hu: 'A hermana FŐNÉV.', en: 'x', es: 'x', de: 'x' },
      },
      examples: ['El niño lee un libro.'],
    },
  ],
};

describe('mark-the-word-class drill', () => {
  it('asks for the word class and offers every word of the sentence', () => {
    render(<GrammarDrill topic={topic} learnedLang="es" contentLang="hu" onFinish={() => {}} />);

    // t() falls back to English until setLanguage() runs, as in every other test.
    expect(screen.queryByText('Tap the VERB in the sentence.')).toBeTruthy();
    // No option buttons: the sentence itself is the answer surface.
    expect(screen.queryAllByTestId('grammar-option')).toHaveLength(0);
    expect(screen.queryAllByTestId('grammar-mark-word')).toHaveLength(5);
  });

  it('accepts the right word and explains why', () => {
    const onFinish = jest.fn();
    render(<GrammarDrill topic={topic} learnedLang="es" contentLang="hu" onFinish={onFinish} />);

    fireEvent.press(screen.getByText('come'));
    expect(screen.queryByText('Az IGE a cselekvés.')).toBeTruthy();

    fireEvent.press(screen.getByTestId('grammar-next'));
    expect(onFinish).toHaveBeenCalledWith(1, 1);
  });

  it('names why the tapped word is not the one asked for', () => {
    const onFinish = jest.fn();
    render(<GrammarDrill topic={topic} learnedLang="es" contentLang="hu" onFinish={onFinish} />);

    fireEvent.press(screen.getByText('hermana'));
    expect(screen.queryByText('A hermana FŐNÉV.')).toBeTruthy();

    fireEvent.press(screen.getByTestId('grammar-next'));
    expect(onFinish).toHaveBeenCalledWith(0, 1);
  });

  it('falls back to a generic reason for a word with no authored explanation', () => {
    render(<GrammarDrill topic={topic} learnedLang="es" contentLang="hu" onFinish={() => {}} />);

    fireEvent.press(screen.getByText('manzana'));
    expect(screen.queryByText('Not this one. Look for the word that plays that role.')).toBeTruthy();
  });
});
