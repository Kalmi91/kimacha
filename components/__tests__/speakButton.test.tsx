// the shared 🔊 / ⏹ button: on the brutalist palette a box matching the games' icon buttons
// (ink border, BrutalBox), on the classic palette today's plain button.
// Mock pattern: feedbackBrutal.test.tsx.

jest.mock('@/lib/database', () => jest.requireActual('@/lib/database.web'));

import { StyleSheet } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';

import { getDb } from '@/lib/database';
import { ThemeProvider } from '@/lib/ThemeContext';
import SpeakButton from '../SpeakButton';

jest.setTimeout(30000);

const flush = async (times = 6) => {
  for (let i = 0; i < times; i++) {
    await act(async () => {
      await Promise.resolve();
    });
  }
};

describe('SpeakButton', () => {
  it('with the brand palette a box (2.5 px ink border), tapping calls, ⏹ while speaking', async () => {
    await getDb().setGrammarPalette('brand');
    const onPress = jest.fn();
    const view = render(
      <ThemeProvider>
        <SpeakButton testID="sp" onPress={onPress} />
      </ThemeProvider>
    );
    await flush();
    const style = StyleSheet.flatten(view.getByTestId('sp').props.style);
    expect(style.borderWidth).toBe(2.5);
    expect(view.getByText('🔊')).toBeTruthy();
    fireEvent.press(view.getByTestId('sp'));
    expect(onPress).toHaveBeenCalledTimes(1);
    view.rerender(
      <ThemeProvider>
        <SpeakButton testID="sp" onPress={onPress} speaking />
      </ThemeProvider>
    );
    expect(view.getByText('⏹')).toBeTruthy();
    view.unmount();
  });

  it('with the classic palette no box, the label stays next to the icon', async () => {
    await getDb().setGrammarPalette('classic');
    const onPress = jest.fn();
    const view = render(
      <ThemeProvider>
        <SpeakButton testID="sp" onPress={onPress} label="Read aloud" />
      </ThemeProvider>
    );
    await flush();
    const style = StyleSheet.flatten(view.getByTestId('sp').props.style);
    expect(style?.borderWidth).toBeUndefined();
    expect(view.getByText('Read aloud')).toBeTruthy();
    fireEvent.press(view.getByTestId('sp'));
    expect(onPress).toHaveBeenCalledTimes(1);
    view.unmount();
  });
});
