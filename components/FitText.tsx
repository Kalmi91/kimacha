import { type TextStyle } from 'react-native';
import { Text, type KTextProps } from '@/components/KText';

import { useFitFontSize } from '@/lib/fitText';

// A large-letter, long-word text (card word, tile, title)
// whose font size steps down by length (lib/fitText.ts) and which also shrinks inside a
// row container (`flexShrink: 1`), so it neither overflows nor gets clipped.
// It takes plain text only (children: string); for highlighted / nested parts
// call the `useFitFontSize` hook directly.
type Props = Omit<KTextProps, 'children'> & {
  children: string;
  /** The desired (largest) font size. */
  base: number;
  /** Space to subtract from the window width (padding, sibling elements). */
  reserve?: number;
  maxLines?: number;
  bold?: boolean;
  min?: number;
  /** Uppercase rendering (textTransform: uppercase). */
  caps?: boolean;
  /** If given, the line height is proportional to the font size (size * ratio). */
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
