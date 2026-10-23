// The tappable English prompt (components/HintedSentence.tsx, beta sentenceHint) on its own and inside the two sentence cards.
import { fireEvent, render, within } from '@testing-library/react-native';

import type { HintPiece } from '@/lib/sentenceHint';
import EasySentenceCard from '../EasySentenceCard';
import HintedSentence from '../HintedSentence';
import TypedSentenceCard from '../TypedSentenceCard';

jest.mock('@/lib/speech', () => ({ speak: jest.fn(), stop: jest.fn() }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, left: 0, right: 0, bottom: 0 }),
}));

// "The book and the table." with "book" and "table" tappable.
const PIECES: HintPiece[] = [
  { text: 'The' },
  { text: ' ' },
  { text: 'book', hint: { index: 1, es: 'libro', lemma: 'libro', ids: ['a1-w1'] } },
  { text: ' and the ' },
  { text: 'table', hint: { index: 4, es: 'mesa', lemma: 'mesa', ids: ['a1-w2'] } },
  { text: '.' },
];
const SENTENCE = 'The book and the table.';

describe('HintedSentence', () => {
  it('without pieces it is the plain sentence: nothing to tap', () => {
    const { getByText, queryByTestId } = render(<HintedSentence text={SENTENCE} />);
    expect(getByText(SENTENCE)).toBeTruthy();
    expect(queryByTestId('sentence-hint-1')).toBeNull();
  });

  it('the marked words are tappable; a tap opens the bubble with the Spanish word and "hint used", a second tap closes it', () => {
    const onHint = jest.fn();
    const { getByTestId, queryByTestId, getByText, queryByText } = render(<HintedSentence text={SENTENCE} pieces={PIECES} onHint={onHint} />);
    expect(getByText(SENTENCE)).toBeTruthy(); // the pieces read as the sentence
    expect(queryByTestId('sentence-hint-0')).toBeNull(); // "The" is not marked
    expect(queryByTestId('sentence-hint-bubble')).toBeNull();
    fireEvent.press(getByTestId('sentence-hint-1'));
    expect(getByTestId('sentence-hint-bubble')).toBeTruthy();
    expect(getByText('libro')).toBeTruthy();
    expect(getByText('hint used')).toBeTruthy();
    expect(onHint).toHaveBeenLastCalledWith(['a1-w1']);
    fireEvent.press(getByTestId('sentence-hint-4')); // another word: the bubble moves
    expect(getByText('mesa')).toBeTruthy();
    expect(queryByText('libro')).toBeNull();
    expect(onHint).toHaveBeenLastCalledWith(['a1-w2']);
    fireEvent.press(getByTestId('sentence-hint-4'));
    expect(queryByTestId('sentence-hint-bubble')).toBeNull();
    expect(onHint).toHaveBeenCalledTimes(3); // closing is a tap too: the word was looked at anyway
  });
});

describe('the sentence cards with hints', () => {
  const build = {
    sourceSentence: SENTENCE,
    targetWords: ['el', 'libro', 'y', 'la', 'mesa'],
    trapWords: ['los'],
    sourceHints: PIECES,
  };

  it('EasySentenceCard: tappable words on the prompt, the tap goes to onSourceHint', () => {
    const onSourceHint = jest.fn();
    const { getByTestId } = render(<EasySentenceCard {...build} onSourceHint={onSourceHint} onResult={jest.fn()} />);
    fireEvent.press(getByTestId('sentence-hint-1'));
    expect(within(getByTestId('sentence-hint-bubble')).getByText('libro')).toBeTruthy(); // a tile "libro" is on the card too
    expect(onSourceHint).toHaveBeenCalledWith(['a1-w1']);
  });

  it('TypedSentenceCard, listening step: no prompt and so no hints until the answer is checked', () => {
    const { queryByTestId, getByTestId, getByText, getByPlaceholderText } = render(
      <TypedSentenceCard sourceSentence={SENTENCE} targetSentence="El libro y la mesa." sourceHints={PIECES} listening onResult={jest.fn()} />,
    );
    expect(queryByTestId('sentence-hint-1')).toBeNull();
    fireEvent.changeText(getByPlaceholderText('Type the sentence'), 'el libro y la mesa');
    fireEvent.press(getByText('✓ Check'));
    expect(getByTestId('sentence-hint-1')).toBeTruthy();
    fireEvent.press(getByTestId('sentence-hint-1'));
    expect(getByTestId('sentence-hint-bubble')).toBeTruthy();
  });

  it('TypedSentenceCard, listening step, wrong answer: the prompt and its hints show after the check as well', () => {
    const { queryByTestId, getByTestId, getByText, getByPlaceholderText } = render(
      <TypedSentenceCard sourceSentence={SENTENCE} targetSentence="El libro y la mesa." sourceHints={PIECES} listening onResult={jest.fn()} />,
    );
    fireEvent.changeText(getByPlaceholderText('Type the sentence'), 'el gato');
    expect(queryByTestId('sentence-hint-1')).toBeNull();
    fireEvent.press(getByText('✓ Check'));
    expect(getByTestId('sentence-hint-1')).toBeTruthy();
  });

  it('TypedSentenceCard: tappable words on the prompt, the tap goes to onSourceHint', () => {
    const onSourceHint = jest.fn();
    const { getByTestId, getByText } = render(
      <TypedSentenceCard sourceSentence={SENTENCE} targetSentence="El libro y la mesa." sourceHints={PIECES} onSourceHint={onSourceHint} onResult={jest.fn()} />,
    );
    fireEvent.press(getByTestId('sentence-hint-4'));
    expect(getByText('mesa')).toBeTruthy();
    expect(onSourceHint).toHaveBeenCalledWith(['a1-w2']);
  });

  it('without hints both cards show the prompt as before', () => {
    const easy = render(<EasySentenceCard {...build} sourceHints={undefined} onResult={jest.fn()} />);
    expect(easy.getByText(SENTENCE)).toBeTruthy();
    expect(easy.queryByTestId('sentence-hint-1')).toBeNull();
    const typed = render(<TypedSentenceCard sourceSentence={SENTENCE} targetSentence="El libro y la mesa." onResult={jest.fn()} />);
    expect(typed.getByText(SENTENCE)).toBeTruthy();
  });
});
