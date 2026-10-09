// az (i) alatti rész a kártya képét és forrássorát mutatja;
// a forrássor koppintásra megnyitja a kép Commons fájl-oldalát, vágott képnél jelzés van a sorban;
// képtelen kártyán nincs kép-elem, és ha se kép, se magyarázat nincs, semmi nem renderel.
import { Linking } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import Colors from '@/constants/Colors';
import { findPcicItem, setPcicTarget } from '@/data/pcic';
import { setLanguage } from '@/lib/i18n';
import CardNote from '../CardNote';

describe('CardNote (kép + forrássor + magyarázat)', () => {
  beforeEach(() => setPcicTarget('es'));
  afterEach(() => {
    setLanguage('en');
    jest.restoreAllMocks();
  });

  it('a vágott képes kártyán kép-elem és forrássor van, a sorban „(cropped)” jelzéssel', () => {
    const item = findPcicItem('o2771');
    const { getByTestId, getByText } = render(<CardNote note={item?.note} image={item?.image} colors={Colors.light} />);
    expect(getByTestId('learn-image')).toBeTruthy();
    expect(getByText('Photo: StoppedTime, CC0, Wikimedia Commons (cropped)')).toBeTruthy();
    expect(getByTestId('learn-note')).toBeTruthy();
  });

  it('a nem vágott (csak átméretezett) képnél nincs „cropped” jelzés', () => {
    const item = findPcicItem('o1510');
    expect(item?.note).toBeUndefined();
    const { getByTestId, getByText, queryByTestId, queryByText } = render(<CardNote note={item?.note} image={item?.image} colors={Colors.light} />);
    expect(getByTestId('learn-image')).toBeTruthy();
    expect(getByText('Photo: SimpleFoodie, Public domain, Wikimedia Commons')).toBeTruthy();
    expect(queryByText(/cropped/)).toBeNull();
    expect(queryByTestId('learn-note')).toBeNull();
  });

  it('spanyol felületen „Foto:” és „(recortada)”', () => {
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

  it('a forrássor link-szerepű, koppintásra a kép forrás-URL-jét nyitja meg', () => {
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
