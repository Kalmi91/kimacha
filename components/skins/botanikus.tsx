import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '@/components/KText';

import type { SkinDecor } from '@/components/skins/types';

// Botanikus: levél-ikon a fejlécben, növény-ikon a kártya jobb alsó sarkában.

function BotanikusHeader({ children }: { children: ReactNode }) {
  return (
    <View>
      <View testID="decor-botanikus-leaf" pointerEvents="none" style={styles.leafRow}>
        <Text style={styles.leaf}>🌿</Text>
      </View>
      {children}
    </View>
  );
}

function BotanikusCardFrame({ children }: { children: ReactNode }) {
  return (
    <View testID="skin-botanikus-frame">
      {children}
      <View testID="decor-botanikus-plant" pointerEvents="none" style={styles.plant}>
        <Text style={styles.plantIcon}>🌱</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  leafRow: { alignItems: 'center', marginBottom: 2 },
  leaf: { fontSize: 20 },
  plant: { position: 'absolute', right: 8, bottom: 6 },
  plantIcon: { fontSize: 18 },
});

export const botanikusDecor: SkinDecor = {
  HeaderOrnament: BotanikusHeader,
  CardFrame: BotanikusCardFrame,
};
