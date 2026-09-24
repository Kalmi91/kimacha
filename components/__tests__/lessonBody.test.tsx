// LECKE-SEMA 1. szakasz: a LessonBody a ser-estar pilot body-tömbjét rajzolja
// ki; ez a teszt csak a szerkezetet nézi (mindkét tábla megvan, minden usage
// pont első példamondata a képernyőn van, a tip szövege látszik), nem a
// pedagógiai tartalmat.
import { StyleSheet } from 'react-native';
import { render, screen } from '@testing-library/react-native';

import LessonBody from '../grammar/LessonBody';
import lessonJson from '@/data/games/grammar/es/ser-estar.json';
import presenteRegularJson from '@/data/games/grammar/es/presente-regular.json';
import indefinidoIrregularJson from '@/data/games/grammar/es/indefinido-irregular.json';
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

// FB381+382+383: legend above the table, one colour per verb column (not
// per verb class, so tener/poder/hacer -no longer share a colour just
// because they are all -er verbs), and no stem/ending split on a table that
// has no shared base (indefinido-irregular's "strong stem" table).
describe('LessonBody conjugation table colouring (FB381-383)', () => {
  const indefinidoIrregular = indefinidoIrregularJson as unknown as LessonV2;
  const strongStemTable = indefinidoIrregular.body.filter((b) => b.kind === 'table' && b.id === 'indefinido-fuerte-1');

  it('draws the legend before the person blocks', () => {
    render(<LessonBody blocks={presenteRegular.body} contentLang="en" learnedLang="es" />);
    const tree = JSON.stringify(screen.toJSON());
    expect(tree.indexOf('"hablar"')).toBeLessThan(tree.indexOf('"yo"'));
  });

  it('gives tener, estar, poder and hacer four different colours in the same row', () => {
    render(<LessonBody blocks={strongStemTable} contentLang="en" learnedLang="es" />);
    const colorOf = (text: string) => StyleSheet.flatten(screen.getByText(text).props.style).color;
    const colors = new Set(['tuve', 'estuve', 'pude', 'hice'].map(colorOf));
    expect(colors.size).toBe(4);
  });

  it('shows the whole irregular form, not split into stem + ending', () => {
    render(<LessonBody blocks={strongStemTable} contentLang="en" learnedLang="es" />);
    expect(screen.queryByText('tuve')).toBeTruthy();
    expect(screen.queryByText('estuve')).toBeTruthy();
    // The regular-table split marker: a lone stem fragment shared by a row.
    expect(screen.queryByText('tu')).toBeFalsy();
  });

  it('drops the -ar/-er/-ir legend suffix on an irregular table, keeps it on a regular one', () => {
    render(<LessonBody blocks={strongStemTable} contentLang="en" learnedLang="es" />);
    expect(screen.queryByText(/-er\b/)).toBeFalsy();
    expect(screen.queryByText(/-ar\b/)).toBeFalsy();

    render(<LessonBody blocks={presenteRegular.body} contentLang="en" learnedLang="es" />);
    expect(screen.queryByText(/-ar\b/)).toBeTruthy();
  });

  it('shows the "each colour is one verb" caption', () => {
    render(<LessonBody blocks={presenteRegular.body} contentLang="en" learnedLang="es" />);
    expect(screen.queryByText('Each row is one person; each colour is one verb.')).toBeTruthy();
  });
});
