// FB708: the end screens list EVERY mistaken item, with the task, the learner's answer and the right one.

import { render, screen } from '@testing-library/react-native';

import GrammarResult from '../grammar/GrammarResult';
import { missOfItem } from '@/lib/grammar/roundMiss';
import type { MatchItem } from '@/lib/grammar/lessonTypes';

jest.mock('@/lib/ThemeContext', () => ({
  useTheme: () => ({ theme: 'light' }),
}));

describe('end screen mistakes', () => {
  it('8 mistaken items: all 8 are listed with the given and the correct answer', () => {
    const misses = Array.from({ length: 8 }, (_, i) => ({ prompt: `task ${i}`, given: `wrong ${i}`, correct: `right ${i}` }));
    render(<GrammarResult correct={2} total={10} misses={misses} onRetake={jest.fn()} onBack={jest.fn()} />);
    expect(screen.getAllByTestId('grammar-mistake')).toHaveLength(8);
    expect(screen.getByText('wrong 7')).toBeTruthy();
    expect(screen.getByText('right 7')).toBeTruthy();
  });

  it('a mistaken match item is listed too (it used to be dropped)', () => {
    const item: MatchItem = { kind: 'match', id: 'm1', pairs: [{ es: 'pidió', en: 'he asked' }, { es: 'durmió', en: 'he slept' }] };
    expect(missOfItem(item, 'en')?.correct).toBe('pidió = he asked · durmió = he slept');
  });
});
