import { Modal, Pressable, Text, StyleSheet } from 'react-native';

import Colors from '@/constants/Colors';
import { PCIC_LEVELS, LEVEL_LABELS, pcicItemsForLevel, type PcicLevel } from '@/data/pcic';
import { levelProgress } from '@/lib/pcicLevels';
import type { Sm2Card } from '@/lib/sm2';
import LevelRow from './LevelRow';

type ColorScheme = (typeof Colors)['light'];

// s1 (anki-ui-terv.html): a PCIC fejléc-chipjére koppintva felcsúszó lap,
// négy sorral (A1-B2). Koppintás egy sorra -> a lap bezárul, azonnal a
// választott szint pakliját adja (PLAN-play 10., index.tsx handleSelectLevel).
type Props = {
  visible: boolean;
  active: PcicLevel;
  cards: Sm2Card[];
  colors: ColorScheme;
  title: string;
  onSelect: (level: PcicLevel) => void;
  onClose: () => void;
};

export default function LevelPickerSheet({ visible, active, cards, colors, title, onSelect, onClose }: Props) {
  // Ha egy szinthez nincs adat vagy nincs angol fordítás, ne kínáljuk fel.
  const levels = PCIC_LEVELS.filter((lvl) => pcicItemsForLevel(lvl).length > 0);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        {/* A lap tartalma saját Pressable-lel nyeli el a koppintást, hogy a
            sorok közti üres terület ne zárja be a lapot (mint az overlay). */}
        <Pressable style={[styles.sheet, { backgroundColor: colors.card }]} onPress={() => {}}>
          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
          {levels.map((lvl) => {
            const total = pcicItemsForLevel(lvl).length;
            const { introduced } = levelProgress(cards, lvl, total);
            return (
              <LevelRow
                key={lvl}
                level={lvl}
                label={LEVEL_LABELS[lvl]}
                introduced={introduced}
                total={total}
                active={lvl === active}
                colors={colors}
                onPress={() => onSelect(lvl)}
              />
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
  title: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 16,
  },
});
