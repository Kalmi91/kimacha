import { View, type StyleProp, type ViewStyle } from 'react-native';

// the shared building blocks of the decor. Only View, with transform / borderRadius
// tricks (no SVG, no new native dependency).

// Sunburst fan: the rays start at the bottom center, between -spread..+spread degrees (0 = up).
// The holder is 2*outer wide and outer high; the ray holders (2*outer high) rotate around their center,
// that is, around the bottom center, and the holder clips their empty bottom halves.
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

// Semicircle (radius r): the flat side at the bottom.
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

// Diamond: a rotated square.
export function Diamond({ size, color }: { size: number; color: string }) {
  return <View style={{ width: size, height: size, backgroundColor: color, transform: [{ rotate: '45deg' }] }} />;
}

// Double line: two 1 px lines with a 2 px gap, fills the parent's width (flex: 1).
export function DoubleLine({ color }: { color: string }) {
  return (
    <View style={{ flex: 1, gap: 2 }}>
      <View style={{ height: 1, backgroundColor: color }} />
      <View style={{ height: 1, backgroundColor: color }} />
    </View>
  );
}

// Inner frame over the card: under the card's outer frame, `inset` px from its edge, does not receive touches.
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
