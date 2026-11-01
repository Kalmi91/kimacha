// The `instant` mode of the exam cards (the random grammar round's practice): the result is handed over at once,
// with no reveal and no "Next" on the card. Without it (the exam, the lesson test) the cards behave as before.

import { fireEvent, render, screen } from '@testing-library/react-native';

import { ThemeProvider } from '@/lib/ThemeContext';
import ExamChoiceCard from '../ExamChoiceCard';
import ExamTilesCard from '../ExamTilesCard';
import ExamTypeCard from '../ExamTypeCard';

const wrap = (node: React.ReactElement) => render(<ThemeProvider>{node}</ThemeProvider>);

describe('ExamChoiceCard', () => {
  const card = (onDone: jest.Mock, instant?: boolean) => (
    <ExamChoiceCard heading="Pick" text="Hoy ___ trabajo." options={['he tenido', 'tuve', 'tenía']} correctIndex={0} instant={instant} onDone={onDone} />
  );

  it('instant: a wrong tap is handed over at once, nothing is revealed, no Next', () => {
    const onDone = jest.fn();
    wrap(card(onDone, true));
    fireEvent.press(screen.getByTestId('exam-option-1'));
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(onDone).toHaveBeenCalledWith(false);
    expect(screen.queryByTestId('exam-next')).toBeNull();
    expect(screen.queryByText('✓ he tenido')).toBeNull();
  });

  it('instant: a right tap is handed over at once', () => {
    const onDone = jest.fn();
    wrap(card(onDone, true));
    fireEvent.press(screen.getByTestId('exam-option-0'));
    expect(onDone).toHaveBeenCalledWith(true);
    expect(screen.queryByTestId('exam-next')).toBeNull();
  });

  it('default: a wrong tap reveals the right option and waits for Next', () => {
    const onDone = jest.fn();
    wrap(card(onDone));
    fireEvent.press(screen.getByTestId('exam-option-1'));
    expect(onDone).not.toHaveBeenCalled();
    expect(screen.getByText('✓ he tenido')).toBeTruthy();
    fireEvent.press(screen.getByTestId('exam-next'));
    expect(onDone).toHaveBeenCalledWith(false);
  });
});

describe('ExamTypeCard', () => {
  const card = (onDone: jest.Mock, instant?: boolean) => (
    <ExamTypeCard prompt="hablar · yo" answer="hablo" sentence={false} targetLang="es" strictAccents={false} instant={instant} onDone={onDone} />
  );
  const type = (value: string) => {
    fireEvent.changeText(screen.getByTestId('exam-input'), value);
    fireEvent.press(screen.getByTestId('exam-check'));
  };

  it('instant: a wrong answer is handed over at once, the right answer is not revealed, no Next', () => {
    const onDone = jest.fn();
    wrap(card(onDone, true));
    type('zzz');
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(onDone).toHaveBeenCalledWith(false);
    expect(screen.queryByTestId('exam-next')).toBeNull();
    expect(screen.queryByTestId('exam-correct-answer')).toBeNull();
  });

  it('instant: a right answer is handed over at once; "I don\'t know" counts as wrong at once', () => {
    const onDone = jest.fn();
    const view = wrap(card(onDone, true));
    type('hablo');
    expect(onDone).toHaveBeenCalledWith(true);
    view.unmount();
    const giveUp = jest.fn();
    wrap(card(giveUp, true));
    fireEvent.press(screen.getByTestId('exam-dont-know'));
    expect(giveUp).toHaveBeenCalledTimes(1);
    expect(giveUp).toHaveBeenCalledWith(false);
    expect(screen.queryByTestId('exam-next')).toBeNull();
  });

  it('default: a wrong answer reveals the right one and waits for Next', () => {
    const onDone = jest.fn();
    wrap(card(onDone));
    type('zzz');
    expect(onDone).not.toHaveBeenCalled();
    expect(screen.getByTestId('exam-correct-answer')).toHaveTextContent('hablo');
    fireEvent.press(screen.getByTestId('exam-next'));
    expect(onDone).toHaveBeenCalledWith(false);
  });
});

describe('ExamTilesCard', () => {
  const card = (onDone: jest.Mock, instant?: boolean) => (
    <ExamTilesCard prompt="I speak" answerTokens={['yo', 'hablo']} sentence="Yo hablo." distractors={[]} instant={instant} onDone={onDone} />
  );
  const build = (words: string[]) => {
    for (const w of words) fireEvent.press(screen.getByText(w));
    fireEvent.press(screen.getByTestId('exam-check'));
  };

  it('instant: a wrong build is handed over at once, the sentence is not revealed, no Next', () => {
    const onDone = jest.fn();
    wrap(card(onDone, true));
    build(['hablo', 'yo']);
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(onDone).toHaveBeenCalledWith(false);
    expect(screen.queryByTestId('exam-next')).toBeNull();
    expect(screen.queryByTestId('exam-correct-answer')).toBeNull();
  });

  it('instant: a right build is handed over at once', () => {
    const onDone = jest.fn();
    wrap(card(onDone, true));
    build(['yo', 'hablo']);
    expect(onDone).toHaveBeenCalledWith(true);
  });

  it('default: a wrong build reveals the sentence and waits for Next', () => {
    const onDone = jest.fn();
    wrap(card(onDone));
    build(['hablo', 'yo']);
    expect(onDone).not.toHaveBeenCalled();
    expect(screen.getByTestId('exam-correct-answer')).toHaveTextContent('Yo hablo.');
    fireEvent.press(screen.getByTestId('exam-next'));
    expect(onDone).toHaveBeenCalledWith(false);
  });
});
