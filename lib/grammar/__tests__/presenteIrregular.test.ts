// FB423 (PLAN-fb0929 5. lépés): a presente-irregular lecke a leggyakoribb rendhagyó igék mindegyikét tartalmazza.
import lessonJson from '@/data/games/grammar/es/presente-irregular.json';
import { lessonFor } from '../syllabus';
import { tableCellsForLesson } from '../tableDeck';
import type { LessonV2 } from '../lessonTypes';

const lesson = lessonJson as unknown as LessonV2;
const tables = lesson.body.filter((b) => b.kind === 'table') as { id: string; header: { es: string }[]; rows: string[][] }[];
const verbsInTables = new Set(tables.flatMap((t) => t.header.slice(1).map((h) => h.es)));

const REQUIRED = [
  'ser', 'estar', 'ir', 'tener', 'hacer', 'decir', 'poder', 'querer', 'venir', 'salir', 'poner', 'saber', 'conocer', 'dar', 'ver', 'oír', 'traer',
  // + a leggyakoribbak közül
  'parecer', 'seguir', 'conducir', 'caer', 'valer',
];

describe('presente-irregular: a rendhagyó igék teljes köre (FB423)', () => {
  it('mind a 17 kért ige és az 5 további ige táblában szerepel', () => {
    for (const verb of REQUIRED) expect(verbsInTables.has(verb)).toBe(true);
  });

  it('a táblák hat személyt adnak, és a yo-alakok a jó rendhagyó alakok', () => {
    const yoOf = (verb: string) => {
      const t = tables.find((tb) => tb.header.slice(1).some((h) => h.es === verb))!;
      const col = t.header.slice(1).findIndex((h) => h.es === verb) + 1;
      return t.rows[0][col];
    };
    for (const t of tables) expect(t.rows).toHaveLength(6);
    expect(yoOf('estar')).toBe('estoy');
    expect(yoOf('poder')).toBe('puedo');
    expect(yoOf('querer')).toBe('quiero');
    expect(yoOf('saber')).toBe('sé');
    expect(yoOf('conocer')).toBe('conozco');
    expect(yoOf('dar')).toBe('doy');
    expect(yoOf('ver')).toBe('veo');
    expect(yoOf('oír')).toBe('oigo');
    expect(yoOf('traer')).toBe('traigo');
    expect(yoOf('seguir')).toBe('sigo');
    expect(yoOf('conducir')).toBe('conduzco');
    expect(yoOf('caer')).toBe('caigo');
    expect(yoOf('valer')).toBe('valgo');
  });

  it('minden új igéhez van ragozás-feladat, és a válasz a táblában is ott van', () => {
    const forms = lesson.items.filter((i) => i.kind === 'form') as { verb: string; person: string; answer: string; table: string }[];
    for (const verb of ['estar', 'poder', 'querer', 'saber', 'conocer', 'dar', 'ver', 'oír', 'traer', 'parecer', 'seguir', 'conducir', 'caer', 'valer']) {
      const f = forms.find((x) => x.verb === verb);
      expect(f).toBeDefined();
      const t = tables.find((tb) => tb.id === f!.table)!;
      const col = t.header.slice(1).findIndex((h) => h.es === verb) + 1;
      const row = t.rows.find((r) => r[0] === f!.person)!;
      expect(row[col]).toBe(f!.answer);
    }
  });

  it('a táblagyakorlat (deck) az új táblák celláit is felveszi', () => {
    const cells = tableCellsForLesson(lessonFor('es', 'presente-irregular'));
    expect(cells.length).toBeGreaterThan(60);
    expect(cells.some((c) => c.answer === 'conduzco')).toBe(true);
    expect(cells.some((c) => c.answer === 'estoy')).toBe(true);
  });
});
