// The 🗑️ (progress reset) was removed from the Learn header and
// moved into Settings (settingsReset.test.tsx). Mock pattern: pcicFocus.test.tsx.

jest.mock('@/lib/speech', () => require('@/test-utils/mocks').speechMock());

jest.mock('expo-router', () => require('@/test-utils/mocks').focusEffectRouterMock());

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, left: 0, right: 0, bottom: 0 }),
}));

const FIXTURE_ITEM = { id: 'b1-x1', es: 'vida', en: 'life', kind: 'word' as const, section: 'Test', order: 0 };
jest.mock('@/data/pcic', () => ({
  PCIC_LEVELS: ['B1'],
  PCIC_VIEW_LEVELS: ['B1'],
  pcicItemsForLevel: () => [FIXTURE_ITEM],
  findPcicItem: (id: string) => (id === 'b1-x1' ? FIXTURE_ITEM : undefined),
  setPcicTarget: () => {},
}));

import { render } from '@testing-library/react-native';

import { getDb } from '@/lib/database';
import PcicScreen from '../index';
import { makeFlush } from '@/test-utils/flush';

const flush = makeFlush(4);

describe('PCIC tab: no 🗑️ in the header', () => {
  it('the Learn header shows no reset button', async () => {
    await getDb().resetPcicCards();
    const { queryByText } = render(<PcicScreen />);
    await flush();

    expect(queryByText('🗑️')).toBeNull();
  });
});
