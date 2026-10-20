// on the indefinido-10-verbos table card the prompt is the English form ("I went"),
// not the bare "yo"; the Spanish infinitive ("ir") appears on the hint button.
// Mock pattern: tableDeckEnPrompt.play.test.tsx.

jest.mock('expo-speech', () => ({
  speak: jest.fn(),
  stop: jest.fn(),
  getAvailableVoicesAsync: jest.fn(async () => []),
}));
jest.mock('@/lib/speech', () => require('@/test-utils/mocks').speechMock());
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, left: 0, right: 0, bottom: 0 }),
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), push: jest.fn(), replace: jest.fn() }),
  useLocalSearchParams: () => ({ topic: 'indefinido-10-verbos' }),
}));

import { fireEvent, render, screen } from '@testing-library/react-native';

import { getDb } from '@/lib/database.web';
import { lessonFor } from '@/lib/grammar/syllabus';
import { tableCellsForLesson } from '@/lib/grammar/tableDeck';
import TableDeckScreen from '../[topic]';
import { makeFlush } from '@/test-utils/flush';

const flush = makeFlush(3);

const cells = tableCellsForLesson(lessonFor('es', 'indefinido-10-verbos')!);

describe('indefinido-10-verbos table deck: English prompt', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    const db = getDb();
    await db.setOnboarding('en', 'es');
    (db as any).__setLevelForTest('A1');
  });

  it('every cell has its own English prompt, and yo + ir is "I went"', () => {
    expect(cells).toHaveLength(50);
    expect(cells.every((c) => typeof c.enPrompt === 'string' && c.enPrompt.length > 0)).toBe(true);
    expect(new Set(cells.map((c) => c.enPrompt)).size).toBe(cells.length);
    expect(cells.find((c) => c.verb === 'ir' && c.person === 'yo')?.enPrompt).toBe('I went');
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
