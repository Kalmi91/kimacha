// Settings -> Voice: whose voice reads each language (lib/voicePreference.ts). One block per language the better voice
// covers: "Automatic (fastest)" (each word's own recorded voice, today's behavior), then the two people of the
// language's current engine pair, named with their sex. Exactly one row of a block is checked. Hidden where the
// better voice does not exist (the web build). The Row is the Settings screen's own card row.

import { View, StyleSheet } from 'react-native';
import { Text } from '@/components/KText';
import Colors from '@/constants/Colors';
import { useTheme } from '@/lib/ThemeContext';
import { useGrammarColors } from '@/lib/grammarColors';
import { t } from '@/lib/i18n';
import { languages } from '@/lib/languages';
import { setNeuralSpeaker, useNeuralState } from '@/lib/neuralModels';
import { voiceName, voicePair, type NeuralLang, type SpeakerChoice } from '@/lib/neuralVoices';
import { useSpeakerChoices } from '@/lib/voicePreference';
import type { RowComponent } from './BetterVoiceRows';

const SPEAKER_LANGS: NeuralLang[] = ['es', 'en', 'hu', 'de'];

export default function SpeakerPickerRows({ Row }: { Row: RowComponent }) {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const g = useGrammarColors();
  const s = t().settings.speaker;
  const state = useNeuralState();
  const choices = useSpeakerChoices();
  if (!state.supported) return null;

  const langName = (code: NeuralLang) => languages.find(l => l.code === code)?.name ?? code;

  return (
    <>
      {SPEAKER_LANGS.map(lang => {
        const [female, male] = voicePair(lang, state.engines[lang]);
        const options: { choice: SpeakerChoice; label: string; hint?: string }[] = [
          { choice: 'auto', label: s.auto },
          { choice: 'f', label: s.person(voiceName(female), true), hint: s.hint },
          { choice: 'm', label: s.person(voiceName(male), false), hint: s.hint },
        ];
        return (
          <View key={lang} testID={`settings-speaker-${lang}`}>
            <Text style={[styles.title, { color: colors.textMuted }]}>{s.title(langName(lang))}</Text>
            {options.map(({ choice, label, hint }) => {
              const checked = choices[lang] === choice;
              return (
                <Row key={choice} onPress={() => setNeuralSpeaker(lang, choice)}>
                  <View
                    testID={`settings-speaker-${lang}-${choice}`}
                    accessibilityRole="radio"
                    accessibilityState={{ checked }}
                    style={styles.option}
                  >
                    <View style={styles.labelBox}>
                      <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
                      {hint ? <Text style={[styles.hint, { color: colors.tabIconDefault }]}>{hint}</Text> : null}
                    </View>
                    {checked ? <Text style={[styles.check, { color: g.ink }]}>✓</Text> : null}
                  </View>
                </Row>
              );
            })}
          </View>
        );
      })}
    </>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 12, fontWeight: '500', marginTop: 20 },
  option: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  labelBox: { flex: 1, marginRight: 12 },
  label: { fontSize: 16, fontWeight: '600' },
  hint: { fontSize: 12, fontWeight: '500', marginTop: 2 },
  check: { fontSize: 20, fontWeight: '700' },
});
