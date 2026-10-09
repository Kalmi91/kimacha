// The Credits screen renders the CEFR-J attribution, and the
// Settings row navigates to the Credits screen. The
// FrequencyWords/OpenSubtitles/CC BY-SA text was removed together with the old word list.
// Mock pattern: app/mistakes/__tests__/report.test.tsx.

const mockPush = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, push: mockPush }),
}));

import { Linking } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';

import CreditsScreen from '../credits';

describe('CreditsScreen (app/credits.tsx)', () => {
  it('renders the CEFR-J text, without the FrequencyWords text', () => {
    const { getAllByText, getByText, queryByText } = render(<CreditsScreen />);

    expect(getAllByText(/CEFR-J/).length).toBeGreaterThan(0);
    expect(getByText('github.com/openlanguageprofiles/olp-en-cefrj')).toBeTruthy();
    expect(queryByText(/FrequencyWords/)).toBeNull();
    expect(queryByText(/CC BY-SA/)).toBeNull();
  });

  it('lists the font licenses, once per family', () => {
    const { getAllByTestId, getByText } = render(<CreditsScreen />);

    // 28 font files, but Atkinson and Jost come in two weights: 26 families.
    expect(getAllByTestId('credits-font')).toHaveLength(26);
    expect(getByText('Permanent Marker · Apache License 2.0')).toBeTruthy();
    expect(getByText('OpenDyslexic · SIL Open Font License 1.1')).toBeTruthy();
  });

  it('Play prep: the Wikimedia Commons photo row and the Privacy policy row open the advertised URL', () => {
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    const { getByText, getByTestId } = render(<CreditsScreen />);

    expect(getByText(/Wikimedia Commons/)).toBeTruthy();
    expect(getByText('Privacy policy')).toBeTruthy();
    fireEvent.press(getByTestId('credits-privacy'));
    expect(openURL).toHaveBeenCalledWith('https://kalmi91.github.io/kimacha/privacy-policy.html');
    openURL.mockRestore();
  });
});
