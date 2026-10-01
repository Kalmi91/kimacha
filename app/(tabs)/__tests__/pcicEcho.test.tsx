// PLAN-learn-words-open 5a: helyes válasz után a szó csak egyszer látszik (a
// rózsaszín sor a hangszóróval), a zöld visszhang (diff-sor) kimarad. Ha a beírt
// válasz eltér (rossz, vagy ékezet nélkül elfogadott), mindkét sor megmarad.
// Mock-minta: pcicBrutal.test.tsx.

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

const FIXTURE_ITEM = { id: 'b1-x1', es: 'está', en: 'is', kind: 'word' as const, section: 'Test', order: 0 };
jest.mock('@/data/pcic', () => ({
  PCIC_LEVELS: ['B1'],
  PCIC_VIEW_LEVELS: ['B1'],
  LEVEL_LABELS: { B1: 'Intermediate' },
  pcicItemsForLevel: () => [FIXTURE_ITEM],
  pcicItemsForViewLevel: () => [FIXTURE_ITEM],
  findPcicItem: (id: string) => (id === 'b1-x1' ? FIXTURE_ITEM : undefined),
  isPlusSentence: () => false,
  realLevelOfView: (level: string) => level,
  setPcicTarget: () => {},
}));

import { act, fireEvent, render } from '@testing-library/react-native';
import { TextInput } from 'react-native';

import { getDb } from '@/lib/database';
import { ThemeProvider } from '@/lib/ThemeContext';
import PcicScreen from '../index';

const flush = async (times = 6) => {
  for (let i = 0; i < times; i++) {
    await act(async () => {
      await Promise.resolve();
    });
  }
};

jest.setTimeout(30000);

async function revealWith(typed: string) {
  const view = render(<ThemeProvider><PcicScreen /></ThemeProvider>);
  await flush();
  fireEvent.changeText(view.UNSAFE_getByType(TextInput), typed);
  fireEvent.press(view.getByText('✓ Check'));
  await flush();
  return view;
}

describe('PCIC felfedés: a helyes válasz csak egyszer látszik (5a)', () => {
  beforeEach(async () => {
    await getDb().resetPcicCards();
  });

  it('pontosan a cél (kis-nagybetű és széli szóköz nélkül): nincs zöld visszhang, egyetlen "está" (a rózsaszín sor)', async () => {
    for (const typed of ['está', '  EstÁ  ']) {
      const view = await revealWith(typed);
      expect(view.queryByTestId('pcic-diff-line')).toBeNull();
      expect(view.getAllByText('está')).toHaveLength(1);
      view.unmount();
    }
  });

  it('ékezet nélkül elfogadott válasz: a diff-sor (beírt alak) és a rózsaszín cél-sor is megmarad', async () => {
    const view = await revealWith('esta');
    expect(view.getByTestId('pcic-diff-line')).toBeTruthy();
    expect(view.getAllByText('está')).toHaveLength(1);
    view.unmount();
  });

  it('rossz válasz: a diff-sor és a rózsaszín cél-sor is megmarad', async () => {
    const view = await revealWith('xyz');
    expect(view.getByTestId('pcic-diff-line')).toBeTruthy();
    expect(view.getAllByText('está')).toHaveLength(1);
    view.unmount();
  });
});
