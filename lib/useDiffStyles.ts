import type { TextStyle } from 'react-native';

import { ON_FILL } from '@/constants/GrammarPalettes';
import { legibleOn, textContrastMin } from '@/constants/Skins';
import { useSkin } from '@/lib/useSkin';

// a charDiff-sor jelölései (rossz betű = piros, kihagyott betű = borostyán kitöltés),
// olvasható szöveggel minden témán (a borostyán + aláhúzás a kihagyott betű, a pirosaktól
// elkülönítve). A kihagyott betű szövege sötét (a fehér a borostyánon 1,9:1
// volt). A rossz betűé fehér marad, ha az átmegy (Neo-brutál / Klasszikus rendszer-betűn a 20 px
// félkövér nagy szöveg, 3,76:1); egyedi betűnél, ahol a KText elhagyja a félkövért, 4,5 kell, ott
// a szöveg sötétedik (legibleOn).
export function useDiffStyles(): { wrong: TextStyle; missing: TextStyle } {
  const { skin } = useSkin();
  return {
    wrong: { backgroundColor: '#EF4444', color: legibleOn('#FFFFFF', '#EF4444', textContrastMin(skin, 'body', 20, true)) },
    missing: { backgroundColor: '#EAB308', color: ON_FILL, textDecorationLine: 'underline' },
  };
}
