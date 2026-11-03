// FB547: the level picker marks every level that is started and has nothing due, not only the active one.
// A2 was finished today (0 due), A1 (the active level) still has due cards, B1 was never started.

import { render } from '@testing-library/react-native';

import Colors from '@/constants/Colors';
import { addDays, sm2NewCard, type Sm2Card } from '@/lib/sm2';
import { localDateString } from '@/lib/usageStats';
import LevelPickerSheet from '../LevelPickerSheet';
import LevelRow from '../LevelRow';

const today = localDateString();
const review = (id: string, due: string): Sm2Card => ({ ...sm2NewCard(id), state: 'review', due });

const renderSheet = (cards: Sm2Card[]) =>
  render(
    <LevelPickerSheet
      visible
      active="A1"
      cards={cards}
      colors={Colors.light}
      title="Level"
      target="es"
      onSelect={jest.fn()}
      onClose={jest.fn()}
    />,
  );

describe('LevelPickerSheet: done rows (FB547)', () => {
  it('A2 finished (0 due) is done, A1 with due cards (the active level) and the never started B1 are not', () => {
    const cards = [review('o151', addDays(today, 3)), review('o1', today), sm2NewCard('o301')];
    const { UNSAFE_getAllByType } = renderSheet(cards);
    const rows = UNSAFE_getAllByType(LevelRow);
    const doneOf = (level: string) => rows.find((r) => r.props.level === level)?.props.done;

    expect(doneOf('A2')).toBe(true);
    expect(doneOf('A1')).toBe(false);
    expect(doneOf('B1')).toBe(false);
  });
});
