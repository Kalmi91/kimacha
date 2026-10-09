// a helyes mondat a nyelvtani feladatokban is elhangzik,
// jó és rossz válasz után is (a mondatkártyák tesztje: sentenceCards.test.tsx).

jest.mock('@/lib/speech', () => ({
  speak: jest.fn(),
  speakSequence: jest.fn(),
  stopSpeaking: jest.fn(),
}));

import { fireEvent, render, screen } from '@testing-library/react-native';

import GrammarDrill from '../grammar/GrammarDrill';
import type { LessonV2 } from '@/lib/grammar/lessonTypes';

jest.mock('@/lib/ThemeContext', () => ({
  useTheme: () => ({ theme: 'light' }),
}));

const speech = require('@/lib/speech') as { speak: jest.Mock };

const lesson: LessonV2 = {
  schema: 2,
  topic: 'speak-test',
  level: 'A1',
  title: { hu: 't', en: 't', es: 't', de: 't' },
  body: [],
  speak: { hu: 'h', en: 'e', es: 's', de: 'd' },
  items: [
    {
      id: 'gap-1',
      sentence: 'Yo ___ estudiante.',
      options: ['soy', 'estoy', 'eres'],
      correct: 0,
      why: { hu: 'w', en: 'why', es: 'w', de: 'w' },
      wrong: { estoy: { en: 'no' }, eres: { en: 'no' } },
      examples: [],
    },
  ],
};

describe('GrammarDrill: a helyes mondat elhangzik (FB412)', () => {
  beforeEach(() => speech.speak.mockClear());

  it('rossz válasz után a kitöltött helyes mondatot mondja', () => {
    render(<GrammarDrill topic={lesson} learnedLang="es" contentLang="en" onFinish={jest.fn()} />);
    fireEvent.press(screen.getByText('estoy')); // rossz
    expect(speech.speak).toHaveBeenCalledWith('Yo soy estudiante.', 'es-MX');
  });

  it('jó válasz után is', () => {
    render(<GrammarDrill topic={lesson} learnedLang="es" contentLang="en" onFinish={jest.fn()} />);
    fireEvent.press(screen.getByText('soy'));
    expect(speech.speak).toHaveBeenCalledWith('Yo soy estudiante.', 'es-MX');
  });
});
