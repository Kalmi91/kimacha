// a PCIC beviteli mező minden új kártyánál
// ÚJRA mountol és autoFocus-szal indul, mert a Check után letiltott
// (editable=false), majd újra engedélyezett natív mező nem hozta fel megbízhatóan
// a billentyűzetet, és a törlés sem működött rajta.

jest.mock('@/lib/database', () => jest.requireActual('@/lib/database.web'));
jest.mock('@/lib/speech', () => ({
  speak: jest.fn(),
  speakSequence: jest.fn(),
  stopSpeaking: jest.fn(),
}));

jest.mock('expo-router', () => ({
  useFocusEffect: (cb: () => void) => {
    const { useEffect } = require('react');
    useEffect(cb, []);
  },
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, left: 0, right: 0, bottom: 0 }),
}));

const ITEMS = [
  { id: 'b1-x1', es: 'vida', en: 'life', kind: 'word' as const, section: 'Test', order: 0 },
  { id: 'b1-x2', es: 'mesa', en: 'table', kind: 'word' as const, section: 'Test', order: 1 },
];
jest.mock('@/data/pcic', () => ({
  PCIC_LEVELS: ['B1'],
  PCIC_VIEW_LEVELS: ['B1'],
  pcicItemsForLevel: () => ITEMS,
  findPcicItem: (id: string) => ITEMS.find((i) => i.id === id),
  setPcicTarget: () => {},
}));

import { act, fireEvent, render } from '@testing-library/react-native';
import { TextInput } from 'react-native';

import { getDb } from '@/lib/database';
import PcicScreen from '../index';

const flush = async (times = 4) => {
  for (let i = 0; i < times; i++) {
    await act(async () => {
      await Promise.resolve();
    });
  }
};

describe('PCIC fül: friss beviteli mező minden új kártyánál (FB408, FB409)', () => {
  beforeEach(async () => {
    await getDb().resetPcicCards();
    jest.spyOn(TextInput.prototype, 'focus').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('az első kártya mezője autoFocus-szal indul', async () => {
    const { UNSAFE_getByType } = render(<PcicScreen />);
    await flush();
    expect(UNSAFE_getByType(TextInput).props.autoFocus).toBe(true);
  });

  it('Check után nem autoFocus-os (letiltott mező), a következő kártyánál ÚJ, autoFocus-os példány jön', async () => {
    const { UNSAFE_getByType, getByText } = render(<PcicScreen />);
    await flush();
    const first = UNSAFE_getByType(TextInput);

    fireEvent.changeText(first, 'zzz');
    fireEvent.press(getByText('✓ Check'));
    await flush();
    expect(UNSAFE_getByType(TextInput).props.editable).toBe(false);
    expect(UNSAFE_getByType(TextInput).props.autoFocus).toBe(false);

    fireEvent.press(getByText(/^Next →/));
    await flush();

    const second = UNSAFE_getByType(TextInput);
    expect(second).not.toBe(first);
    expect(second.props.editable).toBe(true);
    expect(second.props.autoFocus).toBe(true);
    expect(second.props.value).toBe('');
  });
});
