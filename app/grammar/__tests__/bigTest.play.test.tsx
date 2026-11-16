// The grammar Big test screen (placement test), played the way a learner plays it, with the real screen and the real data:
// right / wrong / "I mistyped" / "I don't know", the end of a level, pass then Continue, fail then the result, leaving
// mid-level and coming back, the stored result, ?new=1, and the feedback button in every state.
// Mock pattern: levelTest.play.test.tsx.

const mockBack = jest.fn();
const mockPush = jest.fn();
let mockParams: { new?: string } = {};
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, push: mockPush, replace: jest.fn() }),
  usePathname: () => '/grammar',
  useFocusEffect: (cb: () => void) => {
    const { useEffect } = require('react');
    useEffect(cb, []);
  },
  useLocalSearchParams: () => mockParams,
}));
// the feedback button shows which part of the test it is about
jest.mock('@/components/FeedbackModal', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: (p: { currentCard: string; languagePair: string; level: string }) => (
      <Text testID="fb-card">{`${p.currentCard} | ${p.languagePair} | ${p.level}`}</Text>
    ),
  };
});

import { fireEvent, render, screen } from '@testing-library/react-native';

import { getDb } from '@/lib/database.web';
import { bigTestItems, bigTestResultKey, bigTestRunKey, type BigTestLevel } from '@/lib/grammar/bigTest';
import { hasLesson } from '@/lib/grammar/syllabus';
import { loadResumeValue, saveResumeValue } from '@/lib/resumeStore';
import { ThemeProvider } from '@/lib/ThemeContext';
import BigTestScreen from '../big-test';
import { makeFlush } from '@/test-utils/flush';

jest.setTimeout(60000);

const PAIR = 'en→es';
const flush = makeFlush(6);
// a controllable clock: the screen ignores option / "I don't know" taps for 500 ms after a question appears
let mockNow = 1_700_000_000_000;
const press = async (testID: string) => {
  fireEvent.press(screen.getByTestId(testID));
  await flush();
  // the learner takes a moment before answering the next question
  if (testID === 'big-test-next' || testID === 'big-test-continue' || testID === 'big-test-restart') mockNow += 600;
};
const text = (testID: string) => {
  const c = screen.getByTestId(testID).props.children;
  return Array.isArray(c) ? c.join('') : String(c);
};
const has = (testID: string) => screen.queryByTestId(testID) !== null;
const card = () => text('fb-card').split(' | ')[0];

// the item on screen: level from the header, position from the counter n
const current = () => {
  const [level, count] = text('big-test-header').split(' · ');
  const n = Number(count.split('/')[0]);
  const items = bigTestItems('es', level as BigTestLevel);
  return items[(n - 1) % 9];
};
const answerRight = () => press(`big-test-option-${current().correct}`);
const answerWrong = () => press(`big-test-option-${(current().correct + 1) % 4}`);
// plays the 9 questions of the level on screen: the first `rights` right, the others wrong; ends on the level end
const playLevel = async (rights: number) => {
  for (let i = 0; i < 9; i++) {
    if (i < rights) await answerRight();
    else await answerWrong();
    await press('big-test-next');
  }
};

describe.each(['brand', 'classic'] as const)('grammar Big test (%s palette)', (palette) => {
  beforeEach(async () => {
    jest.clearAllMocks();
    mockParams = {};
    mockNow = 1_700_000_000_000;
    jest.spyOn(Date, 'now').mockImplementation(() => mockNow);
    const db = getDb();
    await db.setOnboarding('en', 'es');
    (db as any).__setLevelForTest('A1');
    await db.setGrammarPalette(palette);
    await saveResumeValue(db, bigTestRunKey(PAIR), null);
    await saveResumeValue(db, bigTestResultKey(PAIR), null);
  });

  afterEach(() => (Date.now as jest.Mock).mockRestore());

  const open = async () => {
    const view = render(
      <ThemeProvider>
        <BigTestScreen />
      </ThemeProvider>
    );
    await flush();
    return view;
  };

  it('starts a new run: A1, question 1 of 45, the gap lines, four options and "I don\'t know"', async () => {
    await open();
    expect(text('big-test-header')).toBe('A1 · 1/45');
    expect(text('big-test-instruction')).toBe('Fill the gap');
    expect(text('big-test-line-0')).toBe(bigTestItems('es', 'A1')[0].kind === 'gap' ? (bigTestItems('es', 'A1')[0] as any).lines[0] : '');
    for (let i = 0; i < 4; i++) expect(has(`big-test-option-${i}`)).toBe(true);
    expect(has('big-test-idk')).toBe(true);
    expect(has('big-test-next')).toBe(false);
    expect(card()).toBe('grammar-big-test:A1:es-bt-a1-01');
  });

  it('a right answer locks the options, marks the check and offers Next only', async () => {
    await open();
    await answerRight();
    expect(screen.getByTestId(`big-test-option-${current().correct}`)).toHaveTextContent(/✓/);
    expect(has('big-test-next')).toBe(true);
    expect(has('big-test-mistyped')).toBe(false);
    expect(has('big-test-idk')).toBe(false);
    // locked: a second tap on another option changes nothing
    await press(`big-test-option-${(current().correct + 1) % 4}`);
    expect(text('big-test-header')).toBe('A1 · 1/45');
    await press('big-test-next');
    expect(text('big-test-header')).toBe('A1 · 2/45');
  });

  it('a wrong answer shows the cross and the right one, then "I mistyped" counts it as right once', async () => {
    await open();
    const item = current();
    await answerWrong();
    expect(screen.getByTestId(`big-test-option-${(item.correct + 1) % 4}`)).toHaveTextContent(/✗/);
    expect(screen.getByTestId(`big-test-option-${item.correct}`)).toHaveTextContent(/✓/);
    expect(card()).toBe('grammar-big-test:A1:es-bt-a1-01');
    await press('big-test-mistyped');
    expect(has('big-test-mistyped')).toBe(false);
    expect(text('big-test-mistyped-done')).toBe('Counted as right');
    const saved = (await loadResumeValue(getDb(), bigTestRunKey(PAIR))) as { answers: { right: boolean; mistyped?: boolean }[] };
    expect(saved.answers[0]).toMatchObject({ right: true, mistyped: true });
  });

  it('a tap on "I don\'t know" or an option within 500 ms of a new question records nothing', async () => {
    await open();
    await answerRight();
    await press('big-test-next');
    mockNow -= 600; // the double tap: no time passed since Next
    await press('big-test-idk');
    await press('big-test-option-0');
    expect(text('big-test-header')).toBe('A1 · 2/45');
    expect(has('big-test-idk')).toBe(true);
    expect(has('big-test-next')).toBe(false);
    mockNow += 600;
    await press('big-test-idk');
    expect(has('big-test-next')).toBe(true);
    expect(has('big-test-idk')).toBe(false);
  });

  it('the first question after Continue has the same guard', async () => {
    await open();
    await playLevel(9);
    mockNow -= 600;
    await press('big-test-continue');
    mockNow -= 600;
    await press('big-test-idk');
    expect(text('big-test-header')).toBe('A2 · 10/45');
    expect(has('big-test-next')).toBe(false);
    mockNow += 600;
    await press('big-test-idk');
    expect(has('big-test-next')).toBe(true);
  });

  it('"I don\'t know" counts as wrong and offers no "I mistyped"', async () => {
    await open();
    await press('big-test-idk');
    expect(has('big-test-mistyped')).toBe(false);
    expect(has('big-test-next')).toBe(true);
    expect(screen.getByTestId(`big-test-option-${current().correct}`)).toHaveTextContent(/✓/);
    const saved = (await loadResumeValue(getDb(), bigTestRunKey(PAIR))) as { answers: { picked: number | null; right: boolean }[] };
    expect(saved.answers[0]).toMatchObject({ picked: null, right: false });
  });

  it('after the 9th answer the level end comes; passed, Continue goes to A2 question 10', async () => {
    await open();
    await playLevel(7);
    expect(text('big-test-level-title')).toBe('A1 passed · 7 of 9 right');
    expect(text('big-test-next-level')).toBe('Next: A2 · 9 questions');
    expect(has('big-test-stop')).toBe(true);
    expect(card()).toBe('grammar-big-test:level-end:A1');
    await press('big-test-continue');
    expect(text('big-test-header')).toBe('A2 · 10/45');
  });

  it('a failed level ends the test: "The test ends here", See result, the level and its rows', async () => {
    await open();
    await playLevel(5);
    expect(text('big-test-level-title')).toBe('A1 · 5 of 9 right');
    expect(text('big-test-ends')).toBe('The test ends here');
    expect(has('big-test-continue')).toBe(false);
    await press('big-test-see-result');
    expect(text('big-test-result-level')).toBe('Your level: A1');
    expect(card()).toBe('grammar-big-test:result');
    expect(screen.getByTestId('big-test-level-row-A1')).toHaveTextContent(/5\/9/);
    expect(screen.getByTestId('big-test-level-row-A2')).toHaveTextContent(/–/);
    expect(screen.getByTestId('big-test-level-row-C1')).toBeTruthy();
    // the run is gone, the result is stored
    expect(await loadResumeValue(getDb(), bigTestRunKey(PAIR))).toBeNull();
    expect(((await loadResumeValue(getDb(), bigTestResultKey(PAIR))) as { level: string }).level).toBe('A1');
  });

  it('the result lists topics to practise with a Lesson button to the lesson, and the strong ones', async () => {
    await open();
    // the first 5 right, the last 4 wrong
    await playLevel(5);
    await press('big-test-see-result');
    const items = bigTestItems('es', 'A1');
    const wrongTopics = items.slice(5).map((it) => it.topic);
    const strongTopics = items.slice(0, 5).map((it) => it.topic);
    for (const tp of wrongTopics) expect(has(`big-test-practice-${tp}`)).toBe(true);
    for (const tp of strongTopics) expect(has(`big-test-strong-${tp}`)).toBe(true);
    const withLesson = wrongTopics.find((tp) => hasLesson('es', tp));
    expect(withLesson).toBeTruthy();
    await press(`big-test-lesson-${withLesson}`);
    expect(mockPush).toHaveBeenCalledWith(`/grammar/${withLesson}`);
    // a topic without a lesson would show its row without the button
    for (const tp of wrongTopics) expect(has(`big-test-lesson-${tp}`)).toBe(hasLesson('es', tp));
    await press('big-test-done');
    expect(mockBack).toHaveBeenCalled();
  });

  it('Stop here after a passed level gives A2', async () => {
    await open();
    await playLevel(6);
    await press('big-test-stop');
    expect(text('big-test-result-level')).toBe('Your level: A2');
  });

  it('after C1 only See result is offered', async () => {
    await open();
    for (const level of ['A1', 'A2', 'B1', 'B2']) {
      await playLevel(9);
      expect(text('big-test-level-title')).toContain(`${level} passed`);
      await press('big-test-continue');
    }
    await playLevel(9);
    expect(text('big-test-level-title')).toBe('C1 passed · 9 of 9 right');
    expect(has('big-test-continue')).toBe(false);
    expect(has('big-test-stop')).toBe(false);
    await press('big-test-see-result');
    expect(text('big-test-result-level')).toBe('Your level: C1');
  });

  it('leaving mid-level and coming back resumes the same question and position', async () => {
    const first = await open();
    await answerRight();
    await press('big-test-next');
    await answerWrong();
    first.unmount();
    await open();
    // still on the answered state of question 2, options locked
    expect(text('big-test-header')).toBe('A1 · 2/45');
    expect(has('big-test-next')).toBe(true);
    await press('big-test-next');
    expect(text('big-test-header')).toBe('A1 · 3/45');
    expect(mockBack).not.toHaveBeenCalled();
  });

  it('the close button leaves at once', async () => {
    await open();
    await press('big-test-close');
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('a stored result shows on re-entry; ?new=1 starts over and drops a run in progress', async () => {
    const first = await open();
    await playLevel(5);
    await press('big-test-see-result');
    first.unmount();
    const again = await open();
    expect(text('big-test-result-level')).toBe('Your level: A1');
    expect(card()).toBe('grammar-big-test:result');
    again.unmount();

    mockParams = { new: '1' };
    const fresh = await open();
    expect(text('big-test-header')).toBe('A1 · 1/45');
    await answerRight();
    fresh.unmount();
    // a run in progress resumes without ?new
    mockParams = {};
    const resumed = await open();
    expect(text('big-test-header')).toBe('A1 · 1/45');
    expect(has('big-test-next')).toBe(true);
    resumed.unmount();
    // and ?new=1 drops it
    mockParams = { new: '1' };
    await open();
    expect(has('big-test-next')).toBe(false);
    expect(text('big-test-header')).toBe('A1 · 1/45');
  });

  it('"Start again" on the result begins a new run', async () => {
    await open();
    await playLevel(5);
    await press('big-test-see-result');
    await press('big-test-restart');
    expect(text('big-test-header')).toBe('A1 · 1/45');
  });

  it('the feedback button is mounted in all four states with its card', async () => {
    await open();
    expect(card()).toBe('grammar-big-test:A1:es-bt-a1-01');
    await answerRight();
    expect(card()).toBe('grammar-big-test:A1:es-bt-a1-01');
    await press('big-test-next');
    for (let i = 1; i < 9; i++) {
      await answerWrong();
      await press('big-test-next');
    }
    expect(card()).toBe('grammar-big-test:level-end:A1');
    await press('big-test-see-result');
    expect(card()).toBe('grammar-big-test:result');
    expect(text('fb-card')).toContain(`| ${PAIR} | A1`);
  });
});
