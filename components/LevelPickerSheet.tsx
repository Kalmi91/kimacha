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

// s1 (anki-ui-terv.html): a PCIC fejléc-chipjére koppintva felcsúszó lap,
// négy sorral (A1-B2). Koppintás egy sorra -> a lap bezárul, azonnal a
// választott szint pakliját adja (index.tsx handleSelectLevel).
type Props = {
  visible: boolean;
  active: PcicLevel;
  cards: Sm2Card[];
  colors: ColorScheme;
  title: string;
  // es→en-nél mindig A1-et kínálja fel,
  // akkor is, ha még üres (mint app/onboarding.tsx szint-lépése), és a
  // feliratok a felület nyelvén jelennek meg (nem az adatmodul angoljával).
  target: PcicTarget;
  // a szint alatti vizsga-sor; csak azoknak a
  // szinteknek van, amiknek van vizsgájuk (lib/exam/types.ts EXAM_LEVELS). Egy sor
  // vagy szintenként egy (A1-B2); a sor a saját szintje (`status.level`) alatt jelenik meg.
  exam?: ExamRow | ExamRow[];
  // a szint-sorok alatti halk belépő az adaptív szintfelméréshez.
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
  // Ha egy szinthez nincs adat vagy nincs angol fordítás, ne kínáljuk fel;
  // es→en-ben is ugyanez a szűrő (A1 + A2 van adat).
  const levels: PcicLevel[] = PCIC_VIEW_LEVELS.filter((lvl) => pcicItemsForLevel(lvl).length > 0);
  const examRows: ExamRow[] = exam ? (Array.isArray(exam) ? exam : [exam]) : [];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        {/* A lap tartalma saját Pressable-lel nyeli el a koppintást, hogy a
            sorok közti üres terület ne zárja be a lapot (mint az overlay). */}
        <Pressable style={[styles.sheet, { backgroundColor: colors.card }, g.brutal && [styles.brutalSheet, { borderColor: g.ink }]]} onPress={() => {}}>
          <Text variant="title" style={[styles.title, { color: colors.text }, g.brutal && styles.brutalTitle]}>{title}</Text>
          {/* négy szint + négy vizsga-sor nem fér egy rövid telefonra, ezért a sorok görgethetők
              (a cím fent marad, a lap legfeljebb a képernyő 90%-a). */}
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
  // brutalista lap: sarok 0, felső 2,5 px ink vonal.
  brutalSheet: { borderTopLeftRadius: 0, borderTopRightRadius: 0, borderTopWidth: 2.5 },
  brutalTitle: { textTransform: 'uppercase', fontWeight: '500' },
  title: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 16,
  },
  // "még nincs szó" sor az üres A1 alatt (es→en,
  // amíg az angol szólista nincs kész), mint app/onboarding.tsx szint-lépése.
  noWordsYet: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: -4,
    marginBottom: 10,
  },
});
