// Settings: "Better voice (beta)", the on-device neural voices (lib/neuralModels.ts). One row for the
// download / the switch, and under it one row per language that has a choice of sentence engine.
// Hidden where the voices do not exist (the web build). The Row is the Settings screen's own card row.

import { type ReactNode } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/components/KText';
import { BrutalSwitch } from '@/components/grammar/Brutal';
import Colors from '@/constants/Colors';
import { useTheme } from '@/lib/ThemeContext';
import { useGrammarColors } from '@/lib/grammarColors';
import { t } from '@/lib/i18n';
import { languages } from '@/lib/languages';
import { downloadNeural, setNeuralEnabled, setNeuralEngine, useNeuralState } from '@/lib/neuralModels';
import {
  NEURAL_MODELS,
  PIPER_MODEL_KEYS,
  formatMegabytes,
  missingBytes,
  requiredItems,
  type NeuralEngine,
  type NeuralLang,
} from '@/lib/neuralVoices';

export type RowComponent = (props: { onPress?: () => void; children: ReactNode }) => ReactNode;

// Hungarian has no Kokoro voice, so only es and en get a choice.
const CHOICE_LANGS: ('es' | 'en')[] = ['es', 'en'];

export default function BetterVoiceRows({ Row }: { Row: RowComponent }) {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const g = useGrammarColors();
  const s = t().settings.betterVoice;
  const state = useNeuralState();
  if (!state.supported) return null;

  const items = requiredItems(state.engines);
  const missing = items.filter(key => !state.installed[key]);
  const usable = PIPER_MODEL_KEYS.every(key => state.installed[key]);
  const { running, percent, phase, failed } = state.download;
  const langName = (code: NeuralLang) => languages.find(l => l.code === code)?.name ?? code;
  // Nothing downloads without a question that names the size (the phone may be on mobile data).
  const confirmDownload = (bytes: number, go: () => void) => {
    Alert.alert(s.confirmTitle, s.confirmMessage(formatMegabytes(bytes)), [
      { text: t().feedback.cancel, style: 'cancel' },
      { text: s.confirmYes, onPress: go },
    ]);
  };
  const askMissing = () => confirmDownload(missingBytes(items, state.installed), () => void downloadNeural());

  const right = running ? (
    <Text style={[styles.status, { color: colors.text }]}>{phase === 'unpack' ? s.unpacking : s.downloading(percent)}</Text>
  ) : usable ? (
    <BrutalSwitch testID="settings-better-voice" accessibilityLabel={s.title} value={state.enabled} onValueChange={on => void setNeuralEnabled(on)} />
  ) : (
    <Pressable
      testID="settings-better-voice-download"
      accessibilityRole="button"
      style={[styles.button, { borderColor: g.a }]}
      onPress={askMissing}
    >
      <Text style={[styles.buttonText, { color: g.ink }]}>{s.download(formatMegabytes(missingBytes(items, state.installed)))}</Text>
    </Pressable>
  );
  const hint = running ? s.wifi : usable ? (state.enabled ? s.on : s.off) : s.wifi;

  return (
    <>
      <Row>
        <View style={styles.labelBox}>
          <Text style={[styles.label, { color: colors.text }]}>{s.title}</Text>
          <Text style={[styles.hint, { color: colors.tabIconDefault }]}>{hint}</Text>
          {!running && failed.length > 0 && (
            <Text testID="settings-better-voice-retry" accessibilityRole="button" onPress={askMissing} style={[styles.hint, { color: colors.text }]}>
              {s.retry}
            </Text>
          )}
          {!running && usable && failed.length === 0 && missing.length > 0 && (
            <Text accessibilityRole="button" onPress={askMissing} style={[styles.hint, { color: colors.text }]}>
              {s.download(formatMegabytes(missingBytes(items, state.installed)))}
            </Text>
          )}
        </View>
        {right}
      </Row>
      {usable &&
        CHOICE_LANGS.map(lang => (
          <Row key={lang}>
            <View style={styles.labelBox}>
              <Text style={[styles.label, { color: colors.text }]}>{s.sentences(langName(lang))}</Text>
              {state.engines[lang] === 'kokoro' && !state.installed.kokoro && (
                <Text style={[styles.hint, { color: colors.tabIconDefault }]}>{s.kokoroSize(formatMegabytes(NEURAL_MODELS.kokoro.bytes))}</Text>
              )}
            </View>
            <View style={styles.pills}>
              {(['piper', 'kokoro'] as NeuralEngine[]).map(engine => {
                const selected = state.engines[lang] === engine;
                return (
                  <Pressable
                    key={engine}
                    testID={`settings-better-voice-${lang}-${engine}`}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    disabled={running}
                    style={[styles.pill, { borderColor: selected ? g.a : colors.tabIconDefault, borderWidth: selected ? 2 : 1 }]}
                    onPress={() => {
                      const bytes = missingBytes(requiredItems({ ...state.engines, [lang]: engine }), state.installed);
                      if (engine === state.engines[lang] || bytes === 0) void setNeuralEngine(lang, engine);
                      else confirmDownload(bytes, () => void setNeuralEngine(lang, engine));
                    }}
                  >
                    <Text style={[styles.pillText, { color: selected ? g.ink : colors.tabIconDefault }]}>{engine === 'piper' ? s.piper : s.kokoro}</Text>
                  </Pressable>
                );
              })}
            </View>
          </Row>
        ))}
    </>
  );
}

const styles = StyleSheet.create({
  labelBox: { flex: 1, marginRight: 12 },
  label: { fontSize: 16, fontWeight: '600' },
  hint: { fontSize: 12, fontWeight: '500', marginTop: 2 },
  status: { fontSize: 15, fontWeight: '600' },
  button: { borderWidth: 1.5, borderRadius: 18, paddingVertical: 8, paddingHorizontal: 14 },
  buttonText: { fontSize: 14, fontWeight: '700' },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'flex-end', flexShrink: 1 },
  pill: { borderRadius: 16, paddingVertical: 6, paddingHorizontal: 12 },
  pillText: { fontSize: 13, fontWeight: '600' },
});
