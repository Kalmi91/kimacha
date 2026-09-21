import { StyleSheet, View, Text, Pressable } from 'react-native';

// 5b/6b: a PCIC Tudtam/Nem tudtam sora a Learn-alak szerint (flex:1, azonos
// minHeight, fehér félkövér felirat, press-halványítás). A Learn saját
// Good/Again sora (FlashcardScreen) más alakú (3 gomb is lehet, nem
// egyenlő szélesség), ezért azt ez a komponens nem érinti, csak a PCIC
// használja.
type Side = {
  label: string;
  color: string;
  onPress: () => void;
};

type Props = {
  left: Side;
  right: Side;
};

export default function GradeButtons({ left, right }: Props) {
  return (
    <View style={styles.row}>
      {[left, right].map((side, i) => (
        <Pressable
          key={i}
          style={({ pressed }) => [styles.btn, { backgroundColor: side.color, opacity: pressed ? 0.7 : 1 }]}
          onPress={side.onPress}
        >
          <Text style={styles.label}>{side.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
    width: '100%',
  },
  btn: {
    flex: 1,
    minHeight: 50,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
