// PLAN-vizsga C. szakasz (Kálmán, 2026-10-01, C1 a): a szintválasztó lapon a szint-sorok mellett
// ott a halk szintfelmérő-belépő; a kézi szintválasztás továbbra is működik.

import { fireEvent, render } from '@testing-library/react-native';

import Colors from '@/constants/Colors';
import { setPcicTarget } from '@/data/pcic';
import { sm2NewCard } from '@/lib/sm2';
import LevelPickerSheet from '../LevelPickerSheet';

const renderSheet = (onSelect = jest.fn(), onPlacement?: () => void) =>
  render(
    <LevelPickerSheet
      visible
      active="A1"
      cards={[sm2NewCard('o1')]}
      colors={Colors.light}
      title="Level"
      target="es"
      onPlacement={onPlacement}
      onSelect={onSelect}
      onClose={jest.fn()}
    />,
  );

describe('LevelPickerSheet: szintfelmérő-belépő', () => {
  beforeEach(() => setPcicTarget('es'));

  it('a szint-sorok alatt ott a belépő, és koppintásra elindul', () => {
    const onPlacement = jest.fn();
    const { getByText, getByTestId } = renderSheet(jest.fn(), onPlacement);

    expect(getByText('Not sure? Take the 3 minute placement test')).toBeTruthy();
    fireEvent.press(getByTestId('placement-entry'));
    expect(onPlacement).toHaveBeenCalledTimes(1);
  });

  it('a kézi szintválasztás megmarad: a sor koppintása a szintet választja, a belépő nem', () => {
    const onSelect = jest.fn();
    const onPlacement = jest.fn();
    const { getByText } = renderSheet(onSelect, onPlacement);

    fireEvent.press(getByText('Elementary'));
    expect(onSelect).toHaveBeenCalledWith('A2');
    expect(onPlacement).not.toHaveBeenCalled();
  });

  it('belépő nélkül (onPlacement nincs) a sor sem jelenik meg', () => {
    const { queryByTestId } = renderSheet();
    expect(queryByTestId('placement-entry')).toBeNull();
  });
});
