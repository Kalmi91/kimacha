import type { TextStyle } from 'react-native';

import type { Skin } from '@/constants/Skins';

// egy téma szöveg-stílusa a Saját mix élő előnézetéhez (betű, méret, kis-/nagybetű,
// betűköz). Az előnézet a piszkozat-témát rajzolja, az alkalmazás szövegei pedig az aktív témáét
// kapják, ezért ez a stílus közvetlenül a megadott Skinből számol.
export function previewTextStyle(skin: Skin, role: 'title' | 'word' | 'body', base: number): TextStyle {
  const font = skin.fonts[role];
  let size = base * skin.fontScale + (skin.fontSizeOffset ?? 0);
  if (role !== 'body' && skin.displayScale) size *= skin.displayScale;
  const style: TextStyle = { fontSize: Math.round(size) };
  if (font) style.fontFamily = font;
  else style.fontWeight = role === 'body' ? '600' : '700';
  if (role === 'title' && skin.uppercaseTitle) style.textTransform = 'uppercase';
  if (role === 'title' && skin.lowercaseTitle) style.textTransform = 'lowercase';
  if (role === 'word' && skin.uppercaseWord) style.textTransform = 'uppercase';
  if (role === 'word' && skin.wordRotate) style.transform = [{ rotate: `${skin.wordRotate}deg` }];
  if (role !== 'body' || skin.spacingScope === 'all') style.letterSpacing = skin.letterSpacing;
  return style;
}
