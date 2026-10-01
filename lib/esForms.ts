// PLAN-regi-szavak-ki 7b. lépés: a words-open kártyák ragozott alakjai (ragozott alak -> lemma
// index). Tiszta modul (csak relatív import), hogy a `data/openWords.ts` glossza-keresője és a
// `scripts/audit-games.mjs` tartalom-kapuja ugyanazt az alak-készletet használja.
//
// A `lib/games/conjugate` motor a tőhangváltó és rendhagyó igéket szándékosan nem ragozza (a
// gyakorló-játék csak biztos alakot tanít). Itt a KERESÉSHEZ kell az alak, nem a tanításhoz, ezért
// azokra az igékre, amelyekre a motor null-t ad, a tőváltozatok szerinti bő (túlgeneráló) alakkészlet
// megy: a hibás tőváltozat egy tanult ige hibás alakjaként is a tanult ige alakja, ugyanaz az
// elv, mint a scripts/words-open-check.mjs R6 helyi generálásánál.

// A ragozó motor és a főnév/melléknév-szabályok a hívótól jönnek (deps), így a modulnak nincs
// importja, és a Node (scripts/audit-games.mjs) kiterjesztés nélküli relatív import nélkül tölti.

export interface FormDeps {
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

/** Az ige lehetséges tövei: tőhangváltás (e>ie, e>i, o>ue, u>ue, o>u), c/g/z helyesírás-váltás, y-beszúrás. */
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

/** Bő alakkészlet a motor által nem ragozott igéhez (jelen, múlt, folyamatos múlt, jövő, feltételes, kötőmód jelen, gerundium, kötőmód múlt). */
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
  // -ir/-er tőre végződő magánhangzó: leyendo, creyendo; a trayendo-féle y-alak a stemVariants y-ágából
  for (const s of variants) {
    if (s.endsWith('y')) out.push(`${s}endo`);
  }
  // kötőmód múlt: a múlt idő 3. szám többes alakjából (-ron)
  for (const s of variants) {
    const stems = cls === 'ar' ? [`${s}a`] : [`${s}ie`, `${s}ye`];
    for (const b of stems) out.push(...subjuntivoImperfecto(`${b}ron`));
  }
  return out;
}

const VOSOTROS_IRREGULAR: Record<string, string> = { ir: 'vais', ser: 'sois', ver: 'veis', dar: 'dais' };

/** A vosotros jelen idejű alakja az infinitívből (hablar > habláis, tener > tenéis, vivir > vivís). */
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

/** A múlt idő 3. szám többes alakjából a kötőmód múlt alakjai (hablaron > hablara, habláramos). */
export function subjuntivoImperfecto(pretérito3pl: string): string[] {
  if (!pretérito3pl.endsWith('ron')) return [];
  const base = pretérito3pl.slice(0, -3);
  const last = base.slice(-1);
  const nos = ACCENTED[last] ? `${base.slice(0, -1)}${ACCENTED[last]}` : base;
  return [`${base}ra`, `${base}ras`, `${base}ran`, `${nos}ramos`];
}

// Rendhagyó melléknévi igenév, a végződés szerint (a toldott igék is: devolver > devuelto).
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

/** Az ige igenevei (melléknévi, hímnem/nőnem, egyes/többes): hablado, hablada, hablados, habladas. */
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
 * Egy words-open kártya (`es` + `pos`) ragozott/többes/nemi alakjai a tőalakon (a fejszó) KÍVÜL.
 * Igénél a motor alakjai és a bő tőváltozat-készlet, az igenevek és a kötőmód múlt; főnévnél és melléknévnél a többes, melléknévnél a nemi alak.
 */
export function formsOfCard(es: string, pos: string, deps: FormDeps): string[] {
  const { conjugate, TENSES, esPlural, esFeminine } = deps;
  const out: string[] = [];
  for (const alt of es.split(' / ')) {
    const written = alt.trim().toLowerCase();
    if (!written) continue;
    // a visszaható ige (levantarse) a tő-infinitív alakjait adja (me levanto, se levantó)
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
      // a motor-lista a régi korpuszra szabott: a tőhangváltó igék egy része (acordar, caber) benne szabályosként
      // szerepel, ezért a bő készlet minden igéhez hozzájön, nem csak a motor által elutasítottakhoz
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

export const ENCLITIC_PRONOUNS = ['melo', 'mela', 'selo', 'sela', 'telo', 'tela', 'nos', 'les', 'los', 'las', 'me', 'te', 'se', 'le', 'lo', 'la'];

/**
 * Az igéhez írt névmás levágása (verlo, ayúdame, repetirlo, visitarnos): a lehetséges tövek
 * (legalább 3 betű). A hívó dönti el, melyik tő ige-alak (a keresés kulcsa ékezet nélküli).
 */
export function encliticBases(word: string): string[] {
  const out: string[] = [];
  for (const pron of ENCLITIC_PRONOUNS) {
    if (word.endsWith(pron) && word.length - pron.length >= 3) out.push(word.slice(0, -pron.length));
  }
  return out;
}
