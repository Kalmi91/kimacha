// Every mock-exam scroller keeps text outside the floating feedback button's footprint.
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

import { fireEvent, render } from '@testing-library/react-native';
import { ScrollView, StyleSheet } from 'react-native';

import { FEEDBACK_FAB_MARGIN, FEEDBACK_FAB_SIZE } from '@/constants/FeedbackFab';
import { spacing } from '@/constants/Theme';
import { setPcicTarget } from '@/data/pcic';
import { getDb } from '@/lib/database';
import { MOCK_EXAM_PROGRESS_KEY } from '@/lib/exam/mock/session';
import type { MockExam } from '@/lib/exam/mock/types';
import { ThemeProvider } from '@/lib/ThemeContext';
import { makeFlush } from '@/test-utils/flush';
import MockExamScreen from '../mock-exam';

const mockExam: MockExam = {
  target: 'es',
  level: 'A1',
  seed: 1,
  official: true,
  skillNames: { reading: 'Lectura', writing: 'Escritura', listening: 'Audición', speaking: 'Oral' },
  rule: { kind: 'groups', groups: [{ skills: ['reading', 'writing'], needed: 30, of: 50 }] },
  papers: [
    {
      id: 'reading',
      name: 'Lectura',
      minutes: 45,
      points: 25,
      placeholder: false,
      tasks: [{
        id: 'reading-1',
        skill: 'reading',
        kind: 'read_mc',
        instruction: 'Lea el texto y marque la opción correcta.',
        passages: [{ text: 'Tengo un perro. Es grande.', options: ['A dog.', 'A cat.', 'A car.'], correct: 0 }],
      }],
    },
    { id: 'speaking', name: 'Oral', minutes: 10, points: 25, placeholder: true, tasks: [] },
  ],
};

jest.mock('@/lib/exam/mock/build', () => ({
  ...jest.requireActual('@/lib/exam/mock/build'),
  buildMockExam: (input: { seed: number }) => ({ ...mockExam, seed: input.seed }),
}));

jest.setTimeout(60000);
const flush = makeFlush(10);

describe('Mock exam: feedback content clearance', () => {
  beforeEach(async () => {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
    setPcicTarget('es');
    await getDb().setOnboarding('en', 'es');
    await getDb().resetGameProgress(MOCK_EXAM_PROGRESS_KEY);
    await getDb().resetPcicCards();
  });
  afterEach(() => jest.useRealTimers());

  it('reserves right and bottom space through intro, tasks, speaking, results and review', async () => {
    const screen = render(<ThemeProvider><MockExamScreen /></ThemeProvider>);
    await flush();
    const expectClearance = () => {
      const body = StyleSheet.flatten(screen.UNSAFE_getByType(ScrollView).props.contentContainerStyle);
      const clearance = FEEDBACK_FAB_MARGIN + FEEDBACK_FAB_SIZE + spacing.md;
      expect(body.paddingRight ?? body.paddingHorizontal ?? body.padding).toBeGreaterThanOrEqual(clearance);
      expect(body.paddingBottom ?? body.paddingVertical ?? body.padding).toBeGreaterThanOrEqual(clearance);
      expect(StyleSheet.flatten(screen.getByLabelText('Feedback').props.style)).toMatchObject({
        position: 'absolute', right: FEEDBACK_FAB_MARGIN, bottom: FEEDBACK_FAB_MARGIN,
      });
    };
    const press = async (id: string) => {
      fireEvent.press(screen.getByTestId(id));
      await flush();
      expectClearance();
    };

    expectClearance();
    await press('mock-begin');
    await press('mock-start-paper');
    await press('mock-option-r0-0');
    await press('mock-next-task');
    await press('mock-start-paper');
    await press('mock-speaking-continue');
    await press('mock-review');
    screen.unmount();
  });
});
