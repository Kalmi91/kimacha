// FB691-FB695: the round-end ("done") screen of a lesson drill, both skins: the result as one number ("4/5"), the
// "Mistakes:" list with every wrong answer (what the learner gave and the right solution), and exactly three buttons:
// Retake, back to the lesson (FB742), and back to the grammar part. No Time / Correct boxes, no "next test type", no lesson-test line.

const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, push: jest.fn(), replace: jest.fn() }),
}));
let mockTheme = 'light';
jest.mock('@/lib/ThemeContext', () => ({
  useTheme: () => ({ theme: mockTheme }),
}));

import { View } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';

import GrammarRoundEnd from '@/components/grammar/GrammarRoundEnd';
import type { RoundStats } from '@/components/grammar/GrammarDrill';
import type { GrammarMiss } from '@/lib/grammar/roundMiss';
import { t } from '@/lib/i18n';

const setPhase = jest.fn();
const setScore = jest.fn();

const miss = (n: number): GrammarMiss => ({ prompt: `Prompt ${n} ___`, given: `wrong${n}`, correct: `right${n}` });
const show = (misses: GrammarMiss[]) => {
  const roundStats: RoundStats = { bestCombo: 0, seconds: 42, misses };
  return render(
    <GrammarRoundEnd
      score={{ correct: 4, total: 5 }}
      progressRows={[]}
      roundStats={roundStats}
      prevPct={null}
      header={<View />}
      lessonScoreOf={() => 80}
      setPhase={setPhase}
      setScore={setScore}
    />
  );
};

describe.each([
  ['classic', 'light'],
  ['brutal', 'brand-light'],
])('round end, three buttons, %s skin', (_skin, theme) => {
  beforeEach(() => {
    mockTheme = theme;
    jest.clearAllMocks();
  });

  it('one number, exactly three ordered buttons, nothing of the old boxes', () => {
    show([]);
    const s = t().grammar;
    expect(screen.getByTestId('grammar-score')).toHaveTextContent('4/5');
    expect(screen.getByText(s.retakeTest)).toBeTruthy();
    expect(screen.getByTestId('grammar-back-to-lesson')).toHaveTextContent(t().tableDeck.backToLesson);
    expect(screen.getByText(s.backToGrammar)).toBeTruthy();
    expect(screen.getAllByRole('button').map((button) => button.props.testID)).toEqual([
      'grammar-practice-again', 'grammar-back-to-lesson', 'grammar-back-course',
    ]);
    for (const gone of ['grammar-next-type', 'grammar-lessontest-note', 'grammar-start-lessontest', 'grammar-practice-this']) {
      expect(screen.queryByTestId(gone)).toBeNull();
    }
    expect(screen.queryByText('time')).toBeNull();
    expect(screen.queryByText('correct')).toBeNull();
    expect(screen.queryByText(s.mistakesTitle)).toBeNull();
  });

  it.each([1, 3])('lists %i mistakes with the given answer and the right solution', (n) => {
    show(Array.from({ length: n }, (_, i) => miss(i + 1)));
    expect(screen.getByText(t().grammar.mistakesTitle)).toBeTruthy();
    expect(screen.getAllByTestId('grammar-mistake')).toHaveLength(n);
    for (let i = 1; i <= n; i++) {
      expect(screen.getByText(`wrong${i}`)).toBeTruthy();
      expect(screen.getByText(`right${i}`)).toBeTruthy();
    }
  });

  it('retake starts a new round; back goes back', () => {
    show([]);
    fireEvent.press(screen.getByTestId('grammar-practice-again'));
    expect(setScore).toHaveBeenCalledWith(null);
    expect(setPhase).toHaveBeenCalledWith('drill');
    fireEvent.press(screen.getByTestId('grammar-back-course'));
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('back to the lesson opens the lesson without resetting the score or leaving the topic', () => {
    show([]);
    fireEvent.press(screen.getByTestId('grammar-back-to-lesson'));
    expect(setPhase).toHaveBeenCalledWith('lesson');
    expect(setScore).not.toHaveBeenCalled();
    expect(mockBack).not.toHaveBeenCalled();
  });
});
