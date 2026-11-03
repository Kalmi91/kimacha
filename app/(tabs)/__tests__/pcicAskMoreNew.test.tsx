// FB542: when the day's new-word budget runs out while reviews are left, nothing is added by itself: the learner is
// asked (the question replaces the card) and acts on the answer. Mock pattern: pcicMoreNewSteps.test.tsx.

jest.mock('@/lib/speech', () => require('@/test-utils/mocks').speechMock());

jest.mock('expo-router', () => require('@/test-utils/mocks').focusEffectRouterMock());

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, left: 0, right: 0, bottom: 0 }),
}));

const mockB1Items = Array.from({ length: 100 }, (_, i) => ({
  id: `b1-w${i}`,
  es: `palabra${i}`,
  en: `word${i}`,
  kind: 'word' as const,
  section: 'Test',
  order: i,
}));
jest.mock('@/data/pcic', () => ({
  PCIC_LEVELS: ['B1'],
  PCIC_VIEW_LEVELS: ['B1'],
  pcicItemsForLevel: () => mockB1Items,
  findPcicItem: (id: string) => mockB1Items.find((i) => i.id === id),
  levelOfItem: (id: string) => (id.startsWith('b1-') ? 'B1' : undefined),
  setPcicTarget: () => {},
}));

import { fireEvent, render } from '@testing-library/react-native';
import { TextInput } from 'react-native';

import { getDb } from '@/lib/database';
import { saveNewDeclinedDay } from '@/lib/learnResume';
import { RESUME_GAME_ID } from '@/lib/resumeRoute';
import { addDays, sm2NewCard, sm2Review, type Sm2Card } from '@/lib/sm2';
import { localDateString } from '@/lib/usageStats';
import PcicScreen from '../index';
import { makeFlush } from '@/test-utils/flush';

jest.setTimeout(30000);

const flush = makeFlush(8);

const QUESTION = "Today's new words are done, but reviews are left. Do you want more new words?";

describe('PCIC tab: asks before more new words when the day\'s batch runs out (FB542)', () => {
  const today = localDateString();
  const yesterday = addDays(today, -1);

  // `introduced` words introduced today (not due), 12 reviews due today.
  const seed = async (introduced: number) => {
    for (const item of mockB1Items.slice(0, introduced)) await getDb().upsertPcicCard(sm2Review(sm2NewCard(item.id), 'good', today));
    for (const item of mockB1Items.slice(20, 32)) {
      const due: Sm2Card = { ...sm2NewCard(item.id), state: 'review', interval: 1, reps: 1, due: today, lastReview: yesterday, introducedAt: yesterday };
      await getDb().upsertPcicCard(due);
    }
  };

  // type a wrong answer, Check, "Knew it": grades the card on screen as good.
  const gradeCurrent = async (screen: ReturnType<typeof render>) => {
    fireEvent.changeText(screen.UNSAFE_getByType(TextInput), 'xyz');
    fireEvent.press(screen.getByText('✓ Check'));
    await flush();
    fireEvent.press(screen.getByText('Knew it'));
    await flush();
  };

  beforeEach(async () => {
    await getDb().resetPcicCards();
    await getDb().resetGameProgress(RESUME_GAME_ID);
    await getDb().setPcicNewBonus(0, today);
    await getDb().setPcicLevel('B1');
  });

  it('budget used up with reviews left: the question shows, no card, nothing added', async () => {
    await seed(10);
    const screen = render(<PcicScreen />);
    await flush();
    expect(screen.getByTestId('learn-ask-more-new')).toBeTruthy();
    expect(screen.getByText(QUESTION)).toBeTruthy();
    for (const label of ['+5', '+10', '+15', 'No, only reviews']) expect(screen.getByText(label)).toBeTruthy();
    expect(screen.queryByText(/^word\d+$/)).toBeNull();
    expect(screen.getByText('new 0')).toBeTruthy();
    expect(await getDb().getPcicNewBonus(today)).toBe(0);
    // the header (with the feedback button) stays
    expect(screen.getByLabelText('Feedback')).toBeTruthy();
  });

  it('the question also comes after the last new word of the day is graded', async () => {
    await seed(9);
    const screen = render(<PcicScreen />);
    await flush();
    expect(screen.queryByTestId('learn-ask-more-new')).toBeNull();
    expect(screen.getByText('new 1')).toBeTruthy();
    // the one new word waits behind the first review: grade the review, then the new word
    await gradeCurrent(screen);
    expect(screen.queryByTestId('learn-ask-more-new')).toBeNull();
    await gradeCurrent(screen);
    expect(screen.getByTestId('learn-ask-more-new')).toBeTruthy();
    expect(await getDb().getPcicNewBonus(today)).toBe(0);
  });

  it('+10: ten new words join the queue one at a time among the reviews, the bonus is saved', async () => {
    await seed(10);
    const screen = render(<PcicScreen />);
    await flush();
    fireEvent.press(screen.getByTestId('learn-ask-new-10'));
    await flush();
    expect(screen.queryByTestId('learn-ask-more-new')).toBeNull();
    expect(screen.getByText('new 10')).toBeTruthy();
    expect(await getDb().getPcicNewBonus(today)).toBe(10);
    // a review is on screen first (the new-word chip is absent), the first new word comes right behind it
    expect(screen.queryByText('new')).toBeNull();
    await gradeCurrent(screen);
    expect(screen.getByText('new')).toBeTruthy();
    expect(screen.queryByTestId('learn-ask-more-new')).toBeNull();
  });

  it('+5 gives five new words', async () => {
    await seed(10);
    const screen = render(<PcicScreen />);
    await flush();
    fireEvent.press(screen.getByTestId('learn-ask-new-5'));
    await flush();
    expect(screen.getByText('new 5')).toBeTruthy();
    expect(await getDb().getPcicNewBonus(today)).toBe(5);
  });

  it('No: only reviews, and the question does not return after a grade or a remount', async () => {
    await seed(10);
    const screen = render(<PcicScreen />);
    await flush();
    fireEvent.press(screen.getByTestId('learn-ask-new-no'));
    await flush();
    expect(screen.queryByTestId('learn-ask-more-new')).toBeNull();
    expect(screen.getByText('new 0')).toBeTruthy();
    expect(await getDb().getPcicNewBonus(today)).toBe(0);
    await gradeCurrent(screen);
    expect(screen.queryByTestId('learn-ask-more-new')).toBeNull();
    expect(screen.getByText('new 0')).toBeTruthy();

    screen.unmount();
    const again = render(<PcicScreen />);
    await flush();
    expect(again.queryByTestId('learn-ask-more-new')).toBeNull();
    expect(again.getByText('new 0')).toBeTruthy();
  });

  it('a "No" from an earlier day does not count: a new day asks again', async () => {
    await seed(10);
    await saveNewDeclinedDay(getDb(), yesterday);
    const screen = render(<PcicScreen />);
    await flush();
    expect(screen.getByTestId('learn-ask-more-new')).toBeTruthy();
  });
});
