jest.mock('@/lib/speech', () => require('@/test-utils/mocks').speechMock());
jest.mock('expo-router', () => require('@/test-utils/mocks').focusEffectRouterMock());

const mockItems = Array.from({ length: 4 }, (_, i) => ({
  id: `a1-w${i}`, es: `palabra${i}`, en: `word${i}`, kind: 'word', section: 'Test', order: i,
}));
jest.mock('@/data/pcic', () => ({
  PCIC_LEVELS: ['A1'], PCIC_VIEW_LEVELS: ['A1'],
  pcicItemsForLevel: () => mockItems,
  findPcicItem: (id: string) => mockItems.find((i) => i.id === id),
  levelOfItem: () => 'A1', setPcicTarget: () => {},
}));

import { StyleSheet, TextInput } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import { getDb } from '@/lib/database';
import * as resumeStore from '@/lib/resumeStore';
import { RESUME_GAME_ID } from '@/lib/resumeRoute';
import { sm2NewCard, type Sm2Card } from '@/lib/sm2';
import { localDateString } from '@/lib/usageStats';
import { makeFlush } from '@/test-utils/flush';
import PcicScreen from '../index';

const { loadResumeValue, saveResumeValue } = resumeStore;
const flush = makeFlush(8);
const day = localDateString();
type Screen = ReturnType<typeof render>;
const seed = async (due = 2) => {
  for (let i = 0; i < mockItems.length; i++) {
    await getDb().upsertPcicCard({ ...sm2NewCard(`a1-w${i}`), state: 'review',
      introducedAt: '2000-01-01', due: i < due ? day : '2999-01-01', interval: i === 1 ? 30 : 1 });
  }
};
const miss = async (screen: Screen) => {
  fireEvent.changeText(screen.UNSAFE_getByType(TextInput), 'xyz');
  fireEvent.press(screen.getByText('✓ Check'));
  await flush();
  fireEvent.press(screen.getByText("Next → Didn't know"));
  await flush();
};

describe('Learn fatigue settings and daily queue', () => {
  beforeEach(async () => {
    const db = getDb();
    await db.setOnboarding('en', 'es');
    await db.resetPcicCards();
    await db.resetGameProgress(RESUME_GAME_ID);
    await db.setPcicLevel('A1');
    await db.setPcicNewBonus(0, day);
    await db.setTiredButton(false);
    await db.setMissCap(false);
  });
  afterEach(() => jest.restoreAllMocks());

  it('shows the optional button, sorts easiest first, clears typing, and keeps its state on remount', async () => {
    await seed();
    const off = render(<PcicScreen />);
    await flush();
    expect(off.queryByTestId('learn-tired')).toBeNull();
    off.unmount();
    await getDb().setTiredButton(true);
    const screen = render(<PcicScreen />);
    await flush();
    expect(screen.getByText('word0')).toBeTruthy();
    fireEvent.changeText(screen.UNSAFE_getByType(TextInput), 'partial');
    fireEvent.press(screen.getByTestId('learn-tired'));
    await flush();
    expect(screen.getByText('word1')).toBeTruthy();
    expect(screen.UNSAFE_getByType(TextInput).props.value).toBe('');
    expect(screen.getByTestId('learn-tired').props.accessibilityState.selected).toBe(true);
    screen.unmount();
    const again = render(<PcicScreen />);
    await flush();
    expect(again.getByText('word1')).toBeTruthy();
    expect(again.getByTestId('learn-tired').props.accessibilityState.selected).toBe(true);
    fireEvent.press(again.getByTestId('learn-tired'));
    await flush();
    expect(again.getByText('word1')).toBeTruthy();
    expect(again.getByTestId('learn-tired').props.accessibilityState.selected).toBe(false);
  });

  it('keeps the revealed card in place while toggling and hides the button without reviews', async () => {
    await seed();
    await getDb().setTiredButton(true);
    const screen = render(<PcicScreen />);
    await flush();
    fireEvent.press(screen.getByText('✓ Check'));
    await flush();
    fireEvent.press(screen.getByTestId('learn-tired'));
    await flush();
    expect(screen.getByText('word0')).toBeTruthy();
    expect(screen.getByText("Next → Didn't know")).toBeTruthy();
    screen.unmount();
    await getDb().resetPcicCards();
    const fresh = render(<PcicScreen />);
    await flush();
    expect(fresh.queryByTestId('learn-tired')).toBeNull();
  });

  it('four misses park until tomorrow, preserve SM-2 writes, survive remount, and undo restores the fourth miss', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(Date.now());
    await seed(1);
    const baseline: Sm2Card[] = [];
    const normal = render(<PcicScreen />);
    await flush();
    for (let n = 0; n < 4; n++) {
      await miss(normal);
      baseline.push((await getDb().getPcicCard('a1-w0'))!);
    }
    normal.unmount();
    await getDb().resetPcicCards();
    await getDb().resetGameProgress(RESUME_GAME_ID);
    await seed(1);
    await getDb().setTiredButton(true);
    await getDb().setMissCap(true);
    const screen = render(<PcicScreen />);
    await flush();
    fireEvent.press(screen.getByTestId('learn-tired'));
    await flush();
    for (let n = 1; n <= 4; n++) {
      await miss(screen);
      expect(await getDb().getPcicCard('a1-w0')).toEqual(baseline[n - 1]);
      if (n < 4) expect(screen.getByText('word0')).toBeTruthy();
    }
    expect(screen.queryByText('word0')).toBeNull();
    expect(screen.getByTestId('learn-parked-note').props.children).toBe('1 card will return tomorrow.');
    fireEvent.press(screen.getByLabelText('Undo'));
    await flush();
    expect(screen.getByText('word0')).toBeTruthy();
    expect(await loadResumeValue(getDb(), 'fatigue')).toMatchObject({ misses: { 'a1-w0': 3 }, parked: [] });
    fireEvent.press(screen.getByText("Next → Didn't know"));
    await flush();
    screen.unmount();
    const again = render(<PcicScreen />);
    await flush();
    expect(again.queryByText('word0')).toBeNull();
    expect(again.getByTestId('learn-parked-note')).toBeTruthy();
    expect(await loadResumeValue(getDb(), 'fatigue')).toMatchObject({ tired: true, parked: ['a1-w0'] });
    again.unmount();
    await getDb().setMissCap(false);
    const uncapped = render(<PcicScreen />);
    await flush();
    expect(uncapped.getByText('word0')).toBeTruthy();
    expect(uncapped.getByTestId('learn-tired').props.accessibilityState.selected).toBe(true);
  });

  it('a parked card does not advance the progress bar, including after reloading', async () => {
    await seed();
    await getDb().setMissCap(true);
    await saveResumeValue(getDb(), 'fatigue', { day, tired: false, misses: { 'a1-w0': 3 }, parked: [] });
    const screen = render(<PcicScreen />);
    await flush();
    await miss(screen);
    expect(screen.getByText('word1')).toBeTruthy();
    expect(StyleSheet.flatten(screen.getByTestId('learn-progress-fill').props.style).width).toBe('0%');
    screen.unmount();
    const again = render(<PcicScreen />);
    await flush();
    expect(again.queryByText('word0')).toBeNull();
    expect(StyleSheet.flatten(again.getByTestId('learn-progress-fill').props.style).width).toBe('0%');
  });

  it('both settings off keeps returning after four misses and never writes fatigue state', async () => {
    await seed(1);
    const spy = jest.spyOn(getDb(), 'setGameProgress');
    const screen = render(<PcicScreen />);
    await flush();
    for (let i = 0; i < 4; i++) await miss(screen);
    expect(screen.getByText('word0')).toBeTruthy();
    expect(await loadResumeValue(getDb(), 'fatigue')).toBeNull();
    expect(spy.mock.calls.filter((call) => call[1] === 'fatigue')).toHaveLength(0);
    spy.mockRestore();
  });

  it('a saved state from yesterday expires on load', async () => {
    await seed(1);
    await getDb().setTiredButton(true);
    await getDb().setMissCap(true);
    await saveResumeValue(getDb(), 'fatigue', { day: '2000-01-01', tired: true, misses: { 'a1-w0': 4 }, parked: ['a1-w0'] });
    const screen = render(<PcicScreen />);
    await flush();
    expect(screen.getByText('word0')).toBeTruthy();
    expect(screen.getByTestId('learn-tired').props.accessibilityState.selected).toBe(false);
  });

  it('counts misses across remounts and does not count misses with only the tired button enabled', async () => {
    await seed(1);
    await getDb().setTiredButton(true);
    let screen = render(<PcicScreen />);
    await flush();
    await miss(screen);
    expect(await loadResumeValue(getDb(), 'fatigue')).toBeNull();
    screen.unmount();
    await getDb().setMissCap(true);
    screen = render(<PcicScreen />);
    await flush();
    await miss(screen);
    await miss(screen);
    screen.unmount();
    screen = render(<PcicScreen />);
    await flush();
    await miss(screen);
    expect(screen.getByText('word0')).toBeTruthy();
    await miss(screen);
    expect(screen.queryByText('word0')).toBeNull();
    expect(await loadResumeValue(getDb(), 'fatigue')).toMatchObject({ misses: { 'a1-w0': 4 } });
  });

  it('reorders immediately while saving tired state, so a later skip cannot be overwritten by that save', async () => {
    await seed();
    await getDb().setTiredButton(true);
    const originalSave = resumeStore.saveResumeValue;
    let finishSave!: () => void;
    jest.spyOn(resumeStore, 'saveResumeValue').mockImplementation((db, key, value) => key === 'fatigue'
      ? new Promise<boolean>((resolve) => { finishSave = () => resolve(true); }) : originalSave(db, key, value));
    const screen = render(<PcicScreen />);
    await flush();
    fireEvent.press(screen.getByTestId('learn-tired'));
    await flush();
    expect(screen.getByText('word1')).toBeTruthy();
    fireEvent.press(screen.getByText("Don't learn this"));
    await flush();
    await act(async () => finishSave());
    await flush();
    expect(screen.getByText('word0')).toBeTruthy();
    expect((await getDb().getPcicCard('a1-w1'))?.known).toBe(true);
  });

  it('does not reorder the card while a skip is being saved', async () => {
    await seed();
    await getDb().setTiredButton(true);
    const db = getDb();
    const originalWrite = db.upsertPcicCard.bind(db);
    let finishWrite!: () => Promise<void>;
    jest.spyOn(db, 'upsertPcicCard').mockImplementation((card) => new Promise<void>((resolve) => {
      finishWrite = async () => { await originalWrite(card); resolve(); };
    }));
    const screen = render(<PcicScreen />);
    await flush();
    fireEvent.press(screen.getByText("Don't learn this"));
    await flush();
    fireEvent.press(screen.getByTestId('learn-tired'));
    await flush();
    await act(async () => finishWrite());
    await flush();
    expect(screen.getByText('word1')).toBeTruthy();
    expect(screen.getByTestId('learn-tired').props.accessibilityState.selected).toBe(false);
  });
});
