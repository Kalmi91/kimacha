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

import { createRef, forwardRef, useImperativeHandle } from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { getDb } from '@/lib/database';
import { answerLog } from '@/lib/answerLog';
import { FATIGUE_DETECTOR as F, FATIGUE_OFFER_KEY } from '@/lib/learn/fatigueDetector';
import { usePcicSession } from '@/lib/learn/usePcicSession';
import { loadResumeValue } from '@/lib/resumeStore';
import { RESUME_GAME_ID } from '@/lib/resumeRoute';
import { sm2NewCard } from '@/lib/sm2';
import { localDateString } from '@/lib/usageStats';
import { makeFlush } from '@/test-utils/flush';
import PcicCardView from '@/components/learn/PcicCardView';

const flush = makeFlush(8);
const pair = 'en\u2192es';
const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
let clock: number;
let day: string;
const sessionRef = createRef<ReturnType<typeof usePcicSession>>();
const Screen = forwardRef<ReturnType<typeof usePcicSession>>(function Screen(_props, ref) {
  const session = usePcicSession();
  useImperativeHandle(ref, () => session, [session]);
  return <PcicCardView {...session} />;
});
const miss = async (screen: ReturnType<typeof render>) => {
  clock++;
  fireEvent.press(screen.getByText('✓ Check')); await flush();
  fireEvent.press(screen.getByText("Next → Didn't know")); await flush();
};
const openOffer = async (screen: ReturnType<typeof render>) => {
  for (let i = 0; i < F.REPEAT_MISSES + 2; i++) await miss(screen);
  expect(screen.getByTestId('learn-fatigue-offer')).toBeTruthy();
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
  for (let i = 0; i < mockItems.length; i++) await db.upsertPcicCard({ ...sm2NewCard(`a1-w${i}`),
    state: 'review', introducedAt: '2000-01-01', due: i < 2 ? day : '2999-01-01', interval: i === 1 ? 30 : 1 });
});
afterEach(() => {
  jest.restoreAllMocks();
  if (original) Object.defineProperty(globalThis, 'localStorage', original);
  else Reflect.deleteProperty(globalThis, 'localStorage');
});

it.each(['grade', 'skip'] as const)('keeps the offer during a pending %s and accepts after it completes', async kind => {
  const screen = render(<Screen ref={sessionRef} />); await flush(); await openOffer(screen);
  const db = getDb();
  const write = db.upsertPcicCard.bind(db);
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  jest.spyOn(db, 'upsertPcicCard').mockImplementationOnce(async card => { await pending; await write(card); });
  if (kind === 'grade') {
    act(() => { void sessionRef.current!.handleGrade('again'); });
  } else {
    act(() => { void sessionRef.current!.handleDontLearn(); });
  }
  await flush();
  fireEvent.press(screen.getByTestId('learn-fatigue-offer-yes')); await flush();
  expect(screen.getByTestId('learn-fatigue-offer')).toBeTruthy();
  expect(sessionRef.current!.tired).toBe(false);
  await act(async () => { release(); await pending; }); await flush();
  fireEvent.press(screen.getByTestId('learn-fatigue-offer-yes')); await flush();
  expect(sessionRef.current!.tired).toBe(true);
  expect(screen.queryByTestId('learn-fatigue-offer')).toBeNull();
  expect(screen.getByTestId('learn-tired').props.accessibilityState.selected).toBe(true);
});

it('clears an offer when eligible reviews run out without declining, then offers normally again', async () => {
  const screen = render(<Screen ref={sessionRef} />); await flush(); await openOffer(screen);
  while (sessionRef.current!.queue.length) {
    await act(async () => { await sessionRef.current!.handleDontLearn(); }); await flush();
  }
  expect(sessionRef.current!.fatigueOffer).toBeNull();
  expect(await loadResumeValue(getDb(), FATIGUE_OFFER_KEY)).toBeNull();
  screen.unmount();
  await getDb().upsertPcicCard({ ...sm2NewCard('a1-w2'), state: 'review', introducedAt: '2000-01-01', due: day, interval: 30 });
  const reopened = render(<Screen />); await flush();
  expect(reopened.getByTestId('learn-fatigue-offer')).toBeTruthy();
});

it('bounds every load and effect read to MAX_RUN_ANSWERS', async () => {
  const recent = jest.spyOn(answerLog, 'recent');
  const screen = render(<Screen />); await flush(); await miss(screen);
  expect(recent).toHaveBeenCalled();
  for (const args of recent.mock.calls) expect(args).toStrictEqual([pair, F.MAX_RUN_ANSWERS]);
});

it('does not read the answer log while an offer stays open', async () => {
  const screen = render(<Screen ref={sessionRef} />); await flush(); await openOffer(screen);
  const recent = jest.spyOn(answerLog, 'recent');
  await act(async () => { await sessionRef.current!.handleGrade('again'); }); await flush();
  expect(screen.getByTestId('learn-fatigue-offer')).toBeTruthy();
  expect(recent).not.toHaveBeenCalled();
});
