import { StyleSheet, View, Text } from 'react-native';

import Colors from '@/constants/Colors';
import { useGrammarColors } from '@/lib/grammarColors';
import { BrutalBox, textOnFill, type BrutalFill } from '@/components/grammar/Brutal';

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

// NY19: brutalista palettán kis dobozok (a due = b, a done = a kitöltés).
const TONE_FILL: Record<Tone, BrutalFill> = { default: 'paper', blue: 'b', green: 'paper', pink: 'a' };

export default function BadgeRow({ items, colors }: Props) {
  const g = useGrammarColors();
  if (g.brutal) {
    return (
      <View style={styles.row}>
        {items.map((item, i) => {
          const fill = TONE_FILL[item.tone ?? 'default'];
          return (
            <BrutalBox key={i} fill={fill} offset={2} boxStyle={styles.brutalBadge}>
              <Text style={[styles.brutalBadgeText, { color: textOnFill(g, fill) }]}>{item.label}</Text>
            </BrutalBox>
          );
        })}
      </View>
    );
  }
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
    // FB405: a spanyol feliratú chipek összege szélesebb a képernyőnél; enélkül a
    // sor nem szűkül a szülőjéhez, így sosem tördelt, és az utolsó chip kilógott.
    flexShrink: 1,
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
  brutalBadge: { paddingHorizontal: 8, paddingVertical: 2, borderWidth: 2 },
  brutalBadgeText: { fontSize: 13, fontWeight: '500' },
});
