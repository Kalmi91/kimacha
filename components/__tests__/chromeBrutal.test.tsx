// NY25: ProgressMeter, StatusBarStrip, UsageToast és MistakesEntry brutalista palettán
// (SegmentBar / ink vonal / BrutalBox, sarok 0), classic palettán a mai kinézet.

jest.mock('@/lib/database', () => jest.requireActual('@/lib/database.web'));
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

import { act, render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import Colors from '@/constants/Colors';
import { getDb } from '@/lib/database';
import { validateMistakesPayload } from '@/lib/mistakes/format';
import sample from '@/lib/mistakes/__fixtures__/sample.json';
import { ThemeProvider } from '@/lib/ThemeContext';
import ProgressMeter from '../ProgressMeter';
import StatusBarStrip from '../StatusBarStrip';
import UsageToast from '../UsageToast';
import MistakesEntry from '../learn/MistakesEntry';

jest.setTimeout(30000);

const flush = async (times = 6) => {
  for (let i = 0; i < times; i++) {
    await act(async () => {
      await Promise.resolve();
    });
  }
};

const wrap = (ui: React.ReactElement) => <ThemeProvider>{ui}</ThemeProvider>;

describe('Fejléc-elemek, neo-brutalista (NY25)', () => {
  it('ProgressMeter: brand palettán SegmentBar, classic palettán gyémánt-rács', async () => {
    await getDb().setGrammarPalette('brand');
    const brand = render(wrap(<ProgressMeter known={5} total={10} langFlag="x" langName="Español" />));
    await flush();
    expect(brand.queryByTestId('progress-segments')).toBeTruthy();
    // 50% = 4 / 8 kitöltött blokk
    expect(brand.queryByTestId('progress-segments-3')).toBeTruthy();
    brand.unmount();

    await getDb().setGrammarPalette('classic');
    const classic = render(wrap(<ProgressMeter known={5} total={10} langFlag="x" langName="Español" />));
    await flush();
    expect(classic.queryByTestId('progress-segments')).toBeNull();
    classic.unmount();
  });

  it('StatusBarStrip: brand palettán alsó ink vonal, classic palettán nincs', async () => {
    await getDb().setGrammarPalette('brand');
    const brand = render(wrap(<StatusBarStrip />));
    await flush();
    const brandStyle = StyleSheet.flatten(brand.getByTestId('status-bar-strip').props.style);
    expect(brandStyle.borderBottomWidth).toBe(2.5);
    brand.unmount();

    await getDb().setGrammarPalette('classic');
    const classic = render(wrap(<StatusBarStrip />));
    await flush();
    const classicStyle = StyleSheet.flatten(classic.getByTestId('status-bar-strip').props.style);
    expect(classicStyle.borderBottomWidth).toBeUndefined();
    classic.unmount();
  });

  it('UsageToast: brand palettán BrutalBox (sarok 0), classic palettán pirula', async () => {
    const { __fireMinute } = jest.requireMock('@/lib/usageTimer');
    await getDb().setGrammarPalette('brand');
    const brand = render(wrap(<UsageToast />));
    await flush();
    act(() => __fireMinute());
    expect(brand.queryByTestId('usage-toast')).toBeTruthy();
    brand.unmount();

    await getDb().setGrammarPalette('classic');
    const classic = render(wrap(<UsageToast />));
    await flush();
    act(() => __fireMinute());
    expect(classic.queryByTestId('usage-toast')).toBeNull();
    classic.unmount();
  });

  it('UsageToast: hidden alatt (onboarding) nem rajzol, a classic pirulának saját azonosítója van (7F)', async () => {
    const { __fireMinute } = jest.requireMock('@/lib/usageTimer');
    await getDb().setGrammarPalette('brand');
    const hiddenBrand = render(wrap(<UsageToast hidden />));
    await flush();
    act(() => __fireMinute());
    expect(hiddenBrand.queryByTestId('usage-toast')).toBeNull();
    hiddenBrand.unmount();

    await getDb().setGrammarPalette('classic');
    const hiddenClassic = render(wrap(<UsageToast hidden />));
    await flush();
    act(() => __fireMinute());
    expect(hiddenClassic.queryByTestId('usage-toast-pill')).toBeNull();
    hiddenClassic.unmount();

    const classic = render(wrap(<UsageToast />));
    await flush();
    act(() => __fireMinute());
    expect(classic.queryByTestId('usage-toast-pill')).toBeTruthy();
    classic.unmount();
  });

  it('MistakesEntry: brand palettán BrutalBox belépő, classic palettán a mai sor', async () => {
    const result = validateMistakesPayload(sample);
    if (!result.ok) throw new Error(result.error);
    await getDb().saveMistakeBatch(result.batch.batchId, JSON.stringify(result.batch), '2026-09-23T10:00:00.000Z');

    await getDb().setGrammarPalette('brand');
    const brand = render(wrap(<MistakesEntry colors={Colors.light} />));
    await flush();
    expect(brand.queryByTestId('mistakes-entry')).toBeTruthy();
    brand.unmount();

    await getDb().setGrammarPalette('classic');
    const classic = render(wrap(<MistakesEntry colors={Colors.light} />));
    await flush();
    expect(classic.queryByTestId('mistakes-entry')).toBeNull();
    classic.unmount();
  });
});
