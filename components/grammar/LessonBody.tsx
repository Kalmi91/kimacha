import { ScrollView, StyleSheet, Text, View } from 'react-native';

import Colors from '@/constants/Colors';
import { useTheme } from '@/lib/ThemeContext';
import { speak } from '@/lib/speech';
import { speechLang } from '@/lib/languages';
import type { ExamplePair, LessonBlock } from '@/lib/grammar/lessonTypes';

// LECKE-SEMA 1. szakasz: a LessonV2 body-blokkjainak megjelenítője. A
// moreBlocks.ts (FB224) a próza szerkezetét TALÁLTA KI; ez a komponens innen
// nem találgat, a JSON adja a szerkezetet (text/list/table/usage/examples/
// contrast/tip), a komponens csak rajzol.

interface Props {
  blocks: LessonBlock[];
  contentLang: 'hu' | 'en' | 'es' | 'de';
  learnedLang: string;
}

function ExampleRow({ ex, contentLang, learnedLang, colors }: {
  ex: ExamplePair;
  contentLang: Props['contentLang'];
  learnedLang: string;
  colors: (typeof Colors)['light'];
}) {
  return (
    <View style={styles.exampleBlock}>
      <View style={styles.exampleRow}>
        <Text style={[styles.exampleEs, { color: colors.text }]}>{ex.es}</Text>
        <Text testID="lessonbody-speak" onPress={() => speak(ex.es, speechLang(learnedLang))} style={styles.speak}>
          🔊
        </Text>
      </View>
      <Text style={[styles.exampleTr, { color: colors.tabIconDefault }]}>{ex.tr[contentLang] ?? ex.tr.en}</Text>
    </View>
  );
}

export default function LessonBody({ blocks, contentLang, learnedLang }: Props) {
  const { theme } = useTheme();
  const colors = Colors[theme];

  return (
    <View style={styles.body}>
      {blocks.map((block, i) => {
        if (block.kind === 'text') {
          return (
            <Text key={i} style={[styles.text, { color: colors.text }]}>
              {block.text[contentLang] ?? block.text.en}
            </Text>
          );
        }

        if (block.kind === 'tip') {
          return (
            <View key={i} style={[styles.tipCard, { backgroundColor: colors.card }]}>
              <Text style={[styles.tipText, { color: colors.text }]}>💡 {block.text[contentLang] ?? block.text.en}</Text>
            </View>
          );
        }

        if (block.kind === 'list' || block.kind === 'usage') {
          const points = block.kind === 'list' ? block.items : block.points;
          return (
            <View key={i} style={styles.section}>
              {block.title ? (
                <Text style={[styles.sectionTitle, { color: colors.tint }]}>{block.title[contentLang] ?? block.title.en}</Text>
              ) : null}
              {points.map((point, pi) => (
                <View key={pi} style={[styles.card, { backgroundColor: colors.card }]}>
                  <Text style={[styles.pointText, { color: colors.text }]}>
                    {block.kind === 'usage' ? `${pi + 1}. ` : '• '}
                    {point.text[contentLang] ?? point.text.en}
                  </Text>
                  {point.examples.map((ex, ei) => (
                    <ExampleRow key={ei} ex={ex} contentLang={contentLang} learnedLang={learnedLang} colors={colors} />
                  ))}
                </View>
              ))}
            </View>
          );
        }

        if (block.kind === 'examples') {
          return (
            <View key={i} style={styles.section}>
              {block.title ? (
                <Text style={[styles.sectionTitle, { color: colors.tint }]}>{block.title[contentLang] ?? block.title.en}</Text>
              ) : null}
              <View style={[styles.card, { backgroundColor: colors.card }]}>
                {block.examples.map((ex, ei) => (
                  <ExampleRow key={ei} ex={ex} contentLang={contentLang} learnedLang={learnedLang} colors={colors} />
                ))}
              </View>
            </View>
          );
        }

        if (block.kind === 'table') {
          return (
            <View key={i} style={styles.section} testID={`table-${block.id}`}>
              <Text style={[styles.sectionTitle, { color: colors.tint }]}>{block.title[contentLang] ?? block.title.en}</Text>
              <ScrollView horizontal contentContainerStyle={[styles.table, { borderColor: colors.tabIconDefault + '55' }]}>
                <View>
                  <View style={[styles.tableRow, { backgroundColor: colors.tint + '22' }]}>
                    {block.header.map((cell, ci) => (
                      <Text key={ci} style={[styles.tableCell, styles.tableHeaderCell, { color: colors.text }]}>
                        {cell[contentLang] ?? cell.en}
                      </Text>
                    ))}
                  </View>
                  {block.rows.map((row, ri) => (
                    <View
                      key={ri}
                      style={[styles.tableRow, ri % 2 === 1 ? { backgroundColor: colors.tabIconDefault + '11' } : undefined]}
                    >
                      {row.map((cell, ci) => (
                        <Text key={ci} style={[styles.tableCell, { color: colors.text }]}>
                          {cell}
                        </Text>
                      ))}
                    </View>
                  ))}
                </View>
              </ScrollView>
            </View>
          );
        }

        if (block.kind === 'contrast') {
          return (
            <View key={i} style={styles.section}>
              {block.title ? (
                <Text style={[styles.sectionTitle, { color: colors.tint }]}>{block.title[contentLang] ?? block.title.en}</Text>
              ) : null}
              {block.pairs.map((pair, pi) => (
                <View key={pi} style={[styles.card, { backgroundColor: colors.card }]}>
                  <View style={styles.contrastRow}>
                    <Text style={[styles.contrastSide, { color: colors.text }]}>{pair.a}</Text>
                    <Text style={[styles.contrastVs, { color: colors.tabIconDefault }]}>·</Text>
                    <Text style={[styles.contrastSide, { color: colors.text }]}>{pair.b}</Text>
                  </View>
                  <Text style={[styles.pointText, { color: colors.tabIconDefault }]}>{pair.note[contentLang] ?? pair.note.en}</Text>
                  {pair.examples.map((ex, ei) => (
                    <ExampleRow key={ei} ex={ex} contentLang={contentLang} learnedLang={learnedLang} colors={colors} />
                  ))}
                </View>
              ))}
            </View>
          );
        }

        return null;
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  body: { gap: 14 },
  text: { fontSize: 15, lineHeight: 23 },
  tipCard: { borderRadius: 12, padding: 12 },
  tipText: { fontSize: 14, lineHeight: 20, fontWeight: '600' },
  section: { gap: 8 },
  sectionTitle: { fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6 },
  card: { borderRadius: 14, padding: 14, gap: 6 },
  pointText: { fontSize: 14, lineHeight: 21 },
  exampleBlock: { marginTop: 2 },
  exampleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  exampleEs: { fontSize: 15, fontWeight: '700', flex: 1 },
  exampleTr: { fontSize: 13 },
  speak: { fontSize: 16 },
  table: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, overflow: 'hidden' },
  tableRow: { flexDirection: 'row' },
  tableCell: { minWidth: 90, paddingVertical: 8, paddingHorizontal: 10, fontSize: 14, fontFamily: 'monospace' },
  tableHeaderCell: { fontWeight: '800', fontFamily: undefined },
  contrastRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  contrastSide: { fontSize: 15, fontWeight: '700', flex: 1 },
  contrastVs: { fontSize: 13 },
});
