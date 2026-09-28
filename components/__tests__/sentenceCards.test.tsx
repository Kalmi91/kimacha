// PLAN-ketiranyu 7. lépés: az összerakós és a begépelős mondatkártya viselkedése.
import { fireEvent, render } from '@testing-library/react-native';
import EasySentenceCard from '../EasySentenceCard';
import TypedSentenceCard from '../TypedSentenceCard';

jest.mock('@/lib/speech', () => ({ speak: jest.fn(), stop: jest.fn() }));

const speech = require('@/lib/speech') as { speak: jest.Mock; stop: jest.Mock };

beforeEach(() => {
  speech.speak.mockClear();
  speech.stop.mockClear();
});

describe('EasySentenceCard (összerakós)', () => {
  const props = {
    sourceSentence: 'The book and the table.',
    targetWords: ['el', 'libro', 'y', 'la', 'mesa'],
    trapWords: ['los'],
    speechLocale: 'es-MX',
  };

  it('reads each placed tile aloud, and a right build turns green with the sentence read out', () => {
    const onResult = jest.fn();
    const { getByText, getAllByText } = render(<EasySentenceCard {...props} onResult={onResult} />);
    for (const w of props.targetWords) fireEvent.press(getAllByText(w)[0]);
    expect(speech.speak).toHaveBeenCalledWith('el', 'es-MX');
    expect(speech.speak).toHaveBeenCalledWith('mesa', 'es-MX');
    fireEvent.press(getByText('Check'));
    expect(speech.speak).toHaveBeenLastCalledWith('el libro y la mesa', 'es-MX');
    fireEvent.press(getByText(/Next/));
    expect(onResult).toHaveBeenCalledWith(true);
  });

  it('a wrong build turns red and shows the correct sentence', () => {
    const onResult = jest.fn();
    const { getByText, getAllByText } = render(<EasySentenceCard {...props} onResult={onResult} />);
    fireEvent.press(getAllByText('mesa')[0]);
    fireEvent.press(getByText('Check'));
    expect(getByText('el libro y la mesa')).toBeTruthy();
    fireEvent.press(getByText(/Next/));
    expect(onResult).toHaveBeenCalledWith(false);
  });

  it('tapping a placed tile returns it to the bank', () => {
    const { getAllByText } = render(<EasySentenceCard {...props} onResult={jest.fn()} />);
    fireEvent.press(getAllByText('libro')[0]);
    expect(getAllByText('libro')).toHaveLength(2);
    fireEvent.press(getAllByText('libro')[0]);
    expect(getAllByText('libro')).toHaveLength(1);
  });
});

describe('TypedSentenceCard (begépelős)', () => {
  const props = {
    sourceSentence: 'The book and the table.',
    targetSentence: 'El libro y la mesa.',
    speechLocale: 'es-MX',
  };

  it('accepts the sentence without punctuation and reads it aloud', () => {
    const onResult = jest.fn();
    const { getByText, getByPlaceholderText } = render(<TypedSentenceCard {...props} onResult={onResult} />);
    fireEvent.changeText(getByPlaceholderText('Type the sentence'), 'el libro y la mesa');
    fireEvent.press(getByText('Check'));
    expect(speech.speak).toHaveBeenCalledWith('El libro y la mesa.', 'es-MX');
    fireEvent.press(getByText(/Next/));
    expect(onResult).toHaveBeenCalledWith(true);
  });

  it('a wrong answer shows the correct sentence and can be retried by editing', () => {
    const onResult = jest.fn();
    const { getByText, getByPlaceholderText, queryByText } = render(<TypedSentenceCard {...props} onResult={onResult} />);
    const input = getByPlaceholderText('Type the sentence');
    fireEvent.changeText(input, 'el gato');
    fireEvent.press(getByText('Check'));
    expect(getByText('El libro y la mesa.')).toBeTruthy();
    fireEvent.changeText(input, 'el libro');
    expect(queryByText('El libro y la mesa.')).toBeNull();
    expect(speech.speak).not.toHaveBeenCalled();
  });

  it('an accent-only slip passes when strict accents are off and fails when on', () => {
    const accent = { sourceSentence: 'It is at home.', targetSentence: 'Está en casa.' };
    const off = render(<TypedSentenceCard {...accent} onResult={jest.fn()} strictAccents={false} />);
    fireEvent.changeText(off.getByPlaceholderText('Type the sentence'), 'esta en casa');
    fireEvent.press(off.getByText('Check'));
    expect(off.queryByText('Está en casa.')).toBeNull();
    const on = render(<TypedSentenceCard {...accent} onResult={jest.fn()} strictAccents />);
    fireEvent.changeText(on.getByPlaceholderText('Type the sentence'), 'esta en casa');
    fireEvent.press(on.getByText('Check'));
    expect(on.getByText('Está en casa.')).toBeTruthy();
  });
});
