// Card-level resume: if the app was closed in one practice (drill) of the lesson, the lesson opens in the same
// practice (the round continues from the saved run); on leaving the lesson the save is deleted.
// Mock pattern: drillButtons.test.tsx.

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

let mockTopicId = 'ser-estar';
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), push: jest.fn(), replace: jest.fn() }),
  usePathname: () => '/grammar',
  useFocusEffect: (cb: () => void) => {
    const { useEffect } = require('react');
    useEffect(cb, []);
  },
  useLocalSearchParams: () => ({ topic: mockTopicId }),
}));

import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { getDb } from '@/lib/database';
import { clearDrillResume, loadDrillResume, saveDrillResume } from '@/lib/drillResume';
import { RESUME_GAME_ID } from '@/lib/resumeRoute';
import { localDateString } from '@/lib/usageStats';
import GrammarLessonScreen from '../[topic]';

const flush = async (times = 8) => {
  for (let i = 0; i < times; i++) {
    await act(async () => {
      await Promise.resolve();
    });
  }
};

describe('grammar lesson screen: a bezáráskor nyitott gyakorlat újranyitáskor folytatódik (FB470)', () => {
  const today = localDateString();

  beforeEach(async () => {
    const db = getDb();
    await db.setOnboarding('en', 'es');
    (db as any).__setLevelForTest('A1');
    await db.resetGameProgress(RESUME_GAME_ID);
    mockTopicId = 'ser-estar';
  });

  it('mentés nélkül a lecke oldala nyílik (nem a gyakorlat)', async () => {
    render(<GrammarLessonScreen />);
    await flush();
    expect(screen.getByTestId('grammar-start-form')).toBeTruthy();
    expect(screen.queryByTestId('formInput')).toBeNull();
    // the lesson page does not write a save
    expect(await loadDrillResume(getDb())).toBeNull();
  });

  it('mentett gyakorlat (ma, ugyanez a lecke): a lecke a gyakorlatban nyílik, a mentés megmarad', async () => {
    await saveDrillResume(getDb(), { topicId: 'ser-estar', kind: 'form', day: today });
    render(<GrammarLessonScreen />);
    await flush();
    expect(screen.queryByTestId('grammar-start-form')).toBeNull();
    expect(screen.getByTestId('formInput')).toBeTruthy();
    expect(await loadDrillResume(getDb())).toEqual({ topicId: 'ser-estar', kind: 'form', day: today });
  });

  it('másik napról / másik leckéhez / nem kínált fajtához maradt mentés nem ugrik a gyakorlatba', async () => {
    for (const saved of [
      { topicId: 'ser-estar', kind: 'form', day: '2000-01-01' },
      { topicId: 'imperfecto', kind: 'form', day: today },
      { topicId: 'ser-estar', kind: 'nincs-ilyen', day: today },
    ]) {
      await saveDrillResume(getDb(), saved);
      const view = render(<GrammarLessonScreen />);
      await flush();
      expect(screen.queryByTestId('formInput')).toBeNull();
      expect(screen.getByTestId('grammar-start-form')).toBeTruthy();
      view.unmount();
      await flush();
    }
  });

  it('a gyakorlatot elindítva menti; a képernyőből kilépve törli', async () => {
    const view = render(<GrammarLessonScreen />);
    await flush();
    fireEvent.press(screen.getByTestId('grammar-start-form'));
    await flush();
    expect(await loadDrillResume(getDb())).toEqual({ topicId: 'ser-estar', kind: 'form', day: today });

    // leaving the screen (unmount): the save is deleted, and later the lesson does not jump into the drill from the list
    view.unmount();
    await flush();
    expect(await loadDrillResume(getDb())).toBeNull();
  });

  it('a törölt mentés nem hoz vissza gyakorlatot', async () => {
    await saveDrillResume(getDb(), { topicId: 'ser-estar', kind: 'form', day: today });
    await clearDrillResume(getDb());
    render(<GrammarLessonScreen />);
    await flush();
    expect(screen.queryByTestId('formInput')).toBeNull();
  });
});
