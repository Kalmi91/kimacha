// The tabs share one top: StatusBarStrip fills the status bar above the navigator, so the navigator header must not add
// the status bar inset again (it showed as an empty band above the title of Sentences, Speak, Practice, Statistics and
// Settings that the Leaderboard, which draws its own header, did not have). Jest has no layout engine, so this pins the
// one shared option and forbids per-screen header overrides that would make a tab drift again.

jest.mock('@/lib/buildFlavor', () => ({ IS_PLAY_BUILD: false, FEEDBACK_URL: 'https://example.test/feedback' }));
jest.mock('expo-symbols', () => ({ SymbolView: () => null }));
jest.mock('@/lib/speech', () => require('@/test-utils/mocks').speechMock());

type Opts = Record<string, unknown>;
const captured: { screenOptions?: Opts; screens: { name: string; options: Opts }[] } = { screens: [] };

jest.mock('expo-router', () => {
  const React = require('react');
  const Tabs = (props: { screenOptions: Opts; children: React.ReactNode }) => {
    captured.screenOptions = props.screenOptions;
    captured.screens = React.Children.toArray(props.children).map((c: React.ReactElement<{ name: string; options: Opts }>) => ({
      name: c.props.name,
      options: c.props.options,
    }));
    return null;
  };
  Tabs.Screen = () => null;
  return { Tabs, router: { replace: jest.fn(), push: jest.fn() } };
});

import { render } from '@testing-library/react-native';

import TabLayout from '@/app/(tabs)/_layout';
import { ThemeProvider } from '@/lib/ThemeContext';
import { makeFlush } from '@/test-utils/flush';

const flush = makeFlush(8);

describe('tab navigator header top', () => {
  it('adds no status bar inset of its own, for every tab at once', async () => {
    const view = render(
      <ThemeProvider>
        <TabLayout />
      </ThemeProvider>
    );
    await flush();
    expect(captured.screens.map((s) => s.name)).toEqual(['index', 'course', 'sentences', 'speak', 'practice', 'board', 'stats', 'settings']);
    expect(captured.screenOptions?.headerStatusBarHeight).toBe(0);
    for (const s of captured.screens) {
      // a tab may only switch its header off (it draws its own); any other header option on a tab is a second top handling
      const headerKeys = Object.keys(s.options).filter((k) => k.startsWith('header') && k !== 'headerShown');
      expect({ tab: s.name, headerKeys }).toEqual({ tab: s.name, headerKeys: [] });
    }
    view.unmount();
  });
});
