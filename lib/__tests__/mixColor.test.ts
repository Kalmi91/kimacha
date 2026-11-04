import { mixColor } from '../mixColor';

describe('mixColor', () => {
  it('takes the ratio of the first color and the rest of the second', () => {
    expect(mixColor('#000000', '#FFFFFF', 0.5)).toBe('#808080');
    expect(mixColor('#FF0000', '#0000FF', 1)).toBe('#FF0000');
    expect(mixColor('#FF0000', '#0000FF', 0)).toBe('#0000FF');
  });

  it('reads the short #rgb form and clamps the ratio', () => {
    expect(mixColor('#fff', '#000', 0.25)).toBe('#404040');
    expect(mixColor('#fff', '#000', 5)).toBe('#FFFFFF');
    expect(mixColor('#fff', '#000', -1)).toBe('#000000');
  });

  it('returns the first color when either one is not a hex color', () => {
    expect(mixColor('rgba(0,0,0,0.5)', '#FFFFFF', 0.5)).toBe('rgba(0,0,0,0.5)');
    expect(mixColor('#112233', 'red', 0.5)).toBe('#112233');
    expect(mixColor('#1122334', '#FFFFFF', 0.5)).toBe('#1122334');
  });
});
