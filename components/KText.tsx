import { createContext, forwardRef, useContext, type ComponentRef } from 'react';
import { StyleSheet, Text as RNText, type TextProps, type TextStyle } from 'react-native';

import { useSkin } from '@/lib/useSkin';

// The Text wrapper that applies the active theme's font. `variant`: 'title' =
// app title / header, 'word' = the word on the card, 'body' (default) = all other text. The theme's font
// (skin.fonts), font size (fontScale, fontSizeOffset, displayScale), letter spacing, line height and
// casing come from here; if the theme gives nothing (Neo-brutal body, Classic), the
// style passes through untouched (today's behaviour).
export type KTextVariant = 'title' | 'word' | 'body';

export type KTextProps = TextProps & { variant?: KTextVariant };

// Nested KText (one inside another in a text): the font, letter spacing, line height and casing
// are inherited from the outer text (RN), so the inner one does not set them. The context is the outer text's
// actual font (null = system font), so the inner one also omits fontWeight when needed.
const ParentFont = createContext<string | null | undefined>(undefined);

const DEFAULT_SIZE = 14;

const KText = forwardRef<ComponentRef<typeof RNText>, KTextProps>(function KText(
  { variant = 'body', style, children, ...rest },
  ref,
) {
  const { skin } = useSkin();
  const inherited = useContext(ParentFont);
  const nested = inherited !== undefined;
  const flat = StyleSheet.flatten(style) as TextStyle | undefined;
  const display = variant !== 'body';
  const themeFont = skin.fonts[variant];
  const family = flat?.fontFamily ?? (nested ? inherited : themeFont);

  const next: TextStyle = { ...flat };
  let changed = false;

  if (!nested && !flat?.fontFamily && themeFont) {
    next.fontFamily = themeFont;
    changed = true;
  }
  // With a custom font fontWeight is left out: on Android it would otherwise fall back to the system font.
  if (family && next.fontWeight !== undefined) {
    delete next.fontWeight;
    changed = true;
  }

  const mult = skin.fontScale * (display ? skin.displayScale ?? 1 : 1);
  const offset = skin.fontSizeOffset ?? 0;
  const base = flat?.fontSize ?? (nested ? undefined : DEFAULT_SIZE);
  if ((mult !== 1 || offset !== 0) && base !== undefined) {
    next.fontSize = base * mult + offset;
    if (flat?.lineHeight) next.lineHeight = (flat.lineHeight * next.fontSize) / base;
    changed = true;
  }

  if (!nested) {
    const spacing = display || skin.spacingScope === 'all' ? skin.letterSpacing : 0;
    if (spacing !== 0 && flat?.letterSpacing === undefined) {
      next.letterSpacing = spacing;
      changed = true;
    }
    if (skin.lineHeight && flat?.lineHeight === undefined) {
      next.lineHeight = (next.fontSize ?? DEFAULT_SIZE) * skin.lineHeight;
      changed = true;
    }
    if (variant === 'word' && skin.wordRotate && flat?.transform === undefined) {
      next.transform = [{ rotate: `${skin.wordRotate}deg` }];
      changed = true;
    }
    if (flat?.textTransform === undefined) {
      if ((variant === 'title' && skin.uppercaseTitle) || (variant === 'word' && skin.uppercaseWord)) {
        next.textTransform = 'uppercase';
        changed = true;
      } else if (variant === 'title' && skin.lowercaseTitle) {
        next.textTransform = 'lowercase';
        changed = true;
      }
    }
  }

  return (
    <ParentFont.Provider value={family ?? null}>
      <RNText ref={ref} {...rest} style={changed ? next : style}>
        {children}
      </RNText>
    </ParentFont.Provider>
  );
});

export default KText;
export { KText, KText as Text };
