// FB621/FB622/FB623/FB634 on the Learn card: the (i) with the answer in its text waits for Check; a word card
// without a hint shows its English sentence on the question side. Mock pattern: pcicNote.test.tsx.

jest.mock('@/lib/speech', () => require('@/test-utils/mocks').speechMock());

jest.mock('expo-router', () => require('@/test-utils/mocks').focusEffectRouterMock());

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, left: 0, right: 0, bottom: 0 }),
}));

jest.mock('@/data/pcic', () => {
  const items = [
    { id: 'o9101', es: 'la barriga', en: 'belly', kind: 'word', section: '', order: 9101, note: 'La barriga is the belly.', exampleEn: 'My belly hurts.', exampleEs: 'Me duele la barriga.' },
  ];
  return {
    PCIC_LEVELS: ['B1'],
    PCIC_VIEW_LEVELS: ['B1'],
    pcicItemsForLevel: () => items,
    levelOfItem: () => 'A1',
    findPcicItem: (id: string) => items.find((i) => i.id === id),
    setPcicTarget: () => {},
  };
});

import { fireEvent, render } from '@testing-library/react-native';
import { TextInput } from 'react-native';

import { getDb } from '@/lib/database';
import PcicScreen from '../index';
import { makeFlush } from '@/test-utils/flush';

const flush = makeFlush(4);

describe('Learn card: (i) gate and question sentence', () => {
  beforeEach(async () => {
    await getDb().resetPcicCards();
    jest.spyOn(TextInput.prototype, 'focus').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('shows the English sentence on the question side', async () => {
    const utils = render(<PcicScreen />);
    await flush();
    expect(utils.getByTestId('learn-question-sentence')).toBeTruthy();
    expect(utils.getByText('My belly hurts.')).toBeTruthy();
  });

  it('hides the (i) whose note has the answer until Check, then shows it', async () => {
    const utils = render(<PcicScreen />);
    await flush();
    expect(utils.queryByTestId('learn-info')).toBeNull();

    fireEvent.changeText(utils.UNSAFE_getByType(TextInput), 'la barriga');
    fireEvent.press(utils.getByText('✓ Check'));
    await flush();
    expect(utils.getByTestId('learn-info')).toBeTruthy();
  });
});
