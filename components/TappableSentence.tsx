import { Text, type StyleProp, type TextStyle } from 'react-native';
import { normalizeWordToken } from '@/data/words';

// FB150, Kálmán 2026-08-22: every word of a card's sentence is its own tap
// target, a tap files that word into the spelling-practice list (FB39). The
// component only reports the tap and paints what came back; the screen owns the
// lookup and the DB write.
//
// Whitespace is kept as its own part so the line still wraps and spaces exactly
// like the plain <Text> it replaces.

export type TokenState = 'added' | 'missing';

interface Props {
  text: string;
  style?: StyleProp<TextStyle>;
  tokenStates: Record<string, TokenState>;
  onWordPress: (token: string) => void;
}

export default function TappableSentence({ text, style, tokenStates, onWordPress }: Props) {
  const parts = text.split(/(\s+)/);
  return (
    <Text style={style}>
      {parts.map((part, i) => {
        if (!/\S/.test(part)) return part;
        const state = tokenStates[normalizeWordToken(part)];
        return (
          <Text
            key={i}
            onPress={() => onWordPress(part)}
            suppressHighlighting
            style={
              state === 'added'
                ? { color: '#22C55E', textDecorationLine: 'underline' }
                : state === 'missing'
                  ? { color: '#EAB308' }
                  : undefined
            }
          >
            {part}
          </Text>
        );
      })}
    </Text>
  );
}
