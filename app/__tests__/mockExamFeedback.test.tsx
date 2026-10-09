// The feedback button is on every part of the mock exam, and the
// card id says which part it is (mock-exam:<level>:<part>).
// Mock pattern: mockExam.test.tsx; the FeedbackModal here only prints the `currentCard` it receives.

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

jest.mock('@/components/FeedbackModal', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: (p: { currentCard: string; languagePair: string }) => (
      <Text testID="fb-card">{`${p.currentCard} | ${p.languagePair}`}</Text>
    ),
  };
});

import type { MockExam } from '@/lib/exam/mock/types';

const exam = (): MockExam => ({
  target: 'es',
  level: 'A1',
  seed: 1,
  official: true,
  skillNames: { reading: 'Lectura', writing: 'Escritura', listening: 'Audición', speaking: 'Oral' },
  rule: {
    kind: 'groups',
    groups: [
      { skills: ['reading', 'writing'], needed: 30, of: 50 },
      { skills: ['listening', 'speaking'], needed: 30, of: 50 },
    ],
  },
  papers: [
    {
      id: 'reading',
      name: 'Lectura',
      minutes: 45,
      points: 25,
      placeholder: false,
      tasks: [
        {
          id: 'reading-1',
          skill: 'reading',
          kind: 'read_mc',
          instruction: 'TAREA 1.',
          passages: [{ text: 'Tengo un perro.', options: ['I have a dog.', 'I have a cat.', 'I have a car.'], correct: 0 }],
        },
      ],
    },
    { id: 'speaking', name: 'Oral', minutes: 10, points: 25, placeholder: true, tasks: [] },
  ],
});

jest.mock('@/lib/exam/mock/build', () => ({
  ...jest.requireActual('@/lib/exam/mock/build'),
  buildMockExam: (input: { seed: number }) => ({ ...mockExamRef.current, seed: input.seed }),
}));
const mockExamRef: { current: MockExam } = { current: exam() };

import { act, fireEvent, render } from '@testing-library/react-native';

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

describe('Próbavizsga: visszajelzés-gomb minden részen (FB447)', () => {
  beforeEach(async () => {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
    mockExamRef.current = exam();
    setPcicTarget('es');
    await getDb().setOnboarding('en', 'es');
    await getDb().resetGameProgress(MOCK_EXAM_PROGRESS_KEY);
    await getDb().resetPcicCards();
  });
  afterEach(() => jest.useRealTimers());

  it('intro, papír-intro, feladat, kilépés, szóbeli, eredmény, átnézés: mind saját azonosítóval', async () => {
    const s = render(
      <ThemeProvider>
        <MockExamScreen />
      </ThemeProvider>,
    );
    await flush();
    const card = () => s.getByTestId('fb-card').props.children as string;
    const press = async (id: string) => {
      fireEvent.press(s.getByTestId(id));
      await flush();
    };

    expect(card()).toBe('mock-exam:A1:intro | en→es');
    await press('mock-begin');
    expect(card()).toBe('mock-exam:A1:reading:intro | en→es');
    await press('mock-start-paper');
    expect(card()).toBe('mock-exam:A1:reading:reading-1 | en→es');
    await press('mock-close');
    expect(card()).toBe('mock-exam:A1:leave | en→es');
    await press('mock-keep-going');
    expect(card()).toBe('mock-exam:A1:reading:reading-1 | en→es');
    await press('mock-option-r0-0');
    await press('mock-next-task');
    expect(card()).toBe('mock-exam:A1:speaking:intro | en→es');
    await press('mock-start-paper');
    expect(card()).toBe('mock-exam:A1:speaking | en→es');
    await press('mock-speaking-continue');
    expect(card()).toBe('mock-exam:A1:result | en→es');
    await press('mock-review');
    expect(card()).toBe('mock-exam:A1:review | en→es');
    s.unmount();
  });
});
