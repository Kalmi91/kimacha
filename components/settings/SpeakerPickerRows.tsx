// Settings -> Voice: whose voice reads each language (lib/voicePreference.ts). One card per active course language:
// "Automatic (fastest)" (each word's own recorded voice, today's behavior), then the two people of the
// language's current engine pair, named with their sex. Exactly one row of a block is checked. Hidden where the
// better voice does not exist (the web build). Below the pickers, the temporary "Fast fallback" switch. The Row is
// the Settings screen's own card row.

import { Pressable, View, StyleSheet } from 'react-native';
import { Text } from '@/components/KText';
import { BrutalSwitch } from '@/components/grammar/Brutal';
import Colors from '@/constants/Colors';
import { useTheme } from '@/lib/ThemeContext';
import { useGrammarColors } from '@/lib/grammarColors';
import { t } from '@/lib/i18n';
import { languages } from '@/lib/languages';
import { setNeuralFastFallback, setNeuralSpeaker, useNeuralState } from '@/lib/neuralModels';
import { isPiperOnly, voiceName, voicePair, type NeuralLang, type SpeakerChoice } from '@/lib/neuralVoices';
import { playVoiceSample, stopVoiceSample, useSamplePlaying } from '@/lib/voiceSample';
import { SAMPLE_SENTENCES, sampleKey, type SampleGender } from '@/lib/voiceSampleData';
import { useFastFallback, useSpeakerChoices } from '@/lib/voicePreference';
import { SentenceVoiceChoices, type RowComponent } from './BetterVoiceRows';

export default function SpeakerPickerRows({ Row, languages: voiceLanguages }: { Row: RowComponent; languages: NeuralLang[] }) {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const g = useGrammarColors();
  const s = t().settings.speaker;
  const state = useNeuralState();
  const choices = useSpeakerChoices();
  const fastFallback = useFastFallback();
  const samplePlaying = useSamplePlaying();
  if (!state.supported) return null;

  const langName = (code: NeuralLang) => languages.find(l => l.code === code)?.name ?? code;

  return (
    <>
      {voiceLanguages.map(lang => {
        const [female, male] = voicePair(lang, state.engines[lang]);
        // the sample of the engine the card shows (Hungarian and German: always Piper)
        const engine = isPiperOnly(lang) ? 'piper' : state.engines[lang];
        const options: { choice: SpeakerChoice; label: string; hint?: string; sample?: { gender: SampleGender; name: string } }[] = [
          { choice: 'auto', label: s.auto },
          { choice: 'f', label: s.person(voiceName(female), true), hint: s.hint, sample: { gender: 'f', name: voiceName(female) } },
          { choice: 'm', label: s.person(voiceName(male), false), hint: s.hint, sample: { gender: 'm', name: voiceName(male) } },
        ];
        return (
          <View key={lang} testID={`settings-speaker-${lang}`}>
            <Text style={[styles.title, { color: colors.textMuted }]}>{langName(lang)}</Text>
            <Row>
              <View style={styles.card}>
                <Text style={[styles.label, { color: colors.text }]}>{s.title}</Text>
                <View style={styles.sampleBox}>
                  <Text style={[styles.hint, { color: colors.tabIconDefault }]}>{s.sample}</Text>
                  <Text testID={`voice-sample-text-${lang}`} style={[styles.sampleText, { color: colors.text }]}>{SAMPLE_SENTENCES[lang]}</Text>
                </View>
                {options.map(({ choice, label, hint, sample }) => {
                  const checked = choices[lang] === choice;
                  return (
                    <Pressable
                      key={choice}
                      onPress={() => setNeuralSpeaker(lang, choice)}
                      testID={`settings-speaker-${lang}-${choice}`}
                      accessibilityRole="radio"
                      accessibilityState={{ checked }}
                      style={styles.option}
                    >
                      <View style={styles.labelBox}>
                        <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
                        {hint ? <Text style={[styles.hint, { color: colors.tabIconDefault }]}>{hint}</Text> : null}
                      </View>
                      {sample ? (
                        <Pressable
                          testID={`voice-sample-${lang}-${sample.gender}`}
                          accessibilityRole="button"
                          accessibilityLabel={s.playSample(sample.name)}
                          accessibilityState={{ selected: samplePlaying === sampleKey(lang, engine, sample.gender) }}
                          hitSlop={8}
                          style={[styles.play, { borderColor: g.a }]}
                          onPress={() => (samplePlaying === sampleKey(lang, engine, sample.gender) ? stopVoiceSample() : playVoiceSample(lang, engine, sample.gender))}
                        >
                          <Text style={[styles.playText, { color: g.ink }]}>{samplePlaying === sampleKey(lang, engine, sample.gender) ? '■' : '▶'}</Text>
                        </Pressable>
                      ) : null}
                      {checked ? <Text style={[styles.check, { color: g.ink }]}>✓</Text> : null}
                    </Pressable>
                  );
                })}
                <SentenceVoiceChoices lang={lang} />
              </View>
            </Row>
          </View>
        );
      })}
      {/* Temporary until EJSZAKA E101 (both voices recorded), Kálmán 2026-11-03. */}
      <Row>
        <View style={styles.labelBox}>
          <Text style={[styles.label, { color: colors.text }]}>{s.fastFallback}</Text>
          <Text style={[styles.hint, { color: colors.tabIconDefault }]}>{s.fastFallbackHint}</Text>
        </View>
        <BrutalSwitch testID="settings-fast-fallback" accessibilityLabel={s.fastFallback} value={fastFallback} onValueChange={setNeuralFastFallback} />
      </Row>
    </>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 12, fontWeight: '500', marginTop: 20 },
  card: { width: '100%' },
  option: { paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  labelBox: { flex: 1, marginRight: 12 },
  label: { fontSize: 16, fontWeight: '600' },
  hint: { fontSize: 12, fontWeight: '500', marginTop: 2 },
  check: { fontSize: 20, fontWeight: '700' },
  sampleBox: { marginTop: 4, marginBottom: 4 },
  sampleText: { fontSize: 15, fontWeight: '500', marginTop: 2 },
  play: { width: 36, height: 36, borderWidth: 1.5, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  playText: { fontSize: 14, fontWeight: '700' },
});
