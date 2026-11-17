// Settings: "Better voice (beta)", the on-device neural voices (lib/neuralModels.ts). One row for the
// download / the switch. The voice choices render in the Speaker picker (SpeakerPickerRows).
// Hidden where the voices do not exist (the web build). The Row is the Settings screen's own card row.

import { type ReactNode } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/components/KText';
import { BrutalSwitch } from '@/components/grammar/Brutal';
import Colors from '@/constants/Colors';
import { useTheme } from '@/lib/ThemeContext';
import { useGrammarColors } from '@/lib/grammarColors';
import { t } from '@/lib/i18n';
import { downloadNeural, setNeuralEnabled, useNeuralState } from '@/lib/neuralModels';
import {
  LEGACY_PACK_KEY,
  LEGACY_SENTENCES_KEY,
  PACK_KEY,
  PIPER_MODEL_KEYS,
  SENTENCES_KEY,
  formatMegabytes,
  missingBytes,
  modelItems,
  packItems,
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

const styles = StyleSheet.create({
  labelBox: { flex: 1, marginRight: 12 },
  stackBox: { flex: 1 },
  stackAction: { alignSelf: 'flex-start', marginTop: 8 },
  label: { fontSize: 16, fontWeight: '600' },
  hint: { fontSize: 12, fontWeight: '500', marginTop: 2 },
  status: { fontSize: 15, fontWeight: '600' },
  button: { borderWidth: 1.5, borderRadius: 18, paddingVertical: 8, paddingHorizontal: 14 },
  buttonText: { fontSize: 14, fontWeight: '700' },
});
