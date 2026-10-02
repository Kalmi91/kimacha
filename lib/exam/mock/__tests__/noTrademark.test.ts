// PLAN-vizsga E. szakasz (Kálmán, 2026-10-01): a felület sehol nem ír ki vizsgáztatói vagy vizsga-nevet
// (a szakmai kutatásban igen, a felületen nem). Az angol irányon a felirat "nemzetközi minta", nem "hivatalos".
// Ellenőrzött felület: az i18n `mockExam` blokk (en és es, a függvényekkel együtt), a papírok és készségek
// nevei, a szerzői utasítások és írás-feladatok. A korpusz-mondatokat nem nézzük (azokban lehet "key" szó).

import { pcicItemsForLevel, setPcicTarget } from '@/data/pcic';
import en from '@/lib/i18n/en';
import es from '@/lib/i18n/es';
import { MOCK_WRITING } from '../author';
import { buildMockExam } from '../build';
import type { MockLevel, MockTarget } from '../types';

afterAll(() => setPcicTarget('es'));

// A DELE csak nagybetűvel márka (a spanyol "dele" ige, pl. "dele las gracias", törvényes szó).
const TRADEMARK_WORDS = /pearson|peic|cambridge|\bkey\b|siele|cervantes|ielts|toefl|toeic|trinity|oxford|languagecert|\bket\b|goethe/i;
const TRADEMARK_CAPS = /\bDELE\b/;
const clean = (text: string) => !TRADEMARK_WORDS.test(text) && !TRADEMARK_CAPS.test(text);

function strings(value: unknown, out: string[] = []): string[] {
  if (typeof value === 'string') out.push(value);
  else if (typeof value === 'function') {
    // A feliratfüggvényeket mintaértékekkel hívjuk meg (szint, számok, igaz/hamis).
    for (const args of [['A1', 3, 4, 5, true, false], ['A2', 60, 30, 50, false, true]]) {
      const text = (value as (...a: unknown[]) => unknown)(...args);
      if (typeof text === 'string') out.push(text);
    }
  } else if (value && typeof value === 'object') for (const v of Object.values(value)) strings(v, out);
  return out;
}

describe('a felület nem ír ki védjegyes vizsganevet', () => {
  it('i18n mockExam (en és es): nincs védjegyes név', () => {
    for (const block of [en.mockExam, es.mockExam]) {
      const all = strings(block);
      expect(all.length).toBeGreaterThan(50);
      for (const text of all) expect(clean(text)).toBe(true);
    }
  });

  it('a papírok, készségek, utasítások és írás-feladatok szövege mind a négy vizsgán tiszta', () => {
    for (const [target, level] of [['es', 'A1'], ['es', 'A2'], ['en', 'A1'], ['en', 'A2']] as [MockTarget, MockLevel][]) {
      setPcicTarget(target);
      const e = buildMockExam({ target, level, items: pcicItemsForLevel(level), seed: 3 });
      const own: string[] = [...e.papers.map((p) => p.name), ...Object.values(e.skillNames)];
      for (const p of e.papers) {
        for (const t of p.tasks) {
          own.push(t.instruction);
          if (t.kind === 'short_message') own.push(t.prompt, ...t.points.map((x) => x.label));
          if (t.kind === 'form_fill') own.push(t.context, ...t.fields.map((f) => f.label));
        }
      }
      for (const text of own) expect(clean(text)).toBe(true);
    }
    for (const tasks of Object.values(MOCK_WRITING)) {
      for (const t of tasks) expect(clean(JSON.stringify(t))).toBe(true);
    }
  });

  it('az angol irányon a felirat nemzetközi minta, a hivatalos felirat csak a spanyol irányé', () => {
    expect(en.mockExam.modelNoteIntl('A1')).toBe('Practice exam modelled on an international A1 format');
    expect(en.mockExam.cardBodyIntl).not.toMatch(/official/i);
    expect(es.mockExam.modelNoteIntl('A2')).not.toMatch(/oficial/i);
    expect(es.mockExam.cardBodyIntl).not.toMatch(/oficial/i);
    expect(en.mockExam.modelNote('A1')).toMatch(/official/i);
  });

  it('a közelítő átmenési küszöb a felületen jelölve: becslés, nem hivatalos szabály', () => {
    expect(en.mockExam.passRuleAverage(50)).toMatch(/estimate/);
    expect(en.mockExam.averageLine(51, 50, true, true)).toMatch(/estimate/);
    expect(es.mockExam.passRuleAverage(50)).toMatch(/estimación/);
    expect(es.mockExam.averageLine(51, 50, true, true)).toMatch(/estimación/);
  });
});
