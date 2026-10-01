import { type ReactNode } from 'react';
import { StyleSheet, View, Pressable } from 'react-native';
import { Text } from '@/components/KText';

import Colors from '@/constants/Colors';
import { useGrammarColors } from '@/lib/grammarColors';
import { BrutalBox, Sticker } from '@/components/grammar/Brutal';
import { SkinCardFrame } from '@/components/skins/Slots';

type ColorScheme = (typeof Colors)['light'];

// 5b (döntés 5/6b): a Learn (TypingCardScreen) és a PCIC kártya-doboza közös
// héj. A `card`/`typingCard` értékek 1:1 a TypingCardScreen régi
// StyleSheet-jéből jönnek (Learn kinézete nem változik), a `chip` az új,
// tetején ülő lap/lépés-jelvény (PCIC: new / step 1/2), amit a Learn ma nem
// használ (undefined marad, tehát nem is renderel semmit).
type Props = {
  compact?: boolean;
  chip?: string;
  chipTone?: 'new' | 'neutral';
  onPress?: () => void;
  colors: ColorScheme;
  children: ReactNode;
};

// PLAN-temak 2A: a téma dísz-kerete (CardFrame) a kártya körül; dísz nélkül az alap kártya.
export default function CardShell(props: Props) {
  return (
    <SkinCardFrame>
      <CardBody {...props} />
    </SkinCardFrame>
  );
}

function CardBody({ compact, chip, chipTone = 'neutral', onPress, colors, children }: Props) {
  const g = useGrammarColors();
  // NY19: brutalista palettán BrutalBox, a chip matrica (new = b kitöltés).
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
          <Text style={[styles.lapChipText, { color: chipTone === 'new' ? '#22C55E' : colors.tabIconDefault }]}>
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
  // FB172, Kálmán 2026-09-06: a rövid, gépelős kártya a tetejéhez simul,
  // nem a 260-as minHeight közepére lebeg (ld. TypingCardScreen eredeti
  // kommentje, a viselkedés innen költözött, változatlanul).
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
