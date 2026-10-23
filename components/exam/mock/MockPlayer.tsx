import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import Colors from '@/constants/Colors';
import { audioTranscript } from '@/lib/exam/mock/audio';
import type { MockAudioLine } from '@/lib/exam/mock/types';
import { t } from '@/lib/i18n';
import { useTheme } from '@/lib/ThemeContext';
import { mockStyles as styles } from './mockStyles';
import type { MockAudio } from './useMockAudio';

// The player of a recording: play button + plays left; without a voice on the device the transcript is offered instead.
// `testKey` tells the players of one task apart (mock-play-<key>); a task with one recording has no key (mock-play).

type Props = {
  audio: MockAudio;
  /** The recording's id within the task (the plays are counted per id). */
  id: string;
  lines: MockAudioLine[];
  canSpeak: boolean;
  testKey?: string;
};

export default function MockPlayer({ audio, id, lines, canSpeak, testKey }: Props) {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const s = t().mockExam;
  const [showTranscript, setShowTranscript] = useState(false);
  const suffix = testKey === undefined ? '' : `-${testKey}`;
  const left = audio.playsLeft(id);

  return (
    <View style={[styles.audioBox, { borderColor: colors.border, backgroundColor: colors.card }]}>
      {canSpeak ? (
        <>
          <Pressable
            testID={`mock-play${suffix}`}
            accessibilityRole="button"
            onPress={() => audio.play(id, lines)}
            disabled={left <= 0}
            style={[styles.playBtn, { backgroundColor: left <= 0 ? colors.border : colors.tint }]}
          >
            <Text style={[styles.playText, { color: colors.onTint }]}>🔊 {s.play}</Text>
          </Pressable>
          <Text testID={`mock-plays-left${suffix}`} style={[styles.small, { color: colors.textMuted }]}>
            {s.playsLeft(left)}
          </Text>
        </>
      ) : (
        <>
          <Text style={[styles.body, { color: colors.warning }]}>{s.noVoice}</Text>
          <Pressable testID={`mock-transcript-toggle${suffix}`} accessibilityRole="button" style={styles.linkBox} onPress={() => setShowTranscript((v) => !v)}>
            <Text style={[styles.link, { color: colors.tint }]}>{showTranscript ? s.hideTranscript : s.showTranscript}</Text>
          </Pressable>
          {showTranscript && (
            <Text testID={`mock-transcript${suffix}`} style={[styles.small, { color: colors.textMuted }]}>
              {audioTranscript(lines, [s.speakerA, s.speakerB])}
            </Text>
          )}
        </>
      )}
    </View>
  );
}
