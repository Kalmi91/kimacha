// UsageToast has one position, the top one, on every screen (FB757): no `bottom`, no `low` variant.

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('expo-status-bar', () => ({ StatusBar: () => null }));
jest.mock('@/lib/usageTimer', () => {
  const listeners: (() => void)[] = [];
  return {
    onActiveMinute: (cb: () => void) => {
      listeners.push(cb);
      return () => {
        listeners.splice(listeners.indexOf(cb), 1);
      };
    },
    onUsageMilestone: () => () => {},
    onDayRollover: () => () => {},
    __fireMinute: () => listeners.forEach((cb) => cb()),
  };
});

import * as fs from 'fs';
import * as path from 'path';
import { act, render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { getDb } from '@/lib/database';
import { ThemeProvider } from '@/lib/ThemeContext';
import UsageToast from '../UsageToast';
import { makeFlush } from '@/test-utils/flush';

jest.setTimeout(30000);

const flush = makeFlush(6);

const wrap = (ui: React.ReactElement) => <ThemeProvider>{ui}</ThemeProvider>;

const root = path.resolve(__dirname, '..', '..');
const read = (rel: string) => fs.readFileSync(path.join(root, rel), 'utf8');

afterEach(() => {
  jest.useRealTimers();
});

describe('UsageToast position', () => {
  it('the shown toast has a numeric top and no bottom', async () => {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
    const { __fireMinute } = jest.requireMock('@/lib/usageTimer');
    await getDb().claimDailyGreeting();
    await getDb().setGrammarPalette('brand');
    const screen = render(wrap(<UsageToast />));
    await flush();
    act(() => __fireMinute());
    const toast = screen.getByTestId('usage-toast');
    const style = StyleSheet.flatten(toast.props.style);
    expect(typeof style.top).toBe('number');
    expect(style.bottom).toBeUndefined();
    screen.unmount();
  });

  it('the source has no bottom key and no low prop', () => {
    const toast = read('components/UsageToast.tsx');
    expect(toast).not.toMatch(/\bbottom\s*:/);
    expect(toast).not.toMatch(/\blow\b/);
    expect(read('app/_layout.tsx')).not.toMatch(/<UsageToast[^>]*\blow=/);
  });
});
