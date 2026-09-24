import { ScrollView, StyleSheet, Text, View } from 'react-native';

import Colors from '@/constants/Colors';
import { useTheme } from '@/lib/ThemeContext';
import { speak } from '@/lib/speech';
import { speechLang } from '@/lib/languages';
import type { ExamplePair, Lang4, LessonBlock } from '@/lib/grammar/lessonTypes';
import { isConjugationTable, personGloss, splitStemEnding, verbClassOf, verbColumnColor } from '@/lib/grammar/tableShape';

// FB381-383: a jelmagyarázat alatti rövid magyarázó sor, minden ragozási
// táblán (nem lecke-adat, ezért itt lakik, nem egy JSON body-blokkban).
const LEGEND_CAPTION: Lang4 = {
  hu: 'Minden sor egy személy, minden szín egy ige.',
  en: 'Each row is one person; each colour is one verb.',
  es: 'Cada fila es una persona, cada color es un verbo.',
  de: 'Jede Zeile ist eine Person, jede Farbe ist ein Verb.',
};

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

// FB326 (Kálmán 2. terv, "Személy-blokkok"): egy ragozási `table` blokk
// személyenkénti dobozokban, a tő halvány, a végződés vastag és színes az
// igeosztály szerint. isConjugationTable dönti el, hogy egy blokk ide esik.
function ConjugationTable({ header, rows, contentLang, colors, isDark }: {
  header: Lang4[];
  rows: string[][];
  contentLang: Props['contentLang'];
  colors: (typeof Colors)['light'];
  isDark: boolean;
}) {
  const verbHeaders = header.slice(1);
  // FB381: ha egyetlen alak sem bontható tisztán tőre+végződésre, nincs közös
  // alap a táblában, a tő/végződés bontásnak nincs értelme (rendhagyó); az
  // egész tábla akkor egyben megy, nem cellánként (egy oszlopon belül ne
  // legyen fele bontott, fele nem).
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
          <View key={ri} style={[styles.pblock, { backgroundColor: colors.tabIconDefault + '14' }]}>
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
                    style={[styles.chip, { backgroundColor: colors.card, borderColor: colors.tabIconDefault + '55' }]}
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
          </View>
        );
      })}
    </View>
  );
}

// FB326: a nem-ragozási (referencia) táblák régi rács-nézete, de rendszer-
// betűvel és flex-cellákkal, hogy görgetés nélkül elférjen. Csak 5+ oszlopnál
// marad az oldalra görgetés (`scroll`), ott a cellák tartalom-szélesek.
function GridTable({ header, rows, contentLang, colors, scroll }: {
  header: Lang4[];
  rows: string[][];
  contentLang: Props['contentLang'];
  colors: (typeof Colors)['light'];
  scroll: boolean;
}) {
  const cellStyle = scroll ? styles.gridCellWide : styles.gridCellFlex;
  const grid = (
    <View style={[styles.grid, { borderColor: colors.tabIconDefault + '55' }]}>
      <View style={[styles.gridRow, { backgroundColor: colors.tint + '22' }]}>
        {header.map((cell, ci) => (
          <Text key={ci} style={[styles.gridCell, cellStyle, styles.gridHeaderCell, { color: colors.text }]}>
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

export default function LessonBody({ blocks, contentLang, learnedLang }: Props) {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const isDark = theme === 'dark';

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
          const conjugation = isConjugationTable(block.header, block.rows);
          return (
            <View key={i} style={styles.section} testID={`table-${block.id}`}>
              <Text style={[styles.sectionTitle, { color: colors.tint }]}>{block.title[contentLang] ?? block.title.en}</Text>
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
                  // FB326: a rács marad, de csak 5+ oszlopnál görgethető
                  // oldalra, ahol a szöveg valóban nem fér a képernyőre.
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
  // FB326, ragozási táblák ("2 Személy-blokkok" mock): egy doboz személyenként,
  // a formák chipekként; lásd tablazat-tervek.html.
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
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  legendItem: { fontSize: 13.5 },
  legendCaption: { fontSize: 12, fontStyle: 'italic' },
  // FB326, nem-ragozási (referencia) táblák: a régi rács, monospace és
  // fix minWidth nélkül; flex-cellák, hacsak 5+ oszlop miatt görgetős.
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
