import type { ReactNode } from 'react';
import { ScrollView, Text, View } from 'react-native';

import Colors from '@/constants/Colors';
import { useTheme } from '@/lib/ThemeContext';
import { mockStyles as styles } from './mockStyles';

// A text of the task in a box: the title, then the paragraphs (`\n\n` in the data). `scroll`: a long text scrolls inside
// its box. `renderParagraph` lets a gapped text put the numbered gap chips into the paragraphs.

type Props = {
  title?: string;
  text: string;
  scroll?: boolean;
  testID?: string;
  renderParagraph?: (paragraph: string, index: number) => ReactNode;
};

export const paragraphsOf = (text: string) => text.split(/\n\s*\n/).filter((p) => p.trim() !== '');

const GAP = /(\{\{\d+\}\})/;

/** The gap numbers of a text with `{{n}}` markers, in order of appearance. */
export const gapNumbers = (text: string) => [...text.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]));

/** A paragraph with its `{{n}}` markers replaced by bold bracketed chips, e.g. `[3]` or `[3: word]` (`label(n)` gives the text inside). */
export function GapParagraph({ paragraph, label, color, chipColor }: { paragraph: string; label: (n: number) => string; color: string; chipColor: string }) {
  return (
    <Text style={[styles.body, { color }]}>
      {paragraph.split(GAP).map((part, i) => {
        const m = /^\{\{(\d+)\}\}$/.exec(part);
        if (!m) return part;
        const n = Number(m[1]);
        return (
          <Text key={i} testID={`mock-gapchip-${n}`} style={[styles.bold, { color: chipColor }]}>
            {` [${label(n)}] `}
          </Text>
        );
      })}
    </Text>
  );
}

export default function MockTextBox({ title, text, scroll, testID, renderParagraph }: Props) {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const content = (
    <>
      {title ? <Text style={[styles.question, { color: colors.text }]}>{title}</Text> : null}
      {paragraphsOf(text).map((p, i) =>
        renderParagraph ? (
          <View key={i}>{renderParagraph(p, i)}</View>
        ) : (
          <Text key={i} style={[styles.body, { color: colors.text }]}>
            {p}
          </Text>
        ),
      )}
    </>
  );
  return (
    <View testID={testID} style={[styles.box, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {scroll ? (
        <ScrollView nestedScrollEnabled style={styles.scrollBox} contentContainerStyle={styles.wrap}>
          {content}
        </ScrollView>
      ) : (
        content
      )}
    </View>
  );
}
