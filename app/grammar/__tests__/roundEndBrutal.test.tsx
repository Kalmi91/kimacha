// the round-end screen (FB691-FB695): the result as one number, the "Mistakes:" list, topic progress, no XP. Mock pattern: lessonV2.play.test.tsx.

jest.mock('expo-speech', () => ({
  speak: jest.fn(),
  stop: jest.fn(),
  getAvailableVoicesAsync: jest.fn(async () => []),
}));
jest.mock('@/lib/speech', () => require('@/test-utils/mocks').speechMock());
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), push: jest.fn(), replace: jest.fn() }),
  usePathname: () => '/grammar',
  useFocusEffect: (cb: () => void) => {
    const { useEffect } = require('react');
    useEffect(cb, []);
  },
  useLocalSearchParams: () => ({ topic: 'ser-estar' }),
}));

import { fireEvent, render, screen } from '@testing-library/react-native';

import { getDb } from '@/lib/database.web';
import { lessonFor } from '@/lib/grammar/syllabus';
import { buildGrammarRound, isChoiceRoundItem } from '@/lib/games/grammarChoice';
import { hashString } from '@/lib/shuffle';
import { isMarkItem } from '@/lib/games/content';
import { ThemeProvider } from '@/lib/ThemeContext';
import GrammarLessonScreen from '../[topic]';
import { makeFlush } from '@/test-utils/flush';

const flush = makeFlush(4);

describe('round end, neo-brutalist', () => {
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

  it('everything correct: one number, no Time / Correct boxes, no mistakes list, two buttons', async () => {
    const total = await play(null);
    expect(screen.getByTestId('grammar-score')).toHaveTextContent(`${total}/${total}`);
    expect(screen.queryByTestId('grammar-mistakes')).toBeNull();
    expect(screen.queryByText('correct')).toBeNull();
    expect(screen.queryByText('time')).toBeNull();
    expect(screen.queryByTestId('grammar-practice-again')).toBeTruthy();
    expect(screen.queryByTestId('grammar-back-course')).toBeTruthy();
    expect(screen.queryByTestId('grammar-next-type')).toBeNull();
    expect(screen.queryByTestId('grammar-lesson-percent')).toBeTruthy();
    // No XP: only the result number.
    expect(screen.queryByText(/XP/)).toBeNull();
  });

  it('one mistake: the "Mistakes:" list holds what was picked and the right solution', async () => {
    const total = await play(2);
    expect(screen.getByTestId('grammar-score')).toHaveTextContent(`${total - 1}/${total}`);
    expect(screen.queryByText('Mistakes:')).toBeTruthy();
    expect(screen.getAllByTestId('grammar-mistake')).toHaveLength(1);
    expect(screen.getAllByTestId('grammar-mistake-given')).toHaveLength(1);
    expect(screen.getAllByTestId('grammar-mistake-correct')).toHaveLength(1);
  });});
