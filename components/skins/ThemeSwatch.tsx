import { StyleSheet, Text, View } from 'react-native';

import { skinColorsFor, type Skin, type SkinMode } from '@/constants/Skins';

// a theme's swatch (the tile of the Themes grid and the badge of the Settings row): the theme's
// background, "Aa" in the title font, a 5 px bar in the a colour at the bottom. It draws the theme's own colours, not those of the
// active theme, so it sets the font directly (fontFamily) instead of through the active theme's font.
export default function ThemeSwatch({
  skin,
  mode,
  small = false,
  testID,
}: {
  skin: Skin;
  mode: SkinMode;
  small?: boolean;
  testID?: string;
}) {
  const c = skinColorsFor(skin, mode);
  const font = skin.fonts.title;
  return (
    <View
      testID={testID}
      style={[small ? styles.small : styles.tile, { backgroundColor: c.bg, borderColor: c.ink }]}
    >
      <Text
        style={[
          { color: c.ink, fontSize: small ? 15 : 24 },
          font ? { fontFamily: font } : { fontWeight: '700' },
        ]}
      >
        Aa
      </Text>
      <View style={[styles.bar, { backgroundColor: c.a }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  tile: { width: '100%', aspectRatio: 1, borderWidth: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  small: { width: 36, height: 36, borderWidth: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  bar: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 5 },
});
