// A translation must carry its card word; the target sentence must use the answer
// that the learner sees after submitting an empty answer.
import fs from 'fs';
import path from 'path';
import { gradePcicAnswer, pcicAlternatives } from '@/lib/pcicMatch';
import { conjugate, TENSES } from '@/lib/games/conjugate';

const OUT = process.env.SCAN_OUT;
const exceptions: { order: number; reason: string }[] = JSON.parse(fs.readFileSync(path.join(__dirname, 'exampleSentenceCardWord.exceptions.json'), 'utf8'));
const ROOT = path.join(__dirname, '..', '..');
const ARTICLES = new Set(['el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas', 'lo']);
const EN_STOP = new Set(['to', 'the', 'a', 'an', 'be', 'something', 'someone', 'somebody', 'sth', 'sb', 'one', "one's", 'oneself', 'of', 'up', 'out', 'off', 'on', 'in', 'at', 'for', 'with', 'about', 'into', 'over', 'down', 'away', 'back', 'from', 'by', 'it', 'as', 'or', 'and', 'get', 'go', 'do', 'make', 'have', 'take']);
const IRR: Record<string, string[]> = {
  be: ['is', 'am', 'are', 'was', 'were', 'been', 'being', "i'm", "you're", "he's", "she's", "it's", "we're", "they're", "isn't", "aren't", "wasn't", "weren't"],
  have: ['has', 'had', 'having', "i've", "we've", "they've", "you've"], go: ['went', 'gone', 'goes'], do: ['did', 'done', 'does'],
  make: ['made'], take: ['took', 'taken'], get: ['got', 'gotten'], give: ['gave', 'given'], come: ['came'], see: ['saw', 'seen'],
  know: ['knew', 'known'], think: ['thought'], tell: ['told'], say: ['said'], find: ['found'], feel: ['felt'], leave: ['left'],
  bring: ['brought'], buy: ['bought'], catch: ['caught'], teach: ['taught'], fight: ['fought'], run: ['ran'], eat: ['ate', 'eaten'],
  drink: ['drank', 'drunk'], sing: ['sang', 'sung'], swim: ['swam'], begin: ['began', 'begun'], write: ['wrote', 'written'],
  speak: ['spoke', 'spoken'], break: ['broke', 'broken'], choose: ['chose', 'chosen'], drive: ['drove', 'driven'], ride: ['rode'],
  rise: ['rose', 'risen'], wake: ['woke', 'woken'], wear: ['wore', 'worn'], win: ['won'], lose: ['lost'], sell: ['sold'], send: ['sent'],
  spend: ['spent'], build: ['built'], keep: ['kept'], sleep: ['slept'], meet: ['met'], pay: ['paid'], lay: ['laid'], sit: ['sat'],
  stand: ['stood'], understand: ['understood'], hold: ['held'], fall: ['fell', 'fallen'], forget: ['forgot', 'forgotten'],
  grow: ['grew', 'grown'], hang: ['hung'], hide: ['hid', 'hidden'], lead: ['led'], lend: ['lent'], mean: ['meant'], shoot: ['shot'],
  shake: ['shook', 'shaken'], steal: ['stole', 'stolen'], stick: ['stuck'], strike: ['struck'], throw: ['threw', 'thrown'],
  fly: ['flew', 'flown', 'flies'], draw: ['drew', 'drawn'], dig: ['dug'], feed: ['fed'], forgive: ['forgave', 'forgiven'],
  freeze: ['froze', 'frozen'], bite: ['bit', 'bitten'], blow: ['blew', 'blown'], bend: ['bent'], deal: ['dealt'], hear: ['heard'],
  light: ['lit'], seek: ['sought'], tear: ['tore', 'torn'], wind: ['wound'], lie: ['lay', 'lain', 'lying'], die: ['dying'],
  child: ['children'], man: ['men'], woman: ['women'], person: ['people'], foot: ['feet'], tooth: ['teeth'], mouse: ['mice'],
  good: ['better', 'best'], gray: ['grey'], grey: ['gray'], bad: ['worse', 'worst'], i: ['me', 'my', 'mine', "i'm"], we: ['us', 'our', 'ours'], he: ['him', 'his'],
  she: ['her', 'hers'], they: ['them', 'their', 'theirs'], you: ['your', 'yours'], can: ['could'], will: ['would'], shall: ['should'],
  may: ['might'], sell_: [], wet: ['wet'], set: ['set'], put: ['put'], hurt: ['hurt'], cut: ['cut'], let: ['let'], read: ['read'],
  forbid: ['forbade', 'forbidden'], wolf: ['wolves'], shelf: ['shelves'], leaf: ['leaves'], knife: ['knives'], life: ['lives'],
  scarf: ['scarves'], half: ['halves'], wife: ['wives'], thief: ['thieves'], loaf: ['loaves'], calf: ['calves'],
  rebuild: ['rebuilt'], bind: ['bound'], withdraw: ['withdrew', 'withdrawn'], undertake: ['undertook', 'undertaken'],
  one: ['first'], two: ['second'], three: ['third'],
  blond: ['blonde'],
};

const enTokens = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/’/g, "'").replace(/\bcan't\b/g, 'can not').replace(/\bwon't\b/g, 'will not').replace(/n't\b/g, ' not').replace(/'m\b/g, ' am').replace(/'re\b/g, ' are').replace(/'ve\b/g, ' have').replace(/'ll\b/g, ' will').replace(/'d\b/g, ' would had').replace(/\b(it|he|she|that|there|what|who|here|where|let)'s\b/g, '$1 is us').replace(/[^a-z'\s-]/g, ' ').split(/[\s-]+/).filter(Boolean);
function enWordMatches(w: string, toks: string[]): boolean {
  w = w.toLowerCase();
  const irr = IRR[w] ?? [];
  return toks.some((t) => {
    if (t === w || irr.includes(t) || (IRR[t] ?? []).includes(w)) return true;
    // A plural headword can legitimately occur in the singular in an example.
    if (w.endsWith('s') && !w.endsWith('ss') && w.slice(0, -1) === t) return true;
    if (w.endsWith('ing')) {
      const stem = w.slice(0, -3);
      if ([stem, stem + 'e', /([^aeiou])\1$/.test(stem) ? stem.slice(0, -1) : stem].includes(t)) return true;
    }
    const base = t.replace(/'s$/, '');
    if (base === w) return true;
    if (w.endsWith('y') && w.length > 1 && /^(ies|ied|ying|y)$/.test(base.slice(w.length - 1)) && base.startsWith(w.slice(0, -1))) return true;
    if (w.endsWith('e') && base.startsWith(w.slice(0, -1)) && /^(e|es|ed|ing|er|ers|est|ely)$/.test(base.slice(w.length - 1))) return true;
    if (base.startsWith(w) && /^(s|es|ed|d|ing|er|ers|est|ly|ness|\w(ed|ing|er))$/.test(base.slice(w.length))) return true;
    return false;
  });
}
// Match the lexical head, excluding grammatical boilerplate in dictionary glosses.
// In noun phrases, complements ("drop of liquid", "form to fill out") do not
// replace the head noun; in phrasal verbs the verb and particle belong together.
function enAltMatches(alt: string, toks: string[]): boolean {
  const phrase = alt.replace(/\([^)]*\)/g, ' ').trim();
  // In productive descriptive compounds the color/shape/fit is the lexical
  // content, not the generic suffix (a red shirt must not match orange-colored).
  const descriptive = /^([a-z]+)-(?:colored|shaped|fitting)$/i.exec(phrase);
  if (descriptive) return enWordMatches(descriptive[1], toks);
  const phrasal = /^to (take|put|get|go) (up|out|off|on|in|over|down|away|back)\b/i.exec(phrase);
  if (phrasal) return enWordMatches(phrasal[1], toks) &&
    (toks.includes(phrasal[2]) || (phrasal[2] === 'in' && toks.includes('into')));
  if (!/^to\s/i.test(phrase)) {
    const nominal = enTokens(phrase.split(/\s+(?:of|to|for|during|on)\s+/i)[0]).filter(w => !EN_STOP.has(w));
    if (nominal.length) {
      if (toks.includes(nominal.join(''))) return true; // pocketknife / pocket knife
      if (enWordMatches(nominal[nominal.length - 1], toks)) return true;
    }
  }
  const words = enTokens(alt.replace(/\([^)]*\)/g, ' ')).filter((w) => !EN_STOP.has(w));
  const all = enTokens(alt.replace(/\([^)]*\)/g, ' '));
  if (all.length === 1 && ['a', 'an', 'the'].includes(all[0])) return toks.includes(all[0]) ||
    (['a', 'an'].includes(all[0]) && toks.some(t => ['a', 'an'].includes(t)));
  if (all.length === 1) return enWordMatches(all[0], toks);
  const use = words.length ? words : all.filter((w) => !['to', 'the', 'a', 'an'].includes(w));
  if (!use.length) return false;
  const head = /^\s*to\s/i.test(alt) ? use[0] : use[use.length - 1];
  return enWordMatches(head, toks);
}
const enAlternatives = (en: string) => en.replace(/\([^)]*\)/g, ' ').split(/[;,/]/).map((s) => s.trim()).filter(Boolean);

const esStrip = (s: string) => s.toLowerCase().replace(/[¿¡.,;:!?"()]/g, ' ').split(/\s+/).filter(Boolean);
function esVerbInSentence(word: string, toks: string[]): boolean {
  if (!/(?:ar|er|ir)(?:se)?$/.test(word)) return false;
  const infinitive = word.replace(/se$/, '');
  const forms = new Set(TENSES.flatMap(tense => (conjugate(infinitive, tense) ?? []).map(f => f.form)));
  const irregular: Record<string, string[]> = {
    sugerir: ['sugiero', 'sugieres', 'sugiere', 'sugieren', 'sugirió'],
    reforzar: ['refuerzo', 'refuerzas', 'refuerza', 'refuerzan'],
    herir: ['hiero', 'hieres', 'hiere', 'hieren', 'hirió'],
  };
  for (const f of irregular[infinitive] ?? []) forms.add(f);
  return toks.some(t => forms.has(t) || t.replace(/(?:me|te|se|nos|lo|la|los|las|le|les){1,2}$/, '') === infinitive);
}
function esShownInSentence(shown: string, sentence: string, lemmas: string[]): boolean {
  const words = esStrip(shown).filter((w) => !ARTICLES.has(w));
  if (!words.length) return true;
  const toks = esStrip(sentence);
  const lem = lemmas.map((l) => l.toLowerCase());
  const apocope: Record<string, string[]> = {
    algún: ['alguno', 'alguna', 'algunos', 'algunas'], ningún: ['ninguno', 'ninguna', 'ningunos', 'ningunas'],
    primer: ['primero', 'primera', 'primeros', 'primeras'], tercer: ['tercero', 'tercera', 'terceros', 'terceras'],
  };
  return words.every((w) => toks.includes(w) || lem.includes(w) || esVerbInSentence(w, toks) ||
    toks.some(t => (apocope[w] ?? []).includes(t) ||
      (/[oa]$/.test(w) && [w.slice(0, -1) + 'o', w.slice(0, -1) + 'a', w.slice(0, -1) + 'os', w.slice(0, -1) + 'as'].includes(t)) ||
      (w.endsWith('z') && t === w.slice(0, -1) + 'ces') || t === w + 's' || t === w + 'es'));
}

type Hit = { deck: string; level: string; key: number; es: string; en: string; shown: string; sentence_es: string; sentence_en: string; why: string[] };

it('recognizes inflections and phrase heads without accepting replacement synonyms', () => {
  for (const [word, sentence] of [['gums', 'My gum hurts.'], ['wolf', 'The wolves howl.'], ['shelf', 'Two shelves.'],
    ['to forbid', 'It is forbidden.'], ['to spy on', 'She spies on him.'], ['swimming', 'I swim.'],
    ['pocket knife', 'A pocketknife.'], ['video conference', 'A videoconference.'], ['drop of liquid', 'A drop of lemon.'],
    ['to take off a garment', 'Take off your shoes.'], ['to take in', 'She takes students into her home.']]) expect(enAltMatches(word, enTokens(sentence))).toBe(true);
  expect(enAltMatches('to injure', enTokens('You can hurt yourself.'))).toBe(false);
  expect(enAltMatches('hi', enTokens('Hello, how are you?'))).toBe(false);
  expect(enAltMatches('orange-colored', enTokens('An orange shirt.'))).toBe(true);
  expect(enAltMatches('orange-colored', enTokens('A red-colored shirt.'))).toBe(false);
  expect(enAltMatches('blond', enTokens('She is blonde.'))).toBe(true);
  expect(esShownInSentence('chico', 'La casa es chica.', ['el', 'casa', 'ser', 'pequeño'])).toBe(true);
  expect(esShownInSentence('algún', 'Hay alguna farmacia.', ['haber', 'alguno', 'farmacia'])).toBe(true);
  expect(esShownInSentence('la chamba', 'Tengo trabajo.', ['tener', 'trabajo'])).toBe(false);
});

it('keeps justified exceptions unique and bounded', () => {
  expect(exceptions.length).toBeLessThanOrEqual(30);
  expect(new Set(exceptions.map(e => e.order)).size).toBe(exceptions.length);
  for (const e of exceptions) {
    expect(Number.isInteger(e.order)).toBe(true);
    expect(e.reason.trim().length).toBeGreaterThan(20);
    const cards = ['a1', 'a2', 'b1', 'b2', 'c1'].flatMap(lv =>
      JSON.parse(fs.readFileSync(path.join(ROOT, 'data/words-open', `${lv}.json`), 'utf8')));
    const card = cards.find(c => c.order === e.order);
    expect(card?.sentence_es).toBeTruthy();
    expect(enAlternatives(card.en).some(a => enAltMatches(a, enTokens(card.sentence_en)))).toBe(false);
  }
});

it('uses the card word and the answer shown for an empty submission', () => {
  const hits: Hit[] = [];
  let checked = 0;
  for (const lv of ['a1', 'a2', 'b1', 'b2', 'c1']) {
    const cards = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/words-open', `${lv}.json`), 'utf8'));
    for (const c of cards) {
      if (!c.sentence_es) continue;
      checked++;
      const why: string[] = [];
      const shown = gradePcicAnswer('', c.es, false, 'es').best;
      if (!esShownInSentence(shown, c.sentence_es, c.sentence_lemmas)) why.push(`es-shown:${shown}`);
      const toks = enTokens(c.sentence_en);
      if (!exceptions.some(e => e.order === c.order) && !enAlternatives(c.en).some((a) => enAltMatches(a, toks))) why.push('en-word-missing');
      if (why.length) hits.push({ deck: 'words-open', level: lv, key: c.order, es: c.es, en: c.en, shown, sentence_es: c.sentence_es, sentence_en: c.sentence_en, why });
    }
  }
  for (const lv of ['a0', 'a1', 'a2', 'b1', 'b2', 'c1']) {
    const cards = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/words/en', `${lv}.json`), 'utf8'));
    for (const c of cards) {
      if (!c.sentence_en) continue;
      checked++;
      const why: string[] = [];
      const shown = gradePcicAnswer('', c.en, false, 'en').best;
      const toks = enTokens(c.sentence_en);
      if (!enAltMatches(shown, toks)) why.push(`en-shown:${shown}`);
      if (!pcicAlternatives(c.en).some((a) => enAltMatches(a, toks))) why.push('en-word-missing');
      if (why.length) hits.push({ deck: 'words/en', level: lv, key: c.id, es: c.es, en: c.en, shown, sentence_es: c.sentence_es, sentence_en: c.sentence_en, why });
    }
  }
  if (OUT) fs.writeFileSync(OUT, JSON.stringify({ checked, hits }, null, 1));
  expect(checked).toBeGreaterThan(0);
  expect(hits).toEqual([]);
});
