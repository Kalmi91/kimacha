// a próbavizsgán a "Next task" után a következő feladat ugyanabban a
// görgetési helyzetben nyílt, mint ahol az előző véget ért, ezért a feladat eleje (az utasítás, a
// párosítás A-F szövegei) a képernyőn kívül volt, a "Next task" gomb pedig pontosan ugyanott maradt az
// ujj alatt: a feladat "kimaradt", az átnézésben "No answer" lett. A javítás: minden feladat saját
// (újramountolt) görgetőt kap, így az mindig a tetejéről indul. Mock-minta: mockExam.test.tsx.

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

describe('Próbavizsga: a feladatváltás a görgető tetejére visz (FB491)', () => {
  beforeEach(async () => {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
    setPcicTarget('es');
    await getDb().setOnboarding('en', 'es');
    await getDb().resetGameProgress(MOCK_EXAM_PROGRESS_KEY);
    await getDb().resetPcicCards();
  });

  it('minden új feladat friss görgetőt kap (nem örökli az előző görgetési helyzetét)', async () => {
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
    // Ugyanaz a görgető-példány = a 2. feladat az 1. feladat görgetési helyzetében nyílik (a feladat
    // eleje kicsúszik felül); az újramountolt görgető mindig a tetejéről indul.
    expect(second).not.toBe(first);

    await press(s, 'mock-next-task');
    expect(s.getByTestId('mock-task-counter').props.children).toBe('Task 3 / 3');
    expect(scroller()).not.toBe(second);
    s.unmount();
  });
});
