// FB719 / FB720: in Night the typed-task result is a paper card with a green (right) or red (wrong) border;
// every other skin keeps the filled box.

import { StyleSheet } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { FixDrillItem } from '../grammar/TypedKinds';
import type { FixItem } from '@/lib/grammar/lessonTypes';

jest.mock('@/lib/speech', () => require('@/test-utils/mocks').speechMock());

let mockTheme = 'night-dark';
jest.mock('@/lib/ThemeContext', () => ({
  useTheme: () => ({ theme: mockTheme }),
}));

const L = (en: string) => ({ en, es: en, hu: en, de: en });
const FIX: FixItem = { kind: 'fix', id: 'f1', es: 'Mi hermano es en Madrid.', wrongIndex: 2, answer: 'está', explain: L('place: estar'), tr: L('My brother is in Madrid.') };
const flat = (id: string) => StyleSheet.flatten(screen.getByTestId(id).props.style);

function answer(typed: string) {
  render(<FixDrillItem item={FIX} learnedLang="es" contentLang="en" strictAccents onDone={jest.fn()} />);
  fireEvent.press(screen.getByTestId('fix-word-2'));
  fireEvent.changeText(screen.getByTestId('fix-input'), typed);
  fireEvent.press(screen.getByTestId('fix-check'));
}

describe('Night result card on the typed tasks', () => {
  beforeEach(() => {
    mockTheme = 'night-dark';
  });

  it('right answer: green border card, check heading, fixed word in green', () => {
    answer('está');
    expect(flat('fix-correct')).toMatchObject({ borderColor: '#34D399', backgroundColor: '#1E293B' });
    expect(screen.getByText('✓ Correct')).toBeTruthy();
    expect(StyleSheet.flatten(screen.getByText('está').props.style).color).toBe('#34D399');
    expect(screen.getByTestId('fix-explain')).toBeTruthy();
  });

  it('wrong answer: red border card, cross heading, typed word struck through', () => {
    answer('estan');
    expect(flat('fix-wrong')).toMatchObject({ borderColor: '#F87171', backgroundColor: '#1E293B' });
    expect(screen.getByText(/✕ Not quite/)).toBeTruthy();
    expect(flat('answer-compare-typed')).toMatchObject({ color: '#F87171', textDecorationLine: 'line-through' });
    expect(screen.getByTestId('grammar-mistyped')).toBeTruthy();
    expect(screen.getByTestId('grammar-next')).toBeTruthy();
  });

  it('a non-Night skin still renders the old filled box', () => {
    mockTheme = 'brand-light';
    answer('está');
    expect(flat('fix-correct').borderColor).not.toBe('#34D399');
    expect(flat('fix-correct').backgroundColor).not.toBe('#1E293B');
    expect(screen.queryByText('✓ Correct')).toBeNull();
  });
});
