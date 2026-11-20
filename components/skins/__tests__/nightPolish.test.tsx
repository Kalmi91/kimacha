// Night polish (only the Night skin changes): rounded POS label, ResultBadge, gradient progress fill,
// fixed status strip, alternative tab icons + capsule. The other themes keep today's look.
jest.mock('@/lib/buildFlavor', () => ({ IS_PLAY_BUILD: false, FEEDBACK_URL: 'https://example.test/feedback' }));
jest.mock('@/lib/speech', () => require('@/test-utils/mocks').speechMock());
jest.mock('expo-status-bar', () => ({ StatusBar: () => null }));
jest.mock('expo-symbols', () => {
  const { View } = require('react-native');
  return { SymbolView: ({ name }: { name: string | { android: string } }) => <View testID={`sym-${typeof name === 'string' ? name : name.android}`} /> };
});
jest.mock('expo-symbols/androidWeights/light', () => ({ __esModule: true, default: { name: 'light', font: 0 } }));

type Opts = Record<string, unknown>;
const captured: { screenOptions?: Opts; screens: { name: string; options: Opts }[] } = { screens: [] };
jest.mock('expo-router', () => {
  const React = require('react');
  const Tabs = (props: { screenOptions: Opts; children: React.ReactNode }) => {
    captured.screenOptions = props.screenOptions;
    captured.screens = React.Children.toArray(props.children).map((c: React.ReactElement<{ name: string; options: Opts }>) => ({ name: c.props.name, options: c.props.options }));
    return null;
  };
  Tabs.Screen = function Screen() {
    return null;
  };
  return { Tabs, router: { replace: jest.fn(), push: jest.fn() } };
});

import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { StyleSheet, View } from 'react-native';
import * as RN from 'react-native';

import TabLayout from '@/app/(tabs)/_layout';
import ResultBadge from '@/components/ResultBadge';
import StatusBarStrip from '@/components/StatusBarStrip';
import { ContinuousBar } from '@/components/grammar/Brutal';
import { themedInkEdgeStyle } from '@/components/grammar/Themed';
import type { SkinId } from '@/constants/Skins';
import { getDb } from '@/lib/database';
import { useGrammarColors } from '@/lib/grammarColors';
import { ThemeProvider } from '@/lib/ThemeContext';
import { makeFlush } from '@/test-utils/flush';

jest.setTimeout(30000);
const flush = makeFlush(6);
const flat = (id: string) => StyleSheet.flatten(screen.getByTestId(id).props.style);

function Pos() {
  const g = useGrammarColors();
  return <View testID="pos" style={themedInkEdgeStyle(g)} />;
}

async function renderWithSkin(skin: SkinId, ui: React.ReactElement) {
  await getDb().setGrammarPalette('brand');
  await getDb().setSkin(skin);
  const view = render(<ThemeProvider>{ui}</ThemeProvider>);
  await flush();
  return view;
}

describe('Night polish', () => {
  let scheme: jest.SpyInstance;
  beforeEach(() => {
    scheme = jest.spyOn(RN, 'useColorScheme').mockReturnValue('light');
  });
  afterEach(() => scheme.mockRestore());

  it('the POS label is rounded 12 on Night, square on brutal', async () => {
    const night = await renderWithSkin('night', <Pos />);
    await waitFor(() => expect(flat('pos')).toMatchObject({ borderRadius: 12, borderWidth: 1 }));
    night.unmount();
    await renderWithSkin('brutal', <Pos />);
    await waitFor(() => expect(flat('pos')).toMatchObject({ borderRadius: 0, borderWidth: 2 }));
  });

  it('ResultBadge: Night correct is dark green with radius 12, wrong keeps dashed; brutal is unchanged', async () => {
    const night = await renderWithSkin('night', <View><ResultBadge correct testID="ok" /><ResultBadge correct={false} testID="bad" /></View>);
    await waitFor(() => expect(flat('ok')).toMatchObject({ backgroundColor: '#14532D', borderRadius: 12, borderColor: '#34D399' }));
    expect(flat('bad')).toMatchObject({ borderRadius: 12, borderStyle: 'dashed' });
    expect(flat('bad').backgroundColor).not.toBe('#14532D');
    night.unmount();
    await renderWithSkin('brutal', <ResultBadge correct testID="ok" />);
    await waitFor(() => expect(flat('ok').backgroundColor).not.toBe('#14532D'));
    expect(flat('ok').borderRadius).toBeUndefined();
  });

  it('ContinuousBar: gradient on Night, none on brutal', async () => {
    const night = await renderWithSkin('night', <ContinuousBar testID="bar" fillTestID="fill" pct={40} />);
    await waitFor(() => expect(flat('fill')).toMatchObject({ width: '40%', borderRadius: 3 }));
    expect(JSON.stringify(flat('fill'))).toContain('linear-gradient(90deg, #EC4899, #22D3EE)');
    night.unmount();
    await renderWithSkin('brutal', <ContinuousBar testID="bar" fillTestID="fill" pct={40} />);
    await waitFor(() => expect(flat('fill').backgroundColor).toBe('#111111'));
    expect(JSON.stringify(flat('fill'))).not.toContain('gradient');
  });

  it('StatusBarStrip: Night is #150A29 and a tap does not change it', async () => {
    await renderWithSkin('night', <StatusBarStrip />);
    await waitFor(() => expect(flat('status-bar-strip').backgroundColor).toBe('#150A29'));
    fireEvent.press(screen.getByTestId('status-bar-strip'));
    await flush();
    expect(flat('status-bar-strip').backgroundColor).toBe('#150A29');
    expect(flat('status-bar-strip').borderBottomWidth).toBeUndefined();
  });

  it('tab layout: Night shows the school icon in a 16-radius capsule; brutal keeps the list icon', async () => {
    const press = (focused: boolean) => {
      const Btn = captured.screens[0].options.tabBarButton as (p: Record<string, unknown>) => React.ReactElement;
      return render(<Btn aria-selected={focused} />);
    };
    const night = await renderWithSkin('night', <TabLayout />);
    await waitFor(() => expect(captured.screens.length).toBeGreaterThan(0));
    const active = press(true);
    expect(active.getByTestId('sym-school')).toBeTruthy();
    expect(StyleSheet.flatten(active.getByTestId('tab-icon-active').props.style)).toMatchObject({ borderRadius: 16, width: 46, height: 32 });
    expect(JSON.stringify(StyleSheet.flatten(active.getByTestId('tab-icon-active').props.style))).toContain('#EC4899');
    active.unmount();
    night.unmount();
    await renderWithSkin('brutal', <TabLayout />);
    await waitFor(() => expect(captured.screens.length).toBeGreaterThan(0));
    const other = press(true);
    expect(other.getByTestId('sym-list')).toBeTruthy();
    expect(other.queryByTestId('sym-school')).toBeNull();
  });
});
