import { createContext, forwardRef, useContext, type ComponentRef } from 'react';
import { StyleSheet, Text as RNText, type TextProps, type TextStyle } from 'react-native';

import { useSkin } from '@/lib/useSkin';

// a Text-wrapper, ami az aktív téma betűjét alkalmazza. `variant`: 'title' =
// app-cím / fejléc, 'word' = a szó a kártyán, 'body' (alap) = minden más szöveg. A téma betűje
// (skin.fonts), betűmérete (fontScale, fontSizeOffset, displayScale), betűköze, sormagassága és
// kis-/nagybetűs formája innen jön; ha a téma semmit nem ad (Neo-brutál body, Klasszikus), a
// stílus érintetlenül megy tovább (a mai viselkedés).
export type KTextVariant = 'title' | 'word' | 'body';

export type KTextProps = TextProps & { variant?: KTextVariant };

// Beágyazott KText (egy szövegben egy másik): a betű, a betűköz, a sormagasság és a kis-/nagybetű
// a külső szövegtől öröklődik (RN), ezért a belső ezeket nem állítja. A kontextus a külső szöveg
// tényleges betűje (null = rendszer-font), hogy a belső is elhagyja a fontWeight-et, ha kell.
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
  // Egyedi betűnél a fontWeight elmarad: Androidon különben rendszer-fontra esne vissza.
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
