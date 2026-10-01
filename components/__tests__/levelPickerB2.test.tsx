// PLAN-learn-words-open 2. lépés: a szint-választó lap a valódi data/pcic-kel
// (nem mockolt) az en→es iránynál a B2-t is felkínálja, 191 tétellel; az
// es→en iránynál a B2 üres, ezért a "0 tétel = nem kínáljuk fel" szűrő kihagyja.

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

  it('en→es: a B2 sor ott van, "Upper intermediate", és választható', () => {
    setPcicTarget('es');
    const onSelect = jest.fn();
    const { getByText } = renderSheet('es', onSelect);

    expect(getByText('B2')).toBeTruthy();
    fireEvent.press(getByText('Upper intermediate'));
    expect(onSelect).toHaveBeenCalledWith('B2');
  });

  it('en→es: a B2 sor a 191 tételhez méri a haladást (a B2-höz tartozó o451 kártya "introduced")', () => {
    setPcicTarget('es');
    const introduced = { ...sm2NewCard('o451'), state: 'learning' as const };
    const { getByText } = renderSheet('es', jest.fn(), [introduced]);

    expect(getByText('1 / 191 introduced')).toBeTruthy();
  });

  it('es→en: a B2 üres, nem kínáljuk fel', () => {
    setPcicTarget('en');
    const { queryByText } = renderSheet('en');

    expect(queryByText('B2')).toBeNull();
    expect(queryByText('Upper intermediate')).toBeNull();
  });
});
