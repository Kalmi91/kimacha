import { fireEvent, render } from '@testing-library/react-native';
import { StyleSheet, View } from 'react-native';
import { BrutalBox } from '@/components/grammar/Brutal';
import Colors from '@/constants/Colors';
import { DEFAULT_SKIN_MIX, SKINS, SKIN_IDS } from '@/constants/Skins';
import { ThemeContext } from '@/lib/ThemeContext';
import { setLanguage } from '@/lib/i18n';
import { themeKeyFor } from '@/lib/skinTheme';
import RetypePractice from '../RetypePractice';

const noop = () => {};
const themes = SKIN_IDS.flatMap(skin => SKINS[skin].modes.map(mode => ({ skin, mode })));

beforeEach(() => setLanguage('en'));

it.each(themes)('aligns the pop art Check face with its field without changing $skin/$mode', ({ skin, mode }) => {
  const theme = themeKeyFor(skin, mode, 'brand');
  const view = render(
    <ThemeContext.Provider value={{
      theme, skin, override: mode, grammarPalette: 'brand', skinMix: DEFAULT_SKIN_MIX,
      setOverride: noop, setSkin: noop, setGrammarPalette: noop, setSkinMix: noop,
    }}>
      <RetypePractice colors={Colors[theme]} answerText="vida" target="es" strictAccents={false} sentence={false} />
    </ThemeContext.Provider>,
  );
  fireEvent.press(view.getByTestId('learn-retype'));

  const check = view.getByTestId('learn-retype-check');
  const face = StyleSheet.flatten(check.props.style);
  expect(face.flex).toBe(skin === 'popart' ? 1 : undefined);
  if (skin === 'popart') {
    const row = view.UNSAFE_getAllByType(View).find(node => StyleSheet.flatten(node.props.style)?.flexDirection === 'row');
    expect(StyleSheet.flatten(row!.props.style)).toMatchObject({ alignItems: 'stretch' });
    expect(StyleSheet.flatten(view.UNSAFE_getByType(BrutalBox).props.style)).toMatchObject({ minHeight: 58, marginTop: 0 });
    expect(StyleSheet.flatten(view.getByTestId('learn-retype-input').props.style)).toMatchObject({ flex: 1 });
    expect(face.transform).toBeUndefined();
    expect(face.marginTop).toBeUndefined();
  }

  fireEvent.changeText(view.getByTestId('learn-retype-input'), 'vida');
  fireEvent.press(check);
  expect(view.getByTestId('learn-retype-result').props.children).toBe('Correct');
});
