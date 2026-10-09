import { View } from 'react-native';

// A drawn checkmark (two rotated bars), so the "done / correct" mark is not an emoji
// (the green square of the ✅ stuck out of the neo-brutalist style) but a shape drawn
// with the colour taken from the token.
// The shape itself signals too (not only the colour): checkmark = correct / done.
export default function CheckMark({ size = 28, color, thickness }: { size?: number; color: string; thickness?: number }) {
  const t = thickness ?? Math.max(3, Math.round(size / 6));
  const short = size * 0.36;
  const long = size * 0.7;
  return (
    <View style={{ width: size, height: size }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View
        style={{
          position: 'absolute',
          left: size * 0.08,
          top: size * 0.56,
          width: short,
          height: t,
          backgroundColor: color,
          transform: [{ rotate: '45deg' }],
        }}
      />
      <View
        style={{
          position: 'absolute',
          left: size * 0.26,
          top: size * 0.46,
          width: long,
          height: t,
          backgroundColor: color,
          transform: [{ rotate: '-50deg' }],
        }}
      />
    </View>
  );
}
