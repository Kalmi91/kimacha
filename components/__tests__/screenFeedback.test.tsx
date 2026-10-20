// The 💬 button is drawn once by the screen frame; the screens only name their card (lib/screenFeedback.tsx).
// The real button is replaced by a text line so the test sees how many are drawn and with which card.
import { render } from '@testing-library/react-native';

import ScreenFeedback, { ScreenFeedbackFrame } from '@/lib/screenFeedback';

jest.mock('@/components/FeedbackModal', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: (p: { currentCard: string; placement?: string; bottomOffset?: number }) => (
      <Text testID="fb">{`${p.placement ?? 'fab'} | ${p.currentCard} | ${p.bottomOffset ?? '-'}`}</Text>
    ),
  };
});

const card = (currentCard: string, extra: { placement?: 'header' | 'inline'; bottomOffset?: number } = {}) => (
  <ScreenFeedback level="A1" languagePair="en→es" currentCard={currentCard} {...extra} />
);
const shown = (r: ReturnType<typeof render>) => r.queryAllByTestId('fb').map((n) => n.props.children);

describe('screen feedback frame', () => {
  it('draws one button for the card a screen names, and follows the card when it changes', () => {
    const r = render(<ScreenFeedbackFrame>{card('a:1', { bottomOffset: 40 })}</ScreenFeedbackFrame>);
    expect(shown(r)).toEqual(['fab | a:1 | 40']);
    r.rerender(<ScreenFeedbackFrame>{card('a:2')}</ScreenFeedbackFrame>);
    expect(shown(r)).toEqual(['fab | a:2 | -']);
  });

  it('a screen opened over another (nested stack) takes the button, and gives it back when it closes', () => {
    const r = render(<ScreenFeedbackFrame>{card('lesson')}</ScreenFeedbackFrame>);
    r.rerender(
      <ScreenFeedbackFrame>
        {card('lesson')}
        {card('deck')}
      </ScreenFeedbackFrame>,
    );
    expect(shown(r)).toEqual(['fab | deck | -']);
    r.rerender(<ScreenFeedbackFrame>{card('lesson')}</ScreenFeedbackFrame>);
    expect(shown(r)).toEqual(['fab | lesson | -']);
  });

  it('a screen that unmounts takes its button with it', () => {
    const r = render(<ScreenFeedbackFrame>{card('a:1')}</ScreenFeedbackFrame>);
    r.rerender(<ScreenFeedbackFrame>{null}</ScreenFeedbackFrame>);
    expect(shown(r)).toEqual([]);
  });

  it('an inline button stays in the screen row, the frame draws no second one', () => {
    const r = render(<ScreenFeedbackFrame>{card('pcic', { placement: 'inline' })}</ScreenFeedbackFrame>);
    expect(shown(r)).toEqual(['inline | pcic | -']);
  });

  it('without a frame (a screen rendered bare) the button is drawn in place', () => {
    const r = render(card('bare', { placement: 'header' }));
    expect(shown(r)).toEqual(['header | bare | -']);
  });
});
