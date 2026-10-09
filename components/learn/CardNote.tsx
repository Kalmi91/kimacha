import { Image, Linking, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/components/KText';

import Colors from '@/constants/Colors';
import { useGrammarColors } from '@/lib/grammarColors';
import { t } from '@/lib/i18n';
import type { WordImage } from '@/data/wordImages';

type ColorScheme = (typeof Colors)['light'];

// az (i) alatt kinyíló rész. A magyarázat (note) és/vagy a kártya képe;
// a kép alatt kis forrássor, ami koppintásra megnyitja a kép Commons fájl-oldalát (CC BY / BY-SA
// forrásmegjelölés: link a forrásra; vágott képnél a sorban „(cropped)” / „(recortada)” jelzés).
// Ha se kép, se magyarázat nincs, semmi nem renderel.
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
  // height: 'auto' kell, mert weben a helyi kép saját pixel-magassága (RN Web) felülírná az aspectRatio-t.
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
