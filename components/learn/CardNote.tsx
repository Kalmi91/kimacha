import { Image, StyleSheet, View } from 'react-native';
import { Text } from '@/components/KText';

import Colors from '@/constants/Colors';
import { t } from '@/lib/i18n';
import type { WordImage } from '@/data/wordImages';

type ColorScheme = (typeof Colors)['light'];

// FB481/495/496/498/500: az (i) alatt kinyíló rész. A magyarázat (note) és/vagy a kártya képe;
// a kép alatt kis, szürke forrássor. Ha mindkettő hiányzik, semmi nem jelenik meg.
type Props = {
  note?: string;
  image?: WordImage;
  colors: ColorScheme;
};

export default function CardNote({ note, image, colors }: Props) {
  if (!note && !image) return null;
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
          <Text testID="learn-image-credit" style={[styles.credit, { color: colors.tabIconDefault }]}>
            {t().pcic.photoCredit(image.author, image.license)}
          </Text>
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
  image: {
    width: '100%',
    borderRadius: 8,
  },
  credit: {
    fontSize: 11,
    lineHeight: 15,
    textAlign: 'center',
    marginTop: 4,
  },
  noteText: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 16,
  },
});
