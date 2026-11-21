import { StyleSheet, View } from 'react-native';
import { Text } from '@/components/KText';

import GradientFill from '@/components/GradientFill';
import type { GrammarColors } from '@/lib/grammarColors';

// Night (g.soft) gap in the drill sentence: a cyan-framed pill, a pink-cyan gradient when correct.
export function NightBlank({ g, answered, isCorrect, text }: { g: GrammarColors; answered: boolean; isCorrect: boolean; text?: string }) {
  return (
    <View
      testID="drill-blank"
      style={{
        borderRadius: 6,
        paddingHorizontal: 6,
        overflow: 'hidden',
        ...(!answered ? { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: g.b } : { borderWidth: 0 }),
      }}
    >
      {answered && isCorrect ? <GradientFill from={g.a} to={g.b} testID="drill-blank-gradient" /> : null}
      {/* Wrong fill as a child, like the gradient: as the box's own background it covered the dark text on Android (emulator). */}
      {answered && !isCorrect ? <View pointerEvents="none" testID="drill-blank-wrong" style={[StyleSheet.absoluteFill, { backgroundColor: g.ink }]} /> : null}
      <Text style={{ fontSize: 20, lineHeight: 26, fontWeight: '500', color: answered ? (isCorrect ? g.onA : g.bg) : g.b }}>
        {answered ? text : '____'}
      </Text>
    </View>
  );
}

// Why a wrapping row of words and not one Text: on Android a View inside a Text sits on the baseline
// and clips the descenders ("g", "y") of the words after it (seen on the emulator). Punctuation or a
// word glued to the gap (no space between) stays in one group with the blank, so it never wraps away.
export function NightSentence({ g, before, after, answered, isCorrect, text }: {
  g: GrammarColors; before: string; after: string; answered: boolean; isCorrect: boolean; text?: string;
}) {
  const pre = before.split(/\s+/).filter(Boolean);
  const post = after.split(/\s+/).filter(Boolean);
  const glueLeft = before && !/\s$/.test(before) ? pre.pop() : undefined;
  const glueRight = after && !/^\s/.test(after) ? post.shift() : undefined;
  const word = (w: string, key: string) => (
    <Text key={key} style={{ fontSize: 20, lineHeight: 30, color: g.ink }}>{w}</Text>
  );
  return (
    <View
      accessible
      accessibilityLabel={`${before}${answered ? text : '____'}${after}`}
      style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', columnGap: 6, rowGap: 4 }}
    >
      {pre.map((w, i) => word(w, `b${i}`))}
      <View testID="drill-blank-group" style={{ flexDirection: 'row', alignItems: 'center' }}>
        {glueLeft ? word(glueLeft, 'gl') : null}
        <NightBlank g={g} answered={answered} isCorrect={isCorrect} text={text} />
        {glueRight ? word(glueRight, 'gr') : null}
      </View>
      {post.map((w, i) => word(w, `a${i}`))}
    </View>
  );
}
