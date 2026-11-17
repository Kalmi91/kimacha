// Settings -> Voice: whose voice reads each language (lib/voicePreference.ts). One card per active course language
// with ONE radio list of voices (engine + person): Piper female / male, and for Spanish and English also Kokoro female /
// male once the Piper models are installed. Picking a voice sets both the engine and the person, so a language has exactly
// one voice (Kálmán 2026-11-17). Exactly one row of a card is checked. Hidden where the better voice does not exist (the
// web build). The Row is the Settings screen's own card row.

import { Alert, Pressable, View, StyleSheet } from 'react-native';
import { Text } from '@/components/KText';
import Colors from '@/constants/Colors';
import { useTheme } from '@/lib/ThemeContext';
import { useGrammarColors } from '@/lib/grammarColors';
import { t } from '@/lib/i18n';
import { languages } from '@/lib/languages';
import { setNeuralEngine, setNeuralSpeaker, useNeuralState } from '@/lib/neuralModels';
import {
  NEURAL_MODELS,
  PIPER_MODEL_KEYS,
  formatMegabytes,
  isPiperOnly,
  missingBytes,
  modelKeysFor,
  voiceName,
  voicePair,
  type NeuralEngine,
  type NeuralLang,
  type SpeakerChoice,
} from '@/lib/neuralVoices';
import { playVoiceSample, stopVoiceSample, useSamplePlaying } from '@/lib/voiceSample';
import { SAMPLE_SENTENCES, sampleKey } from '@/lib/voiceSampleData';
import { useSpeakerChoices } from '@/lib/voicePreference';
import type { RowComponent } from './BetterVoiceRows';

export default function SpeakerPickerRows({ Row, languages: voiceLanguages }: { Row: RowComponent; languages: NeuralLang[] }) {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const g = useGrammarColors();
  const s = t().settings.speaker;
  const b = t().settings.betterVoice;
  const state = useNeuralState();
  const choices = useSpeakerChoices();
  const samplePlaying = useSamplePlaying();
  if (!state.supported) return null;

  const langName = (code: NeuralLang) => languages.find(l => l.code === code)?.name ?? code;
  const piperReady = PIPER_MODEL_KEYS.every(key => state.installed[key]);
  const { running } = state.download;

  // Why the chosen engine is not the one speaking right now, in plain words (lib/neuralModels.ts noteNeuralTrouble).
  const issueText = (lang: NeuralLang): string | null => {
    const issue = state.issues[lang];
    if (!issue) return null;
    const engineName = issue.engine === 'kokoro' ? 'Kokoro' : 'Piper';
    if (issue.kind === 'standin-failed') return b.issueStandIn(engineName);
    if (issue.engine !== state.engines[lang]) return null;
    return issue.kind === 'slow' ? b.issueSlow(engineName) : issue.kind === 'load-failed' ? b.issueLoad(engineName) : b.issueFailed(engineName);
  };

  // Picking a voice sets the engine and the person together; a missing engine model asks first (it names the size).
  const pick = (lang: NeuralLang, engine: NeuralEngine, gender: SpeakerChoice) => {
    if (engine === state.engines[lang]) {
      setNeuralSpeaker(lang, gender);
      return;
    }
    const bytes = missingBytes(modelKeysFor(lang, engine), state.installed);
    const apply = () => {
      void setNeuralEngine(lang, engine);
      setNeuralSpeaker(lang, gender);
    };
    if (bytes === 0) apply();
    else
      Alert.alert(b.confirmTitle, b.confirmModel(formatMegabytes(bytes)), [
        { text: t().feedback.cancel, style: 'cancel' },
        { text: b.confirmYes, onPress: apply },
      ]);
  };

  return (
    <>
      {voiceLanguages.map(lang => {
        const engines: NeuralEngine[] = !isPiperOnly(lang) && piperReady ? ['piper', 'kokoro'] : ['piper'];
        const options = engines.flatMap(engine => {
          const [female, male] = voicePair(lang, engine);
          return [
            { engine, gender: 'f' as const, voice: female },
            { engine, gender: 'm' as const, voice: male },
          ];
        });
        const issue = issueText(lang);
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
                {options.map(({ engine, gender, voice }) => {
                  const checked = state.engines[lang] === engine && choices[lang] === gender;
                  const key = sampleKey(lang, engine, gender);
                  const playing = samplePlaying === key;
                  const name = voiceName(voice);
                  const kokoroMissing = engine === 'kokoro' && !state.installed.kokoro;
                  return (
                    <Pressable
                      key={`${engine}-${gender}`}
                      onPress={() => pick(lang, engine, gender)}
                      disabled={running}
                      testID={`settings-speaker-${lang}-${engine}-${gender}`}
                      accessibilityRole="radio"
                      accessibilityState={{ checked }}
                      style={styles.option}
                    >
                      <View style={styles.labelBox}>
                        <Text style={[styles.label, { color: colors.text }]}>{s.person(name, voice.gender === 'f')}</Text>
                        <Text style={[styles.hint, { color: colors.tabIconDefault }]}>{engine === 'kokoro' ? b.kokoro : b.piper}</Text>
                        {kokoroMissing ? (
                          <Text style={[styles.hint, { color: colors.tabIconDefault }]}>{b.kokoroSize(formatMegabytes(NEURAL_MODELS.kokoro.bytes))}</Text>
                        ) : null}
                      </View>
                      <Pressable
                        testID={`voice-sample-${lang}-${engine}-${gender}`}
                        accessibilityRole="button"
                        accessibilityLabel={s.playSample(name)}
                        accessibilityState={{ selected: playing }}
                        hitSlop={8}
                        style={[styles.play, { borderColor: g.a }]}
                        onPress={() => (playing ? stopVoiceSample() : playVoiceSample(lang, engine, gender))}
                      >
                        <Text style={[styles.playText, { color: g.ink }]}>{playing ? '■' : '▶'}</Text>
                      </Pressable>
                      {checked ? <Text style={[styles.check, { color: g.ink }]}>✓</Text> : null}
                    </Pressable>
                  );
                })}
                {issue ? (
                  <Text testID={`settings-better-voice-${lang}-issue`} style={[styles.hint, { color: colors.text }]}>
                    {issue}
                  </Text>
                ) : null}
              </View>
            </Row>
          </View>
        );
      })}
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
