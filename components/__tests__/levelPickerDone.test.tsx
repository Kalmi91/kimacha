// FB547: the level picker marks every level that is started and has nothing due, not only the active one.
// A2 was finished today (0 due), A1 (the active level) still has due cards, B1 was never started.

import { render } from '@testing-library/react-native';

import Colors from '@/constants/Colors';
import { pcicItemsForLevel } from '@/data/pcic';
import { addDays, sm2NewCard, type Sm2Card } from '@/lib/sm2';
import { localDateString } from '@/lib/usageStats';
import LevelPickerSheet from '../LevelPickerSheet';
import LevelRow from '../LevelRow';

const today = localDateString();
const review = (id: string, due: string): Sm2Card => ({ ...sm2NewCard(id), state: 'review', due });

const renderSheet = (cards: Sm2Card[], dayDone?: boolean) =>
  render(
    <LevelPickerSheet
      visible
      active="A1"
      cards={cards}
      colors={Colors.light}
      title="Level"
      target="es"
      dayDone={dayDone}
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

// FB699: the active level is green only when today's new batch is done (or it has no new cards left).
describe('LevelPickerSheet: active row needs the day batch (FB699)', () => {
  const started = [review('o1', addDays(today, 3)), sm2NewCard('o2')];
  const doneOf = (cards: Sm2Card[], dayDone: boolean | undefined, level: string) =>
    renderSheet(cards, dayDone).UNSAFE_getAllByType(LevelRow).find((r) => r.props.level === level)?.props.done;

  it('0 due but the new batch is not done: not green', () => {
    expect(doneOf(started, false, 'A1')).toBe(false);
  });
  it('0 due and the batch is done: green', () => {
    expect(doneOf(started, true, 'A1')).toBe(true);
  });
  it('the level has no new cards left: green without the batch', () => {
    const all = pcicItemsForLevel('A1').map((i) => review(i.id, addDays(today, 3)));
    expect(doneOf(all, false, 'A1')).toBe(true);
  });
  it('a non-active level follows FB547 whatever the batch says', () => {
    const cards = [review('o151', addDays(today, 3))];
    expect(doneOf(cards, false, 'A2')).toBe(true);
  });
});
