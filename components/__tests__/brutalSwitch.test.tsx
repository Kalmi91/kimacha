// BrutalSwitch: brutalista palettán ink keretes téglalap sín (role switch + checked
// állapot), classic palettán a mai Switch. Ugyanaz a value / onValueChange API.

jest.mock('@/lib/database', () => jest.requireActual('@/lib/database.web'));

import { act, fireEvent, render } from '@testing-library/react-native';
import { Switch } from 'react-native';

import { BrutalSwitch } from '@/components/grammar/Brutal';
import { getDb } from '@/lib/database';
import { ThemeProvider } from '@/lib/ThemeContext';

jest.setTimeout(30000);

const flush = async (times = 6) => {
  for (let i = 0; i < times; i++) {
    await act(async () => {
      await Promise.resolve();
    });
  }
};

describe('BrutalSwitch (NY25)', () => {
  it('brand palettán switch role + checked állapot, koppintásra az ellentett érték', async () => {
    await getDb().setGrammarPalette('brand');
    const onChange = jest.fn();
    const view = render(
      <ThemeProvider>
        <BrutalSwitch testID="sw" value={false} onValueChange={onChange} />
      </ThemeProvider>
    );
    await flush();
    const el = view.getByTestId('sw');
    expect(el.props.accessibilityRole).toBe('switch');
    expect(el.props.accessibilityState).toMatchObject({ checked: false });
    expect(view.UNSAFE_queryByType(Switch)).toBeNull();
    fireEvent.press(el);
    expect(onChange).toHaveBeenCalledWith(true);
    view.rerender(
      <ThemeProvider>
        <BrutalSwitch testID="sw" value onValueChange={onChange} />
      </ThemeProvider>
    );
    expect(view.getByTestId('sw').props.accessibilityState).toMatchObject({ checked: true });
    view.unmount();
  });

  it('classic palettán a mai Switch', async () => {
    await getDb().setGrammarPalette('classic');
    const view = render(
      <ThemeProvider>
        <BrutalSwitch testID="sw" value={false} onValueChange={jest.fn()} />
      </ThemeProvider>
    );
    await flush();
    expect(view.UNSAFE_queryByType(Switch)).toBeTruthy();
    view.unmount();
  });
});
