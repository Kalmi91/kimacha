// a "nincs ilyen képernyő" oldal brutalista palettán BrutalButton, classic palettán a mai link.

jest.mock('@/lib/database', () => jest.requireActual('@/lib/database.web'));
jest.mock('expo-router', () => {
  const React = require('react');
  return {
    Stack: { Screen: () => null },
    Link: ({ children, asChild }: { children: React.ReactElement; asChild?: boolean }) =>
      asChild ? children : React.createElement(React.Fragment, null, children),
  };
});

import { act, render } from '@testing-library/react-native';

import { getDb } from '@/lib/database';
import { ThemeProvider } from '@/lib/ThemeContext';
import NotFoundScreen from '../+not-found';

jest.setTimeout(30000);

const flush = async (times = 6) => {
  for (let i = 0; i < times; i++) {
    await act(async () => {
      await Promise.resolve();
    });
  }
};

describe('Not-found, neo-brutalista (NY25)', () => {
  it('brand palettán BrutalButton, classic palettán a mai link', async () => {
    await getDb().setGrammarPalette('brand');
    const brand = render(<ThemeProvider><NotFoundScreen /></ThemeProvider>);
    await flush();
    expect(brand.queryByTestId('not-found-home')).toBeTruthy();
    brand.unmount();

    await getDb().setGrammarPalette('classic');
    const classic = render(<ThemeProvider><NotFoundScreen /></ThemeProvider>);
    await flush();
    expect(classic.queryByTestId('not-found-home')).toBeNull();
    classic.unmount();
  });
});
