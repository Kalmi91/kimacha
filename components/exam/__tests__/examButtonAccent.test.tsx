// ExamButton on the brutalist palette: the primary button is ink, with `accent` it takes the
// accent fill (the table deck's Check / Next button, FB722).

import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import * as RN from 'react-native';

import ExamButton from '@/components/exam/ExamButton';
import { getDb } from '@/lib/database';
import { ThemeProvider } from '@/lib/ThemeContext';
import { makeFlush } from '@/test-utils/flush';

const flush = makeFlush(4);

describe('ExamButton accent on the brutalist palette', () => {
  let scheme: jest.SpyInstance;
  beforeEach(async () => {
    scheme = jest.spyOn(RN, 'useColorScheme').mockReturnValue('light');
    await getDb().setGrammarPalette('brand');
    await getDb().setSkin(null);
  });
  afterEach(() => scheme.mockRestore());

  it('accent = the accent fill, plain primary = not the accent', async () => {
    render(
      <ThemeProvider>
        <ExamButton testID="acc" accent label="Next" onPress={() => {}} />
        <ExamButton testID="plain" label="Plain" onPress={() => {}} />
      </ThemeProvider>
    );
    await flush();
    expect(StyleSheet.flatten(screen.getByTestId('acc').props.style).backgroundColor).toBe('#EC4899');
    expect(StyleSheet.flatten(screen.getByTestId('plain').props.style).backgroundColor).not.toBe('#EC4899');
  });
});
