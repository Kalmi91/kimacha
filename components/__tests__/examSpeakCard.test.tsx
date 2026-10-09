// The card of the oral item. The learner dictates into a text field with the
// keyboard's microphone (in the test, typed text is the same); the app
// compares it with the expected sentence. After a correct sentence there is no feedback, after a wrong one the differing words
// are highlighted, and "Next" moves on. The accent follows the "Accents count" setting.

import { fireEvent, render } from '@testing-library/react-native';

import ExamSpeakCard from '../exam/ExamSpeakCard';

type Props = Partial<React.ComponentProps<typeof ExamSpeakCard>>;

const renderCard = (props: Props = {}) => {
  const onDone = jest.fn();
  const screen = render(
    <ExamSpeakCard
      prompt="I eat at home."
      expected="Yo como en casa."
      mode="translate"
      targetLang="es"
      strictAccents={false}
      onDone={onDone}
      {...props}
    />,
  );
  return { ...screen, onDone };
};

const say = (screen: ReturnType<typeof renderCard>, text: string) => {
  fireEvent.changeText(screen.getByTestId('exam-speak-input'), text);
  fireEvent.press(screen.getByTestId('exam-check'));
};

describe('ExamSpeakCard', () => {
  it('translate módban a kiinduló nyelvű mondatot mutatja, a célnyelv nevével és a billentyűzet-mikrofon felirattal', () => {
    const screen = renderCard();
    expect(screen.getByTestId('exam-speak-mode').props.children).toBe('Say it in Spanish');
    expect(screen.getByTestId('exam-speak-prompt').props.children).toBe('I eat at home.');
    expect(screen.getByTestId('exam-speak-hint').props.children).toBe(
      'Tap the microphone on your keyboard and say the sentence. Your words appear in the box.',
    );
    expect(screen.getByTestId('exam-speak-input')).toBeTruthy();
  });

  it('repeat módban a felolvasandó célnyelvi mondatot mutatja; angol célnyelven a felirat angolt kér', () => {
    const repeat = renderCard({ mode: 'repeat', prompt: 'Yo como en casa.' });
    expect(repeat.getByTestId('exam-speak-mode').props.children).toBe('Read it aloud');
    repeat.unmount();

    const english = renderCard({ targetLang: 'en', prompt: 'Como en casa.', expected: 'I eat at home.' });
    expect(english.getByTestId('exam-speak-mode').props.children).toBe('Say it in English');
  });

  it('a Check addig szürke, amíg nincs diktált szöveg', () => {
    const screen = renderCard();
    expect(screen.getByTestId('exam-check').props.accessibilityState?.disabled ?? screen.getByTestId('exam-check').props.disabled).toBeTruthy();
    fireEvent.changeText(screen.getByTestId('exam-speak-input'), 'yo como');
    expect(screen.getByTestId('exam-check').props.accessibilityState?.disabled ?? screen.getByTestId('exam-check').props.disabled).toBeFalsy();
  });

  it('helyes diktálás (kis- és nagybetű, írásjel nélkül): kész, nincs visszajelzés', () => {
    const screen = renderCard();
    say(screen, 'yo como en casa');
    expect(screen.onDone).toHaveBeenCalledWith(true);
    expect(screen.queryByTestId('exam-next')).toBeNull();
    expect(screen.queryByText('Not quite!')).toBeNull();
  });

  it('hibás diktálás: az eltérő szavak mindkét oldalon ki vannak emelve, a Next lép tovább', () => {
    const screen = renderCard();
    say(screen, 'yo bebo en casa');
    expect(screen.onDone).not.toHaveBeenCalled();
    expect(screen.getByText('Not quite!')).toBeTruthy();
    expect(screen.getByText('You said')).toBeTruthy();
    expect(screen.getAllByTestId('exam-speak-extra').map((n) => n.props.children.join(''))).toEqual([' bebo']);
    expect(screen.getAllByTestId('exam-speak-missing').map((n) => n.props.children.join(''))).toEqual([' como']);

    fireEvent.press(screen.getByTestId('exam-next'));
    expect(screen.onDone).toHaveBeenCalledWith(false);
    expect(screen.onDone).toHaveBeenCalledTimes(1);
  });

  it('az ékezet a beállítást követi: KI mellett nem hiba, BE mellett eltérő szó', () => {
    const loose = renderCard({ expected: 'Ella está aquí', prompt: 'She is here.', strictAccents: false });
    say(loose, 'ella esta aqui');
    expect(loose.onDone).toHaveBeenCalledWith(true);
    loose.unmount();

    const strict = renderCard({ expected: 'Ella está aquí', prompt: 'She is here.', strictAccents: true });
    say(strict, 'ella esta aqui');
    expect(strict.onDone).not.toHaveBeenCalled();
    expect(strict.getAllByTestId('exam-speak-missing')).toHaveLength(2);
    expect(strict.getAllByTestId('exam-speak-extra')).toHaveLength(2);
  });

  it('spanyol célnyelven a névmás elhagyható, angolon nem érvényes a spanyol névmás-szabály', () => {
    const es = renderCard();
    say(es, 'como en casa');
    expect(es.onDone).toHaveBeenCalledWith(true);
    es.unmount();

    const en = renderCard({ targetLang: 'en', prompt: 'Como en casa.', expected: 'I eat at home.' });
    say(en, 'eat at home');
    expect(en.onDone).not.toHaveBeenCalled();
    expect(en.getAllByTestId('exam-speak-missing').map((n) => n.props.children.join(''))).toEqual(['I']);
  });

  it('"I don\'t know": a helyes mondat látszik, és csak a Next lép tovább', () => {
    const screen = renderCard();
    fireEvent.press(screen.getByTestId('exam-dont-know'));
    expect(screen.onDone).not.toHaveBeenCalled();
    expect(screen.getByTestId('exam-speak-correct')).toBeTruthy();
    expect(screen.getAllByTestId('exam-speak-missing')).toHaveLength(4);
    fireEvent.press(screen.getByTestId('exam-next'));
    expect(screen.onDone).toHaveBeenCalledWith(false);
  });
});
