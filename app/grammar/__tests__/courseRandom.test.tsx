// The Grammar tab's entry to the random round: the card at the top (start / continue + the grammar score
// line) and the test-% badge on the lesson rows (🎯), in both the neo-brutalist and the classic list.
// Mock pattern: courseBrutal.test.tsx.

jest.mock('expo-speech', () => ({
  speak: jest.fn(),
  stop: jest.fn(),
  getAvailableVoicesAsync: jest.fn(async () => []),
}));
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), push: mockPush }),
  usePathname: () => '/grammar',
  useFocusEffect: (cb: () => void) => {
    const { useEffect } = require('react');
    useEffect(cb, []);
  },
}));

import { fireEvent, render, screen } from '@testing-library/react-native';

import { getDb } from '@/lib/database.web';
import { GRAMMAR_PROGRESS_KEY, hasLesson, syllabusForLevel, syllabusLevels } from '@/lib/grammar/syllabus';
import { GRAMMAR_RANDOM_KEY, type EvidenceAnswer, type RoundRun } from '@/lib/grammar/randomRound';
import GrammarSyllabusScreen from '@/app/(tabs)/course';
import { ThemeProvider } from '@/lib/ThemeContext';
import { makeFlush } from '@/test-utils/flush';

const flush = makeFlush(4);

const answers = (ok: number, total: number, kinds: ('choice' | 'form')[] = ['choice']): { answers: EvidenceAnswer[] } => ({
  answers: Array.from({ length: total }, (_, i) => ({
    id: `q${i}`,
    kind: kinds[i % kinds.length],
    ok: i < ok,
    at: '2026-11-01',
  })),
});

const openRun = (checkAnswered: number, mode: RoundRun['mode'] = 'mixed'): RoundRun => ({
  mode,
  seed: 7,
  startLevel: 'A1',
  steps: Array.from({ length: checkAnswered }, (_, i) => ({
    topicId: 'presente-regular',
    qid: `q${i}`,
    kind: 'choice' as const,
    level: 'A1' as const,
    phase: (mode === 'full' ? 'full' : 'check') as 'full' | 'check',
    ok: true,
  })),
  pending: null,
  weak: [],
  before: {},
  skipped: [],
});

describe.each([
  ['neo-brutalist', 'brand'],
  ['classic', 'classic'],
] as const)('grammar tab, random round entry (%s list)', (_name, palette) => {
  beforeEach(async () => {
    mockPush.mockClear();
    const db = getDb();
    await db.setOnboarding('en', 'es');
    (db as any).__setLevelForTest('A1');
    await db.setGrammarPalette(palette);
    await db.resetGameProgress(GRAMMAR_RANDOM_KEY);
    await db.resetGameProgress(GRAMMAR_PROGRESS_KEY);
  });
  afterAll(async () => {
    await getDb().resetGameProgress(GRAMMAR_RANDOM_KEY);
    await getDb().resetGameProgress(GRAMMAR_PROGRESS_KEY);
  });

  it('shows the start card with the score line and opens the round', async () => {
    const view = render(<ThemeProvider><GrammarSyllabusScreen /></ThemeProvider>);
    await flush();
    expect(screen.queryByText('🎲 Random practice')).toBeTruthy();
    expect(screen.queryByText(/^Grammar score 0% · 0 weak topics$/)).toBeTruthy();
    fireEvent.press(screen.getByTestId('grammar-random-start'));
    expect(mockPush).toHaveBeenCalledWith('/grammar/random');
    view.unmount();
  });

  it('with an open round the card says continue and the phase counter; weak topics are counted', async () => {
    const db = getDb();
    await db.setGameProgress(GRAMMAR_RANDOM_KEY, '_run', 'run', openRun(3));
    await db.setGameProgress(GRAMMAR_RANDOM_KEY, 'presente-irregular', 'evidence', answers(0, 3));
    const view = render(<ThemeProvider><GrammarSyllabusScreen /></ThemeProvider>);
    await flush();
    // 3 answered: the card names the NEXT question, like the round screen's counter.
    expect(screen.queryByText('🎲 Continue · Check 4/10')).toBeTruthy();
    expect(screen.queryByText(/· 1 weak topic$/)).toBeTruthy();
    view.unmount();
  });

  it('a full round continues at the next question number', async () => {
    await getDb().setGameProgress(GRAMMAR_RANDOM_KEY, '_run', 'run', openRun(2, 'full'));
    const view = render(<ThemeProvider><GrammarSyllabusScreen /></ThemeProvider>);
    await flush();
    expect(screen.queryByText('🎲 Continue · Full check 3/20')).toBeTruthy();
    view.unmount();
  });

  it('the grammar score counts old-style finished lessons (no kind rows) like their row badges do', async () => {
    const db = getDb();
    await db.setGameProgress(GRAMMAR_PROGRESS_KEY, 'presente-regular', 'done', { correct: 10, total: 10 });
    await db.setGameProgress(GRAMMAR_PROGRESS_KEY, 'presente-irregular', 'done', { correct: 10, total: 10 });
    const written = syllabusLevels('es').flatMap((l) => syllabusForLevel(l, 'es')).filter((tp) => hasLesson('es', tp.id)).length;
    const view = render(<ThemeProvider><GrammarSyllabusScreen /></ThemeProvider>);
    await flush();
    expect(Math.round(200 / written)).toBeGreaterThan(0);
    expect(screen.queryByText(`Grammar score ${Math.round(200 / written)}% · 0 weak topics`)).toBeTruthy();
    view.unmount();
  });

  it('a closed round (state none) is not a continue', async () => {
    await getDb().setGameProgress(GRAMMAR_RANDOM_KEY, '_run', 'none', null);
    const view = render(<ThemeProvider><GrammarSyllabusScreen /></ThemeProvider>);
    await flush();
    expect(screen.queryByText('🎲 Random practice')).toBeTruthy();
    view.unmount();
  });

  it('the badge takes the larger test %, 🎯 behind it; a lesson % that is larger stays plain', async () => {
    const db = getDb();
    await db.setGameProgress(GRAMMAR_RANDOM_KEY, 'presente-regular', 'evidence', answers(3, 4)); // 75%, 4 answers: no tick
    await db.setGameProgress(GRAMMAR_PROGRESS_KEY, 'presente-irregular', 'done', { correct: 10, total: 10 });
    await db.setGameProgress(GRAMMAR_RANDOM_KEY, 'presente-irregular', 'evidence', answers(2, 4)); // 50% < 100%
    const view = render(<ThemeProvider><GrammarSyllabusScreen /></ThemeProvider>);
    await flush();
    const regular = screen.getByTestId('grammar-percent-presente-regular').props.children;
    expect(String(Array.isArray(regular) ? regular.join('') : regular)).toMatch(/^75% 🎯/);
    const irregular = screen.getByTestId('grammar-percent-presente-irregular').props.children;
    expect(String(Array.isArray(irregular) ? irregular.join('') : irregular)).toBe('✓ 100%');
    view.unmount();
  });

  it('a ticked, not finished lesson reads "✓ NN% 🎯"', async () => {
    await getDb().setGameProgress(GRAMMAR_RANDOM_KEY, 'presente-regular', 'evidence', answers(4, 5, ['choice', 'form'])); // 80%, 2 kinds
    const view = render(<ThemeProvider><GrammarSyllabusScreen /></ThemeProvider>);
    await flush();
    const badge = screen.getByTestId('grammar-percent-presente-regular').props.children;
    expect(String(Array.isArray(badge) ? badge.join('') : badge)).toBe('✓ 80% 🎯');
    view.unmount();
  });
});
