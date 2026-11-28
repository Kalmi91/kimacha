// The exam round's Check and Next are docked (shared labels: "✓ Check", "Next →"); the last text keeps "Done", docked
// with the Next tone. Pressing them does what the old in-flow buttons did (T1, T2), and a run left midway is kept (T4).
// Setup copied from examRound.screen.test.tsx.

jest.mock('expo-speech', () => ({
  speak: jest.fn(),
  stop: jest.fn(),
  getAvailableVoicesAsync: jest.fn(async () => []),
}));
const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, push: jest.fn(), replace: jest.fn() }),
  usePathname: () => '/grammar',
  useFocusEffect: (cb: () => void) => {
    const { useEffect } = require('react');
    useEffect(cb, []);
  },
  useLocalSearchParams: () => ({ level: 'A1' }),
}));
jest.mock('@/components/FeedbackModal', () => ({ __esModule: true, default: () => null }));

jest.mock('@/lib/grammar/syllabus', () => {
  const actual = jest.requireActual('@/lib/grammar/syllabus');
  const topics = ['lt-0', 'lt-1', 'lt-2', 'lt-3'].map((id) => ({ id, level: 'A1', unit: 'u', title: { en: id }, blurb: { en: '' } }));
  return {
    ...actual,
    syllabusForLevel: (level: string) => topics.filter((tp) => tp.level === level),
    syllabusTopic: (id: string) => topics.find((tp) => tp.id === id),
    hasLesson: (_lang: string, id: string) => topics.some((tp) => tp.id === id),
  };
});

let mockFile: any;
jest.mock('@/lib/grammar/examRound', () => ({
  ...jest.requireActual('@/lib/grammar/examRound'),
  examRoundFile: () => mockFile,
}));

import { fireEvent, render, screen, within } from '@testing-library/react-native';

import { getDb } from '@/lib/database.web';
import { examRunKey, type ExamRoundText } from '@/lib/grammar/examRound';
import { GRAMMAR_RANDOM_KEY } from '@/lib/grammar/randomRound';
import { t } from '@/lib/i18n';
import { loadResumeValue, saveResumeValue } from '@/lib/resumeStore';
import { ThemeProvider } from '@/lib/ThemeContext';
import ExamRoundScreen from '../exam-round';
import { makeFlush } from '@/test-utils/flush';

jest.setTimeout(60000);

const flush = makeFlush(4);
const KEY = examRunKey('en→es', 'A1');

const mk = (id: string, topics: string[], correct: number[]): ExamRoundText => ({
  id,
  title: `Texto ${id}`,
  text: topics.map((_, i) => `palabra {{${i + 1}}}`).join(' '),
  gaps: topics.map((topic, i) => ({ options: ['a', 'b', 'c'].map((c) => `${c}${i + 1}word`), correct: correct[i], topic })),
});

const press = async (testID: string) => {
  fireEvent.press(screen.getByTestId(testID));
  await flush();
};
const fillAll = async () => {
  for (let i = 0; i < 6; i++) await press(`mock-option-c${i}-0`);
};
const dock = () => within(screen.getByTestId('learn-dock'));

beforeEach(async () => {
  mockFile = {
    lang: 'es',
    level: 'A1',
    texts: [mk('EX-1', ['lt-0', 'lt-0', 'lt-1', 'lt-2', 'lt-3', 'lt-1'], [0, 1, 2, 0, 1, 2]), mk('EX-2', ['lt-2', 'lt-3', 'lt-2', 'lt-3', 'lt-1', 'lt-0'], [2, 2, 2, 1, 1, 1])],
  };
  const db = getDb();
  await db.setOnboarding('en', 'es');
  (db as any).__setLevelForTest('A1');
  await db.resetGameProgress(GRAMMAR_RANDOM_KEY);
  await saveResumeValue(db, KEY, null);
});

const open = async () => {
  const view = render(
    <ThemeProvider>
      <ExamRoundScreen />
    </ThemeProvider>,
  );
  await flush();
  return view;
};

describe('exam round: docked Check / Next / Done', () => {
  it('T1 + T2: the dock holds the Check (disabled until all gaps are picked); after it the default Next; the last text the Done', async () => {
    await open();
    expect(dock().getByTestId('exam-round-check')).toBeTruthy();
    expect(dock().getByText('✓ Check')).toBeTruthy();
    expect(screen.getAllByTestId('exam-round-check')).toHaveLength(1);
    await press('exam-round-check');
    expect(screen.queryByTestId('exam-round-score')).toBeNull(); // still disabled
    await fillAll();
    await press('exam-round-check');
    expect(screen.getByTestId('exam-round-score')).toBeTruthy();
    expect(dock().getByTestId('exam-round-next')).toBeTruthy();
    expect(dock().getByText('Next →')).toBeTruthy();
    expect(screen.getAllByTestId('exam-round-next')).toHaveLength(1);
    expect(screen.queryByText(t().examRound.nextText)).toBeNull();
    await press('exam-round-next');
    expect(((await loadResumeValue(getDb(), KEY)) as any).index).toBe(1);
    await fillAll();
    await press('exam-round-check');
    expect(screen.queryByTestId('exam-round-next')).toBeNull();
    expect(dock().getByTestId('exam-round-done')).toBeTruthy();
    expect(dock().getByText(t().examRound.done)).toBeTruthy();
    await press('exam-round-done');
    expect(mockBack).toHaveBeenCalled();
  });

  it('T4: two picks made, leave, enter again: the saved picks are still there', async () => {
    const first = await open();
    await press('mock-option-c0-1');
    await press('mock-option-c1-2');
    first.unmount();
    const saved = (await loadResumeValue(getDb(), KEY)) as any;
    expect(saved.answers).toMatchObject({ '0': 1, '1': 2 });
    expect(saved.index).toBe(0);
    await open();
    const again = (await loadResumeValue(getDb(), KEY)) as any;
    expect(again.answers).toMatchObject({ '0': 1, '1': 2 });
    expect(screen.getByText(`Texto ${saved.texts[0]}`)).toBeTruthy();
  });
});
