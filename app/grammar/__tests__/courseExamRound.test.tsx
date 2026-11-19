// The exam round entry on the Grammar tab: under the A1 lesson list, for a Spanish and an English course, in both skins;
// not on A2 and not while searching. Mock pattern: courseLevelTabs.test.tsx.

jest.mock('expo-speech', () => ({
  speak: jest.fn(),
  stop: jest.fn(),
  getAvailableVoicesAsync: jest.fn(async () => []),
}));
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), push: mockPush }),
  usePathname: () => '/grammar',
  useFocusEffect: (cb: () => void) => {
    const { useEffect } = require('react');
    useEffect(cb, []);
  },
}));

import { fireEvent, render, screen } from '@testing-library/react-native';

import { getDb } from '@/lib/database.web';
import { bigTestResultKey, bigTestRunKey } from '@/lib/grammar/bigTest';
import { grammarTabLevelKey } from '@/lib/grammar/levelTestRoute';
import { saveResumeValue } from '@/lib/resumeStore';
import GrammarSyllabusScreen from '@/app/(tabs)/course';
import { ThemeProvider } from '@/lib/ThemeContext';
import { makeFlush } from '@/test-utils/flush';

const flush = makeFlush(8);

describe.each([
  ['neo-brutalist', 'brand'],
  ['classic', 'classic'],
] as const)('exam round entry on the grammar tab (%s list)', (_name, palette) => {
  describe.each([
    ['es', 'en'],
    ['en', 'es'],
  ] as const)('learned language %s', (learned, content) => {
    const pair = `${content}→${learned}`;
    beforeEach(async () => {
      mockPush.mockClear();
      const db = getDb();
      await db.setOnboarding(content, learned);
      (db as any).__setLevelForTest('A1');
      await db.setGrammarPalette(palette);
      await saveResumeValue(db, bigTestRunKey(pair), null);
      await saveResumeValue(db, bigTestResultKey(pair), null);
      await saveResumeValue(db, grammarTabLevelKey(pair), null);
    });
    afterAll(async () => {
      const db = getDb();
      await db.setOnboarding('en', 'es');
      await saveResumeValue(db, grammarTabLevelKey(pair), null);
    });

    const open = async () => {
      render(
        <ThemeProvider>
          <GrammarSyllabusScreen />
        </ThemeProvider>
      );
      await flush();
    };

    it('shows the button under the A1 lessons and opens the exam round route', async () => {
      await open();
      fireEvent.press(screen.getByTestId('grammar-exam-round-A1'));
      expect(mockPush).toHaveBeenCalledWith('/grammar/exam-round?level=A1');
    });

    it('is not there on A2', async () => {
      await open();
      fireEvent.press(screen.getByTestId('grammar-level-A2'));
      await flush();
      expect(screen.queryByTestId('grammar-exam-round-A1')).toBeNull();
      expect(screen.queryByTestId('grammar-exam-round-A2')).toBeNull();
    });

    it('is not there while searching', async () => {
      await open();
      fireEvent.changeText(screen.getByTestId('grammar-search-input'), 'a');
      await flush();
      expect(screen.queryByTestId('grammar-exam-round-A1')).toBeNull();
    });
  });
});
