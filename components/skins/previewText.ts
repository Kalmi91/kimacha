import type { TextStyle } from 'react-native';

import type { Skin } from '@/constants/Skins';

// a theme's text style for the live preview of My mix (font, size, upper-/lowercase,
// letter spacing). The preview draws the draft theme while the app's texts get the active theme's,
// so this style is computed directly from the Skin passed in.
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
