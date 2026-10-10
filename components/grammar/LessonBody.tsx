import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '@/components/KText';

import Colors, { isDarkTheme } from '@/constants/Colors';
import { useTheme } from '@/lib/ThemeContext';
import { useGrammarColors } from '@/lib/grammarColors';
import { Card } from '@/components/grammar/Brutal';
import { speak } from '@/lib/speech';
import { t } from '@/lib/i18n';
import { speechLang } from '@/lib/languages';
import type { ExamplePair, Lang4, LessonBlock } from '@/lib/grammar/lessonTypes';
import { isConjugationTable, personGloss, splitStemEnding, verbClassOf, verbColumnColor } from '@/lib/grammar/tableShape';
import { groupTableRuns, type TableBlock } from '@/lib/grammar/tableGroups';

// the short explanatory line under the legend, on every conjugation
// table (not lesson data, so it lives here, not in a JSON body block).
const LEGEND_CAPTION: Lang4 = {
  en: 'Each row is one person; each colour is one verb.',
  es: 'Cada fila es una persona, cada color es un verbo.',
};

// renderer for the LessonV2 body blocks. The JSON
// gives the structure (text/list/table/usage/contrast/tip), the component only
// draws.

interface Props {
  blocks: LessonBlock[];
  contentLang: 'en' | 'es';
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
        <Text testID="lessonbody-speak" accessibilityRole="button" accessibilityLabel={t().a11y.speak} onPress={() => speak(ex.es, speechLang(learnedLang))} style={styles.speak}>
          🔊
        </Text>
      </View>
      <Text style={[styles.exampleTr, { color: colors.tabIconDefault }]}>{ex.tr[contentLang] ?? ex.tr.en}</Text>
    </View>
  );
}

// a conjugation `table` block
// in per-person boxes, the stem faint, the ending bold and coloured by
// verb class. isConjugationTable decides whether a block belongs here.
function ConjugationTable({ header, rows, contentLang, colors, isDark }: {
  header: Lang4[];
  rows: string[][];
  contentLang: Props['contentLang'];
  colors: (typeof Colors)['light'];
  isDark: boolean;
}) {
  const g = useGrammarColors();
  const verbHeaders = header.slice(1);
  // if no form can be split cleanly into stem+ending, there is no common
  // base in the table, so the stem/ending split makes no sense (irregular); the
  // whole table then goes as one piece, not cell by cell (within a column, half
  // should not be split and half not).
  const isRegularTable = rows.every((row) => verbHeaders.every((h, ci) => splitStemEnding(row[ci + 1], h.es) !== null));

  return (
    <View style={styles.pblocks}>
      <View style={styles.legend}>
        {verbHeaders.map((h, ci) => {
          const color = verbColumnColor(ci, isDark);
          const verbClass = isRegularTable ? verbClassOf(h.es) : null;
          return (
            <Text key={ci} style={[styles.legendItem, { color: colors.tabIconDefault }]}>
              <Text style={{ color, fontWeight: '700' }}>{h.es}</Text>
              {verbClass ? ` -${verbClass}` : ''}
            </Text>
          );
        })}
      </View>
      <Text style={[styles.legendCaption, { color: colors.tabIconDefault }]}>
        {LEGEND_CAPTION[contentLang] ?? LEGEND_CAPTION.en}
      </Text>
      {rows.map((row, ri) => {
        const person = row[0];
        const gloss = personGloss(person, contentLang);
        return (
          <Card key={ri} classicStyle={[styles.pblock, { backgroundColor: colors.tabIconDefault + '14' }]}>
            <View style={styles.pblockWho}>
              <Text style={[styles.pblockPerson, { color: colors.text }]}>{person}</Text>
              {gloss ? <Text style={[styles.pblockGloss, { color: colors.tabIconDefault }]}>{gloss}</Text> : null}
            </View>
            <View style={styles.pblockForms}>
              {verbHeaders.map((h, ci) => {
                const form = row[ci + 1];
                const color = verbColumnColor(ci, isDark);
                const split = isRegularTable ? splitStemEnding(form, h.es) : null;
                return (
                  <View
                    key={ci}
                    style={[
                      styles.chip,
                      { backgroundColor: colors.card, borderColor: colors.tabIconDefault + '55' },
                      g.brutal && { borderRadius: 0, borderWidth: 2, borderColor: g.ink },
                    ]}
                  >
                    {split ? (
                      <>
                        <Text style={[styles.chipStem, { color: colors.tabIconDefault }]}>{split.stem}</Text>
                        <Text style={[styles.chipEnding, { color }]}>{split.ending}</Text>
                      </>
                    ) : (
                      <Text style={[styles.chipEnding, { color }]}>{form}</Text>
                    )}
                  </View>
                );
              })}
            </View>
          </Card>
        );
      })}
    </View>
  );
}

// the old grid view of non-conjugation (reference) tables, but with the system
// font and flex cells so it fits without scrolling. Only with 5+ columns
// does sideways scrolling remain (`scroll`), there the cells are content-wide.
function GridTable({ header, rows, contentLang, colors, scroll }: {
  header: Lang4[];
  rows: string[][];
  contentLang: Props['contentLang'];
  colors: (typeof Colors)['light'];
  scroll: boolean;
}) {
  const g = useGrammarColors();
  const cellStyle = scroll ? styles.gridCellWide : styles.gridCellFlex;
  const grid = (
    <View
      style={[
        styles.grid,
        { borderColor: colors.tabIconDefault + '55' },
        g.brutal && { borderWidth: 2, borderColor: g.ink, borderRadius: 0 },
      ]}
    >
      <View style={[styles.gridRow, { backgroundColor: g.brutal ? g.a : colors.tint + '22' }]}>
        {header.map((cell, ci) => (
          <Text key={ci} style={[styles.gridCell, cellStyle, styles.gridHeaderCell, { color: g.brutal ? g.onFill : colors.text }]}>
            {cell[contentLang] ?? cell.en}
          </Text>
        ))}
      </View>
      {rows.map((row, ri) => (
        <View key={ri} style={[styles.gridRow, ri % 2 === 1 ? { backgroundColor: colors.tabIconDefault + '11' } : undefined]}>
          {row.map((cell, ci) => (
            <Text key={ci} style={[styles.gridCell, cellStyle, { color: colors.text }]}>
              {cell}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
  return scroll ? <ScrollView horizontal>{grid}</ScrollView> : grid;
}

// a one-verb conjugation table, compact: two columns (left: singular, right:
// plural), per cell the person small and below it the bold form.
function CompactVerbTable({ header, rows, colors, isDark }: {
  header: Lang4[];
  rows: string[][];
  colors: (typeof Colors)['light'];
  isDark: boolean;
}) {
  const g = useGrammarColors();
  const verb = header[1].es;
  const color = verbColumnColor(0, isDark);
  const isRegularTable = rows.every((row) => splitStemEnding(row[1], verb) !== null);
  const half = Math.ceil(rows.length / 2);
  const cell = (row: string[], ri: number) => {
    const split = isRegularTable ? splitStemEnding(row[1], verb) : null;
    return (
      <View
        key={ri}
        testID={`compact-cell-${ri}`}
        style={[
          styles.compactCell,
          { backgroundColor: colors.card, borderColor: colors.tabIconDefault + '55' },
          g.brutal && { borderRadius: 0, borderWidth: 2, borderColor: g.ink },
        ]}
      >
        <Text style={[styles.compactPerson, { color: colors.tabIconDefault }]} numberOfLines={1}>{row[0]}</Text>
        <Text style={styles.compactForm}>
          {split ? <Text style={{ color: colors.tabIconDefault }}>{split.stem}</Text> : null}
          <Text style={{ color, fontWeight: '700' }}>{split ? split.ending : row[1]}</Text>
        </Text>
      </View>
    );
  };
  return (
    <View style={styles.compactGrid}>
      <View style={styles.compactCol}>{rows.slice(0, half).map((row, ri) => cell(row, ri))}</View>
      <View style={styles.compactCol}>{rows.slice(half).map((row, ri) => cell(row, half + ri))}</View>
    </View>
  );
}

// consecutive one-verb conjugation tables (lib/grammar/tableGroups.ts)
// as one tabbed group: the verbs are chips, one table is visible at a time, compact.
function TableTabs({ tables, contentLang, colors, isDark, titleColor }: {
  tables: TableBlock[];
  contentLang: Props['contentLang'];
  colors: (typeof Colors)['light'];
  isDark: boolean;
  titleColor: string;
}) {
  const g = useGrammarColors();
  const [sel, setSel] = useState(0);
  const cur = tables[sel] ?? tables[0];
  return (
    <View style={styles.section} testID={`tables-${tables[0].id}`}>
      <View style={styles.tabRow}>
        {tables.map((tb, ti) => {
          const on = ti === sel;
          return (
            <Pressable
              key={tb.id}
              testID={`table-tab-${tb.id}`}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              onPress={() => setSel(ti)}
              style={[
                styles.tab,
                { backgroundColor: on ? g.a : colors.card, borderColor: colors.tabIconDefault + '55' },
                g.brutal && { borderRadius: 0, borderWidth: 2, borderColor: g.ink },
              ]}
            >
              <Text style={[styles.tabText, { color: on ? g.onA : colors.text }]}>{tb.header[1].es}</Text>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.section} testID={`table-${cur.id}`}>
        <Text variant="title" style={[styles.sectionTitle, { color: titleColor }]}>{cur.title[contentLang] ?? cur.title.en}</Text>
        <CompactVerbTable header={cur.header} rows={cur.rows} colors={colors} isDark={isDark} />
      </View>
    </View>
  );
}

export default function LessonBody({ blocks, contentLang, learnedLang }: Props) {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const isDark = isDarkTheme(theme);
  const g = useGrammarColors();
  // on the brutalist palette the headings are ink-coloured (the lime / cyan fill
  // is unreadable as text on paper).
  const titleColor = g.brutal ? g.ink : colors.tint;

  return (
    <View style={styles.body}>
      {groupTableRuns(blocks).map((entry) => {
        if (entry.kind === 'tabs') {
          return (
            <TableTabs
              key={entry.index}
              tables={entry.tables}
              contentLang={contentLang}
              colors={colors}
              isDark={isDark}
              titleColor={titleColor}
            />
          );
        }
        const block = entry.block;
        const i = entry.index;
        if (block.kind === 'text') {
          return (
            <Text key={i} style={[styles.text, { color: colors.text }]}>
              {block.text[contentLang] ?? block.text.en}
            </Text>
          );
        }

        if (block.kind === 'tip') {
          return (
            <Card key={i} fill="b" classicStyle={styles.tipCard}>
              <Text style={[styles.tipText, { color: g.brutal ? g.onB : colors.text }]}>💡 {block.text[contentLang] ?? block.text.en}</Text>
            </Card>
          );
        }

        if (block.kind === 'list' || block.kind === 'usage') {
          const points = block.kind === 'list' ? block.items : block.points;
          return (
            <View key={i} style={styles.section}>
              {block.title ? (
                <Text variant="title" style={[styles.sectionTitle, { color: titleColor }]}>{block.title[contentLang] ?? block.title.en}</Text>
              ) : null}
              {points.map((point, pi) => (
                <Card key={pi} classicStyle={styles.card}>
                  <Text style={[styles.pointText, { color: colors.text }]}>
                    {block.kind === 'usage' ? `${pi + 1}. ` : '• '}
                    {point.text[contentLang] ?? point.text.en}
                  </Text>
                  {point.examples.map((ex, ei) => (
                    <ExampleRow key={ei} ex={ex} contentLang={contentLang} learnedLang={learnedLang} colors={colors} />
                  ))}
                </Card>
              ))}
            </View>
          );
        }

        if (block.kind === 'table') {
          const conjugation = isConjugationTable(block.header, block.rows);
          return (
            <View key={i} style={styles.section} testID={`table-${block.id}`}>
              <Text variant="title" style={[styles.sectionTitle, { color: titleColor }]}>{block.title[contentLang] ?? block.title.en}</Text>
              {conjugation ? (
                <ConjugationTable
                  header={block.header}
                  rows={block.rows}
                  contentLang={contentLang}
                  colors={colors}
                  isDark={isDark}
                />
              ) : (
                <GridTable
                  header={block.header}
                  rows={block.rows}
                  contentLang={contentLang}
                  colors={colors}
                  // the grid stays, but scrolls sideways only with 5+
                  // columns, where the text really does not fit on the screen.
                  scroll={block.header.length >= 5}
                />
              )}
            </View>
          );
        }

        if (block.kind === 'contrast') {
          return (
            <View key={i} style={styles.section}>
              {block.title ? (
                <Text variant="title" style={[styles.sectionTitle, { color: titleColor }]}>{block.title[contentLang] ?? block.title.en}</Text>
              ) : null}
              {block.pairs.map((pair, pi) => (
                <Card key={pi} classicStyle={styles.card}>
                  <View style={styles.contrastRow}>
                    <Text style={[styles.contrastSide, { color: colors.text }]}>{pair.a}</Text>
                    <Text style={[styles.contrastVs, { color: colors.tabIconDefault }]}>·</Text>
                    <Text style={[styles.contrastSide, { color: colors.text }]}>{pair.b}</Text>
                  </View>
                  <Text style={[styles.pointText, { color: colors.tabIconDefault }]}>{pair.note[contentLang] ?? pair.note.en}</Text>
                  {pair.examples.map((ex, ei) => (
                    <ExampleRow key={ei} ex={ex} contentLang={contentLang} learnedLang={learnedLang} colors={colors} />
                  ))}
                </Card>
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
  // conjugation tables: one box per person, the forms as chips.
  pblocks: { gap: 8 },
  pblock: { borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12, gap: 6 },
  pblockWho: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  pblockPerson: { fontWeight: '700', fontSize: 15 },
  pblockGloss: { fontSize: 12.5, fontStyle: 'italic' },
  pblockForms: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    flexDirection: 'row',
    alignItems: 'baseline',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  chipStem: { fontSize: 16 },
  chipEnding: { fontSize: 16, fontWeight: '700' },
  // tabbed group + compact (2-column) one-verb table.
  tabRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tab: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth },
  tabText: { fontSize: 14, fontWeight: '700' },
  compactGrid: { flexDirection: 'row', gap: 6 },
  compactCol: { flex: 1, gap: 6 },
  compactCell: { borderRadius: 10, paddingVertical: 6, paddingHorizontal: 10, borderWidth: StyleSheet.hairlineWidth },
  compactPerson: { fontSize: 11.5, fontStyle: 'italic' },
  compactForm: { fontSize: 17 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  legendItem: { fontSize: 13.5 },
  legendCaption: { fontSize: 12, fontStyle: 'italic' },
  // non-conjugation (reference) tables: the old grid, monospace and
  // without a fixed minWidth; flex cells, unless scrolling because of 5+ columns.
  grid: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, overflow: 'hidden' },
  gridRow: { flexDirection: 'row' },
  gridCell: { paddingVertical: 8, paddingHorizontal: 10, fontSize: 14.5 },
  gridCellFlex: { flex: 1 },
  gridCellWide: { minWidth: 70 },
  gridHeaderCell: { fontWeight: '800' },
  contrastRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  contrastSide: { fontSize: 15, fontWeight: '700', flex: 1 },
  contrastVs: { fontSize: 13 },
});
