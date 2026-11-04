import { Image, Linking, Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Text } from '@/components/KText';
import { accentColor } from '@/components/grammar/Themed';

import Colors from '@/constants/Colors';
import { useGrammarColors } from '@/lib/grammarColors';
import { t } from '@/lib/i18n';
import type { WordImage } from '@/data/wordImages';
import type { NoteLesson } from '@/lib/grammar/noteLesson';

type ColorScheme = (typeof Colors)['light'];

// the part that opens under the (i). The explanation (note) and/or the card's image;
// below the image a small source line that opens the image's Commons file page on tap (CC BY / BY-SA
// attribution: link to the source; for a cropped image the line shows "(cropped)" / "(recortada)").
// If there is neither an image nor an explanation, nothing renders.
// `lesson`: the grammar lesson the explanation links to (a tappable row under the text, FB561).
type Props = {
  note?: string;
  lesson?: NoteLesson;
  image?: WordImage;
  colors: ColorScheme;
};

export default function CardNote({ note, lesson, image, colors }: Props) {
  const g = useGrammarColors();
  if (!note && !image) return null;
  const linkColor = accentColor(g, colors.tint);
  return (
    <View style={styles.wrap}>
      {image && (
        <View style={styles.imageBox}>
          <Image
            testID="learn-image"
            source={image.source}
            style={[styles.image, { aspectRatio: image.width / image.height }]}
            resizeMode="cover"
            accessible={false}
          />
          <Pressable
            testID="learn-image-credit"
            accessibilityRole="link"
            accessibilityHint={t().pcic.photoCreditHint}
            hitSlop={8}
            onPress={() => {
              Linking.openURL(image.sourceUrl).catch(() => {
                // when no app can open the link, the credit line stays as it is
              });
            }}
          >
            <Text style={[styles.credit, { color: linkColor }]}>{t().pcic.photoCredit(image.author, image.license, image.cropped)}</Text>
          </Pressable>
        </View>
      )}
      {!!note && (
        <Text testID="learn-note" style={[styles.noteText, !!lesson && styles.noteTextBeforeLink, { color: colors.text }]}>
          {note}
        </Text>
      )}
      {!!note && !!lesson && (
        <Pressable
          testID="learn-note-lesson"
          accessibilityRole="link"
          hitSlop={8}
          style={styles.lessonLink}
          onPress={() => router.push(`/grammar/${lesson.id}` as never)}
        >
          <Text style={[styles.lessonLinkText, { color: linkColor }]}>{`${t().pcic.noteLessonLink(lesson.title)} ›`}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
  },
  imageBox: {
    width: '100%',
    maxWidth: 320,
    marginBottom: 12,
  },
  // height: 'auto' is needed because on web the local image's own pixel height (RN Web) would override the aspectRatio.
  image: {
    width: '100%',
    height: 'auto',
    borderRadius: 8,
  },
  credit: {
    fontSize: 11,
    lineHeight: 15,
    textAlign: 'center',
    marginTop: 4,
    textDecorationLine: 'underline',
  },
  noteText: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 16,
  },
  noteTextBeforeLink: {
    marginBottom: 8,
  },
  lessonLink: {
    marginBottom: 16,
  },
  lessonLinkText: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    textDecorationLine: 'underline',
  },
});
