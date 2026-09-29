// PLAN-credits.md 2. lépés: a Credits képernyő rendereli a FrequencyWords
// attribúciót, és a Settings-sor a Credits képernyőre navigál.
// Mock-minta: app/mistakes/__tests__/report.test.tsx.

const mockPush = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, push: mockPush }),
}));

import { render } from '@testing-library/react-native';

import CreditsScreen from '../credits';

describe('CreditsScreen (app/credits.tsx)', () => {
  it('rendereli a FrequencyWords és a CC BY-SA 4.0 szöveget', () => {
    const { getAllByText, getByText } = render(<CreditsScreen />);

    expect(getAllByText(/FrequencyWords/).length).toBeGreaterThan(0);
    expect(getAllByText(/CC BY-SA 4.0/).length).toBeGreaterThan(0);
    expect(getByText('github.com/hermitdave/FrequencyWords')).toBeTruthy();
    expect(getByText('opus.nlpl.eu')).toBeTruthy();
    expect(getByText('creativecommons.org/licenses/by-sa/4.0')).toBeTruthy();
    expect(getAllByText(/CEFR-J/).length).toBeGreaterThan(0);
    expect(getByText('github.com/openlanguageprofiles/olp-en-cefrj')).toBeTruthy();
  });
});
