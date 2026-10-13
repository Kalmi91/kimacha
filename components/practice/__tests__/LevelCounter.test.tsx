// The level counter (Sentences and Practice tabs): the Words tab header's level and word count ("A2" + "230 words"),
// plus the words of the level still due; it reads again when `refreshKey` changes, so it drops as words are credited.

jest.mock('@/lib/database', () => jest.requireActual('@/lib/database.web'));
jest.mock('expo-router', () => ({
  useFocusEffect: (cb: () => void) => {
    const { useEffect } = require('react');
    useEffect(cb, []);
  },
}));
jest.mock('@/data/pcic', () => ({
  PCIC_LEVELS: ['A1', 'A2'],
  pcicItemsForLevel: (level: string) => Array.from({ length: level === 'A2' ? 230 : 120 }, (_, i) => ({ id: `${level.toLowerCase()}-w${i}` })),
  levelOfItem: (id: string) => (id.startsWith('a2-') ? 'A2' : id.startsWith('a1-') ? 'A1' : undefined),
  setPcicTarget: () => {},
}));

import { act, render } from '@testing-library/react-native';

import LevelCounter from '@/components/practice/LevelCounter';
import { getDb } from '@/lib/database';
import { setLanguage } from '@/lib/i18n';
import { levelCounts } from '@/lib/levelCounter';
import { sm2NewCard, type Sm2Card } from '@/lib/sm2';

jest.setTimeout(30000);

const flush = async (times = 12) => {
  for (let i = 0; i < times; i++) {
    await act(async () => {
      await Promise.resolve();
    });
  }
};

const TODAY = '2026-10-12';
const review = (id: string, due: string, extra: Partial<Sm2Card> = {}): Sm2Card => ({
  ...sm2NewCard(id), state: 'review', interval: 3, reps: 2, due, lastReview: '2026-10-09', introducedAt: '2026-10-09', ...extra,
});

describe('levelCounts', () => {
  const cards = [
    review('a2-w1', '2026-10-01'), // due
    review('a2-w2', TODAY), // due today
    review('a2-w3', '2026-10-20'), // not yet due
    review('a2-w4', '2026-10-01', { halfSteps: 1 }), // due, but already has its half
    sm2NewCard('a2-w5'), // never learned
    review('a1-w1', '2026-10-01'), // another level
    review('zzz', '2026-10-01'), // not in the corpus
  ];

  it('counts the due words of the level that have no practice half yet; the total is the level\'s item count', () => {
    expect(levelCounts(cards, 'A2', 230, TODAY)).toEqual({ level: 'A2', total: 230, due: 2 });
    expect(levelCounts(cards, 'A1', 120, TODAY)).toEqual({ level: 'A1', total: 120, due: 1 });
  });
});

describe('<LevelCounter />', () => {
  beforeEach(async () => {
    await getDb().resetPcicCards();
    await getDb().setOnboarding('en', 'es');
    await getDb().setPcicLevel('A2');
  });
  afterEach(() => setLanguage('en'));

  it('works without props: the level, "230 words" and the due words, with an accessibility label (EN)', async () => {
    await getDb().upsertPcicCard(review('a2-w1', '2000-01-01'));
    await getDb().upsertPcicCard(review('a2-w2', '2000-01-01'));
    await getDb().upsertPcicCard(review('a1-w1', '2000-01-01'));
    const r = render(<LevelCounter />);
    await flush();
    expect(r.getByText('A2')).toBeTruthy();
    expect(r.getByText('230 words')).toBeTruthy();
    expect(r.getByText('due 2')).toBeTruthy();
    expect(r.getByLabelText('Level A2: 230 words, 2 due')).toBeTruthy();
  });

  it('Spanish labels', async () => {
    setLanguage('es');
    const r = render(<LevelCounter />);
    await flush();
    expect(r.getByText('230 palabras')).toBeTruthy();
    expect(r.getByText('pendientes 0')).toBeTruthy();
    expect(r.getByLabelText('Nivel A2: 230 palabras, 0 pendientes')).toBeTruthy();
  });

  it('refreshKey makes it read again: a credited word leaves the number at once', async () => {
    await getDb().upsertPcicCard(review('a2-w1', '2000-01-01'));
    await getDb().upsertPcicCard(review('a2-w2', '2000-01-01'));
    const r = render(<LevelCounter refreshKey={0} />);
    await flush();
    expect(r.getByText('due 2')).toBeTruthy();
    await getDb().upsertPcicCard(review('a2-w1', '2000-01-01', { halfSteps: 1 })); // a half was credited
    r.rerender(<LevelCounter refreshKey={1} />);
    await flush();
    expect(r.getByText('due 1')).toBeTruthy();
    await getDb().upsertPcicCard(review('a2-w2', '2099-01-01')); // a full step moved it away
    r.rerender(<LevelCounter refreshKey={2} />);
    await flush();
    expect(r.getByText('due 0')).toBeTruthy();
  });

  it('follows the learner\'s level (the one the Words tab is on)', async () => {
    await getDb().setPcicLevel('A1');
    const r = render(<LevelCounter />);
    await flush();
    expect(r.getByText('A1')).toBeTruthy();
    expect(r.getByText('120 words')).toBeTruthy();
  });
});
