// When a card accepts several answers ("el carro / el coche / el auto") and the
// learner presses Check with an empty or wrong answer, the reveal shows EVERY accepted word with equal weight
// (not just the first one in a small "also" line); on a correct answer the "also" line
// stays. Mock pattern: app/(tabs)/__tests__/pcicHint.test.tsx.

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

// Two items: the 1st has an answer with three forms, the 2nd has a single form.
jest.mock('@/data/pcic', () => {
  const items = [
    { id: 'o9101', es: 'el carro / el coche / el auto', en: 'car', kind: 'word', section: '', order: 9101 },
    { id: 'o9102', es: 'la mesa', en: 'table', kind: 'word', section: '', order: 9102 },
  ];
  return {
    PCIC_LEVELS: ['B1'],
    PCIC_VIEW_LEVELS: ['B1'],
    pcicItemsForLevel: () => items,
    findPcicItem: (id: string) => items.find((i) => i.id === id),
    setPcicTarget: () => {},
  };
});

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

const textOf = (node: unknown): string => {
  if (Array.isArray(node)) return node.map(textOf).join('');
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (node && typeof node === 'object' && 'props' in node) return textOf((node as { props: { children?: unknown } }).props.children);
  return '';
};

// Text of all visible solution rows (the 1st + the further rows), in order.
function shownAnswers(utils: ReturnType<typeof render>): string[] {
  const out = [textOf(utils.getByTestId('pcic-correct-answer').props.children)];
  for (let i = 2; ; i++) {
    const row = utils.queryByTestId(`pcic-correct-answer-${i}`);
    if (!row) break;
    out.push(textOf(row.props.children));
  }
  return out;
}

async function check(utils: ReturnType<typeof render>, answer: string) {
  if (answer) fireEvent.changeText(utils.UNSAFE_getByType(TextInput), answer);
  fireEvent.press(utils.getByText('✓ Check'));
  await flush();
}

describe('PCIC fül: üres / rossz válasznál minden elfogadott szó látszik (FB480)', () => {
  beforeEach(async () => {
    await getDb().resetPcicCards();
    jest.spyOn(TextInput.prototype, 'focus').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('üres Check: mind a három alak ugyanolyan sorban látszik, „also” sor nincs', async () => {
    const utils = render(<PcicScreen />);
    await flush();
    await check(utils, '');

    expect(shownAnswers(utils).sort()).toEqual(['el auto', 'el carro', 'el coche']);
    expect(utils.queryByTestId('learn-also')).toBeNull();
  });

  it('rossz válasz: ugyanígy mind a három látszik', async () => {
    const utils = render(<PcicScreen />);
    await flush();
    await check(utils, 'xyzq');

    expect(shownAnswers(utils).sort()).toEqual(['el auto', 'el carro', 'el coche']);
    expect(utils.queryByTestId('learn-also')).toBeNull();
  });

  it('helyes válasz: marad a mutatott alak + az „also” sor a többivel, nincs további sor', async () => {
    const utils = render(<PcicScreen />);
    await flush();
    await check(utils, 'el coche');

    expect(shownAnswers(utils)).toEqual(['el coche']);
    expect(textOf(utils.getByTestId('learn-also').props.children)).toBe('also: el carro · el auto');
  });

  it('egy alakú válasznál üres Check után is csak egy sor van', async () => {
    const utils = render(<PcicScreen />);
    await flush();
    await check(utils, 'el coche');
    fireEvent.press(utils.getByText('Knew it'));
    await flush();
    await check(utils, '');

    expect(shownAnswers(utils)).toEqual(['la mesa']);
  });
});
