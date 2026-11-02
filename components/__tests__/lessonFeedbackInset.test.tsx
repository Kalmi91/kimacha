// The floating 💬 button (bottom right, FEEDBACK_FAB_MARGIN from the edges) covered the 🔊 at the right edge of the
// grammar lesson's example sentences when the page scrolled under it. The rows that carry that 🔊 take the button's
// size as right inner padding, so the 🔊 always sits left of the button.
import { StyleSheet } from 'react-native';
import { render, screen } from '@testing-library/react-native';

import LessonBody from '../grammar/LessonBody';
import FeedbackButton from '../FeedbackModal';
import { styles as topicStyles } from '../grammar/GrammarTopic.styles';
import { FEEDBACK_FAB_MARGIN, FEEDBACK_FAB_SIZE } from '@/constants/FeedbackFab';
import lessonJson from '@/data/games/grammar/es/ser-estar.json';
import type { LessonV2 } from '@/lib/grammar/lessonTypes';

jest.mock('@/lib/ThemeContext', () => ({
  useTheme: () => ({ theme: 'light' }),
}));

type Node = { parent: Node | null; props: { style?: unknown } };
const styleOf = (node: { props: { style?: unknown } }) => StyleSheet.flatten(node.props.style as never) as Record<string, unknown>;
// the flex row the node sits in (the example sentence + its 🔊)
const rowStyleOf = (node: Node): Record<string, unknown> | null => {
  for (let n: Node | null = node.parent; n; n = n.parent) {
    const st = styleOf(n);
    if (st?.flexDirection === 'row') return st;
  }
  return null;
};

describe('feedback button inset', () => {
  it('the lesson body example row keeps its 🔊 clear of the floating button', () => {
    const lesson = lessonJson as unknown as LessonV2;
    render(<LessonBody blocks={lesson.body} contentLang="en" learnedLang="es" />);
    const speakers = screen.getAllByTestId('lessonbody-speak');
    expect(speakers.length).toBeGreaterThan(0);
    for (const speaker of speakers) {
      expect(rowStyleOf(speaker as unknown as Node)?.paddingRight).toBeGreaterThanOrEqual(FEEDBACK_FAB_SIZE);
    }
  });

  it('the worked example rows under the lesson text keep their 🔊 clear of it too', () => {
    expect(StyleSheet.flatten(topicStyles.exampleRow).paddingRight).toBeGreaterThanOrEqual(FEEDBACK_FAB_SIZE);
  });

  it('the constants are the drawn button: its distance from the edges and its widest footprint', () => {
    render(<FeedbackButton level="A1" languagePair="es→hu" currentCard="lesson-inset" />);
    const fab = styleOf(screen.getByLabelText('Feedback'));
    expect(fab).toMatchObject({ position: 'absolute', bottom: FEEDBACK_FAB_MARGIN, right: FEEDBACK_FAB_MARGIN });
    expect(fab.width).toBeLessThanOrEqual(FEEDBACK_FAB_SIZE);
  });
});
