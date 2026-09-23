// PLAN-play 10. lépés (s1, anki-ui-terv.html): a PCIC fejléc első chipje a
// szint, koppintásra a szint-választó lap nyílik; választás után a fül
// azonnal a választott szint pakliját adja, a haladás szintenként elkülönül.
// Mock-minta: pcicSpeak.test.tsx (db, router, speech, data/pcic).

jest.mock('@/lib/database', () => jest.requireActual('@/lib/database.web'));
jest.mock('@/lib/speech', () => ({
  speak: jest.fn(),
  speakSequence: jest.fn(),
  stopSpeaking: jest.fn(),
}));

jest.mock('expo-router', () => ({
  useFocusEffect: (cb: () => void) => {
    const { useEffect } = require('react');
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(cb, []);
  },
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, left: 0, right: 0, bottom: 0 }),
}));

// Két szint, egy-egy tétellel, hogy a váltás és az elkülönülés ellenőrizhető
// legyen a valódi PCIC-korpusztól függetlenül.
const A1_ITEM = { id: 'a1-w1', es: 'hola', en: 'hello', kind: 'word' as const, section: 'Test', order: 0 };
const B1_ITEM = { id: 'b1-w1', es: 'vida', en: 'life', kind: 'word' as const, section: 'Test', order: 0 };
const ITEMS_BY_LEVEL: Record<string, typeof A1_ITEM[]> = { A1: [A1_ITEM], B1: [B1_ITEM] };
jest.mock('@/data/pcic', () => ({
  PCIC_LEVELS: ['A1', 'B1'],
  LEVEL_LABELS: { A1: 'Beginner', B1: 'Intermediate' },
  pcicItemsForLevel: (level: string) => ITEMS_BY_LEVEL[level] ?? [],
  findPcicItem: (id: string) => [A1_ITEM, B1_ITEM].find((i) => i.id === id),
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

describe('PCIC fül: szint-választó (PLAN-play 10)', () => {
  beforeEach(async () => {
    await getDb().resetPcicCards();
    await getDb().setPcicLevel('B1');
  });

  it('a fejléc az aktív szintet mutatja, a lap a másik szintet is felkínálja', async () => {
    const { getByText } = render(<PcicScreen />);
    await flush();

    expect(getByText('B1 ▾')).toBeTruthy();
    // A B1 tétel angol promptja látszik alapból.
    expect(getByText('life')).toBeTruthy();

    fireEvent.press(getByText('B1 ▾'));
    await flush();

    expect(getByText('Beginner')).toBeTruthy();
    expect(getByText('Intermediate')).toBeTruthy();
  });

  it('másik szint választása azonnal annak pakliját adja, és perzisztálja a választást', async () => {
    const { getByText, queryByText } = render(<PcicScreen />);
    await flush();

    fireEvent.press(getByText('B1 ▾'));
    await flush();
    fireEvent.press(getByText('Beginner'));
    await flush();

    expect(getByText('A1 ▾')).toBeTruthy();
    expect(getByText('hello')).toBeTruthy();
    expect(queryByText('life')).toBeNull();
    expect(await getDb().getPcicLevel()).toBe('A1');
  });

  it('a haladás szintenként elkülönül: a B1 tétel "Knew it"-je nem tűnik el A1-re váltva, és A1-ről visszaváltva megmarad', async () => {
    const { getByText, UNSAFE_getByType } = render(<PcicScreen />);
    await flush();

    // B1 tételt "Knew it"-nek jelöl a dokkolt Next-tel.
    fireEvent.changeText(UNSAFE_getByType(TextInput), 'vida');
    fireEvent.press(getByText('✓ Check'));
    await flush();
    fireEvent.press(getByText('Next → Knew it'));
    await flush();

    // Átvált A1-re.
    fireEvent.press(getByText('B1 ▾'));
    await flush();
    fireEvent.press(getByText('Beginner'));
    await flush();
    expect(getByText('hello')).toBeTruthy();

    // Vissza B1-re: a korábban "learning"-be lépett szó nem 'new' többé.
    fireEvent.press(getByText('A1 ▾'));
    await flush();
    fireEvent.press(getByText('Intermediate'));
    await flush();

    const cards = await getDb().getPcicCards();
    const b1Card = cards.find((c) => c.itemId === 'b1-w1');
    expect(b1Card?.state).not.toBe('new');
  });
});
