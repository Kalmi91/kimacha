import { useState, useEffect } from 'react';
import { StyleSheet, Text, View, Pressable, Modal, Alert, Switch } from 'react-native';
import { useRouter } from 'expo-router';
import Colors from '@/constants/Colors';
import { useTheme } from '@/lib/ThemeContext';
import { t } from '@/lib/i18n';
import { LEVELS, type Level, getWordsForLevel } from '@/data/words';
import { setPendingAction } from '@/lib/pendingAction';
import { getDb } from '@/lib/database';

export default function SettingsScreen() {
  const { theme, override, setOverride } = useTheme();
  const colors = Colors[theme];
  const s = t();
  const router = useRouter();
  const [masterVisible, setMasterVisible] = useState(false);
  const [wordsOnly, setWordsOnly] = useState(false);

  useEffect(() => {
    getDb().getWordsOnly().then(setWordsOnly);
  }, []);

  const handleWordsOnlyToggle = async (v: boolean) => {
    setWordsOnly(v);
    await getDb().setWordsOnly(v);
    setPendingAction({ type: 'selectTopic' });
    router.push('/');
  };

  const themeOptions: { label: string; value: 'system' | 'light' | 'dark' }[] = [
    { label: '🔄 Auto', value: 'system' },
    { label: '☀️ Light', value: 'light' },
    { label: '🌙 Dark', value: 'dark' },
  ];

  // Direct level switch — no exam gate (Master = free movement).
  const handleLevelSwitch = (level: Level) => {
    setMasterVisible(false);
    setPendingAction({ type: 'setLevel', level });
    router.navigate('/');
  };

  // Start the chosen level's exam directly; passing it levels up as usual.
  const handleExamSelect = (level: Level) => {
    setMasterVisible(false);
    setPendingAction({ type: 'exam', examLevel: level });
    router.navigate('/');
  };

  const handleRestart = () => {
    setMasterVisible(false);
    Alert.alert(
      'Újrakezdés',
      'Biztos újra akarod kezdeni? Eltűnik az eddigi haladásod.',
      [
        { text: 'Nem', style: 'cancel' },
        {
          text: 'Igen',
          style: 'destructive',
          onPress: () => {
            setPendingAction({ type: 'restart' });
            router.navigate('/');
          },
        },
      ]
    );
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

      <Pressable
        style={[styles.masterBtn, { backgroundColor: '#1D4ED8', marginTop: 12 }]}
        onPress={() => router.replace('/onboarding')}
      >
        <Text style={styles.masterBtnText}>🌐 {s.settings.changeLanguage}</Text>
      </Pressable>

      <View style={[styles.wordsOnlyRow, { backgroundColor: colors.card }]}>
        <Text style={[styles.wordsOnlyLabel, { color: colors.text }]}>{s.settings.wordsOnly}</Text>
        <Switch value={wordsOnly} onValueChange={handleWordsOnlyToggle} trackColor={{ true: colors.tint }} />
      </View>

      <Modal visible={masterVisible} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={[styles.modal, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>{s.master.title}</Text>

            <Text style={[styles.sectionLabel, { color: colors.tabIconDefault }]}>{s.master.levels}</Text>
            <View style={styles.levelGrid}>
              {LEVELS.map(lvl => {
                const wordCount = getWordsForLevel(lvl).length;
                return (
                  <Pressable
                    key={lvl}
                    style={[styles.levelOption, { backgroundColor: colors.tint }]}
                    onPress={() => handleLevelSwitch(lvl)}
                  >
                    <Text style={styles.levelOptionText}>{lvl}</Text>
                    <Text style={styles.levelWordCount}>{s.master.wordCount(wordCount)}</Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={[styles.sectionLabel, { color: colors.tabIconDefault }]}>{s.master.exams}</Text>
            <View style={styles.levelGrid}>
              {LEVELS.map(lvl => (
                <Pressable
                  key={lvl}
                  style={[styles.levelOption, styles.examOption]}
                  onPress={() => handleExamSelect(lvl)}
                >
                  <Text style={styles.levelOptionText}>🎓 {lvl}</Text>
                </Pressable>
              ))}
            </View>

            <Pressable style={styles.restartBtn} onPress={handleRestart}>
              <Text style={styles.restartText}>↺ {s.master.restart}</Text>
            </Pressable>
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
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  examOption: {
    backgroundColor: '#1D4ED8',
    paddingVertical: 10,
  },
  restartBtn: {
    alignSelf: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  restartText: {
    color: '#EF4444',
    fontSize: 14,
    fontWeight: '600',
  },
  cancelText: {
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '500',
  },
  wordsOnlyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    marginTop: 12,
  },
  wordsOnlyLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
});
