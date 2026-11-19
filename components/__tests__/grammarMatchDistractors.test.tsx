// match drill: one unmatched extra element per side + the hint line above the task.
import { fireEvent, render, screen } from '@testing-library/react-native';

import GrammarDrill from '../grammar/GrammarDrill';
import { getGrammarTopic } from '@/lib/games/content';
import { pickMatchDistractors } from '@/lib/grammar/matchDistractors';
import type { LessonV2, MatchItem } from '@/lib/grammar/lessonTypes';

jest.mock('@/lib/ThemeContext', () => ({
  useTheme: () => ({ theme: 'light' }),
}));

const lesson = getGrammarTopic('es', 'pronombres-oi')!;
const item = lesson.items.find((i) => i.id === 'oi-match-01') as MatchItem;

describe('match drill extras', () => {
  it('oi-match-01 shows 7+7 elements, the hint, and is done after the 6 real pairs', () => {
    const topic: LessonV2 = { ...lesson, items: [item] };
    const onFinish = jest.fn();
    render(<GrammarDrill topic={topic} learnedLang="es" contentLang="es" onFinish={onFinish} kinds={['choice', 'match', 'form']} />);

    expect(screen.queryByTestId('match-extra-hint')).toBeTruthy();
    for (let i = 0; i < 7; i++) {
      expect(screen.queryByTestId(`match-left-${i}`)).toBeTruthy();
      expect(screen.queryByTestId(`match-right-${i}`)).toBeTruthy();
    }
    expect(screen.queryByTestId('match-left-7')).toBeNull();

    // the extra left (index 6) never pairs, whichever right is tapped
    fireEvent.press(screen.getByTestId('match-left-6'));
    for (let i = 0; i < 7; i++) fireEvent.press(screen.getByTestId(`match-right-${i}`));
    expect(screen.queryByTestId('grammar-next')).toBeNull();

    // the 6 real pairs: right cell text of the pair (learnedLang es -> right = es)
    const rights = item.pairs.map((p) => p.es);
    item.pairs.forEach((p, li) => {
      fireEvent.press(screen.getByTestId(`match-left-${li}`));
      fireEvent.press(screen.getByText(rights[li]));
    });
    expect(screen.queryByTestId('grammar-next')).toBeTruthy();
  });

  it('extras are deterministic, differ from real texts, and are absent without a source', () => {
    const l = (p: MatchItem['pairs'][number]) => p.en;
    const r = (p: MatchItem['pairs'][number]) => p.es;
    const a = pickMatchDistractors(item, lesson, 'es', l, r)!;
    const b = pickMatchDistractors(item, lesson, 'es', l, r)!;
    expect(a).toEqual(b);
    expect(item.pairs.map((p) => p.en.toLowerCase())).not.toContain(a.left.toLowerCase());
    expect(item.pairs.map((p) => p.es.toLowerCase())).not.toContain(a.right.toLowerCase());
    expect(pickMatchDistractors(item, undefined, 'es', l, r)).toBeNull();
  });
});
