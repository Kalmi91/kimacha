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

import { fireEvent, render } from '@testing-library/react-native';
import { getDb } from '@/lib/database';
import { RESUME_GAME_ID } from '@/lib/resumeRoute';
import { localDateString } from '@/lib/usageStats';
import { makeFlush } from '@/test-utils/flush';
import PcicScreen from '../index';

const flush = makeFlush(8);
type Screen = ReturnType<typeof render>;
let day: string;
const shown = (screen: Screen) => {
  const hit = screen.queryAllByText(/^word\d$/);
  return hit.length ? String(hit[0].props.children) : null;
};
const pressText = async (screen: Screen, text: string | RegExp) => { fireEvent.press(screen.getByText(text)); await flush(); };
const miss = async (screen: Screen) => { await pressText(screen, '✓ Check'); await pressText(screen, "Next → Didn't know"); };
const typeRight = async (screen: Screen) => {
  const word = shown(screen)!;
  fireEvent.changeText(screen.getByPlaceholderText(/./), word.replace('word', 'palabra'));
  await pressText(screen, '✓ Check');
  await pressText(screen, /^Next →/);
};
beforeEach(async () => {
  day = localDateString();
  const db = getDb();
  await db.setOnboarding('en', 'es'); await db.resetPcicCards(); await db.resetGameProgress(RESUME_GAME_ID);
  await db.setPcicLevel('A1'); await db.setPcicNewBonus(0, day);
  await db.setTiredButton(false); await db.setMissCap(false); await db.setFatigueDetector(false);
  await db.setNewWordGate(true);
});

it('is on by default', async () => {
  await getDb().setOnboarding('es', 'en');
  expect(await getDb().getNewWordGate()).toBe(true);
});
it('keeps asking the missed new word until it is typed right, then lets the next new word in', async () => {
  const screen = render(<PcicScreen />); await flush();
  const first = shown(screen)!;
  await miss(screen); expect(shown(screen)).toBe(first);
  await miss(screen); expect(shown(screen)).toBe(first);
  await typeRight(screen);
  expect(shown(screen)).not.toBe(first);
  expect(shown(screen)).not.toBeNull();
});
it('with the switch off the next new word comes right after a miss, as before', async () => {
  await getDb().setNewWordGate(false);
  const screen = render(<PcicScreen />); await flush();
  const first = shown(screen)!;
  await miss(screen); expect(shown(screen)).not.toBe(first);
});
it('still holds after the screen is reopened', async () => {
  const screen = render(<PcicScreen />); await flush();
  const first = shown(screen)!;
  await miss(screen); screen.unmount();
  const reopened = render(<PcicScreen />); await flush();
  expect(shown(reopened)).toBe(first);
});
it('cannot trap the learner: the missed-card cap parks the word and new words flow again', async () => {
  await getDb().setMissCap(true);
  const screen = render(<PcicScreen />); await flush();
  const first = shown(screen)!;
  for (let i = 0; i < 3; i++) { await miss(screen); expect(shown(screen)).toBe(first); }
  await miss(screen);
  expect(shown(screen)).not.toBe(first);
  expect(shown(screen)).not.toBeNull();
});
it('works together with tired mode', async () => {
  await getDb().setTiredButton(true);
  const screen = render(<PcicScreen />); await flush();
  const first = shown(screen)!;
  await miss(screen); expect(shown(screen)).toBe(first);
  await typeRight(screen); expect(shown(screen)).not.toBe(first);
});
