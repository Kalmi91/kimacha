// the inflected forms of the words-open cards (inflected form -> lemma
// index). A pure module (relative imports only), so that the gloss lookup of `data/openWords.ts` and the
// content gate of `scripts/audit-games.mjs` use the same form set.
//
// The `lib/games/conjugate` engine deliberately does not conjugate stem-changing and irregular verbs (the
// practice game only teaches certain forms). Here the form is needed for LOOKUP, not for teaching, so
// for the verbs the engine returns null for, a broad (over-generating) form set
// built from the stem variants is used: even a wrong stem variant, as a wrong form of a learned verb, is still a form of that verb, the same
// principle as in the local generation of R6 in scripts/words-open-check.mjs.

// The conjugation engine and the noun/adjective rules come from the caller (deps), so the module has no
// imports and Node (scripts/audit-games.mjs) loads it without an extensionless relative import.

interface FormDeps {
  conjugate: (infinitive: string, tense: any) => { person: string; form: string }[] | null;
  TENSES: readonly any[];
  esPlural: (word: string) => string | null;
  esFeminine: (word: string) => string | null;
}

const ES_INFINITIVE = /^[a-záéíóúñü]*(ar|er|ir)$/;
const FORM_ARTICLE = /^(el|la|los|las|un|una|unos|unas)\s+/;

const LOOSE_ENDINGS: Record<string, Record<'ar' | 'er' | 'ir', string[]>> = {
  presente: { ar: ['o', 'as', 'a', 'amos', 'an'], er: ['o', 'es', 'e', 'emos', 'en'], ir: ['o', 'es', 'e', 'imos', 'en'] },
  indefinido: { ar: ['é', 'aste', 'ó', 'amos', 'aron'], er: ['í', 'iste', 'ió', 'imos', 'ieron'], ir: ['í', 'iste', 'ió', 'imos', 'ieron'] },
  imperfecto: { ar: ['aba', 'abas', 'aba', 'ábamos', 'aban'], er: ['ía', 'ías', 'ía', 'íamos', 'ían'], ir: ['ía', 'ías', 'ía', 'íamos', 'ían'] },
  subjuntivo_presente: { ar: ['e', 'es', 'e', 'emos', 'en'], er: ['a', 'as', 'a', 'amos', 'an'], ir: ['a', 'as', 'a', 'amos', 'an'] },
};
const FUTURE = ['é', 'ás', 'á', 'emos', 'án'];
const CONDITIONAL = ['ía', 'ías', 'ía', 'íamos', 'ían'];

const ACCENTED: Record<string, string> = { a: 'á', e: 'é', i: 'í', o: 'ó', u: 'ú' };

/** The possible stems of the verb: stem change (e>ie, e>i, o>ue, u>ue, o>u), c/g/z spelling change, y insertion. */
function stemVariants(stem: string, cls: 'ar' | 'er' | 'ir'): string[] {
  const out = new Set<string>([stem]);
  const swapLast = (s: string, ch: string, rep: string) => {
    const i = s.lastIndexOf(ch);
    return i === -1 ? null : s.slice(0, i) + rep + s.slice(i + 1);
  };
  for (const [ch, rep] of [['e', 'ie'], ['e', 'i'], ['o', 'ue'], ['u', 'ue'], ['o', 'u']] as const) {
    const v = swapLast(stem, ch, rep);
    if (v) out.add(v);
  }
  const last = stem.slice(-1);
  if (last === 'c') {
    out.add(`${stem.slice(0, -1)}qu`);
    out.add(`${stem.slice(0, -1)}z`);
    out.add(`${stem.slice(0, -1)}zc`);
  }
  if (last === 'g') {
    out.add(`${stem}u`);
    out.add(`${stem.slice(0, -1)}j`);
  }
  if (last === 'z') out.add(`${stem.slice(0, -1)}c`);
  if (/[aeiou]$/.test(last) && cls !== 'ar') out.add(`${stem}y`);
  for (const v of [...out]) if (v.endsWith('gu') && cls === 'ir') out.add(v.slice(0, -1)); // seguir > sigo
  return [...out];
}

/** A broad form set for a verb the engine does not conjugate (present, preterite, imperfect, future, conditional, present subjunctive, gerund, past subjunctive). */
export function looseVerbForms(infinitive: string): string[] {
  const cls = infinitive.slice(-2);
  if ((cls !== 'ar' && cls !== 'er' && cls !== 'ir') || infinitive.length < 4) return [];
  const stem = infinitive.slice(0, -2);
  const out: string[] = [];
  const variants = stemVariants(stem, cls);
  for (const byCls of Object.values(LOOSE_ENDINGS)) {
    for (const s of variants) for (const e of byCls[cls]) out.push(s + e);
  }
  for (const e of FUTURE) out.push(infinitive + e);
  for (const e of CONDITIONAL) out.push(infinitive + e);
  for (const s of variants) out.push(s + (cls === 'ar' ? 'ando' : 'iendo'));
  // a vowel ending an -ir/-er stem: leyendo, creyendo; the trayendo-type y form comes from the y branch of stemVariants
  for (const s of variants) {
    if (s.endsWith('y')) out.push(`${s}endo`);
  }
  // past subjunctive: from the 3rd person plural of the preterite (-ron)
  for (const s of variants) {
    const stems = cls === 'ar' ? [`${s}a`] : [`${s}ie`, `${s}ye`];
    for (const b of stems) out.push(...subjuntivoImperfecto(`${b}ron`));
  }
  return out;
}

const VOSOTROS_IRREGULAR: Record<string, string> = { ir: 'vais', ser: 'sois', ver: 'veis', dar: 'dais' };

/** The present vosotros form from the infinitive (hablar > habláis, tener > tenéis, vivir > vivís). */
export function vosotrosPresente(infinitive: string): string[] {
  if (VOSOTROS_IRREGULAR[infinitive]) return [VOSOTROS_IRREGULAR[infinitive]];
  const cls = infinitive.slice(-2);
  const stem = infinitive.slice(0, -2);
  if (infinitive.length < 4) return [];
  if (cls === 'ar') return [`${stem}áis`];
  if (cls === 'er') return [`${stem}éis`];
  if (cls === 'ir') return [`${stem}ís`];
  return [];
}

/** The past subjunctive forms from the 3rd person plural of the preterite (hablaron > hablara, habláramos). */
export function subjuntivoImperfecto(pretérito3pl: string): string[] {
  if (!pretérito3pl.endsWith('ron')) return [];
  const base = pretérito3pl.slice(0, -3);
  const last = base.slice(-1);
  const nos = ACCENTED[last] ? `${base.slice(0, -1)}${ACCENTED[last]}` : base;
  return [`${base}ra`, `${base}ras`, `${base}ran`, `${nos}ramos`];
}

// Irregular past participle, by ending (prefixed verbs too: devolver > devuelto).
const IRREGULAR_PARTICIPLE_ENDINGS: [string, string][] = [
  ['poner', 'puesto'],
  ['hacer', 'hecho'],
  ['decir', 'dicho'],
  ['scribir', 'scrito'],
  ['volver', 'vuelto'],
  ['solver', 'suelto'],
  ['abrir', 'abierto'],
  ['cubrir', 'cubierto'],
  ['romper', 'roto'],
  ['morir', 'muerto'],
];

/** The participles of the verb (past participle, masculine/feminine, singular/plural): hablado, hablada, hablados, habladas. */
export function participleForms(infinitive: string): string[] {
  const cls = infinitive.slice(-2);
  const stem = infinitive.slice(0, -2);
  const bases: string[] = [];
  if (infinitive === 'ver' || infinitive === 'prever') bases.push(`${infinitive.slice(0, -3)}visto`);
  else if ((cls !== 'ar' && cls !== 'er' && cls !== 'ir') || infinitive.length < 4) return [];
  for (const [end, part] of IRREGULAR_PARTICIPLE_ENDINGS) {
    if (infinitive.endsWith(end)) bases.push(infinitive.slice(0, -end.length) + part);
  }
  if (bases.length === 0) {
    if (cls === 'ar') bases.push(`${stem}ado`);
    else bases.push(/[aeo]$/.test(stem) ? `${stem}ído` : `${stem}ido`);
  }
  return bases.flatMap((b) => {
    const root = b.slice(0, -1);
    return [`${root}o`, `${root}a`, `${root}os`, `${root}as`];
  });
}

/**
 * The inflected/plural/gendered forms of a words-open card (`es` + `pos`) besides the base form (the headword).
 * For a verb: the engine's forms and the broad stem-variant set, the participles and the past subjunctive; for a noun and an adjective the plural, for an adjective the gendered form.
 */
export function formsOfCard(es: string, pos: string, deps: FormDeps): string[] {
  const { conjugate, TENSES, esPlural, esFeminine } = deps;
  const out: string[] = [];
  for (const alt of es.split(' / ')) {
    const written = alt.trim().toLowerCase();
    if (!written) continue;
    // a reflexive verb (levantarse) gives the forms of its base infinitive (me levanto, se levantó)
    const head = pos === 'verb' && /(ar|er|ir)se$/.test(written) ? written.slice(0, -2) : written;
    if (pos === 'verb') {
      if (!ES_INFINITIVE.test(head)) continue;
      let any = false;
      for (const tense of TENSES) {
        const forms = conjugate(head, tense);
        if (!forms) continue;
        any = true;
        for (const f of forms) out.push(f.form);
        if (tense === 'indefinido') {
          const third = forms.find((f) => f.person === 'ellos');
          if (third) out.push(...subjuntivoImperfecto(third.form));
        }
      }
      if (any) out.push(`${head.slice(0, -2)}${head.endsWith('ar') ? 'ando' : /[aeo]er$|[aeo]ir$/.test(head) ? 'yendo' : 'iendo'}`);
      // the engine list was tailored to the old corpus: some of the stem-changing verbs (acordar, caber) appear in it as regular,
      // so the broad set is added for every verb, not only for those the engine rejected
      out.push(...looseVerbForms(head));
      out.push(...participleForms(head), ...vosotrosPresente(head));
    } else if (pos === 'noun' || pos === 'adj') {
      const bare = head.replace(FORM_ARTICLE, '');
      if (!bare || bare.includes(' ') || /^(los|las)\s/.test(head)) continue;
      const plural = esPlural(bare);
      if (plural) out.push(plural);
      if (pos === 'adj') {
        const fem = esFeminine(bare);
        if (fem) {
          out.push(fem);
          const femPlural = esPlural(fem);
          if (femPlural) out.push(femPlural);
        }
      }
    }
  }
  return out;
}

const ENCLITIC_PRONOUNS = ['melo', 'mela', 'selo', 'sela', 'telo', 'tela', 'nos', 'les', 'los', 'las', 'me', 'te', 'se', 'le', 'lo', 'la'];

/**
 * Stripping the pronoun attached to a verb (verlo, ayúdame, repetirlo, visitarnos): the possible stems
 * (at least 3 letters). The caller decides which stem is a verb form (the lookup key has no accents).
 */
export function encliticBases(word: string): string[] {
  const out: string[] = [];
  for (const pron of ENCLITIC_PRONOUNS) {
    if (word.endsWith(pron) && word.length - pron.length >= 3) out.push(word.slice(0, -pron.length));
  }
  return out;
}
