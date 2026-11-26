// FB641: after the check the item's `why` stands under the correct answer in the success colour, right or wrong.

import { fireEvent, render, screen, within } from '@testing-library/react-native';
import { StyleSheet, Text } from 'react-native';

import LevelTestFeedback from '@/components/grammar/LevelTestFeedback';
import Colors from '@/constants/Colors';
import { buildLessonTest, type LessonTestQuestion } from '@/lib/grammar/lessonTest';
import { lessonFor } from '@/lib/grammar/syllabus';
import { ThemeProvider, useTheme } from '@/lib/ThemeContext';

const od01 = (): LessonTestQuestion =>
  buildLessonTest(lessonFor('es', 'pronombres-od')!, { seed: 1, learnedLang: 'es', contentLang: 'en', size: 9999 }).find((q) => q.id === 'od-01')!;

function Probe({ q, ok }: { q: LessonTestQuestion; ok: boolean }) {
  return (
    <>
      <Text testID="theme-name">{useTheme().theme}</Text>
      <LevelTestFeedback q={q} topicTitle="Direct object" ok={ok} given={ok ? undefined : 'La'} onNext={jest.fn()} onRule={jest.fn()} />
    </>
  );
}
const successColor = () => Colors[screen.getByTestId('theme-name').props.children as keyof typeof Colors].success;
const show = (q: LessonTestQuestion, ok: boolean) =>
  render(
    <ThemeProvider>
      <Probe q={q} ok={ok} />
    </ThemeProvider>
  );

describe('the reason under the correct answer (FB641)', () => {
  it('a right answer shows the why in the success colour', () => {
    const q = od01();
    expect(q.review.why).toBe('El libro is masculine and singular, so lo.');
    show(q, true);
    const why = screen.getByTestId('level-test-feedback-why');
    expect(why).toHaveTextContent('El libro is masculine and singular, so lo.');
    expect(StyleSheet.flatten(why.props.style).color).toBe(successColor());
  });

  it('a wrong answer shows the same why in the success colour, with the wrong-option text and the why-not link kept', () => {
    show(od01(), false);
    const why = screen.getByTestId('level-test-feedback-why');
    expect(why).toHaveTextContent('El libro is masculine and singular, so lo.');
    expect(StyleSheet.flatten(why.props.style).color).toBe(successColor());
    expect(screen.getByTestId('level-test-whynot')).toBeTruthy();
  });

  it('a right answer keeps the "Why not the others?" link', () => {
    show(od01(), true);
    expect(screen.getByTestId('level-test-whynot-link')).toBeTruthy();
  });

  it('an item without a why shows nothing extra, right or wrong', () => {
    const q = { ...od01(), review: { ...od01().review, why: undefined } };
    show(q, true);
    expect(screen.queryByTestId('level-test-feedback-why')).toBeNull();
    screen.unmount();
    show(q, false);
    expect(screen.queryByTestId('level-test-feedback-why')).toBeNull();
  });
});

describe('Accept as correct (FB732)', () => {
  it('a wrong answer with onAccept shows the button above Next, and pressing it calls onAccept', () => {
    const onAccept = jest.fn();
    render(
      <ThemeProvider>
        <LevelTestFeedback q={od01()} topicTitle="Direct object" ok={false} given="La" onNext={jest.fn()} onRule={jest.fn()} onAccept={onAccept} />
      </ThemeProvider>
    );
    fireEvent.press(screen.getByTestId('level-test-accept'));
    expect(onAccept).toHaveBeenCalledTimes(1);
  });
  it('a right answer, or a screen without onAccept, has no such button', () => {
    const { unmount } = render(
      <ThemeProvider>
        <LevelTestFeedback q={od01()} topicTitle="Direct object" ok onNext={jest.fn()} onRule={jest.fn()} onAccept={jest.fn()} />
      </ThemeProvider>
    );
    expect(screen.queryByTestId('level-test-accept')).toBeNull();
    unmount();
    show(od01(), false);
    expect(screen.queryByTestId('level-test-accept')).toBeNull();
  });
});

describe('the wrong choice view scrolls (E151)', () => {
  it('keeps the long "why not" list in a scroller with a visible scrollbar, Next and the lesson button outside it', () => {
    show(od01(), false);
    const scroll = screen.getByTestId('level-test-scroll');
    expect(scroll.props.persistentScrollbar).toBe(true);
    expect(within(scroll).getByTestId('level-test-whynot')).toBeTruthy();
    expect(within(scroll).queryByTestId('level-test-next')).toBeNull();
    expect(screen.getByTestId('level-test-next')).toBeTruthy();
  });
});
