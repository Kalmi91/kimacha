// Headers on the brutalist palette (bg background, 2.5 px ink bottom line, uppercase weight-500 title,
// back arrow in a BrutalBox), and today's header on the classic palette.

import { SKINS } from '@/constants/Skins';
import { grammarColorsFor } from '@/lib/grammarColors';
import { brutalHeaderOptions, brutalHeaderRowStyle } from '@/lib/brutalHeader';

describe('Headers, neo-brutalist', () => {
  it('brutalHeaderOptions: with the brand palette an ink line + uppercase 500-weight title', () => {
    const g = grammarColorsFor('brand-light');
    const o = brutalHeaderOptions(g);
    expect(o.headerStyle).toMatchObject({ backgroundColor: g.bg, borderBottomWidth: 2.5, borderBottomColor: g.ink, elevation: 0, shadowOpacity: 0 });
    expect(o.headerTitleStyle).toMatchObject({ color: g.ink, fontWeight: '500', textTransform: 'uppercase' });
    expect(brutalHeaderRowStyle(g)).toMatchObject({ borderBottomWidth: 2.5, borderBottomColor: g.ink });
  });

  it('brutalHeaderOptions: empty with the classic palette', () => {
    const g = grammarColorsFor('light');
    expect(brutalHeaderOptions(g)).toEqual({});
    expect(brutalHeaderRowStyle(g)).toBeNull();
  });

  // the theme's title font on the native header's title.
  it('brutalHeaderOptions + theme: custom font (without fontWeight), letter spacing, uppercase; still empty on classic', () => {
    const g = grammarColorsFor('deco-dark');
    const o = brutalHeaderOptions(g, SKINS.deco);
    expect(o.headerTitleStyle).toMatchObject({ color: g.ink, fontFamily: 'PoiretOne', letterSpacing: 3, textTransform: 'uppercase' });
    expect(o.headerTitleStyle).not.toHaveProperty('fontWeight');

    const brutal = brutalHeaderOptions(grammarColorsFor('brand-light'), SKINS.brutal);
    // the brutal title font is null = today's system font, with fontWeight.
    expect(brutal.headerTitleStyle).toMatchObject({ fontWeight: '500', textTransform: 'uppercase' });
    expect(brutal.headerTitleStyle).not.toHaveProperty('fontFamily');
    expect(brutal.headerStyle).toMatchObject({ borderBottomWidth: 2.5 });

    expect(brutalHeaderOptions(grammarColorsFor('light'), SKINS.classic)).toEqual({});
  });
});
