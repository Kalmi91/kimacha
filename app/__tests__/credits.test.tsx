// a Credits képernyő rendereli a CEFR-J attribúciót, és a
// Settings-sor a Credits képernyőre navigál. A
// FrequencyWords/OpenSubtitles/CC BY-SA szöveg a régi szólistával együtt kikerült.
// Mock-minta: app/mistakes/__tests__/report.test.tsx.

const mockPush = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, push: mockPush }),
}));

import { Linking } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';

import CreditsScreen from '../credits';

describe('CreditsScreen (app/credits.tsx)', () => {
  it('rendereli a CEFR-J szöveget, a FrequencyWords szöveg nélkül', () => {
    const { getAllByText, getByText, queryByText } = render(<CreditsScreen />);

    expect(getAllByText(/CEFR-J/).length).toBeGreaterThan(0);
    expect(getByText('github.com/openlanguageprofiles/olp-en-cefrj')).toBeTruthy();
    expect(queryByText(/FrequencyWords/)).toBeNull();
    expect(queryByText(/CC BY-SA/)).toBeNull();
  });

  it('PLAN-temak 2B: listázza a betűk licencét, családonként egyszer', () => {
    const { getAllByTestId, getByText } = render(<CreditsScreen />);

    // 28 betűfájl, de az Atkinson és a Jost két súllyal: 26 család.
    expect(getAllByTestId('credits-font')).toHaveLength(26);
    expect(getByText('Permanent Marker · Apache License 2.0')).toBeTruthy();
    expect(getByText('OpenDyslexic · SIL Open Font License 1.1')).toBeTruthy();
  });

  it('Play-előkészítés: a Wikimedia Commons fotó-sor és az Adatvédelmi tájékoztató sor megnyitja a hirdetett URL-t', () => {
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    const { getByText, getByTestId } = render(<CreditsScreen />);

    expect(getByText(/Wikimedia Commons/)).toBeTruthy();
    expect(getByText('Privacy policy')).toBeTruthy();
    fireEvent.press(getByTestId('credits-privacy'));
    expect(openURL).toHaveBeenCalledWith('https://kalmi91.github.io/kimacha/privacy-policy.html');
    openURL.mockRestore();
  });
});
