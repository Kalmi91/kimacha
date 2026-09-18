// PLAN-pcic 5. lépés: válasz-egyeztetés a PCIC fülhöz. Az es alak sokszor
// "/"-alternatívát hordoz ("tocar/sentir frío") vagy zárójeles opcionális
// részt ("al final (de)"); mindkettő elfogadott alaknak számít. Az ékezet
// számít a helyesíráshoz (Kálmán: "csak simán a szavak helyesírása"), de egy
// szóvégi rag/betű-eltérés (pl. "bueno"/"buena") nyelvtanilag fontos, ezért
// nem near, hanem wrong, még ha a szerkesztési távolság csak 1 is.

import { levenshtein } from './levenshtein';
import { stripTrailingPunct } from './charDiff';

function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

function foldAccents(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

// Egyetlen zárójeles opciós szegmenst old fel: a tartalommal együtt és
// nélküle is előáll egy-egy alak ("al final (de)" -> "al final de", "al final").
function expandParens(s: string): string[] {
  const match = s.match(/\s*\(([^)]*)\)/);
  if (!match || match.index === undefined) return [s];
  const before = s.slice(0, match.index);
  const after = s.slice(match.index + match[0].length);
  const withInner = `${before}${match[0].startsWith(' ') ? ' ' : ''}${match[1]}${after}`.replace(/\s+/g, ' ').trim();
  const withoutInner = `${before}${after}`.replace(/\s+/g, ' ').trim();
  return [withInner, withoutInner];
}

// A "/" mindig egy szó-pozíción belül van ("tocar/sentir frío",
// "asiento/fila de un teatro"): a szóközzel tokenizált alak azon eleme
// cserélődik, amelyikben a "/" szerepel, a többi szó változatlan marad.
function expandSlashes(s: string): string[] {
  const tokens = s.split(' ');
  const slashAt = tokens.reduce<number[]>((acc, tok, i) => (tok.includes('/') ? [...acc, i] : acc), []);
  if (slashAt.length === 0) return [s];
  let variants: string[][] = [tokens];
  for (const idx of slashAt) {
    const options = tokens[idx].split('/');
    variants = variants.flatMap((variant) =>
      options.map((opt) => {
        const copy = [...variant];
        copy[idx] = opt;
        return copy;
      })
    );
  }
  return variants.map((v) => v.join(' '));
}

export function pcicAlternatives(es: string): string[] {
  const withParens = expandParens(es);
  const all = withParens.flatMap(expandSlashes).map((v) => v.trim());
  return Array.from(new Set(all));
}

export interface PcicGrade {
  match: 'exact' | 'near' | 'wrong';
  best: string;
}

// Egy szóvégi rag/betű-eltérés (utolsó 2 karakter eltér) nem "elgépelés".
function isWordFinalDiff(a: string, b: string): boolean {
  return a.slice(-2) !== b.slice(-2);
}

// Ha az ékezet-mentesítés után a két alak megegyezik, a különbség tisztán
// ékezethiba, ez marad near akkor is, ha épp a szó végén van.
function isAccentOnlyDiff(a: string, b: string): boolean {
  return a !== b && foldAccents(a) === foldAccents(b);
}

export function gradePcicAnswer(typed: string, es: string): PcicGrade {
  const alternatives = pcicAlternatives(es);
  const typedNorm = stripTrailingPunct(normalize(typed));

  for (const alt of alternatives) {
    if (stripTrailingPunct(normalize(alt)) === typedNorm) {
      return { match: 'exact', best: alt };
    }
  }

  let best = alternatives[0];
  let bestNorm = stripTrailingPunct(normalize(best));
  let bestDist = Infinity;
  for (const alt of alternatives) {
    const altNorm = stripTrailingPunct(normalize(alt));
    const dist = levenshtein(typedNorm, altNorm);
    if (dist < bestDist) {
      bestDist = dist;
      best = alt;
      bestNorm = altNorm;
    }
  }

  if (bestDist <= 1) {
    if (isAccentOnlyDiff(typedNorm, bestNorm)) return { match: 'near', best };
    if (isWordFinalDiff(typedNorm, bestNorm)) return { match: 'wrong', best };
    return { match: 'near', best };
  }

  return { match: 'wrong', best };
}
