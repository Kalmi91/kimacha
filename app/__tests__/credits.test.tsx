// PLAN-credits.md 2. lépés: a Credits képernyő rendereli a CEFR-J attribúciót, és a
// Settings-sor a Credits képernyőre navigál. PLAN-regi-szavak-ki 7. lépés: a
// FrequencyWords/OpenSubtitles/CC BY-SA szöveg a régi szólistával együtt kikerült.
// Mock-minta: app/mistakes/__tests__/report.test.tsx.

const mockPush = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, push: mockPush }),
}));

import { render } from '@testing-library/react-native';

import CreditsScreen from '../credits';

describe('CreditsScreen (app/credits.tsx)', () => {
  it('rendereli a CEFR-J szöveget, a FrequencyWords szöveg nélkül', () => {
    const { getAllByText, getByText, queryByText } = render(<CreditsScreen />);

    expect(getAllByText(/CEFR-J/).length).toBeGreaterThan(0);
    expect(getByText('github.com/openlanguageprofiles/olp-en-cefrj')).toBeTruthy();
    expect(queryByText(/FrequencyWords/)).toBeNull();
    expect(queryByText(/CC BY-SA/)).toBeNull();
  });
});
