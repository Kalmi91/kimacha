// Transparent German noun compounds (Kinderzimmer = Kind + Zimmer). A compound counts as known only when EVERY part is a
// learned noun: the last part (the head) is any learned form of a noun, each earlier part is a learned noun in its compounding
// shape (the noun, the noun without a final -e, with a linking -s / -es, or one of its plurals: Schule > Schulbus,
// Arbeit > Arbeitszimmer, Kind > Kinderzimmer, Sonne > Sonnenlicht). Pure, no corpus import. The learned nouns travel in the
// known-token set as marked keys (`~h:` head forms, `~m:` modifier forms), so the per-card sets of the Sentences tab merge as before.

export const COMPOUND_HEAD = '~h:';
export const COMPOUND_MODIFIER = '~m:';

/** Compounds that are not what their parts say (or whose parts mislead), or that are weekday-like words: never accepted by the rule. */
const OPAQUE_COMPOUNDS: ReadonlySet<string> = new Set([
  'sonntag', 'rathaus', 'bräutigam', 'handschuh', 'fingerhut', 'hochzeit', 'kleinod', 'armut', 'vorname', 'eisbär', 'hahnentritt',
  'wirtschaft', 'pferdefuß', 'ohrfeige', 'maulwurf', 'ohrring', 'sauerstoff', 'wasserstoff', 'kuhhandel', 'schlagzeug', 'schlagzeile',
]);

const MIN_PART = 3;

/** The shapes in which a noun can stand in front of another noun of a compound (lower-case). */
export function compoundModifierForms(noun: string, plurals: readonly string[]): string[] {
  const out = new Set<string>([noun, `${noun}s`, `${noun}es`]);
  if (noun.endsWith('e')) out.add(noun.slice(0, -1));
  for (const plural of plurals) {
    out.add(plural);
    if (plural.endsWith('n') && plural.length > MIN_PART + 1) out.add(plural.slice(0, -1));
  }
  return [...out].filter((form) => form.length >= MIN_PART);
}

/** The marked keys one learned noun adds to the known set: its head forms and its modifier forms. */
export function compoundKeys(heads: readonly string[], modifiers: readonly string[]): string[] {
  return [
    ...heads.filter((form) => form.length >= MIN_PART).map((form) => `${COMPOUND_HEAD}${form}`),
    ...modifiers.map((form) => `${COMPOUND_MODIFIER}${form}`),
  ];
}

function splits(rest: string, known: ReadonlySet<string>, parts: number): boolean {
  if (known.has(`${COMPOUND_HEAD}${rest}`)) return true;
  if (parts >= 3) return false;
  for (let i = MIN_PART; i <= rest.length - MIN_PART; i++) {
    if (known.has(`${COMPOUND_MODIFIER}${rest.slice(0, i)}`) && splits(rest.slice(i), known, parts + 1)) return true;
  }
  return false;
}

/** Is the (lower-case) token a transparent compound of learned nouns? Two or three parts. */
export function isKnownCompound(token: string, known: ReadonlySet<string>): boolean {
  if (token.length < 2 * MIN_PART || OPAQUE_COMPOUNDS.has(token) || !/^[a-zäöüß]+$/.test(token)) return false;
  for (let i = MIN_PART; i <= token.length - MIN_PART; i++) {
    if (known.has(`${COMPOUND_MODIFIER}${token.slice(0, i)}`) && splits(token.slice(i), known, 2)) return true;
  }
  return false;
}
