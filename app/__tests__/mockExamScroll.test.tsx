// On the mock exam, after "Next task" the next task opened at the same
// scroll position where the previous one ended, so the start of the task (the instruction, the
// A-F texts of the matching) was off screen, and the "Next task" button stayed exactly in the same place
// under the finger: the task was "skipped", and became "No answer" in the review. The fix: every task gets its own
// (remounted) scroller, so it always starts from the top. Mock pattern: mockExam.test.tsx.

jest.mock('@/lib/database', () => jest.requireActual('@/lib/database.web'));

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ level: 'A1' }),
  useRouter: () => ({ back: jest.fn(), push: jest.fn(), replace: jest.fn() }),
}));

jest.mock('@/lib/speech', () => ({
  speak: jest.fn(),
  stop: jest.fn(),
  stopSpeaking: jest.fn(),
  loadVoices: jest.fn().mockResolvedValue(undefined),
  hasVoiceFor: jest.fn(() => true),
}));

import type { MockExam } from '@/lib/exam/mock/types';

const readTask = (n: number) => ({
  id: `reading-${n}`,
  skill: 'reading' as const,
  kind: 'read_mc' as const,
  instruction: `TAREA ${n}. Lea los textos y marque la opción correcta.`,
  passages: [{ text: 'Tengo un perro. Es grande.', options: ['I have a dog.', 'I have a cat.', 'I have a car.'], correct: 0 }],
});

const mockExam: MockExam = {
  target: 'es',
  level: 'A1',
  seed: 1,
  official: true,
  skillNames: {
    reading: 'Comprensión de lectura',
    writing: 'Expresión e interacción escritas',
    listening: 'Comprensión auditiva',
    speaking: 'Expresión e interacción orales',
  },
  rule: { kind: 'groups', groups: [{ skills: ['reading', 'writing'], needed: 30, of: 50 }] },
  papers: [{ id: 'reading', name: 'Comprensión de lectura', minutes: 45, points: 25, placeholder: false, tasks: [readTask(1), readTask(2), readTask(3)] }],
};
jest.mock('@/lib/exam/mock/build', () => ({
  ...jest.requireActual('@/lib/exam/mock/build'),
  buildMockExam: (input: { seed: number }) => ({ ...mockExam, seed: input.seed }),
}));

import { act, fireEvent, render } from '@testing-library/react-native';
import { ScrollView } from 'react-native';

import { setPcicTarget } from '@/data/pcic';
import { getDb } from '@/lib/database';
import { MOCK_EXAM_PROGRESS_KEY } from '@/lib/exam/mock/session';
import { ThemeProvider } from '@/lib/ThemeContext';
import MockExamScreen from '../mock-exam';

jest.setTimeout(60000);

const flush = async (times = 10) => {
  for (let i = 0; i < times; i++) {
    await act(async () => {
      await Promise.resolve();
    });
  }
};

type Screen = ReturnType<typeof render>;

const press = async (screen: Screen, testID: string) => {
  fireEvent.press(screen.getByTestId(testID));
  await flush();
};

afterEach(() => {
  jest.useRealTimers();
});

describe('Mock exam: switching tasks goes to the top of the scroll view', () => {
  beforeEach(async () => {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
    setPcicTarget('es');
    await getDb().setOnboarding('en', 'es');
    await getDb().resetGameProgress(MOCK_EXAM_PROGRESS_KEY);
    await getDb().resetPcicCards();
  });

  it('every new task gets a fresh scroll view (it does not inherit the previous scroll position)', async () => {
    const s = render(
      <ThemeProvider>
        <MockExamScreen />
      </ThemeProvider>,
    );
    await flush();
    await press(s, 'mock-begin');
    await press(s, 'mock-start-paper');

    const scroller = () => s.UNSAFE_getByType(ScrollView).instance;
    const first = scroller();
    expect(s.getByTestId('mock-task-counter').props.children).toBe('Task 1 / 3');

    await press(s, 'mock-next-task');
    expect(s.getByTestId('mock-task-counter').props.children).toBe('Task 2 / 3');
    const second = scroller();
    // The same scroller instance = the 2nd task opens at the scroll position of the 1st task (the start of
    // the task slides out at the top); a remounted scroller always starts from the top.
    expect(second).not.toBe(first);

    await press(s, 'mock-next-task');
    expect(s.getByTestId('mock-task-counter').props.children).toBe('Task 3 / 3');
    expect(scroller()).not.toBe(second);
    s.unmount();
  });
});
