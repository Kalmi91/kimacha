// E203: a wrong transform answer shows the learner's text and the correct form one under the other (AnswerCompare),
// compared with the nearest accepted form; a right answer shows no comparison. Both skins.

import { fireEvent, render, screen } from '@testing-library/react-native';

import Colors from '@/constants/Colors';
import { TransformDrillItem } from '../grammar/drill/WhyTransformItems';
import type { TransformItem } from '@/lib/grammar/lessonTypes';
import { t } from '@/lib/i18n';

jest.mock('@/lib/speech', () => require('@/test-utils/mocks').speechMock());

let mockTheme = 'light';
jest.mock('@/lib/ThemeContext', () => ({
  useTheme: () => ({ theme: mockTheme }),
}));

const L = (en: string) => ({ en, es: en, hu: en, de: en });
const TRANSFORM: TransformItem = {
  kind: 'transform',
  id: 'tr1',
  tense: { from: 'presente', to: 'indefinido' },
  prompt: L('Como pan.'),
  answer: 'Comí pan.',
  accept: ['Yo comí pan.'],
  wordIds: [],
  why: L('past'),
};

const run = (typed: string) => {
  render(<TransformDrillItem item={TRANSFORM} contentLang="en" strictAccents colors={Colors.light} s={t()} onDone={jest.fn()} />);
  fireEvent.changeText(screen.getByTestId('transform-input'), typed);
  fireEvent.press(screen.getByTestId('transform-check'));
};

describe.each([
  ['classic', 'light'],
  ['brutal', 'brand-light'],
])('transform answer compare, %s skin', (_skin, theme) => {
  beforeEach(() => {
    mockTheme = theme;
  });

  it('a wrong answer shows the own and the correct form', () => {
    run('Comi pann');
    expect(screen.getByTestId('answer-compare-typed')).toHaveTextContent('Comi pann');
    expect(screen.getByTestId('answer-compare-correct')).toHaveTextContent(/^Comí pan/);
  });

  it('with several accepted forms the nearest one is shown', () => {
    run('Yo comi pan');
    expect(screen.getByTestId('answer-compare-correct')).toHaveTextContent(/^Yo comí pan/);
  });

  it('a right answer has no comparison', () => {
    run('Comí pan.');
    expect(screen.queryByTestId('answer-compare-typed')).toBeNull();
  });
});
