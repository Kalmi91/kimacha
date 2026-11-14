jest.mock('@/lib/speech', () => require('@/test-utils/mocks').speechMock());
jest.mock('expo-router', () => require('@/test-utils/mocks').focusEffectRouterMock());
jest.mock('@/lib/answerLog', () => jest.requireActual('@/lib/answerLog.web'));
jest.mock('@/lib/learn/useFocusOnNewCard', () => ({ useFocusOnNewCard: jest.fn() }));
const mockItems = Array.from({ length: 4 }, (_, i) => ({
  id: `a1-w${i}`, es: `palabra${i}`, en: `word${i}`, kind: 'word', section: 'Test', order: i,
}));
jest.mock('@/data/pcic', () => ({
  PCIC_LEVELS: ['A1'], PCIC_VIEW_LEVELS: ['A1'], pcicItemsForLevel: () => mockItems,
  findPcicItem: (id: string) => mockItems.find(i => i.id === id), levelOfItem: () => 'A1', setPcicTarget: () => {},
}));

import { createRef, forwardRef, useImperativeHandle } from 'react';
import { Keyboard, TextInput } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import { getDb } from '@/lib/database';
import { answerLog } from '@/lib/answerLog';
import { FATIGUE_DETECTOR as F } from '@/lib/learn/fatigueDetector';
import { usePcicSession } from '@/lib/learn/usePcicSession';
import { useFocusOnNewCard } from '@/lib/learn/useFocusOnNewCard';
import { speakAuto } from '@/lib/speech';
import { RESUME_GAME_ID } from '@/lib/resumeRoute';
import { sm2NewCard } from '@/lib/sm2';
import { localDateString } from '@/lib/usageStats';
import { makeFlush } from '@/test-utils/flush';
import ScreenFeedback from '@/lib/screenFeedback';
import LevelPickerSheet from '@/components/LevelPickerSheet';
import PcicCardView from '@/components/learn/PcicCardView';
import CardShell from '@/components/learn/CardShell';

const flush = makeFlush(8);
const pair = 'en\u2192es';
const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
const sessionRef = createRef<ReturnType<typeof usePcicSession>>();
const cardFocusReady = () => (useFocusOnNewCard as jest.Mock).mock.calls
  .filter(([ref]) => ref === sessionRef.current!.inputRef).slice(-1)[0]?.[1];
const Screen = forwardRef<ReturnType<typeof usePcicSession>, { askFirst?: boolean }>(function Screen({ askFirst }, ref) {
  const session = usePcicSession();
  useImperativeHandle(ref, () => session, [session]);
  return <PcicCardView {...session} askMoreNew={askFirst || session.askMoreNew} />;
});
let clock: number;
const repeated = () => Array.from({ length: F.REPEAT_MISSES + 1 }, (_, i) => ({
  at: clock - F.REPEAT_MISSES + i, pair, itemId: 'a1-w0', thinkMs: F.MIN_RECENT_THINK_MS, knew: false,
}));
const miss = async (screen: ReturnType<typeof render>) => {
  fireEvent.press(screen.getByText('✓ Check')); await flush();
  fireEvent.press(screen.getByText("Next → Didn't know")); await flush();
};
beforeEach(async () => {
  jest.clearAllMocks();
  const saved = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: (key: string) => saved.get(key) ?? null, setItem: (key: string, value: string) => saved.set(key, value),
  } });
  clock = Date.now();
  jest.spyOn(Date, 'now').mockImplementation(() => clock);
  const db = getDb();
  await db.setOnboarding('en', 'es'); await db.resetPcicCards(); await db.resetGameProgress(RESUME_GAME_ID);
  await db.setPcicLevel('A1'); await db.setPcicNewBonus(0, localDateString());
  await db.setTiredButton(false); await db.setMissCap(false); await db.setFatigueDetector(true);
  for (let i = 0; i < mockItems.length; i++) await db.upsertPcicCard({ ...sm2NewCard(`a1-w${i}`),
    state: 'review', introducedAt: '2000-01-01', due: i < 2 ? localDateString() : '2999-01-01', interval: i === 1 ? 30 : 1 });
});
afterEach(() => {
  jest.restoreAllMocks();
  if (original) Object.defineProperty(globalThis, 'localStorage', original);
  else Reflect.deleteProperty(globalThis, 'localStorage');
});

it.each(['yes', 'no'])('replaces the card, keeps the header and returns to the card after %s', async choice => {
  repeated().forEach(entry => answerLog.append(entry));
  const dismiss = jest.spyOn(Keyboard, 'dismiss');
  const screen = render(<Screen ref={sessionRef} />); await flush();
  expect(screen.getByTestId('learn-fatigue-offer')).toBeTruthy();
  expect(screen.queryByTestId('learn-card')).toBeNull();
  expect(screen.UNSAFE_queryByType(CardShell)).toBeNull();
  expect(screen.queryByTestId('learn-dock')).toBeNull();
  expect(screen.queryByText('✓ Check')).toBeNull();
  expect(screen.UNSAFE_queryByType(TextInput)).toBeNull();
  expect(screen.UNSAFE_getByType(LevelPickerSheet)).toBeTruthy();
  expect(screen.UNSAFE_getAllByType(ScreenFeedback).some(node => node.props.placement === 'inline')).toBe(true);
  expect(cardFocusReady()).toBe(false);
  expect(speakAuto).not.toHaveBeenCalled();
  expect(dismiss).toHaveBeenCalled();
  fireEvent.press(screen.getByTestId(`learn-fatigue-offer-${choice}`)); await flush();
  expect(screen.queryByTestId('learn-fatigue-offer')).toBeNull();
  expect(screen.UNSAFE_getByType(CardShell)).toBeTruthy();
  expect(screen.getByText('✓ Check')).toBeTruthy();
  expect(cardFocusReady()).toBe(true);
  expect(speakAuto).toHaveBeenCalled();
});

it('starts thinking time at the decision, excluding the whole offer wait', async () => {
  repeated().forEach(entry => answerLog.append(entry));
  const screen = render(<Screen />); await flush();
  clock += F.MAX_THINK_MS * 2;
  fireEvent.press(screen.getByTestId('learn-fatigue-offer-no')); await flush();
  clock += F.MIN_RECENT_THINK_MS;
  await miss(screen);
  expect(answerLog.recent(pair, 1)[0].thinkMs).toBe(F.MIN_RECENT_THINK_MS);
});

it('defers detection beside an undone revealed answer until its rating completes', async () => {
  const screen = render(<Screen ref={sessionRef} />); await flush(); await miss(screen);
  const recent = jest.spyOn(answerLog, 'recent').mockReturnValue(repeated());
  fireEvent.press(screen.getByLabelText('Undo')); await flush();
  expect(sessionRef.current!.grade).not.toBeNull();
  expect(sessionRef.current!.fatigueOffer).toBeNull();
  expect(screen.queryByTestId('learn-fatigue-offer')).toBeNull();
  expect(screen.getByText("Next → Didn't know")).toBeTruthy();
  recent.mockRestore();
  fireEvent.press(screen.getByText("Next → Didn't know")); await flush();
  expect(sessionRef.current!.grade).toBeNull();
  expect(screen.getByTestId('learn-fatigue-offer')).toBeTruthy();
  expect(screen.queryByTestId('learn-card')).toBeNull();
  expect(screen.UNSAFE_queryByType(CardShell)).toBeNull();
});

it('shows the more-new question first and the fatigue question afterwards', async () => {
  repeated().forEach(entry => answerLog.append(entry));
  const screen = render(<Screen askFirst />); await flush();
  expect(screen.getByTestId('learn-ask-more-new')).toBeTruthy();
  expect(screen.queryByTestId('learn-fatigue-offer')).toBeNull();
  screen.rerender(<Screen askFirst={false} />); await flush();
  expect(screen.queryByTestId('learn-ask-more-new')).toBeNull();
  expect(screen.getByTestId('learn-fatigue-offer')).toBeTruthy();
  expect(screen.queryByTestId('learn-card')).toBeNull();
  expect(screen.UNSAFE_queryByType(CardShell)).toBeNull();
});
