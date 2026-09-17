// TASK-9 (PLAN-fb0917 12. lépés, C): FB299 (sheet, 2026-09-17,
// grammar:presente-irregular:drill) "itt megint bugos, nem jön be a
// következő szó". Végigjátssza a valódi presente-irregular leckét mind a 4
// fajtával (kinds egyesével, ahogy a 10. lépés óta a lecke-oldal fajtánként
// indítja), minden itemen megnyomva a "következő"-t; ha bárhol nem jelenik
// meg vagy nem lép tovább, a teszt elakad/pirosra fut. Ha ez a teszt zöld,
// a hiba nem reprodukálható a lecke-adatból és a GrammarDrill logikájából
// (lásd a jelentést).
import { fireEvent, render, screen } from '@testing-library/react-native';

import GrammarDrill from '../grammar/GrammarDrill';
import lessonJson from '@/data/games/grammar/es/presente-irregular.json';
import type { LessonV2, MatchItem } from '@/lib/grammar/lessonTypes';

jest.mock('@/lib/ThemeContext', () => ({
  useTheme: () => ({ theme: 'light' }),
}));

const lesson = lessonJson as unknown as LessonV2;

describe('GrammarDrill: presente-irregular full playthrough (FB299)', () => {
  it('choice kind (12 item): "következő" advances every item to onFinish', () => {
    const onFinish = jest.fn();
    const total = lesson.items.filter((i) => i.kind === undefined).length;
    expect(total).toBeGreaterThanOrEqual(10);
    render(<GrammarDrill topic={lesson} learnedLang="es" contentLang="hu" onFinish={onFinish} kinds={['choice']} />);

    for (let i = 0; i < total; i++) {
      const options = screen.getAllByTestId('grammar-option');
      fireEvent.press(options[0]);
      fireEvent.press(screen.getByTestId('grammar-next'));
    }
    expect(onFinish).toHaveBeenCalledTimes(1);
    expect(onFinish).toHaveBeenCalledWith(expect.any(Number), total);
  });

  it('match kind (1 item): solving every pair reveals "következő" and it advances', () => {
    const onFinish = jest.fn();
    const matchItem = lesson.items.find((i): i is MatchItem => i.kind === 'match')!;
    render(<GrammarDrill topic={lesson} learnedLang="es" contentLang="hu" onFinish={onFinish} kinds={['match']} />);

    matchItem.pairs.forEach((pair, li) => {
      fireEvent.press(screen.getByTestId(`match-left-${li}`));
      fireEvent.press(screen.getByText(pair.es));
    });
    fireEvent.press(screen.getByTestId('grammar-next'));
    expect(onFinish).toHaveBeenCalledWith(expect.any(Number), 1);
  });

  it('form kind (12 item): "következő" advances every item to onFinish', () => {
    const onFinish = jest.fn();
    const total = lesson.items.filter((i) => i.kind === 'form').length;
    expect(total).toBeGreaterThanOrEqual(10);
    render(<GrammarDrill topic={lesson} learnedLang="es" contentLang="hu" onFinish={onFinish} kinds={['form']} />);

    for (let i = 0; i < total; i++) {
      fireEvent.changeText(screen.getByTestId('formInput'), 'x');
      fireEvent.press(screen.getByTestId('formCheck'));
      fireEvent.press(screen.getByTestId('grammar-next'));
    }
    expect(onFinish).toHaveBeenCalledTimes(1);
    expect(onFinish).toHaveBeenCalledWith(expect.any(Number), total);
  });

  it('why kind (7 item): "következő" advances every item to onFinish', () => {
    const onFinish = jest.fn();
    const total = lesson.items.filter((i) => i.kind === 'why').length;
    expect(total).toBeGreaterThanOrEqual(6);
    render(<GrammarDrill topic={lesson} learnedLang="es" contentLang="hu" onFinish={onFinish} kinds={['why']} />);

    for (let i = 0; i < total; i++) {
      const options = screen.getAllByTestId('grammar-option');
      fireEvent.press(options[0]);
      fireEvent.press(screen.getByTestId('grammar-next'));
    }
    expect(onFinish).toHaveBeenCalledTimes(1);
    expect(onFinish).toHaveBeenCalledWith(expect.any(Number), total);
  });
});
