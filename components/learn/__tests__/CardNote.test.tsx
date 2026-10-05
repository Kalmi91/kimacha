// PLAN-fb1005i 2. lépés (FB498/500): az (i) alatti rész a kártya képét és forrássorát mutatja;
// képtelen kártyán nincs kép-elem, és ha se kép, se magyarázat nincs, semmi nem renderel.
import { render } from '@testing-library/react-native';
import Colors from '@/constants/Colors';
import { findPcicItem, setPcicTarget } from '@/data/pcic';
import CardNote from '../CardNote';

describe('CardNote (kép + forrássor + magyarázat)', () => {
  beforeEach(() => setPcicTarget('es'));

  it('a képes kártyán kép-elem és forrássor van (szerző, licenc, Wikimedia Commons)', () => {
    const item = findPcicItem('o2771');
    const { getByTestId, getByText } = render(<CardNote note={item?.note} image={item?.image} colors={Colors.light} />);
    expect(getByTestId('learn-image')).toBeTruthy();
    expect(getByTestId('learn-image-credit')).toBeTruthy();
    expect(getByText('Photo: StoppedTime, CC0, Wikimedia Commons')).toBeTruthy();
    expect(getByTestId('learn-note')).toBeTruthy();
  });

  it('a magyarázat nélküli képes kártyán csak a kép és a forrássor van', () => {
    const item = findPcicItem('o1510');
    expect(item?.note).toBeUndefined();
    const { getByTestId, queryByTestId } = render(<CardNote note={item?.note} image={item?.image} colors={Colors.light} />);
    expect(getByTestId('learn-image')).toBeTruthy();
    expect(queryByTestId('learn-note')).toBeNull();
  });

  it('a képtelen kártyán nincs kép-elem és nincs forrássor', () => {
    const { queryByTestId, getByTestId } = render(<CardNote note="Just a note." colors={Colors.light} />);
    expect(queryByTestId('learn-image')).toBeNull();
    expect(queryByTestId('learn-image-credit')).toBeNull();
    expect(getByTestId('learn-note')).toBeTruthy();
  });

  it('se kép, se magyarázat -> nem renderel semmit', () => {
    const { toJSON } = render(<CardNote colors={Colors.light} />);
    expect(toJSON()).toBeNull();
  });
});
