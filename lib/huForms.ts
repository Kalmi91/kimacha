// the recognisable Hungarian word forms of the learned dictionary forms, for the "learned words only" gate
// (`lib/knownSentence.ts`). A pure module (it imports only its tables, `lib/huFormTables.ts`). It is for RECOGNITION,
// not teaching: a form passes only when a sure rule or a hand-checked table gives it, so "házat" and "irodában"
// pass, "házben" and "kertban" do not.
//
// Hungarian stacks suffixes (házaimban, látnátok), so generating every form of every learned word would put
// hundreds of strings per noun into the gate's token set. Instead the set gets a few STEM KEYS per learned word
// (`#N...:ház`, `#V...:lát`, see `huStemKeys`), and `huRecognises` walks a token back to a stem by splitting off
// a suffix and checking that the suffix is one the stem's vowel harmony and ending allow. A key starts with `#`,
// which no token has (tokens hold only letters).
//
// (a) nouns, adjectives, numerals: plural, accusative, the common cases, possessive endings (+ case on top),
//     with vowel harmony (back, front unrounded, front rounded) and the a/e -> á/é lengthening (iroda -> irodában),
// (b) stem-changing nouns from a hand table (ló -> lovat, tó -> tavak, bokor -> bokrot, víz -> vizet),
// (c) verbs: present and past, indefinite and definite, conditional, infinitive, imperative, with a few
//     irregular verbs listed in full (lenni, menni, enni, ...) and a preverb in front (megeszik, elmegy).

import { IRREGULAR_VERB_FAMILIES, RAW_NOUN_FORMS, STEM_CHANGING_NOUNS } from '@/lib/huFormTables';

export { HU_CLOSED_CLASS } from '@/lib/huFormTables';

export type Harmony = 'b' | 'f' | 'r';
type NounKind = 'N' | 'A' | 'M';
type NounCtx = 'a' | 'l' | 'v' | 'c' | 'i';

const VOWELS = 'aáeéiíoóöőuúüű';
const BACK_VOWELS = 'aáoóuú';
const ROUNDED_VOWELS = 'öőüű';
const isVowel = (ch: string): boolean => VOWELS.includes(ch);

// Neutral-vowel-only nouns that nevertheless take the back endings (híd -> hídon, cél -> célok).
const BACK_NEUTRAL_NOUNS: ReadonlySet<string> = new Set(['híd', 'cél', 'nyíl', 'zsír', 'sír', 'szíj', 'íj', 'kín', 'derék']);

/**
 * The vowel harmony of a word: back (a o u), front unrounded (e i) or front rounded (ö ü). The last vowel
 * decides; a neutral last vowel (e é i í) looks one back, after a rounded vowel it is front unrounded (büfé).
 */
export function huHarmony(word: string): Harmony {
  if (BACK_NEUTRAL_NOUNS.has(word)) return 'b';
  if (/(?:gép|kép)$/.test(word)) return 'f';
  const vowels = [...word].filter(isVowel);
  const last = vowels[vowels.length - 1];
  if (last === undefined || BACK_VOWELS.includes(last)) return 'b';
  if (ROUNDED_VOWELS.includes(last)) return 'r';
  // Neutral last vowel: look at what stands before it. Two neutral vowels at the end (testvér), or all of them,
  // are front; a single one after a back vowel is back (papír, kávé, fazék, szomszéd) unless it is an e (hotel).
  const prev = vowels[vowels.length - 2];
  if (prev === undefined || !(BACK_VOWELS.includes(prev) || ROUNDED_VOWELS.includes(prev))) return 'f';
  if (ROUNDED_VOWELS.includes(prev)) return 'f';
  return last === 'e' && !isVowel(word.slice(-1)) ? 'f' : 'b';
}

/** Suffix templates: A = a/e, Á = á/é, O = o/e/ö, Ó = ó/ő, U = u/ü, L = the linking vowel (a|o, e, ö|e). */
function expand(template: string, h: Harmony): string[] {
  let out = [''];
  for (const ch of template) {
    let alts: string[];
    switch (ch) {
      case 'A': alts = [h === 'b' ? 'a' : 'e']; break;
      case 'Á': alts = [h === 'b' ? 'á' : 'é']; break;
      case 'O': alts = [h === 'b' ? 'o' : h === 'f' ? 'e' : 'ö']; break;
      case 'Ó': alts = [h === 'b' ? 'ó' : 'ő']; break;
      case 'U': alts = [h === 'b' ? 'u' : 'ü']; break;
      case 'L': alts = h === 'b' ? ['a', 'o'] : h === 'f' ? ['e'] : ['ö', 'e']; break;
      default: alts = [ch];
    }
    out = out.flatMap((o) => alts.map((a) => o + a));
  }
  return out;
}

// ---------------------------------------------------------------------------------------------------------------
// Nouns

const DIGRAPHS: ReadonlySet<string> = new Set(['cs', 'sz', 'zs', 'ny', 'ty', 'gy', 'ly', 'dz']);
// After these a consonant-final stem may take the accusative -t straight (asztalt, tojást, embert, dobozt).
const DIRECT_T: ReadonlySet<string> = new Set(['l', 'r', 'j', 'ly', 'n', 'ny', 's', 'sz', 'z', 'zs']);

interface End {
  vowel: boolean;
  /** The last consonant (or digraph) of a consonant-final stem. */
  unit: string;
  /** The accusative may be the bare -t (asztalt, tojást, pénzt) as well as the link vowel (vonalat, házat). */
  direct: boolean;
  /** The stem ends in a doubled consonant (csekk, toll): -val then adds no further consonant (csekkel). */
  double: boolean;
}
const V_END: End = { vowel: true, unit: '', direct: false, double: false };
const cEnd = (unit: string): End => ({ vowel: false, unit, direct: false, double: false });

function lastUnit(tail: string): string {
  const two = tail.slice(-2);
  return DIGRAPHS.has(two) ? two : tail.slice(-1);
}

/** The cases that only depend on the stem's ending: `plain` ones are the same after every stem. */
function caseTemplates(end: End): { plain: string[]; rest: string[] } {
  const plain = ['nAk', 'bAn', 'bA', 'bÓl', 'rA', 'rÓl', 'nÁl', 'hOz', 'tÓl', 'ért', 'ig', 'ként'];
  const rest: string[] = [];
  if (end.vowel) {
    plain.push('vAl', 'vÁ', 'nként');
    rest.push('t', 'k', 'n');
  } else {
    plain.push('Onként');
    // val/vel and vá/vé double the stem's last consonant; a digraph (busz -> busszal) is handled apart.
    if (end.double) plain.push('Al', 'Á');
    else if (!DIGRAPHS.has(end.unit)) plain.push(`${end.unit}Al`, `${end.unit}Á`);
    rest.push('Lk', 'On', 'Lt');
    if (end.direct) rest.push('t');
  }
  return { plain, rest };
}

const POSS_AFTER_VOWEL: [string, End | null][] = [
  ['m', cEnd('m')], ['d', cEnd('d')], ['jA', null], ['jÁ', V_END], ['nk', cEnd('k')], ['tOk', cEnd('k')], ['jUk', cEnd('k')],
  ['im', cEnd('m')], ['id', cEnd('d')], ['i', V_END], ['ink', cEnd('k')], ['itOk', cEnd('k')], ['ik', cEnd('k')],
];
const POSS_AFTER_CONSONANT: [string, End | null][] = [
  ['Lm', cEnd('m')], ['Ld', cEnd('d')], ['A', null], ['Á', V_END], ['jA', null], ['jÁ', V_END],
  ['Unk', cEnd('k')], ['LtOk', cEnd('k')], ['Uk', cEnd('k')], ['jUk', cEnd('k')],
  ['Aim', cEnd('m')], ['Aid', cEnd('d')], ['Ai', V_END], ['Aink', cEnd('k')], ['AitOk', cEnd('k')], ['Aik', cEnd('k')],
  ['jAim', cEnd('m')], ['jAid', cEnd('d')], ['jAi', V_END], ['jAink', cEnd('k')], ['jAitOk', cEnd('k')], ['jAik', cEnd('k')],
];

interface NounSuffixes {
  all: ReadonlySet<string>;
  plain: ReadonlySet<string>;
}
const nounSuffixCache = new Map<string, NounSuffixes>();

/** Every suffix chain a noun with this ending and harmony takes. Depends on the last three letters only. */
function nounSuffixes(tail: string, h: Harmony, kind: NounKind, forceConsonant: boolean): NounSuffixes {
  const cacheKey = `${tail}|${h}|${kind}|${forceConsonant ? 1 : 0}`;
  const cached = nounSuffixCache.get(cacheKey);
  if (cached) return cached;

  const vowelFinal = !forceConsonant && isVowel(tail.slice(-1));
  const unit = lastUnit(tail);
  const direct = DIRECT_T.has(unit);
  const double = tail.length >= 2 && tail.slice(-1) === tail.slice(-2, -1) && !isVowel(tail.slice(-1));
  const end: End = vowelFinal ? V_END : { vowel: false, unit, direct, double };
  const all = new Set<string>();
  const addWithCases = (template: string, after: End | null) => {
    for (const base of expand(template, h)) {
      all.add(base);
      if (!after) continue;
      const { plain, rest } = caseTemplates(after);
      for (const c of [...plain, ...rest]) for (const tail2 of expand(c, h)) all.add(base + tail2);
    }
  };
  addWithCases('', end);
  addWithCases(vowelFinal ? 'k' : 'Lk', cEnd('k'));
  for (const [template, after] of vowelFinal ? POSS_AFTER_VOWEL : POSS_AFTER_CONSONANT) addWithCases(template, after);
  if (kind === 'A') {
    if (vowelFinal) addWithCases('Ak', cEnd('k'));
    addWithCases('An', null);
    addWithCases('Ul', null);
    addWithCases(vowelFinal ? 'bb' : 'Lbb', cEnd('b'));
    addWithCases(vowelFinal ? 'bbAn' : 'LbbAn', null);
  }
  if (kind === 'N') addWithCases(vowelFinal ? 's' : 'Os', null);
  if (kind === 'M') {
    addWithCases('kor', null);
    addWithCases('szOr', null);
  }
  const plain = new Set<string>();
  for (const c of caseTemplates(end).plain) for (const s of expand(c, h)) plain.add(s);
  const result = { all, plain };
  nounSuffixCache.set(cacheKey, result);
  return result;
}

/** Whether `suffix` may follow the bound stem `stem` under the given key context. */
function nounSuffixOk(stem: string, h: Harmony, kind: NounKind, ctx: NounCtx, suffix: string): boolean {
  const tail = stem.slice(-3);
  if (ctx === 'i') return suffix === 'i';
  if (ctx === 'c') return suffix === '' || nounSuffixes(tail, h, kind, false).plain.has(suffix);
  if (ctx === 'v') return suffix !== '' && isVowel(suffix[0]) && nounSuffixes(tail, h, kind, true).all.has(suffix);
  if (ctx === 'l') return suffix !== '' && nounSuffixes(tail, h, kind, false).all.has(suffix);
  return nounSuffixes(tail, h, kind, false).all.has(suffix);
}

interface IrregularNoun {
  stems: string[];
  keepRegular: boolean;
}
let irregularNouns: Map<string, IrregularNoun> | undefined;
function irregularNounTable(): Map<string, IrregularNoun> {
  if (irregularNouns) return irregularNouns;
  irregularNouns = new Map();
  for (const entry of STEM_CHANGING_NOUNS.split(/\s+/).filter(Boolean)) {
    const keepRegular = entry.endsWith('+');
    const [word, stems] = entry.replace(/\+$/, '').split('>');
    irregularNouns.set(word, { stems: stems.split(','), keepRegular });
  }
  return irregularNouns;
}

const NOUN_WORD = /^[a-záéíóöőúüű]{2,}$/;

function nounKeys(head: string, kind: NounKind): string[] {
  if (!NOUN_WORD.test(head)) return [];
  const h = huHarmony(head);
  const keys: string[] = [];
  const irregular = irregularNounTable().get(head);
  if (irregular) {
    keys.push(`#${kind}${h}c:${head}`);
    for (const stem of irregular.stems) {
      if (stem.endsWith('!')) keys.push(`#${kind}${h}l:${stem.slice(0, -1)}`);
      else keys.push(`#${kind}${h}v:${stem}`);
    }
  }
  if (!irregular || irregular.keepRegular) {
    const last = head.slice(-1);
    if (last === 'a' || last === 'e') keys.push(`#${kind}${h}l:${head.slice(0, -1)}${last === 'a' ? 'á' : 'é'}`);
    else keys.push(`#${kind}${h}a:${head}`);
  }
  if (kind === 'N') keys.push(`#N${h}i:${head}`);
  const raw = RAW_NOUN_FORMS[head];
  if (raw) keys.push(...raw.split(' '));
  return keys;
}

const NOUN_KINDS: NounKind[] = ['N', 'A', 'M'];
const HARMONIES: Harmony[] = ['b', 'f', 'r'];
const NOUN_CTXS: NounCtx[] = ['a', 'l', 'v', 'c', 'i'];
const MAX_SUFFIX = 11;
const NOUN_KEY_PREFIXES = NOUN_KINDS.flatMap((kind) =>
  HARMONIES.flatMap((h) => NOUN_CTXS.map((ctx) => ({ kind, h, ctx, prefix: `#${kind}${h}${ctx}:` }))),
);

// busz + val = busszal, lány + val = lánnyal: the doubled digraph is not the stem plus a suffix.
const DOUBLED_DIGRAPHS: [string, string][] = [['ssz', 'sz'], ['ccs', 'cs'], ['zzs', 'zs'], ['nny', 'ny'], ['tty', 'ty'], ['ggy', 'gy'], ['lly', 'ly']];

function digraphInstrumental(token: string, known: ReadonlySet<string>): boolean {
  for (const [doubled, digraph] of DOUBLED_DIGRAPHS) {
    const at = token.lastIndexOf(doubled);
    if (at < 1) continue;
    const suffix = token.slice(at + doubled.length);
    if (suffix !== 'al' && suffix !== 'el' && suffix !== 'á' && suffix !== 'é') continue;
    const back = suffix === 'al' || suffix === 'á';
    const stem = token.slice(0, at) + digraph;
    for (const { h, ctx, prefix } of NOUN_KEY_PREFIXES) {
      if ((ctx === 'a' || ctx === 'c') && back === (h === 'b') && known.has(prefix + stem)) return true;
    }
  }
  return false;
}

function nounKnown(token: string, known: ReadonlySet<string>): boolean {
  for (let i = token.length; i >= 2 && token.length - i <= MAX_SUFFIX; i--) {
    const stem = token.slice(0, i);
    for (const { kind, h, ctx, prefix } of NOUN_KEY_PREFIXES) {
      if (known.has(prefix + stem) && nounSuffixOk(stem, h, kind, ctx, token.slice(i))) return true;
    }
  }
  return digraphInstrumental(token, known);
}

// ---------------------------------------------------------------------------------------------------------------
// Verbs

type VerbType = 'n' | 'i';

interface VerbEndings {
  /** Present indefinite of an ordinary verb, without the 2nd person singular (ok/ek/ök, 3rd person, unk, ...). */
  indef: string[];
  /** 2nd person singular after a sibilant stem (olvasol) / otherwise (látsz). */
  sibilant: string;
  /** Present of an -ik verb (eszem, eszel, eszik, ...). */
  ik: string[];
  def: string[];
  past: string[];
  pastDef: string[];
  cond: string[];
  condDef: string[];
  inf: string[];
  /** The infinitive with a personal ending (döntenünk, lemondanom, fizetned, tartalmaznia). */
  infPerson: string[];
  imp: string[];
  impDef: string[];
}

const VERB_ENDINGS: Record<Harmony, VerbEndings> = {
  b: {
    indef: ['ok', '', 'unk', 'tok', 'nak', 'lak'],
    sibilant: 'ol',
    ik: ['om', 'ol', 'ik', 'unk', 'tok', 'nak', 'anak'],
    def: ['om', 'od', 'ja', 'juk', 'játok', 'ják'],
    past: ['tam', 'tál', 't', 'ott', 'tunk', 'tatok', 'tak', 'ottam', 'ottál', 'ottunk', 'ottatok', 'ottak'],
    pastDef: ['tam', 'tad', 'ta', 'tuk', 'tátok', 'ták', 'otta', 'ottam', 'ottad', 'ottuk', 'ottátok', 'ották'],
    cond: ['nék', 'nál', 'na', 'nánk', 'nátok', 'nának'],
    condDef: ['nám', 'nád', 'ná', 'nánk', 'nátok', 'nák'],
    inf: ['ni', 'ani'],
    infPerson: ['nom', 'nod', 'nia', 'nunk', 'notok', 'niuk', 'anom', 'anod', 'ania', 'anunk', 'anotok', 'aniuk'],
    imp: ['jak', 'jál', 'jon', 'junk', 'jatok', 'janak'],
    impDef: ['d', 'jam', 'ja', 'juk', 'játok', 'ják'],
  },
  f: {
    indef: ['ek', '', 'ünk', 'tek', 'nek', 'lek'],
    sibilant: 'el',
    ik: ['em', 'el', 'ik', 'ünk', 'tek', 'nek', 'enek'],
    def: ['em', 'ed', 'i', 'jük', 'itek', 'ik'],
    past: ['tem', 'tél', 't', 'ett', 'tünk', 'tetek', 'tek', 'ettem', 'ettél', 'ettünk', 'ettetek', 'ettek'],
    pastDef: ['tem', 'ted', 'te', 'tük', 'tétek', 'ték', 'ette', 'ettem', 'etted', 'ettük', 'ettétek', 'ették'],
    cond: ['nék', 'nél', 'ne', 'nénk', 'nétek', 'nének'],
    condDef: ['ném', 'néd', 'né', 'nénk', 'nétek', 'nék'],
    inf: ['ni', 'eni'],
    infPerson: ['nem', 'ned', 'nie', 'nünk', 'netek', 'niük', 'enem', 'ened', 'enie', 'enünk', 'enetek', 'eniük'],
    imp: ['jek', 'jél', 'jen', 'jünk', 'jetek', 'jenek'],
    impDef: ['d', 'jem', 'je', 'jük', 'jétek', 'jék'],
  },
  r: {
    indef: ['ök', '', 'ünk', 'tök', 'nek', 'lek'],
    sibilant: 'öl',
    ik: ['öm', 'öl', 'ik', 'ünk', 'tök', 'nek', 'enek'],
    def: ['öm', 'öd', 'i', 'jük', 'itek', 'ik'],
    past: ['tem', 'tél', 't', 'ött', 'tünk', 'tetek', 'tek', 'öttem', 'öttél', 'öttünk', 'öttetek', 'öttek'],
    pastDef: ['tem', 'ted', 'te', 'tük', 'tétek', 'ték', 'ötte', 'öttem', 'ötted', 'öttük', 'öttétek', 'ötték'],
    cond: ['nék', 'nél', 'ne', 'nénk', 'nétek', 'nének'],
    condDef: ['ném', 'néd', 'né', 'nénk', 'nétek', 'nék'],
    inf: ['ni', 'eni'],
    infPerson: ['nem', 'ned', 'nie', 'nünk', 'netek', 'niük', 'nöm', 'nöd', 'nötök', 'enem', 'ened', 'enie', 'enünk', 'enetek', 'eniük'],
    imp: ['jek', 'jél', 'jön', 'jünk', 'jetek', 'jenek'],
    impDef: ['d', 'jem', 'je', 'jük', 'jétek', 'jék'],
  },
};

/** The suffix a j-initial ending takes after the stem (olvas + ja = olvassa, főz + jük = főzzük); null = none. */
function joinJ(stem: string, ending: string): string | null {
  if (!ending.startsWith('j')) return ending;
  if (stem.endsWith('sz')) return null;
  if (stem.endsWith('s') && !stem.endsWith('zs') && !stem.endsWith('cs')) return `s${ending.slice(1)}`;
  if (stem.endsWith('z') && !stem.endsWith('dz')) return `z${ending.slice(1)}`;
  return ending;
}

const verbSuffixCache = new Map<string, ReadonlySet<string>>();

/** Every suffix an ordinary verb stem takes. Depends on the stem's last two letters, its harmony and type. */
function verbSuffixes(stem: string, h: Harmony, type: VerbType): ReadonlySet<string> {
  const tail = stem.slice(-2);
  const cacheKey = `${tail}|${h}|${type}`;
  const cached = verbSuffixCache.get(cacheKey);
  if (cached) return cached;
  const e = VERB_ENDINGS[h];
  const out = new Set<string>();
  const sibilant = /(?:sz|[^zc]s|^s|[^sd]z)$/.test(tail);
  const addAll = (endings: string[]) => {
    for (const ending of endings) {
      const joined = joinJ(tail, ending);
      if (joined !== null) out.add(joined);
    }
  };
  if (type === 'n') {
    addAll(e.indef);
    out.add(sibilant ? e.sibilant : 'sz');
    addAll(e.def);
    addAll(e.condDef);
    addAll(e.impDef);
  } else {
    addAll(e.ik);
  }
  addAll(e.past);
  addAll(e.pastDef);
  addAll(e.cond);
  addAll(e.inf);
  addAll(e.infPerson);
  addAll(e.imp);
  out.add(tail.endsWith('s') && !tail.endsWith('zs') ? 's' : tail.endsWith('z') && !tail.endsWith('sz') ? 'z' : 'j');
  verbSuffixCache.set(cacheKey, out);
  return out;
}

const PREVERBS = [
  'meg', 'el', 'ki', 'be', 'fel', 'le', 'át', 'rá', 'vissza', 'össze', 'haza', 'oda', 'ide', 'szét', 'hozzá', 'bele', 'neki', 'tovább',
];

let familyIndex: Map<string, string[]> | undefined;
function familiesOf(form: string): string[] {
  if (!familyIndex) {
    familyIndex = new Map();
    for (const [id, source] of Object.entries(IRREGULAR_VERB_FAMILIES)) {
      for (const f of source.split(/\s+/).filter(Boolean)) {
        const ids = familyIndex.get(f);
        if (ids) {
          if (!ids.includes(id)) ids.push(id);
        } else familyIndex.set(f, [id]);
      }
    }
  }
  return familyIndex.get(form) ?? [];
}

/** The form with a preverb taken off (megérkezik -> érkezik), or the form itself. */
function withoutPreverb(word: string): string[] {
  const out = [word];
  for (const pv of PREVERBS) {
    if (word.startsWith(pv) && word.length >= pv.length + 3) out.push(word.slice(pv.length));
  }
  return out;
}

const PRONOUNS: ReadonlySet<string> = new Set(['én', 'te', 'ő', 'mi', 'ti', 'ők', 'ön', 'maga', 'önök', 'a', 'az', 'egy', 'nem', 'ne']);

/** The verb stems (and their type) a verb form in an entry stands for: kérek -> kér, eszem -> esz (-ik), láttam -> lát. */
function verbStemsOf(form: string, strict: boolean): { stem: string; type: VerbType }[] {
  const out: { stem: string; type: VerbType }[] = [];
  const add = (stem: string, type: VerbType) => {
    if (stem.length >= 2) out.push({ stem, type });
  };
  const both = (stem: string) => {
    add(stem, 'n');
    add(stem, 'i');
  };
  if (/(?:ok|ek|ök)$/.test(form)) add(form.slice(0, -2), 'n');
  else if (/(?:om|em|öm)$/.test(form)) both(form.slice(0, -2));
  else if (form.endsWith('ik')) add(form.slice(0, -2), 'i');
  else if (/(?:ottam|ettem|öttem)$/.test(form)) both(form.slice(0, -5));
  else if (/(?:tam|tem)$/.test(form)) both(form.slice(0, -3));
  else if (/(?:ott|ett|ött)$/.test(form)) both(form.slice(0, -3));
  else if (/(?:ani|eni)$/.test(form)) both(form.slice(0, -3));
  else if (form.endsWith('ni')) both(form.slice(0, -2));
  else {
    // A form with no personal ending: the definite 3rd person (látja, kéri), the conditional (szeretnék, szeretne),
    // or the bare stem itself (olvas, sajnál).
    if (/(?:ja|je)$/.test(form)) add(form.slice(0, -2), 'n');
    else if (form.endsWith('i')) add(form.slice(0, -1), 'n');
    else if (form.endsWith('nék')) both(form.slice(0, -3));
    else if (/(?:na|ne)$/.test(form) && form.length >= 6) both(form.slice(0, -2));
    if (!strict) add(form, 'n');
  }
  return out;
}

/** Neutral-vowel-only verb stems with i/í take either ending set (ír: írok, kér: kérek is front by its e). */
function verbHarmonies(stem: string): Harmony[] {
  const vowels = [...stem].filter(isVowel);
  const neutralOnly = vowels.length > 0 && vowels.every((v) => 'eéií'.includes(v));
  if (neutralOnly && !/[eé]/.test(stem)) return ['b', 'f'];
  return [huHarmony(stem)];
}

function verbKeys(tokens: string[], strict: boolean): string[] {
  const keys: string[] = [];
  const words = tokens.filter((t) => !PRONOUNS.has(t) && NOUN_WORD.test(t));
  for (const word of words) {
    for (const base of withoutPreverb(word)) for (const id of familiesOf(base)) keys.push(`#F:${id}`);
  }
  const candidates = words.length > 2 ? [words[0], words[words.length - 1]] : words;
  for (const word of candidates) {
    for (const form of withoutPreverb(word)) {
      for (const { stem, type } of verbStemsOf(form, strict)) {
        for (const h of verbHarmonies(stem)) keys.push(`#V${type}${h}:${stem}`);
        // The stem that drops its vowel before a vowel: érez, érzek, érzem.
        if (/[rl]z$/.test(stem)) keys.push(`${stem.slice(0, -1)}ez`);
        if (stem.endsWith('érez')) {
          const short = `${stem.slice(0, -2)}z`;
          for (const h of verbHarmonies(short)) keys.push(`#V${type}${h}:${short}`);
        }
        // The verbal noun and the participle: tanítás, pihenés, dolgozó.
        if (stem.length >= 3) {
          for (const h of verbHarmonies(stem)) {
            keys.push(...nounKeys(`${stem}${h === 'b' ? 'ás' : 'és'}`, 'N'), ...nounKeys(`${stem}${h === 'b' ? 'ó' : 'ő'}`, 'A'));
          }
        }
      }
    }
  }
  return keys;
}

const VERB_TYPES: VerbType[] = ['n', 'i'];
const MAX_VERB_SUFFIX = 9;

function plainVerbKnown(word: string, known: ReadonlySet<string>): boolean {
  if (familiesOf(word).some((id) => known.has(`#F:${id}`))) return true;
  for (let i = word.length; i >= 2 && word.length - i <= MAX_VERB_SUFFIX; i--) {
    const stem = word.slice(0, i);
    for (const type of VERB_TYPES) {
      for (const h of HARMONIES) {
        if (!known.has(`#V${type}${h}:${stem}`)) continue;
        const suffix = word.slice(i);
        if (verbSuffixes(stem, h, type).has(suffix)) return true;
        // can / may: -hat / -het, then the present or past endings (kérhetek, kaphatok, választhatsz).
        const modal = h === 'b' ? 'hat' : 'het';
        if (suffix.startsWith(modal) && verbSuffixes(modal, h === 'b' ? 'b' : 'f', 'n').has(suffix.slice(3))) return true;
      }
    }
  }
  return false;
}

function verbKnown(token: string, known: ReadonlySet<string>): boolean {
  if (plainVerbKnown(token, known)) return true;
  for (const pv of PREVERBS) {
    if (token.startsWith(pv) && token.length >= pv.length + 3 && plainVerbKnown(token.slice(pv.length), known)) return true;
  }
  return false;
}

/**
 * The keys a learned entry adds to the gate's token set (besides its own tokens): its nouns, adjectives, numerals
 * and verbs as stems the inflected forms are walked back to. `text` is the card's Hungarian text ("a barát",
 * "eszem", "tesz / rak"); `pos` is the card's part of speech, if known (without it both readings are tried).
 */
export function huStemKeys(text: string, pos?: string): string[] {
  const keys: string[] = [];
  const nominal = pos === undefined || pos === 'noun' || pos === 'adj' || pos === 'num';
  const verbal = pos === undefined || pos === 'verb' || pos === 'phrase';
  const kind: NounKind = pos === 'adj' ? 'A' : pos === 'num' ? 'M' : 'N';
  for (const alternative of text.toLowerCase().split('/')) {
    const tokens = alternative
      .replace(/\([^)]*\)/g, ' ')
      .replace(/[^a-záéíóöőúüű\s]/g, ' ')
      .split(/\s+/)
      .filter(Boolean);
    if (tokens.length === 0) continue;
    if (nominal && !PRONOUNS.has(tokens[tokens.length - 1])) keys.push(...nounKeys(tokens[tokens.length - 1], kind));
    // A phrase ("érzi magát") only gives stems from forms that are surely verb forms.
    if (verbal) keys.push(...verbKeys(tokens, pos === 'phrase'));
  }
  return keys;
}

/** Whether a token is an inflected form of a word the key set (`huStemKeys` of the learned entries) holds. */
export function huRecognises(token: string, known: ReadonlySet<string>): boolean {
  if (token.length < 2) return false;
  if (nounKnown(token, known) || verbKnown(token, known)) return true;
  // The superlative: leg + the comparative (legnagyobb).
  return token.startsWith('leg') && token.includes('bb') && nounKnown(token.slice(3), known);
}

/** The headwords of the stem-changing noun table (the test pins one expectation per row). */
export function huStemChangingWords(): string[] {
  return [...irregularNounTable().keys()];
}
