// válasz-egyeztetés a PCIC fülhöz. Az es alak sokszor
// "/"-alternatívát hordoz ("tocar/sentir frío") vagy zárójeles opcionális
// részt ("al final (de)"); mindkettő elfogadott alaknak számít. Az ékezet
// számít a helyesíráshoz ("csak simán a szavak helyesírása"), de egy
// szóvégi rag/betű-eltérés (pl. "bueno"/"buena") nyelvtanilag fontos, ezért
// nem near, hanem wrong, még ha a szerkesztési távolság csak 1 is.

import { levenshtein } from './levenshtein';
import { stripTrailingPunct } from './charDiff';
import type { Sm2Grade } from './sm2';

// a kérdő- és felkiáltójel, a pont és a vessző sosem
// hiba, se elöl (¿ ¡), se hátul (? ! .), se a mondat közepén (vessző). Az
// aposztróf és a kötőjel marad (angolul "don't", "well-known" a szó része).
const IGNORED_PUNCT = /[¿?¡!.,;:…]/g;

function normalize(s: string): string {
  return s.trim().toLowerCase().replace(IGNORED_PUNCT, ' ').replace(/\s+/g, ' ').trim();
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

// a " / " (szóköz-per-szóköz) elválasztó teljes
// alternatívákat választ el ("el carro / el coche / el auto"); a szóközmentes
// "a/b" a fenti szó-pozíción belüli felbontásként marad, ahogy volt.
export function pcicAlternatives(answer: string): string[] {
  const withParens = answer.split(' / ').flatMap(expandParens);
  const all = withParens.flatMap(expandSlashes).map((v) => v.trim());
  return Array.from(new Set(all));
}

export interface PcicGrade {
  match: 'exact' | 'near' | 'wrong';
  best: string;
  // csak akkor igaz, ha az eltérés KIZÁRÓLAG ékezet, és
  // az ékezet-szigor KI van kapcsolva (különben ez a helyzet 'wrong'). A UI
  // ez alapján írja ki a "Missing accent, counted as correct" sort.
  accentOnly?: boolean;
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

// a `target` (korábban `es`) a CÉLNYELVI helyes
// alak, akármelyik irányban; a normalizálás (ékezet, kis/nagybetű, "/" és
// zárójel-alternatívák) nyelvfüggetlen, angolra is jó (jóváhagyott
// vázlat, 3. pont).
export function gradePcicAnswer(typed: string, target: string, strictAccents = false): PcicGrade {
  const alternatives = pcicAlternatives(target);
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
    if (isAccentOnlyDiff(typedNorm, bestNorm)) {
      // s2 (anki-ui-terv.html): a Beállítások ékezet-szigor kapcsolója dönt.
      // KI: a csak-ékezet eltérés 100%-nak számít. BE: valódi hiba, mint egy
      // másik betűeltérés.
      return strictAccents ? { match: 'wrong', best } : { match: 'near', best, accentOnly: true };
    }
    if (isWordFinalDiff(typedNorm, bestNorm)) return { match: 'wrong', best };
    return { match: 'near', best };
  }

  return { match: 'wrong', best };
}

// s2 (anki-ui-terv.html): a dokkolt "Next" ezt hajtja végre automatikusan, és
// ez adja a manuális Tudtam/Nem tudtam gomb kereteszelt (isPre) javaslatát is.
// Szabály: 100% helyes válasz (exact, vagy ékezet-szigor KI melletti
// csak-ékezet near) -> Tudtam; minden más (hibás vagy üres) -> Nem tudtam.
export function suggestedGrade(grade: PcicGrade): Sm2Grade {
  if (grade.match === 'exact') return 'good';
  if (grade.match === 'near' && grade.accentOnly) return 'good';
  return 'again';
}

// a spanyol mondatban az alany-névmás elhagyható
// ("Yo como en casa." helyett "Como en casa." is jó). Csak az ELSŐ szó számít, és
// pontosan ékezettel: "él" névmás, "el" névelő; "tú" névmás, "tu" birtokos.
const SUBJECT_PRONOUNS = new Set([
  'yo', 'tú', 'él', 'ella', 'usted', 'nosotros', 'nosotras', 'vosotros', 'vosotras', 'ellos', 'ellas', 'ustedes',
]);

/** A mondat az elején álló alany-névmás nélkül, vagy null, ha nem névmással kezdődik. */
export function withoutLeadingSubjectPronoun(sentence: string): string | null {
  const match = sentence.trim().match(/^[¿¡"']*([^\s,]+)[,]?\s+(\S[\s\S]*)$/);
  if (!match) return null;
  if (!SUBJECT_PRONOUNS.has(match[1].toLowerCase())) return null;
  return match[2].trim();
}

const GRADE_RANK: Record<PcicGrade['match'], number> = { exact: 2, near: 1, wrong: 0 };

/**
 * Mondat-bírálat: a szó-kártya bírálata (gradePcicAnswer), de a névmás nélküli
 * válasz is elfogadott, ha a helyes mondat névmással kezdődik. A jobbik
 * bírálat számít; a `best` a mutatott helyes alak (a teljes mondat marad).
 */
export function gradeSentenceAnswer(typed: string, target: string, strictAccents = false): PcicGrade {
  const full = gradePcicAnswer(typed, target, strictAccents);
  const short = withoutLeadingSubjectPronoun(target);
  if (!short) return full;
  const alt = gradePcicAnswer(typed, short, strictAccents);
  return GRADE_RANK[alt.match] > GRADE_RANK[full.match] ? { ...alt, best: target } : full;
}
