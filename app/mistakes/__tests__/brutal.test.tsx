// NY19: a Hibák riport brutalista palettán (BrutalBox köteg-kártya), classic
// palettán a mai kinézet. Mock-minta: report.test.tsx.

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

describe('Hibák riport, neo-brutalista (NY19)', () => {
  beforeAll(async () => {
    const result = validateMistakesPayload(sample);
    if (!result.ok) throw new Error(result.error);
    await getDb().saveMistakeBatch(result.batch.batchId, JSON.stringify(result.batch), '2026-09-23T10:00:00.000Z');
  });

  it('brand palettán a köteg BrutalBox kártya', async () => {
    await getDb().setGrammarPalette('brand');
    const view = render(<ThemeProvider><MistakesReportScreen /></ThemeProvider>);
    await flush();
    expect(view.queryByTestId('mistakes-batch')).toBeTruthy();
    expect(view.queryByTestId('mistakes-practice-btn')).toBeTruthy();
    view.unmount();
  });

  it('classic palettán a mai kinézet: nincs BrutalBox kártya', async () => {
    await getDb().setGrammarPalette('classic');
    const view = render(<ThemeProvider><MistakesReportScreen /></ThemeProvider>);
    await flush();
    expect(view.queryByTestId('mistakes-batch')).toBeNull();
    expect(view.queryByTestId('mistakes-practice-btn')).toBeTruthy();
    view.unmount();
  });
});
