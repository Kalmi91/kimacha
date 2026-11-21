import { Platform, View, type ViewStyle } from 'react-native';
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
        ...(Platform.OS === 'web' ? ({ display: 'inline-flex' } as unknown as ViewStyle) : {}),
        ...(!answered
          ? { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: g.b }
          : isCorrect
            ? { borderWidth: 0 }
            : { backgroundColor: g.ink }),
      }}
    >
      {answered && isCorrect ? <GradientFill from={g.a} to={g.b} testID="drill-blank-gradient" /> : null}
      <Text style={{ fontSize: 20, lineHeight: 30, fontWeight: '500', color: answered ? (isCorrect ? g.onA : g.bg) : g.b }}>
        {answered ? text : '____'}
      </Text>
    </View>
  );
}
