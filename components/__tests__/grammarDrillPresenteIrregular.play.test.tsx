// Bug report (2026-09-17, grammar:presente-irregular:drill): "buggy again, the next word
// doesn't come up". Plays through the real presente-irregular lesson with all 4 kinds (one kind
// at a time, the way the lesson page starts them), pressing "next" on every item; if it does not
// appear or does not advance anywhere, the test hangs or fails. If this test is green, the bug
// cannot be reproduced from the lesson data and the GrammarDrill logic.
import { fireEvent, render, screen } from '@testing-library/react-native';

import GrammarDrill from '../grammar/GrammarDrill';
import lessonJson from '@/data/games/grammar/es/presente-irregular.json';
import type { LessonV2, MatchItem } from '@/lib/grammar/lessonTypes';

jest.mock('@/lib/ThemeContext', () => ({
  useTheme: () => ({ theme: 'light' }),
}));

const lesson = lessonJson as unknown as LessonV2;

describe('GrammarDrill: presente-irregular full playthrough', () => {
  it('choice kind (12 item): "next" advances every item to onFinish', () => {
    const onFinish = jest.fn();
    const total = lesson.items.filter((i) => i.kind === undefined).length;
    expect(total).toBeGreaterThanOrEqual(10);
    render(<GrammarDrill topic={lesson} learnedLang="es" contentLang="en" onFinish={onFinish} kinds={['choice']} />);

    for (let i = 0; i < total; i++) {
      const options = screen.getAllByTestId('grammar-option');
      fireEvent.press(options[0]);
      fireEvent.press(screen.getByTestId('grammar-next'));
    }
    expect(onFinish).toHaveBeenCalledTimes(1);
    expect(onFinish).toHaveBeenCalledWith(expect.any(Number), total);
  });

  it('match kind (2 items): solving every pair reveals "next" and it advances', () => {
    const onFinish = jest.fn();
    const matchItems = lesson.items.filter((i): i is MatchItem => i.kind === 'match');
    expect(matchItems).toHaveLength(2); // the second matching item, with the new verbs
    render(<GrammarDrill topic={lesson} learnedLang="es" contentLang="en" onFinish={onFinish} kinds={['match']} />);

    for (const matchItem of matchItems) {
      matchItem.pairs.forEach((pair, li) => {
        fireEvent.press(screen.getByTestId(`match-left-${li}`));
        fireEvent.press(screen.getByText(pair.es));
      });
      fireEvent.press(screen.getByTestId('grammar-next'));
    }
    // the unit of a round is the pair: 2 x 6 pairs, 12/12 with no mistakes.
    expect(onFinish).toHaveBeenCalledWith(12, 12);
  });

  it('form kind (12 item): "next" advances every item to onFinish', () => {
    const onFinish = jest.fn();
    const total = lesson.items.filter((i) => i.kind === 'form').length;
    expect(total).toBeGreaterThanOrEqual(10);
    render(<GrammarDrill topic={lesson} learnedLang="es" contentLang="en" onFinish={onFinish} kinds={['form']} />);

    for (let i = 0; i < total; i++) {
      fireEvent.changeText(screen.getByTestId('formInput'), 'x');
      fireEvent.press(screen.getByTestId('formCheck'));
      fireEvent.press(screen.getByTestId('grammar-next'));
    }
    expect(onFinish).toHaveBeenCalledTimes(1);
    expect(onFinish).toHaveBeenCalledWith(expect.any(Number), total);
  });

  it('why kind (7 item): "next" advances every item to onFinish', () => {
    const onFinish = jest.fn();
    const total = lesson.items.filter((i) => i.kind === 'why').length;
    expect(total).toBeGreaterThanOrEqual(6);
    render(<GrammarDrill topic={lesson} learnedLang="es" contentLang="en" onFinish={onFinish} kinds={['why']} />);

    for (let i = 0; i < total; i++) {
      const options = screen.getAllByTestId('grammar-option');
      fireEvent.press(options[0]);
      fireEvent.press(screen.getByTestId('grammar-next'));
    }
    expect(onFinish).toHaveBeenCalledTimes(1);
    expect(onFinish).toHaveBeenCalledWith(expect.any(Number), total);
  });
});
