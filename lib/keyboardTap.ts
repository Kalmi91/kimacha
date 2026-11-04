import { Keyboard, Platform } from 'react-native';

// What a tap beside a text field does: it closes the keyboard. On web the browser already does that when the focus leaves
// the field, and a tap ON the field bubbles up to the same Pressable, so dismissing there closed the keyboard that very
// tap had just opened (FB562).
export function dismissKeyboardOnTap(): void {
  if (Platform.OS !== 'web') Keyboard.dismiss();
}
