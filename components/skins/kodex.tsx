import { cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '@/components/KText';

import { InnerFrame } from '@/components/skins/parts';
import type { SkinDecor } from '@/components/skins/types';
import { useGrammarColors } from '@/lib/grammarColors';
import { useSkin } from '@/lib/useSkin';

// Codex: a double thin frame (the theme's frame plus an inner 1 px one, with a 3 px gap) and a
// drop cap: the word's first letter in a gold (b) box with red (a) fraktur (the theme's title font), the
// other letters in the word's own element (FitText), so a long word still fits.

const FRAME_GAP = 3;

function KodexCardFrame({ children }: { children: ReactNode }) {
  const g = useGrammarColors();
  const { shape } = useSkin().skin;
  return (
    <View testID="skin-kodex-frame">
      {children}
      <InnerFrame testID="decor-kodex-inner" inset={shape.borderWidth + FRAME_GAP} width={1} color={g.border} />
    </View>
  );
}

function KodexWord({ children }: { word: string; children: ReactNode }) {
  const g = useGrammarColors();
  const text = isValidElement(children) ? (children.props as { children?: unknown }).children : undefined;
  if (typeof text !== 'string' || text === '') return <>{children}</>;
  const [first, ...rest] = Array.from(text);
  return (
    <View style={styles.word}>
      <View testID="skin-kodex-initial" style={[styles.initial, { backgroundColor: g.b, borderColor: g.border }]}>
        <Text variant="title" style={[styles.initialText, { color: g.a }]}>
          {first.toUpperCase()}
        </Text>
      </View>
      {cloneElement(children as ReactElement<{ children?: ReactNode }>, undefined, rest.join(''))}
    </View>
  );
}

const styles = StyleSheet.create({
  // flexShrink: FitText shrinks inside the row container, so its wrapper must too.
  word: { flexShrink: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  initial: { width: 42, height: 42, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  initialText: { fontSize: 30, lineHeight: 36 },
});

export const kodexDecor: SkinDecor = {
  CardFrame: KodexCardFrame,
  WordRenderer: KodexWord,
};
