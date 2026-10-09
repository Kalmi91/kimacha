// behaviour of the assemble and the type-in sentence cards.
import { fireEvent, render } from '@testing-library/react-native';
import EasySentenceCard from '../EasySentenceCard';
import TypedSentenceCard from '../TypedSentenceCard';

jest.mock('@/lib/speech', () => ({ speak: jest.fn(), stop: jest.fn() }));

const speech = require('@/lib/speech') as { speak: jest.Mock; stop: jest.Mock };

beforeEach(() => {
  speech.speak.mockClear();
  speech.stop.mockClear();
});

describe('EasySentenceCard (build-the-sentence)', () => {
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
    // the correct sentence is spoken after a wrong build too.
    expect(speech.speak).toHaveBeenLastCalledWith('el libro y la mesa', 'es-MX');
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

describe('TypedSentenceCard (type-it)', () => {
  const props = {
    sourceSentence: 'The book and the table.',
    targetSentence: 'El libro y la mesa.',
    speechLocale: 'es-MX',
  };

  it('accepts the sentence without punctuation and reads it aloud', () => {
    const onResult = jest.fn();
    const { getByText, getByPlaceholderText } = render(<TypedSentenceCard {...props} onResult={onResult} />);
    fireEvent.changeText(getByPlaceholderText('Type the sentence'), 'el libro y la mesa');
    fireEvent.press(getByText('✓ Check'));
    expect(speech.speak).toHaveBeenCalledWith('El libro y la mesa.', 'es-MX');
    fireEvent.press(getByText(/Next/));
    expect(onResult).toHaveBeenCalledWith(true);
  });

  it('a wrong answer shows the correct sentence and can be retried by editing', () => {
    const onResult = jest.fn();
    const { getByText, getByPlaceholderText, queryByText } = render(<TypedSentenceCard {...props} onResult={onResult} />);
    const input = getByPlaceholderText('Type the sentence');
    fireEvent.changeText(input, 'el gato');
    fireEvent.press(getByText('✓ Check'));
    expect(getByText('El libro y la mesa.')).toBeTruthy();
    fireEvent.changeText(input, 'el libro');
    expect(queryByText('El libro y la mesa.')).toBeNull();
    // the correct sentence is spoken after a wrong answer too (once, at Check).
    expect(speech.speak).toHaveBeenCalledTimes(1);
    expect(speech.speak).toHaveBeenCalledWith('El libro y la mesa.', 'es-MX');
  });

  it('an accent-only slip passes when strict accents are off and fails when on', () => {
    const accent = { sourceSentence: 'It is at home.', targetSentence: 'Está en casa.' };
    const off = render(<TypedSentenceCard {...accent} onResult={jest.fn()} strictAccents={false} />);
    fireEvent.changeText(off.getByPlaceholderText('Type the sentence'), 'esta en casa');
    fireEvent.press(off.getByText('✓ Check'));
    expect(off.queryByText('Está en casa.')).toBeNull();
    const on = render(<TypedSentenceCard {...accent} onResult={jest.fn()} strictAccents />);
    fireEvent.changeText(on.getByPlaceholderText('Type the sentence'), 'esta en casa');
    fireEvent.press(on.getByText('✓ Check'));
    expect(on.getByText('Está en casa.')).toBeTruthy();
  });

  // a sentence without the pronoun is fine too.
  it('accepts the sentence without the leading subject pronoun', () => {
    const onResult = jest.fn();
    const { getByText, getByPlaceholderText } = render(
      <TypedSentenceCard sourceSentence="I eat at home." targetSentence="Yo como en casa." speechLocale="es-MX" onResult={onResult} />
    );
    fireEvent.changeText(getByPlaceholderText('Type the sentence'), 'como en casa');
    fireEvent.press(getByText('✓ Check'));
    fireEvent.press(getByText(/Next/));
    expect(onResult).toHaveBeenCalledWith(true);
  });

  // Check is not a button inside the card but the docked bar (DockedAction) above the keyboard, as
  // on the word card, and it sits at the lift / position given by the parent.
  it('the Check bar is the docked action, lifted by the keyboard height the parent passes', () => {
    const onHeight = jest.fn();
    const { getByText, UNSAFE_getByProps } = render(
      <TypedSentenceCard {...props} onResult={jest.fn()} dockLift={300} dockH={80} onDockHeight={onHeight} />
    );
    const bar = getByText('✓ Check');
    expect(bar).toBeTruthy();
    const docked = UNSAFE_getByProps({ bottom: 300 });
    expect(docked.props.label).toBe('✓ Check');
    expect(docked.props.tone).toBe('check');
  });
});

// the word card's "Didn't know" / "Knew it" button row after Check is on the sentence cards too;
// tapping overrides the displayed rating, and Next passes it on (the sentence card writes no SRS).
describe('Didn\'t know / Knew it on the sentence cards', () => {
  const easy = {
    sourceSentence: 'The book and the table.',
    targetWords: ['el', 'libro', 'y', 'la', 'mesa'],
    trapWords: ['los'],
  };
  const typed = { sourceSentence: 'The book and the table.', targetSentence: 'El libro y la mesa.' };

  it('build-the-sentence: not shown before Check, appear after a wrong build, "Knew it" rewrites it to right', () => {
    const onResult = jest.fn();
    const r = render(<EasySentenceCard {...easy} onResult={onResult} gradeButtons />);
    expect(r.queryByTestId('sentence-grades')).toBeNull();
    fireEvent.press(r.getAllByText('mesa')[0]);
    fireEvent.press(r.getByText('Check'));
    expect(r.getByText('Wrong')).toBeTruthy();
    expect(r.getByText("Didn't know")).toBeTruthy();
    fireEvent.press(r.getByText('Knew it'));
    expect(r.getByText('Correct!')).toBeTruthy();
    expect(r.queryByText('Wrong')).toBeNull();
    // the correct sentence is still shown after the override
    expect(r.getByText('el libro y la mesa')).toBeTruthy();
    fireEvent.press(r.getByText(/Next/));
    expect(onResult).toHaveBeenCalledWith(true);
  });

  it('build-the-sentence: after a right build "Didn\'t know" rewrites it to wrong', () => {
    const onResult = jest.fn();
    const r = render(<EasySentenceCard {...easy} onResult={onResult} gradeButtons />);
    for (const w of easy.targetWords) fireEvent.press(r.getAllByText(w)[0]);
    fireEvent.press(r.getByText('Check'));
    expect(r.getByText('Correct!')).toBeTruthy();
    fireEvent.press(r.getByText("Didn't know"));
    expect(r.getByText('Wrong')).toBeTruthy();
    fireEvent.press(r.getByText(/Next/));
    expect(onResult).toHaveBeenCalledWith(false);
  });

  it('type-it: appear after a wrong answer, "Knew it" rewrites it to right, Next passes this on', () => {
    const onResult = jest.fn();
    const r = render(<TypedSentenceCard {...typed} onResult={onResult} gradeButtons />);
    expect(r.queryByTestId('sentence-grades')).toBeNull();
    fireEvent.changeText(r.getByPlaceholderText('Type the sentence'), 'el gato');
    fireEvent.press(r.getByText('✓ Check'));
    expect(r.getByText('Wrong')).toBeTruthy();
    expect(r.getByText("Didn't know")).toBeTruthy();
    fireEvent.press(r.getByText('Knew it'));
    expect(r.getByText('Correct!')).toBeTruthy();
    expect(r.queryByText('Wrong')).toBeNull();
    expect(r.getByText('El libro y la mesa.')).toBeTruthy();
    fireEvent.press(r.getByText(/Next/));
    expect(onResult).toHaveBeenCalledWith(true);
  });

  it('type-it: after a right answer "Didn\'t know" rewrites it to wrong', () => {
    const onResult = jest.fn();
    const r = render(<TypedSentenceCard {...typed} onResult={onResult} gradeButtons />);
    fireEvent.changeText(r.getByPlaceholderText('Type the sentence'), 'el libro y la mesa');
    fireEvent.press(r.getByText('✓ Check'));
    expect(r.getByText('Correct!')).toBeTruthy();
    fireEvent.press(r.getByText("Didn't know"));
    expect(r.getByText('Wrong')).toBeTruthy();
    fireEvent.press(r.getByText(/Next/));
    expect(onResult).toHaveBeenCalledWith(false);
  });

  it('the buttons are opt-in: without the prop (e.g. the grammar ordering task) they are absent', () => {
    const r = render(<TypedSentenceCard {...typed} onResult={jest.fn()} />);
    fireEvent.changeText(r.getByPlaceholderText('Type the sentence'), 'el gato');
    fireEvent.press(r.getByText('✓ Check'));
    expect(r.queryByTestId('sentence-grades')).toBeNull();
    const e = render(<EasySentenceCard {...easy} onResult={jest.fn()} />);
    fireEvent.press(e.getAllByText('mesa')[0]);
    fireEvent.press(e.getByText('Check'));
    expect(e.queryByTestId('sentence-grades')).toBeNull();
  });
});

// the task sentence is spoken when the card opens (in the source language), like the word card's
// prompt; without a locale nothing is spoken.
describe('the task sentence is read aloud on open', () => {
  it('type-it card: the source sentence is spoken in English', () => {
    render(
      <TypedSentenceCard
        sourceSentence="The book and the table."
        targetSentence="El libro y la mesa."
        speechLocale="es-MX"
        sourceSpeechLocale="en-US"
        onResult={jest.fn()}
      />
    );
    expect(speech.speak).toHaveBeenCalledTimes(1);
    expect(speech.speak).toHaveBeenCalledWith('The book and the table.', 'en-US');
  });

  it('build-the-sentence card: the source sentence is spoken in English', () => {
    render(
      <EasySentenceCard
        sourceSentence="The book and the table."
        targetWords={['el', 'libro', 'y', 'la', 'mesa']}
        trapWords={['los']}
        speechLocale="es-MX"
        sourceSpeechLocale="en-US"
        onResult={jest.fn()}
      />
    );
    expect(speech.speak).toHaveBeenCalledTimes(1);
    expect(speech.speak).toHaveBeenCalledWith('The book and the table.', 'en-US');
  });

  it('without a source locale it does not speak on open', () => {
    render(<TypedSentenceCard sourceSentence="x" targetSentence="y" speechLocale="es-MX" onResult={jest.fn()} />);
    expect(speech.speak).not.toHaveBeenCalled();
  });
});
