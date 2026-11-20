// E205: the round-end ("done") screen has exactly three buttons, in both skins: 1. Retake the test (a new round of the same
// kind), 2. Back to the course, 3. Next test type (the lesson's next kind; after the last one the lesson test, else the next
// topic, else no button). The score and the lesson-test note stay.

const mockBack = jest.fn();
const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, push: jest.fn(), replace: mockReplace }),
}));
let mockUnlocked = false;
jest.mock('@/lib/grammar/lessonTest', () => ({
  ...jest.requireActual('@/lib/grammar/lessonTest'),
  lessonTestUnlocked: () => mockUnlocked,
}));
let mockTheme = 'light';
jest.mock('@/lib/ThemeContext', () => ({
  useTheme: () => ({ theme: mockTheme }),
}));

import { View } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';

import GrammarRoundEnd from '@/components/grammar/GrammarRoundEnd';
import { lessonFor } from '@/lib/grammar/syllabus';
import { KIND_ORDER } from '@/lib/grammar/useGrammarTopic';
import type { GrammarKind } from '@/lib/games/content';
import { t } from '@/lib/i18n';

const TOPIC = 'presente-regular';
const counts = (kinds: GrammarKind[]) =>
  Object.fromEntries(KIND_ORDER.map((k) => [k, kinds.includes(k) ? 5 : 0])) as Record<GrammarKind, number>;

const setPhase = jest.fn();
const setScore = jest.fn();
const setDrillKind = jest.fn();
const onStartTest = jest.fn();

const show = (drillKind: GrammarKind, kinds: GrammarKind[], topicId = TOPIC) =>
  render(
    <GrammarRoundEnd
      score={{ correct: 4, total: 5 }}
      topicId={topicId}
      learnedLang="es"
      contentLang="en"
      lesson={lessonFor('es', topicId)!}
      progressRows={[]}
      roundStats={null}
      prevPct={null}
      drillKind={drillKind}
      kindCounts={counts(kinds)}
      lessonTestResult={null}
      onStartTest={onStartTest}
      header={<View />}
      lessonScoreOf={() => 80}
      setPhase={setPhase}
      setScore={setScore}
      setDrillKind={setDrillKind}
    />
  );

const order = () => {
  const json = JSON.stringify(screen.toJSON());
  return ['grammar-practice-again', 'grammar-back-course', 'grammar-next-type'].filter((id) => json.includes(`"${id}"`));
};

describe.each([
  ['classic', 'light'],
  ['brutal', 'brand-light'],
])('round end, three buttons, %s skin', (_skin, theme) => {
  beforeEach(() => {
    mockTheme = theme;
    mockUnlocked = false;
    jest.clearAllMocks();
  });

  it('exactly three buttons in order; the old ones are gone; score and test note stay', () => {
    show('choice', ['choice', 'match']);
    expect(order()).toEqual(['grammar-practice-again', 'grammar-back-course', 'grammar-next-type']);
    const s = t().grammar;
    expect(screen.getByText(s.retakeTest)).toBeTruthy();
    expect(screen.getByText(s.backToSyllabus)).toBeTruthy();
    expect(screen.getByText(s.nextTestType)).toBeTruthy();
    for (const gone of ['grammar-start-lessontest', 'grammar-next-topic', 'grammar-more-round']) expect(screen.queryByTestId(gone)).toBeNull();
    expect(screen.queryByText(s.backToRule)).toBeNull();
    expect(screen.queryByText(s.oneMoreRound)).toBeNull();
    expect(screen.getByTestId('grammar-lessontest-note')).toBeTruthy();
    expect(screen.getByText(/4\s*\/\s*5/)).toBeTruthy();
  });

  it('retake starts a new round of the same kind; back goes back', () => {
    show('choice', ['choice', 'match']);
    fireEvent.press(screen.getByTestId('grammar-practice-again'));
    expect(setScore).toHaveBeenCalledWith(null);
    expect(setPhase).toHaveBeenCalledWith('drill');
    expect(setDrillKind).not.toHaveBeenCalled();
    fireEvent.press(screen.getByTestId('grammar-back-course'));
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('next test type starts the next kind of the lesson', () => {
    show('choice', ['choice', 'match', 'why']);
    fireEvent.press(screen.getByTestId('grammar-next-type'));
    expect(setDrillKind).toHaveBeenCalledWith('match');
    expect(setScore).toHaveBeenCalledWith(null);
    expect(setPhase).toHaveBeenCalledWith('drill');
  });

  it('after the last kind it starts the lesson test (if ready)', () => {
    mockUnlocked = true;
    show('match', ['choice', 'match']);
    fireEvent.press(screen.getByTestId('grammar-next-type'));
    expect(onStartTest).toHaveBeenCalledTimes(1);
    expect(setDrillKind).not.toHaveBeenCalled();
  });

  it('after the last kind, lesson test not ready: next topic', () => {
    show('match', ['choice', 'match']);
    fireEvent.press(screen.getByTestId('grammar-next-type'));
    expect(onStartTest).not.toHaveBeenCalled();
    expect(mockReplace).toHaveBeenCalledWith(expect.stringMatching(/^\/grammar\//));
  });
});
