// the shared 🔊 / ⏹ button: on the brutalist palette a box matching the games' icon buttons
// (ink border, BrutalBox), on the classic palette today's plain button.
// Mock pattern: feedbackBrutal.test.tsx.


import { Animated, StyleSheet } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';

import { getDb } from '@/lib/database';
import { useGrammarColors } from '@/lib/grammarColors';
import { ThemeProvider } from '@/lib/ThemeContext';
import SpeakButton from '../SpeakButton';
import { makeFlush } from '@/test-utils/flush';

jest.setTimeout(30000);

const flush = makeFlush(6);

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

  it.each(['brand', 'classic'] as const)('a tap flashes the theme main colour over the button and fades it out (%s)', async (palette) => {
    await getDb().setGrammarPalette(palette);
    let main = '';
    function Probe() {
      main = useGrammarColors().a;
      return null;
    }
    const timing = jest.spyOn(Animated, 'timing');
    const view = render(
      <ThemeProvider>
        <Probe />
        <SpeakButton testID="sp" onPress={() => {}} />
      </ThemeProvider>
    );
    await flush();
    const layer = view.getByTestId('sp-flash');
    expect(StyleSheet.flatten(layer.props.style).backgroundColor).toBe(main);
    expect(layer.props.pointerEvents).toBe('none');
    expect(timing).not.toHaveBeenCalled();
    fireEvent.press(view.getByTestId('sp'));
    expect(timing).toHaveBeenCalledTimes(1);
    expect(timing.mock.calls[0][1]).toMatchObject({ toValue: 0 });
    timing.mockRestore();
    view.unmount();
  });
});
