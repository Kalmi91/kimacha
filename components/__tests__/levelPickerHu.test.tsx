// the level picker sheet, with the real data/pcic (not mocked), offers every level A1-C1 for the Hungarian target
// (es→hu and en→hu), each row measured against the cards of its own level. The totals come from the data files.

import { fireEvent, render } from '@testing-library/react-native';

import Colors from '@/constants/Colors';
import { setPcicTarget } from '@/data/pcic';
import { sm2NewCard } from '@/lib/sm2';
import LevelPickerSheet from '../LevelPickerSheet';

const COUNT = (file: string) => (require(`@/data/words/hu/${file}.json`) as unknown[]).length;
const FIRST_ID = (file: string) => `h${(require(`@/data/words/hu/${file}.json`) as { id: number }[])[0].id}`;

const renderSheet = (cards = [sm2NewCard('h20000')], onSelect = jest.fn()) =>
  render(
    <LevelPickerSheet
      visible
      active="A1"
      cards={cards}
      colors={Colors.light}
      title="Level"
      target="hu"
      onSelect={onSelect}
      onClose={jest.fn()}
    />,
  );

describe('LevelPickerSheet: Hungarian target (A2-C1)', () => {
  afterEach(() => setPcicTarget('es'));

  it.each([['es'], ['en']])('%s→hu: every level row is there and selectable', (source) => {
    setPcicTarget('hu', source);
    const onSelect = jest.fn();
    const { getByText } = renderSheet([], onSelect);

    for (const [badge, label] of [['A1', 'Beginner'], ['A2', 'Elementary'], ['B1', 'Intermediate'], ['B2', 'Upper intermediate'], ['C1', 'Advanced']]) {
      expect(getByText(badge)).toBeTruthy();
      fireEvent.press(getByText(label));
      expect(onSelect).toHaveBeenLastCalledWith(badge);
    }
  });

  it.each([['A2', 'a2'], ['B1', 'b1'], ['B2', 'b2'], ['C1', 'c1']])(
    'en→hu: the %s row measures progress against the %s file (one introduced card)',
    (level, file) => {
      setPcicTarget('hu', 'en');
      const introduced = { ...sm2NewCard(FIRST_ID(file)), state: 'learning' as const };
      const { getByText } = renderSheet([introduced]);

      expect(getByText(`1 / ${COUNT(file)} introduced`)).toBeTruthy();
      expect(level).toBe(file.toUpperCase());
    },
  );
});
