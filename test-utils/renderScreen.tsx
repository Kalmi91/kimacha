import { render } from '@testing-library/react-native';
import type { ReactElement } from 'react';

import { ThemeProvider } from '@/lib/ThemeContext';
import { flush } from './flush';

// render() inside the app's ThemeProvider, then a flush so the first effects have run. The palette
// and skin load from the database after that; wait for what the test checks with findBy* / waitFor.
export async function renderScreen(ui: ReactElement, flushTimes?: number) {
  const view = render(<ThemeProvider>{ui}</ThemeProvider>);
  await flush(flushTimes);
  return view;
}
