// az indefinido-10-verbos tíz egy-igés táblája egy füles, tömör
// csoport: egyszerre egy tábla látszik, 2 oszlopos cellákkal.
import { fireEvent, render, screen } from '@testing-library/react-native';

import LessonBody from '../grammar/LessonBody';
import ind10Json from '@/data/games/grammar/es/indefinido-10-verbos.json';
import serEstarJson from '@/data/games/grammar/es/ser-estar.json';
import { groupTableRuns } from '@/lib/grammar/tableGroups';
import type { LessonV2 } from '@/lib/grammar/lessonTypes';

jest.mock('@/lib/ThemeContext', () => ({
  useTheme: () => ({ theme: 'light' }),
}));

const ind10 = ind10Json as unknown as LessonV2;
const serEstar = serEstarJson as unknown as LessonV2;

describe('groupTableRuns', () => {
  it('turns the ten consecutive single-verb tables into one tabs entry', () => {
    const entries = groupTableRuns(ind10.body);
    const tabs = entries.filter((e) => e.kind === 'tabs');
    expect(tabs).toHaveLength(1);
    if (tabs[0].kind !== 'tabs') return;
    expect(tabs[0].tables).toHaveLength(10);
    // a text + a tip marad külön blokk
    expect(entries.filter((e) => e.kind === 'block')).toHaveLength(2);
  });

  it('leaves short runs (ser-estar: two tables) as plain blocks', () => {
    const entries = groupTableRuns(serEstar.body);
    expect(entries.every((e) => e.kind === 'block')).toBe(true);
    expect(entries).toHaveLength(serEstar.body.length);
  });
});

describe('LessonBody table tabs (FB443/FB445)', () => {
  it('shows one table at a time, switched by the verb chips', () => {
    render(<LessonBody blocks={ind10.body} contentLang="hu" learnedLang="es" />);
    expect(screen.queryByTestId('table-ind10-estar')).toBeTruthy();
    expect(screen.queryByTestId('table-ind10-ir')).toBeNull();
    expect(screen.queryByText('estuvieron')).toBeTruthy();
    fireEvent.press(screen.getByTestId('table-tab-ind10-ir'));
    expect(screen.queryByTestId('table-ind10-ir')).toBeTruthy();
    expect(screen.queryByTestId('table-ind10-estar')).toBeNull();
    expect(screen.queryByText('fueron')).toBeTruthy();
    expect(screen.queryByText('estuvieron')).toBeNull();
  });

  it('draws the six persons in compact cells (3 + 3)', () => {
    render(<LessonBody blocks={ind10.body} contentLang="hu" learnedLang="es" />);
    expect(screen.getAllByTestId(/^compact-cell-/)).toHaveLength(6);
    for (const person of ['yo', 'tú', 'él/ella/usted', 'nosotros', 'vosotros', 'ellos/ellas/ustedes']) {
      expect(screen.queryByText(person)).toBeTruthy();
    }
  });
});
