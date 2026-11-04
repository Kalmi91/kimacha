import { Keyboard, Platform } from 'react-native';

import { dismissKeyboardOnTap } from '@/lib/keyboardTap';

describe('dismissKeyboardOnTap', () => {
  afterEach(() => jest.restoreAllMocks());

  it('closes the keyboard on a phone', () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    const dismiss = jest.spyOn(Keyboard, 'dismiss').mockImplementation(() => {});
    dismissKeyboardOnTap();
    expect(dismiss).toHaveBeenCalledTimes(1);
  });

  it('leaves the focus alone on web, a tap on the field itself must not close the keyboard it opened (FB562)', () => {
    jest.replaceProperty(Platform, 'OS', 'web');
    const dismiss = jest.spyOn(Keyboard, 'dismiss').mockImplementation(() => {});
    dismissKeyboardOnTap();
    expect(dismiss).not.toHaveBeenCalled();
  });
});
