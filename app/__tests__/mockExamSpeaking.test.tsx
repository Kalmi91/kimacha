// The mock exam screen with a speaking paper that has tasks (English B1, scale rule), on the real task builder and the real
// scoring: the paper runs in the task phase (not the placeholder), the speaking task's primary button is the docked one, the
// paper's clock stands still during the preparation time, a task that follows another takes its choice, and the result counts
// the speaking (no "provisional", one sentence under its band) and the review shows the model answers.
// The registry of the authored papers is replaced by the engine's fixtures plus test-utils/mockSpeakingFixture.ts.

const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ level: 'B1' }),
  useRouter: () => ({ back: mockBack, push: jest.fn(), replace: jest.fn() }),
}));

jest.mock('@/lib/speech', () => ({
  speak: jest.fn(),
  speakSequence: jest.fn(),
  stop: jest.fn(),
  stopSpeaking: jest.fn(),
  loadVoices: jest.fn().mockResolvedValue(undefined),
  hasVoiceFor: jest.fn(() => true),
}));

jest.mock('@/components/FeedbackModal', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: (p: { currentCard: string }) => <Text testID="fb-card">{p.currentCard}</Text>,
  };
});

jest.mock('@/data/examPhotos', () => ({ examPhoto: () => undefined }));

jest.mock('@/data/exams/mock', () => {
  const { fixturePapers } = require('@/test-utils/mockExamFixtures');
  const { speakingFile } = require('@/test-utils/mockSpeakingFixture');
  return { MOCK_AUTHORED: [...fixturePapers('en', 'B1'), speakingFile('en', 'B1')] };
});

import { act, fireEvent, render } from '@testing-library/react-native';

import { setPcicTarget } from '@/data/pcic';
import { getDb } from '@/lib/database';
import { MOCK_EXAM_PROGRESS_KEY, readMockOverview } from '@/lib/exam/mock/session';
import { t } from '@/lib/i18n';
import { speak } from '@/lib/speech';
import { ThemeProvider } from '@/lib/ThemeContext';
import MockExamScreen from '../mock-exam';
import { makeFlush } from '@/test-utils/flush';

jest.setTimeout(60000);

const flush = makeFlush(10);

type Screen = ReturnType<typeof render>;

const mount = async (): Promise<Screen> => {
  const view = render(
    <ThemeProvider>
      <MockExamScreen />
    </ThemeProvider>,
  );
  await flush();
  return view;
};

const press = async (screen: Screen, testID: string) => {
  fireEvent.press(screen.getByTestId(testID));
  await flush();
};

const type = async (screen: Screen, testID: string, text: string) => {
  fireEvent.changeText(screen.getByTestId(testID), text);
  await flush();
};

const advance = async (ms: number) => {
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
};

const clock = (screen: Screen) => [screen.getByTestId('mock-clock').props.children].flat().join('');

/** Begin the exam and step through the three other papers, up to the first screen of the speaking paper's first task. */
const walkToSpeaking = async (s: Screen) => {
  await press(s, 'mock-begin');
  for (let guard = 0; guard < 40 && !s.queryByTestId('mock-speaking-choice-a'); guard++) {
    for (const id of ['mock-start-paper', 'mock-next-task']) {
      if (s.queryByTestId(id)) {
        await press(s, id);
        break;
      }
    }
  }
};

beforeEach(async () => {
  jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
  mockBack.mockClear();
  (speak as jest.Mock).mockClear();
  setPcicTarget('en');
  await getDb().setOnboarding('es', 'en');
  await getDb().resetGameProgress(MOCK_EXAM_PROGRESS_KEY);
  await getDb().resetPcicCards();
});

afterEach(() => {
  jest.useRealTimers();
});

afterAll(() => setPcicTarget('es'));

describe('Mock exam: a speaking paper with tasks', () => {
  it('the intro lists it like the other papers (minutes and tasks), no "coming soon"', async () => {
    const s = await mount();
    expect(s.getByText('Speaking: 12 min, 2 tasks')).toBeTruthy();
    expect(s.queryByText(/coming soon/)).toBeNull();
    await press(s, 'mock-begin');
    for (let i = 0; i < 3; i++) {
      await press(s, 'mock-start-paper');
      for (let k = 0; k < 6 && !s.queryByTestId('mock-start-paper'); k++) await press(s, 'mock-next-task');
    }
    expect(s.getByText('Paper 4 of 4')).toBeTruthy();
    expect(s.getByText('12 min, 2 tasks')).toBeTruthy();
    s.unmount();
  });

  it('runs in the task phase: the counter and the feedback button name the task, the primary button is the docked one, not "Next task"', async () => {
    const s = await mount();
    await walkToSpeaking(s);
    expect(s.getByText('Task 1 / 2')).toBeTruthy();
    expect(s.getByTestId('fb-card').props.children).toBe('mock-exam:B1:speaking:speaking-1');
    expect(s.getByTestId('learn-dock')).toBeTruthy();
    expect(s.getByTestId('mock-speaking-primary')).toBeTruthy();
    expect(s.queryByTestId('mock-next-task')).toBeNull();
    expect(s.queryByTestId('mock-speaking-continue')).toBeNull();
    s.unmount();
  });

  it('the paper clock stands still during the preparation time and runs on after it', async () => {
    const s = await mount();
    await walkToSpeaking(s);
    expect(clock(s)).toBe('⏱ 12:00');
    await press(s, 'mock-speaking-choice-a');
    await press(s, 'mock-speaking-primary');
    expect(s.getByTestId('mock-speaking-prep-left').props.children).toBe('Preparation time left: 1:30');
    await advance(60_000);
    expect(s.getByTestId('mock-speaking-prep-left').props.children).toBe('Preparation time left: 0:30');
    expect(clock(s)).toBe('⏱ 12:00');
    await press(s, 'mock-speaking-primary'); // "I'm ready"
    expect(clock(s)).toBe('⏱ 12:00');
    await advance(5_000);
    expect(clock(s)).toBe('⏱ 11:55');
    s.unmount();
  });

  it('the clock also resumes when the preparation runs out by itself', async () => {
    const s = await mount();
    await walkToSpeaking(s);
    await press(s, 'mock-speaking-choice-a');
    await press(s, 'mock-speaking-primary');
    await advance(90_000);
    expect(s.getByTestId('mock-speaking-turn-counter')).toBeTruthy();
    expect(clock(s)).toBe('⏱ 12:00');
    await advance(10_000);
    expect(clock(s)).toBe('⏱ 11:50');
    s.unmount();
  });

  it('opening the leave dialog during the preparation does not leave the clock stopped', async () => {
    const s = await mount();
    await walkToSpeaking(s);
    await press(s, 'mock-speaking-choice-a');
    await press(s, 'mock-speaking-primary');
    await advance(10_000);
    await press(s, 'mock-close');
    await advance(20_000);
    await press(s, 'mock-keep-going');
    // the task is rebuilt at its sheet and holds the clock again from where it stood: the 20 seconds of the dialog counted, the 10 of the preparation did not
    expect(s.getByTestId('mock-speaking-sheet')).toBeTruthy();
    expect(clock(s)).toBe('⏱ 11:40');
    await advance(60_000);
    expect(clock(s)).toBe('⏱ 11:40');
    s.unmount();
  });

  it('the whole paper: the first task is chosen and read aloud, the second follows its choice, the result counts the speaking, the review has the model answers', async () => {
    const s = await mount();
    const s_ = t().mockExam;
    await walkToSpeaking(s);

    // task 1: choose, prepare (skip), two turns
    await press(s, 'mock-speaking-choice-a');
    await press(s, 'mock-speaking-primary');
    await type(s, 'mock-speaking-notes', 'beach, family');
    await press(s, 'mock-speaking-primary');
    expect(speak).toHaveBeenCalledWith('Where did you go last summer?', 'en-US');
    await type(s, 'mock-speaking-answer', 'Last summer I went to the beach with my family and we had a good time');
    await press(s, 'mock-speaking-primary');
    expect(speak).toHaveBeenCalledWith('Did you like it?', 'en-US');
    await type(s, 'mock-speaking-answer', 'Yes I liked it very much');
    expect(s.getByText(s_.nextTask)).toBeTruthy();
    await press(s, 'mock-speaking-primary');

    // task 2 follows task 1: no chooser, the holiday sheet, no preparation
    expect(s.getByText('Task 2 / 2')).toBeTruthy();
    expect(s.getByTestId('fb-card').props.children).toBe('mock-exam:B1:speaking:speaking-2');
    expect(s.queryByTestId('mock-speaking-choice-a')).toBeNull();
    expect(s.getByTestId('mock-speaking-title').props.children).toBe('More about the holiday');
    await press(s, 'mock-speaking-primary');
    expect(s.getByTestId('mock-speaking-ask').props.children).toBe('Would you go there again?');
    await type(s, 'mock-speaking-answer', 'Yes I would go there again next summer');
    expect(s.getByText(s_.finishPaper)).toBeTruthy();
    await press(s, 'mock-speaking-primary');

    // result: the speaking band counts, the sentence under it, nothing provisional
    expect(s.getByTestId('mock-verdict')).toBeTruthy();
    expect(s.getByTestId('mock-band-speaking').props.children).toMatch(/^Speaking: about \d+ on the exam scale \(\d+ \/ 25\)$/);
    expect(s.getByTestId('mock-speaking-note').props.children).toBe('Speaking is scored from the content and length of your answers; pronunciation and fluency are not measured.');
    expect(s.getByTestId('mock-scale').props.children).not.toMatch(/provisional/);
    expect([s.queryByText(s_.provisionalNote), s.queryByText(s_.provisionalNoteTotal), s.queryByText(s_.provisionalNoteAverage)]).toEqual([null, null, null]);
    const overview = await readMockOverview(getDb(), 'en', ['B1']);
    expect(overview.B1?.last).toMatchObject({ provisional: false });

    // review: per turn the question, what was said, the marks, the word count and the model answer
    await press(s, 'mock-review');
    expect(s.getByTestId('mock-review-speaking-1-turn-0-ask').props.children).toBe('Where did you go last summer?');
    expect(s.getByTestId('mock-review-speaking-1-turn-0-answer').props.children.join('')).toBe('Your answer: Last summer I went to the beach with my family and we had a good time');
    expect(s.getByTestId('mock-review-speaking-1-turn-0-point-0').props.children.join('')).toBe('✓ a place');
    expect(s.getByTestId('mock-review-speaking-1-turn-0-words').props.children).toBe('✓ 16 words (at least 8)');
    expect(s.getByText('Last summer I went to the beach with my family and we had a very good time there')).toBeTruthy();
    expect(s.getByTestId('mock-review-speaking-2-turn-0-model')).toBeTruthy();
    s.unmount();
  });
});
