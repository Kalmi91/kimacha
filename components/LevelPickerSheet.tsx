import { Modal, Pressable, Text, View, StyleSheet } from 'react-native';

import Colors from '@/constants/Colors';
import { t } from '@/lib/i18n';
import { useGrammarColors } from '@/lib/grammarColors';
import { PCIC_VIEW_LEVELS, pcicItemsForViewLevel, type PcicViewLevel, type PcicTarget } from '@/data/pcic';
import { levelProgressView } from '@/lib/pcicLevels';
import type { Sm2Card } from '@/lib/sm2';
import LevelRow from './LevelRow';

type ColorScheme = (typeof Colors)['light'];

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
  onSelect: (level: PcicViewLevel) => void;
  onClose: () => void;
};

export default function LevelPickerSheet({ visible, active, cards, colors, title, target, onSelect, onClose }: Props) {
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

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        {/* A lap tartalma saját Pressable-lel nyeli el a koppintást, hogy a
            sorok közti üres terület ne zárja be a lapot (mint az overlay). */}
        <Pressable style={[styles.sheet, { backgroundColor: colors.card }, g.brutal && [styles.brutalSheet, { borderColor: g.ink }]]} onPress={() => {}}>
          <Text style={[styles.title, { color: colors.text }, g.brutal && styles.brutalTitle]}>{title}</Text>
          {levels.map((lvl) => {
            const total = pcicItemsForViewLevel(lvl).length;
            const { introduced } = levelProgressView(cards, lvl, total);
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
                {target === 'en' && total === 0 && (
                  <Text style={[styles.noWordsYet, { color: colors.tabIconDefault }]}>Todavía no hay palabras.</Text>
                )}
              </View>
            );
          })}
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
