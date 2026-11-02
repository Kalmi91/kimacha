// The placement test for a learner of German, on the real German deck (data/words/de) and the real question builder: the words
// asked are German headwords with the learner's own language as the four answers, the grammar questions are the authored bank
// (German has no grammar lessons wired yet), and the ladder ends in a suggested level like in the other directions.
// The ladder and the saving: app/__tests__/placement.test.tsx.

const mockBack = jest.fn();
const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, replace: mockReplace, push: jest.fn() }),
}));

import { fireEvent, render } from '@testing-library/react-native';

import { setPcicTarget } from '@/data/pcic';
import { getDb } from '@/lib/database';
import { LearnerProvider, LearnerStore } from '@/lib/learner';
import PlacementScreen from '../placement';
import { makeFlush } from '@/test-utils/flush';

jest.setTimeout(30000);

const flush = makeFlush(8);

type Screen = ReturnType<typeof render>;

afterAll(() => setPcicTarget('es'));

describe('PlacementScreen: German deck', () => {
  beforeEach(async () => {
    mockBack.mockClear();
    mockReplace.mockClear();
    setPcicTarget('de', 'en');
    await getDb().setOnboarding('en', 'de');
  });

  it('asks German words with four English answers and a bank gap sentence in turn, and ends in a suggested level', async () => {
    // the app root loads the direction before the tree mounts (the screen builds its questions on the first render)
    const store = new LearnerStore();
    await store.refresh(['direction']);
    const screen: Screen = render(
      <LearnerProvider store={store}>
        <PlacementScreen />
      </LearnerProvider>,
    );
    await flush();

    const seen: string[] = [];
    for (let n = 0; n < 40 && screen.queryByTestId('placement-dont-know'); n++) {
      const text = String(screen.getByTestId('placement-text').props.children);
      seen.push(text);
      for (const i of [0, 1, 2, 3]) expect(screen.getByTestId(`placement-option-${i}`)).toBeTruthy();
      fireEvent.press(screen.getByTestId('placement-dont-know'));
      await flush();
    }

    // the questions alternate word, grammar, word, grammar, word: a word question names a German headword, a gap one has a blank
    expect(seen.length).toBeGreaterThanOrEqual(5);
    expect(seen.slice(0, 5).map((text) => /___/.test(text))).toEqual([false, true, false, true, false]);
    for (const text of seen.filter((s) => !s.includes('___'))) expect(text).toMatch(/^What does «.+» mean\?$/);
    expect(seen.filter((s) => s.includes('___')).every((s) => /[A-Za-zÄÖÜäöüß]/.test(s))).toBe(true);
    expect(screen.getByTestId('placement-result').props.children).toBe('Suggested start: A1');
  });
});
