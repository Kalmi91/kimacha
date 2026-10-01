import { View, type StyleProp, type ViewStyle } from 'react-native';

// PLAN-temak 4D: a díszek közös építőkockái. Csak View, transform / borderRadius trükkökkel
// (nincs SVG, nincs új natív függőség).

// Napsugár-legyező: a sugarak az alsó középpontból indulnak, -spread..+spread fok között (0 = fel).
// A tartó 2*outer széles, outer magas; a sugár-tartók (2*outer magasak) a közepükön forognak,
// azaz az alsó középpont körül, a tartó pedig levágja az alsó, üres felüket.
export function Rays({
  count,
  spread = 80,
  inner,
  outer,
  color,
  thickness = 1,
  testID,
}: {
  count: number;
  spread?: number;
  inner: number;
  outer: number;
  color: string;
  thickness?: number;
  testID?: string;
}) {
  const angles = Array.from({ length: count }, (_, i) => (count === 1 ? 0 : -spread + (2 * spread * i) / (count - 1)));
  return (
    <View
      testID={testID}
      pointerEvents="none"
      style={{ width: outer * 2, height: outer, overflow: 'hidden', alignSelf: 'center' }}
    >
      {angles.map((deg, i) => (
        <View
          key={i}
          testID={testID ? `${testID}-ray` : undefined}
          style={{
            position: 'absolute',
            left: outer - thickness / 2,
            top: 0,
            width: thickness,
            height: outer * 2,
            transform: [{ rotate: `${deg}deg` }],
          }}
        >
          <View style={{ height: outer - inner, backgroundColor: color }} />
        </View>
      ))}
    </View>
  );
}

// Félkör (sugár r): a lapos oldala lent.
export function HalfDisc({
  radius,
  color,
  style,
  testID,
}: {
  radius: number;
  color: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  return (
    <View
      testID={testID}
      pointerEvents="none"
      style={[
        { width: radius * 2, height: radius, borderTopLeftRadius: radius, borderTopRightRadius: radius, backgroundColor: color },
        style,
      ]}
    />
  );
}

// Rombusz: egy elforgatott négyzet.
export function Diamond({ size, color }: { size: number; color: string }) {
  return <View style={{ width: size, height: size, backgroundColor: color, transform: [{ rotate: '45deg' }] }} />;
}

// Dupla vonal: két 1 px-es vonal 2 px réssel, a szülő szélességét kitölti (flex: 1).
export function DoubleLine({ color }: { color: string }) {
  return (
    <View style={{ flex: 1, gap: 2 }}>
      <View style={{ height: 1, backgroundColor: color }} />
      <View style={{ height: 1, backgroundColor: color }} />
    </View>
  );
}

// Belső keret a kártya fölé: a kártya külső kerete alatt, `inset` px-re a szélétől, nem fogad érintést.
export function InnerFrame({
  inset,
  width,
  color,
  testID,
}: {
  inset: number;
  width: number;
  color: string;
  testID?: string;
}) {
  return (
    <View
      testID={testID}
      pointerEvents="none"
      style={{ position: 'absolute', top: inset, left: inset, right: inset, bottom: inset, borderWidth: width, borderColor: color }}
    />
  );
}
