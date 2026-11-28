// The mock exam's task-to-task button is the docked pink "Next →" (the shared default label, no "Next task"); the last
// task keeps its own word (finish the paper), docked too. Pressing it does what the old in-flow button did (T1, T2),
// and leaving midway keeps what the exam kept before (T4). Mock pattern: mockExamScroll.test.tsx.

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

const readTask = (paper: string, n: number) => ({
  id: `${paper}-${n}`,
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
  papers: [
    { id: 'reading', name: 'Comprensión de lectura', minutes: 45, points: 25, placeholder: false, tasks: [readTask('reading', 1), readTask('reading', 2), readTask('reading', 3)] },
    { id: 'writing', name: 'Expresión e interacción escritas', minutes: 45, points: 25, placeholder: false, tasks: [readTask('writing', 1)] },
  ],
};
jest.mock('@/lib/exam/mock/build', () => ({
  ...jest.requireActual('@/lib/exam/mock/build'),
  buildMockExam: (input: { seed: number }) => ({ ...mockExam, seed: input.seed }),
}));

import { fireEvent, render, within } from '@testing-library/react-native';
import { ScrollView } from 'react-native';

import { setPcicTarget } from '@/data/pcic';
import { getDb } from '@/lib/database';
import { MOCK_EXAM_PROGRESS_KEY, readMockOverview } from '@/lib/exam/mock/session';
import { t } from '@/lib/i18n';
import { ThemeProvider } from '@/lib/ThemeContext';
import MockExamScreen from '../mock-exam';
import { makeFlush } from '@/test-utils/flush';

jest.setTimeout(60000);

const flush = makeFlush(10);

type Screen = ReturnType<typeof render>;

const mount = async (): Promise<Screen> => {
  const s = render(
    <ThemeProvider>
      <MockExamScreen />
    </ThemeProvider>,
  );
  await flush();
  return s;
};
const press = async (screen: Screen, testID: string) => {
  fireEvent.press(screen.getByTestId(testID));
  await flush();
};
const answerFirst = async (s: Screen) => {
  fireEvent.press(s.getAllByTestId(/^mock-option-/)[0]);
  await flush();
};

beforeEach(async () => {
  jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
  setPcicTarget('es');
  await getDb().setOnboarding('en', 'es');
  await getDb().resetGameProgress(MOCK_EXAM_PROGRESS_KEY);
  await getDb().resetPcicCards();
});
afterEach(() => {
  jest.useRealTimers();
});

describe('Mock exam: the docked Next', () => {
  it('T1: the dock holds one Next with the default label; no in-flow button and no "Next task"', async () => {
    const s = await mount();
    await press(s, 'mock-begin');
    await press(s, 'mock-start-paper');
    const dock = within(s.getByTestId('learn-dock'));
    expect(dock.getByTestId('mock-next-task')).toBeTruthy();
    expect(dock.getByText('Next →')).toBeTruthy();
    expect(s.getAllByTestId('mock-next-task')).toHaveLength(1);
    expect(s.queryByText(t().mockExam.nextTask)).toBeNull();
    expect(within(s.UNSAFE_getByType(ScrollView)).queryByTestId('mock-next-task')).toBeNull();
    s.unmount();
  });

  it('T1 + T2: the last task keeps its own word, docked; the docked button moves on with and without an answer', async () => {
    const s = await mount();
    await press(s, 'mock-begin');
    await press(s, 'mock-start-paper');
    await answerFirst(s);
    await press(s, 'mock-next-task'); // answered
    expect(s.getByTestId('mock-task-counter').props.children).toBe('Task 2 / 3');
    await press(s, 'mock-next-task'); // unanswered
    expect(s.getByTestId('mock-task-counter').props.children).toBe('Task 3 / 3');
    const dock = within(s.getByTestId('learn-dock'));
    expect(dock.getByText(t().mockExam.finishPaper)).toBeTruthy();
    expect(dock.queryByText('Next →')).toBeNull();
    expect(within(s.UNSAFE_getByType(ScrollView)).queryByText(t().mockExam.finishPaper)).toBeNull();
    await press(s, 'mock-next-task');
    // the paper is closed: the next paper's intro opens
    expect(s.getByTestId('mock-start-paper')).toBeTruthy();
    expect(s.queryByTestId('learn-dock')).toBeNull();
    s.unmount();
  });

  it('T4: two tasks answered, leave, enter again: the finished paper is kept and the exam resumes at the next one', async () => {
    const first = await mount();
    await press(first, 'mock-begin');
    await press(first, 'mock-start-paper');
    await answerFirst(first);
    await press(first, 'mock-next-task');
    await answerFirst(first);
    await press(first, 'mock-next-task');
    await press(first, 'mock-next-task'); // third task, closes the paper
    await press(first, 'mock-start-paper'); // paper 2
    await press(first, 'mock-close');
    await press(first, 'mock-leave');
    first.unmount();

    const overview = await readMockOverview(getDb(), 'es', ['A1']);
    expect(overview.A1?.session?.done).toEqual(['reading']);

    const second = await mount();
    expect(second.getByTestId('mock-resume')).toBeTruthy();
    await press(second, 'mock-resume');
    await press(second, 'mock-start-paper');
    expect(second.getByTestId('mock-task-counter').props.children).toBe('Task 1 / 1');
    second.unmount();
  });
});
