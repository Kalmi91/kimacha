import { Modal, Pressable, ScrollView, View, StyleSheet } from 'react-native';
import { Text } from '@/components/KText';

import Colors from '@/constants/Colors';
import { t } from '@/lib/i18n';
import { useGrammarColors } from '@/lib/grammarColors';
import { PCIC_VIEW_LEVELS, pcicItemsForLevel, type PcicLevel, type PcicTarget } from '@/data/pcic';
import { levelProgress } from '@/lib/pcicLevels';
import type { Sm2Card } from '@/lib/sm2';
import LevelRow from './LevelRow';
import ExamLevelRow from './exam/ExamLevelRow';
import PlacementEntry from './exam/PlacementEntry';
import { EXAM_LEVELS } from '@/lib/exam/types';
import type { ExamLevelStatus } from '@/lib/exam/unlock';

type ColorScheme = (typeof Colors)['light'];

type ExamRow = { status: ExamLevelStatus; onStart: () => void; onPractice: () => void; onGrammar: () => void };

// A sheet that slides up when the PCIC header chip is tapped,
// with four rows (A1-B2). Tapping a row -> the sheet closes and immediately gives
// the deck of the chosen level (index.tsx handleSelectLevel).
type Props = {
  visible: boolean;
  active: PcicLevel;
  cards: Sm2Card[];
  colors: ColorScheme;
  title: string;
  // For es→en it always offers A1,
  // even while it is still empty (like the level step in app/onboarding.tsx), and the
  // labels appear in the UI language (not in the English of the data module).
  target: PcicTarget;
  // the exam row under a level; only levels that have an exam
  // get one (lib/exam/types.ts EXAM_LEVELS). A single row
  // or one per level (A1-B2); each row appears under its own level (`status.level`).
  exam?: ExamRow | ExamRow[];
  // a quiet entry to the adaptive placement test below the level rows.
  onPlacement?: () => void;
  onSelect: (level: PcicLevel) => void;
  onClose: () => void;
};

export default function LevelPickerSheet({ visible, active, cards, colors, title, target, exam, onPlacement, onSelect, onClose }: Props) {
  const s = t();
  const g = useGrammarColors();
  const levelLabels: Partial<Record<PcicLevel, string>> = {
    A1: s.pcic.levelBeginner,
    A2: s.pcic.levelElementary,
    B1: s.pcic.levelIntermediate,
    B2: s.pcic.levelUpperIntermediate,
  };
  // If a level has no data or no English translation, do not offer it;
  // es→en uses the same filter too (A1 + A2 have data).
  const levels: PcicLevel[] = PCIC_VIEW_LEVELS.filter((lvl) => pcicItemsForLevel(lvl).length > 0);
  const examRows: ExamRow[] = exam ? (Array.isArray(exam) ? exam : [exam]) : [];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        {/* The sheet content swallows the tap with its own Pressable so that the
            empty area between the rows does not close the sheet (as the overlay would). */}
        <Pressable style={[styles.sheet, { backgroundColor: colors.card }, g.brutal && [styles.brutalSheet, { borderColor: g.ink }]]} onPress={() => {}}>
          <Text variant="title" style={[styles.title, { color: colors.text }, g.brutal && styles.brutalTitle]}>{title}</Text>
          {/* four levels + four exam rows do not fit on a short phone, so the rows are scrollable
              (the title stays on top, the sheet is at most 90% of the screen). */}
          <ScrollView showsVerticalScrollIndicator={false}>
          {levels.map((lvl) => {
            const total = pcicItemsForLevel(lvl).length;
            const { introduced } = levelProgress(cards, lvl, total);
            const examRow = examRows.find((row) => row.status.level === lvl && EXAM_LEVELS.includes(row.status.level));
            return (
              <View key={lvl}>
                <LevelRow
                  level={lvl}
                  label={levelLabels[lvl] ?? lvl}
                  introduced={introduced}
                  total={total}
                  active={lvl === active}
                  colors={colors}
                  onPress={() => onSelect(lvl)}
                />
                {examRow && (
                  <ExamLevelRow
                    status={examRow.status}
                    colors={colors}
                    onStart={examRow.onStart}
                    onPractice={examRow.onPractice}
                    onGrammar={examRow.onGrammar}
                  />
                )}
                {target === 'en' && total === 0 && (
                  <Text style={[styles.noWordsYet, { color: colors.tabIconDefault }]}>Todavía no hay palabras.</Text>
                )}
              </View>
            );
          })}
          {onPlacement && <PlacementEntry onPress={onPlacement} />}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 32,
    maxHeight: '90%',
  },
  // brutalist sheet: corner 0, 2.5 px ink line on top.
  brutalSheet: { borderTopLeftRadius: 0, borderTopRightRadius: 0, borderTopWidth: 2.5 },
  brutalTitle: { textTransform: 'uppercase', fontWeight: '500' },
  title: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 16,
  },
  // "no words yet" row under the empty A1 (es→en,
  // until the English word list is ready), like the level step in app/onboarding.tsx.
  noWordsYet: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: -4,
    marginBottom: 10,
  },
});
