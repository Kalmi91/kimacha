import { Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import Colors from '@/constants/Colors';
import { radius, spacing } from '@/constants/Theme';
import { examPhoto } from '@/data/examPhotos';
import type { MockSpeakingChoice } from '@/lib/exam/mock/types';
import { t } from '@/lib/i18n';
import { useTheme } from '@/lib/ThemeContext';
import MockTextBox from './MockTextBox';
import { mockStyles as styles } from './mockStyles';

// The task sheet of a speaking choice: the title, the prompt, the guiding points, the written stimulus (a long one scrolls),
// the photo(s) with the credit line (author, licence; a tap opens the Commons page, as on the word cards) and the recommended
// speaking time. The same sheet is shown while the learner prepares and, collapsed, next to the examiner's questions.

type Props = {
  choice: MockSpeakingChoice;
  talkMinutes: [number, number];
};

export default function SpeakingSheet({ choice, talkMinutes }: Props) {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const s = t().mockExam;
  return (
    <View testID="mock-speaking-sheet" style={styles.wrap}>
      <Text testID="mock-speaking-title" style={[styles.question, { color: colors.tint }]}>
        {choice.title}
      </Text>
      <Text testID="mock-speaking-prompt" style={[styles.body, { color: colors.text }]}>
        {choice.prompt}
      </Text>
      {choice.bullets?.map((b, i) => (
        <Text key={i} testID={`mock-speaking-bullet-${i}`} style={[styles.body, { color: colors.text }]}>
          {'•'} {b}
        </Text>
      ))}
      {choice.input ? <MockTextBox testID="mock-speaking-input" text={choice.input} scroll /> : null}
      {choice.photos?.map((key) => {
        const photo = examPhoto(key);
        if (!photo) return null;
        return (
          <View key={key} style={local.photoBox}>
            <Image
              testID={`mock-speaking-photo-${key}`}
              source={photo.source}
              style={[local.photo, { aspectRatio: photo.width / photo.height }]}
              resizeMode="cover"
              accessible={false}
            />
            <Pressable
              testID={`mock-speaking-photo-credit-${key}`}
              accessibilityRole="link"
              accessibilityHint={t().pcic.photoCreditHint}
              hitSlop={8}
              onPress={() => {
                Linking.openURL(photo.sourceUrl).catch(() => {
                  // when no app can open the link, the credit line stays as it is
                });
              }}
            >
              <Text style={[local.credit, { color: colors.tint }]}>{t().pcic.photoCredit(photo.author, photo.license, false)}</Text>
            </Pressable>
          </View>
        );
      })}
      <Text testID="mock-speaking-talktime" style={[styles.small, { color: colors.textMuted }]}>
        {s.speakTalkTime(talkMinutes[0], talkMinutes[1])}
      </Text>
    </View>
  );
}

const local = StyleSheet.create({
  photoBox: { width: '100%', gap: spacing.xs },
  // height: 'auto' is needed because on web the local image's own pixel height would override the aspectRatio.
  photo: { width: '100%', height: 'auto', borderRadius: radius.sm },
  credit: { fontSize: 11, lineHeight: 15, textAlign: 'center', textDecorationLine: 'underline' },
});
