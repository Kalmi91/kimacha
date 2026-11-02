// the level picker sheet, with the real data/pcic (not mocked), also offers B2 for the en→es
// direction, with every B2 card of data/words-open, and C1 with every C1 card; es→en and hu→en offer them too, with
// the cards of data/words/en b2.json and c1.json. The "0 items = don't offer it" filter would leave a level out if its
// deck were empty. The counts come from the data files, so a new batch of words does not need a test edit (the
// exact totals are pinned in data/__tests__/openWords.test.ts).

import { fireEvent, render } from '@testing-library/react-native';

import Colors from '@/constants/Colors';
import { setPcicTarget } from '@/data/pcic';
import { sm2NewCard } from '@/lib/sm2';
import LevelPickerSheet from '../LevelPickerSheet';

const B2_COUNT = (require('@/data/words-open/b2.json') as unknown[]).length;
const C1_COUNT = (require('@/data/words-open/c1.json') as unknown[]).length;
const EN_B2_COUNT = (require('@/data/words/en/b2.json') as unknown[]).length;
const EN_C1_COUNT = (require('@/data/words/en/c1.json') as unknown[]).length;
const EN_B2_FIRST = `e${(require('@/data/words/en/b2.json') as { id: number }[])[0].id}`;
const EN_C1_FIRST = `e${(require('@/data/words/en/c1.json') as { id: number }[])[0].id}`;

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

  it('en→es: the B2 row measures progress against every B2 item (the o451 card belonging to B2 is "introduced")', () => {
    setPcicTarget('es');
    const introduced = { ...sm2NewCard('o451'), state: 'learning' as const };
    const { getByText } = renderSheet('es', jest.fn(), [introduced]);

    expect(getByText(`1 / ${B2_COUNT} introduced`)).toBeTruthy();
  });

  it.each([
    ['es→en', undefined],
    ['hu→en', 'hu'],
  ])('%s: the B2 row is there (data/words/en/b2.json), and selectable', (_pair, source) => {
    setPcicTarget('en', source);
    const onSelect = jest.fn();
    const { getByText } = renderSheet('en', onSelect);

    expect(getByText('B2')).toBeTruthy();
    fireEvent.press(getByText('Upper intermediate'));
    expect(onSelect).toHaveBeenCalledWith('B2');
  });

  it.each([
    ['es→en', undefined],
    ['hu→en', 'hu'],
  ])('%s: the B2 row measures progress against every en B2 card', (_pair, source) => {
    setPcicTarget('en', source);
    const introduced = { ...sm2NewCard(EN_B2_FIRST), state: 'learning' as const };
    const { getByText } = renderSheet('en', jest.fn(), [introduced]);

    expect(getByText(`1 / ${EN_B2_COUNT} introduced`)).toBeTruthy();
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

  it('en→es: the C1 row measures progress against every C1 item (the o1357 card belonging to C1 is "introduced")', () => {
    setPcicTarget('es');
    const introduced = { ...sm2NewCard('o1357'), state: 'learning' as const };
    const { getByText } = renderSheet('es', jest.fn(), [introduced]);

    expect(getByText(`1 / ${C1_COUNT} introduced`)).toBeTruthy();
  });

  it.each([
    ['es→en', undefined],
    ['hu→en', 'hu'],
  ])('%s: the C1 row is there (data/words/en/c1.json), and selectable', (_pair, source) => {
    setPcicTarget('en', source);
    const onSelect = jest.fn();
    const { getByText } = renderSheet('en', onSelect);

    expect(getByText('C1')).toBeTruthy();
    fireEvent.press(getByText('Advanced'));
    expect(onSelect).toHaveBeenCalledWith('C1');
  });

  it.each([
    ['es→en', undefined],
    ['hu→en', 'hu'],
  ])('%s: the C1 row measures progress against every en C1 card', (_pair, source) => {
    setPcicTarget('en', source);
    const introduced = { ...sm2NewCard(EN_C1_FIRST), state: 'learning' as const };
    const { getByText } = renderSheet('en', jest.fn(), [introduced]);

    expect(getByText(`1 / ${EN_C1_COUNT} introduced`)).toBeTruthy();
  });
});
