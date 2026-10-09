// the level picker sheet, with the real data/pcic (not mocked), also offers B2 for the en→es
// direction, with 1022 items; for es→en B2 is empty, so the "0 items = don't offer it" filter
// leaves it out.

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

  it('en→es: the B2 row measures progress against 1022 items (the o451 card belonging to B2 is "introduced")', () => {
    setPcicTarget('es');
    const introduced = { ...sm2NewCard('o451'), state: 'learning' as const };
    const { getByText } = renderSheet('es', jest.fn(), [introduced]);

    expect(getByText('1 / 1022 introduced')).toBeTruthy();
  });

  it('es→en: B2 is empty, we do not offer it', () => {
    setPcicTarget('en');
    const { queryByText } = renderSheet('en');

    expect(queryByText('B2')).toBeNull();
    expect(queryByText('Upper intermediate')).toBeNull();
  });
});
