// GAMES.md 4.7 (F5, conjugation-slot). Verb-form generation: RULE-BASED for
// regular -ar/-er/-ir verbs (endings generated, not hand-listed per verb) and
// a hand-verified TABLE for the 15 core irregulars named in the spec (ser,
// estar, ir, tener, hacer, poder, decir, ver, dar, saber, querer, venir,
// poner, salir, haber). K15: Spanish only, the game's hub card shows "soon"
// for every other learned language (app/(tabs)/games.tsx + registry.ts
// `languages: ['es']`).
//
// GAMES.md's own words: "A ragozási alakok tényállítások: ha egy alakban
// bizonytalan vagy, inkább hagyd ki azt az igét vagy igeidőt, mint hogy
// hibás alakot taníts." So a verb that is NOT in the irregular table and NOT
// confidently plain-regular (stem-changing e→ie/o→ue/e→i, -uir y-insertion,
// 1st-person-only -zco/-jo/-go/-y irregulars, accent-shifting -iar/-uar
// verbs, an irregular preterite stem, or a compound of an irregular base)
// is EXCLUDED: conjugate() returns null rather than guess. EXCLUDE_INFINITIVES
// below was compiled against every verb infinitive actually present in
// data/words/{a0..c1}.json (pos==='verb'), so it is scoped to this corpus,
// not an attempt at an exhaustive Spanish grammar.

import { shuffleArray, mulberry32, hashString } from '../shuffle';

export type Tense = 'presente' | 'indefinido' | 'imperfecto' | 'futuro' | 'condicional' | 'subjuntivo_presente';
export type Person = 'yo' | 'tu' | 'el' | 'nosotros' | 'ellos';

export const TENSES: Tense[] = ['presente', 'indefinido', 'imperfecto', 'futuro', 'condicional', 'subjuntivo_presente'];

// The app's own Spanish grammar topics (data/topics/a1.json presente_ar/er/ir,
// ser, estar…) teach a 5-person paradigm (yo/tú/él-ella/nosotros/ellos-ellas),
// vosotros omitted (Latin-American convention: ustedes/ellos double up). This
// module follows the same 5-person shape for consistency with the rest of
// the app's Spanish grammar content.
export const PERSONS: Person[] = ['yo', 'tu', 'el', 'nosotros', 'ellos'];
export const PERSON_LABEL: Record<Person, string> = {
  yo: 'yo',
  tu: 'tú',
  el: 'él/ella',
  nosotros: 'nosotros',
  ellos: 'ellos/ellas',
};

export interface ConjugationForm {
  person: Person;
  form: string;
}

type FormTuple = [string, string, string, string, string]; // yo, tu, el, nosotros, ellos

function toForms(tuple: FormTuple): ConjugationForm[] {
  return PERSONS.map((person, i) => ({ person, form: tuple[i] }));
}

// ---------------------------------------------------------------------------
// The 15 core irregulars (GAMES.md 4.7). Hand-verified, standard Spanish.
// ---------------------------------------------------------------------------

const IRREGULAR: Record<string, Record<Tense, FormTuple>> = {
  ser: {
    presente: ['soy', 'eres', 'es', 'somos', 'son'],
    indefinido: ['fui', 'fuiste', 'fue', 'fuimos', 'fueron'],
    imperfecto: ['era', 'eras', 'era', 'éramos', 'eran'],
    futuro: ['seré', 'serás', 'será', 'seremos', 'serán'],
    condicional: ['sería', 'serías', 'sería', 'seríamos', 'serían'],
    subjuntivo_presente: ['sea', 'seas', 'sea', 'seamos', 'sean'],
  },
  estar: {
    presente: ['estoy', 'estás', 'está', 'estamos', 'están'],
    indefinido: ['estuve', 'estuviste', 'estuvo', 'estuvimos', 'estuvieron'],
    imperfecto: ['estaba', 'estabas', 'estaba', 'estábamos', 'estaban'],
    futuro: ['estaré', 'estarás', 'estará', 'estaremos', 'estarán'],
    condicional: ['estaría', 'estarías', 'estaría', 'estaríamos', 'estarían'],
    subjuntivo_presente: ['esté', 'estés', 'esté', 'estemos', 'estén'],
  },
  ir: {
    presente: ['voy', 'vas', 'va', 'vamos', 'van'],
    indefinido: ['fui', 'fuiste', 'fue', 'fuimos', 'fueron'],
    imperfecto: ['iba', 'ibas', 'iba', 'íbamos', 'iban'],
    futuro: ['iré', 'irás', 'irá', 'iremos', 'irán'],
    condicional: ['iría', 'irías', 'iría', 'iríamos', 'irían'],
    subjuntivo_presente: ['vaya', 'vayas', 'vaya', 'vayamos', 'vayan'],
  },
  tener: {
    presente: ['tengo', 'tienes', 'tiene', 'tenemos', 'tienen'],
    indefinido: ['tuve', 'tuviste', 'tuvo', 'tuvimos', 'tuvieron'],
    imperfecto: ['tenía', 'tenías', 'tenía', 'teníamos', 'tenían'],
    futuro: ['tendré', 'tendrás', 'tendrá', 'tendremos', 'tendrán'],
    condicional: ['tendría', 'tendrías', 'tendría', 'tendríamos', 'tendrían'],
    subjuntivo_presente: ['tenga', 'tengas', 'tenga', 'tengamos', 'tengan'],
  },
  hacer: {
    presente: ['hago', 'haces', 'hace', 'hacemos', 'hacen'],
    indefinido: ['hice', 'hiciste', 'hizo', 'hicimos', 'hicieron'],
    imperfecto: ['hacía', 'hacías', 'hacía', 'hacíamos', 'hacían'],
    futuro: ['haré', 'harás', 'hará', 'haremos', 'harán'],
    condicional: ['haría', 'harías', 'haría', 'haríamos', 'harían'],
    subjuntivo_presente: ['haga', 'hagas', 'haga', 'hagamos', 'hagan'],
  },
  poder: {
    presente: ['puedo', 'puedes', 'puede', 'podemos', 'pueden'],
    indefinido: ['pude', 'pudiste', 'pudo', 'pudimos', 'pudieron'],
    imperfecto: ['podía', 'podías', 'podía', 'podíamos', 'podían'],
    futuro: ['podré', 'podrás', 'podrá', 'podremos', 'podrán'],
    condicional: ['podría', 'podrías', 'podría', 'podríamos', 'podrían'],
    subjuntivo_presente: ['pueda', 'puedas', 'pueda', 'podamos', 'puedan'],
  },
  decir: {
    presente: ['digo', 'dices', 'dice', 'decimos', 'dicen'],
    indefinido: ['dije', 'dijiste', 'dijo', 'dijimos', 'dijeron'],
    imperfecto: ['decía', 'decías', 'decía', 'decíamos', 'decían'],
    futuro: ['diré', 'dirás', 'dirá', 'diremos', 'dirán'],
    condicional: ['diría', 'dirías', 'diría', 'diríamos', 'dirían'],
    subjuntivo_presente: ['diga', 'digas', 'diga', 'digamos', 'digan'],
  },
  ver: {
    presente: ['veo', 'ves', 've', 'vemos', 'ven'],
    indefinido: ['vi', 'viste', 'vio', 'vimos', 'vieron'],
    imperfecto: ['veía', 'veías', 'veía', 'veíamos', 'veían'],
    futuro: ['veré', 'verás', 'verá', 'veremos', 'verán'],
    condicional: ['vería', 'verías', 'vería', 'veríamos', 'verían'],
    subjuntivo_presente: ['vea', 'veas', 'vea', 'veamos', 'vean'],
  },
  dar: {
    presente: ['doy', 'das', 'da', 'damos', 'dan'],
    indefinido: ['di', 'diste', 'dio', 'dimos', 'dieron'],
    imperfecto: ['daba', 'dabas', 'daba', 'dábamos', 'daban'],
    futuro: ['daré', 'darás', 'dará', 'daremos', 'darán'],
    condicional: ['daría', 'darías', 'daría', 'daríamos', 'darían'],
    subjuntivo_presente: ['dé', 'des', 'dé', 'demos', 'den'],
  },
  saber: {
    presente: ['sé', 'sabes', 'sabe', 'sabemos', 'saben'],
    indefinido: ['supe', 'supiste', 'supo', 'supimos', 'supieron'],
    imperfecto: ['sabía', 'sabías', 'sabía', 'sabíamos', 'sabían'],
    futuro: ['sabré', 'sabrás', 'sabrá', 'sabremos', 'sabrán'],
    condicional: ['sabría', 'sabrías', 'sabría', 'sabríamos', 'sabrían'],
    subjuntivo_presente: ['sepa', 'sepas', 'sepa', 'sepamos', 'sepan'],
  },
  querer: {
    presente: ['quiero', 'quieres', 'quiere', 'queremos', 'quieren'],
    indefinido: ['quise', 'quisiste', 'quiso', 'quisimos', 'quisieron'],
    imperfecto: ['quería', 'querías', 'quería', 'queríamos', 'querían'],
    futuro: ['querré', 'querrás', 'querrá', 'querremos', 'querrán'],
    condicional: ['querría', 'querrías', 'querría', 'querríamos', 'querrían'],
    subjuntivo_presente: ['quiera', 'quieras', 'quiera', 'queramos', 'quieran'],
  },
  venir: {
    presente: ['vengo', 'vienes', 'viene', 'venimos', 'vienen'],
    indefinido: ['vine', 'viniste', 'vino', 'vinimos', 'vinieron'],
    imperfecto: ['venía', 'venías', 'venía', 'veníamos', 'venían'],
    futuro: ['vendré', 'vendrás', 'vendrá', 'vendremos', 'vendrán'],
    condicional: ['vendría', 'vendrías', 'vendría', 'vendríamos', 'vendrían'],
    subjuntivo_presente: ['venga', 'vengas', 'venga', 'vengamos', 'vengan'],
  },
  poner: {
    presente: ['pongo', 'pones', 'pone', 'ponemos', 'ponen'],
    indefinido: ['puse', 'pusiste', 'puso', 'pusimos', 'pusieron'],
    imperfecto: ['ponía', 'ponías', 'ponía', 'poníamos', 'ponían'],
    futuro: ['pondré', 'pondrás', 'pondrá', 'pondremos', 'pondrán'],
    condicional: ['pondría', 'pondrías', 'pondría', 'pondríamos', 'pondrían'],
    subjuntivo_presente: ['ponga', 'pongas', 'ponga', 'pongamos', 'pongan'],
  },
  salir: {
    presente: ['salgo', 'sales', 'sale', 'salimos', 'salen'],
    indefinido: ['salí', 'saliste', 'salió', 'salimos', 'salieron'],
    imperfecto: ['salía', 'salías', 'salía', 'salíamos', 'salían'],
    futuro: ['saldré', 'saldrás', 'saldrá', 'saldremos', 'saldrán'],
    condicional: ['saldría', 'saldrías', 'saldría', 'saldríamos', 'saldrían'],
    subjuntivo_presente: ['salga', 'salgas', 'salga', 'salgamos', 'salgan'],
  },
  haber: {
    presente: ['he', 'has', 'ha', 'hemos', 'han'],
    indefinido: ['hube', 'hubiste', 'hubo', 'hubimos', 'hubieron'],
    imperfecto: ['había', 'habías', 'había', 'habíamos', 'habían'],
    futuro: ['habré', 'habrás', 'habrá', 'habremos', 'habrán'],
    condicional: ['habría', 'habrías', 'habría', 'habríamos', 'habrían'],
    subjuntivo_presente: ['haya', 'hayas', 'haya', 'hayamos', 'hayan'],
  },
};

export const IRREGULAR_INFINITIVES = new Set(Object.keys(IRREGULAR));

// ---------------------------------------------------------------------------
// Verbs known to be stem-changing / orthography-risky beyond what the two
// narrow rules in conjugateRegular() confidently handle, and NOT among the
// 15 hand-tabled irregulars above. See the file header for the categories.
// ---------------------------------------------------------------------------

const EXCLUDE_INFINITIVES = new Set([
  // e→ie stem change
  'pensar', 'sentir', 'entender', 'fregar', 'tender', 'regar', 'transferir',
  'encender', 'empezar', 'perder', 'recordar', 'confesar', 'recomendar',
  'defender', 'atender', 'gobernar', 'discernir', 'trascender', 'desconcertar',
  'invertir', 'divertir', 'divertirse', 'mentir', 'preferir', 'sentar', 'sentarse',
  'cerrar', 'comenzar', 'negar', 'calentar', 'temblar', 'despertar', 'despertarse',
  'advertir', 'convertir', 'hervir', 'sugerir', 'requerir', 'referir', 'desmentir',
  // BUG-002: nevar is e→ie (nieva, not "neva") AND impersonal, so a "yo" slot
  // would be nonsense even with the right stem.
  'nevar',
  // o→ue stem change
  'encontrar', 'dormir', 'morir', 'doler', 'volar', 'sonar', 'probar', 'contar',
  'costar', 'devolver', 'colgar', 'jugar', 'resolver', 'soñar', 'demostrar',
  'volver', 'mover', 'mostrar', 'rogar', 'comprobar', 'apostar', 'aprobar',
  'renovar', 'envolver', 'revolver', 'conmover', 'absolver', 'soler', 'llover', 'oler',
  // BUG-002: almorzar is o→ue on top of the -zar spelling swap (almuerzo,
  // almuerce), which the two narrow rules below cannot produce.
  'almorzar',
  // e→i stem change (-ir only)
  'pedir', 'servir', 'seguir', 'conseguir', 'elegir', 'repetir', 'competir',
  'concebir', 'embestir',
  // -uir y-insertion in MORE forms than the narrow -er/-ir vowel-stem rule below
  'construir', 'destruir', 'huir', 'influir', 'distribuir', 'destituir',
  // 1st-person-only presente irregulars (-zco/-jo/-go) and c→z/g→j/gu→g before a/o
  'conducir', 'traer', 'caer', 'recoger', 'proteger', 'dirigir', 'exigir',
  'fingir', 'surgir', 'restringir', 'escoger', 'distinguir', 'agradecer',
  'merecer', 'nacer', 'crecer', 'obedecer', 'pertenecer', 'aparecer',
  'desaparecer', 'amanecer', 'convencer', 'establecer', 'reconocer',
  'producir', 'traducir', 'reducir', 'permanecer', 'apetecer', 'conocer',
  'envejecer', 'carecer', 'deducir',
  // irregular preterite stem, not a plain vowel/orthography rule
  'andar',
  // compound verbs sharing an irregular base (tener/poner/decir/venir/ver),
  // not worth a second full table row
  'obtener', 'mantener', 'detener', 'sostener', 'suponer', 'reponer',
  'exponer', 'contradecir', 'bendecir', 'prevenir', 'prever',
  // accent-shifting -iar/-uar/-uir hiatus verbs (envío not envio)
  'confiar', 'enviar', 'actuar', 'continuar', 'desvirtuar', 'devaluar',
  'reunir', 'averiguar', 'aunar', 'prohibir',
]);

// ---------------------------------------------------------------------------
// Regular -ar/-er/-ir conjugation, rule-generated (not a per-verb table).
// ---------------------------------------------------------------------------

const REGULAR_ENDINGS: Record<Tense, { ar: FormTuple; er: FormTuple; ir: FormTuple }> = {
  presente: {
    ar: ['o', 'as', 'a', 'amos', 'an'],
    er: ['o', 'es', 'e', 'emos', 'en'],
    ir: ['o', 'es', 'e', 'imos', 'en'],
  },
  indefinido: {
    ar: ['é', 'aste', 'ó', 'amos', 'aron'],
    er: ['í', 'iste', 'ió', 'imos', 'ieron'],
    ir: ['í', 'iste', 'ió', 'imos', 'ieron'],
  },
  imperfecto: {
    ar: ['aba', 'abas', 'aba', 'ábamos', 'aban'],
    er: ['ía', 'ías', 'ía', 'íamos', 'ían'],
    ir: ['ía', 'ías', 'ía', 'íamos', 'ían'],
  },
  futuro: {
    ar: ['é', 'ás', 'á', 'emos', 'án'],
    er: ['é', 'ás', 'á', 'emos', 'án'],
    ir: ['é', 'ás', 'á', 'emos', 'án'],
  },
  condicional: {
    ar: ['ía', 'ías', 'ía', 'íamos', 'ían'],
    er: ['ía', 'ías', 'ía', 'íamos', 'ían'],
    ir: ['ía', 'ías', 'ía', 'íamos', 'ían'],
  },
  subjuntivo_presente: {
    ar: ['e', 'es', 'e', 'emos', 'en'],
    er: ['a', 'as', 'a', 'amos', 'an'],
    ir: ['a', 'as', 'a', 'amos', 'an'],
  },
};

type VerbClass = 'ar' | 'er' | 'ir';

function verbClass(infinitive: string): VerbClass | null {
  if (infinitive.length < 3) return null;
  const end = infinitive.slice(-2);
  if (end === 'ar' || end === 'er' || end === 'ir') return end as VerbClass;
  return null;
}

// -car/-gar/-zar → qu/gu/c before a front vowel (e/é), the standard Spanish
// spelling-preservation rule (busqué not buscé, llegué not llegé, crucé not
// cruzé). Verbs where this combines with a STEM change (empezar, comenzar,
// jugar, colgar…) are in EXCLUDE_INFINITIVES already, so by the time this
// runs the verb is confirmed to need only the spelling swap.
function frontEStem(stem: string): string {
  if (stem.endsWith('c')) return stem.slice(0, -1) + 'qu';
  if (stem.endsWith('g')) return stem.slice(0, -1) + 'gu';
  if (stem.endsWith('z')) return stem.slice(0, -1) + 'c';
  return stem;
}

const VOWELS = new Set(['a', 'e', 'i', 'o', 'u']);

// BUG-002: whole verb FAMILIES need a stem change the endings above cannot
// produce, and a name list only protects the verbs someone remembered to add:
// ofrecer ("ofreco" for ofrezco), vencer ("venco" for venzo) and subyacer
// ("subyaco" for subyazco) all slipped through. Every Spanish -cer/-cir verb
// takes -zco/-zo in the yo form and the whole subjunctive, every -ger/-gir verb
// swaps g→j there, and -uir (with -guir inside it) inserts a y. None of them is
// plain-regular, so the family is excluded by shape. The 15 hand-tabled
// irregulars (hacer, decir…) are answered from IRREGULAR before this runs.
const RISKY_ENDINGS = ['cer', 'cir', 'ger', 'gir', 'uir'];

export function conjugateRegular(infinitive: string, tense: Tense): ConjugationForm[] | null {
  const cls = verbClass(infinitive);
  if (!cls) return null;
  if (infinitive.endsWith('arse') || infinitive.endsWith('erse') || infinitive.endsWith('irse')) return null; // reflexive, not modeled
  if (EXCLUDE_INFINITIVES.has(infinitive) || IRREGULAR_INFINITIVES.has(infinitive)) return null;
  if (RISKY_ENDINGS.some((end) => infinitive.endsWith(end))) return null;

  const stem = infinitive.slice(0, -2);
  const endings = REGULAR_ENDINGS[tense][cls];

  if (tense === 'futuro' || tense === 'condicional') {
    return toForms(endings.map((e) => infinitive + e) as FormTuple);
  }

  if (cls === 'ar' && tense === 'indefinido') {
    // Only the "yo" ending (é) starts with a front vowel; aste/ó/amos/aron
    // don't trigger the c/g/z spelling change.
    const tuple = endings.map((e, i) => (i === 0 ? frontEStem(stem) + e : stem + e)) as FormTuple;
    return toForms(tuple);
  }

  if (cls === 'ar' && tense === 'subjuntivo_presente') {
    // Every -ar subjunctive ending starts with "e", the spelling change
    // applies to the whole paradigm (busque, busques, busque, busquemos, busquen).
    const fStem = frontEStem(stem);
    const tuple = endings.map((e) => fStem + e) as FormTuple;
    return toForms(tuple);
  }

  if ((cls === 'er' || cls === 'ir') && tense === 'indefinido' && stem.length > 0 && VOWELS.has(stem.slice(-1))) {
    // creer/leer-style vowel stem: the whole preterite carries a written
    // accent on the í (creí, creíste, creímos), and the 3rd persons take a
    // "y" instead of "i" (creyó, creyeron). Every -uir verb that would ALSO
    // need y-insertion in the PRESENTE is excluded above, so this branch
    // only ever fires for the narrower -er/-ir vowel-stem case.
    const tuple: FormTuple = [stem + 'í', stem + 'íste', stem + 'yó', stem + 'ímos', stem + 'yeron'];
    return toForms(tuple);
  }

  return toForms(endings.map((e) => stem + e) as FormTuple);
}

export function conjugate(infinitive: string, tense: Tense): ConjugationForm[] | null {
  const irregular = IRREGULAR[infinitive];
  if (irregular) return toForms(irregular[tense]);
  return conjugateRegular(infinitive, tense);
}

export function formFor(infinitive: string, tense: Tense, person: Person): string | null {
  const forms = conjugate(infinitive, tense);
  return forms?.find((f) => f.person === person)?.form ?? null;
}

// ---------------------------------------------------------------------------
// Round building (GAMES.md 4.7 loop: "yo ___ (comer)" + 3 buttons).
// ---------------------------------------------------------------------------

export interface ConjugationCandidate {
  wordId: number;
  infinitive: string; // learned-language infinitive, straight from the pool
  isNew: boolean;
}

export interface ConjugationRound {
  wordId: number;
  infinitive: string;
  isNew: boolean;
  tense: Tense;
  person: Person;
  correct: string;
  options: string[]; // 3 options, shuffled, includes `correct` exactly once
}

function dedupeByForm(forms: ConjugationForm[]): ConjugationForm[] {
  const seen = new Set<string>();
  const out: ConjugationForm[] = [];
  for (const f of forms) {
    if (seen.has(f.form)) continue;
    seen.add(f.form);
    out.push(f);
  }
  return out;
}

/**
 * Picks a verb from `candidates` (already filtered to the vocabPool, GAMES.md
 * 0.) and a tense from `tenses`, conjugates it, and builds a 3-option round:
 * the target person's form plus 2 near-miss options (other persons of the
 * SAME verb+tense, which are naturally similar text, teaching the endings).
 * Returns null only if nothing in `candidates`×`tenses` conjugates safely
 * (conjugate() returning null for every combination), matching the
 * buildOddOneOutRound/buildBubbleRound convention of "don't start a round
 * you can't build".
 */
export function buildConjugationRound(candidates: ConjugationCandidate[], tenses: Tense[], seed: number): ConjugationRound | null {
  if (candidates.length === 0 || tenses.length === 0) return null;
  const rng = mulberry32(seed);
  const shuffledCandidates = shuffleArray(candidates, seed);
  const shuffledTenses = shuffleArray(tenses, seed + 1);

  for (const cand of shuffledCandidates) {
    for (const tense of shuffledTenses) {
      const forms = conjugate(cand.infinitive, tense);
      if (!forms) continue;
      const unique = dedupeByForm(forms);
      if (unique.length < 3) continue;

      const personIdx = Math.floor(rng() * unique.length);
      const target = unique[personIdx];
      const others = unique.filter((_, i) => i !== personIdx);
      const distractorSeed = seed + hashString(`${cand.infinitive}:${tense}`);
      const distractors = shuffleArray(others, distractorSeed).slice(0, 2);
      const options = shuffleArray([target, ...distractors], distractorSeed + 1);

      return {
        wordId: cand.wordId,
        infinitive: cand.infinitive,
        isNew: cand.isNew,
        tense,
        person: target.person,
        correct: target.form,
        options: options.map((o) => o.form),
      };
    }
  }
  return null;
}
