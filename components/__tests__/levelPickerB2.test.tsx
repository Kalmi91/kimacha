// the level picker sheet, with the real data/pcic (not mocked), also offers B2 for the en→es
// direction, with 763 items, and C1 with 259; for es→en both are empty, so the "0 items = don't offer it" filter
// leaves them out.

import { fireEvent, render } from '@testing-library/react-native';

import Colors from '@/constants/Colors';
import { setPcicTarget } from '@/data/pcic';
import { sm2NewCard } from '@/lib/sm2';
import LevelPickerSheet from '../LevelPickerSheet';

const renderSheet = (target: 'es' | 'en', onSelect = jest.fn(), cards = [sm2NewCard('o451')]) =>
  render(
    <LevelPickerSheet
      visible
      active="A1"
      cards={cards}
      colors={Colors.light}
      title="Level"
      target={target}
      onSelect={onSelect}
      onClose={jest.fn()}
    />,
  );

describe('LevelPickerSheet: B2 (words-open)', () => {
  afterEach(() => setPcicTarget('es'));

  it('en→es: the B2 row is there, "Upper intermediate", and selectable', () => {
    setPcicTarget('es');
    const onSelect = jest.fn();
    const { getByText } = renderSheet('es', onSelect);

    expect(getByText('B2')).toBeTruthy();
    fireEvent.press(getByText('Upper intermediate'));
    expect(onSelect).toHaveBeenCalledWith('B2');
  });

  it('en→es: the B2 row measures progress against 763 items (the o451 card belonging to B2 is "introduced")', () => {
    setPcicTarget('es');
    const introduced = { ...sm2NewCard('o451'), state: 'learning' as const };
    const { getByText } = renderSheet('es', jest.fn(), [introduced]);

    expect(getByText('1 / 763 introduced')).toBeTruthy();
  });

  it('es→en: B2 is empty, we do not offer it', () => {
    setPcicTarget('en');
    const { queryByText } = renderSheet('en');

    expect(queryByText('B2')).toBeNull();
    expect(queryByText('Upper intermediate')).toBeNull();
  });
});

describe('LevelPickerSheet: C1 (words-open)', () => {
  afterEach(() => setPcicTarget('es'));

  it('en→es: the C1 row is there, "Advanced", and selectable', () => {
    setPcicTarget('es');
    const onSelect = jest.fn();
    const { getByText } = renderSheet('es', onSelect);

    expect(getByText('C1')).toBeTruthy();
    fireEvent.press(getByText('Advanced'));
    expect(onSelect).toHaveBeenCalledWith('C1');
  });

  it('en→es: the C1 row measures progress against 259 items (the o1357 card belonging to C1 is "introduced")', () => {
    setPcicTarget('es');
    const introduced = { ...sm2NewCard('o1357'), state: 'learning' as const };
    const { getByText } = renderSheet('es', jest.fn(), [introduced]);

    expect(getByText('1 / 259 introduced')).toBeTruthy();
  });

  it('es→en: C1 is empty, we do not offer it', () => {
    setPcicTarget('en');
    const { queryByText } = renderSheet('en');

    expect(queryByText('C1')).toBeNull();
    expect(queryByText('Advanced')).toBeNull();
  });
});
