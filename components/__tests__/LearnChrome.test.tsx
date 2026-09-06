import { render } from '@testing-library/react-native';
import LearnChrome from '../LearnChrome';

jest.mock('@/lib/ThemeContext', () => ({
  useTheme: () => ({ theme: 'light' }),
}));

const base = {
  level: 'A1',
  topicIcon: null,
  topicName: null,
  onTopicPress: () => {},
  total: 100,
  langFlag: '🇪🇸',
  langName: 'Español',
  newWordsLeft: 5,
  newWordsPaused: false,
  batchLeft: 0,
  reviewBatchesLeft: 0,
  examUnlocked: false,
  onExamPress: () => {},
  examLabel: 'exam',
  toast: null,
};

// FB169: the pink slice is cut out of the blue fill, so it sits at the fill's
// right edge and never makes the bar longer than the mastery percentage.
describe('LearnChrome review slice', () => {
  it('shows no pink slice when nothing is due', () => {
    const { queryByTestId } = render(<LearnChrome {...base} known={50} reviewLeft={0} />);
    expect(queryByTestId('reviewFill')).toBeNull();
  });

  it('sizes the slice by the review share of the known words', () => {
    // known 50 of 100 → 50% blue; 10 of those 50 are due → a fifth of the blue.
    const { getByTestId } = render(<LearnChrome {...base} known={50} reviewLeft={10} />);
    const style = getByTestId('reviewFill').props.style.find((s: any) => s?.width);
    expect(style.width).toBe('10%');
    expect(style.left).toBe('40%');
  });

  it('keeps a hairline share visible on a large deck', () => {
    // 1 due word out of 400 known would round to 0.25% of the bar.
    const { getByTestId } = render(
      <LearnChrome {...base} known={400} total={400} reviewLeft={1} />,
    );
    const style = getByTestId('reviewFill').props.style.find((s: any) => s?.width);
    expect(style.width).toBe('3%');
    expect(style.left).toBe('97%');
  });

  // FB171/FB179: the pink badge counts what is left of the CURRENT batch, and on the
  // last batch it is the number alone.
  it('shows the batch count alone on the last batch', () => {
    const { getByTestId } = render(<LearnChrome {...base} known={50} reviewLeft={12} batchLeft={12} />);
    expect(getByTestId('reviewCount').props.children).toBe('🔁12');
  });

  it('hides the review badge when the batch is empty', () => {
    const { queryByTestId } = render(<LearnChrome {...base} known={50} reviewLeft={0} batchLeft={0} />);
    expect(queryByTestId('reviewCount')).toBeNull();
  });

  // FB179: batch count and multiplier on one line, "32×4".
  it('multiplies the batch count while further batches are waiting', () => {
    const { getByTestId } = render(
      <LearnChrome {...base} known={200} reviewLeft={145} batchLeft={32} reviewBatchesLeft={4} />,
    );
    expect(getByTestId('reviewCount').props.children).toBe('🔁32×4');
  });

  // FB177: the pink tail follows the whole day's pile, not the batch in the badge.
  it('sizes the slice from the day total, not the batch', () => {
    const { getByTestId } = render(
      <LearnChrome {...base} known={200} total={200} reviewLeft={50} batchLeft={32} reviewBatchesLeft={1} />,
    );
    const style = getByTestId('reviewFill').props.style.find((s: any) => s?.width);
    expect(style.width).toBe('25%');
  });

  it('never runs the slice past the blue fill', () => {
    const { getByTestId } = render(<LearnChrome {...base} known={10} reviewLeft={10} />);
    const style = getByTestId('reviewFill').props.style.find((s: any) => s?.width);
    expect(style.width).toBe('10%');
    expect(style.left).toBe('0%');
  });
});
