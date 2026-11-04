import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { Text } from '@/components/KText';
import Colors from '@/constants/Colors';
import { Card } from '@/components/grammar/Brutal';
import { ActionButton } from '@/components/grammar/Themed';
import SpeakButton from '@/components/SpeakButton';
import { stop as stopSpeech, speak, speakAuto } from '@/lib/speech';
import type { VoiceGender } from '@/lib/neuralVoices';
import { t } from '@/lib/i18n';
import { useTheme } from '@/lib/ThemeContext';

interface Props {
  /** The new word in the learned language, as the card reads it aloud. */
  word: string;
  /** Its meaning in the source language. */
  meaning: string;
  /** Speech locale of the learned language; absent = no sound. */
  speechLocale?: string;
  speakerGender?: VoiceGender;
  /** Next was pressed: the word is introduced. */
  onNext: () => void;
}

// The word card of a new word on the Sentences tab (lib/sentenceNewWord.ts, FB564): the word, what it means, the word read
// aloud once when the card opens (and again on the 🔊 button), and a Next button. Nothing is asked and nothing is graded here.
export default function NewWordCard({ word, meaning, speechLocale, speakerGender, onNext }: Props) {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const s = t();

  const say = (auto: boolean) => {
    if (!speechLocale) return;
    const options = speakerGender ? { gender: speakerGender } : {};
    if (auto) speakAuto(word, speechLocale, options);
    else {
      stopSpeech();
      speak(word, speechLocale, options);
    }
  };

  useEffect(() => {
    say(true);
    return () => stopSpeech();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [word, speechLocale]);

  return (
    <Card classicStyle={styles.card} boxStyle={styles.brutalCard}>
      <Text style={[styles.tag, { color: colors.tabIconDefault }]}>{s.sentenceTab.newWordTag}</Text>
      <Text testID="new-word-word" style={[styles.word, { color: colors.text }]}>{word}</Text>
      {speechLocale ? <SpeakButton testID="new-word-speak" onPress={() => say(false)} style={styles.speakBtn} iconStyle={styles.speakIcon} brutalStyle={styles.speakBrutal} /> : null}
      <Text testID="new-word-meaning" style={[styles.meaning, { color: colors.text }]}>{meaning}</Text>
      <ActionButton
        testID="new-word-next"
        label={`${s.card.next} →`}
        fill="a"
        onPress={onNext}
        brutalStyle={styles.brutalBtn}
        classicStyle={[styles.btn, { backgroundColor: colors.accent }]}
        classicTextStyle={[styles.btnText, { color: colors.onTint }]}
        classicRole={null}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 20, padding: 24, alignItems: 'center', minHeight: 280, gap: 16 },
  brutalCard: { padding: 24, alignItems: 'center', minHeight: 280, gap: 16 },
  tag: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  word: { fontSize: 30, fontWeight: '800', textAlign: 'center' },
  meaning: { fontSize: 20, fontWeight: '600', textAlign: 'center' },
  speakBtn: { alignSelf: 'center', padding: 4 },
  speakIcon: { fontSize: 26 },
  speakBrutal: { alignSelf: 'center' },
  brutalBtn: { alignSelf: 'stretch' },
  btn: { paddingHorizontal: 44, paddingVertical: 14, borderRadius: 24, alignSelf: 'center', marginTop: 8 },
  btnText: { fontSize: 16, fontWeight: '700' },
});
