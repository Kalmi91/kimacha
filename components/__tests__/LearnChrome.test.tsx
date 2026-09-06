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
  reviewBatchSize: 0,
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

  // FB171: the pink number beside the 🌱 badge counts the same words as the slice.
  it('shows the pink review count while words are due', () => {
    const { getByTestId } = render(<LearnChrome {...base} known={50} reviewLeft={12} />);
    expect(getByTestId('reviewCount').props.children).toBe('🔁12');
  });

  it('hides the review count at zero', () => {
    const { queryByTestId } = render(<LearnChrome {...base} known={50} reviewLeft={0} />);
    expect(queryByTestId('reviewCount')).toBeNull();
  });

  // FB174/FB175: one batch is in the queue, the line under it multiplies the rest.
  it('says how many batches are still due, without repeating the size', () => {
    const { getByTestId } = render(
      <LearnChrome {...base} known={200} reviewLeft={30} reviewBatchSize={30} reviewBatchesLeft={3} />,
    );
    expect(getByTestId('reviewBatches').props.children).toBe('×3');
  });

  it('hides the batch line when this queue is the last one', () => {
    const { queryByTestId } = render(
      <LearnChrome {...base} known={200} reviewLeft={12} reviewBatchSize={12} reviewBatchesLeft={0} />,
    );
    expect(queryByTestId('reviewBatches')).toBeNull();
  });

  it('never runs the slice past the blue fill', () => {
    const { getByTestId } = render(<LearnChrome {...base} known={10} reviewLeft={10} />);
    const style = getByTestId('reviewFill').props.style.find((s: any) => s?.width);
    expect(style.width).toBe('10%');
    expect(style.left).toBe('0%');
  });
});
