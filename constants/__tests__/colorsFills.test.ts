// successFill and warningFill are the same color in every theme, so a screen can take them from `colors`
// instead of writing the hex literal (the look stays byte for byte the same). A theme that changes one
// would make those screens differ per theme: this test says so.

import Colors from '../Colors';

describe('the fill tokens are the same in every theme', () => {
  const themes = Object.entries(Colors);

  it('has themes to check', () => {
    expect(themes.length).toBeGreaterThan(30);
  });

  it.each(themes)('%s', (_key, colors) => {
    expect(colors.successFill).toBe('#22C55E');
    expect(colors.warningFill).toBe('#F59E0B');
  });
});
