import { useState } from 'react';
import { StyleSheet, Text, View, Pressable, Modal } from 'react-native';
import Colors from '@/constants/Colors';
import { useTheme } from '@/lib/ThemeContext';
import { t } from '@/lib/i18n';
import { LEVELS, type Level, getWordsForLevel } from '@/data/words';
import { getDb } from '@/lib/database';

export default function SettingsScreen() {
  const { theme, override, setOverride } = useTheme();
  const colors = Colors[theme];
  const s = t();
  const [masterVisible, setMasterVisible] = useState(false);

  const themeOptions: { label: string; value: 'system' | 'light' | 'dark' }[] = [
    { label: '🔄 Auto', value: 'system' },
    { label: '☀️ Light', value: 'light' },
    { label: '🌙 Dark', value: 'dark' },
  ];

  const handleLevelSelect = async (level: Level) => {
    const db = getDb();
    await db.updateLevel(level, 0, 0, 0);
    const levelWords = getWordsForLevel(level);
    for (const w of levelWords) {
      await db.ensureCard(w.id, 'word');
      await db.ensureCard(w.id, 'sentence');
    }
    setMasterVisible(false);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>{s.tabs.settings}</Text>

      <View style={styles.optionGroup}>
        {themeOptions.map(opt => (
          <Pressable
            key={opt.value}
            style={[
              styles.option,
              { backgroundColor: override === opt.value ? colors.tint : colors.card },
            ]}
            onPress={() => setOverride(opt.value)}
          >
            <Text style={[styles.optionText, { color: override === opt.value ? '#FFF' : colors.text }]}>
              {opt.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <Pressable
        style={[styles.masterBtn, { backgroundColor: colors.tint }]}
        onPress={() => setMasterVisible(true)}
      >
        <Text style={styles.masterBtnText}>🎓 {s.master.button}</Text>
      </Pressable>

      <Modal visible={masterVisible} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={[styles.modal, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>{s.master.title}</Text>
            <View style={styles.levelGrid}>
              {LEVELS.map(lvl => {
                const wordCount = getWordsForLevel(lvl).length;
                return (
                  <Pressable
                    key={lvl}
                    style={[styles.levelOption, { backgroundColor: colors.tint }]}
                    onPress={() => handleLevelSelect(lvl)}
                  >
                    <Text style={styles.levelOptionText}>{lvl}</Text>
                    <Text style={styles.levelWordCount}>{wordCount} szó</Text>
                  </Pressable>
                );
              })}
            </View>
            <Pressable onPress={() => setMasterVisible(false)}>
              <Text style={[styles.cancelText, { color: colors.tabIconDefault }]}>{s.feedback.cancel}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    paddingTop: 40,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 20,
  },
  optionGroup: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 24,
  },
  option: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  optionText: {
    fontSize: 15,
    fontWeight: '600',
  },
  masterBtn: {
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  masterBtnText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '700',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 24,
  },
  modal: {
    borderRadius: 20,
    padding: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 20,
  },
  levelGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'center',
    marginBottom: 20,
  },
  levelOption: {
    width: 90,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  levelOptionText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '800',
  },
  levelWordCount: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11,
    marginTop: 2,
  },
  cancelText: {
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '500',
  },
});
