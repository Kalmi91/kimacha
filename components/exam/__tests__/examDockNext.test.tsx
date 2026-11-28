// The exam cards' Next / Check go through the docked bar (DockSlot) like every other round: Next is the shared
// "Next →" (tone next, no own label), Check is the shared "✓ Check" (tone check), nothing sits in the scroller,
// and the exam still shows no feedback beyond what the cards showed before (T1, T2, T3).

import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { View } from 'react-native';
import { act, fireEvent, render, screen, within } from '@testing-library/react-native';

import Colors from '@/constants/Colors';
import { DockSlotProvider, useDockSlot } from '@/components/learn/DockSlot';
import ExamChoiceCard from '../ExamChoiceCard';
import ExamMatchCard from '../ExamMatchCard';
import ExamTilesCard from '../ExamTilesCard';
import ExamTypeCard from '../ExamTypeCard';
import ExamSpeakCard from '../ExamSpeakCard';
import { ThemeProvider } from '@/lib/ThemeContext';

jest.mock('@/lib/speech', () => require('@/test-utils/mocks').speechMock());

function Host({ children }: { children: React.ReactNode }) {
  const dock = useDockSlot(Colors.light);
  return (
    <View style={{ flex: 1 }}>
      <DockSlotProvider host={dock}>{children}</DockSlotProvider>
      {dock.node}
    </View>
  );
}
const wrap = (node: React.ReactElement) =>
  render(
    <ThemeProvider>
      <Host>{node}</Host>
    </ThemeProvider>,
  );
const dock = () => within(screen.getByTestId('learn-dock'));
// the docked bar shows exactly one action, and it is the default Next (tone next = "Next →", no own label)
const expectDockedNext = () => {
  expect(dock().getByTestId('exam-next')).toBeTruthy();
  expect(dock().getByText('Next →')).toBeTruthy();
  expect(screen.getAllByTestId('exam-next')).toHaveLength(1);
  expect(screen.queryByText('Next task')).toBeNull();
};
const expectDockedCheck = () => {
  expect(dock().getByTestId('exam-check')).toBeTruthy();
  expect(dock().getByText('✓ Check')).toBeTruthy();
  expect(screen.getAllByTestId('exam-check')).toHaveLength(1);
};

describe('ExamChoiceCard: Next after a wrong tap is docked', () => {
  it('T1 + T2: one docked Next, pressing it hands over the wrong option', () => {
    const onDone = jest.fn();
    wrap(<ExamChoiceCard heading="Pick" text="Hoy ___ trabajo." options={['he tenido', 'tuve', 'tenía']} correctIndex={0} onDone={onDone} />);
    expect(screen.queryByTestId('learn-dock')).toBeNull();
    fireEvent.press(screen.getByTestId('exam-option-1'));
    expectDockedNext();
    expect(onDone).not.toHaveBeenCalled();
    fireEvent.press(screen.getByTestId('exam-next'));
    expect(onDone).toHaveBeenCalledWith(false, 'tuve');
  });

  it('a right tap still moves on at once, with no docked bar', () => {
    const onDone = jest.fn();
    wrap(<ExamChoiceCard heading="Pick" text="Hoy ___ trabajo." options={['he tenido', 'tuve']} correctIndex={0} onDone={onDone} />);
    fireEvent.press(screen.getByTestId('exam-option-0'));
    expect(onDone).toHaveBeenCalledWith(true, 'he tenido');
    expect(screen.queryByTestId('learn-dock')).toBeNull();
  });
});

describe('ExamMatchCard: Check and Next are docked', () => {
  const pairs = [
    { left: 'perro', right: 'dog' },
    { left: 'gato', right: 'cat' },
  ];

  it('T1 + T2: the docked Check is disabled until all rows are paired, then a wrong pairing gives the docked Next', () => {
    const onDone = jest.fn();
    wrap(<ExamMatchCard pairs={pairs} onDone={onDone} />);
    expectDockedCheck();
    expect(screen.getByTestId('exam-check').props.accessibilityState?.disabled ?? screen.getByTestId('exam-check').props.disabled).toBeTruthy();
    // pair crosswise: wrong
    fireEvent.press(screen.getByTestId('exam-right-1'));
    fireEvent.press(screen.getByTestId('exam-right-0'));
    fireEvent.press(screen.getByTestId('exam-check'));
    expectDockedNext();
    expect(screen.queryByTestId('exam-check')).toBeNull();
    expect(onDone).not.toHaveBeenCalled();
    fireEvent.press(screen.getByTestId('exam-next'));
    expect(onDone).toHaveBeenCalledWith(false);
  });

  it('T2: a right pairing passes true on at once', () => {
    const onDone = jest.fn();
    wrap(<ExamMatchCard pairs={pairs} onDone={onDone} />);
    fireEvent.press(screen.getByTestId('exam-right-0'));
    fireEvent.press(screen.getByTestId('exam-right-1'));
    fireEvent.press(screen.getByTestId('exam-check'));
    expect(onDone).toHaveBeenCalledWith(true);
  });
});

describe('ExamTilesCard: Check and Next are docked', () => {
  const card = (onDone: jest.Mock) => <ExamTilesCard prompt="I speak" answerTokens={['yo', 'hablo']} sentence="Yo hablo." distractors={['tú']} onDone={onDone} />;

  it('T1 + T2: the docked Check; a wrong build gives the docked Next that hands over false', () => {
    const onDone = jest.fn();
    wrap(card(onDone));
    expectDockedCheck();
    expect(screen.getByTestId('exam-check').props.accessibilityState?.disabled ?? screen.getByTestId('exam-check').props.disabled).toBeTruthy();
    fireEvent.press(screen.getByText('tú'));
    fireEvent.press(screen.getByTestId('exam-check'));
    expectDockedNext();
    expect(screen.queryByTestId('exam-check')).toBeNull();
    fireEvent.press(screen.getByTestId('exam-next'));
    expect(onDone).toHaveBeenCalledWith(false);
  });

  it('T2: a right build hands over true with the tiles', () => {
    const onDone = jest.fn();
    wrap(card(onDone));
    fireEvent.press(screen.getByText('yo'));
    fireEvent.press(screen.getByText('hablo'));
    fireEvent.press(screen.getByTestId('exam-check'));
    expect(onDone).toHaveBeenCalledWith(true, 'yo hablo');
  });
});

describe('ExamTypeCard / ExamSpeakCard: already docked, still one default action', () => {
  it('typed: Check, then after a wrong answer the Next, both default labels, one at a time', async () => {
    const onDone = jest.fn();
    wrap(<ExamTypeCard prompt="to be" answer="ser" sentence={false} targetLang="es" strictAccents={false} onDone={onDone} />);
    expectDockedCheck();
    fireEvent.changeText(screen.getByTestId('exam-input'), 'xxx');
    fireEvent.press(screen.getByTestId('exam-check'));
    await act(async () => {});
    expectDockedNext();
    fireEvent.press(screen.getByTestId('exam-next'));
    expect(onDone).toHaveBeenCalledWith(false, 'xxx');
  });

  it('spoken: Check, then after a wrong dictation the Next, both default labels', async () => {
    wrap(<ExamSpeakCard prompt="Yo soy" expected="Yo soy" mode="repeat" targetLang="es" strictAccents={false} onDone={jest.fn()} />);
    expectDockedCheck();
    fireEvent.changeText(screen.getByTestId('exam-speak-input'), 'tú eres');
    fireEvent.press(screen.getByTestId('exam-check'));
    await act(async () => {});
    expectDockedNext();
  });
});

// T3: no right / wrong feedback is added to a task card. The cards below carried their own reveal after a wrong answer
// before this slice (the level exam shows the right answer after a wrong one, see app/exam.tsx); the set must not grow.
describe('T3: the task cards under components/exam draw no feedback components', () => {
  const root = join(__dirname, '..');
  const FEEDBACK = /ResultBadge|AnswerFeedbackBox/;
  // result pages after the exam: not task cards
  const RESULT_PAGES = new Set(['MockResultView.tsx']);
  // the level exam's cards: the wrong-answer reveal existed before this slice (shared with the grammar tests)
  const GRANDFATHERED = new Set(['ExamChoiceCard.tsx', 'ExamMatchCard.tsx', 'ExamSpeakCard.tsx', 'ExamTilesCard.tsx', 'ExamTypeCard.tsx']);
  const files = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? (d.name === '__tests__' ? [] : files(join(dir, d.name))) : d.name.endsWith('.tsx') ? [join(dir, d.name)] : []));

  it('only the result page and the five grandfathered level-exam cards mention them', () => {
    const hits = files(root)
      .filter((f) => FEEDBACK.test(readFileSync(f, 'utf8')))
      .map((f) => f.split(/[\\/]/).pop() as string)
      .filter((n) => !RESULT_PAGES.has(n) && !GRANDFATHERED.has(n));
    expect(hits).toEqual([]);
  });

  it('the mock task cards (components/exam/mock, MockTaskCard) import neither', () => {
    const mockFiles = [...files(join(root, 'mock')), join(root, 'MockTaskCard.tsx'), join(root, 'PlacementQuestionCard.tsx')];
    for (const f of mockFiles) expect(readFileSync(f, 'utf8')).not.toMatch(FEEDBACK);
  });
});
