import { render } from '@testing-library/react-native';
import ProgressMeter from '../ProgressMeter';

// Isolate the component from i18n state: t() returns just the strings it reads.
jest.mock('@/lib/i18n', () => ({
  t: () => ({ progress: { wordsKnown: 'words known' } }),
}));

describe('ProgressMeter', () => {
  it('renders the known/total count and computed percentage', () => {
    const { getByText } = render(
      <ProgressMeter known={3} total={10} langFlag="🇪🇸" langName="Español" />,
    );
    expect(getByText('3 / 10')).toBeTruthy();
    // 3/10 → 30%
    expect(getByText(/Español · 30%/)).toBeTruthy();
  });

  it('caps the percentage at 100 when known exceeds total', () => {
    const { getByText } = render(
      <ProgressMeter known={50} total={10} langFlag="🇩🇪" langName="Deutsch" />,
    );
    expect(getByText(/Deutsch · 100%/)).toBeTruthy();
  });

  it('does not divide by zero when total is 0', () => {
    const { getByText } = render(
      <ProgressMeter known={0} total={0} langFlag="🇬🇧" langName="English" />,
    );
    expect(getByText(/English · 0%/)).toBeTruthy();
  });
});
