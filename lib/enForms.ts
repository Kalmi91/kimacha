// the recognisable English word forms of one learned dictionary form, for the "learned words only" gate
// (`lib/knownSentence.ts`). A pure module, no imports. It is for RECOGNITION, not teaching: only forms that
// a hand-checked table or a sure spelling rule gives are returned, so it can say "became" or "stopped"
// but never "goed" or "visitted".
//
// (a) irregular verbs: past + past participle from the table below (+ prefixed compounds: rebuild → rebuilt),
// (b) spelling rules for the regular forms: doubling (stop → stopped), y → ied/ies, silent e (make → making), -es,
// (c) irregular plurals (child → children, life → lives).

// base, past, past participle; "/" separates alternatives. The -s and -ing forms come from the spelling rules.
const IRREGULAR_VERBS =
  `
arise arose arisen
awake awoke awoken
bear bore borne/born
beat beat beaten
become became become
begin began begun
bend bent bent
bet bet bet
bind bound bound
bite bit bitten
bleed bled bled
blow blew blown
break broke broken
breed bred bred
bring brought brought
broadcast broadcast broadcast
build built built
burn burnt/burned burnt/burned
burst burst burst
buy bought bought
cast cast cast
catch caught caught
choose chose chosen
cling clung clung
come came come
cost cost cost
creep crept crept
cut cut cut
deal dealt dealt
dig dug dug
dive dived/dove dived
draw drew drawn
dream dreamt/dreamed dreamt/dreamed
drink drank drunk
drive drove driven
eat ate eaten
fall fell fallen
feed fed fed
feel felt felt
fight fought fought
find found found
flee fled fled
fling flung flung
fly flew flown
forbid forbade forbidden
forget forgot forgotten/forgot
forgive forgave forgiven
forgo forwent forgone
freeze froze frozen
get got gotten/got
give gave given
grind ground ground
grow grew grown
hang hung/hanged hung/hanged
hear heard heard
hide hid hidden
hit hit hit
hold held held
hurt hurt hurt
keep kept kept
kneel knelt/kneeled knelt/kneeled
know knew known
lay laid laid
lead led led
lean leant/leaned leant/leaned
leap leapt/leaped leapt/leaped
learn learnt/learned learnt/learned
leave left left
lend lent lent
let let let
lie lay/lied lain/lied
light lit/lighted lit/lighted
lose lost lost
make made made
mean meant meant
meet met met
pay paid paid
plead pleaded/pled pleaded/pled
prove proved proven/proved
put put put
quit quit/quitted quit/quitted
read read read
rid rid rid
ride rode ridden
ring rang rung
rise rose risen
run ran run
say said said
see saw seen
seek sought sought
sell sold sold
send sent sent
set set set
sew sewed sewn/sewed
shake shook shaken
shed shed shed
shine shone/shined shone/shined
shoot shot shot
show showed shown/showed
shrink shrank/shrunk shrunk
shut shut shut
sing sang sung
sink sank/sunk sunk
sit sat sat
slay slew slain
sleep slept slept
slide slid slid
slit slit slit
smell smelt/smelled smelt/smelled
sneak sneaked/snuck sneaked/snuck
sow sowed sown/sowed
speak spoke spoken
speed sped/speeded sped/speeded
spell spelt/spelled spelt/spelled
spend spent spent
spill spilt/spilled spilt/spilled
spin spun spun
spit spat/spit spat/spit
split split split
spread spread spread
spring sprang sprung
stand stood stood
steal stole stolen
stick stuck stuck
sting stung stung
stink stank/stunk stunk
stride strode stridden
strike struck struck/stricken
string strung strung
strive strove/strived striven/strived
swear swore sworn
sweep swept swept
swell swelled swollen/swelled
swim swam swum
swing swung swung
take took taken
teach taught taught
tear tore torn
tell told told
think thought thought
throw threw thrown
thrust thrust thrust
tread trod trodden/trod
understand understood understood
wake woke/waked woken/waked
wear wore worn
weave wove/weaved woven/weaved
weep wept wept
win won won
wind wound wound
wring wrung wrung
write wrote written
bid bid bid
dwell dwelt/dwelled dwelt/dwelled
mow mowed mown/mowed
spoil spoilt/spoiled spoilt/spoiled
`;

interface IrregularVerb {
  past: string[];
  pp: string[];
}

const IRREGULAR: Record<string, IrregularVerb> = {};
for (const line of IRREGULAR_VERBS.trim().split('\n')) {
  const [base, past, pp] = line.trim().split(/\s+/);
  IRREGULAR[base] = { past: past.split('/'), pp: pp.split('/') };
}

// be/have/do/go: the whole form set is listed, the spelling rules would give "haves" and "goed".
const SPECIAL_VERBS: Record<string, string[]> = {
  be: ['am', 'is', 'are', 'was', 'were', 'been', 'being'],
  have: ['has', 'had', 'having'],
  do: ['does', 'did', 'done', 'doing'],
  go: ['goes', 'went', 'gone', 'going'],
};

// Irregular noun plurals (the regular -s form is NOT added for these).
const IRREGULAR_PLURALS: Record<string, string[]> = {
  child: ['children'],
  person: ['people', 'persons'],
  man: ['men'],
  woman: ['women'],
  foot: ['feet'],
  tooth: ['teeth'],
  mouse: ['mice'],
  goose: ['geese'],
  ox: ['oxen'],
  louse: ['lice'],
  life: ['lives'],
  knife: ['knives'],
  wife: ['wives'],
  leaf: ['leaves'],
  half: ['halves'],
  wolf: ['wolves'],
  shelf: ['shelves'],
  thief: ['thieves'],
  loaf: ['loaves'],
  calf: ['calves'],
  self: ['selves'],
  elf: ['elves'],
  scarf: ['scarves', 'scarfs'],
};

// "-man" compounds with a "-men" plural (a plain "-man" rule would turn human into humen).
const MAN_COMPOUNDS: ReadonlySet<string> = new Set([
  'policeman', 'fireman', 'postman', 'chairman', 'businessman', 'snowman', 'gentleman', 'salesman',
  'fisherman', 'spokesman', 'craftsman', 'handyman', 'doorman', 'barman', 'workman', 'sportsman',
  'horseman', 'countryman', 'statesman', 'madman', 'caveman', 'repairman', 'anchorman', 'middleman',
]);

// Verbs with a prefix: "rebuild" has the forms of "build" with "re" in front.
const PREFIXES = ['re', 'over', 'under', 'out', 'up', 'mis', 'with', 'fore', 'un'];
// Regular words that only look like prefix + irregular verb (relay is relayed, not relaid).
const NOT_COMPOUND: ReadonlySet<string> = new Set(['relay']);

// Two-or-more syllable verbs whose last syllable is stressed double the last consonant (prefer → preferred).
// Without a pronunciation dictionary the rule is: one syllable → double, otherwise only this list.
const STRESS_FINAL: ReadonlySet<string> = new Set([
  'admit', 'begin', 'commit', 'compel', 'concur', 'confer', 'control', 'defer', 'deter', 'equip', 'excel',
  'expel', 'forbid', 'forget', 'format', 'handicap', 'incur', 'infer', 'kidnap', 'occur', 'omit', 'overlap',
  'patrol', 'permit', 'prefer', 'program', 'propel', 'rebel', 'recur', 'refer', 'regret', 'repel', 'submit',
  'transfer', 'unplug', 'unwrap', 'unzip', 'upset', 'acquit', 'outwit',
]);

// Ending in a single l, British spelling doubles it (traveling / travelling): both are accepted.
const BRITISH_L: ReadonlySet<string> = new Set([
  'travel', 'cancel', 'label', 'model', 'level', 'marvel', 'signal', 'quarrel', 'counsel', 'fuel',
  'channel', 'tunnel', 'total', 'equal', 'dial', 'rival', 'shovel', 'swivel', 'panel',
]);

// -ic verbs take a k (panic → panicked); an -ic adjective (magic, basic) does not.
const C_TO_CK: ReadonlySet<string> = new Set(['panic', 'picnic', 'mimic', 'traffic', 'frolic']);
// -ch pronounced k: the plural is -chs, not -ches.
const CH_AS_K: ReadonlySet<string> = new Set(['stomach', 'monarch', 'epoch', 'patriarch', 'matriarch']);
// consonant + o: only -es (hero) or both -s and -es (volcano); every other one takes -s (photo, piano).
const O_ES_ONLY: ReadonlySet<string> = new Set(['potato', 'tomato', 'hero', 'echo', 'veto', 'torpedo', 'embargo']);
const O_BOTH: ReadonlySet<string> = new Set([
  'volcano', 'mosquito', 'tornado', 'buffalo', 'cargo', 'domino', 'zero', 'banjo', 'mango', 'avocado',
]);
// Silent-e verbs with a second accepted -ing spelling, and singe (singing is sing's form).
const ING_SPECIAL: Record<string, string[]> = {
  age: ['aging', 'ageing'],
  queue: ['queuing', 'queueing'],
  singe: ['singeing'],
};

/** One-syllable consonant-vowel-consonant word (stop, clap, quiz), or a listed stress-final one. */
function doubles(w: string): boolean {
  const s = w.replace(/qu/g, 'q');
  const groups = s.match(/[aeiou]+/g) ?? [];
  if (groups.length === 1 && /[^aeiou][aeiou][^aeiouwxy]$/.test(s)) return true;
  return STRESS_FINAL.has(w);
}

function withSuffix(w: string, suffix: 'ed' | 'ing'): string[] {
  if (C_TO_CK.has(w)) return [`${w}k${suffix}`];
  const out = [doubles(w) ? `${w}${w.slice(-1)}${suffix}` : `${w}${suffix}`];
  if (BRITISH_L.has(w)) out.push(`${w}l${suffix}`);
  return out;
}

/** -s of a verb (3rd person) or a noun (plural). */
function sForms(w: string): string[] {
  if (/[^aeiou]y$/.test(w)) return [`${w.slice(0, -1)}ies`];
  if (w.endsWith('o')) {
    if (/[^aeiou]o$/.test(w) && O_ES_ONLY.has(w)) return [`${w}es`];
    if (/[^aeiou]o$/.test(w) && O_BOTH.has(w)) return [`${w}s`, `${w}es`];
    return [`${w}s`];
  }
  if (/(?:s|x|z|ch|sh)$/.test(w)) {
    if (CH_AS_K.has(w)) return [`${w}s`];
    if (w.endsWith('z')) return [doubles(w) ? `${w}zes` : `${w}es`];
    if (w.endsWith('s') && doubles(w)) return [`${w}es`, `${w}ses`];
    return [`${w}es`];
  }
  return [`${w}s`];
}

/** Regular past / past participle. */
function edForms(w: string): string[] {
  if (/[^aeiou]y$/.test(w)) return [`${w.slice(0, -1)}ied`];
  if (w.endsWith('e')) return [`${w}d`];
  return withSuffix(w, 'ed');
}

function ingForms(w: string): string[] {
  if (ING_SPECIAL[w]) return ING_SPECIAL[w];
  if (w.endsWith('ie')) return [`${w.slice(0, -2)}ying`];
  if (/(?:ee|ye|oe)$/.test(w)) return [`${w}ing`];
  if (w.endsWith('e')) return [`${w.slice(0, -1)}ing`];
  return withSuffix(w, 'ing');
}

/** The forms of a table or special verb, or null if `w` is not one. */
function irregularVerbForms(w: string): string[] | null {
  const special = SPECIAL_VERBS[w];
  if (special) return special;
  const irregular = IRREGULAR[w];
  if (!irregular) return null;
  return [...sForms(w), ...ingForms(w), ...irregular.past, ...irregular.pp];
}

function compoundForms(w: string): string[] | null {
  if (NOT_COMPOUND.has(w)) return null;
  for (const prefix of PREFIXES) {
    if (!w.startsWith(prefix)) continue;
    const rest = w.slice(prefix.length);
    if (rest.length < 2 || rest === 'be' || rest === 'have') continue;
    const forms = irregularVerbForms(rest);
    if (forms) return forms.map((f) => `${prefix}${f}`);
  }
  return null;
}

function formsOf(w: string): string[] {
  const verb = irregularVerbForms(w);
  if (verb) return verb;
  const plural = IRREGULAR_PLURALS[w];
  if (plural) return plural;
  if (MAN_COMPOUNDS.has(w)) return [`${w.slice(0, -3)}men`];
  if (w.length > 5 && w.endsWith('woman')) return [`${w.slice(0, -5)}women`];
  if (w.length > 5 && w.endsWith('child')) return [`${w}ren`];
  const compound = compoundForms(w);
  if (compound) return compound;
  // The spelling rules need a real word: the one- and two-letter ones (a, an, in) get no endings.
  if (w.length < 3) return [];
  return [...sForms(w), ...edForms(w), ...ingForms(w)];
}

/**
 * The inflected forms of one dictionary-form word (lowercase letters only; an apostrophe or digit gives
 * nothing): 3rd person / plural, past, past participle, -ing, the irregular ones included. The word itself
 * is not in the result.
 */
export function enForms(word: string): string[] {
  const w = word.toLowerCase();
  if (!/^[a-z]+$/.test(w)) return [];
  return [...new Set(formsOf(w))].filter((f) => f !== w);
}
