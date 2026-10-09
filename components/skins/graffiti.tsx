import { Children, cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type TextStyle } from 'react-native';

import type { SkinDecor } from '@/components/skins/types';
import { useGrammarColors } from '@/lib/grammarColors';
import { useSkin } from '@/lib/useSkin';

// Graffiti: the card is tilted by -2°, two drips at the bottom of the frame (color a), the
// word in color b (yellow), the title in color c (green). The color comes from the child element's style (screens
// set the text color in their style), so overriding the color is done with cloneElement.

const DRIPS = [
  { left: '18%', length: 16 },
  { left: '64%', length: 26 },
] as const;
const DROP = 9;
const STEM = 5;
const MAX_REACH = 26 + DROP;

type Styled = { variant?: string; style?: StyleProp<TextStyle>; children?: ReactNode };

function paint(node: ReactNode, color: string): ReactNode {
  if (!isValidElement(node)) return node;
  return cloneElement(node as ReactElement<Styled>, { style: [(node.props as Styled).style, { color }] });
}

// Color of the `variant="title"` texts in the header (the tab title); the other elements stay as they are.
function paintTitles(node: ReactNode, color: string): ReactNode {
  return Children.map(node, (child) => {
    if (!isValidElement(child)) return child;
    const props = child.props as Styled;
    if (props.variant === 'title') return paint(child, color);
    if (props.children === undefined || typeof props.children === 'string' || typeof props.children === 'function') return child;
    return cloneElement(child as ReactElement<Styled>, undefined, paintTitles(props.children, color));
  });
}

function GraffitiCardFrame({ children }: { children: ReactNode }) {
  const g = useGrammarColors();
  const { shape } = useSkin().skin;
  return (
    <View testID="skin-graffiti-frame" style={styles.frame}>
      {children}
      {DRIPS.map((d, i) => (
        <View
          key={i}
          testID="decor-graffiti-drip"
          pointerEvents="none"
          style={[styles.drip, { left: d.left, height: d.length + DROP, bottom: -(d.length + DROP) + shape.borderWidth }]}
        >
          <View style={{ width: STEM, height: d.length, backgroundColor: g.a }} />
          <View style={{ width: DROP, height: DROP, borderRadius: DROP / 2, backgroundColor: g.a, marginTop: -2 }} />
        </View>
      ))}
    </View>
  );
}

function GraffitiWord({ children }: { word: string; children: ReactNode }) {
  const g = useGrammarColors();
  return <>{paint(children, g.b)}</>;
}

function GraffitiHeader({ children }: { children: ReactNode }) {
  const g = useGrammarColors();
  return <>{paintTitles(children, g.c)}</>;
}

const styles = StyleSheet.create({
  // Room for the drips below the card, and for the -2° tilt above the card and on both sides (a scroll
  // view would clip the tilted corners).
  frame: { marginTop: 6, marginHorizontal: 8, marginBottom: MAX_REACH, transform: [{ rotate: '-2deg' }] },
  drip: { position: 'absolute', width: DROP, alignItems: 'center' },
});

export const graffitiDecor: SkinDecor = {
  CardFrame: GraffitiCardFrame,
  WordRenderer: GraffitiWord,
  HeaderOrnament: GraffitiHeader,
};
