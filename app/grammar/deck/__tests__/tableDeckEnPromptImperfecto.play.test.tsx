// on the imperfecto's table card the prompt is the English form ("I used to speak"), not the bare
// "yo"; the Spanish infinitive ("hablar") appears on the hint button.
// Mock pattern: tableDeckEnPromptInd10.play.test.tsx.

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
  useLocalSearchParams: () => ({ topic: 'imperfecto' }),
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

const cells = tableCellsForLesson(lessonFor('es', 'imperfecto')!);

describe('imperfecto table deck: English prompt', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    const db = getDb();
    await db.setOnboarding('en', 'es');
    (db as any).__setLevelForTest('A2');
  });

  it('every cell has an English prompt', () => {
    expect(cells).toHaveLength(30);
    expect(cells.every((c) => typeof c.enPrompt === 'string' && c.enPrompt.length > 0)).toBe(true);
    expect(cells.find((c) => c.verb === 'hablar' && c.person === 'yo')?.enPrompt).toBe('I used to speak');
  });

  it('shows the English form as the prompt and the infinitive only after the help button', async () => {
    render(<TableDeckScreen />);
    await flush();

    const first = cells.find((c) => screen.queryByText(c.enPrompt!) !== null);
    expect(first).toBeTruthy();
    expect(screen.queryByText(first!.verb)).toBeNull();
    expect(screen.queryByText(first!.person)).toBeNull();
    fireEvent.press(screen.getByTestId('tabledeck-hint'));
    expect(screen.getByText(first!.verb)).toBeTruthy();
  });
});
