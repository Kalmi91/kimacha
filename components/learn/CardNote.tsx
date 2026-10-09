import { Image, Linking, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/components/KText';

import Colors from '@/constants/Colors';
import { useGrammarColors } from '@/lib/grammarColors';
import { t } from '@/lib/i18n';
import type { WordImage } from '@/data/wordImages';

type ColorScheme = (typeof Colors)['light'];

// the part that opens under the (i). The explanation (note) and/or the card's image;
// below the image a small source line that opens the image's Commons file page on tap (CC BY / BY-SA
// attribution: link to the source; for a cropped image the line shows "(cropped)" / "(recortada)").
// If there is neither an image nor an explanation, nothing renders.
type Props = {
  note?: string;
  image?: WordImage;
  colors: ColorScheme;
};

export default function CardNote({ note, image, colors }: Props) {
  const g = useGrammarColors();
  if (!note && !image) return null;
  const linkColor = g.brutal ? g.ink : colors.tint;
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
              Linking.openURL(image.sourceUrl).catch(() => {});
            }}
          >
            <Text style={[styles.credit, { color: linkColor }]}>{t().pcic.photoCredit(image.author, image.license, image.cropped)}</Text>
          </Pressable>
        </View>
      )}
      {!!note && (
        <Text testID="learn-note" style={[styles.noteText, { color: colors.text }]}>
          {note}
        </Text>
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
});
