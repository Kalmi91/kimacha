import { type ReactNode } from 'react';
import { StyleSheet, View, Pressable } from 'react-native';
import { Text } from '@/components/KText';

import Colors from '@/constants/Colors';
import { legibleOn } from '@/constants/Skins';
import { useGrammarColors } from '@/lib/grammarColors';
import { BrutalBox, Sticker } from '@/components/grammar/Brutal';
import { SkinCardFrame } from '@/components/skins/Slots';

type ColorScheme = (typeof Colors)['light'];

// the shared shell of the card box of Learn (TypingCardScreen) and PCIC.
// The `card`/`typingCard` values come 1:1 from TypingCardScreen's old
// StyleSheet (Learn's look does not change), the `chip` is the new
// card/step badge sitting on top (PCIC: new / step 1/2), which Learn does not
// use today (stays undefined, so it renders nothing).
type Props = {
  compact?: boolean;
  chip?: string;
  chipTone?: 'new' | 'neutral';
  onPress?: () => void;
  colors: ColorScheme;
  children: ReactNode;
};

// the theme's decorative frame (CardFrame) around the card; without a decoration, the plain card.
export default function CardShell(props: Props) {
  return (
    <SkinCardFrame>
      <CardBody {...props} />
    </SkinCardFrame>
  );
}

function CardBody({ compact, chip, chipTone = 'neutral', onPress, colors, children }: Props) {
  const g = useGrammarColors();
  // on the brutalist palette a BrutalBox, the chip a sticker (new = b fill).
  if (g.brutal) {
    return (
      <BrutalBox testID="learn-card" onPress={onPress} boxStyle={[styles.brutalCard, compact && styles.brutalTyping]}>
        {chip && <Sticker label={chip} fill={chipTone === 'new' ? 'b' : 'paper'} rotate={-4} style={styles.brutalChip} />}
        {children}
      </BrutalBox>
    );
  }
  return (
    <Pressable
      style={[styles.card, compact && styles.typingCard, { backgroundColor: colors.card }]}
      onPress={onPress}
    >
      {chip && (
        <View style={[styles.lapChip, { backgroundColor: colors.background }]}>
          <Text style={[styles.lapChipText, { color: chipTone === 'new' ? legibleOn('#22C55E', colors.background) : colors.tabIconDefault }]}>
            {chip}
          </Text>
        </View>
      )}
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    minHeight: 260,
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  // the short, typed card hugs the top,
  // instead of floating in the middle of the 260 minHeight (see TypingCardScreen's original
  // comment; the behaviour moved here, unchanged).
  typingCard: {
    minHeight: 0,
    justifyContent: 'flex-start',
    paddingTop: 18,
    paddingBottom: 20,
  },
  brutalCard: { padding: 24, alignItems: 'center', minHeight: 260, justifyContent: 'center' },
  brutalTyping: { minHeight: 0, justifyContent: 'flex-start', paddingTop: 18, paddingBottom: 20 },
  brutalChip: { alignSelf: 'center', marginBottom: 10 },
  lapChip: {
    alignSelf: 'center',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
    marginBottom: 10,
  },
  lapChipText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
});
