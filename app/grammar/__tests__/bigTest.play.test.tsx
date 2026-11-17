// The grammar Big test screen (adaptive placement test), played the way a learner plays it, with the real screen and the
// real data: right / wrong / "I mistyped" / "I don't know", the end of a level (quick pass, fail), pass then Continue, fail
// then the result, leaving mid-level and coming back, the stored result, ?new=1, the progress bar (no question counter),
// and the feedback button in every state. The questions are drawn at random and in a different order of options each run,
// so the test reads what is on screen (the item from the feedback card, the shown order from the saved run) and only
// relies on rules (5 right from the start passes, 3 wrong fails), not on the size of the data set.
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

// the right / wrong sounds are audio: not in jest
jest.mock('@/lib/chime', () => ({ playChime: jest.fn(), playWrongSound: jest.fn() }));

import { fireEvent, render, screen } from '@testing-library/react-native';

import { playChime, playWrongSound } from '@/lib/chime';
import { getDb } from '@/lib/database.web';
import { BIG_TEST_LEVELS, bigTestOptionOrder, bigTestPool, bigTestResultKey, bigTestRunKey, type BigTestRun } from '@/lib/grammar/bigTest';
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
const currentLevel = () => BIG_TEST_LEVELS.find((l) => screen.getByTestId(`big-test-step-${l}`).props.accessibilityState?.selected);
const progress = () => Number(/(\d+)%/.exec(screen.getByTestId('big-test-progress').props.accessibilityLabel)![1]);

// the item on screen: its id is the last part of the feedback card
const itemId = () => card().split(':')[2];
const current = () => bigTestPool('es').find((it) => it.id === itemId())!;
const savedRun = async () => (await loadResumeValue(getDb(), bigTestRunKey(PAIR))) as BigTestRun;
// where an original option sits on screen (the options are shuffled by the seed of the run)
const shown = async (original: number) => bigTestOptionOrder(await savedRun(), current()).indexOf(original);
const answerRight = async () => press(`big-test-option-${await shown(current().correct)}`);
const answerWrong = async () => press(`big-test-option-${await shown((current().correct + 1) % 4)}`);
// answers questions until the level end comes; `how(i)` is the answer to the i-th question asked in this level
const playLevel = async (how: (i: number) => 'R' | 'W') => {
  for (let i = 0; i < 80 && !has('big-test-level-title'); i++) {
    if (how(i) === 'R') await answerRight();
    else await answerWrong();
    await press('big-test-next');
  }
  expect(has('big-test-level-title')).toBe(true);
};
const allRight = () => 'R' as const;
const allWrong = () => 'W' as const;

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

  it('starts a new run: the level name and a progress bar (no question counter), a question with four options and "I don\'t know"', async () => {
    await open();
    // "Question 1" with no total, and the five steps A1 to C1 with the first one current
    expect(text('big-test-header')).toBe('Question 1');
    expect(currentLevel()).toBe('A1');
    for (const l of BIG_TEST_LEVELS) expect(has(`big-test-step-${l}`)).toBe(true);
    expect(screen.queryByText(/\d+\s*\/\s*\d+/)).toBeNull();
    expect(has('big-test-progress')).toBe(true);
    expect(progress()).toBe(0);
    expect(['Fill the gap', 'Which statement is correct?', 'Which is the most formal?']).toContain(text('big-test-instruction'));
    const item = current();
    if (item.kind === 'gap') expect(text('big-test-line-0')).toBe(item.lines[0]);
    if (item.kind === 'which') expect(text('big-test-line-0')).toBe(`(1) ${item.lines[0]}`);
    for (let i = 0; i < 4; i++) expect(has(`big-test-option-${i}`)).toBe(true);
    expect(has('big-test-idk')).toBe(true);
    expect(has('big-test-next')).toBe(false);
    expect(card()).toMatch(/^grammar-big-test:A1:es-bt-a1-/);
  });

  it('a right answer locks the options, marks the check and offers Next only', async () => {
    await open();
    const first = itemId();
    await answerRight();
    expect(screen.getByTestId(`big-test-option-${await shown(current().correct)}`)).toHaveTextContent(/✓/);
    expect(has('big-test-next')).toBe(true);
    expect(has('big-test-mistyped')).toBe(false);
    expect(has('big-test-idk')).toBe(false);
    // locked: a second tap on another option changes nothing
    await press(`big-test-option-${await shown((current().correct + 1) % 4)}`);
    expect(itemId()).toBe(first);
    expect(has('big-test-next')).toBe(true);
    await press('big-test-next');
    expect(itemId()).not.toBe(first);
    // the steps moved on, and the question number counts up without a total
    expect(progress()).toBeGreaterThan(0);
    expect(text('big-test-header')).toBe('Question 2');
    expect(currentLevel()).toBe('A1');
  });

  it('a wrong answer shows the cross and the right one, then "I mistyped" counts it as right once', async () => {
    await open();
    const item = current();
    await answerWrong();
    expect(screen.getByTestId(`big-test-option-${await shown((item.correct + 1) % 4)}`)).toHaveTextContent(/✗/);
    expect(screen.getByTestId(`big-test-option-${await shown(item.correct)}`)).toHaveTextContent(/✓/);
    expect(card()).toBe(`grammar-big-test:A1:${item.id}`);
    await press('big-test-mistyped');
    expect(has('big-test-mistyped')).toBe(false);
    expect(text('big-test-mistyped-done')).toBe('Counted as right');
    const saved = await savedRun();
    expect(saved.answers[0]).toMatchObject({ right: true, mistyped: true });
    // the picked option is stored as the original index, not the shown position
    expect(saved.answers[0].picked).toBe((item.correct + 1) % 4);
  });

  it('a tap on "I don\'t know" or an option within 500 ms of a new question records nothing', async () => {
    await open();
    await answerRight();
    await press('big-test-next');
    const second = itemId();
    mockNow -= 600; // the double tap: no time passed since Next
    await press('big-test-idk');
    await press('big-test-option-0');
    expect(itemId()).toBe(second);
    expect(has('big-test-idk')).toBe(true);
    expect(has('big-test-next')).toBe(false);
    mockNow += 600;
    await press('big-test-idk');
    expect(has('big-test-next')).toBe(true);
    expect(has('big-test-idk')).toBe(false);
  });

  it('the first question after Continue has the same guard', async () => {
    await open();
    await playLevel(allRight);
    mockNow -= 600;
    await press('big-test-continue');
    mockNow -= 600;
    await press('big-test-idk');
    expect(currentLevel()).toBe('A2');
    expect(has('big-test-next')).toBe(false);
    mockNow += 600;
    await press('big-test-idk');
    expect(has('big-test-next')).toBe(true);
  });

  it('a right answer chimes, a wrong one plays the wrong sound, "I don\'t know" and a locked option stay silent', async () => {
    await open();
    await answerRight();
    expect(playChime).toHaveBeenCalledTimes(1);
    expect(playWrongSound).not.toHaveBeenCalled();
    await press(`big-test-option-${await shown((current().correct + 1) % 4)}`); // locked: no sound
    await press('big-test-next');
    await answerWrong();
    expect(playWrongSound).toHaveBeenCalledTimes(1);
    expect(playChime).toHaveBeenCalledTimes(1);
    await press('big-test-next');
    await press('big-test-idk');
    expect(playChime).toHaveBeenCalledTimes(1);
    expect(playWrongSound).toHaveBeenCalledTimes(1);
  });

  it('"I don\'t know" counts as wrong and offers no "I mistyped"', async () => {
    await open();
    const item = current();
    await press('big-test-idk');
    expect(has('big-test-mistyped')).toBe(false);
    expect(has('big-test-next')).toBe(true);
    expect(screen.getByTestId(`big-test-option-${await shown(item.correct)}`)).toHaveTextContent(/✓/);
    const saved = await savedRun();
    expect(saved.answers[0]).toMatchObject({ picked: null, right: false });
  });

  it('the first 5 answers all right pass the level at once; Continue goes to A2', async () => {
    await open();
    await playLevel(allRight);
    expect(text('big-test-level-title')).toBe('A1 passed · 5 of 5 right');
    expect(text('big-test-next-level')).toBe('Next: A2');
    expect(has('big-test-stop')).toBe(true);
    expect(card()).toBe('grammar-big-test:level-end:A1');
    await press('big-test-continue');
    expect(currentLevel()).toBe('A2');
    expect(card()).toMatch(/^grammar-big-test:A2:/);
    expect(progress()).toBe(20);
  });

  it('a failed level ends the test at the 3rd wrong answer: "The test ends here", See result, the level and its rows', async () => {
    await open();
    await playLevel(allWrong);
    expect(text('big-test-level-title')).toBe('A1 · 0 of 3 right');
    expect(text('big-test-ends')).toBe('The test ends here');
    expect(has('big-test-continue')).toBe(false);
    await press('big-test-see-result');
    expect(text('big-test-result-level')).toBe('Your level: A1');
    expect(card()).toBe('grammar-big-test:result');
    expect(screen.getByTestId('big-test-level-row-A1')).toHaveTextContent(/0\/3/);
    expect(screen.getByTestId('big-test-level-row-A2')).toHaveTextContent(/–/);
    expect(screen.getByTestId('big-test-level-row-C1')).toBeTruthy();
    // the run is gone, the result is stored
    expect(await loadResumeValue(getDb(), bigTestRunKey(PAIR))).toBeNull();
    expect(((await loadResumeValue(getDb(), bigTestResultKey(PAIR))) as { level: string }).level).toBe('A1');
  });

  it('the result lists topics to practise with a Lesson button to the lesson, and the strong ones', async () => {
    await open();
    // the first question right, then wrong until the level fails
    await playLevel((i) => (i === 0 ? 'R' : 'W'));
    await press('big-test-see-result');
    const stored = (await loadResumeValue(getDb(), bigTestResultKey(PAIR))) as { needsPractice: string[]; strong: string[] };
    expect(stored.needsPractice.length).toBeGreaterThan(0);
    expect(stored.strong.length).toBeGreaterThan(0);
    for (const tp of stored.needsPractice) expect(has(`big-test-practice-${tp}`)).toBe(true);
    for (const tp of stored.strong) expect(has(`big-test-strong-${tp}`)).toBe(true);
    // a topic without a lesson shows its row without the button
    for (const tp of stored.needsPractice) expect(has(`big-test-lesson-${tp}`)).toBe(hasLesson('es', tp));
    const withLesson = stored.needsPractice.find((tp) => hasLesson('es', tp));
    if (withLesson) {
      await press(`big-test-lesson-${withLesson}`);
      expect(mockPush).toHaveBeenCalledWith(`/grammar/${withLesson}`);
    }
    await press('big-test-done');
    expect(mockBack).toHaveBeenCalled();
  });

  it('Stop here after a passed level gives A2', async () => {
    await open();
    await playLevel(allRight);
    await press('big-test-stop');
    expect(text('big-test-result-level')).toBe('Your level: A2');
  });

  it('after C1 only See result is offered', async () => {
    await open();
    for (const level of ['A1', 'A2', 'B1', 'B2']) {
      await playLevel(allRight);
      expect(text('big-test-level-title')).toContain(`${level} passed`);
      await press('big-test-continue');
    }
    await playLevel(allRight);
    expect(text('big-test-level-title')).toBe('C1 passed · 5 of 5 right');
    expect(has('big-test-continue')).toBe(false);
    expect(has('big-test-stop')).toBe(false);
    await press('big-test-see-result');
    expect(text('big-test-result-level')).toBe('Your level: C1');
  });

  it('the bar never goes back through a level with a wrong answer and follow-ups, and a new level starts at one fifth', async () => {
    await open();
    const seen: number[] = [];
    for (let i = 0; i < 80 && !has('big-test-level-title'); i++) {
      seen.push(progress());
      if (i === 3) await answerWrong();
      else await answerRight();
      await press('big-test-next');
    }
    expect(has('big-test-level-title')).toBe(true);
    expect(currentLevel()).toBe('A1');
    for (let k = 1; k < seen.length; k++) expect(seen[k]).toBeGreaterThanOrEqual(seen[k - 1]);
    expect(seen[seen.length - 1]).toBeLessThan(20);
    await press('big-test-continue');
    expect(progress()).toBeGreaterThanOrEqual(seen[seen.length - 1]);
    expect(progress()).toBe(20);
  });

  it('leaving mid-level and coming back resumes the same question, with the same order of options', async () => {
    const first = await open();
    await answerRight();
    await press('big-test-next');
    await answerWrong();
    const id = itemId();
    const correct = current().correct;
    first.unmount();
    await open();
    // still on the answered state of that question, options locked
    expect(itemId()).toBe(id);
    expect(has('big-test-next')).toBe(true);
    expect(screen.getByTestId(`big-test-option-${await shown(correct)}`)).toHaveTextContent(/✓/);
    await press('big-test-next');
    expect(itemId()).not.toBe(id);
    expect(mockBack).not.toHaveBeenCalled();
  });

  it('the close button leaves at once', async () => {
    await open();
    await press('big-test-close');
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('a stored result shows on re-entry; ?new=1 starts over and drops a run in progress', async () => {
    const first = await open();
    await playLevel(allWrong);
    await press('big-test-see-result');
    first.unmount();
    const again = await open();
    expect(text('big-test-result-level')).toBe('Your level: A1');
    expect(card()).toBe('grammar-big-test:result');
    again.unmount();

    mockParams = { new: '1' };
    const fresh = await open();
    expect(currentLevel()).toBe('A1');
    await answerRight();
    const answered = itemId();
    fresh.unmount();
    // a run in progress resumes without ?new
    mockParams = {};
    const resumed = await open();
    expect(itemId()).toBe(answered);
    expect(has('big-test-next')).toBe(true);
    resumed.unmount();
    // and ?new=1 drops it
    mockParams = { new: '1' };
    await open();
    expect(has('big-test-next')).toBe(false);
    expect(currentLevel()).toBe('A1');
    expect(progress()).toBe(0);
  });

  it('"Start again" on the result begins a new run', async () => {
    await open();
    await playLevel(allWrong);
    await press('big-test-see-result');
    await press('big-test-restart');
    expect(currentLevel()).toBe('A1');
    expect(progress()).toBe(0);
    expect(has('big-test-idk')).toBe(true);
  });

  it('the feedback button is mounted in all four states with its card', async () => {
    await open();
    expect(card()).toMatch(/^grammar-big-test:A1:es-bt-a1-/);
    const id = itemId();
    await answerRight();
    expect(card()).toBe(`grammar-big-test:A1:${id}`);
    await press('big-test-next');
    await playLevel(allWrong);
    expect(card()).toBe('grammar-big-test:level-end:A1');
    await press('big-test-see-result');
    expect(card()).toBe('grammar-big-test:result');
    expect(text('fb-card')).toContain(`| ${PAIR} | A1`);
  });
});
