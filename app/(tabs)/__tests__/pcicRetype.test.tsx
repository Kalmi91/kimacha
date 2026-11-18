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

import { DeviceEventEmitter } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import { getDb } from '@/lib/database';
import { answerLog } from '@/lib/answerLog';
import { getXp } from '@/lib/dailyXp';
import { loadLearnResume } from '@/lib/learnResume';
import { RESUME_GAME_ID } from '@/lib/resumeRoute';
import { localDateString } from '@/lib/usageStats';
import { makeFlush } from '@/test-utils/flush';
import PcicScreen from '../index';

const flush = makeFlush(8);
type Screen = ReturnType<typeof render>;
let day: string;
const snapshot = async () => JSON.stringify({
  cards: await getDb().getPcicCards(),
  xp: await getXp(day),
  log: answerLog.recent('en→es', 500),
  resume: await loadLearnResume(getDb()),
  mistakes: [await getDb().getMistakeCards(), await getDb().getMistakeBatches()],
  usage: await getDb().getUsageStats(),
});
const reveal = async (screen: Screen, typed: string) => {
  fireEvent.changeText(screen.getByPlaceholderText(/./), typed);
  fireEvent.press(screen.getByText('✓ Check')); await flush();
};
beforeEach(async () => {
  day = localDateString();
  const db = getDb();
  await db.setOnboarding('en', 'es'); await db.resetPcicCards(); await db.resetGameProgress(RESUME_GAME_ID);
  await db.setPcicLevel('A1'); await db.setPcicNewBonus(0, day);
  await db.setTiredButton(false); await db.setMissCap(false); await db.setFatigueDetector(false);
});

it('offers the retype button only on the revealed card', async () => {
  const screen = render(<PcicScreen />); await flush();
  expect(screen.queryByTestId('learn-retype')).toBeNull();
  await reveal(screen, 'x');
  expect(screen.getByTestId('learn-retype')).toBeTruthy();
});
it('tells right from wrong and changes nothing: scheduler card, XP, logs, resume and mistakes stay bit for bit', async () => {
  const screen = render(<PcicScreen />); await flush();
  const answer = String(screen.getAllByText(/^word\d$/)[0].props.children).replace('word', 'palabra');
  await reveal(screen, 'nope');
  const before = await snapshot();
  const header = screen.toJSON();
  fireEvent.press(screen.getByTestId('learn-retype')); await flush();
  expect(screen.queryByTestId('learn-retype-result')).toBeNull();
  fireEvent.changeText(screen.getByTestId('learn-retype-input'), 'wrong'); fireEvent(screen.getByTestId('learn-retype-input'), 'submitEditing'); await flush();
  expect(screen.getByTestId('learn-retype-result').props.children).toBe('Not quite, try again');
  fireEvent.changeText(screen.getByTestId('learn-retype-input'), answer); fireEvent(screen.getByTestId('learn-retype-input'), 'submitEditing'); await flush();
  expect(screen.getByTestId('learn-retype-result').props.children).toBe('Correct');
  expect(await snapshot()).toBe(before);
  expect(header).toBeTruthy();
  // the card is still the same revealed one, and grading it afterwards works as before
  expect(screen.getByText(/^Next →/)).toBeTruthy();
});
it('resets on the next card', async () => {
  const screen = render(<PcicScreen />); await flush();
  await reveal(screen, 'nope');
  fireEvent.press(screen.getByTestId('learn-retype')); await flush();
  fireEvent.changeText(screen.getByTestId('learn-retype-input'), 'x'); fireEvent(screen.getByTestId('learn-retype-input'), 'submitEditing'); await flush();
  fireEvent.press(screen.getByText(/^Next →/)); await flush();
  expect(screen.queryByTestId('learn-retype-input')).toBeNull();
  expect(screen.queryByTestId('learn-retype-result')).toBeNull();
});
it('makes the docked bar the retype Check while typing, even with the keyboard open, then Next again', async () => {
  const screen = render(<PcicScreen />); await flush();
  await reveal(screen, 'nope');
  fireEvent.press(screen.getByTestId('learn-retype')); await flush();
  fireEvent(screen.getByTestId('learn-retype-input'), 'focus');
  act(() => { DeviceEventEmitter.emit('keyboardDidShow', { endCoordinates: { height: 300 } }); }); await flush();
  expect(screen.getByTestId('learn-dock')).toBeTruthy();
  fireEvent.changeText(screen.getByTestId('learn-retype-input'), 'palabrx');
  fireEvent.press(screen.getByText('✓ Check')); await flush();
  expect(screen.getByTestId('learn-retype-result').props.children).toBe('Not quite, try again');
  expect(screen.getByTestId('learn-retype-diff')).toBeTruthy();
  fireEvent(screen.getByTestId('learn-retype-input'), 'blur');
  act(() => { DeviceEventEmitter.emit('keyboardDidHide', {}); }); await flush();
  expect(screen.getByText(/^Next →/)).toBeTruthy();
});
it('shows the docked bar on the next card when the retype field never got a blur', async () => {
  const screen = render(<PcicScreen />); await flush();
  await reveal(screen, 'nope');
  fireEvent.press(screen.getByTestId('learn-retype')); await flush();
  fireEvent(screen.getByTestId('learn-retype-input'), 'focus');
  act(() => { DeviceEventEmitter.emit('keyboardDidShow', { endCoordinates: { height: 300 } }); }); await flush();
  fireEvent.changeText(screen.getByTestId('learn-retype-input'), 'x'); fireEvent(screen.getByTestId('learn-retype-input'), 'submitEditing'); await flush();
  expect(screen.queryByTestId('learn-dock')).toBeNull();
  fireEvent.press(screen.getByText("Knew it")); await flush();
  expect(screen.queryByTestId('learn-retype-input')).toBeNull();
  expect(screen.getByTestId('learn-dock')).toBeTruthy();
});
it('puts a Retype button beside the field after Check, which clears the field for a new try', async () => {
  const screen = render(<PcicScreen />); await flush();
  await reveal(screen, 'nope');
  fireEvent.press(screen.getByTestId('learn-retype')); await flush();
  expect(screen.queryByTestId('learn-retype-again')).toBeNull();
  fireEvent.changeText(screen.getByTestId('learn-retype-input'), 'x'); fireEvent(screen.getByTestId('learn-retype-input'), 'submitEditing'); await flush();
  const row = screen.getByTestId('learn-retype-input').parent!.parent!;
  expect(row.findAll((n) => n.props?.testID === 'learn-retype-again').length).toBeGreaterThan(0);
  fireEvent.press(screen.getAllByTestId('learn-retype-again')[0]); await flush();
  expect(screen.getByTestId('learn-retype-input').props.value).toBe('');
  expect(screen.queryByTestId('learn-retype-result')).toBeNull();
  expect(screen.getByText('✓ Check')).toBeTruthy();
});
