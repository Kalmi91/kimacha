import { useEffect, type RefObject } from 'react';
import { Keyboard, type TextInput } from 'react-native';

// The keyboard opens a moment after the fresh field mounted, on a new card and on one that came back
// (`cardKey` changes for both). With `autoFocus` Android asked for it while the field was still attaching,
// and Gboard sometimes opened with its letters never reaching the field, until the next card.
// On a cold start the first focus can be lost (window / IME not ready yet), so it is tried again, at most
// FOCUS_TRIES_MS.length times within about a second, and only while the keyboard is not up (a field that counts as focused but has no keyboard is blurred and focused again).
const FOCUS_TRIES_MS = [150, 450, 1000];

export function useFocusOnNewCard(inputRef: RefObject<TextInput | null>, ready: boolean, cardKey: string): void {
  useEffect(() => {
    if (!ready) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const attempt = (n: number) => {
      const input = inputRef.current;
      if (n > 0 && Keyboard.isVisible()) return;
      if (n > 0 && input?.isFocused?.()) input.blur(); // focused but no keyboard: the show request was lost, ask again
      input?.focus();
      if (n + 1 < FOCUS_TRIES_MS.length) timer = setTimeout(() => attempt(n + 1), FOCUS_TRIES_MS[n + 1] - FOCUS_TRIES_MS[n]);
    };
    timer = setTimeout(() => attempt(0), FOCUS_TRIES_MS[0]);
    return () => clearTimeout(timer);
  }, [inputRef, ready, cardKey]);
}
