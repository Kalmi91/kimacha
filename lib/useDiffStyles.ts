import type { TextStyle } from 'react-native';

import { ON_FILL } from '@/constants/GrammarPalettes';
import { legibleOn, textContrastMin } from '@/constants/Skins';
import { useSkin } from '@/lib/useSkin';

// Markings of the charDiff row (wrong letter = red, missed letter = amber fill),
// with readable text on every theme (amber + underline marks the missed letter, set apart
// from the reds). The text of the missed letter is dark (white on amber was 1.9:1).
// The wrong letter's text stays white if that passes (on Neo-brutalist / Classic with the system font the 20 px
// bold large text, 3.76:1); for a custom font, where KText drops the bold, 4.5 is needed, and there
// the text darkens (legibleOn).
export function useDiffStyles(): { wrong: TextStyle; missing: TextStyle } {
  const { skin } = useSkin();
  return {
    wrong: { backgroundColor: '#EF4444', color: legibleOn('#FFFFFF', '#EF4444', textContrastMin(skin, 'body', 20, true)) },
    missing: { backgroundColor: '#EAB308', color: ON_FILL, textDecorationLine: 'underline' },
  };
}
