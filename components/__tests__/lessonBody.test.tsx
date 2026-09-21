// LECKE-SEMA 1. szakasz: a LessonBody a ser-estar pilot body-tömbjét rajzolja
// ki; ez a teszt csak a szerkezetet nézi (mindkét tábla megvan, minden usage
// pont első példamondata a képernyőn van, a tip szövege látszik), nem a
// pedagógiai tartalmat.
import { render, screen } from '@testing-library/react-native';

import LessonBody from '../grammar/LessonBody';
import lessonJson from '@/data/games/grammar/es/ser-estar.json';
import presenteRegularJson from '@/data/games/grammar/es/presente-regular.json';
import type { LessonV2 } from '@/lib/grammar/lessonTypes';

jest.mock('@/lib/ThemeContext', () => ({
  useTheme: () => ({ theme: 'light' }),
}));

const lesson = lessonJson as unknown as LessonV2;
const presenteRegular = presenteRegularJson as unknown as LessonV2;

describe('LessonBody', () => {
  it('renders both present-tense tables', () => {
    render(<LessonBody blocks={lesson.body} contentLang="hu" learnedLang="es" />);
    expect(screen.queryByTestId('table-ser-presente')).toBeTruthy();
    expect(screen.queryByTestId('table-estar-presente')).toBeTruthy();
  });

  it("shows every usage point's first example sentence", () => {
    render(<LessonBody blocks={lesson.body} contentLang="hu" learnedLang="es" />);
    const usageBlock = lesson.body.find((b) => b.kind === 'usage');
    expect(usageBlock?.kind).toBe('usage');
    if (usageBlock?.kind !== 'usage') return;
    for (const point of usageBlock.points) {
      expect(screen.queryByText(point.examples[0].es)).toBeTruthy();
    }
  });

  it('shows the tip text', () => {
    render(<LessonBody blocks={lesson.body} contentLang="hu" learnedLang="es" />);
    const tip = lesson.body.find((b) => b.kind === 'tip');
    expect(tip?.kind).toBe('tip');
    if (tip?.kind !== 'tip') return;
    expect(screen.queryByText(`💡 ${tip.text.hu}`)).toBeTruthy();
  });
});

// FB326 (Kálmán 2. terv): a ragozási táblák személy-blokkokban jelennek meg,
// a tő halványan, a végződés külön, saját Text-ben (hogy a stílus is külön
// legyen).
describe('LessonBody conjugation table (FB326)', () => {
  it('renders 6 person blocks for presente-regular, hablamos split as stem + ending', () => {
    render(<LessonBody blocks={presenteRegular.body} contentLang="en" learnedLang="es" />);
    for (const person of ['yo', 'tú', 'él/ella/usted', 'nosotros', 'vosotros', 'ellos/ellas/ustedes']) {
      expect(screen.queryByText(person)).toBeTruthy();
    }
    // "habl" is the stem of all six hablar forms, so it appears once per
    // person block; "amos" (the nosotros ending) is unique to that one chip.
    expect(screen.getAllByText('habl').length).toBe(6);
    expect(screen.queryByText('amos')).toBeTruthy();
    expect(screen.queryByText('hablamos')).toBeFalsy();
  });
});
