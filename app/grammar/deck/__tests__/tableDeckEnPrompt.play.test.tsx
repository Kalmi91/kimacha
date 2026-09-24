// FB378 ("Practice the table" with an English prompt): on a lesson whose
// conjugation tables carry `enPrompt`, the deck screen shows the English
// sentence as the main prompt and the infinitive underneath, instead of the
// bare "person · verb" caption. Mock pattern from tableDeck.play.test.tsx.

jest.mock('@/lib/database', () => jest.requireActual('@/lib/database.web'));
jest.mock('expo-speech', () => ({
  speak: jest.fn(),
  stop: jest.fn(),
  getAvailableVoicesAsync: jest.fn(async () => []),
}));
jest.mock('@/lib/speech', () => ({
  speak: jest.fn(),
  speakSequence: jest.fn(),
  stopSpeaking: jest.fn(),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, left: 0, right: 0, bottom: 0 }),
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), push: jest.fn(), replace: jest.fn() }),
  useLocalSearchParams: () => ({ topic: 'indefinido-regular' }),
}));

import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { getDb } from '@/lib/database.web';
import { lessonFor } from '@/lib/grammar/syllabus';
import { tableCellsForLesson } from '@/lib/grammar/tableDeck';
import TableDeckScreen from '../[topic]';

const flush = async (times = 3) => {
  for (let i = 0; i < times; i++) {
    await act(async () => {
      await Promise.resolve();
    });
  }
};

const cells = tableCellsForLesson(lessonFor('es', 'indefinido-regular')!);

describe('table-deck screen: enPrompt (FB378)', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    const db = getDb();
    await db.setOnboarding('en', 'es');
    (db as any).__setLevelForTest('A1');
  });

  it('every cell in this lesson has an English prompt', () => {
    // Both indefinido-regular conjugation tables are fully filled in
    // (FB378b/c), so this also proves the fixture is meaningful: whichever
    // cell the (now shuffled, FB377) deck shows first will have one.
    expect(cells.length).toBeGreaterThan(0);
    expect(cells.every((c) => typeof c.enPrompt === 'string' && c.enPrompt.length > 0)).toBe(true);
  });

  it('shows the English sentence as the prompt, the infinitive underneath, and the "translate" caption', async () => {
    render(<TableDeckScreen />);
    await flush();

    const first = cells.find((c) => screen.queryByText(c.enPrompt!) !== null);
    expect(first).toBeTruthy();
    expect(screen.getByText('translate to Spanish')).toBeTruthy();
    expect(screen.getByText(first!.verb)).toBeTruthy();
    // The old bare caption/prompt style is not used for an enPrompt cell.
    expect(screen.queryByText('person · verb')).toBeNull();
    expect(screen.queryByText(`${first!.person} · ${first!.verb}`)).toBeNull();
  });

  it('still accepts the correct Spanish answer for an English-prompt cell', async () => {
    render(<TableDeckScreen />);
    await flush();

    const first = cells.find((c) => screen.queryByText(c.enPrompt!) !== null)!;
    fireEvent.changeText(screen.getByTestId('tabledeck-input'), first.answer);
    fireEvent.press(screen.getByText('✓ Check'));
    await flush();
    expect(screen.getByText(`✓ ${first.answer}`)).toBeTruthy();
  });
});
