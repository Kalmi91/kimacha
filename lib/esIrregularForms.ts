// The Spanish verb forms the "learned words only" gate recognises for the verbs that
// `lib/games/conjugate.ts` refuses on purpose (stem changes, spelling changes, -uir, -cer/-cir,
// irregular preterite stems, compounds of an irregular base). `conjugate` TEACHES (games, drills),
// so there "if unsure, leave it out" holds; the gate only has to RECOGNISE a form, so this module
// lists the correct forms of the corpus verbs from hand-checked classes. The verb lists below are
// scoped to the verbs of data/words-open/*.json (pos === 'verb'), not an attempt at a full grammar;
// lib/__tests__/esIrregularForms.test.ts fails when a corpus verb that `conjugate` skips is missing.
//
// The result is a plain list of recognised forms per tense (the 5 persons yo/tú/él/nosotros/ellos,
// vosotros left out like in `conjugate`); a form only counts in the tense that is unlocked.

export type IrregularTense =
  | 'presente'
  | 'indefinido'
  | 'imperfecto'
  | 'futuro'
  | 'condicional'
  | 'subjuntivo_presente'
  | 'subjuntivo_imperfecto';

type Cls = 'ar' | 'er' | 'ir';
type Forms = Record<IrregularTense, string[]>;

interface Spec {
  cls: Cls;
  /** The infinitive without its ending (pensar → pens). */
  s0: string;
  /** The stem of the stressed presente / subjuntivo forms (yo*, tú, él, ellos): piens, cuent, enví. */
  ss: string;
  /** -ir verbs: the unstressed changed stem (sintamos, sintió, sintiera). Default: s0. */
  su?: string;
  /** The stem of the nosotros subjuntivo form. Default: su for -ir, s0 for -ar/-er. */
  sn?: string;
  /** The 3rd person indefinido stem, if it differs from su (construy-, tiñ-). */
  s3?: string;
  /** A complete irregular yo stem (teng-, quep-): the presente yo and the whole subjuntivo presente. */
  yo?: string;
  /** An irregular indefinido stem (tuv-, hic-, conduj-): endings e, iste, o, imos, ieron (eron after j). */
  ind?: string;
  /** The 3rd person singular where the irregular indefinido stem is not enough (hizo). */
  ind3?: string;
  /** The futuro / condicional stems. Default: the infinitive. */
  fut?: string[];
  /** The "c → z" verbs that do not take -zco (cocer: cuezo). */
  zo?: boolean;
  /** Impersonal verbs: only the 3rd person singular exists. */
  only3?: boolean;
  /** The tenses that exist at all (soler). */
  tenses?: readonly IrregularTense[];
  /** Forms written out by hand; they win over the generated ones. */
  forms?: Partial<Forms>;
}

const PRES: Record<Cls, string[]> = {
  ar: ['o', 'as', 'a', 'amos', 'an'],
  er: ['o', 'es', 'e', 'emos', 'en'],
  ir: ['o', 'es', 'e', 'imos', 'en'],
};
const SUBJ: Record<Cls, string[]> = {
  ar: ['e', 'es', 'e', 'emos', 'en'],
  er: ['a', 'as', 'a', 'amos', 'an'],
  ir: ['a', 'as', 'a', 'amos', 'an'],
};
const IMPF: Record<Cls, string[]> = {
  ar: ['aba', 'abas', 'aba', 'ábamos', 'aban'],
  er: ['ía', 'ías', 'ía', 'íamos', 'ían'],
  ir: ['ía', 'ías', 'ía', 'íamos', 'ían'],
};
const FUT = ['é', 'ás', 'á', 'emos', 'án'];
const COND = ['ía', 'ías', 'ía', 'íamos', 'ían'];
const ACCENT_ADD: Record<string, string> = { a: 'á', e: 'é', i: 'í', o: 'ó', u: 'ú' };
const FRONT = /^[eéií]/;
const BACK = /^[aáoó]/;
const VOWEL = /[aeiouáéíóúü]/;

// The spelling that keeps the sound of the stem before the ending: -car/-gar/-zar/-guar before e,
// -ger/-gir/-guir/-cer/-cir before a/o.
function join(spec: Spec, stem: string, ending: string): string {
  let s = stem;
  if (spec.cls === 'ar') {
    if (FRONT.test(ending)) {
      if (s.endsWith('gu')) s = `${s.slice(0, -2)}gü`;
      else if (s.endsWith('c')) s = `${s.slice(0, -1)}qu`;
      else if (s.endsWith('g')) s = `${s.slice(0, -1)}gu`;
      else if (s.endsWith('z')) s = `${s.slice(0, -1)}c`;
    }
  } else if (BACK.test(ending)) {
    if (s.endsWith('gu')) s = s.slice(0, -1);
    else if (s.endsWith('g')) s = `${s.slice(0, -1)}j`;
    else if (s.endsWith('c')) {
      const afterVowel = VOWEL.test(s.charAt(s.length - 2));
      s = `${s.slice(0, -1)}${afterVowel && !spec.zo ? 'zc' : 'z'}`;
    }
  }
  return `${s}${ending}`;
}

function subjuntivoImperfecto(ellos: string): string[] {
  if (!ellos.endsWith('ron')) return [];
  const base = ellos.slice(0, -3);
  const accented = base.replace(/[aeiou]$/, (v) => ACCENT_ADD[v]);
  return [`${base}ra`, `${base}ras`, `${base}ra`, `${accented}ramos`, `${base}ran`];
}

function build(spec: Spec): Partial<Forms> {
  const { cls, s0, ss, yo } = spec;
  const su = spec.su ?? s0;
  const j = (stem: string, ending: string) => join(spec, stem, ending);
  const pres = PRES[cls];
  const subj = SUBJ[cls];

  const presente = [yo ? `${yo}o` : j(ss, pres[0]), j(ss, pres[1]), j(ss, pres[2]), j(s0, pres[3]), j(ss, pres[4])];

  const sn = spec.sn ?? (cls === 'ir' ? su : s0);
  const subjuntivo_presente = subj.map((end, i) => (yo ? `${yo}${end}` : j(i === 3 ? sn : ss, end)));

  let indefinido: string[];
  if (spec.ind) {
    const ieron = spec.ind.endsWith('j') ? 'eron' : 'ieron';
    indefinido = [`${spec.ind}e`, `${spec.ind}iste`, spec.ind3 ?? `${spec.ind}o`, `${spec.ind}imos`, `${spec.ind}${ieron}`];
  } else if (cls === 'ar') {
    indefinido = [j(s0, 'é'), `${s0}aste`, `${s0}ó`, `${s0}amos`, `${s0}aron`];
  } else {
    const s3 = spec.s3 ?? (cls === 'ir' ? su : s0);
    const short = /(?:y|ñ|ll)$/.test(s3);
    indefinido = [`${s0}í`, `${s0}iste`, `${s3}${short ? 'ó' : 'ió'}`, `${s0}imos`, `${s3}${short ? 'eron' : 'ieron'}`];
  }

  const futStems = spec.fut ?? [`${s0}${cls}`];
  const all: Forms = {
    presente,
    indefinido,
    imperfecto: IMPF[cls].map((e) => `${s0}${e}`),
    futuro: futStems.flatMap((f) => FUT.map((e) => `${f}${e}`)),
    condicional: futStems.flatMap((f) => COND.map((e) => `${f}${e}`)),
    subjuntivo_presente,
    subjuntivo_imperfecto: subjuntivoImperfecto(indefinido[4]),
    ...spec.forms,
  };
  const out: Partial<Forms> = {};
  for (const tense of spec.tenses ?? (Object.keys(all) as IrregularTense[])) {
    out[tense] = spec.only3 ? [all[tense][2]] : all[tense];
  }
  return out;
}

// ---------------------------------------------------------------------------
// The classes. Each list is checked by hand against the corpus verbs.
// ---------------------------------------------------------------------------

function clsOf(inf: string): Cls {
  return inf.endsWith('ar') ? 'ar' : inf.endsWith('er') ? 'er' : 'ir';
}

/** Replace the last `from` in the stem (pens → piens, dorm → duerm). */
function change(stem: string, from: string, to: string): string {
  const i = stem.lastIndexOf(from);
  return i < 0 ? stem : `${stem.slice(0, i)}${to}${stem.slice(i + from.length)}`;
}

function accentLast(stem: string): string {
  return stem.replace(/([aeiou])([^aeiou]*)$/, (_m, v: string, rest: string) => `${ACCENT_ADD[v]}${rest}`);
}

type Kind = 'ie' | 'ue' | 'ie-ir' | 'ue-ir' | 'i-ir' | 'uir' | 'acc' | 'plain';

function ofKind(inf: string, kind: Kind): Spec {
  const cls = clsOf(inf);
  const s0 = inf.slice(0, -2);
  switch (kind) {
    case 'ie':
      return { cls, s0, ss: change(s0, 'e', 'ie') };
    case 'ue': {
      const ss = change(s0, 'o', 'ue');
      return { cls, s0, ss: ss.startsWith('ue') ? `h${ss}` : ss }; // oler: huelo
    }
    case 'ie-ir':
      return { cls, s0, ss: change(s0, 'e', 'ie'), su: change(s0, 'e', 'i') };
    case 'ue-ir':
      return { cls, s0, ss: change(s0, 'o', 'ue'), su: change(s0, 'o', 'u') };
    case 'i-ir': {
      const ss = change(s0, 'e', 'i');
      return { cls, s0, ss, su: ss };
    }
    case 'uir':
      return { cls, s0, ss: `${s0}y`, sn: `${s0}y`, s3: `${s0}y` };
    case 'acc':
      return { cls, s0, ss: accentLast(s0) };
    default:
      return { cls, s0, ss: s0 };
  }
}

const KIND_VERBS: Record<Kind, string> = {
  // e → ie (-ar, -er)
  ie:
    'pensar empezar cerrar despertar sentar calentar temblar recomendar confesar gobernar regar negar merendar apretar reventar ' +
    'sembrar enterrar atravesar tropezar desplegar manifestar encerrar entender perder defender encender tender atender ' +
    'extender ascender descender',
  // o → ue (-ar, -er)
  ue:
    'contar encontrar recordar acordar acostar recostar costar mostrar demostrar probar aprobar comprobar apostar volar sonar soñar ' +
    'colgar rogar renovar almorzar tostar soltar colar poblar descontar esforzar reforzar volver devolver resolver envolver ' +
    'revolver mover promover conmover doler morder moler torcer cocer oler',
  // -ir: e → ie, and e → i where the stress is off (sintió, sintamos)
  'ie-ir': 'sentir mentir preferir sugerir divertir advertir convertir invertir hervir transferir requerir referir desmentir revertir herir arrepentir',
  // -ir: o → ue, and o → u where the stress is off (durmió, durmamos)
  'ue-ir': 'dormir morir',
  // -ir: e → i everywhere in the stem
  'i-ir':
    'pedir servir repetir competir medir rendir impedir despedir vestir derretir teñir seguir conseguir perseguir proseguir elegir ' +
    'corregir concebir',
  // -uir: y before a, e, o (construyo, construyó)
  uir: 'huir incluir excluir concluir influir contribuir distribuir disminuir sustituir constituir construir destruir reconstruir atribuir',
  // the accent moves in the stressed forms (envío, actúo, reúno, prohíbo, aíslo)
  acc:
    'enviar reenviar confiar criar vaciar esquiar fotografiar enfriar desafiar espiar guiar ampliar extraviar resfriar actuar continuar ' +
    'evaluar situar fluctuar efectuar insinuar atenuar licuar aislar reunir prohibir',
  // only the spelling changes (-zco, -zo, -jo, -go, -ü-)
  plain:
    'agradecer aparecer desaparecer conocer reconocer merecer nacer crecer obedecer pertenecer permanecer establecer restablecer envejecer ' +
    'fallecer florecer fortalecer esclarecer prevalecer ofrecer parecer vencer convencer ejercer acoger escoger recoger proteger dirigir ' +
    'exigir fingir surgir restringir distinguir averiguar',
};

const DUCIR = 'conducir producir reproducir reducir traducir deducir';

// Compounds of an irregular base: the prefix + the base's forms.
const TENER = 'detener mantener obtener contener sostener entretener';
const VENIR = 'prevenir intervenir convenir';
const PONER = 'componer proponer suponer exponer imponer disponer oponer descomponer posponer';
const DECIR = 'predecir contradecir bendecir';

function tenerLike(prefix: string): Spec {
  return { cls: 'er', s0: `${prefix}ten`, ss: `${prefix}tien`, yo: `${prefix}teng`, ind: `${prefix}tuv`, fut: [`${prefix}tendr`] };
}
function venirLike(prefix: string): Spec {
  return { cls: 'ir', s0: `${prefix}ven`, ss: `${prefix}vien`, yo: `${prefix}veng`, ind: `${prefix}vin`, fut: [`${prefix}vendr`] };
}
function ponerLike(prefix: string): Spec {
  return { cls: 'er', s0: `${prefix}pon`, ss: `${prefix}pon`, yo: `${prefix}pong`, ind: `${prefix}pus`, fut: [`${prefix}pondr`] };
}
// deshacer (des + hacer), satisfacer (satis + facer): `base` is everything before -acer.
function hacerLike(base: string): Spec {
  return { cls: 'er', s0: `${base}ac`, ss: `${base}ac`, yo: `${base}ag`, ind: `${base}ic`, ind3: `${base}izo`, fut: [`${base}ar`] };
}
// predecir / contradecir take both futures (prediré, predeciré), bendecir only the regular one.
function decirLike(prefix: string, futures: string[]): Spec {
  return { cls: 'ir', s0: `${prefix}dec`, ss: `${prefix}dic`, yo: `${prefix}dig`, ind: `${prefix}dij`, fut: futures };
}
function salirLike(prefix: string): Spec {
  return { cls: 'ir', s0: `${prefix}sal`, ss: `${prefix}sal`, yo: `${prefix}salg`, fut: [`${prefix}saldr`] };
}
function traerLike(prefix: string): Spec {
  return { cls: 'er', s0: `${prefix}tra`, ss: `${prefix}tra`, yo: `${prefix}traig`, ind: `${prefix}traj` };
}
// reír, sonreír, freír: `prefix` is everything before -reír.
function reirLike(prefix: string): Spec {
  const r = `${prefix}r`;
  return {
    cls: 'ir',
    s0: `${prefix}re`,
    ss: `${prefix}re`,
    forms: {
      presente: [`${r}ío`, `${r}íes`, `${r}íe`, `${r}eímos`, `${r}íen`],
      indefinido: [`${r}eí`, `${r}eíste`, `${r}ió`, `${r}eímos`, `${r}ieron`, `${r}io`],
      subjuntivo_presente: [`${r}ía`, `${r}ías`, `${r}ía`, `${r}iamos`, `${r}ían`],
      subjuntivo_imperfecto: subjuntivoImperfecto(`${r}ieron`),
    },
  };
}

// Each is its own case: the forms are written out where the generator cannot get them.
const SINGLES: Record<string, Spec> = {
  jugar: { cls: 'ar', s0: 'jug', ss: 'jueg' },
  andar: { cls: 'ar', s0: 'and', ss: 'and', ind: 'anduv' },
  caber: { cls: 'er', s0: 'cab', ss: 'cab', yo: 'quep', ind: 'cup', fut: ['cabr'] },
  valer: { cls: 'er', s0: 'val', ss: 'val', yo: 'valg', fut: ['valdr'] },
  adquirir: { cls: 'ir', s0: 'adquir', ss: 'adquier' },
  sobresalir: salirLike('sobre'),
  caer: {
    cls: 'er',
    s0: 'ca',
    ss: 'ca',
    yo: 'caig',
    forms: { indefinido: ['caí', 'caíste', 'cayó', 'caímos', 'cayeron'], subjuntivo_imperfecto: subjuntivoImperfecto('cayeron') },
  },
  oír: {
    cls: 'ir',
    s0: 'o',
    ss: 'oy',
    yo: 'oig',
    forms: {
      presente: ['oigo', 'oyes', 'oye', 'oímos', 'oyen'],
      indefinido: ['oí', 'oíste', 'oyó', 'oímos', 'oyeron'],
      subjuntivo_imperfecto: subjuntivoImperfecto('oyeron'),
    },
  },
  prever: {
    cls: 'er',
    s0: 'prev',
    ss: 'prev',
    forms: {
      presente: ['preveo', 'prevés', 'prevé', 'prevemos', 'prevén'],
      indefinido: ['preví', 'previste', 'previó', 'previmos', 'previeron'],
      imperfecto: ['preveía', 'preveías', 'preveía', 'preveíamos', 'preveían'],
      subjuntivo_presente: ['prevea', 'preveas', 'prevea', 'preveamos', 'prevean'],
      subjuntivo_imperfecto: subjuntivoImperfecto('previeron'),
    },
  },
  // defective: only the presente and the imperfecto are in use
  soler: { cls: 'er', s0: 'sol', ss: 'suel', tenses: ['presente', 'imperfecto'] },
  // impersonal: only the 3rd person singular
  llover: { cls: 'er', s0: 'llov', ss: 'lluev', only3: true },
  nevar: { cls: 'ar', s0: 'nev', ss: 'niev', only3: true },
  anochecer: { cls: 'er', s0: 'anochec', ss: 'anochec', only3: true },
  // impersonal "hay" (haber is in the conjugate table, which has no such form)
  haber: { cls: 'er', s0: 'hab', ss: 'hab', tenses: ['presente'], forms: { presente: ['hay'] } },
};

let table: Map<string, Spec> | null = null;

function getTable(): Map<string, Spec> {
  if (table) return table;
  const t = new Map<string, Spec>();
  for (const [kind, list] of Object.entries(KIND_VERBS) as [Kind, string][]) {
    for (const inf of list.split(' ')) {
      const spec = ofKind(inf, kind);
      t.set(inf, inf === 'cocer' ? { ...spec, zo: true } : spec);
    }
  }
  // -ducir: conduje, condujeron (j stem, no i in -eron)
  for (const inf of DUCIR.split(' ')) t.set(inf, { ...ofKind(inf, 'plain'), ind: `${inf.slice(0, -3)}j` });
  for (const inf of TENER.split(' ')) t.set(inf, tenerLike(inf.slice(0, -5)));
  for (const inf of VENIR.split(' ')) t.set(inf, venirLike(inf.slice(0, -5)));
  for (const inf of PONER.split(' ')) t.set(inf, ponerLike(inf.slice(0, -5)));
  for (const inf of DECIR.split(' ')) {
    const prefix = inf.slice(0, -5);
    t.set(inf, decirLike(prefix, inf === 'bendecir' ? [inf] : [`${prefix}dir`, inf]));
  }
  t.set('deshacer', hacerLike('desh'));
  t.set('satisfacer', hacerLike('satisf'));
  for (const inf of ['traer', 'distraer', 'atraer']) t.set(inf, traerLike(inf.slice(0, -5)));
  for (const inf of ['reír', 'sonreír', 'freír']) t.set(inf, reirLike(inf.slice(0, -4)));
  for (const [inf, spec] of Object.entries(SINGLES)) t.set(inf, spec);
  return (table = t);
}

const cache = new Map<string, Partial<Forms> | null>();

/**
 * The recognised forms of a corpus verb in one tense, or [] if the verb is not one of the verbs
 * this module covers (the regular ones are `conjugate`'s). `infinitive` is a lowercase infinitive
 * without a reflexive -se.
 */
export function irregularForms(infinitive: string, tense: IrregularTense): string[] {
  let forms = cache.get(infinitive);
  if (forms === undefined) {
    const spec = getTable().get(infinitive);
    forms = spec ? build(spec) : null;
    cache.set(infinitive, forms);
  }
  return forms?.[tense] ?? [];
}
