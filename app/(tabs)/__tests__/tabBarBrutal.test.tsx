// The tab bar on the brutalist palette (the active icon on a filled box), today's
// plain icon on the classic palette. The Tabs mock renders only the tabBarIcons.

jest.mock('@/lib/database', () => jest.requireActual('@/lib/database.web'));
jest.mock('expo-symbols', () => ({ SymbolView: () => null }));
jest.mock('expo-router', () => {
  const React = require('react');
  const Tabs = ({ children }: { children: React.ReactNode }) =>
    React.createElement(
      React.Fragment,
      null,
      React.Children.map(children, (c: React.ReactElement<any>) =>
        c.props.options.tabBarIcon
          ? c.props.options.tabBarIcon({ color: '#000', focused: c.props.name === 'index' })
          : null
      )
    );
  Tabs.Screen = function Screen() {
    return null;
  };
  return { Tabs };
});

import { act, render } from '@testing-library/react-native';

import { getDb } from '@/lib/database';
import { ThemeProvider } from '@/lib/ThemeContext';
import TabLayout from '../_layout';

jest.setTimeout(30000);

const flush = async (times = 6) => {
  for (let i = 0; i < times; i++) {
    await act(async () => {
      await Promise.resolve();
    });
  }
};

describe('Tab bar, neo-brutalist', () => {
  it('with the brand palette the active icon sits in a box', async () => {
    await getDb().setGrammarPalette('brand');
    const view = render(<ThemeProvider><TabLayout /></ThemeProvider>);
    await flush();
    expect(view.queryAllByTestId('tab-icon-active').length).toBe(1);
    view.unmount();
  });

  it('with the classic palette the current icon: no box', async () => {
    await getDb().setGrammarPalette('classic');
    const view = render(<ThemeProvider><TabLayout /></ThemeProvider>);
    await flush();
    expect(view.queryAllByTestId('tab-icon-active').length).toBe(0);
    view.unmount();
  });
});
