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
    expect(onDone).toHaveBeenCalledWith(false, 'tuve');
    expect(screen.queryByTestId('exam-next')).toBeNull();
    expect(screen.queryByText('✓ he tenido')).toBeNull();
  });

  it('instant: a right tap is handed over at once', () => {
    const onDone = jest.fn();
    wrap(card(onDone, true));
    fireEvent.press(screen.getByTestId('exam-option-0'));
    expect(onDone).toHaveBeenCalledWith(true, 'he tenido');
    expect(screen.queryByTestId('exam-next')).toBeNull();
  });

  it('default: a wrong tap reveals the right option and waits for Next', () => {
    const onDone = jest.fn();
    wrap(card(onDone));
    fireEvent.press(screen.getByTestId('exam-option-1'));
    expect(onDone).not.toHaveBeenCalled();
    expect(screen.getByText('✓ he tenido')).toBeTruthy();
    fireEvent.press(screen.getByTestId('exam-next'));
    expect(onDone).toHaveBeenCalledWith(false, 'tuve');
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
    expect(onDone).toHaveBeenCalledWith(false, 'zzz');
    expect(screen.queryByTestId('exam-next')).toBeNull();
    expect(screen.queryByTestId('exam-correct-answer')).toBeNull();
  });

  it('instant: a right answer is handed over at once; "I don\'t know" counts as wrong at once', () => {
    const onDone = jest.fn();
    const view = wrap(card(onDone, true));
    type('hablo');
    expect(onDone).toHaveBeenCalledWith(true, 'hablo');
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
    expect(onDone).toHaveBeenCalledWith(false, 'zzz');
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
    expect(onDone).toHaveBeenCalledWith(false, 'hablo yo');
    expect(screen.queryByTestId('exam-next')).toBeNull();
    expect(screen.queryByTestId('exam-correct-answer')).toBeNull();
  });

  it('instant: a right build is handed over at once', () => {
    const onDone = jest.fn();
    wrap(card(onDone, true));
    build(['yo', 'hablo']);
    expect(onDone).toHaveBeenCalledWith(true, 'yo hablo');
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

describe('ExamTypeCard: a form task on a non-verb table (FB576, FB577)', () => {
  it('shows the table title, the column label and the cell as the task', () => {
    wrap(
      <ExamTypeCard
        heading="From the answer to the question word"
        label="Answer"
        prompt="A la tienda."
        hint="Type the question word"
        answer="adónde"
        sentence={false}
        targetLang="es"
        strictAccents={false}
        instant
        onDone={jest.fn()}
      />
    );
    expect(screen.getByTestId('exam-heading')).toHaveTextContent('From the answer to the question word');
    expect(screen.getByTestId('exam-label')).toHaveTextContent('Answer');
    expect(screen.getByTestId('exam-prompt')).toHaveTextContent('A la tienda.');
    expect(screen.getByTestId('exam-hint')).toHaveTextContent('Type the question word');
  });

  it('a card without them shows only the prompt', () => {
    wrap(<ExamTypeCard prompt="hablar · yo" answer="hablo" sentence={false} targetLang="es" strictAccents={false} onDone={jest.fn()} />);
    expect(screen.queryByTestId('exam-heading')).toBeNull();
    expect(screen.queryByTestId('exam-label')).toBeNull();
  });
});

describe('ExamChoiceCard: the keyboard of a typed question before it', () => {
  it('its ScrollView lets a tap on an option through while the keyboard is open (FB579)', () => {
    const { UNSAFE_getByType } = wrap(<ExamChoiceCard heading="Pick" text="Hoy ___." options={['a', 'b']} correctIndex={0} onDone={jest.fn()} />);
    const { ScrollView } = require('react-native');
    expect(UNSAFE_getByType(ScrollView).props.keyboardShouldPersistTaps).toBe('handled');
  });
});
