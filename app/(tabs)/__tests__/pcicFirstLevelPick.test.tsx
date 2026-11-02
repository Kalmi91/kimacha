// A pair with no saved level shows the fallback default (A1 for the -en / -hu targets, B1 otherwise) in
// the header; choosing exactly that level in the auto-opened picker must still write the learn_settings
// row, otherwise the picker reopens on every cold start. Mock pattern: pcicLevelPicker.test.tsx.

jest.mock('@/lib/speech', () => require('@/test-utils/mocks').speechMock());

jest.mock('expo-router', () => require('@/test-utils/mocks').focusEffectRouterMock());

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, left: 0, right: 0, bottom: 0 }),
}));

const A1_ITEM = { id: 'a1-w1', es: 'hola', en: 'hello', kind: 'word' as const, section: 'Test', order: 0 };
const B1_ITEM = { id: 'b1-w1', es: 'vida', en: 'life', kind: 'word' as const, section: 'Test', order: 0 };
const ITEMS_BY_LEVEL: Record<string, typeof A1_ITEM[]> = { A1: [A1_ITEM], B1: [B1_ITEM] };
jest.mock('@/data/pcic', () => ({
  PCIC_LEVELS: ['A1', 'B1'],
  PCIC_VIEW_LEVELS: ['A1', 'B1'],
  pcicItemsForLevel: (level: string) => ITEMS_BY_LEVEL[level] ?? [],
  findPcicItem: (id: string) => [A1_ITEM, B1_ITEM].find((i) => i.id === id),
  levelOfItem: (id: string) => (id === A1_ITEM.id ? 'A1' : id === B1_ITEM.id ? 'B1' : undefined),
  setPcicTarget: () => {},
}));

import { fireEvent, render } from '@testing-library/react-native';

import { getDb } from '@/lib/database';
import PcicScreen from '../index';
import { makeFlush } from '@/test-utils/flush';

const flush = makeFlush(4);

describe('PCIC tab: first level pick on a pair with no saved level', () => {
  // [source, target, fallback level shown before any choice, its label in the sheet]
  it.each([
    ['es', 'hu', 'A1', 'Beginner'],
    ['en', 'hu', 'A1', 'Beginner'],
    ['es', 'en', 'A1', 'Beginner'],
    ['en', 'es', 'B1', 'Intermediate'],
  ])('%s→%s: choosing the fallback level %s writes the row, reopening does not show the picker', async (source, target, level, label) => {
    await getDb().setOnboarding(source, target);
    expect(await getDb().hasPcicLevel()).toBe(false);

    const first = render(<PcicScreen />);
    await flush();
    expect(first.getByText('Choose level')).toBeTruthy();

    fireEvent.press(first.getByText(label));
    await flush();

    expect(await getDb().hasPcicLevel()).toBe(true);
    expect(await getDb().getPcicLevel()).toBe(level);

    first.unmount();
    const second = render(<PcicScreen />);
    await flush();
    expect(second.queryByText('Choose level')).toBeNull();
  });
});
