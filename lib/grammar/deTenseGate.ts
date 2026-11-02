// The German side of the tense gate (see lib/grammar/tenseGate.ts for the Spanish side and the story behind it): a sentence
// may not use a tense or structure above the learner's level. The detection is not a heuristic on endings: every verb of
// the German deck (and the strong and irregular verbs of lib/deIrregularForms.ts) is run through lib/deForms.ts, which gives
// a form -> (verb, tense) map, and the words of the sentence are looked up in it. A form that is not on the map counts for
// nothing, so no false alarm can come from a noun or an adjective. The compound structures (haben / sein + participle,
// werden + infinitive or participle, würde + infinitive) are caught by their pair of words.
//
// Levels (the contract): A1 present, imperative, perfect of the commonest verbs, modal verbs in the present;
// A2 adds the preterite of sein / haben / the modals and the perfect of every verb; B1 adds the preterite of every verb,
// subjunctive II (würde / hätte / wäre / könnte), passive present and future I; B2 adds the past perfect, the passive in every
// tense, subjunctive II of the past and subjunctive I (reported speech); C1 everything.

import deA1 from '@/data/words/de/a1.json';
import deA2 from '@/data/words/de/a2.json';
import deB1 from '@/data/words/de/b1.json';
import deB2 from '@/data/words/de/b2.json';
import deC1 from '@/data/words/de/c1.json';
import { atLeast, deInfinitiveOf, deVerb, isCommonPerfectVerb, type DeLevel, type DeTense, type DeVerb } from '@/lib/deForms';
import { SPECIAL_VERBS, STRONG_VERBS } from '@/lib/deIrregularForms';

export type DeStructure =
  | 'perfekt_common'
  | 'perfekt'
  | 'praeteritum_basic'
  | 'praeteritum'
  | 'plusquamperfekt'
  | 'futur1'
  | 'futur2'
  | 'konjunktiv2'
  | 'konjunktiv2_vergangenheit'
  | 'konjunktiv2_other'
  | 'passiv_praesens'
  | 'passiv_praeteritum'
  | 'passiv_perfekt'
  | 'konjunktiv1';

/** At which level the structure is taught. The present tense (and the imperative) is the default and has no entry. */
export const DE_STRUCTURE_LEVEL: Record<DeStructure, DeLevel> = {
  perfekt_common: 'A1',
  perfekt: 'A2',
  praeteritum_basic: 'A2',
  praeteritum: 'B1',
  futur1: 'B1',
  konjunktiv2: 'B1',
  passiv_praesens: 'B1',
  plusquamperfekt: 'B2',
  konjunktiv2_vergangenheit: 'B2',
  passiv_praeteritum: 'B2',
  passiv_perfekt: 'B2',
  konjunktiv1: 'B2',
  futur2: 'C1',
  konjunktiv2_other: 'C1',
};

interface FormInfo {
  verb: DeVerb;
  tense: DeTense;
}

let index: Map<string, FormInfo[]> | null = null;

function deckVerbs(): string[] {
  const out = new Set<string>([...STRONG_VERBS.keys(), ...SPECIAL_VERBS.keys(), 'möchten']);
  for (const card of [...deA1, ...deA2, ...deB1, ...deB2, ...deC1] as Array<{ de: string; pos: string }>) {
    if (card.pos !== 'verb') continue;
    for (const alt of card.de.split(' / ')) {
      const inf = deInfinitiveOf(alt);
      if (inf) out.add(inf);
    }
  }
  return [...out];
}

function formIndex(): Map<string, FormInfo[]> {
  if (index) return index;
  index = new Map();
  for (const inf of deckVerbs()) {
    const verb = deVerb(inf);
    for (const f of verb.forms) {
      const list = index.get(f.form);
      if (!list) index.set(f.form, [{ verb, tense: f.tense }]);
      else if (!list.some((x) => x.verb === verb && x.tense === f.tense)) list.push({ verb, tense: f.tense });
    }
  }
  return index;
}

/** For tests: forget the generated form map. */
export function resetDeFormIndex(): void {
  index = null;
}

const HABEN_PRESENT = new Set(['habe', 'hast', 'hat', 'haben', 'habt']);
const SEIN_PRESENT = new Set(['bin', 'bist', 'ist', 'sind', 'seid']);
const HABEN_PAST = new Set(['hatte', 'hattest', 'hatten', 'hattet']);
const SEIN_PAST = new Set(['war', 'warst', 'waren', 'wart']);
const HABEN_K2 = new Set(['hätte', 'hättest', 'hätten', 'hättet']);
const SEIN_K2 = new Set(['wäre', 'wärst', 'wären', 'wäret']);
const WERDEN_PRESENT = new Set(['werde', 'wirst', 'wird', 'werdet']);
const WERDEN_PAST = new Set(['wurde', 'wurdest', 'wurden', 'wurdet']);
const WERDEN_K2 = new Set(['würde', 'würdest', 'würden', 'würdet']);
const SUBJECT_3SG = new Set(['er', 'es', 'man']);

interface Word {
  token: string;
  /** Written with a capital inside the sentence: a noun, never a verb form. */
  noun: boolean;
  /** The clause (split at commas, semicolons, colons and sentence ends): auxiliary and participle pair up inside one clause. */
  clause: number;
}

function words(sentence: string): Word[] {
  const out: Word[] = [];
  let atStart = true;
  let clause = 0;
  for (const chunk of sentence.split(/\s+/)) {
    const raw = chunk.replace(/^[^A-Za-zÄÖÜäöüß0-9]+/, '');
    const word = raw.replace(/[^A-Za-zÄÖÜäöüß0-9].*$/, '');
    if (word) out.push({ token: word.toLowerCase(), noun: !atStart && word[0] !== word[0].toLowerCase() && !/^\d/.test(word), clause });
    atStart = /[.!?:]["”»)]*$/.test(chunk);
    if (/[,;:.!?]["”»)]*$/.test(chunk)) clause++;
  }
  return out;
}

const infosOf = (token: string): FormInfo[] => formIndex().get(token) ?? [];
const hasTense = (token: string, tense: DeTense): boolean => infosOf(token).some((i) => i.tense === tense);

/** The participle's verbs (a token that is a participle and not also an infinitive: bekommen is both). */
function participleVerbs(token: string): DeVerb[] {
  const infos = infosOf(token);
  if (infos.some((i) => i.tense === 'inf')) return [];
  return infos.filter((i) => i.tense === 'part').map((i) => i.verb);
}

/** Which structures above the present tense the sentence uses. A form that is not a verb form of the deck counts for nothing. */
export function detectDeStructures(sentence: string): Set<DeStructure> {
  const found = new Set<DeStructure>();
  const verbal = words(sentence).filter((w) => !w.noun);
  const clauses = new Map<number, string[]>();
  for (const w of verbal) clauses.set(w.clause, [...(clauses.get(w.clause) ?? []), w.token]);
  for (const tokens of clauses.values()) detectInClause(tokens, found);
  return found;
}

function detectInClause(tokens: string[], found: Set<DeStructure>): void {
  const participles = tokens.map((t) => participleVerbs(t));
  const anyParticiple = participles.some((p) => p.length > 0);
  const modalBefore = (at: number): boolean => tokens.slice(0, at).some((t) => infosOf(t).some((i) => i.verb.modal && i.tense === 'praes'));
  const has = (set: ReadonlySet<string>): boolean => tokens.some((t) => set.has(t));
  const hasWorden = tokens.includes('worden');

  tokens.forEach((token, at) => {
    // perfect and past perfect, passive, future I and II
    if (HABEN_PRESENT.has(token) || SEIN_PRESENT.has(token)) {
      // "wird gegessen haben": the infinitive of the future II, no perfect of its own
      if (tokens.some((t) => WERDEN_PRESENT.has(t)) && (token === 'haben' || token === 'sein')) return;
      const sein = SEIN_PRESENT.has(token);
      const partners = participles.flatMap((p, j) => (j === at ? [] : p));
      if (partners.length === 0) return;
      if (hasWorden) {
        // ist ... gemacht worden: the perfect of the passive
        found.add('passiv_perfekt');
        return;
      }
      const eligible = sein ? partners.filter((v) => v.aux !== 'haben') : partners;
      if (eligible.length === 0) return; // sein + participle of a haben verb = a state (geschlossen), not a tense
      found.add(eligible.every((v) => isCommonPerfectVerb(v.infinitive) || isCommonPerfectVerb(v.base)) ? 'perfekt_common' : 'perfekt');
      return;
    }
    if (HABEN_PAST.has(token) || SEIN_PAST.has(token)) {
      const partners = participles.flatMap((p, j) => (j === at ? [] : p));
      const eligible = SEIN_PAST.has(token) ? partners.filter((v) => v.aux !== 'haben') : partners;
      found.add(eligible.length > 0 ? 'plusquamperfekt' : 'praeteritum_basic');
      return;
    }
    if (HABEN_K2.has(token) || SEIN_K2.has(token)) {
      const partners = participles.flatMap((p, j) => (j === at ? [] : p));
      found.add(partners.length > 0 ? 'konjunktiv2_vergangenheit' : 'konjunktiv2');
      return;
    }
    if (WERDEN_K2.has(token)) {
      found.add('konjunktiv2');
      return;
    }
    if (WERDEN_PAST.has(token)) {
      found.add(anyParticiple ? 'passiv_praeteritum' : 'praeteritum_basic');
      return;
    }
    if (WERDEN_PRESENT.has(token) || (token === 'werden' && !modalBefore(at))) {
      const later = tokens.slice(at + 1);
      const participleAt = later.findIndex((t) => participleVerbs(t).length > 0);
      const infinitiveLater = later.some((t) => t !== 'werden' && hasTense(t, 'inf'));
      if (participleAt >= 0 && later.slice(participleAt + 1).some((t) => t === 'haben' || t === 'sein')) found.add('futur2');
      else if (infinitiveLater) found.add('futur1');
      else if (participleAt >= 0) found.add('passiv_praesens');
      return;
    }
    // simple preterite and subjunctive of the other verbs
    const infos = infosOf(token);
    if (infos.length === 0) return;
    if (infos.some((i) => i.tense === 'praes' || i.tense === 'inf' || i.tense === 'imp' || i.tense === 'part')) {
      // reported speech: er komme, er sei (a form of its own only when the subject is er / es / man)
      const k1 = infos.some((i) => i.tense === 'k1');
      if (at > 0 && k1 && ((SUBJECT_3SG.has(tokens[at - 1]) && (/e$/.test(token) || token === 'sei') && !/(?:st|t)$/.test(token)) || token === 'seien')) found.add('konjunktiv1');
      return;
    }
    let level: DeStructure | null = null;
    for (const info of infos) {
      let candidate: DeStructure | null = null;
      if (info.tense === 'prat') candidate = info.verb.basic ? 'praeteritum_basic' : 'praeteritum';
      else if (info.tense === 'k2') candidate = info.verb.basic ? 'konjunktiv2' : 'konjunktiv2_other';
      else if (info.tense === 'k1') candidate = 'konjunktiv1';
      if (!candidate) continue;
      // on a collision (sollte = preterite and subjunctive II) the earlier-taught structure wins
      if (level === null || atLeast(DE_STRUCTURE_LEVEL[level], DE_STRUCTURE_LEVEL[candidate])) level = candidate;
    }
    if (level) found.add(level);
  });
}

/** The structures of the sentence that the level has not yet reached. Empty = the sentence stays inside the level's grammar. */
export function deStructuresAbove(sentence: string, level: DeLevel): DeStructure[] {
  return [...detectDeStructures(sentence)].filter((s) => !atLeast(level, DE_STRUCTURE_LEVEL[s]));
}
