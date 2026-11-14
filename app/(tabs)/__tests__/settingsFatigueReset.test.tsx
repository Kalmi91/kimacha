jest.mock('expo-router', () => ({
  ...require('@/test-utils/mocks').focusEffectRouterMock(),
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
}));
jest.mock('expo-file-system', () => ({ File: jest.fn(), Paths: { cache: '' } }));
jest.mock('expo-sharing', () => ({}));
jest.mock('expo-document-picker', () => ({}));
jest.mock('@/lib/speech', () => ({
  ...require('@/test-utils/mocks').speechMock(), loadVoices: jest.fn(async () => []), hasVoiceFor: () => true,
}));

const mockItems = ['a1-w0', 'b1-w0'].map((id, order) => ({ id, es: `palabra${order}`, en: `word${order}`, kind: 'word', section: 'Test', order }));
jest.mock('@/data/pcic', () => ({
  PCIC_LEVELS: ['A1', 'B1'], PCIC_VIEW_LEVELS: ['A1', 'B1'],
  pcicItemsForLevel: (level: string) => mockItems.filter((i) => i.id.startsWith(level.toLowerCase())),
  findPcicItem: (id: string) => mockItems.find((i) => i.id === id),
  levelOfItem: (id: string) => id.startsWith('a1-') ? 'A1' : 'B1', setPcicTarget: () => {},
}));

import { Alert } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import { getDb } from '@/lib/database';
import { loadResumeValue, saveResumeValue } from '@/lib/resumeStore';
import { RESUME_GAME_ID } from '@/lib/resumeRoute';
import { sm2NewCard } from '@/lib/sm2';
import { localDateString } from '@/lib/usageStats';
import { makeFlush } from '@/test-utils/flush';
import SettingsScreen from '../../settings-data';
import PcicScreen from '../index';

const flush = makeFlush(8);

afterEach(() => jest.restoreAllMocks());

it('resetting a level clears misses and parked cards, preserves tired mode, and offers the reset card again', async () => {
  const db = getDb();
  const day = localDateString();
  await db.setOnboarding('en', 'es');
  await db.resetPcicCards();
  await db.resetGameProgress(RESUME_GAME_ID);
  await db.setPcicLevel('A1');
  await db.setTiredButton(true);
  await db.setMissCap(true);
  for (const item of mockItems) await db.upsertPcicCard({ ...sm2NewCard(item.id), state: 'review', introducedAt: day, due: day });
  const otherLevelCard = await db.getPcicCard('b1-w0');
  await saveResumeValue(db, 'fatigue', { day, tired: true, misses: { 'a1-w0': 4, 'b1-w0': 4 }, parked: ['a1-w0', 'b1-w0'] });
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  const settings = render(<SettingsScreen />);
  await flush();
  fireEvent.press(settings.getByTestId('settings-reset-section'));
  await flush();
  fireEvent.press(settings.getByText('🗑️ Reset progress (A1)'));
  const buttons = alert.mock.calls[alert.mock.calls.length - 1][2]!;
  const confirm = buttons.find((button) => button.style === 'destructive')!;
  await act(async () => confirm.onPress!());
  await flush();
  expect(await db.getPcicCard('a1-w0')).toBeNull();
  expect(await db.getPcicCard('b1-w0')).toEqual(otherLevelCard);
  expect(await loadResumeValue(db, 'fatigue')).toEqual({ day, tired: true, misses: {}, parked: [] });
  settings.unmount();
  const learn = render(<PcicScreen />);
  await flush();
  expect(learn.getByText('word0')).toBeTruthy();
});
