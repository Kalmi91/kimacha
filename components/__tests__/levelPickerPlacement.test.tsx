// on the level picker sheet, beside the level rows, there is the quiet placement-test entry;
// manual level selection still works.

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

describe('LevelPickerSheet: placement-test entry', () => {
  beforeEach(() => setPcicTarget('es'));

  it('the entry is under the level rows, and tapping starts it', () => {
    const onPlacement = jest.fn();
    const { getByText, getByTestId } = renderSheet(jest.fn(), onPlacement);

    expect(getByText('Not sure? Take the 3 minute placement test')).toBeTruthy();
    fireEvent.press(getByTestId('placement-entry'));
    expect(onPlacement).toHaveBeenCalledTimes(1);
  });

  it('manual level choice stays: tapping the row selects the level, the entry does not', () => {
    const onSelect = jest.fn();
    const onPlacement = jest.fn();
    const { getByText } = renderSheet(onSelect, onPlacement);

    fireEvent.press(getByText('Elementary'));
    expect(onSelect).toHaveBeenCalledWith('A2');
    expect(onPlacement).not.toHaveBeenCalled();
  });

  it('without the entry (no onPlacement) the row does not show either', () => {
    const { queryByTestId } = renderSheet();
    expect(queryByTestId('placement-entry')).toBeNull();
  });
});
