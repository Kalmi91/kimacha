// the Mistakes report on the brutalist palette (BrutalBox batch card), classic
// palette is today's look. Mock pattern: report.test.tsx.

jest.mock('@/lib/database', () => jest.requireActual('@/lib/database.web'));

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), push: jest.fn() }),
}));

import { act, render } from '@testing-library/react-native';

import { getDb } from '@/lib/database';
import { ThemeProvider } from '@/lib/ThemeContext';
import { validateMistakesPayload } from '@/lib/mistakes/format';
import sample from '@/lib/mistakes/__fixtures__/sample.json';
import MistakesReportScreen from '../index';

jest.setTimeout(30000);

const flush = async (times = 6) => {
  for (let i = 0; i < times; i++) {
    await act(async () => {
      await Promise.resolve();
    });
  }
};

describe('Mistakes report, neo-brutalist', () => {
  beforeAll(async () => {
    const result = validateMistakesPayload(sample);
    if (!result.ok) throw new Error(result.error);
    await getDb().saveMistakeBatch(result.batch.batchId, JSON.stringify(result.batch), '2026-09-23T10:00:00.000Z');
  });

  it('with the brand palette the batch is a BrutalBox card', async () => {
    await getDb().setGrammarPalette('brand');
    const view = render(<ThemeProvider><MistakesReportScreen /></ThemeProvider>);
    await flush();
    expect(view.queryByTestId('mistakes-batch')).toBeTruthy();
    expect(view.queryByTestId('mistakes-practice-btn')).toBeTruthy();
    view.unmount();
  });

  it('with the classic palette the current look stays: no BrutalBox card', async () => {
    await getDb().setGrammarPalette('classic');
    const view = render(<ThemeProvider><MistakesReportScreen /></ThemeProvider>);
    await flush();
    expect(view.queryByTestId('mistakes-batch')).toBeNull();
    expect(view.queryByTestId('mistakes-practice-btn')).toBeTruthy();
    view.unmount();
  });
});
