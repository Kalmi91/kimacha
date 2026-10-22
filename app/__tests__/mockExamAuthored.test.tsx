// The mock exam screen with the authored B1-C1 papers, end to end: intro -> paper -> result -> review, on the real task
// builder. The registry of the authored papers (`@/data/exams/mock`) is replaced by complete levels made of the engine's
// fixtures (test-utils/mockExamFixtures.ts): en B1 (scale rule, English papers) and es B2 (groups rule, DELE-like groups).
// The flow of the older levels: app/__tests__/mockExam.test.tsx.

const mockBack = jest.fn();
let mockLevel = 'B1';
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ level: mockLevel }),
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

jest.mock('@/data/exams/mock', () => {
  const { fixturePapers } = require('@/test-utils/mockExamFixtures');
  return { MOCK_AUTHORED: [...fixturePapers('en', 'B1'), ...fixturePapers('es', 'B2')] };
});

import { fireEvent, render } from '@testing-library/react-native';

import { setPcicTarget } from '@/data/pcic';
import { getDb } from '@/lib/database';
import { MOCK_EXAM_PROGRESS_KEY, readMockOverview } from '@/lib/exam/mock/session';
import { t } from '@/lib/i18n';
import { speakSequence } from '@/lib/speech';
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

const reset = async (level: string, source: string, target: 'en' | 'es') => {
  jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
  mockBack.mockClear();
  (speakSequence as jest.Mock).mockClear();
  mockLevel = level;
  setPcicTarget(target);
  await getDb().setOnboarding(source, target);
  await getDb().resetGameProgress(MOCK_EXAM_PROGRESS_KEY);
  await getDb().resetPcicCards();
};

afterEach(() => {
  jest.useRealTimers();
});

afterAll(() => setPcicTarget('es'));

describe('Mock exam: English B1 (authored papers, scale rule)', () => {
  beforeEach(() => reset('B1', 'es', 'en'));

  it('intro -> reading -> writing -> listening -> speaking -> result -> review: every new kind answers into the session', async () => {
    const s = await mount();
    const s_ = t().mockExam;

    // intro: the level has authored content, so it is not "empty"; papers show minutes and task count, no points
    expect(s.getByText('B1 practice exam')).toBeTruthy();
    expect(s.getByText('Reading: 45 min, 6 tasks')).toBeTruthy();
    expect(s.getByText('Writing: 45 min, 2 tasks')).toBeTruthy();
    expect(s.getByText('Listening: 30 min, 5 tasks')).toBeTruthy();
    expect(s.getByText('Speaking: 12 min, microphone part coming soon')).toBeTruthy();
    expect(s.getByText(s_.passRuleScale(140))).toBeTruthy();
    expect(s.getByTestId('fb-card').props.children).toBe('mock-exam:B1:intro');
    await press(s, 'mock-begin');

    // paper intro
    expect(s.getByText('Paper 1 of 4')).toBeTruthy();
    expect(s.getByText('45 min, 6 tasks')).toBeTruthy();
    expect(s.getByTestId('fb-card').props.children).toBe('mock-exam:B1:reading:intro');
    await press(s, 'mock-start-paper');

    // reading: clips_mc, match_pool, passage_mc, gapped_text, cloze (choice), cloze (open)
    expect(s.getByText('Task 1 / 6')).toBeTruthy();
    expect(s.getByTestId('fb-card').props.children).toBe('mock-exam:B1:reading:reading-1');
    await press(s, 'mock-option-q0-0');
    await press(s, 'mock-option-q1-1');
    await press(s, 'mock-next-task');
    await press(s, 'mock-match-p1-a');
    await press(s, 'mock-next-task');
    await press(s, 'mock-option-q0-0');
    await press(s, 'mock-next-task');
    await press(s, 'mock-fragment-1-f5');
    await press(s, 'mock-next-task');
    await press(s, 'mock-option-c0-0');
    await press(s, 'mock-next-task');
    await type(s, 'mock-cloze-0', 'house0');
    expect(s.getByText(s_.finishPaper)).toBeTruthy();
    await press(s, 'mock-next-task');

    // the answers of the closed paper are in the saved session, under the keys the scoring reads
    const session = (await readMockOverview(getDb(), 'en', ['B1'])).B1?.session;
    expect(session?.done).toEqual(['reading']);
    expect(session?.answers['reading-1']).toEqual({ '0': 0, '1': 1 });
    expect(session?.answers['reading-2']).toEqual({ p1: 'a' });
    expect(session?.answers['reading-4']).toEqual({ '1': 'f5' });
    expect(session?.answers['reading-6']).toEqual({ '0': 'house0' });

    // writing: two essays (one choice with a recording; two choices)
    expect(s.getByText('Paper 2 of 4')).toBeTruthy();
    await press(s, 'mock-start-paper');
    await type(s, 'mock-essay-text', 'hello there my friend');
    expect(s.getByTestId('mock-essay-words').props.children).toMatch(/^4 \//);
    await press(s, 'mock-next-task');
    await press(s, 'mock-essay-choice-b');
    await type(s, 'mock-essay-text', 'another text');
    await press(s, 'mock-next-task');

    // listening: recordings, plays counted, the speech goes through speakSequence
    expect(s.getByText('Paper 3 of 4')).toBeTruthy();
    await press(s, 'mock-start-paper');
    await press(s, 'mock-play-0');
    expect(speakSequence).toHaveBeenCalledTimes(1);
    for (let i = 0; i < 5; i++) await press(s, 'mock-next-task');

    // speaking placeholder, then the result
    expect(s.getByText('Paper 4 of 4')).toBeTruthy();
    await press(s, 'mock-start-paper');
    expect(s.getByText('Speaking: microphone part coming soon')).toBeTruthy();
    await press(s, 'mock-speaking-continue');

    expect(s.getByTestId('mock-verdict')).toBeTruthy();
    expect(s.getByTestId('fb-card').props.children).toBe('mock-exam:B1:result');
    // per skill a scale score, the average, and the "approximate" label (no official pass mark promised)
    expect(s.getByTestId('mock-band-reading').props.children).toMatch(/^Reading: about \d+ on the exam scale \(\d+ \/ 25\)$/);
    expect(s.getByTestId('mock-band-listening').props.children).toMatch(/on the exam scale/);
    expect(s.getByTestId('mock-band-speaking').props.children).toBe('Speaking: not included');
    expect(s.getByTestId('mock-scale').props.children).toMatch(/^Average on the exam scale: about \d+, needed about 140 \(estimate\), (passed|not passed) \(provisional\)$/);
    expect(s.getByTestId('mock-scale-note').props.children).toBe(s_.mockScaleNote);
    const overview = await readMockOverview(getDb(), 'en', ['B1']);
    expect(overview.B1?.last).toMatchObject({ provisional: true });
    expect(overview.B1?.session).toBeUndefined();

    // review: the items of the new kinds, the gaps by number
    await press(s, 'mock-review');
    expect(s.getByTestId('fb-card').props.children).toBe('mock-exam:B1:review');
    expect(s.getByTestId('mock-review-reading-4-0')).toBeTruthy();
    expect(s.getAllByText(/Gap 1$/).length).toBeGreaterThan(0);
    expect(s.getByTestId('mock-review-reading-6-0')).toBeTruthy();
    s.unmount();
  });
});

describe('Mock exam: Spanish B2 (authored papers, groups rule)', () => {
  beforeEach(() => reset('B2', 'en', 'es'));

  it('runs through all papers with the groups of the result', async () => {
    const s = await mount();
    expect(s.getByText('B2 practice exam')).toBeTruthy();
    // groups rule: the points of a paper stay in the lines
    expect(s.getByText(/Comprensión de lectura: 70 min, 5 tasks, 25 points/)).toBeTruthy();
    await press(s, 'mock-begin');
    // generic walk: start every paper, step through every task, continue past the speaking placeholder
    for (let guard = 0; guard < 40 && !s.queryByTestId('mock-verdict'); guard++) {
      for (const id of ['mock-start-paper', 'mock-next-task', 'mock-speaking-continue']) {
        if (s.queryByTestId(id)) {
          await press(s, id);
          break;
        }
      }
    }
    expect(s.getByTestId('mock-verdict')).toBeTruthy();
    expect(s.getByTestId('mock-group-1').props.children).toMatch(/^Group 1:/);
    expect(s.getByTestId('mock-group-2').props.children).toMatch(/^Group 2:/);
    expect(s.queryByTestId('mock-scale')).toBeNull();
    s.unmount();
  });
});
