// D3 (FB290, 2026-09-17): a lecke-oldal fajtánként külön gombot ad, csak
// azokra a fajtákra, amikből ténylegesen van item a leckében.

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

// jest.mock factories may only touch variables prefixed with "mock".
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

import { act, render, screen, within } from '@testing-library/react-native';

import { getDb } from '@/lib/database.web';
import GrammarLessonScreen from '../[topic]';

const flush = async (times = 3) => {
  for (let i = 0; i < times; i++) {
    await act(async () => {
      await Promise.resolve();
    });
  }
};

describe('grammar lesson screen: per-kind drill buttons', () => {
  beforeEach(async () => {
    const db = getDb();
    await db.setOnboarding('hu', 'es');
    await db.updateLevel('A1', 0, 0, 0);
  });

  it('schema-2 lesson with all 3 kinds (ser-estar) shows 3 buttons with their own counts', async () => {
    mockTopicId = 'ser-estar';
    const view = render(<GrammarLessonScreen />);
    await flush(4);

    expect(within(screen.getByTestId('grammar-start-choice')).getByText(/\(12\)/)).toBeTruthy();
    expect(within(screen.getByTestId('grammar-start-match')).getByText(/\(1\)/)).toBeTruthy();
    expect(within(screen.getByTestId('grammar-start-form')).getByText(/\(12\)/)).toBeTruthy();

    view.unmount();
  });

  it('hay-estar has no form items, so no form button', async () => {
    mockTopicId = 'hay-estar';
    const view = render(<GrammarLessonScreen />);
    await flush(4);

    expect(screen.queryByTestId('grammar-start-choice')).toBeTruthy();
    expect(screen.queryByTestId('grammar-start-match')).toBeTruthy();
    expect(screen.queryByTestId('grammar-start-form')).toBeFalsy();

    view.unmount();
  });

  it('schema-1 lesson (posesivos) shows a single choice button', async () => {
    mockTopicId = 'posesivos';
    const view = render(<GrammarLessonScreen />);
    await flush(4);

    expect(screen.queryByTestId('grammar-start-choice')).toBeTruthy();
    expect(screen.queryByTestId('grammar-start-match')).toBeFalsy();
    expect(screen.queryByTestId('grammar-start-form')).toBeFalsy();

    view.unmount();
  });
});
