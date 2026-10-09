// az összerakós és a begépelős mondatkártya viselkedése.
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
    // rossz építésnél is elhangzik a helyes mondat.
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
    // a helyes mondat rossz válasz után is elhangzik (egyszer, a Check-nél).
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

  // a névmás nélküli mondat is jó.
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

  // a Check nem a kártyán belüli gomb, hanem a
  // dokkolt sáv (DockedAction) a billentyűzet fölött, mint a szókártyán, és a
  // szülő által adott emelés / hely szerint áll.
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

// a szókártya Check utáni "Didn't know" / "Knew it" gombsora a mondatkártyákon is; a
// koppintás a kijelzett értékelést írja át, a Next ezt adja tovább (a mondatkártya nem ír SRS-t).
describe('FB455: Didn\'t know / Knew it a mondatkártyákon', () => {
  const easy = {
    sourceSentence: 'The book and the table.',
    targetWords: ['el', 'libro', 'y', 'la', 'mesa'],
    trapWords: ['los'],
  };
  const typed = { sourceSentence: 'The book and the table.', targetSentence: 'El libro y la mesa.' };

  it('összerakós: Check előtt nincsenek, rossz építés után megjelennek, a "Knew it" jóra írja át', () => {
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
    // a helyes mondat a felülbírálás után is látszik
    expect(r.getByText('el libro y la mesa')).toBeTruthy();
    fireEvent.press(r.getByText(/Next/));
    expect(onResult).toHaveBeenCalledWith(true);
  });

  it('összerakós: jó építés után a "Didn\'t know" rosszra írja át', () => {
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

  it('begépelős: rossz válasz után megjelennek, a "Knew it" jóra írja át, a Next ezt adja tovább', () => {
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

  it('begépelős: jó válasz után a "Didn\'t know" rosszra írja át', () => {
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

  it('a gombok opt-in: prop nélkül (pl. a nyelvtani rendező feladat) nincsenek', () => {
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

// a feladat-mondat a kártya megnyitásakor elhangzik (a
// kiinduló nyelven), mint a szókártya promptja; locale nélkül nem szól semmi.
describe('a feladat-mondat felolvasása megnyitáskor (FB434)', () => {
  it('begépelős kártya: a forrás-mondat elhangzik angolul', () => {
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

  it('összerakós kártya: a forrás-mondat elhangzik angolul', () => {
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

  it('forrás-locale nélkül nem szól a megnyitáskor', () => {
    render(<TypedSentenceCard sourceSentence="x" targetSentence="y" speechLocale="es-MX" onResult={jest.fn()} />);
    expect(speech.speak).not.toHaveBeenCalled();
  });
});
