// The German tense drill's conjugator: the six persons of a verb in Präsens, Perfekt, Präteritum, Futur I and Konjunktiv II,
// built on the verb tables of lib/deForms.ts (the hand-checked paradigms of lib/deIrregularForms.ts and the prefix split).
// A pure module.
//
// The guiding rule, as in the Spanish conjugator (lib/games/conjugate.ts): a conjugated form is a factual claim, so a verb whose
// form the tables cannot vouch for is LEFT OUT (the function returns null), never guessed. What it refuses:
//   - reflexive verbs and phrases (the reflexive pronoun depends on the case: sich freuen, sich etwas kaufen);
//   - a verb with two forms that mean different things (hängen: hing / hängte, schaffen), or two that differ only in taste
//     (backen: backte / buk), where the table lists several;
//   - the perfect of a verb whose auxiliary the tables do not decide (gehen compounds, ziehen: ist / hat gezogen);
//   - a weak-looking verb that is really a strong verb the table lacks (verzeihen, fernsehen: `UNSURE_VERBS` and the check
//     `looksLikeUnknownStrong`);
//   - the perfect and the future of the modal verbs (ich habe gekonnt / ich habe gehen können: two constructions).
// Every form this module returns is also a form `deVerb` recognises (tested over the whole German deck), so the drill and the
// "learned words only" gate can never disagree about a word.

import { getDeWords } from '@/data/deWords';
import { deInfinitiveOf, deVerb, needsE, sibilant, splitPrefix, stemOf, umlautLast, type DeTense } from '@/lib/deForms';
import { MODAL_VERBS, SEIN_PERFECT_VERBS, SPECIAL_VERBS, STRONG_VERBS, type StrongVerb } from '@/lib/deIrregularForms';

export type DeDrillTense = 'praesens' | 'perfekt' | 'praeteritum' | 'futur1' | 'konjunktiv2';
export type DePerson = 'ich' | 'du' | 'er' | 'wir' | 'ihr' | 'sie';

export const DE_DRILL_TENSES: readonly DeDrillTense[] = ['praesens', 'perfekt', 'praeteritum', 'futur1', 'konjunktiv2'];
export const DE_PERSONS: readonly DePerson[] = ['ich', 'du', 'er', 'wir', 'ihr', 'sie'];

/** How a person is written on the card. */
export const DE_PERSON_LABEL: Record<DePerson, string> = { ich: 'ich', du: 'du', er: 'er/sie/es', wir: 'wir', ihr: 'ihr', sie: 'sie/Sie' };

// The pronouns a typed answer may start with (the first is the one the answer is written with).
const PRONOUNS: Record<DePerson, readonly string[]> = {
  ich: ['ich'],
  du: ['du'],
  er: ['er', 'sie', 'es'],
  wir: ['wir'],
  ihr: ['ihr'],
  sie: ['sie', 'Sie'],
};

type Six = readonly [string, string, string, string, string, string];

const WERDEN = SPECIAL_VERBS.get('werden')!;
const HABEN = SPECIAL_VERBS.get('haben')!;
const SEIN = SPECIAL_VERBS.get('sein')!;

/** Verbs the drill never asks, although a form exists: the table cannot vouch for the one form (see the header). */
const UNSURE_VERBS: ReadonlySet<string> = new Set([
  // two usable preterites or participles that differ in meaning or in taste
  'backen', 'hängen', 'schaffen', 'senden', 'wenden', 'erschrecken',
  // möchten has only the one form (it is the Konjunktiv II of mögen), the drill uses mögen
  'möchten',
  // strong verbs the tables lack (gleiten: glitt) and a verb whose stem the rules misread (knien)
  'gleiten', 'fernsehen', 'knien', 'sieden', 'bergen', 'betteln', 'erklimmen', 'mahlen',
  // ... and words that only look prefixed (bellen, bereiten, beinhalten) or whose prefix the splitter reads the wrong way
  'bellen', 'bereiten', 'zubereiten', 'vorbereiten', 'beinhalten', 'hinterlegen', 'hinterfragen', 'klarstellen', 'zufriedenstellen',
  'bereitstellen', 'zugutekommen', 'vorwärtskommen', 'rückwärtsfahren', 'widerspiegeln', 'untermauern', 'überfluten', 'durchnässen',
  'überwachen', 'unterstreichen', 'überlassen', 'unterbringen', 'ausbeuten', 'vorbeugen', 'umgehen', 'durchfahren',
]);

/** Strong verbs the tables lack: neither the verb nor any compound of it (verzeihen: verzieh, ausweichen: wich aus) is asked. */
const MISSING_STRONG_CORES: ReadonlySet<string> = new Set([
  'zeihen', 'weichen', 'winden', 'bergen', 'schmelzen', 'kneifen', 'hauen', 'ringen', 'schwingen', 'stinken',
]);

/** Verbs that look as if they ended in a strong verb, but are weak (heiraten is no raten). */
const SAFE_WEAK: ReadonlySet<string> = new Set(['heiraten', 'trennen', 'verbessern', 'schaben', 'pressen']);

/** Verbs the splitter reads as a prefix + verb (rein + igen) that are none: plain weak verbs. */
const SAFE_UNPREFIXED: ReadonlySet<string> = new Set(['reinigen', 'festigen', 'angeln']);

/** Weather: only "es regnet". */
const IMPERSONAL_VERBS: ReadonlySet<string> = new Set(['regnen', 'schneien', 'donnern', 'blitzen', 'hageln', 'nieseln']);

/** Happenings and things: only the third person, singular or plural ("das passiert", "sie passieren"). */
const THIRD_PERSON_VERBS: ReadonlySet<string> = new Set([
  'geschehen', 'passieren', 'gelingen', 'misslingen', 'dauern', 'stattfinden', 'vorkommen', 'entstehen', 'stimmen', 'klappen',
  'schmecken', 'reichen', 'fehlen', 'gehören', 'gefallen', 'kosten', 'bedeuten', 'betragen', 'genügen', 'lohnen', 'riechen', 'wehtun',
]);

/** Weak verbs whose perfect takes sein. */
const WEAK_SEIN: ReadonlySet<string> = new Set(['reisen', 'wandern', 'folgen', 'landen', 'radeln', 'marschieren', 'eilen', 'flüchten']);

/** Verbs whose perfect takes sein, which neither the tables nor the base verb say (zurückkehren, scheitern, stolpern). */
const SEIN_EXTRA: ReadonlySet<string> = new Set([
  'zurückkehren', 'aufprallen', 'zusammenstoßen', 'scheitern', 'stolpern', 'explodieren', 'verstummen', 'verheilen', 'einstürzen',
]);

/** Verbs whose perfect takes haben or sein by meaning (or whose compound does), so the drill does not ask it. */
const PERFEKT_UNSURE: ReadonlySet<string> = new Set([
  'klettern', 'hinaufklettern', 'rudern', 'segeln', 'kollidieren', 'heilen', 'verbrennen', 'einfrieren', 'angehen', 'tauchen', 'eintauchen',
  'auftauchen', 'zerbrechen', 'bewegen', 'vorankommen', 'verbleiben', 'aufhängen', 'abhängen', 'anhängen', 'loswerden',
]);

/** Prefixed verbs of a base with sein whose perfect takes haben (bekommen, gefallen). */
const HABEN_EXTRA: ReadonlySet<string> = new Set(['bekommen', 'gefallen', 'mitbekommen', 'erhalten']);

/** The motion verbs whose perfect takes sein or haben by meaning; the drill asks them with sein (haben is accepted too). */
const SEIN_OR_HABEN: ReadonlySet<string> = new Set(['fahren', 'fliegen', 'schwimmen']);

/** Prefixed verbs of fahren / fliegen that mean a journey: sein. */
const SEIN_PREFIXED_MOTION: ReadonlySet<string> = new Set([
  'abfahren', 'mitfahren', 'wegfahren', 'zurückfahren', 'hinfahren', 'losfahren', 'abfliegen', 'mitfliegen', 'zurückfliegen', 'hinfliegen',
]);

/** Bases whose separable compounds take sein without an exception worth knowing (ankommen, weggehen, dableiben). */
const SEIN_BASES: ReadonlySet<string> = new Set(['gehen', 'kommen', 'bleiben']);

/** The own Konjunktiv II of these verbs is in current use (ginge, käme, wüsste); the drill asks it at C1, besides "würde + Infinitiv". */
export const OWN_KONJUNKTIV_VERBS: ReadonlySet<string> = new Set([
  'gehen', 'kommen', 'geben', 'bleiben', 'finden', 'sehen', 'lassen', 'nehmen', 'wissen', 'bringen', 'denken', 'schreiben', 'lesen',
  'sprechen', 'laufen', 'halten', 'heißen', 'tun', 'essen', 'treffen', 'fallen', 'liegen', 'sitzen', 'tragen',
]);

// ---------------------------------------------------------------- what a verb is made of

/** A verb as its tables see it: the verb itself without prefix, a fixed prefix (verstehen) and a separable one (aufstehen). */
interface Core {
  core: string;
  fixed: string;
  separable: string;
}

let lexiconCache: Set<string> | null = null;

/** The verbs a prefix may be put on: the strong and irregular tables and the one-word verbs of the German deck. */
function lexicon(): Set<string> {
  if (lexiconCache) return lexiconCache;
  const verbs = new Set<string>([...STRONG_VERBS.keys(), ...SPECIAL_VERBS.keys(), ...EXTRA_BASES]);
  for (const card of getDeWords()) {
    if (card.pos !== 'verb' || typeof card.de !== 'string') continue;
    for (const alt of card.de.split(' / ')) {
      const inf = deInfinitiveOf(alt.replace(/\([^)]*\)/g, ' ').trim());
      if (inf && !alt.includes(' ')) verbs.add(inf);
    }
  }
  lexiconCache = verbs;
  return verbs;
}

/** Weak verbs that appear as the base of a separable verb of the deck without a card of their own. */
const EXTRA_BASES: readonly string[] = [
  'wachen', 'decken', 'stimmen', 'wickeln', 'rutschen', 'lenken', 'wärmen', 'muntern', 'klagen', 'ahmen', 'schränken', 'fügen',
  'wandeln', 'locken', 'prangern', 'schirmen', 'sperren', 'häufen', 'grenzen', 'kurbeln', 'strahlen', 'schwächen', 'stufen', 'breiten',
  'fächern', 'statten', 'rotten', 'spornen', 'reizen', 'wirken', 'steuern', 'merken', 'zocken', 'stürzen', 'ragen', 'spionieren',
  'weihen', 'prallen', 'wandern', 'lehnen',
  'räumen', 'rühren', 'bewahren', 'wecken', 'legen', 'zahlen', 'melden', 'ordnen', 'kündigen', 'schalten', 'knöpfen', 'wischen', 'spülen',
  'laden', 'führen', 'rücken', 'setzen', 'stellen', 'packen', 'holen', 'machen', 'nutzen', 'rechnen', 'regen', 'richten', 'sagen', 'fordern',
];

/** The verbs that carry a prefix, the prefix split off and checked against the lexicon; null where the split cannot be trusted. */
function analyze(infinitive: string): Core | null {
  const split = splitPrefix(infinitive);
  if (split.kind === 'none' || SAFE_UNPREFIXED.has(infinitive)) return { core: infinitive, fixed: '', separable: '' };
  const known = lexicon();
  const inner = splitPrefix(split.base);
  if (split.kind === 'inseparable') {
    // ver- be- er- ...: no ge- in the participle. A prefix inside it ("verabreden") is for the tables to know, not for us.
    return inner.kind === 'separable' && known.has(inner.base) ? null : { core: split.base, fixed: split.prefix, separable: '' };
  }
  // a separable prefix needs a real verb behind it: "an" + "alysieren" is no verb
  if (inner.kind === 'inseparable' && known.has(inner.base)) return { core: inner.base, fixed: inner.prefix, separable: split.prefix };
  if (inner.kind === 'separable' && known.has(inner.base)) return null;
  if (known.has(split.base)) return { core: split.base, fixed: '', separable: split.prefix };
  // an -ieren verb is a plain weak verb whatever its first letters look like (abonnieren, analysieren)
  return /ieren$/.test(infinitive) ? { core: infinitive, fixed: '', separable: '' } : null;
}

/** A verb the tables treat as weak that ends in a strong verb or an irregular one, but did not split ("fernsehen"). */
function looksLikeUnknownStrong(infinitive: string): boolean {
  if (SPECIAL_VERBS.has(infinitive) || STRONG_VERBS.has(infinitive) || SAFE_WEAK.has(infinitive)) return false;
  if (splitPrefix(infinitive).kind !== 'none') return false;
  for (const known of [...STRONG_VERBS.keys(), ...SPECIAL_VERBS.keys()]) {
    if (known.length >= 4 && infinitive.length > known.length && infinitive.endsWith(known)) return true;
  }
  return false;
}

// ---------------------------------------------------------------- the six persons of a verb without prefix

function weakPresent(infinitive: string): Six {
  const stem = stemOf(infinitive);
  const e = needsE(stem);
  const du = sibilant(stem) ? `${stem}t` : `${stem}${e ? 'est' : 'st'}`;
  const er = `${stem}${e ? 'et' : 't'}`;
  // -eln drops the e of the stem (ich sammle), -ern keeps it (ich wandere)
  const ich = infinitive.endsWith('eln') ? `${stem.slice(0, -2)}le` : `${stem}e`;
  return [ich, du, er, infinitive, er, infinitive];
}

function weakPreterite(infinitive: string): Six {
  const stem = stemOf(infinitive);
  const root = `${stem}${needsE(stem) ? 'ete' : 'te'}`;
  return [root, `${root}st`, root, `${root}n`, `${root}t`, `${root}n`];
}

function strongPresent(infinitive: string, strong: StrongVerb): Six {
  const stem = stemOf(infinitive);
  const e = needsE(stem);
  const stem2 = strong.stem2;
  const duStem = stem2 || stem;
  const du = sibilant(duStem) ? `${duStem}t` : stem2 ? `${duStem}st` : `${duStem}${e ? 'est' : 'st'}`;
  const er = stem2 ? (stem2.endsWith('t') ? stem2 : `${stem2}t`) : `${stem}${e ? 'et' : 't'}`;
  return [`${stem}e`, du, er, infinitive, `${stem}${e ? 'et' : 't'}`, infinitive];
}

/** A preterite stem on s ß z sch d t: -st needs an e before it (fandest), or may take it (du lasest / du last). */
const WIDE_END = /(?:[sßzdt]|sch)$/;

function strongPreterite(prat: string): Six {
  if (prat.endsWith('te')) return [prat, `${prat}st`, prat, `${prat}n`, `${prat}t`, `${prat}n`]; // mixed verbs: brachte
  const wide = WIDE_END.test(prat);
  // ihr fandet (d, t), but ihr last, ihr aßt, ihr wuscht
  const ihr = wide && /[dt]$/.test(prat) ? `${prat}et` : `${prat}t`;
  return [prat, `${prat}${wide ? 'est' : 'st'}`, prat, `${prat}en`, ihr, `${prat}en`];
}

/** The six persons of a verb without prefix, present or preterite. */
function plainSix(core: string, tense: 'praesens' | 'praeteritum'): Six | null {
  const special = SPECIAL_VERBS.get(core);
  if (special) {
    const list = tense === 'praesens' ? special.praes : special.prat.slice(0, 6);
    return list.length === 6 ? (list as unknown as Six) : null;
  }
  const strong = STRONG_VERBS.get(core);
  if (strong) {
    if (tense === 'praesens') return strongPresent(core, strong);
    return strong.prat.length === 1 ? strongPreterite(strong.prat[0]) : null;
  }
  return tense === 'praesens' ? weakPresent(core) : weakPreterite(core);
}

/** The own Konjunktiv II (six persons) of a modal, sein, haben and the verbs of `OWN_KONJUNKTIV_VERBS`, or null. */
function ownKonjunktivSix(core: string): Six | null {
  const special = SPECIAL_VERBS.get(core);
  if (special) return special.k2.length === 6 ? (special.k2 as unknown as Six) : null;
  const strong = STRONG_VERBS.get(core);
  if (!strong || strong.prat.length !== 1) return null;
  const prat = strong.prat[0];
  if (prat.endsWith('te')) {
    // mixed verbs: brächte, dächte
    const k2 = umlautLast(prat);
    return [k2, `${k2}st`, k2, `${k2}n`, `${k2}t`, `${k2}n`];
  }
  const k2 = `${umlautLast(prat)}e`;
  const stem = k2.slice(0, -1);
  return [k2, `${stem}est`, k2, `${k2}n`, `${stem}et`, `${k2}n`];
}

/** The finite forms of the verb with its prefixes: "verstehe", "stehe auf". */
function finiteSix(parts: Core, tense: 'praesens' | 'praeteritum'): Six | null {
  const six = plainSix(parts.core, tense);
  if (!six) return null;
  const tail = parts.separable ? ` ${parts.separable}` : '';
  return six.map((form) => `${parts.fixed}${form}${tail}`) as unknown as Six;
}

// ---------------------------------------------------------------- the perfect

/** The participle of the verb from its parts, accepted only where deForms knows the very same participle. */
function participleOf(infinitive: string, parts: Core): string | null {
  const { core, fixed, separable } = parts;
  let base: string;
  const special = SPECIAL_VERBS.get(core);
  const strong = STRONG_VERBS.get(core);
  if (special) base = core === 'werden' ? 'geworden' : special.part.length === 1 ? special.part[0] : '';
  else if (strong) base = strong.part.length === 1 ? strong.part[0] : '';
  else {
    const stem = stemOf(core);
    base = /ieren$/.test(core) ? `${stem}t` : `ge${stem}${needsE(stem) ? 'et' : 't'}`;
  }
  if (!base) return null;
  // an inseparable prefix takes the place of the ge- (verstanden, bekommen); -ieren verbs have none anyway
  let participle = fixed ? `${fixed}${base.replace(/^ge/, '')}` : base;
  if (separable) participle = `${separable}${participle}`;
  const known = deVerb(infinitive).forms.filter((f) => f.tense === 'part').map((f) => f.form);
  return known.includes(participle) ? participle : null;
}

/** Whether lib/deForms.ts recognises the finite word (the part before a separable prefix) as a form of this tense of the verb. */
function recognised(infinitive: string, tense: DeTense, form: string): boolean {
  const word = form.split(' ')[0];
  return deVerb(infinitive).forms.some((f) => f.tense === tense && f.form === word);
}

interface Aux {
  aux: 'haben' | 'sein';
  /** The other auxiliary is right too (ich bin gefahren / ich habe das Auto gefahren). */
  alsoAccept?: 'haben' | 'sein';
}

/** The auxiliary of the perfect, or null where the tables do not decide. */
function auxOf(infinitive: string, parts: Core): Aux | null {
  const special = SPECIAL_VERBS.get(infinitive);
  if (special) return { aux: special.aux };
  if (PERFEKT_UNSURE.has(infinitive)) return null;
  if (SEIN_PERFECT_VERBS.has(infinitive) || SEIN_EXTRA.has(infinitive)) return { aux: 'sein' };
  if (HABEN_EXTRA.has(infinitive)) return { aux: 'haben' };
  if (SEIN_PREFIXED_MOTION.has(infinitive)) return { aux: 'sein', alsoAccept: 'haben' };
  const prefixed = parts.fixed !== '' || parts.separable !== '';
  const strong = STRONG_VERBS.get(parts.core);
  if (!strong) {
    // a weak verb: haben, except the few that move or change (reisen); a compound of such a verb is sein only with a separable prefix
    if (!WEAK_SEIN.has(parts.core)) return { aux: 'haben' };
    return !parts.fixed ? { aux: 'sein' } : null;
  }
  if (strong.aux === 'haben') return { aux: 'haben' };
  if (strong.aux === 'sein') {
    // a compound: only the bases whose compounds all take sein; an inseparable prefix is decided by the lists above
    if (!prefixed) return { aux: 'sein' };
    return parts.separable && !parts.fixed && SEIN_BASES.has(parts.core) ? { aux: 'sein' } : null;
  }
  // haben or sein by meaning
  return !prefixed && SEIN_OR_HABEN.has(parts.core) ? { aux: 'sein', alsoAccept: 'haben' } : null;
}

// ---------------------------------------------------------------- the drill's answers

export interface DeConjugation {
  /** The canonical answer with its pronoun ("ich stehe auf", "er ist gegangen", "ich würde gehen"). */
  answer: string;
  /** Other answers that are right too (another pronoun, the answer without the pronoun, a second correct spelling). */
  accept: string[];
}

function withPronouns(person: DePerson, rest: string, alternatives: readonly string[] = []): DeConjugation {
  const [first, ...others] = PRONOUNS[person];
  const accept: string[] = [rest];
  for (const pronoun of others) accept.push(`${pronoun} ${rest}`);
  for (const alt of alternatives) {
    accept.push(alt);
    for (const pronoun of PRONOUNS[person]) accept.push(`${pronoun} ${alt}`);
  }
  return { answer: `${first} ${rest}`, accept };
}

/** The persons the drill asks of a verb. */
export function personsFor(infinitive: string): readonly DePerson[] {
  if (IMPERSONAL_VERBS.has(infinitive)) return ['er'];
  return THIRD_PERSON_VERBS.has(infinitive) ? ['er', 'sie'] : DE_PERSONS;
}

/** Whether the drill may use this infinitive at all: one lower-case word the tables can vouch for. */
export function isDrillVerb(infinitive: string): boolean {
  if (!/^[a-zäöüß]+$/.test(infinitive) || UNSURE_VERBS.has(infinitive) || looksLikeUnknownStrong(infinitive)) return false;
  const parts = analyze(infinitive);
  return parts !== null && !MISSING_STRONG_CORES.has(parts.core) && parts.core !== 'wenden';
}

/**
 * The answer for one verb, tense and person, or null when the verb is outside what the tables vouch for (see the header).
 * Konjunktiv II is "würde + Infinitiv" for every verb, and the own form (hätte, wäre, könnte) for sein, haben and the modals;
 * with `own` the verbs of `OWN_KONJUNKTIV_VERBS` are asked with their own form (ginge, käme), "würde + Infinitiv" accepted too.
 */
export function deConjugation(infinitive: string, tense: DeDrillTense, person: DePerson, opts: { own?: boolean } = {}): DeConjugation | null {
  if (!isDrillVerb(infinitive) || !personsFor(infinitive).includes(person)) return null;
  const parts = analyze(infinitive)!;
  const index = DE_PERSONS.indexOf(person);
  const modal = MODAL_VERBS.has(infinitive);

  switch (tense) {
    case 'praesens':
    case 'praeteritum': {
      const six = finiteSix(parts, tense);
      if (!six || !recognised(infinitive, tense === 'praesens' ? 'praes' : 'prat', six[index])) return null;
      const alternatives: string[] = [];
      const tail = parts.separable ? ` ${parts.separable}` : '';
      if (tense === 'praesens' && person === 'ich' && !SPECIAL_VERBS.has(parts.core) && !STRONG_VERBS.has(parts.core)) {
        // ich wandre / ich sammele are right too
        if (parts.core.endsWith('ern')) alternatives.push(`${parts.fixed}${stemOf(parts.core).slice(0, -2)}re${tail}`);
        if (parts.core.endsWith('eln')) alternatives.push(`${parts.fixed}${stemOf(parts.core)}e${tail}`);
      }
      return withPronouns(person, six[index], alternatives);
    }
    case 'perfekt': {
      if (modal) return null;
      const participle = participleOf(infinitive, parts);
      const aux = auxOf(infinitive, parts);
      if (!participle || !aux) return null;
      const praes = (a: 'haben' | 'sein'): string => (a === 'haben' ? HABEN.praes : SEIN.praes)[index];
      return withPronouns(person, `${praes(aux.aux)} ${participle}`, aux.alsoAccept ? [`${praes(aux.alsoAccept)} ${participle}`] : []);
    }
    case 'futur1': {
      if (modal || infinitive === 'werden') return null;
      return withPronouns(person, `${WERDEN.praes[index]} ${infinitive}`);
    }
    case 'konjunktiv2': {
      if (infinitive === 'wollen' || infinitive === 'sollen' || infinitive === 'werden') return null; // wollte / sollte are the preterite; werden is würde
      if (modal || infinitive === 'sein' || infinitive === 'haben') {
        const own = ownKonjunktivSix(infinitive);
        return own ? withPronouns(person, own[index]) : null;
      }
      const würde = `${WERDEN.k2[index]} ${infinitive}`;
      if (opts.own && OWN_KONJUNKTIV_VERBS.has(infinitive)) {
        const own = ownKonjunktivSix(infinitive);
        if (!own) return null;
        // du kämest / kämst, ihr kämet / kämt: the short forms are right too
        const form = own[index];
        const short = person === 'du' && form.endsWith('est') ? [`${form.slice(0, -3)}st`] : person === 'ihr' && form.endsWith('et') ? [`${form.slice(0, -2)}t`] : [];
        return withPronouns(person, form, [würde, ...(SPECIAL_VERBS.has(infinitive) ? [] : short)]);
      }
      return withPronouns(person, würde);
    }
  }
}

/** Whether the drill can ask this tense of this verb at all. */
export function supportsTense(infinitive: string, tense: DeDrillTense): boolean {
  const person = personsFor(infinitive)[0];
  return deConjugation(infinitive, tense, person) !== null;
}
