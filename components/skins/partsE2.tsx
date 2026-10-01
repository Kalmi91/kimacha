import { View, type StyleProp, type ViewStyle } from 'react-native';

// PLAN-temak 6E (E2): a díszek további közös építőkockái (a parts.tsx mellett). Csak View, border /
// borderRadius / transform trükkökkel (nincs SVG, nincs új natív függőség).

// Háromszög, csúcsa fent: a border-trükk (a két oldalsó border átlátszó, az alsó színes).
export function Triangle({
  width,
  height,
  color,
  style,
  testID,
}: {
  width: number;
  height: number;
  color: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  return (
    <View
      testID={testID}
      pointerEvents="none"
      style={[
        {
          width: 0,
          height: 0,
          borderLeftWidth: width / 2,
          borderRightWidth: width / 2,
          borderBottomWidth: height,
          borderLeftColor: 'transparent',
          borderRightColor: 'transparent',
          borderBottomColor: color,
        },
        style,
      ]}
    />
  );
}

// Virág: `petals` szirom (kör) a közép körül + középpont.
export function Flower({
  size,
  petals = 5,
  color,
  center,
  testID,
}: {
  size: number;
  petals?: number;
  color: string;
  center: string;
  testID?: string;
}) {
  const petal = size * 0.4;
  const orbit = (size - petal) / 2;
  const core = size * 0.3;
  return (
    <View testID={testID} pointerEvents="none" style={{ width: size, height: size }}>
      {Array.from({ length: petals }, (_, i) => {
        const rad = (2 * Math.PI * i) / petals;
        return (
          <View
            key={i}
            testID={testID ? `${testID}-petal` : undefined}
            style={{
              position: 'absolute',
              width: petal,
              height: petal,
              borderRadius: petal / 2,
              backgroundColor: color,
              left: size / 2 - petal / 2 + orbit * Math.sin(rad),
              top: size / 2 - petal / 2 - orbit * Math.cos(rad),
            }}
          />
        );
      })}
      <View
        style={{
          position: 'absolute',
          width: core,
          height: core,
          borderRadius: core / 2,
          backgroundColor: center,
          left: (size - core) / 2,
          top: (size - core) / 2,
        }}
      />
    </View>
  );
}

// Növény-ikon: virág egy száron, két levéllel (kalocsai). 18 x 30.
export function Plant({
  flower,
  center,
  green,
  style,
  testID,
}: {
  flower: string;
  center: string;
  green: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  return (
    <View testID={testID} pointerEvents="none" style={[{ width: 18, height: 30 }, style]}>
      <View style={{ position: 'absolute', left: 8, top: 13, width: 2, height: 17, backgroundColor: green }} />
      <View
        style={{
          position: 'absolute',
          left: 0,
          top: 21,
          width: 9,
          height: 5,
          borderRadius: 3,
          backgroundColor: green,
          transform: [{ rotate: '-30deg' }],
        }}
      />
      <View
        style={{
          position: 'absolute',
          left: 9,
          top: 17,
          width: 9,
          height: 5,
          borderRadius: 3,
          backgroundColor: green,
          transform: [{ rotate: '30deg' }],
        }}
      />
      <View style={{ position: 'absolute', left: 2, top: 0 }}>
        <Flower size={14} petals={5} color={flower} center={center} />
      </View>
    </View>
  );
}

// Cikcakk-vonal: `segments` ferde sáv, felváltva +/- szögben; egy lépés `step` px széles, `rise` px magas.
export function Zigzag({
  segments,
  color,
  thickness = 4,
  step = 13,
  rise = 15,
  testID,
}: {
  segments: number;
  color: string;
  thickness?: number;
  step?: number;
  rise?: number;
  testID?: string;
}) {
  const length = Math.sqrt(step * step + rise * rise);
  const angle = (Math.atan2(rise, step) * 180) / Math.PI;
  return (
    <View testID={testID} pointerEvents="none" style={{ width: segments * step, height: rise }}>
      {Array.from({ length: segments }, (_, i) => (
        <View
          key={i}
          testID={testID ? `${testID}-bar` : undefined}
          style={{
            position: 'absolute',
            left: step * i + step / 2 - length / 2,
            top: rise / 2 - thickness / 2,
            width: length,
            height: thickness,
            backgroundColor: color,
            transform: [{ rotate: `${i % 2 === 0 ? angle : -angle}deg` }],
          }}
        />
      ))}
    </View>
  );
}
