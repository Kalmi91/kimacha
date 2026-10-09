import { View } from 'react-native';

// rajzolt pipa (két elforgatott sáv),
// hogy a "kész / helyes" jel ne emoji legyen (a ✅ zöld négyzete kilógott a
// neo-brutalista stílusból), hanem a tokenből kapott színnel rajzolt forma.
// Az alak maga is jelez (nem csak a szín): pipa = helyes / kész.
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
