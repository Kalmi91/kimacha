import { useEffect, type RefObject } from 'react';
import type { TextInput } from 'react-native';

// The keyboard opens a moment after the fresh field mounted, on a new card and on one that came back
// (`cardKey` changes for both). With `autoFocus` Android asked for it while the field was still attaching,
// and Gboard sometimes opened with its letters never reaching the field, until the next card.
const FOCUS_DELAY_MS = 150;

export function useFocusOnNewCard(inputRef: RefObject<TextInput | null>, ready: boolean, cardKey: string): void {
  useEffect(() => {
    if (!ready) return;
    const timer = setTimeout(() => inputRef.current?.focus(), FOCUS_DELAY_MS);
    return () => clearTimeout(timer);
  }, [inputRef, ready, cardKey]);
}
