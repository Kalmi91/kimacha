// FB461 / FB462 / FB464 (PLAN-fb1002b 3. lépés), Kálmán: „tegyed be a check gombot a klaviatúra felé, ahogy
// a kártyáknál van", „csináld meg, hogy a check gomb mindenhol a klaviatúra felett legyen".
// A nyelvtani drill beírós tételeinek (ragozás, átírás) Check gombja a szókártyával azonos, a képernyő
// aljára dokkolt sáv (learn-dock, a billentyűzet felső élén), és a Check után ugyanott a Next jön.

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(cb, []);
  },
  useLocalSearchParams: () => ({ topic: mockTopicId }),
}));

import { DeviceEventEmitter, StyleSheet } from 'react-native';
import { act, fireEvent, render, screen, within } from '@testing-library/react-native';

import { getDb } from '@/lib/database.web';
import GrammarLessonScreen from '../[topic]';

const flush = async (times = 3) => {
  for (let i = 0; i < times; i++) {
    await act(async () => {
      await Promise.resolve();
    });
  }
};

async function openKind(topic: string, kind: string) {
  mockTopicId = topic;
  const db = getDb();
  await db.setOnboarding('en', 'es');
  (db as any).__setLevelForTest('A1');
  render(<GrammarLessonScreen />);
  await flush(4);
  fireEvent.press(screen.getByTestId(`grammar-start-${kind}`));
  await flush(1);
}

const dockBottom = () => StyleSheet.flatten(screen.getByTestId('learn-dock').props.style).bottom;

describe('nyelvtani drill: a Check gomb a billentyűzet fölé dokkol (FB461, FB462, FB464)', () => {
  it('ragozás (form): a Check a dokkolt sávon van, nincs másik inline Check, a Check után ugyanott a Next', async () => {
    await openKind('ser-estar', 'form');

    expect(within(screen.getByTestId('learn-dock')).getByTestId('formCheck')).toBeTruthy();
    expect(screen.getAllByTestId('formCheck')).toHaveLength(1);

    fireEvent.changeText(screen.getByTestId('formInput'), 'soy');
    fireEvent.press(within(screen.getByTestId('learn-dock')).getByTestId('formCheck'));
    await flush(1);

    expect(screen.queryByTestId('formCheck')).toBeNull();
    expect(within(screen.getByTestId('learn-dock')).getByTestId('grammar-next')).toBeTruthy();
    expect(screen.getAllByTestId('grammar-next')).toHaveLength(1);

    // a Next a következő tételre lép, és a sáv újra Check
    fireEvent.press(within(screen.getByTestId('learn-dock')).getByTestId('grammar-next'));
    await flush(1);
    expect(within(screen.getByTestId('learn-dock')).getByTestId('formCheck')).toBeTruthy();
  });

  it('átírás (transform): a Check a dokkolt sávon van, a Check után ugyanott a Next', async () => {
    await openKind('indefinido-10-verbos', 'transform');

    expect(within(screen.getByTestId('learn-dock')).getByTestId('transform-check')).toBeTruthy();
    expect(screen.getAllByTestId('transform-check')).toHaveLength(1);

    fireEvent.changeText(screen.getByTestId('transform-input'), 'xxx');
    fireEvent.press(within(screen.getByTestId('learn-dock')).getByTestId('transform-check'));
    await flush(1);

    expect(screen.queryByTestId('transform-check')).toBeNull();
    expect(within(screen.getByTestId('learn-dock')).getByTestId('transform-next')).toBeTruthy();
    expect(screen.getAllByTestId('transform-next')).toHaveLength(1);
  });

  it('a sáv a billentyűzet felső élére emelkedik, és a billentyűzet nélkül a képernyő aljára ér vissza', async () => {
    await openKind('ser-estar', 'form');
    expect(dockBottom()).toBe(0);

    act(() => {
      DeviceEventEmitter.emit('keyboardDidShow', { endCoordinates: { height: 300 } });
    });
    expect(dockBottom()).toBe(300);

    act(() => {
      DeviceEventEmitter.emit('keyboardDidHide', {});
    });
    expect(dockBottom()).toBe(0);
  });
});
