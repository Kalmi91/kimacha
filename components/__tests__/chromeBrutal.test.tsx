// StatusBarStrip, UsageToast and MistakesEntry on the brutalist palette
// (SegmentBar / ink line / BrutalBox, corner 0), today's look on the classic palette.

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

import { act, render, waitFor } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import Colors from '@/constants/Colors';
import { getDb } from '@/lib/database';
import { validateMistakesPayload } from '@/lib/mistakes/format';
import sample from '@/lib/mistakes/__fixtures__/sample.json';
import { ThemeProvider } from '@/lib/ThemeContext';
import StatusBarStrip from '../StatusBarStrip';
import UsageToast from '../UsageToast';
import MistakesEntry from '../learn/MistakesEntry';
import { makeFlush } from '@/test-utils/flush';

jest.setTimeout(30000);

const flush = makeFlush(6);

const wrap = (ui: React.ReactElement) => <ThemeProvider>{ui}</ThemeProvider>;

// ThemeProvider reads the palette from the database after its first render, and until then it shows the
// default (brand). A flush only drains a fixed number of microtask turns, which is not enough when the
// machine is loaded, so every check waits for the end state it is about (a longer limit than the 1 s
// default, for a loaded machine).
const SETTLE = { timeout: 5000 };

describe('Header elements, neo-brutalist', () => {
  it('StatusBarStrip: with the brand palette a bottom ink line, with the classic palette none', async () => {
    await getDb().setGrammarPalette('brand');
    const brand = render(wrap(<StatusBarStrip />));
    await flush();
    await waitFor(() => {
      expect(StyleSheet.flatten(brand.getByTestId('status-bar-strip').props.style).borderBottomWidth).toBe(2.5);
    }, SETTLE);
    brand.unmount();

    await getDb().setGrammarPalette('classic');
    const classic = render(wrap(<StatusBarStrip />));
    await flush();
    await waitFor(() => {
      expect(StyleSheet.flatten(classic.getByTestId('status-bar-strip').props.style).borderBottomWidth).toBeUndefined();
    }, SETTLE);
    classic.unmount();
  });

  it('UsageToast: with the brand palette a BrutalBox (corner 0), with the classic palette a pill', async () => {
    const { __fireMinute } = jest.requireMock('@/lib/usageTimer');
    await getDb().setGrammarPalette('brand');
    const brand = render(wrap(<UsageToast />));
    await flush();
    act(() => __fireMinute());
    expect(await brand.findByTestId('usage-toast', {}, SETTLE)).toBeTruthy();
    brand.unmount();

    await getDb().setGrammarPalette('classic');
    const classic = render(wrap(<UsageToast />));
    await flush();
    act(() => __fireMinute());
    // The toast first draws in the default (brand) look, then turns into the pill once the palette is read.
    expect(await classic.findByTestId('usage-toast-pill', {}, SETTLE)).toBeTruthy();
    expect(classic.queryByTestId('usage-toast')).toBeNull();
    classic.unmount();
  });

  it('UsageToast: does not draw while hidden (onboarding), the classic pill has its own identifier', async () => {
    const { __fireMinute } = jest.requireMock('@/lib/usageTimer');
    await getDb().setGrammarPalette('brand');
    const hiddenBrand = render(wrap(<UsageToast hidden />));
    await flush();
    act(() => __fireMinute());
    expect(hiddenBrand.queryByTestId('usage-toast')).toBeNull();
    hiddenBrand.unmount();

    // A hidden and a visible toast side by side: the pill only exists once the classic palette is read, and
    // findByTestId fails on two matches, so exactly one pill means the hidden toast drew none.
    await getDb().setGrammarPalette('classic');
    const classic = render(wrap(<><UsageToast hidden /><UsageToast /></>));
    await flush();
    act(() => __fireMinute());
    expect(await classic.findByTestId('usage-toast-pill', {}, SETTLE)).toBeTruthy();
    classic.unmount();
  });

  it('MistakesEntry: with the brand palette a BrutalBox entry, with the classic palette the current row', async () => {
    const result = validateMistakesPayload(sample);
    if (!result.ok) throw new Error(result.error);
    await getDb().saveMistakeBatch(result.batch.batchId, JSON.stringify(result.batch), '2026-09-23T10:00:00.000Z');

    await getDb().setGrammarPalette('brand');
    const brand = render(wrap(<MistakesEntry colors={Colors.light} />));
    await flush();
    expect(await brand.findByTestId('mistakes-entry', {}, SETTLE)).toBeTruthy();
    brand.unmount();

    await getDb().setGrammarPalette('classic');
    const classic = render(wrap(<MistakesEntry colors={Colors.light} />));
    await flush();
    // The row (📕) is there from the load, as the brand box until the palette is read, then as the plain row.
    await waitFor(() => {
      expect(classic.queryByText(/📕/)).toBeTruthy();
      expect(classic.queryByTestId('mistakes-entry')).toBeNull();
    }, SETTLE);
    classic.unmount();
  });
});
