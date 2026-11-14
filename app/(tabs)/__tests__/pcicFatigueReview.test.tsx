jest.mock('@/lib/speech', () => require('@/test-utils/mocks').speechMock());
jest.mock('expo-router', () => require('@/test-utils/mocks').focusEffectRouterMock());

let mockDay = '2026-11-14';
jest.mock('@/lib/usageStats', () => ({
  ...jest.requireActual('@/lib/usageStats'), localDateString: () => mockDay,
}));

const mockItems = Array.from({ length: 5 }, (_, i) => ({
  id: `a1-w${i}`, es: `palabra${i}`, en: `word${i}`, kind: 'word', section: 'Test', order: i,
}));
jest.mock('@/data/pcic', () => ({
  PCIC_LEVELS: ['A1'], PCIC_VIEW_LEVELS: ['A1'], pcicItemsForLevel: () => mockItems,
  findPcicItem: (id: string) => mockItems.find((i) => i.id === id),
  levelOfItem: () => 'A1', setPcicTarget: () => {},
}));

import { StyleSheet, TextInput } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import { getDb } from '@/lib/database';
import { loadLearnResume } from '@/lib/learnResume';
import { loadResumeValue, saveResumeValue } from '@/lib/resumeStore';
import { RESUME_GAME_ID } from '@/lib/resumeRoute';
import { mixNewCards, requeueAfterGrade } from '@/lib/pcicSession';
import { sm2NewCard, sm2Review } from '@/lib/sm2';
import { localDateString } from '@/lib/usageStats';
import { makeFlush } from '@/test-utils/flush';
import PcicScreen from '../index';

const day = '2026-11-14';
const tomorrow = '2026-11-15';
const flush = makeFlush(8);

beforeEach(async () => {
  mockDay = day;
  const db = getDb();
  await db.setOnboarding('en', 'es');
  await db.resetPcicCards();
  await db.resetGameProgress(RESUME_GAME_ID);
  await db.setPcicLevel('A1');
  await db.setPcicNewBonus(0, day);
  await db.setDailyNewLimit(5);
  await db.setTiredButton(false);
  await db.setMissCap(false);
  for (let i = 0; i < 3; i++) {
    await db.upsertPcicCard({ ...sm2NewCard(`a1-w${i}`), state: i === 2 ? 'learning' : 'review',
      introducedAt: i === 2 ? day : '2000-01-01', due: day, interval: 10 });
  }
});

it('keeps the loaded day and the exact legacy queue after midnight with both settings off', async () => {
  const screen = render(<PcicScreen />);
  await flush();
  const before = (await loadLearnResume(getDb()))!;
  const cards = new Map((await getDb().getPcicCards()).map((c) => [c.itemId, c]));
  const queue = before.order.map((id) => cards.get(id) ?? sm2NewCard(id));
  expect(queue[0].itemId).toBe('a1-w0');
  const graded = sm2Review(queue[0], 'good', day);
  const requeued = requeueAfterGrade(queue, graded, day);
  const expected = mixNewCards(requeued, day).map((c) => c.itemId);
  expect(mixNewCards(requeued, tomorrow).map((c) => c.itemId)).not.toEqual(expected);
  mockDay = tomorrow;
  expect(localDateString()).toBe(tomorrow);
  fireEvent.changeText(screen.UNSAFE_getByType(TextInput), 'palabra0');
  fireEvent.press(screen.getByText('✓ Check'));
  await flush();
  fireEvent.press(screen.getByText('Next → Knew it'));
  await flush();
  const resumed = (await loadLearnResume(getDb()))!;
  expect(resumed.day).toBe(day);
  expect(resumed.order).toEqual(expected);
  expect(await loadResumeValue(getDb(), 'fatigue')).toBeNull();
});

it('uses that same loaded day for tired mode, parked progress, toggling, miss counting and undo after midnight', async () => {
  await getDb().setTiredButton(true);
  await getDb().setMissCap(true);
  await saveResumeValue(getDb(), 'fatigue', { day, tired: true, misses: { 'a1-w0': 4, 'a1-w1': 3 }, parked: ['a1-w0'] });
  const screen = render(<PcicScreen />);
  await flush();
  expect(screen.getByText('word1')).toBeTruthy();
  mockDay = tomorrow;
  fireEvent.changeText(screen.UNSAFE_getByType(TextInput), 'xyz');
  await flush();
  expect(screen.getByTestId('learn-tired').props.accessibilityState.selected).toBe(true);
  expect(StyleSheet.flatten(screen.getByTestId('learn-progress-fill').props.style).width).toBe('0%');
  fireEvent.press(screen.getByTestId('learn-tired'));
  await flush();
  expect(await loadResumeValue(getDb(), 'fatigue')).toMatchObject({ day, tired: false, parked: ['a1-w0'] });
  fireEvent.press(screen.getByTestId('learn-tired'));
  await flush();
  fireEvent.press(screen.getByText('✓ Check'));
  await flush();
  fireEvent.press(screen.getByText("Next → Didn't know"));
  await flush();
  expect(screen.queryByText('word1')).toBeNull();
  expect(await loadResumeValue(getDb(), 'fatigue')).toMatchObject({ day, tired: true, misses: { 'a1-w0': 4, 'a1-w1': 4 }, parked: ['a1-w0', 'a1-w1'] });
  fireEvent.press(screen.getByLabelText('Undo'));
  await flush();
  expect(screen.getByText('word1')).toBeTruthy();
  expect(await loadResumeValue(getDb(), 'fatigue')).toMatchObject({ day, misses: { 'a1-w0': 4, 'a1-w1': 3 }, parked: ['a1-w0'] });
});
