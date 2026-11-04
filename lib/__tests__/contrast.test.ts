import Colors from '@/constants/Colors';
import { contrastRatio, textOn } from '../contrast';

describe('contrast', () => {
  it('knows the extremes and treats a non-hex color as no contrast', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
    expect(contrastRatio('#123456', '#123456')).toBeCloseTo(1, 5);
    expect(contrastRatio('rgba(0,0,0,1)', '#FFFFFF')).toBe(1);
  });

  it('textOn picks the candidate that contrasts more, the first one on a tie or a non-hex fill', () => {
    expect(textOn('#FFFFFF', '#FFFFFF', '#000000')).toBe('#000000');
    expect(textOn('#000000', '#FFFFFF', '#000000')).toBe('#FFFFFF');
    expect(textOn('#777777', '#111111', '#111111')).toBe('#111111');
    expect(textOn('red', '#111111', '#FFFFFF')).toBe('#111111');
  });

  it('on the secondary fill of every theme the picked text reaches 4.5:1, or is the best of text and background', () => {
    for (const [name, c] of Object.entries(Colors)) {
      const picked = textOn(c.secondary, c.text, c.background);
      const best = Math.max(contrastRatio(c.secondary, c.text), contrastRatio(c.secondary, c.background));
      const got = contrastRatio(c.secondary, picked);
      expect({ name, ok: got >= 4.5 || got === best }).toEqual({ name, ok: true });
    }
  });
});
