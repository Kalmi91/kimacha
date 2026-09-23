// PLAN-fb0923 1. lepes: A1 PCIC fordítás-audit (FB370-374) or-teszt.
// PROMPT-POLICY 12-15. szakasz + 4. szakasz: az angol prompt ne legyen
// felrevezeto a spanyol funkcioszavakhoz kepest (gracias/por favor/sin, es
// forditva a "please"-re). Ha egy valodi kivetel adodik, ide egy explicit
// EXCEPTIONS bejegyzes kell, kommenttel, nem a teszt lazitasa.
import { pcicItemsForLevel } from '@/data/pcic';

// id -> ok, ha egy tetel jogosan ter el a szabalytol (jelenleg nincs ilyen).
const EXCEPTIONS = new Set<string>([]);

function tokens(s: string): string[] {
  return s
    .toLowerCase()
    .split(/[^a-zà-ÿ]+/i)
    .filter(Boolean);
}

function hasPorFavor(toks: string[]): boolean {
  for (let i = 0; i < toks.length - 1; i++) {
    if (toks[i] === 'por' && toks[i + 1] === 'favor') return true;
  }
  return false;
}

interface Pair {
  id: string;
  label: string;
  es: string;
  en: string;
}

function collectPairs(): Pair[] {
  const pairs: Pair[] = [];
  for (const item of pcicItemsForLevel('A1')) {
    if (item.kind === 'sentence' && item.en) {
      pairs.push({ id: item.id, label: 'sentence-item', es: item.es, en: item.en });
    }
    if (item.exampleEs && item.exampleEn) {
      pairs.push({ id: item.id, label: 'example-sentence', es: item.exampleEs, en: item.exampleEn });
    }
  }
  return pairs;
}

describe('PCIC A1 prompt audit (PROMPT-POLICY 4, 12-15. szakasz, FB370-374)', () => {
  const pairs = collectPairs().filter((p) => !EXCEPTIONS.has(p.id));

  it('legalabb egy sentence-tetelt es egy pelda-mondatot lefed (a teszt nem üresen zöld)', () => {
    expect(pairs.filter((p) => p.label === 'sentence-item').length).toBeGreaterThan(0);
    expect(pairs.filter((p) => p.label === 'example-sentence').length).toBeGreaterThan(0);
  });

  it('"gracias" a spanyolban -> az angol tartalmazza "thank"-et', () => {
    const bad = pairs.filter((p) => tokens(p.es).includes('gracias') && !p.en.toLowerCase().includes('thank'));
    expect(bad.map((p) => `${p.id} [${p.label}] "${p.es}" || "${p.en}"`)).toEqual([]);
  });

  it('"por favor" a spanyolban -> az angol tartalmazza "please"-t', () => {
    const bad = pairs.filter((p) => hasPorFavor(tokens(p.es)) && !p.en.toLowerCase().includes('please'));
    expect(bad.map((p) => `${p.id} [${p.label}] "${p.es}" || "${p.en}"`)).toEqual([]);
  });

  it('"sin " (szohataron) a spanyolban -> az angol tartalmazza "without"-ot', () => {
    const bad = pairs.filter((p) => tokens(p.es).includes('sin') && !p.en.toLowerCase().includes('without'));
    expect(bad.map((p) => `${p.id} [${p.label}] "${p.es}" || "${p.en}"`)).toEqual([]);
  });

  it('fordítva: az angol "please" csak akkor jó, ha az es-ben "por favor" vagy "favor" van', () => {
    const bad = pairs.filter((p) => p.en.toLowerCase().includes('please') && !tokens(p.es).includes('favor'));
    expect(bad.map((p) => `${p.id} [${p.label}] "${p.es}" || "${p.en}"`)).toEqual([]);
  });
});
