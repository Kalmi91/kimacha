// FB647 ("tesztelés hiánya"): every button of the exam strip of the Grammar tab pushes a route, and the screen of that
// route mounts without throwing, with a fresh state and with every A1 word learned. The strip and the four screens
// are the real ones; only the router and the speech engine are replaced.

jest.mock('expo-speech', () => ({ speak: jest.fn(), stop: jest.fn(), getAvailableVoicesAsync: jest.fn(async () => []) }));
jest.mock('@/lib/speech', () => ({
  speak: jest.fn(),
  speakSequence: jest.fn(),
  stop: jest.fn(),
  stopSpeaking: jest.fn(),
  loadVoices: jest.fn().mockResolvedValue(undefined),
  hasVoiceFor: jest.fn(() => true),
}));

const mockPush = jest.fn();
let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockParams,
  useRouter: () => ({ back: jest.fn(), push: (...a: unknown[]) => mockPush(...a), replace: jest.fn() }),
  usePathname: () => '/grammar',
  useFocusEffect: jest.fn(),
}));

import { fireEvent, render } from '@testing-library/react-native';
import type { ComponentType } from 'react';

import { setPcicTarget } from '@/data/pcic';
import ExamStrip from '@/components/grammar/ExamStrip';
import { getDb } from '@/lib/database';
import { seedA1ExamState } from '@/lib/exam/devSeed';
import { GRAMMAR_PROGRESS_KEY } from '@/lib/grammar/syllabus';
import { examStatusFor } from '@/lib/exam/unlock';
import { LearnerProvider, LearnerStore } from '@/lib/learner';
import { ThemeProvider } from '@/lib/ThemeContext';
import { makeFlush } from '@/test-utils/flush';
import ExamRoundScreen from '../grammar/exam-round';
import LevelTestScreen from '../grammar/level-test';
import ExamScreen from '../exam';
import MockExamScreen from '../mock-exam';

jest.setTimeout(120000);
const flush = makeFlush(10);

const SCREENS: Record<string, ComponentType> = {
  '/grammar/level-test': LevelTestScreen,
  '/grammar/exam-round': ExamRoundScreen,
  '/exam': ExamScreen,
  '/mock-exam': MockExamScreen,
};
const BUTTONS = ['grammar-level-test-A1', 'grammar-exam-round-A1', 'grammar-exam-open-A1', 'grammar-mock-open-A1'];

const FALLBACK: Record<string, { path: string; params: Record<string, string> }> = {
  'grammar-level-test-A1': { path: '/grammar/level-test', params: { level: 'A1' } },
  'grammar-exam-round-A1': { path: '/grammar/exam-round', params: { level: 'A1' } },
  'grammar-exam-open-A1': { path: '/exam', params: { level: 'A1' } },
  'grammar-mock-open-A1': { path: '/mock-exam', params: { level: 'A1' } },
};

// the route a push call names: a path string with a query, or { pathname, params }
const routeOf = (arg: unknown): { path: string; params: Record<string, string> } => {
  if (typeof arg === 'string') {
    const [path, query = ''] = arg.split('?');
    return { path, params: Object.fromEntries(new URLSearchParams(query)) };
  }
  const { pathname, params } = arg as { pathname: string; params: Record<string, string> };
  return { path: pathname, params };
};

const openEveryEntry = async () => {
  await getDb().setOnboarding('en', 'es');
  setPcicTarget('es', 'en');
  const store = new LearnerStore();
  await store.refresh(['direction']);
  const cards = await getDb().getPcicCards();
  const rows = await getDb().getGameProgress(GRAMMAR_PROGRESS_KEY);
  const examStatus = examStatusFor('A1', 'es', cards, rows);

  const strip = render(
    <ThemeProvider>
      <ExamStrip level="A1" learnedLang="es" contentLang="en" evidence={new Map()} examStatus={examStatus} />
    </ThemeProvider>,
  );
  await flush();
  const routes: ReturnType<typeof routeOf>[] = [];
  for (const id of BUTTONS) {
    mockPush.mockClear();
    fireEvent.press(strip.getByTestId(id));
    if (mockPush.mock.calls.length === 0) {
      // a locked button does not navigate; the screen must still mount when reached by a link
      expect(examStatus.unlocked).toBe(false);
      routes.push(FALLBACK[id]);
      continue;
    }
    expect(mockPush).toHaveBeenCalledTimes(1);
    routes.push(routeOf(mockPush.mock.calls[0][0]));
  }
  strip.unmount();

  expect(routes.map((r) => r.path)).toEqual(['/grammar/level-test', '/grammar/exam-round', '/exam', '/mock-exam']);
  for (const route of routes) {
    mockParams = route.params;
    const Screen = SCREENS[route.path];
    expect(Screen).toBeDefined();
    const view = render(
      <ThemeProvider>
        <LearnerProvider store={store}>
          <Screen />
        </LearnerProvider>
      </ThemeProvider>,
    );
    await flush();
    expect(view.toJSON()).not.toBeNull();
    view.unmount();
  }
};

describe('every entry of the exam strip opens a screen that mounts (FB647)', () => {
  beforeEach(async () => {
    mockPush.mockClear();
    await getDb().resetPcicCards();
    await getDb().resetGameProgress(GRAMMAR_PROGRESS_KEY);
  });

  it('with a fresh state', async () => {
    await openEveryEntry();
  });

  it('with every A1 word learned and a lesson done', async () => {
    await getDb().setOnboarding('en', 'es');
    setPcicTarget('es', 'en');
    await seedA1ExamState(getDb(), 'es', '2026-10-01');
    await openEveryEntry();
  });
});
