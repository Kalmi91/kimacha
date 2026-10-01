import { Modal, Pressable, ScrollView, View, StyleSheet } from 'react-native';
import { Text } from '@/components/KText';

import Colors from '@/constants/Colors';
import { t } from '@/lib/i18n';
import { useGrammarColors } from '@/lib/grammarColors';
import { PCIC_VIEW_LEVELS, pcicItemsForViewLevel, type PcicViewLevel, type PcicTarget } from '@/data/pcic';
import { levelProgressView } from '@/lib/pcicLevels';
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
// választott szint pakliját adja (PLAN-play 10., index.tsx handleSelectLevel).
type Props = {
  visible: boolean;
  active: PcicViewLevel;
  cards: Sm2Card[];
  colors: ColorScheme;
  title: string;
  // PLAN-ketiranyu 4. lépés javítás: es→en-nél mindig A1-et kínálja fel,
  // akkor is, ha még üres (mint app/onboarding.tsx szint-lépése), és a
  // feliratok a felület nyelvén jelennek meg (nem az adatmodul angoljával).
  target: PcicTarget;
  // PLAN-vizsga A. szakasz 2. lépés (A1 a): a szint alatti vizsga-sor; csak azoknak a
  // szinteknek van, amiknek van vizsgájuk (lib/exam/types.ts EXAM_LEVELS). 4. lépés: egy sor
  // vagy szintenként egy (A1-B2); a sor a saját szintje (`status.level`) alatt jelenik meg.
  exam?: ExamRow | ExamRow[];
  // PLAN-vizsga C. szakasz (C1 a): a szint-sorok alatti halk belépő az adaptív szintfelméréshez.
  onPlacement?: () => void;
  onSelect: (level: PcicViewLevel) => void;
  onClose: () => void;
};

export default function LevelPickerSheet({ visible, active, cards, colors, title, target, exam, onPlacement, onSelect, onClose }: Props) {
  const s = t();
  const g = useGrammarColors();
  const levelLabels: Partial<Record<PcicViewLevel, string>> = {
    A1: s.pcic.levelBeginner,
    A2: s.pcic.levelElementary,
    B1: s.pcic.levelIntermediate,
    B2: s.pcic.levelUpperIntermediate,
    'A1+': s.pcic.levelPlusSentences,
    'A2+': s.pcic.levelPlusSentences,
  };
  // Ha egy szinthez nincs adat vagy nincs angol fordítás, ne kínáljuk fel;
  // PLAN-esen: es→en-ben is ugyanez a szűrő (A1 + A2 van adat).
  const levels: PcicViewLevel[] = PCIC_VIEW_LEVELS.filter((lvl) => pcicItemsForViewLevel(lvl).length > 0);
  const examRows: ExamRow[] = exam ? (Array.isArray(exam) ? exam : [exam]) : [];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        {/* A lap tartalma saját Pressable-lel nyeli el a koppintást, hogy a
            sorok közti üres terület ne zárja be a lapot (mint az overlay). */}
        <Pressable style={[styles.sheet, { backgroundColor: colors.card }, g.brutal && [styles.brutalSheet, { borderColor: g.ink }]]} onPress={() => {}}>
          <Text variant="title" style={[styles.title, { color: colors.text }, g.brutal && styles.brutalTitle]}>{title}</Text>
          {/* 4. lépés: négy szint + négy vizsga-sor nem fér egy rövid telefonra, ezért a sorok görgethetők
              (a cím fent marad, a lap legfeljebb a képernyő 90%-a). */}
          <ScrollView showsVerticalScrollIndicator={false}>
          {levels.map((lvl) => {
            const total = pcicItemsForViewLevel(lvl).length;
            const { introduced } = levelProgressView(cards, lvl, total);
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
  // NY19: brutalista lap: sarok 0, felső 2,5 px ink vonal.
  brutalSheet: { borderTopLeftRadius: 0, borderTopRightRadius: 0, borderTopWidth: 2.5 },
  brutalTitle: { textTransform: 'uppercase', fontWeight: '500' },
  title: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 16,
  },
  // PLAN-ketiranyu 4. lépés: "még nincs szó" sor az üres A1 alatt (es→en,
  // amíg az 5. lépés nincs kész), mint app/onboarding.tsx szint-lépése.
  noWordsYet: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: -4,
    marginBottom: 10,
  },
});
