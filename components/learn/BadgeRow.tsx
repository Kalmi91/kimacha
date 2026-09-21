import { StyleSheet, View, Text } from 'react-native';

import Colors from '@/constants/Colors';

type ColorScheme = (typeof Colors)['light'];

// 5b: a LearnChrome-ban ma nincs kiemelhető `badge` chip-stílus (az ITER5
// refaktor a régi jelvény-sort egy egysoros státusz-sorra vonta össze), ezért
// ez új komponens, a jóváhagyott terv (anki-ui-terv.html) `.badge` értékeivel:
// 13-as betű, 999 radius, halvány háttér, félkövér, szín-változatok.
type Tone = 'default' | 'blue' | 'green' | 'pink';

type BadgeItem = {
  label: string;
  tone?: Tone;
};

const TONE_COLOR: Record<Tone, string | null> = {
  default: null,
  blue: '#0284C7',
  green: '#22C55E',
  pink: '#F472B6',
};

type Props = {
  items: BadgeItem[];
  colors: ColorScheme;
};

export default function BadgeRow({ items, colors }: Props) {
  return (
    <View style={styles.row}>
      {items.map((item, i) => (
        <View key={i} style={[styles.badge, { backgroundColor: colors.card }]}>
          <Text style={[styles.badgeText, { color: TONE_COLOR[item.tone ?? 'default'] ?? colors.text }]}>
            {item.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  badgeText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
