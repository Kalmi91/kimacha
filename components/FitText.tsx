import { type TextStyle } from 'react-native';
import { Text, type KTextProps } from '@/components/KText';

import { useFitFontSize } from '@/lib/fitText';

// nagy betűs, hosszú-szavas szöveg (kártya-szó, csempe, cím),
// aminek a betűmérete a hossz szerint lépcsőzik (lib/fitText.ts), és ami egy
// sor-konténerben is összemegy (`flexShrink: 1`), nem lóg ki és nem vágódik le.
// Csak sima szöveget vesz (children: string); kiemelt / beágyazott részeknél
// a `useFitFontSize` hookot kell hívni közvetlenül.
type Props = Omit<KTextProps, 'children'> & {
  children: string;
  /** A kívánt (legnagyobb) betűméret. */
  base: number;
  /** Az ablak-szélességből levonandó hely (padding, testvér elemek). */
  reserve?: number;
  maxLines?: number;
  bold?: boolean;
  min?: number;
  /** Nagybetűs megjelenítés (textTransform: uppercase). */
  caps?: boolean;
  /** Ha megadott, a sormagasság a betűmérethez arányos (méret * arány). */
  lineHeightRatio?: number;
};

export default function FitText({
  children,
  base,
  reserve,
  maxLines,
  bold = true,
  min,
  caps,
  lineHeightRatio,
  style,
  ...rest
}: Props) {
  const size = useFitFontSize(children, { base, reserve, maxLines, bold, min, caps });
  const fit: TextStyle = { fontSize: size, flexShrink: 1 };
  if (lineHeightRatio) fit.lineHeight = Math.round(size * lineHeightRatio);
  return (
    <Text {...rest} style={[style, fit]}>
      {children}
    </Text>
  );
}
