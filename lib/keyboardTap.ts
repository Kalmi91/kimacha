import { Keyboard, Platform } from 'react-native';

// What a tap beside a text field does: it closes the keyboard. On web the browser already does that when the focus leaves
// the field, and a tap ON the field bubbles up to the same Pressable, so dismissing there closed the keyboard that very
// tap had just opened (FB562).
export function dismissKeyboardOnTap(): void {
  if (Platform.OS !== 'web') Keyboard.dismiss();
}

// What a drag on a scroller does to the keyboard: `keyboardDismissMode={keyboardDismissOnDrag()}`, never the literal
// (keyboardTap.test.ts fails on it). On a phone app 'on-drag' waits for a real drag. react-native-web blurs the focused field
// on EVERY scroll event of that scroller, and opening the keyboard is one: the layout shrinks with it (app/+html.tsx), the
// card overflows, and the browser scrolls the field into view. So the keyboard closed a moment after it opened.
export function keyboardDismissOnDrag(): 'none' | 'on-drag' {
  return Platform.OS === 'web' ? 'none' : 'on-drag';
}
