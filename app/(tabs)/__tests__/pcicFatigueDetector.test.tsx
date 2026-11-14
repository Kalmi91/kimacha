jest.mock('@/lib/speech', () => require('@/test-utils/mocks').speechMock());
jest.mock('expo-router', () => require('@/test-utils/mocks').focusEffectRouterMock());
jest.mock('@/lib/answerLog', () => jest.requireActual('@/lib/answerLog.web'));
const mockItems = Array.from({ length: 4 }, (_, i) => ({
  id: `a1-w${i}`, es: `palabra${i}`, en: `word${i}`, kind: 'word', section: 'Test', order: i,
}));
jest.mock('@/data/pcic', () => ({
  PCIC_LEVELS: ['A1'], PCIC_VIEW_LEVELS: ['A1'], pcicItemsForLevel: () => mockItems,
  findPcicItem: (id: string) => mockItems.find(i => i.id === id), levelOfItem: () => 'A1', setPcicTarget: () => {},
}));

import { act, fireEvent, render } from '@testing-library/react-native';
import { getDb } from '@/lib/database';
import { answerLog, MAX_ANSWER_ROWS } from '@/lib/answerLog';
import { FATIGUE_DETECTOR as F, FATIGUE_OFFER_KEY } from '@/lib/learn/fatigueDetector';
import { loadResumeValue } from '@/lib/resumeStore';
import { loadLearnResume } from '@/lib/learnResume';
import { RESUME_GAME_ID } from '@/lib/resumeRoute';
import { sm2NewCard } from '@/lib/sm2';
import { localDateString } from '@/lib/usageStats';
import { makeFlush } from '@/test-utils/flush';
import PcicScreen from '../index';

const flush = makeFlush(8);
type Screen = ReturnType<typeof render>;
const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
let clock: number;
let day: string;
const seed = async (due = 2) => {
  for (let i = 0; i < mockItems.length; i++) await getDb().upsertPcicCard({ ...sm2NewCard(`a1-w${i}`),
    state: 'review', introducedAt: '2000-01-01', due: i < due ? day : '2999-01-01', interval: i === 1 ? 30 : 1 });
};
const miss = async (screen: Screen) => {
  clock++;
  fireEvent.press(screen.getByText('✓ Check')); await flush();
  fireEvent.press(screen.getByText("Next → Didn't know")); await flush();
};
const trigger = async (screen: Screen) => {
  for (let i = 0; i < F.REPEAT_MISSES + 2; i++) await miss(screen);
};
beforeEach(async () => {
  const saved = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: (key: string) => saved.get(key) ?? null, setItem: (key: string, value: string) => saved.set(key, value),
  } });
  clock = Date.now(); day = localDateString();
  jest.spyOn(Date, 'now').mockImplementation(() => clock);
  const db = getDb();
  await db.setOnboarding('en', 'es'); await db.resetPcicCards(); await db.resetGameProgress(RESUME_GAME_ID);
  await db.setPcicLevel('A1'); await db.setPcicNewBonus(0, day);
  await db.setTiredButton(false); await db.setMissCap(false); await db.setFatigueDetector(true);
  await seed();
});
afterEach(() => {
  jest.restoreAllMocks();
  if (original) Object.defineProperty(globalThis, 'localStorage', original);
  else Reflect.deleteProperty(globalThis, 'localStorage');
});
it('offers with the manual button disabled, accepts easiest reviews, and exposes a selected toggle', async () => {
  await seed(mockItems.length);
  for (let i = 0; i < F.REPEAT_MISSES; i++) answerLog.append({ at: clock - F.REPEAT_MISSES + i,
    pair: 'en\u2192es', itemId: 'a1-w0', thinkMs: F.MIN_RECENT_THINK_MS, knew: false });
  const screen = render(<PcicScreen />); await flush();
  expect(screen.queryByTestId('learn-tired')).toBeNull();
  await miss(screen);
  expect(screen.getByTestId('learn-fatigue-offer')).toBeTruthy();
  expect(screen.queryByTestId('learn-dock')).toBeNull();
  expect(screen.queryByTestId('learn-card')).toBeNull();
  expect(screen.queryByText('✓ Check')).toBeNull();
  screen.unmount();
  const reopened = render(<PcicScreen />); await flush();
  expect(reopened.getByTestId('learn-fatigue-offer')).toBeTruthy();
  fireEvent.press(reopened.getByTestId('learn-fatigue-offer-yes')); await flush();
  expect(reopened.getByText('word1')).toBeTruthy();
  expect(reopened.getByTestId('learn-tired').props.accessibilityState.selected).toBe(true);
  expect(reopened.queryByTestId('learn-fatigue-offer')).toBeNull();
  await miss(reopened);
  expect(reopened.queryByTestId('learn-fatigue-offer')).toBeNull();
  fireEvent.press(reopened.getByTestId('learn-tired')); await flush();
  expect(await loadResumeValue(getDb(), FATIGUE_OFFER_KEY)).toMatchObject({ day, declinedAt: clock });
  expect(reopened.queryByTestId('learn-tired')).toBeNull();
});
it('keeps an unanswered offer through remount', async () => {
  const screen = render(<PcicScreen />); await flush(); await trigger(screen); screen.unmount();
  for (let i = 0; i < F.RECENT_ANSWERS; i++) answerLog.append({ at: ++clock, pair: 'en\u2192es',
    itemId: `recovered${i}`, thinkMs: F.MIN_RECENT_THINK_MS, knew: true });
  const reopened = render(<PcicScreen />); await flush();
  expect(reopened.getByTestId('learn-fatigue-offer')).toBeTruthy();
});
it('persists decline, queue and progress through remount, then waits the full cooldown', async () => {
  const screen = render(<PcicScreen />); await flush(); await trigger(screen);
  fireEvent.press(screen.getByTestId('learn-fatigue-offer-no')); await flush();
  expect(screen.queryByTestId('learn-fatigue-offer')).toBeNull();
  const resume = await loadLearnResume(getDb());
  screen.unmount();
  const reopened = render(<PcicScreen />); await flush();
  expect(await loadLearnResume(getDb())).toEqual(resume);
  expect(reopened.queryByTestId('learn-fatigue-offer')).toBeNull();
  for (let i = 0; i < F.COOLDOWN_ANSWERS - 1; i++) {
    await miss(reopened); expect(reopened.queryByTestId('learn-fatigue-offer')).toBeNull();
  }
  await miss(reopened);
  expect(reopened.getByTestId('learn-fatigue-offer')).toBeTruthy();
});
it('logs while disabled without writing offer state or changing scheduling', async () => {
  await getDb().setFatigueDetector(false);
  const started = clock;
  const off = render(<PcicScreen />); await flush(); await trigger(off);
  expect(off.queryByTestId('learn-fatigue-offer')).toBeNull();
  expect(answerLog.recent('en\u2192es', MAX_ANSWER_ROWS)).toHaveLength(F.REPEAT_MISSES + 2);
  expect(await loadResumeValue(getDb(), FATIGUE_OFFER_KEY)).toBeNull();
  const cards = await getDb().getPcicCards(); const resume = await loadLearnResume(getDb());
  off.unmount();
  await getDb().resetPcicCards(); await getDb().resetGameProgress(RESUME_GAME_ID); await seed();
  await getDb().setFatigueDetector(true);
  for (const entry of answerLog.recent('en\u2192es', MAX_ANSWER_ROWS).reverse()) answerLog.removeLast(entry.pair, entry.itemId);
  clock = started;
  const on = render(<PcicScreen />); await flush(); await trigger(on);
  expect(await getDb().getPcicCards()).toEqual(cards);
  expect(await loadLearnResume(getDb())).toEqual(resume);
});
it('measures until reveal, clamps long waits and removes counted answers on undo', async () => {
  const screen = render(<PcicScreen />); await flush();
  clock += F.MIN_RECENT_THINK_MS;
  fireEvent.press(screen.getByText('✓ Check')); await flush();
  clock += F.MAX_THINK_MS;
  fireEvent.press(screen.getByText("Next → Didn't know")); await flush();
  expect(answerLog.recent('en\u2192es', 1)[0]).toMatchObject({ itemId: 'a1-w0', thinkMs: F.MIN_RECENT_THINK_MS, knew: false });
  fireEvent.press(screen.getByLabelText('Undo')); await flush();
  expect(answerLog.recent('en\u2192es', MAX_ANSWER_ROWS)).toEqual([]);
  fireEvent.press(screen.getByText("Next → Didn't know")); await flush();
  clock += F.MAX_THINK_MS + 1;
  fireEvent.press(screen.getByText('✓ Check')); await flush();
  fireEvent.press(screen.getByText("Next → Didn't know")); await flush();
  expect(answerLog.recent('en\u2192es', 1)[0].thinkMs).toBe(F.MAX_THINK_MS);
});
it('does not log Dont learn, and measures grading without reveal', async () => {
  // Calling the public hook handles the no-reveal grading path used by callers.
  const { renderHook } = require('@testing-library/react-native');
  const { usePcicSession } = require('@/lib/learn/usePcicSession');
  const hook = renderHook(() => usePcicSession()); await flush();
  clock += F.MIN_RECENT_THINK_MS;
  await act(async () => { await hook.result.current.handleGrade('good'); }); await flush();
  expect(answerLog.recent('en\u2192es', 1)[0]).toMatchObject({ thinkMs: F.MIN_RECENT_THINK_MS, knew: true });
  await act(async () => { await hook.result.current.handleDontLearn(); }); await flush();
  expect(answerLog.recent('en\u2192es', MAX_ANSWER_ROWS)).toHaveLength(1);
  await act(async () => { await hook.result.current.handleUndo(); }); await flush();
  expect(answerLog.recent('en\u2192es', MAX_ANSWER_ROWS)).toHaveLength(1);
});
