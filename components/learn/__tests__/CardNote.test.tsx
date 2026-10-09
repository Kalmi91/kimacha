// the part under the (i) shows the card's image and its source line;
// the source line opens the image's Commons file page on tap, a cropped image is flagged in the line;
// a card without an image has no image element, and if there is neither image nor explanation, nothing renders.
import { Linking } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import Colors from '@/constants/Colors';
import { findPcicItem, setPcicTarget } from '@/data/pcic';
import { setLanguage } from '@/lib/i18n';
import CardNote from '../CardNote';

describe('CardNote (image + source line + explanation)', () => {
  beforeEach(() => setPcicTarget('es'));
  afterEach(() => {
    setLanguage('en');
    jest.restoreAllMocks();
  });

  it('on a cropped-image card there is an image element and a source line, with a "(cropped)" mark in the line', () => {
    const item = findPcicItem('o2771');
    const { getByTestId, getByText } = render(<CardNote note={item?.note} image={item?.image} colors={Colors.light} />);
    expect(getByTestId('learn-image')).toBeTruthy();
    expect(getByText('Photo: StoppedTime, CC0, Wikimedia Commons (cropped)')).toBeTruthy();
    expect(getByTestId('learn-note')).toBeTruthy();
  });

  it('for an uncropped (only resized) image there is no "cropped" mark', () => {
    const item = findPcicItem('o1510');
    expect(item?.note).toBeUndefined();
    const { getByTestId, getByText, queryByTestId, queryByText } = render(<CardNote note={item?.note} image={item?.image} colors={Colors.light} />);
    expect(getByTestId('learn-image')).toBeTruthy();
    expect(getByText('Photo: SimpleFoodie, Public domain, Wikimedia Commons')).toBeTruthy();
    expect(queryByText(/cropped/)).toBeNull();
    expect(queryByTestId('learn-note')).toBeNull();
  });

  it('on the Spanish UI "Foto:" and "(recortada)"', () => {
    setLanguage('es');
    const cropped = findPcicItem('o2771');
    const { getByText, unmount } = render(<CardNote image={cropped?.image} colors={Colors.light} />);
    expect(getByText('Foto: StoppedTime, CC0, Wikimedia Commons (recortada)')).toBeTruthy();
    unmount();
    const plain = findPcicItem('o1510');
    const r = render(<CardNote image={plain?.image} colors={Colors.light} />);
    expect(r.getByText('Foto: SimpleFoodie, Public domain, Wikimedia Commons')).toBeTruthy();
    expect(r.queryByText(/recortada/)).toBeNull();
  });

  it('the source line has a link role, tapping opens the image source URL', () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    const item = findPcicItem('o2771');
    const { getByTestId } = render(<CardNote image={item?.image} colors={Colors.light} />);
    const credit = getByTestId('learn-image-credit');
    expect(credit.props.accessibilityRole).toBe('link');
    fireEvent.press(credit);
    expect(open).toHaveBeenCalledTimes(1);
    expect(open).toHaveBeenCalledWith(item?.image?.sourceUrl);
    expect(item?.image?.sourceUrl).toMatch(/^https:\/\/commons\.wikimedia\.org\/wiki\/File:/);
  });

  it('on a card without an image there is no image element and no source line', () => {
    const { queryByTestId, getByTestId } = render(<CardNote note="Just a note." colors={Colors.light} />);
    expect(queryByTestId('learn-image')).toBeNull();
    expect(queryByTestId('learn-image-credit')).toBeNull();
    expect(getByTestId('learn-note')).toBeTruthy();
  });

  it('neither image nor explanation -> renders nothing', () => {
    const { toJSON } = render(<CardNote colors={Colors.light} />);
    expect(toJSON()).toBeNull();
  });
});
