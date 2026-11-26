import { useEffect, type RefObject } from 'react';
import { Keyboard, Platform, type TextInput } from 'react-native';

// The keyboard opens a moment after the fresh field mounted, on a new card and on one that came back
// (`cardKey` changes for both). With `autoFocus` Android asked for it while the field was still attaching,
// and Gboard sometimes opened with its letters never reaching the field, until the next card.
// On a cold start the first focus can be lost (window / IME not ready yet), so it is tried again, at most
// FOCUS_TRIES_MS.length times within 2.5 s, and only while the keyboard is not up. A field that counts as focused but has
// no keyboard is left alone until the last try: its show can still be on its way (up to 2.6 s on the emulator), and a
// blur in the middle of it closed the keyboard right after it opened (11-25). Only the last try takes the show as lost
// and blurs and focuses again. Not on the web: there Keyboard.isVisible() is always false, so the last try blurred
// a field whose phone keyboard was already open and closed it (web keyboard smoke, 4.2.16).
const FOCUS_TRIES_MS = [150, 450, 2500];

export function useFocusOnNewCard(inputRef: RefObject<TextInput | null>, ready: boolean, cardKey: string): void {
  useEffect(() => {
    if (!ready) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const attempt = (n: number) => {
      const input = inputRef.current;
      if (n > 0 && Keyboard.isVisible()) return;
      const focused = n > 0 && !!input?.isFocused?.();
      const last = n === FOCUS_TRIES_MS.length - 1;
      const reask = last && Platform.OS !== 'web';
      if (focused && reask) input?.blur(); // still no keyboard long after: the show request was lost, ask again
      if (!focused || reask) input?.focus();
      if (!last) timer = setTimeout(() => attempt(n + 1), FOCUS_TRIES_MS[n + 1] - FOCUS_TRIES_MS[n]);
    };
    timer = setTimeout(() => attempt(0), FOCUS_TRIES_MS[0]);
    return () => clearTimeout(timer);
  }, [inputRef, ready, cardKey]);
}
