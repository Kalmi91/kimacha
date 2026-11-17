jest.mock('@/lib/speech', () => require('@/test-utils/mocks').speechMock());
jest.mock('expo-router', () => require('@/test-utils/mocks').focusEffectRouterMock());
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, left: 0, right: 0, bottom: 24 }),
}));

const mockItem = {
  id: 'b1-short-screen', es: 'el agave', en: 'agave liquor', kind: 'word', section: 'Test', order: 0,
  image: { source: { uri: 'https://example.com/picture.png' }, width: 320, height: 240, sourceUrl: 'https://example.com', author: 'Test', license: 'CC0' },
};
jest.mock('@/data/pcic', () => ({
  PCIC_LEVELS: ['B1'], PCIC_VIEW_LEVELS: ['B1'], pcicItemsForLevel: () => [mockItem],
  findPcicItem: (id: string) => id === mockItem.id ? mockItem : undefined,
  setPcicTarget: () => {},
}));

import { Children, isValidElement } from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { DeviceEventEmitter, Dimensions, Platform, TextInput } from 'react-native';

import BadgeRow from '@/components/learn/BadgeRow';
import CardNote from '@/components/learn/CardNote';
import CardShell from '@/components/learn/CardShell';
import { getDb } from '@/lib/database';
import { makeFlush } from '@/test-utils/flush';
import PcicScreen from '../index';

const flush = makeFlush(6);
const originalWindow = Dimensions.get('window');
const showKeyboard = () => act(() => DeviceEventEmitter.emit('keyboardDidShow', { endCoordinates: { height: 308 } }));
const hideKeyboard = () => act(() => DeviceEventEmitter.emit('keyboardDidHide', {}));

function cardOrder(screen: ReturnType<typeof render>) {
  const children = Children.toArray(screen.UNSAFE_getByType(CardShell).props.children);
  return {
    field: children.findIndex(child => isValidElement(child) && child.type === TextInput),
    picture: children.findIndex(child => isValidElement(child) && child.type === CardNote),
  };
}

beforeEach(async () => {
  jest.replaceProperty(Platform, 'OS', 'android');
  act(() => Dimensions.set({ window: { width: 411, height: 609, scale: 2.625, fontScale: 1 } }));
  const db = getDb();
  await db.setOnboarding('en', 'es');
  await db.setPcicLevel('B1');
  await db.resetPcicCards();
});

afterEach(() => {
  act(() => Dimensions.set({ window: originalWindow }));
  jest.restoreAllMocks();
});

it.each([false, true])('keeps the focused input mounted when compacting, picture open=%s', async (pictureOpen) => {
  const screen = render(<PcicScreen />);
  await flush();
  if (pictureOpen) fireEvent.press(screen.getByTestId('learn-info'));
  const input = screen.UNSAFE_getByType(TextInput);
  fireEvent.changeText(input, 'aga');
  // The field's slot in the card must not move when the keys open: a moved slot remounts it and Android closes the keyboard.
  const fieldSlot = cardOrder(screen).field;

  showKeyboard();
  await flush();
  expect(screen.UNSAFE_getByType(TextInput)).toBe(input);
  expect(cardOrder(screen).field).toBe(fieldSlot);
  expect(input.props.value).toBe('aga');
  expect(input.props.returnKeyType).toBe('done');
  expect(screen.getByText('agave liquor')).toBeTruthy();
  expect(screen.getByLabelText('Feedback')).toBeTruthy();
  expect(screen.UNSAFE_queryByType(BadgeRow)).toBeNull();
  expect(screen.queryByTestId('learn-progress-fill')).toBeNull();
  expect(screen.queryByTestId('learn-dock')).toBeNull();
  if (pictureOpen) {
    expect(screen.getByTestId('learn-image')).toBeTruthy();
    expect(cardOrder(screen).field).toBeLessThan(cardOrder(screen).picture);
  }

  hideKeyboard();
  await flush();
  expect(screen.UNSAFE_getByType(TextInput)).toBe(input);
  expect(input.props.value).toBe('aga');
  expect(screen.UNSAFE_getByType(BadgeRow)).toBeTruthy();
  expect(screen.getByTestId('learn-progress-fill')).toBeTruthy();
  expect(screen.getByTestId('learn-dock')).toBeTruthy();
  expect(cardOrder(screen).field).toBe(fieldSlot);
  if (pictureOpen) expect(cardOrder(screen).field).toBeLessThan(cardOrder(screen).picture);
});

it('submits with the keyboard action while Check is hidden', async () => {
  const screen = render(<PcicScreen />);
  await flush();
  showKeyboard();
  fireEvent.changeText(screen.UNSAFE_getByType(TextInput), 'agave');
  fireEvent(screen.UNSAFE_getByType(TextInput), 'submitEditing');
  await flush();
  expect(screen.UNSAFE_getByType(TextInput).props.editable).toBe(false);
  expect(screen.getByTestId('learn-dock')).toBeTruthy();
  expect(screen.queryByText('✓ Check')).toBeNull();
});

it('leaves the tall Android layout unchanged with the picture open', async () => {
  act(() => Dimensions.set({ window: { width: 411, height: 914, scale: 2.625, fontScale: 1 } }));
  const screen = render(<PcicScreen />);
  await flush();
  fireEvent.press(screen.getByTestId('learn-info'));
  showKeyboard();
  await flush();
  expect(screen.UNSAFE_getByType(BadgeRow)).toBeTruthy();
  expect(screen.getByTestId('learn-progress-fill')).toBeTruthy();
  expect(screen.getByTestId('learn-dock')).toBeTruthy();
  expect(cardOrder(screen).field).toBeGreaterThan(cardOrder(screen).picture);
  expect(screen.UNSAFE_getByType(TextInput).props.returnKeyType).toBeUndefined();
});
