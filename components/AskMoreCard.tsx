import { useState } from 'react';
import { StyleSheet, Text, View, Pressable, TextInput } from 'react-native';
import Colors from '@/constants/Colors';
import { useTheme } from '@/lib/ThemeContext';
import { t } from '@/lib/i18n';

// UTEMEZO 5. szakasz (FB296/297/298, Kálmán döntése 2026-09-17): amint a
// fekete 0-ra ér és a kéz is kiürül, de review van még, ez a kártya áll a
// kártya helyére a review helyett (lásd sessionQueue.ts nextLap 'ask-more').
// A gombok a DoneScreen askBox-ának filledBtn/outlineBtn stílusát követik.

interface Props {
  dailyDefault: number;
  reviewsLeft: number;
  onMore: (n: number) => void;
  onReviewOnly: () => void;
  onDone: () => void;
}

export default function AskMoreCard({ dailyDefault, reviewsLeft, onMore, onReviewOnly, onDone }: Props) {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const s = t();
  const [input, setInput] = useState(String(dailyDefault));
  const n = () => {
    const v = parseInt(input, 10);
    return Number.isFinite(v) && v >= 1 ? v : Math.max(1, dailyDefault);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.text }]}>{s.learn.askMoreTitle}</Text>
      <TextInput
        testID="askMoreNumber"
        style={[styles.input, { color: colors.text, borderColor: colors.tabIconDefault }]}
        keyboardType="number-pad"
        value={input}
        onChangeText={setInput}
      />
      <Pressable
        style={({ pressed }) => [styles.filledBtn, { backgroundColor: colors.tint, opacity: pressed ? 0.8 : 1 }]}
        onPress={() => onMore(n())}
      >
        <Text style={styles.filledBtnText}>{s.learn.askMoreYes(n())}</Text>
      </Pressable>
      <Pressable
        style={({ pressed }) => [styles.outlineBtn, { borderColor: colors.tint, marginTop: 10, opacity: pressed ? 0.8 : 1 }]}
        onPress={onReviewOnly}
      >
        <Text style={[styles.outlineBtnText, { color: colors.tint }]}>{s.learn.askMoreReviewOnly(reviewsLeft)}</Text>
      </Pressable>
      <Pressable
        style={({ pressed }) => [styles.outlineBtn, { borderColor: colors.tint, marginTop: 10, opacity: pressed ? 0.8 : 1 }]}
        onPress={onDone}
      >
        <Text style={[styles.outlineBtnText, { color: colors.tint }]}>{s.learn.askMoreDone}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },
  title: { fontSize: 20, fontWeight: '700', textAlign: 'center', marginBottom: 16 },
  input: {
    marginBottom: 16,
    alignSelf: 'center',
    width: 80,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 8,
    textAlign: 'center',
    fontSize: 16,
  },
  // Ugyanaz az alak, mint a DoneScreen askBox gombjai (filledBtn/outlineBtn).
  filledBtn: {
    paddingHorizontal: 20,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'transparent',
    alignItems: 'center',
    alignSelf: 'stretch',
  },
  outlineBtn: {
    paddingHorizontal: 20,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    alignSelf: 'stretch',
  },
  outlineBtnText: { fontSize: 15, fontWeight: '700' },
  filledBtnText: { color: '#FFF', fontSize: 15, fontWeight: '700', textAlign: 'center' },
});
