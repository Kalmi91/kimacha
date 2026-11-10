// The exam strip of the Grammar tab (components/grammar/ExamStrip.tsx): title + percent, weak topics, the three buttons
// and the lock notes, in the neo-brutalist and the classic look.

jest.mock('expo-speech', () => ({ speak: jest.fn(), stop: jest.fn(), getAvailableVoicesAsync: jest.fn(async () => []) }));
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), push: mockPush }),
  usePathname: () => '/grammar',
}));
const mockMock = jest.fn((_t: string, _l: string) => true);
jest.mock('@/lib/exam/mock/blueprint', () => ({
  ...jest.requireActual('@/lib/exam/mock/blueprint'),
  mockAvailable: (t: string, l: string) => mockMock(t, l),
}));

import { fireEvent, render, screen } from '@testing-library/react-native';

import ExamStrip from '@/components/grammar/ExamStrip';
import type { Level } from '@/data/words';
import { getDb } from '@/lib/database.web';
import { EXAM_LEVELS } from '@/lib/exam/types';
import type { ExamLevelStatus } from '@/lib/exam/unlock';
import type { EvidenceAnswer, TopicEvidence } from '@/lib/grammar/randomRound';
import { hasLesson, syllabusForLevel } from '@/lib/grammar/syllabus';
import { ThemeProvider } from '@/lib/ThemeContext';
import { makeFlush } from '@/test-utils/flush';

const flush = makeFlush(4);

const answers = (ok: number, total: number, kinds: ('choice' | 'form')[] = ['choice']): TopicEvidence => ({
  answers: Array.from({ length: total }, (_, i): EvidenceAnswer => ({ id: `q${i}`, kind: kinds[i % kinds.length], ok: i < ok, at: '2026-11-01' })),
});

const writtenIds = (level: Level) => syllabusForLevel(level, 'es').filter((tp) => hasLesson('es', tp.id)).map((tp) => tp.id);

const status = (over: Partial<ExamLevelStatus> = {}): ExamLevelStatus => ({
  level: 'A1', total: 100, learned: 80, needed: 80, missing: 0, lessonDone: true, unlocked: true, ...over,
});

const show = async (props: { level?: Level; evidence?: Map<string, TopicEvidence>; examStatus?: ExamLevelStatus } = {}) => {
  const view = render(
    <ThemeProvider>
      <ExamStrip level={props.level ?? 'A1'} learnedLang="es" contentLang="en" evidence={props.evidence ?? new Map()} examStatus={props.examStatus} />
    </ThemeProvider>,
  );
  await flush();
  return view;
};

describe.each([
  ['neo-brutalist', 'brand'],
  ['classic', 'classic'],
] as const)('ExamStrip (%s)', (_name, palette) => {
  beforeEach(async () => {
    mockPush.mockClear();
    mockMock.mockReset();
    mockMock.mockReturnValue(true);
    const db = getDb();
    await db.setOnboarding('en', 'es');
    await db.setGrammarPalette(palette);
  });

  it('shows the title and the percent; no data → the start-the-test line', async () => {
    const view = await show();
    expect(screen.getByTestId('grammar-exam-strip-A1')).toBeTruthy();
    expect(screen.getByTestId('grammar-exam-strip-title-A1')).toHaveTextContent('A1 exam');
    expect(screen.getByTestId('grammar-exam-strip-pct-A1')).toHaveTextContent('0% grammar ready');
    expect(screen.getByTestId('grammar-exam-nodata-A1')).toHaveTextContent('Not enough test answers yet. Do the level test.');
    expect(screen.queryByTestId('grammar-exam-noweak-A1')).toBeNull();
    view.unmount();
  });

  it('a level without a written lesson has no strip', async () => {
    const view = await show({ level: 'C2' });
    expect(screen.queryByTestId('grammar-exam-strip-C2')).toBeNull();
    view.unmount();
  });

  it('lists up to 3 weak topics, lowest first, and a tap opens the lesson', async () => {
    const ids = writtenIds('A1');
    expect(ids.length).toBeGreaterThanOrEqual(4);
    const evidence = new Map<string, TopicEvidence>([
      [ids[0], answers(2, 5)], // 40
      [ids[1], answers(0, 5)], // 0
      [ids[2], answers(3, 5)], // 60
      [ids[3], answers(1, 5)], // 20
    ]);
    const view = await show({ evidence });
    expect(screen.queryByText('Weakest now')).toBeTruthy();
    expect(screen.getByTestId(`grammar-exam-weak-A1-${ids[1]}`)).toHaveTextContent(/\D0%$/);
    expect(screen.getByTestId(`grammar-exam-weak-A1-${ids[3]}`)).toHaveTextContent(/\D20%$/);
    expect(screen.getByTestId(`grammar-exam-weak-A1-${ids[0]}`)).toHaveTextContent(/\D40%$/);
    expect(screen.queryByTestId(`grammar-exam-weak-A1-${ids[2]}`)).toBeNull();
    expect(screen.queryByTestId('grammar-exam-nodata-A1')).toBeNull();
    fireEvent.press(screen.getByTestId(`grammar-exam-weak-A1-${ids[3]}`));
    expect(mockPush).toHaveBeenCalledWith(`/grammar/${ids[3]}`);
    view.unmount();
  });

  it('topics with only 1-2 answers have no percent: not listed, the no-data line shows', async () => {
    const ids = writtenIds('A1');
    const view = await show({ evidence: new Map([[ids[0], answers(2, 2)], [ids[1], answers(0, 1)]]) });
    expect(screen.getByTestId('grammar-exam-nodata-A1')).toBeTruthy();
    expect(screen.queryByTestId(`grammar-exam-weak-A1-${ids[0]}`)).toBeNull();
    expect(screen.queryByTestId(`grammar-exam-weak-A1-${ids[1]}`)).toBeNull();
    expect(screen.queryByTestId('grammar-exam-noweak-A1')).toBeNull();
    view.unmount();
  });

  it('a level with no vocabulary cards has no level exam button', async () => {
    const view = await show({ examStatus: status({ total: 0, learned: 0, needed: 0, unlocked: false }) });
    expect(screen.queryByTestId('grammar-exam-open-A1')).toBeNull();
    expect(screen.getByTestId('grammar-level-test-A1')).toBeTruthy();
    view.unmount();
  });

  it('test data but nothing under the tick percent → "No weak topic right now."', async () => {
    const ids = writtenIds('A1');
    const view = await show({ evidence: new Map([[ids[0], answers(5, 5, ['choice', 'form'])]]) });
    expect(screen.getByTestId('grammar-exam-noweak-A1')).toHaveTextContent('No weak topic right now.');
    view.unmount();
  });

  it('a tick in front of the title once every topic is ticked off', async () => {
    const evidence = new Map(writtenIds('A1').map((id) => [id, answers(5, 5, ['choice', 'form'])] as [string, TopicEvidence]));
    const view = await show({ evidence });
    expect(screen.getByTestId('grammar-exam-strip-title-A1')).toHaveTextContent('✓ A1 exam');
    expect(screen.getByTestId('grammar-exam-strip-pct-A1')).toHaveTextContent('100% grammar ready');
    view.unmount();
  });

  it('the three buttons push their routes', async () => {
    const view = await show({ examStatus: status() });
    fireEvent.press(screen.getByTestId('grammar-level-test-A1'));
    expect(mockPush).toHaveBeenLastCalledWith('/grammar/level-test?level=A1');
    fireEvent.press(screen.getByTestId('grammar-exam-open-A1'));
    expect(mockPush).toHaveBeenLastCalledWith({ pathname: '/exam', params: { level: 'A1' } });
    fireEvent.press(screen.getByTestId('grammar-mock-open-A1'));
    expect(mockPush).toHaveBeenLastCalledWith({ pathname: '/mock-exam', params: { level: 'A1' } });
    expect(mockMock).toHaveBeenCalledWith('es', 'A1');
    expect(screen.queryByTestId('grammar-exam-lock-A1')).toBeNull();
    view.unmount();
  });

  it('locked: the exam button is disabled and the note names the missing words', async () => {
    const view = await show({ examStatus: status({ learned: 30, needed: 80, missing: 50, unlocked: false }) });
    expect(screen.getByTestId('grammar-exam-open-A1').props.accessibilityState).toMatchObject({ disabled: true });
    fireEvent.press(screen.getByTestId('grammar-exam-open-A1'));
    expect(mockPush).not.toHaveBeenCalled();
    expect(screen.getByTestId('grammar-exam-lock-A1')).toHaveTextContent('30 / 80 words learned, 50 to go');
    expect(screen.getByTestId('grammar-exam-lock-A1')).not.toHaveTextContent(/Finish one grammar lesson/);
    view.unmount();
  });

  it('locked: no finished lesson → the lesson note; both missing → both notes', async () => {
    const lesson = await show({ examStatus: status({ lessonDone: false, unlocked: false }) });
    expect(screen.getByTestId('grammar-exam-lock-A1')).toHaveTextContent('Finish one grammar lesson of this level.');
    expect(screen.getByTestId('grammar-exam-lock-A1')).not.toHaveTextContent(/words learned/);
    lesson.unmount();
    const both = await show({ examStatus: status({ learned: 1, needed: 80, missing: 79, lessonDone: false, unlocked: false }) });
    expect(screen.getByTestId('grammar-exam-lock-A1')).toHaveTextContent(/1 \/ 80 words learned, 79 to go/);
    expect(screen.getByTestId('grammar-exam-lock-A1')).toHaveTextContent(/Finish one grammar lesson of this level\./);
    both.unmount();
  });

  it('status not loaded yet: the exam button is disabled and there is no note', async () => {
    const view = await show();
    expect(screen.getByTestId('grammar-exam-open-A1').props.accessibilityState).toMatchObject({ disabled: true });
    expect(screen.queryByTestId('grammar-exam-lock-A1')).toBeNull();
    view.unmount();
  });

  it('no mock exam for the level → no mock button', async () => {
    mockMock.mockReturnValue(false);
    const view = await show({ examStatus: status() });
    expect(screen.queryByTestId('grammar-mock-open-A1')).toBeNull();
    expect(screen.getByTestId('grammar-exam-open-A1')).toBeTruthy();
    view.unmount();
  });

  it('a level outside the exam levels has no level exam button', async () => {
    const outside = (['B1', 'B2', 'C1'] as Level[]).concat(['C2']).find((l) => !(EXAM_LEVELS as readonly string[]).includes(l) && writtenIds(l).length > 0);
    expect(outside).toBeDefined();
    const view = await show({ level: outside as Level });
    expect(screen.getByTestId(`grammar-exam-strip-${outside}`)).toBeTruthy();
    expect(screen.queryByTestId(`grammar-exam-open-${outside}`)).toBeNull();
    view.unmount();
  });
});
