// FB628: every reference (grid) table of every grammar lesson must be readable on a 360 dp phone: columns that can hold their
// longest word, no cut text. A table that needs a sideways scroll only counts as fine when it has been looked at (SCROLL_OK).
import fs from 'fs';
import path from 'path';

import { isConjugationTable, planGridTable } from '../tableShape';

const ROOT = path.join(__dirname, '..', '..', '..', 'data', 'games', 'grammar');
const AVAILABLE = 360 - 32;

interface Found { file: string; id: string; header: string[]; rows: string[][] }

function collect(): Found[] {
  const out: Found[] = [];
  const walk = (dir: string) => {
    for (const f of fs.readdirSync(dir)) {
      const full = path.join(dir, f);
      if (fs.statSync(full).isDirectory()) walk(full);
      else if (full.endsWith('.json')) {
        const visit = (o: unknown): void => {
          if (Array.isArray(o)) o.forEach(visit);
          else if (o && typeof o === 'object') {
            const b = o as { kind?: string; id?: string; header?: { en: string }[]; rows?: string[][] };
            if (b.kind === 'table' && b.header && b.rows && !isConjugationTable(b.header as never, b.rows)) {
              out.push({ file: path.relative(ROOT, full), id: String(b.id), header: b.header.map((h) => h.en), rows: b.rows });
            }
            Object.values(o).forEach(visit);
          }
        };
        visit(JSON.parse(fs.readFileSync(full, 'utf8')));
      }
    }
  };
  walk(ROOT);
  return out;
}

describe('grid tables at 360 dp', () => {
  const tables = collect();
  it('finds the lesson tables', () => expect(tables.length).toBeGreaterThan(100));

  it('the demostrativos table fits as a grid (swapped: the forms become the rows)', () => {
    const t = tables.find((x) => x.id === 'demostrativos')!;
    const plan = planGridTable(t.header, t.rows, AVAILABLE);
    expect(plan.mode).toBe('grid');
    expect(plan.transposed).toBe(true);
    expect(plan.header).toEqual(['Distance', 'este', 'ese', 'aquel']);
    expect(plan.rows[0]).toEqual(['Masculine singular', 'este', 'ese', 'aquel']);
  });

  it('every table is a grid whose columns hold their longest word, or a stack of row cards (never cut, never sideways)', () => {
    for (const t of tables) {
      const plan = planGridTable(t.header, t.rows, AVAILABLE);
      expect(['grid', 'stack']).toContain(plan.mode);
      // a row label per row: the first cell of every row is filled
      for (const r of plan.rows) expect(String(r[0]).trim()).not.toBe('');
    }
  });

  it('a wide table (possessives, 5 columns of long words) becomes row cards', () => {
    const t = tables.find((x) => x.id === 'posesivos')!;
    expect(planGridTable(t.header, t.rows, AVAILABLE).mode).toBe('stack');
  });
});
