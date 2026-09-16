import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Colors from '@/constants/Colors';
import { useTheme } from '@/lib/ThemeContext';
import { t } from '@/lib/i18n';
import { LEVELS, getWordsForLevel, type Level } from '@/data/words';

// FB228 (Kálmán 2026-09-10): a tanuló-lap fejlécében az A1 jelvényre koppintva
// szintet lehessen váltani. Ugyanaz a rács, mint a Beállítások „Master"
// ablakában (szint + szószám), csak a vizsga-sor és a restart nélkül: itt a
// szintváltás a dolga, semmi más.
interface Props {
  visible: boolean;
  current: Level;
  targetLang: string;
  onPick: (level: Level) => void;
  onClose: () => void;
}

export default function LevelPicker({ visible, current, targetLang, onPick, onClose }: Props) {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const s = t();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose} testID="levelPickerOverlay">
        <Pressable style={[styles.modal, { backgroundColor: colors.card }]} onPress={() => {}}>
          <Text style={[styles.title, { color: colors.text }]}>{s.master.levels}</Text>
          <View style={styles.grid}>
            {LEVELS.map((lvl) => {
              const active = lvl === current;
              return (
                <Pressable
                  key={lvl}
                  testID={`levelPick-${lvl}`}
                  style={[styles.option, { backgroundColor: active ? colors.accent : colors.tint }]}
                  onPress={() => onPick(lvl)}
                >
                  <Text style={styles.optionText}>{lvl}</Text>
                  <Text style={styles.wordCount}>{s.master.wordCount(getWordsForLevel(lvl, targetLang).length)}</Text>
                </Pressable>
              );
            })}
          </View>
          <Pressable onPress={onClose} style={styles.closeBtn}>
            <Text style={[styles.closeText, { color: colors.tabIconDefault }]}>{s.header.close}</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modal: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 16,
    padding: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 16,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'center',
  },
  option: {
    width: 90,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  optionText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '800',
  },
  wordCount: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11,
    marginTop: 2,
  },
  closeBtn: {
    marginTop: 16,
    alignItems: 'center',
  },
  closeText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
