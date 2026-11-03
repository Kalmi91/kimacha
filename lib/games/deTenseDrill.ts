// The German tense drill: type the form of a verb in a tense, for a person ("er · aufstehen · Perfekt" > "er ist aufgestanden").
// This file picks the questions and grades the typed answer; the forms come from lib/deConjugate.ts (which leaves out every verb
// the tables cannot vouch for). The verbs are the verbs of the German deck up to the level the learner picks; a tense is asked
// only once the level teaches it (the same levels as the German tense gate, lib/grammar/deTenseGate.ts).

import { getDeWords } from '@/data/deWords';
import { strictAnswerMatch } from '@/lib/answerMatch';
import {
  DE_DRILL_TENSES,
  DE_PERSON_LABEL,
  OWN_KONJUNKTIV_VERBS,
  deConjugation,
  personsFor,
  type DeDrillTense,
  type DePerson,
} from '@/lib/deConjugate';
import { atLeast, deInfinitiveOf, deLevelRank, deVerb, isCommonPerfectVerb, type DeLevel } from '@/lib/deForms';
import { hashString, mulberry32 } from '@/lib/shuffle';

export const DE_DRILL_LEVELS: readonly DeLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1'];

/** The questions of one round. */
export const TENSE_ROUND_SIZE = 10;

export interface DrillVerb {
  infinitive: string;
  /** The deck level of the first card that lists the verb. */
  level: DeLevel;
  /** The meaning in the learner's language (the card's es / en / hu field); '' where the card lists several verbs. */
  meaning: { es: string; en: string; hu: string };
}

export interface TenseQuestion {
  id: string;
  infinitive: string;
  tense: DeDrillTense;
  person: DePerson;
  /** "er/sie/es", as the card shows the person. */
  personLabel: string;
  /** The answer with its pronoun, and the other answers that are right too. */
  answer: string;
  accept: string[];
  meaning: DrillVerb['meaning'];
  level: DeLevel;
  /** The own Konjunktiv II form is asked (C1): "ginge" besides "würde gehen". */
  own: boolean;
}

/** The level at which a tense of a verb is taught. */
export function drillTenseLevel(infinitive: string, tense: DeDrillTense, own = false): DeLevel {
  switch (tense) {
    case 'praesens':
      return 'A1';
    case 'perfekt':
      return isCommonPerfectVerb(infinitive) ? 'A1' : 'A2';
    case 'praeteritum':
      return deVerb(infinitive).basic ? 'A2' : 'B1';
    case 'futur1':
      return 'B1';
    case 'konjunktiv2':
      return own ? 'C1' : 'B1';
  }
}

let verbCache: DrillVerb[] | null = null;

/** The verbs of the German deck that the drill can ask at least one tense of, lowest level first. */
export function drillVerbs(): DrillVerb[] {
  if (verbCache) return verbCache;
  const byInfinitive = new Map<string, DrillVerb>();
  const single = new Set<string>();
  for (const card of getDeWords()) {
    if (card.pos !== 'verb' || typeof card.de !== 'string') continue;
    const level = card.level as DeLevel;
    const alternatives = card.de.split(' / ');
    alternatives.forEach((alt, i) => {
      const clean = alt.replace(/\([^)]*\)/g, ' ').trim();
      if (clean.includes(' ')) return;
      const infinitive = deInfinitiveOf(clean);
      if (!infinitive) return;
      // the meaning belongs to the verb when the card is about this one word (or this is its first)
      const meaning = i === 0 || alternatives.length === 1 ? { es: String(card.es), en: String(card.en), hu: String(card.hu) } : { es: '', en: '', hu: '' };
      const known = byInfinitive.get(infinitive);
      if (!known) {
        byInfinitive.set(infinitive, { infinitive, level, meaning });
        if (alternatives.length === 1) single.add(infinitive);
      } else if (!known.meaning.en && meaning.en) {
        known.meaning = meaning;
      } else if (alternatives.length === 1 && !single.has(infinitive) && meaning.en) {
        known.meaning = meaning;
        single.add(infinitive);
      }
    });
  }
  verbCache = [...byInfinitive.values()]
    .filter((v) => deConjugation(v.infinitive, 'praesens', personsFor(v.infinitive)[0]) !== null)
    .sort((a, b) => deLevelRank(a.level) - deLevelRank(b.level));
  return verbCache;
}

/** The tenses the drill can ask at `level`. */
export function tensesAtLevel(level: DeLevel): DeDrillTense[] {
  const first = (t: DeDrillTense) => (t === 'perfekt' ? 'A1' : t === 'praeteritum' ? 'A2' : t === 'futur1' || t === 'konjunktiv2' ? 'B1' : 'A1');
  return DE_DRILL_TENSES.filter((t) => atLeast(level, first(t)));
}

/** Whether this verb can be asked in this tense at this level. */
function askable(verb: DrillVerb, tense: DeDrillTense, level: DeLevel): { own: boolean } | null {
  // at C1 the verbs with a Konjunktiv II of their own are asked with it
  const own = tense === 'konjunktiv2' && level === 'C1' && OWN_KONJUNKTIV_VERBS.has(verb.infinitive);
  if (!atLeast(level, drillTenseLevel(verb.infinitive, tense, own))) return null;
  return deConjugation(verb.infinitive, tense, personsFor(verb.infinitive)[0], { own }) ? { own } : null;
}

function questionFor(verb: DrillVerb, tense: DeDrillTense, person: DePerson, own: boolean): TenseQuestion | null {
  const conjugation = deConjugation(verb.infinitive, tense, person, { own });
  if (!conjugation) return null;
  return {
    id: `${verb.infinitive}|${tense}|${person}`,
    infinitive: verb.infinitive,
    tense,
    person,
    personLabel: DE_PERSON_LABEL[person],
    answer: conjugation.answer,
    accept: conjugation.accept,
    meaning: verb.meaning,
    level: verb.level,
    own,
  };
}

export interface RoundOptions {
  level: DeLevel;
  /** One tense, or all the level teaches. */
  tense?: DeDrillTense | 'mixed';
  size?: number;
  seed: number;
}

/**
 * The questions of a round: verbs of the deck up to `level` (those of the level itself twice as likely), each in a tense the level
 * teaches, a person at random; a verb once per round. Deterministic for a seed.
 */
export function buildTenseRound({ level, tense = 'mixed', size = TENSE_ROUND_SIZE, seed }: RoundOptions): TenseQuestion[] {
  const rng = mulberry32(seed ^ hashString(`${level}|${tense}`));
  const tenses = tense === 'mixed' ? tensesAtLevel(level) : [tense];
  const pool = drillVerbs().filter((v) => atLeast(level, v.level));
  // a weighted draw without replacement: the verbs of the picked level come up twice as often as the lower ones
  // at C1 the verbs with a Konjunktiv II of their own (ginge, käme) are the new thing, so they come up more often
  const ownWeight = level === 'C1' && tenses.includes('konjunktiv2') ? 8 : 1;
  const bag = pool.flatMap((v) => {
    const copies = OWN_KONJUNKTIV_VERBS.has(v.infinitive) ? ownWeight : v.level === level ? 2 : 1;
    return Array.from({ length: copies }, () => v);
  });
  const out: TenseQuestion[] = [];
  const used = new Set<string>();
  let guard = 0;
  while (out.length < size && bag.length > 0 && guard++ < bag.length * 4) {
    const verb = bag[Math.floor(rng() * bag.length)];
    if (used.has(verb.infinitive)) continue;
    const options = tenses.filter((t) => askable(verb, t, level));
    if (options.length === 0) continue;
    const chosen = options[Math.floor(rng() * options.length)];
    const persons = personsFor(verb.infinitive);
    const person = persons[Math.floor(rng() * persons.length)];
    const question = questionFor(verb, chosen, person, askable(verb, chosen, level)!.own);
    if (!question) continue;
    used.add(verb.infinitive);
    out.push(question);
  }
  return out;
}

/** Whether the typed answer is right: strict for umlauts and ß, the pronoun is optional, "sie" and "Sie" count alike. */
export function gradeTense(typed: string, question: Pick<TenseQuestion, 'answer' | 'accept'>, opts: { strictAccents?: boolean } = {}): boolean {
  if (!typed.trim()) return false;
  return [question.answer, ...question.accept].some((candidate) =>
    strictAnswerMatch(typed, candidate, { lang: 'de', keepUmlauts: true, strictAccents: opts.strictAccents }),
  );
}
