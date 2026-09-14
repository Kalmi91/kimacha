import { render, fireEvent } from '@testing-library/react-native';
import LearnChrome from '../LearnChrome';
import { t } from '@/lib/i18n';

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
  black: 0,
  blue: 0,
  pink: 0,
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

  it('never runs the slice past the blue fill', () => {
    const { getByTestId } = render(<LearnChrome {...base} known={10} reviewLeft={10} />);
    const style = getByTestId('reviewFill').props.style.find((s: any) => s?.width);
    expect(style.width).toBe('10%');
    expect(style.left).toBe('0%');
  });
});

// UTEMEZO 6. szakasz: three plain numbers in the header, no badge, no emoji.
describe('LearnChrome head numbers', () => {
  it('renders the spec example round (15 / 0 / 87)', () => {
    const { getByTestId } = render(
      <LearnChrome {...base} known={50} reviewLeft={87} black={15} blue={0} pink={87} />,
    );
    expect(getByTestId('headBlack').props.children).toBe(15);
    expect(getByTestId('headBlue').props.children).toBe(0);
    expect(getByTestId('headPink').props.children).toBe(87);
  });

  it('opens the explanation window on tap', () => {
    const { getByTestId, getByText } = render(
      <LearnChrome {...base} known={50} reviewLeft={0} black={15} blue={0} pink={87} />,
    );
    fireEvent.press(getByTestId('headerHelp'));
    expect(getByText(t().header.title)).toBeTruthy();
  });
});
