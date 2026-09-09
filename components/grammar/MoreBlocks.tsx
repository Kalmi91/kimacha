import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import Colors from '@/constants/Colors';
import { useTheme } from '@/lib/ThemeContext';
import { parseMoreBlocks } from '@/lib/grammar/moreBlocks';

// FB221, Kálmán 2026-09-10: „I do not like the structure of the more I want it to
// be more cleare and organized". A `more` szöveg eddig egyetlen bekezdésként ment
// ki mindhárom helyen (drill, lecke, játék-szabály). Itt egy helyen rajzoljuk meg
// tagoltan: bevezető cím, alatta számozott kivételek, vagy szabályonként egy sor.
// A szöveg maga változatlan, csak a tördelése lesz olvasható (lib/grammar/moreBlocks.ts).

interface Props {
  /** A lecke `more` mezője, nyelvenként. */
  more: Record<string, string>;
  /** A felhasználó nyelve; ha nincs meg, az angol a tartalék. */
  contentLang: string;
  /** A törzsszöveg színe (a drillben halványabb, a leckében teljes erősségű). */
  color: string;
}

export default function MoreBlocks({ more, contentLang, color }: Props) {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const raw = more[contentLang] ?? more.en;
  const blocks = useMemo(() => parseMoreBlocks(raw ?? ''), [raw]);

  if (!blocks.length) return null;

  return (
    <View style={styles.wrap} testID="more-blocks">
      {blocks.map((block, i) => {
        if (block.kind === 'heading') {
          return (
            <Text key={i} style={[styles.heading, { color: colors.text }]}>
              {block.text}
            </Text>
          );
        }
        if (block.kind === 'para') {
          return (
            <Text key={i} style={[styles.text, { color }]}>
              {block.text}
            </Text>
          );
        }
        return (
          <View key={i} style={styles.row}>
            {block.kind === 'item' ? (
              <View style={[styles.badge, { backgroundColor: colors.tint + '22' }]}>
                <Text style={[styles.badgeText, { color: colors.tint }]}>{block.label}</Text>
              </View>
            ) : (
              <Text style={[styles.dot, { color: colors.tint }]}>•</Text>
            )}
            <Text style={[styles.text, styles.rowText, { color }]}>{block.text}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  heading: { fontSize: 13, fontWeight: '800', letterSpacing: 0.2 },
  text: { fontSize: 14, lineHeight: 21 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  rowText: { flex: 1 },
  badge: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  badgeText: { fontSize: 11, fontWeight: '800' },
  dot: { fontSize: 15, width: 12, textAlign: 'center', lineHeight: 21 },
});
