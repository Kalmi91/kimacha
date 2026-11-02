// The mock exam screen for a learner of German, on the real registry of the authored papers (data/exams/mock/de-*.json) and the
// real task builder: the B1 intro names the four Goethe-style papers in German, the tasks are numbered TEIL n., and every
// recording is read in the German voice (de-DE), whatever the learner's own language is.
// The flow of the other directions: app/__tests__/mockExamAuthored.test.tsx.

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

jest.mock('@/data/examPhotos', () => ({ examPhoto: () => undefined }));

import { fireEvent, render } from '@testing-library/react-native';

import { setPcicTarget } from '@/data/pcic';
import { getDb } from '@/lib/database';
import { MOCK_EXAM_PROGRESS_KEY } from '@/lib/exam/mock/session';
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

const reset = async (level: string, source: string) => {
  jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
  mockBack.mockClear();
  (speakSequence as jest.Mock).mockClear();
  mockLevel = level;
  setPcicTarget('de', source);
  await getDb().setOnboarding(source, 'de');
  await getDb().resetGameProgress(MOCK_EXAM_PROGRESS_KEY);
  await getDb().resetPcicCards();
};

afterEach(() => {
  jest.useRealTimers();
});

afterAll(() => setPcicTarget('es'));

describe('Mock exam: German B1 (authored papers)', () => {
  it.each(['en', 'hu'])('%s→de: the intro names the papers in German; the listening is spoken with the de-DE voice', async (source) => {
    await reset('B1', source);
    const s = await mount();

    // the level has authored content (it is not the empty state) and the four papers carry the German skill names
    expect(s.getByTestId('mock-begin')).toBeTruthy();
    for (const name of ['Lesen', 'Hören', 'Schreiben', 'Sprechen']) expect(s.getByText(new RegExp(`^${name}: \\d+ min, \\d+ tasks?, \\d+ points$`))).toBeTruthy();
    await press(s, 'mock-begin');

    // reading: nothing is checked against a word list, the task is numbered TEIL 1.
    expect(s.getByText('Paper 1 of 4')).toBeTruthy();
    await press(s, 'mock-start-paper');
    expect(s.getByText(/^TEIL 1\. /)).toBeTruthy();
    for (let k = 0; k < 12 && !s.queryByTestId('mock-start-paper'); k++) await press(s, 'mock-next-task');

    // listening: the first recording is played in German
    expect(s.getByText('Paper 2 of 4')).toBeTruthy();
    await press(s, 'mock-start-paper');
    await press(s, 'mock-play-0');
    expect(speakSequence).toHaveBeenCalledTimes(1);
    const segments = (speakSequence as jest.Mock).mock.calls[0][0] as { locale: string; text: string }[];
    expect(segments.length).toBeGreaterThan(0);
    expect(segments.every((seg) => seg.locale === 'de-DE')).toBe(true);
    s.unmount();
  });
});

describe('Mock exam: German A1 (the speaking paper is the whole exam)', () => {
  it('the intro lists Sprechen only', async () => {
    await reset('A1', 'en');
    const s = await mount();
    expect(s.getByTestId('mock-begin')).toBeTruthy();
    expect(s.getByText(/^Sprechen: \d+ min, \d+ tasks?, \d+ points$/)).toBeTruthy();
    expect(s.queryByText(/^Lesen:/)).toBeNull();
    s.unmount();
  });
});
