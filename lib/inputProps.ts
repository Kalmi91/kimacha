// Shared TextInput props for every ANSWER field (typing card, practice field,
// spelling drill, exam typing).
//
// FB145, Kálmán 2026-08-18: "azt meg tudod csinálni, hogy az applikációval
// kikapcsoltatod a telefonom auto complitjét? hogy itt felajánlja a szavakat ez
// zavaró". The fields already carried `autoCorrect={false}`, which only turns
// off the correction, not the suggestion strip or the autofill popup, so Gboard
// kept offering the very word the card is asking for. The rest of the flags do
// that: no suggestions, no autofill, no spell-check underline.
//
// `keyboardType: 'visible-password'` would kill the strip on every Android
// keyboard, but it also swaps the layout (no accents, no emoji row), which the
// Spanish answers need, so it stays out.

import type { TextInputProps } from 'react-native';

export const answerInputProps = {
  autoCapitalize: 'none',
  autoCorrect: false,
  autoComplete: 'off',
  spellCheck: false,
  importantForAutofill: 'no',
  textContentType: 'none',
} satisfies TextInputProps;
