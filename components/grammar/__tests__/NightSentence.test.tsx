import { render, screen, within } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { NightSentence } from '@/components/grammar/drill/NightBlank';
import type { GrammarColors } from '@/lib/grammarColors';

const g = { ink: '#F5F3FF', a: '#EC4899', b: '#22D3EE', onA: '#FFFFFF', bg: '#150A29', soft: { radius: 14 } } as unknown as GrammarColors;
const words = () => screen.getAllByText(/./).map((t) => t.props.children);

describe('NightSentence', () => {
  it('one Text per word, the blank is a sibling View, not inside a Text', () => {
    render(<NightSentence g={g} before="" after=" egy könyvet." answered={false} isCorrect={false} />);
    expect(words()).toEqual(['____', 'egy', 'könyvet.']);
    expect(screen.getByLabelText('____ egy könyvet.')).toBeTruthy();
  });

  it('punctuation right after the gap stays in the blank group', () => {
    render(<NightSentence g={g} before="Yo " after="." answered isCorrect text="como" />);
    expect(words()).toEqual(['Yo', 'como', '.']);
    const group = within(screen.getByTestId('drill-blank-group'));
    expect(group.getByText('.')).toBeTruthy();
    expect(group.queryByText('Yo')).toBeNull();
    expect(screen.getByTestId('drill-blank-gradient')).toBeTruthy();
  });

  it('wrong answer: white fill child, dark text', () => {
    render(<NightSentence g={g} before="Kati " after=" lakik." answered isCorrect={false} text="Szegedon" />);
    expect(StyleSheet.flatten(screen.getByTestId('drill-blank-wrong').props.style).backgroundColor).toBe('#F5F3FF');
    expect(StyleSheet.flatten(screen.getByText('Szegedon').props.style).color).toBe('#150A29');
    expect(screen.queryByTestId('drill-blank-gradient')).toBeNull();
  });
});
