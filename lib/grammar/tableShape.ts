// FB326 (Kálmán 2. terv, "Személy-blokkok"): tiszta helper a LessonBody
// tábla-blokkjához. Eldönti, hogy egy `table` blokk ragozási tábla-e
// (fejléc 2..n cellája mind infinitivus, a sorok címkéi személy-névmások),
// és ha igen, szétvágja egy alakot tőre és végződésre (a tő halvány, a
// végződés vastag és színes az igeosztály szerint a LessonBody-ban).
// Nem ragozási (referencia) táblákra a régi rács-nézet marad.

import type { Lang4 } from './lessonTypes';

export type VerbClass = 'ar' | 'er' | 'ir';

// A hat személy + a data/games/grammar/es/*.json-ban ténylegesen előforduló
// szét- és összevont változatok (usted/ustedes külön is). A kulcsok innen
// adják az isConjugationTable személy-felismerését is, hogy a két hely ne
// csússzon szét.
const PERSON_GLOSS: Record<string, Lang4> = {
  yo: { hu: 'én', en: 'I', es: 'yo', de: 'ich' },
  'tú': { hu: 'te', en: 'you', es: 'tú', de: 'du' },
  usted: { hu: 'Ön', en: 'you (formal)', es: 'usted', de: 'Sie' },
  ustedes: { hu: 'Önök', en: 'you all', es: 'ustedes', de: 'Sie' },
  'él/ella': { hu: 'ő', en: 'he / she', es: 'él/ella', de: 'er / sie' },
  'él/ella/usted': { hu: 'ő / Ön', en: 'he / she / you (formal)', es: 'él/ella/usted', de: 'er / sie / Sie' },
  nosotros: { hu: 'mi', en: 'we', es: 'nosotros', de: 'wir' },
  'nosotros/nosotras': { hu: 'mi', en: 'we', es: 'nosotros/nosotras', de: 'wir' },
  vosotros: { hu: 'ti (Spanyolország)', en: 'you all (Spain)', es: 'vosotros', de: 'ihr (Spanien)' },
  'vosotros/vosotras': { hu: 'ti (Spanyolország)', en: 'you all (Spain)', es: 'vosotros/vosotras', de: 'ihr (Spanien)' },
  'ellos/ellas': { hu: 'ők', en: 'they', es: 'ellos/ellas', de: 'sie' },
  'ellos/ellas/ustedes': { hu: 'ők / Önök', en: 'they / you all', es: 'ellos/ellas/ustedes', de: 'sie / Sie' },
};

function normalizePerson(label: string): string {
  return label.trim().toLowerCase();
}

// A tanuló nyelvén (contentLang) halvány glossza a személy mellé. Ismeretlen
// címkére '' (nincs glossza-sor), nem találgatunk.
export function personGloss(label: string, contentLang: 'hu' | 'en' | 'es' | 'de'): string {
  const entry = PERSON_GLOSS[normalizePerson(label)];
  return entry ? entry[contentLang] : '';
}

function isPersonLabel(label: string): boolean {
  return normalizePerson(label) in PERSON_GLOSS;
}

// Egy szó, -ar/-er/-ir végű infinitivus, opcionális visszaható "se" raggal
// (levantarse). A tő rész `*`, mert az "ir" (menni) önmagában is infinitivus
// (0 hosszú tő). Szóköz vagy "+" a cellában (pl. "ir a + infinitivo") kizárja.
const INFINITIVE_RE = /^[a-zàáâäèéêëìíîïòóôöùúûüñç]*(ar|er|ir)(se)?$/i;

function isInfinitive(word: string): boolean {
  return INFINITIVE_RE.test(word.trim());
}

// Igaz, ha a header 2..n cellájának `es` értéke mind infinitivus ÉS minden
// sor címkéje személy-névmás. Referencia-táblákra (hay/estar, névmás-táblák,
// "ir a + infinitivo") hamis, mert a fejlécük nem csupa infinitivus vagy a
// sorcímkéjük nem a fenti hat (esetleg a felismerés nélkül).
export function isConjugationTable(header: Lang4[], rows: string[][]): boolean {
  if (header.length < 2 || rows.length === 0) return false;
  const verbHeaders = header.slice(1);
  if (!verbHeaders.every((h) => isInfinitive(h.es))) return false;
  return rows.every((row) => isPersonLabel(row[0]));
}

// Az infinitivus utolsó 2 betűje nélkül számolt "névelő nélküli" igeosztály;
// visszaható igénél a "se" előbb lekerül (levantarse -> levantar -> ar).
export function verbClassOf(infinitive: string): VerbClass | null {
  const base = infinitive.toLowerCase().endsWith('se') ? infinitive.slice(0, -2) : infinitive;
  const end = base.slice(-2).toLowerCase();
  if (end === 'ar' || end === 'er' || end === 'ir') return end;
  return null;
}

// A szabályos jelen idejű végződések igeosztályonként (mind a hat személy).
// A splitStemEnding csak ide tartozó végződésre oszt, különben null (soy,
// tengo, voy: a tő ugyan stimmelne, de a maradék nem szabályos végződés).
const REGULAR_ENDINGS: Record<VerbClass, string[]> = {
  ar: ['o', 'as', 'a', 'amos', 'áis', 'an'],
  er: ['o', 'es', 'e', 'emos', 'éis', 'en'],
  ir: ['o', 'es', 'e', 'imos', 'ís', 'en'],
};

// A tő = infinitivus mínusz az utolsó 2 betű (hablar -> habl; visszaható
// levantarse -> levant). Ha az alak (kis/nagybetű nélkül) a tővel kezdődik
// ÉS a maradék egy szabályos végződés, oszt (hablamos -> habl + amos).
// Ha nem, null (rendhagyó: soy, tengo, voy), a UI a teljes alakot mutatja
// vastagon. Többszavas cellánál (me levanto) a vezető szó(ak) (a névmás) a
// tő elé kerül(nek) a visszaadott stem mezőben: "me levant" + "o".
export function splitStemEnding(form: string, infinitive: string): { stem: string; ending: string } | null {
  const verbClass = verbClassOf(infinitive);
  if (!verbClass) return null;

  const words = form.trim().split(/\s+/);
  const lastWord = words[words.length - 1];
  const lead = words.slice(0, -1).join(' ');

  const base = infinitive.toLowerCase().endsWith('se') ? infinitive.slice(0, -2) : infinitive;
  const rawStem = base.slice(0, -2);
  if (!lastWord.toLowerCase().startsWith(rawStem.toLowerCase())) return null;

  const ending = lastWord.slice(rawStem.length);
  if (!REGULAR_ENDINGS[verbClass].includes(ending.toLowerCase())) return null;

  const stem = lead ? `${lead} ${lastWord.slice(0, rawStem.length)}` : lastWord.slice(0, rawStem.length);
  return { stem, ending };
}

// FB381-383: minden IGE (oszlop) saját színt kap az oszlop-indexe szerint,
// nem az igeosztálya szerint (hablar/comer/vivir addig 3 külön szín volt
// véletlenül, de tener/estar/poder/hacer közül tener és poder és hacer mind
// -er osztályú, tehát ugyanaz a szín jutott 3 különböző igének). Legalább 5
// szín, világos/sötét pár, jó kontraszttal a kártya-háttéren; a régi 3 szín
// (ar/er/ir) az első 3 index, hogy a meglévő táblák hangulata ne váltson.
const VERB_COLUMN_COLORS: { light: string; dark: string }[] = [
  { light: '#1D4ED8', dark: '#7FA3FF' }, // kék
  { light: '#0F766E', dark: '#4FD1B9' }, // teal
  { light: '#7C3AED', dark: '#B899FF' }, // lila
  { light: '#B45309', dark: '#FBBF24' }, // borostyán
  { light: '#BE185D', dark: '#F472B6' }, // pink
  { light: '#4D7C0F', dark: '#A3E635' }, // lime
];

export function verbColumnColor(index: number, isDark: boolean): string {
  const pair = VERB_COLUMN_COLORS[index % VERB_COLUMN_COLORS.length];
  return isDark ? pair.dark : pair.light;
}
