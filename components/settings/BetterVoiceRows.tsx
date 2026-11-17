// Settings: "Better voice (beta)", the on-device neural voices (lib/neuralModels.ts). One row for the
// download / the switch. Sentence engine choices render inside the matching language cards.
// Hidden where the voices do not exist (the web build). The Row is the Settings screen's own card row.

import { type ReactNode } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/components/KText';
import { BrutalSwitch } from '@/components/grammar/Brutal';
import Colors from '@/constants/Colors';
import { useTheme } from '@/lib/ThemeContext';
import { useGrammarColors } from '@/lib/grammarColors';
import { t } from '@/lib/i18n';
import { playVoiceSample, stopVoiceSample, useSamplePlaying } from '@/lib/voiceSample';
import { sampleKey } from '@/lib/voiceSampleData';
import { useSpeakerChoices } from '@/lib/voicePreference';
import { downloadNeural, setNeuralEnabled, setNeuralEngine, useNeuralState } from '@/lib/neuralModels';
import {
  LEGACY_PACK_KEY,
  LEGACY_SENTENCES_KEY,
  NEURAL_MODELS,
  PACK_KEY,
  PIPER_MODEL_KEYS,
  SENTENCES_KEY,
  formatMegabytes,
  missingBytes,
  modelItems,
  modelKeysFor,
  packItems,
  type NeuralEngine,
  type NeuralLang,
} from '@/lib/neuralVoices';

export type RowComponent = (props: { onPress?: () => void; children: ReactNode }) => ReactNode;

export default function BetterVoiceRows({ Row }: { Row: RowComponent }) {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const g = useGrammarColors();
  const s = t().settings.betterVoice;
  const state = useNeuralState();
  if (!state.supported) return null;

  // The Better voice download fetches the voice models only; the recordings (both speakers, optional) are a row of
  // their own and only a tap there installs them, on a phone with no packs too.
  const usableNow = PIPER_MODEL_KEYS.every(key => state.installed[key]);
  const items = modelItems(state.engines);
  const packs = packItems();
  const packsMissing = packs.filter(key => !state.installed[key]);
  const hasOlderRecordings = !!(state.installed[LEGACY_PACK_KEY] || state.installed[LEGACY_SENTENCES_KEY]);
  const missing = items.filter(key => !state.installed[key]);
  const usable = usableNow;
  const { running, percent, phase } = state.download;
  const isPackKey = (key: string) => key === PACK_KEY || key === SENTENCES_KEY;
  const failed = state.download.failed.filter(key => !isPackKey(key));
  const packFailed = state.download.failed.filter(isPackKey);
  // Nothing downloads without a question that names the size (the phone may be on mobile data).
  const confirmDownload = (bytes: number, go: () => void, message: (mb: string) => string = s.confirmModel) => {
    Alert.alert(s.confirmTitle, message(formatMegabytes(bytes)), [
      { text: t().feedback.cancel, style: 'cancel' },
      { text: s.confirmYes, onPress: go },
    ]);
  };
  const askMissing = () => confirmDownload(missingBytes(items, state.installed), () => void downloadNeural(items), s.confirmModel);
  const askRecordings = () => confirmDownload(missingBytes(packs, state.installed), () => void downloadNeural(packs), s.confirmRecordings);

  const right = running ? (
    <Text style={[styles.status, styles.stackAction, { color: colors.text }]}>{phase === 'unpack' ? s.unpacking : s.downloading(percent)}</Text>
  ) : usable ? (
    <BrutalSwitch testID="settings-better-voice" accessibilityLabel={s.title} value={state.enabled} onValueChange={on => void setNeuralEnabled(on)} />
  ) : (
    <Pressable
      testID="settings-better-voice-download"
      accessibilityRole="button"
      style={[styles.button, styles.stackAction, { borderColor: g.a }]}
      onPress={askMissing}
    >
      <Text style={[styles.buttonText, { color: g.ink }]}>{s.download(formatMegabytes(missingBytes(items, state.installed)))}</Text>
    </Pressable>
  );
  const hint = running ? s.wifi : usable ? (state.enabled ? s.on : s.off) : s.wifi;

  // A download button or a progress text is wide: it goes under the text (one column), only the switch sits beside it.
  const stacked = running || !usable;
  const titleBox = (
        <View style={stacked ? undefined : styles.labelBox}>
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
  );

  return (
    <>
      <Row>
        {stacked ? (
          <View style={styles.stackBox}>
            {titleBox}
            {right}
          </View>
        ) : (
          <>
            {titleBox}
            {right}
          </>
        )}
      </Row>
      {packsMissing.length > 0 && (
        <Row>
          {/* One column: the text takes the full card width and the button sits under it, so a narrow screen
              never squeezes the text into a few characters per line next to the wide button. */}
          <View style={styles.stackBox}>
          <View>
            <Text style={[styles.label, { color: colors.text }]}>{s.recordingsTitle}</Text>
            <Text style={[styles.hint, { color: colors.tabIconDefault }]}>{s.recordingsHint}</Text>
            {!running && state.download.lowSpace ? (
              <Text testID="settings-recordings-lowspace" style={[styles.hint, { color: colors.text }]}>
                {s.recordingsLowSpace(formatMegabytes(state.download.lowSpace))}
              </Text>
            ) : null}
            {hasOlderRecordings && (
              <Text testID="settings-recordings-newer" style={[styles.hint, { color: colors.text }]}>
                {s.recordingsNewer}
              </Text>
            )}
            {!running && packFailed.length > 0 && (
              <Text testID="settings-recordings-retry" accessibilityRole="button" onPress={askRecordings} style={[styles.hint, { color: colors.text }]}>
                {s.retry}
              </Text>
            )}
          </View>
          {running ? (
            <Text style={[styles.status, styles.stackAction, { color: colors.text }]}>{phase === 'unpack' ? s.unpacking : s.downloading(percent)}</Text>
          ) : (
            <Pressable testID="settings-recordings-download" accessibilityRole="button" style={[styles.button, styles.stackAction, { borderColor: g.a }]} onPress={askRecordings}>
              <Text style={[styles.buttonText, { color: g.ink }]}>{s.download(formatMegabytes(missingBytes(packs, state.installed)))}</Text>
            </Pressable>
          )}
          </View>
        </Row>
      )}
    </>
  );
}

// Inside the matching language card, below the speaker choices.
export function SentenceVoiceChoices({ lang }: { lang: NeuralLang }) {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const g = useGrammarColors();
  const s = t().settings.betterVoice;
  const state = useNeuralState();
  const choices = useSpeakerChoices();
  const samplePlaying = useSamplePlaying();
  if (!state.supported || (lang !== 'es' && lang !== 'en') || !PIPER_MODEL_KEYS.every(key => state.installed[key])) return null;
  const { running } = state.download;
  const confirmDownload = (bytes: number, go: () => void, message: (mb: string) => string) => {
    Alert.alert(s.confirmTitle, message(formatMegabytes(bytes)), [
      { text: t().feedback.cancel, style: 'cancel' },
      { text: s.confirmYes, onPress: go },
    ]);
  };
  // Why the chosen engine is not the one speaking right now, in plain words (lib/neuralModels.ts noteNeuralTrouble).
  const issueText = (lang: NeuralLang): string | null => {
    const issue = state.issues[lang];
    if (!issue) return null;
    const engineName = issue.engine === 'kokoro' ? 'Kokoro' : 'Piper';
    if (issue.kind === 'standin-failed') return s.issueStandIn(engineName);
    if (issue.engine !== state.engines[lang]) return null;
    return issue.kind === 'slow' ? s.issueSlow(engineName) : issue.kind === 'load-failed' ? s.issueLoad(engineName) : s.issueFailed(engineName);
  };

  return (
    <View testID={`settings-sentences-${lang}`} style={styles.sentenceBlock}>
      <View style={styles.sentenceLabel}>
        <Text style={[styles.label, { color: colors.text }]}>{s.sentences}</Text>
        {issueText(lang) && (
          <Text testID={`settings-better-voice-${lang}-issue`} style={[styles.hint, { color: colors.text }]}>
            {issueText(lang)}
          </Text>
        )}
        {state.engines[lang] === 'kokoro' && !state.installed.kokoro && (
          <Text style={[styles.hint, { color: colors.tabIconDefault }]}>{s.kokoroSize(formatMegabytes(NEURAL_MODELS.kokoro.bytes))}</Text>
        )}
      </View>
      <View style={styles.pills}>
        {(['piper', 'kokoro'] as NeuralEngine[]).map(engine => {
          const selected = state.engines[lang] === engine;
          // the sample of this engine in the picked person's voice (m = male, f or Automatic = female); it never picks the engine
          const gender = choices[lang] === 'm' ? 'm' : 'f';
          const key = sampleKey(lang, engine, gender);
          const playing = samplePlaying === key;
          const name = engine === 'piper' ? s.piper : s.kokoro;
          return (
            <View key={engine} style={styles.engineBox}>
            <Pressable
              testID={`settings-better-voice-${lang}-${engine}`}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              disabled={running}
              style={[styles.pill, { borderColor: selected ? g.a : colors.tabIconDefault, borderWidth: selected ? 2 : 1 }]}
              onPress={() => {
                // picking an engine asks about and fetches that engine's model only, never a recordings pack
                const bytes = missingBytes(modelKeysFor(lang, engine), state.installed);
                if (engine === state.engines[lang] || bytes === 0) void setNeuralEngine(lang, engine);
                else confirmDownload(bytes, () => void setNeuralEngine(lang, engine), s.confirmModel);
              }}
            >
              <Text style={[styles.pillText, { color: selected ? g.ink : colors.tabIconDefault }]}>{name}</Text>
            </Pressable>
            <Pressable
              testID={`voice-sample-${lang}-engine-${engine}`}
              accessibilityRole="button"
              accessibilityLabel={t().settings.speaker.playSample(engine === 'piper' ? 'Piper' : 'Kokoro')}
              accessibilityState={{ selected: playing }}
              hitSlop={6}
              style={[styles.play, { borderColor: g.a }]}
              onPress={() => (playing ? stopVoiceSample() : playVoiceSample(lang, engine, gender))}
            >
              <Text style={[styles.playText, { color: g.ink }]}>{playing ? '■' : '▶'}</Text>
            </Pressable>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  labelBox: { flex: 1, marginRight: 12 },
  stackBox: { flex: 1 },
  stackAction: { alignSelf: 'flex-start', marginTop: 8 },
  label: { fontSize: 16, fontWeight: '600' },
  hint: { fontSize: 12, fontWeight: '500', marginTop: 2 },
  status: { fontSize: 15, fontWeight: '600' },
  button: { borderWidth: 1.5, borderRadius: 18, paddingVertical: 8, paddingHorizontal: 14 },
  buttonText: { fontSize: 14, fontWeight: '700' },
  sentenceBlock: { width: '100%', marginTop: 16 },
  sentenceLabel: { width: '100%', marginBottom: 8 },
  pills: { width: '100%', flexDirection: 'row', gap: 8 },
  pill: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 16, paddingVertical: 6, paddingHorizontal: 12 },
  engineBox: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  play: { width: 32, height: 32, borderWidth: 1.5, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  playText: { fontSize: 12, fontWeight: '700' },
  pillText: { fontSize: 13, fontWeight: '600' },
});
