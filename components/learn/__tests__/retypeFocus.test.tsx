// The retype field opens the keyboard by itself when it opens and again after Retype (useFocusOnNewCard, no bare autoFocus).
import { act, fireEvent, render } from '@testing-library/react-native';
import { Keyboard, TextInput } from 'react-native';
import Colors from '@/constants/Colors';
import { DEFAULT_SKIN_MIX, SKIN_IDS, SKINS } from '@/constants/Skins';
import { ThemeContext } from '@/lib/ThemeContext';
import { setLanguage } from '@/lib/i18n';
import { themeKeyFor } from '@/lib/skinTheme';
import RetypePractice from '../RetypePractice';

const noop = () => {};
const focusSpy = jest.spyOn(TextInput.prototype as unknown as { focus: () => void }, 'focus').mockImplementation(() => {});
jest.spyOn(Keyboard, 'isVisible').mockReturnValue(true); // the retry stops once the keyboard is up
beforeEach(() => { setLanguage('en'); jest.useFakeTimers(); focusSpy.mockClear(); });
afterEach(() => jest.useRealTimers());

it('focuses the field when it opens and again after Retype', () => {
  const skin = SKIN_IDS[0], mode = SKINS[skin].modes[0], theme = themeKeyFor(skin, mode, 'brand');
  const view = render(
    <ThemeContext.Provider value={{
      theme, skin, override: mode, grammarPalette: 'brand', skinMix: DEFAULT_SKIN_MIX,
      setOverride: noop, setSkin: noop, setGrammarPalette: noop, setSkinMix: noop,
    }}>
      <RetypePractice colors={Colors[theme]} answerText="vida" target="es" strictAccents={false} sentence={false} />
    </ThemeContext.Provider>,
  );
  act(() => { jest.advanceTimersByTime(200); });
  expect(focusSpy).not.toHaveBeenCalled();
  fireEvent.press(view.getByTestId('learn-retype'));
  act(() => { jest.advanceTimersByTime(200); });
  expect(focusSpy).toHaveBeenCalledTimes(1);
  fireEvent.changeText(view.getByTestId('learn-retype-input'), 'vidx');
  fireEvent(view.getByTestId('learn-retype-input'), 'submitEditing');
  expect(view.getByTestId('learn-retype-diff')).toBeTruthy();
  fireEvent.press(view.getByTestId('learn-retype-again'));
  act(() => { jest.advanceTimersByTime(200); });
  expect(focusSpy).toHaveBeenCalledTimes(2);
});
