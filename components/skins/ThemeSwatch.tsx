import { StyleSheet, Text, View } from 'react-native';

import { skinColorsFor, type Skin, type SkinMode } from '@/constants/Skins';

// PLAN-temak 4D: egy téma mintája (a Témák rács csempéje és a Beállítások sor jelvénye): a téma
// háttere, "Aa" a title-betűvel, alul 5 px-es a-színű sáv. A téma saját színeit rajzolja, nem az
// aktív témáét, ezért a betűt közvetlenül (fontFamily) állítja, nem az aktív téma betűjén át.
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
