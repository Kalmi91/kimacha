// the round-end screen (screen 3): big correct-ratio + combo sticker,
// 3 small boxes, "practice this" with the wrong sentence, topic progress in segments,
// no XP. Mock pattern: lessonV2.play.test.tsx.

jest.mock('@/lib/database', () => jest.requireActual('@/lib/database.web'));
jest.mock('expo-speech', () => ({
  speak: jest.fn(),
  stop: jest.fn(),
  getAvailableVoicesAsync: jest.fn(async () => []),
}));
jest.mock('@/lib/speech', () => ({
  speak: jest.fn(),
  speakSequence: jest.fn(),
  stopSpeaking: jest.fn(),
}));
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), push: jest.fn(), replace: jest.fn() }),
  usePathname: () => '/grammar',
  useFocusEffect: (cb: () => void) => {
    const { useEffect } = require('react');
    useEffect(cb, []);
  },
  useLocalSearchParams: () => ({ topic: 'ser-estar' }),
}));

import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { getDb } from '@/lib/database.web';
import { lessonFor } from '@/lib/grammar/syllabus';
import { buildGrammarRound, isChoiceRoundItem } from '@/lib/games/grammarChoice';
import { hashString } from '@/lib/shuffle';
import { isMarkItem } from '@/lib/games/content';
import { ThemeProvider } from '@/lib/ThemeContext';
import GrammarLessonScreen from '../[topic]';

const flush = async (times = 4) => {
  for (let i = 0; i < times; i++) {
    await act(async () => {
      await Promise.resolve();
    });
  }
};

describe('kör vége, neo-brutalista (NY24)', () => {
  const now = 1700000000000;
  beforeEach(async () => {
    const db = getDb();
    await db.setOnboarding('en', 'es');
    (db as any).__setLevelForTest('A1');
    await db.setGrammarPalette('brand');
    jest.spyOn(Date, 'now').mockReturnValue(now);
  });
  afterEach(() => (Date.now as jest.Mock).mockRestore());

  const play = async (wrongAt: number | null) => {
    const lesson = lessonFor('es', 'ser-estar')!;
    const round = buildGrammarRound(lesson, hashString(`${lesson.topic}:${now}`)).filter(isChoiceRoundItem);
    render(<ThemeProvider><GrammarLessonScreen /></ThemeProvider>);
    await flush();
    fireEvent.press(screen.getByTestId('grammar-start-choice'));
    await flush(1);
    for (let i = 0; i < round.length; i++) {
      const item = round[i];
      const idx = wrongAt === i ? (item.correctIndex + 1) % Math.max(2, item.options.length) : item.correctIndex;
      if (isMarkItem(item.item)) fireEvent.press(screen.getAllByTestId('grammar-mark-word')[idx]);
      else fireEvent.press(screen.getAllByTestId('grammar-option')[idx]);
      await flush(1);
      fireEvent.press(screen.getByTestId('grammar-next'));
      await flush(1);
    }
    return round.length;
  };

  it('minden helyes: nagy arány, combo-matrica a legjobb sorozattal, nincs "practice this"', async () => {
    const total = await play(null);
    expect(screen.getByTestId('grammar-score')).toHaveTextContent(new RegExp(`^${total}/${total}`));
    expect(screen.queryByText(`combo x${total}`)).toBeTruthy();
    expect(screen.queryByTestId('grammar-practice-this')).toBeNull();
    expect(screen.queryByText('correct')).toBeTruthy();
    expect(screen.queryByText('time')).toBeTruthy();
    expect(screen.queryByText('streak')).toBeTruthy();
    expect(screen.queryByTestId('grammar-practice-again')).toBeTruthy();
    expect(screen.queryByTestId('grammar-lesson-percent')).toBeTruthy();
    // No XP: only the correct-ratio is in the big box.
    expect(screen.queryByText(/XP/)).toBeNull();
  });

  it('egy rontás: a combo a rontás előtti / utáni legjobb sorozat, a rontott mondat a "practice this" dobozban', async () => {
    const total = await play(2);
    expect(screen.getByTestId('grammar-score')).toHaveTextContent(new RegExp(`^${total - 1}/${total}`));
    expect(screen.queryByTestId('grammar-practice-this')).toBeTruthy();
    expect(screen.queryByText('practice this')).toBeTruthy();
    expect(screen.queryByText(`combo x${Math.max(2, total - 3)}`)).toBeTruthy();
  });
});
