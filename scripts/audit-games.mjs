#!/usr/bin/env node
/**
 * audit-games.mjs, GAMES.md 3.6, the mechanical guard for the Game tab's
 * content-driven games (grammar-choice, confusables, and future kinds: story,
 * chat, myth). Modeled on scripts/audit-corpus.mjs but scoped to
 * data/games/**.json instead of the main word corpus.
 *
 * Guarantee (GAMES.md 0. szekció, the user's kőbe vésett kritérium): every
 * content word is EITHER already taught (in the target level's cumulative
 * Spanish vocabulary, built the same way audit-corpus.mjs builds it: the `es`
 * field of every word card from A0 up to and including the content's own
 * `level`) OR carries an explicit gloss in the content JSON itself (a
 * confusables `members[].word`, or a `glossary[]` entry on the topic/set).
 *
 * P1 (build-blocking, GAMES.md 9. szekció "0 P1"):
 *   - a target-language content word that is neither taught nor glossed
 *   - a Record<lang,string> field (title/rule/more/why/wrong/gloss/hint/
 *     mnemonic/explanation) missing one of the 4 active languages
 *     (hu/en/es/de), or with an empty string for one
 *   - a grammar item whose `correct` index is out of range, or whose
 *     `sentence` has no "___" blank
 *   - a grammar item missing a `wrong[...]` explanation for one of its
 *     non-correct options
 *   - a confusables drill whose `correct` is not one of the set's own
 *     `members[].word`, or a 'gap'/'listening' drill with no `sentence`
 *   - a myth item missing an id/level/track/claim/verdict, or a `source`
 *     with no `label` (GAMES.md 4.13 forrás-fegyelem: `label` is required,
 *     `url` is intentionally OPTIONAL, an absent url is never a P1, a
 *     fabricated url would be far worse than none, see content.ts's MythItem)
 *   - a story scene missing text/translation, or a question with <2 options
 *     or no option marked `correct`
 *   - a chat node option with a dangling `next` (no such node id in the
 *     same chat) or an unknown `checklist` ref; a checklist item missing its
 *     `why`/`source.label`/4-language phrasing (`url` optional, same rule as
 *     myth); an ending with no id or an `if` that isn't `checklist<op>N` or
 *     `default`; a chat with zero endings
 *   - a ccat antonym/synonym item missing word/correct/distractors (<3), or
 *     where word/correct/a distractor repeat each other; a ccat word-problem
 *     with a non-`+`/`-` op, an `answer` that doesn't match `a op b`, <3
 *     numeric distractors, or a distractor equal to the answer
 *
 * P2 (reported, not build-blocking):
 *   - a sentence/example/claim longer than 12 words at level A1 or above
 *   - a duplicate item id (grammar items within one topic; confusables set
 *     ids across the whole `confusables/<lang>/` directory; myth item ids
 *     across the whole `myths/<lang>/` directory; story/scene ids; chat ids;
 *     ccat antonym/synonym/word-problem ids, each within their own file kind)
 *   - a chat option's `requires` referencing an unknown setup question id
 *   - a chat node with >=2 options where none is marked `good:true`
 *
 * Run: node scripts/audit-games.mjs
 * Exit 1 if any P1 is found (the F3 kapu, GAMES.md 9. szekció).
 */

import { readFileSync, readdirSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const LANGS = ['hu', 'en', 'es', 'de'];
const LEVELS = ['A0', 'A1', 'A2', 'B1', 'B2', 'C1']; // C2 frozen, excluded (F-1 precedent)

// ---------------------------------------------------------------------------
// Spanish taught-vocabulary matcher, adapted from scripts/audit-corpus.mjs.
// Deliberately WITHOUT that script's irregular-paradigm map: authored game
// content controls its own wording, so anything genuinely irregular goes in
// `glossary` instead of growing a second copy of that map to keep in sync.
// ---------------------------------------------------------------------------

const GLUE_WHITELIST = new Set([
  'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas',
  'yo', 'tu', 'él', 'el', 'ella', 'nosotros', 'nosotras', 'vosotros', 'vosotras',
  'ellos', 'ellas', 'usted', 'ustedes',
  'me', 'te', 'se', 'nos', 'le', 'les', 'lo', 'mi', 'ti', 'si', 'mí',
  'su', 'mis', 'tus', 'sus', 'nuestro', 'nuestra', 'nuestros', 'nuestras',
  'vuestro', 'vuestra', 'vuestros', 'vuestras',
  'a', 'ante', 'bajo', 'con', 'contra', 'de', 'desde', 'durante',
  'en', 'entre', 'hacia', 'hasta', 'mediante', 'para', 'por', 'según', 'segun',
  'sin', 'sobre', 'tras',
  'y', 'e', 'o', 'u', 'pero', 'sino', 'que', 'porque', 'aunque', 'cuando',
  'como', 'donde', 'mientras', 'ni', 'pues', 'ya', 'tanto', 'tan',
  'este', 'esta', 'estos', 'estas', 'ese', 'esa', 'esos', 'esas',
  'aquel', 'aquella', 'aquellos', 'aquellas', 'esto', 'eso', 'aquello',
  'es', 'son', 'somos', 'soy', 'eres', 'sois',
  'está', 'esta', 'están', 'estan', 'estoy', 'estás', 'estas', 'estamos', 'estáis', 'estais',
  'hay', 'ha', 'he', 'has', 'hemos', 'han',
  'algo', 'alguien', 'nada', 'nadie',
  'no', 'muy', 'bien', 'mal', 'aquí', 'aqui', 'allí', 'alli',
  'ahí', 'ahi', 'hoy', 'ayer', 'mañana', 'manana', 'ahora', 'luego', 'siempre', 'nunca',
  'también', 'tambien', 'tampoco', 'solo', 'sólo', 'cerca', 'lejos', 'antes', 'después', 'despues',
  'qué', 'que', 'quién', 'quien', 'quiénes', 'quienes', 'cuál', 'cual', 'cuáles', 'cuales',
  'cuánto', 'cuanto', 'cuánta', 'cuanta', 'cuántos', 'cuantos', 'cuántas', 'cuantas',
  'dónde', 'donde', 'cuándo', 'cuando', 'cómo', 'como',
  'claro', 'del', 'al', 'cada', 'conmigo', 'contigo', 'consigo',
]);
const GLUE_STRIPPED = new Set([...GLUE_WHITELIST].map((w) => removeAccents(w)));

// Culturally transparent proper nouns, not taught vocabulary cards. The
// character-name block is story/chat cast (GAMES.md 4.5/4.6): a name is a
// name in any language, glossing "María" scene after scene would be noise,
// not a vocabulary lesson.
const PROPER_NOUNS = new Set([
  'méxico', 'mexico', 'españa', 'espana', 'madrid', 'barcelona', 'alemania',
  'cdmx', 'coyoacán', 'coyoacan', 'condesa', 'roma', 'polanco',
  'maría', 'maria', 'ana', 'rosa', 'carlos', 'elena', 'sofía', 'sofia',
  'diego', 'luis', 'laura', 'nova', 'rex', 'javier', 'marco', 'lucía', 'lucia',
  'budapest', 'guadalajara', 'puebla', 'perú', 'peru', 'oaxaca', 'hungría', 'hungria',
]);

function removeAccents(str) {
  return str.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function normalize(str) {
  return String(str).toLowerCase().replace(/[¡!¿?.,;:'"()\-–_/]/g, ' ').replace(/___/g, ' ').trim();
}

function tokenize(str) {
  return normalize(str).split(/\s+/).filter((t) => t.length > 0);
}

// The endings the stem matcher knows. Present tense only until 2026-09-08,
// which meant every past and future form in a lesson was reported as an
// untaught word even when its infinitive is in the corpus: the guard was as
// present-tense-only as the course used to be. The longest ending has to come
// first, otherwise 'hablaría' would be cut at 'a' instead of 'aría'.
const VERB_ENDINGS = [
  // NOTE: verbStem() strips accents BEFORE matching, so every ending here is
  // written WITHOUT accents; an accented entry would never fire.
  // conditional and future
  'ariamos', 'eriamos', 'iriamos', 'aremos', 'eremos', 'iremos',
  'arian', 'erian', 'irian', 'arias', 'erias', 'irias', 'aria', 'eria', 'iria',
  'aran', 'eran', 'iran', 'aras', 'eras', 'iras', 'ara', 'era', 'ira', 'are', 'ere', 'ire',
  // imperfect
  'abamos', 'iamos', 'abais', 'aban', 'abas', 'aba', 'ian', 'ias', 'ia',
  // preterite (regular)
  'asteis', 'isteis', 'aron', 'ieron', 'aste', 'iste', 'amos', 'imos', 'io',
  // participle and gerund
  'andose', 'iendose', 'ando', 'iendo', 'ados', 'idos', 'adas', 'idas', 'ado', 'ida', 'ido', 'ada',
  // present
  'emos', 'ais', 'eis', 'an', 'en', 'is', 'ar', 'er', 'ir', 'as', 'es', 'o', 'a', 'e', 'i',
];

// Irregular forms the stem matcher cannot reach (a new stem, not a new ending).
// Each maps to its infinitive and only counts as known when THAT infinitive is
// taught, so this is a bridge over irregularity, not a free pass.
const IRREGULAR_FORMS = new Map(Object.entries({
  // ser / ir (shared preterite) and their imperfects
  fui: 'ser', fuiste: 'ser', fue: 'ser', fuimos: 'ser', fueron: 'ser',
  era: 'ser', eras: 'ser', eramos: 'ser', eran: 'ser',
  iba: 'ir', ibas: 'ir', ibamos: 'ir', iban: 'ir',
  // preterite stems
  tuve: 'tener', tuviste: 'tener', tuvo: 'tener', tuvimos: 'tener', tuvieron: 'tener',
  estuve: 'estar', estuviste: 'estar', estuvo: 'estar', estuvimos: 'estar', estuvieron: 'estar',
  hice: 'hacer', hiciste: 'hacer', hizo: 'hacer', hicimos: 'hacer', hicieron: 'hacer',
  dije: 'decir', dijiste: 'decir', dijo: 'decir', dijimos: 'decir', dijeron: 'decir',
  puse: 'poner', pusiste: 'poner', puso: 'poner', pusimos: 'poner', pusieron: 'poner',
  pude: 'poder', pudiste: 'poder', pudo: 'poder', pudimos: 'poder', pudieron: 'poder',
  supe: 'saber', supiste: 'saber', supo: 'saber', supimos: 'saber', supieron: 'saber',
  quise: 'querer', quisiste: 'querer', quiso: 'querer', quisimos: 'querer', quisieron: 'querer',
  vine: 'venir', viniste: 'venir', vino: 'venir', vinimos: 'venir', vinieron: 'venir',
  traje: 'traer', trajiste: 'traer', trajo: 'traer', trajimos: 'traer', trajeron: 'traer',
  di: 'dar', diste: 'dar', dio: 'dar', dimos: 'dar', dieron: 'dar',
  vi: 'ver', viste: 'ver', vimos: 'ver', vieron: 'ver',
  // shortened future / conditional stems
  tendre: 'tener', tendras: 'tener', tendra: 'tener', tendremos: 'tener', tendran: 'tener',
  pondre: 'poner', pondras: 'poner', pondra: 'poner', pondremos: 'poner', pondran: 'poner',
  vendre: 'venir', vendras: 'venir', vendra: 'venir', vendremos: 'venir', vendran: 'venir',
  saldre: 'salir', saldras: 'salir', saldra: 'salir', saldremos: 'salir', saldran: 'salir',
  podre: 'poder', podras: 'poder', podra: 'poder', podremos: 'poder', podran: 'poder',
  sabre: 'saber', sabras: 'saber', sabra: 'saber', sabremos: 'saber', sabran: 'saber',
  hare: 'hacer', haras: 'hacer', hara: 'hacer', haremos: 'hacer', haran: 'hacer',
  dire: 'decir', diras: 'decir', dira: 'decir', diremos: 'decir', diran: 'decir',
  habra: 'haber', habran: 'haber', habre: 'haber', habremos: 'haber',
  // irregular participles
  hecho: 'hacer', visto: 'ver', dicho: 'decir', escrito: 'escribir', puesto: 'poner',
  vuelto: 'volver', abierto: 'abrir', roto: 'romper', muerto: 'morir',
  sido: 'ser', ido: 'ir', dado: 'dar',
  // stem-changing present forms (e->ie, o->ue, e->i): the stem itself changes,
  // so no ending rule can connect them to their infinitive
  puedo: 'poder', puedes: 'poder', puede: 'poder', pueden: 'poder', pueda: 'poder', puedas: 'poder',
  tiene: 'tener', tienes: 'tener', tienen: 'tener', tengo: 'tener', tenga: 'tener',
  viene: 'venir', vienes: 'venir', vienen: 'venir', vengo: 'venir', ven: 'venir',
  quiero: 'querer', quieres: 'querer', quiere: 'querer', quieren: 'querer',
  empiezo: 'empezar', empiezas: 'empezar', empieza: 'empezar', empiezan: 'empezar',
  vuelvo: 'volver', vuelves: 'volver', vuelve: 'volver', vuelven: 'volver',
  duermo: 'dormir', duermes: 'dormir', duerme: 'dormir', duermen: 'dormir',
  pienso: 'pensar', piensas: 'pensar', piensa: 'pensar', piensan: 'pensar',
  juego: 'jugar', juegas: 'jugar', juega: 'jugar', juegan: 'jugar',
  pido: 'pedir', pides: 'pedir', pide: 'pedir', piden: 'pedir',
  sigo: 'seguir', sigues: 'seguir', sigue: 'seguir', siguen: 'seguir',
  cierro: 'cerrar', cierras: 'cerrar', cierra: 'cerrar', cierran: 'cerrar',
  llueve: 'llover', nieva: 'nevar',
  // short stems the 3-character floor in verbStem() cannot cut
  leo: 'leer', lees: 'leer', lee: 'leer', leemos: 'leer', leen: 'leer',
  leia: 'leer', leias: 'leer', leiamos: 'leer', leian: 'leer', lei: 'leer', leyo: 'leer', leyeron: 'leer',
  veo: 'ver', ves: 'ver', ve: 'ver', vemos: 'ver', veia: 'ver', veias: 'ver', veiamos: 'ver', veian: 'ver',
  doy: 'dar', das: 'dar', da: 'dar', damos: 'dar', dan: 'dar', daba: 'dar', dare: 'dar',
  voy: 'ir', vas: 'ir', va: 'ir', vamos: 'ir', van: 'ir', ire: 'ir', iras: 'ir', ira: 'ir',
}));

// An infinitive or gerund can carry object pronouns (llamarte, verme,
// dármelo, levantándose); the verb underneath is what the corpus teaches.
const ATTACHED_PRONOUNS = ['melo', 'mela', 'selo', 'sela', 'telo', 'tela', 'nos', 'les', 'los', 'las', 'me', 'te', 'se', 'le', 'lo', 'la'];

function stripAttachedPronouns(t) {
  for (const pron of ATTACHED_PRONOUNS) {
    if (t.endsWith(pron) && t.length - pron.length >= 4) {
      const base = t.slice(0, t.length - pron.length);
      if (/(ar|er|ir|ando|iendo)$/.test(base)) return base;
    }
  }
  return t;
}

// Several endings can fit the same token ("envia" is both envi+a and env+ia),
// and only one of them is the real one, so every candidate stem is kept and the
// matcher accepts if ANY of them lines up with a candidate stem of a taught
// word. Returning just the longest-ending stem used to break tokens that had
// always matched.
function verbStems(token) {
  const t = stripAttachedPronouns(removeAccents(token));
  const stems = new Set();
  for (const ending of VERB_ENDINGS) {
    if (t.endsWith(ending) && t.length - ending.length >= 3) stems.add(t.slice(0, t.length - ending.length));
  }
  return stems;
}

/** Exact match, plural/gender variant (+s/+es, o<->a, os<->as), or shared verb stem. */
function matches(token, taughtSet) {
  const ta = removeAccents(token);
  if (taughtSet.has(ta)) return true;

  for (const t of taughtSet) {
    if (ta === t) return true;
    if (ta + 's' === t || ta + 'es' === t) return true;
    if (t + 's' === ta || t + 'es' === ta) return true;
    if (ta.length > 1 && t.length > 1 && ta.slice(0, -1) === t.slice(0, -1)) {
      const e1 = ta.slice(-1), e2 = t.slice(-1);
      if ((e1 === 'o' && e2 === 'a') || (e1 === 'a' && e2 === 'o')) return true;
    }
    if (ta.length > 2 && t.length > 2 && ta.slice(0, -2) === t.slice(0, -2)) {
      const e1 = ta.slice(-2), e2 = t.slice(-2);
      if ((e1 === 'os' && e2 === 'as') || (e1 === 'as' && e2 === 'os')) return true;
    }
  }

  const stems = verbStems(ta);
  if (stems.size) {
    for (const t of taughtSet) {
      for (const other of verbStems(t)) {
        if (stems.has(other)) return true;
      }
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// Cumulative taught-token sets, built once from the shared Spanish corpus.
// ---------------------------------------------------------------------------

function loadLevelWords(level) {
  const p = join(ROOT, `data/words/${level.toLowerCase()}.json`);
  if (!existsSync(p)) return [];
  return JSON.parse(readFileSync(p, 'utf8'));
}

const taughtByLevel = {};
for (const lvl of LEVELS) {
  const set = new Set();
  for (const card of loadLevelWords(lvl)) {
    for (const tok of tokenize(card.es ?? '')) set.add(removeAccents(tok));
  }
  taughtByLevel[lvl] = set;
}

function cumulativeTaught(level) {
  const idx = LEVELS.indexOf(level);
  const set = new Set();
  const upTo = idx === -1 ? LEVELS.length - 1 : idx; // unknown level: be generous, use everything loaded
  for (let i = 0; i <= upTo; i++) for (const t of taughtByLevel[LEVELS[i]]) set.add(t);
  return set;
}

function tokenKnown(tok, taughtSet, extra) {
  const stripped = removeAccents(tok);
  // A bare numeral (with an optional trailing %) is a digit, not Spanish
  // vocabulary, "400" or "10%" needs no gloss in any language. Fact-based
  // content (chat checklists, myth claims) cites real numbers routinely.
  if (/^\d+%?$/.test(tok)) return true;
  if (GLUE_WHITELIST.has(tok) || GLUE_STRIPPED.has(stripped)) return true;
  if (PROPER_NOUNS.has(stripped)) return true;
  if (extra?.has(stripped)) return true;
  // An irregular past/future form counts as known exactly when its own
  // infinitive is taught.
  const infinitive = IRREGULAR_FORMS.get(stripped);
  if (infinitive && (taughtSet.has(infinitive) || extra?.has(infinitive))) return true;
  // Glossary/member words can be conjugated forms of each other (a confusables
  // set's own infinitive member used inflected in an example), so stem-match
  // against them too, not just against the corpus.
  const combined = extra?.size ? new Set([...taughtSet, ...extra]) : taughtSet;
  return matches(tok, combined);
}

// ---------------------------------------------------------------------------
// Language-completeness helpers
// ---------------------------------------------------------------------------

const p1 = [];
const p2 = [];

function checkLangs(obj, path) {
  if (!obj || typeof obj !== 'object') {
    p1.push({ path, issue: `missing translations object` });
    return;
  }
  for (const lang of LANGS) {
    const v = obj[lang];
    if (typeof v !== 'string' || v.trim().length === 0) {
      p1.push({ path, issue: `missing or empty '${lang}' translation` });
    }
  }
}

function wordCount(str) {
  return normalize(str).split(/\s+/).filter(Boolean).length;
}

function checkLength(str, level, path) {
  const isA1Plus = level !== 'A0';
  const cap = isA1Plus ? 12 : 12;
  const n = wordCount(str);
  if (n > cap) p2.push({ path, issue: `sentence is ${n} words, longer than the ${cap}-word cap for ${level}` });
}

// ---------------------------------------------------------------------------
// grammar-choice (data/games/grammar/<lang>/<topic>.json)
// ---------------------------------------------------------------------------

function glossaryTokenSet(glossary) {
  const set = new Set();
  for (const g of glossary ?? []) {
    for (const tok of tokenize(g.word ?? '')) set.add(removeAccents(tok));
  }
  return set;
}

function auditGrammarWord(tok, taughtSet, extra, path) {
  if (!tokenKnown(tok, taughtSet, extra)) {
    p1.push({ path, issue: `untaught/unglossed Spanish word: "${tok}"` });
  }
}

function auditGrammarTopic(topic, filePath) {
  const path = `grammar/${filePath}`;
  if (!topic.topic) p1.push({ path, issue: 'missing topic id' });
  if (!LEVELS.includes(topic.level)) p1.push({ path, issue: `missing/unknown level: ${topic.level}` });

  checkLangs(topic.title, `${path} title`);
  checkLangs(topic.rule, `${path} rule`);
  if (topic.more) checkLangs(topic.more, `${path} more`);

  const taughtSet = cumulativeTaught(topic.level ?? 'C1');
  const extra = glossaryTokenSet(topic.glossary);

  const seenIds = new Set();
  for (const item of topic.items ?? []) {
    const itemPath = `${path} item ${item.id ?? '?'}`;
    if (seenIds.has(item.id)) p2.push({ path: itemPath, issue: `duplicate item id "${item.id}"` });
    seenIds.add(item.id);

    if (!item.sentence?.includes('___')) p1.push({ path: itemPath, issue: 'sentence has no "___" blank' });
    if (!Array.isArray(item.options) || item.options.length < 2) p1.push({ path: itemPath, issue: 'needs >=2 options' });
    if (typeof item.correct !== 'number' || item.correct < 0 || item.correct >= (item.options?.length ?? 0)) {
      p1.push({ path: itemPath, issue: `correct index ${item.correct} out of range` });
    }

    checkLangs(item.why, `${itemPath} why`);
    for (const opt of item.options ?? []) {
      if (opt === item.options[item.correct]) continue;
      if (!item.wrong?.[opt]) {
        p1.push({ path: itemPath, issue: `missing wrong[] explanation for option "${opt}"` });
      } else {
        checkLangs(item.wrong[opt], `${itemPath} wrong[${opt}]`);
      }
    }

    for (const tok of tokenize((item.sentence ?? '').replace('___', ''))) {
      auditGrammarWord(tok, taughtSet, extra, itemPath);
    }
    for (const opt of item.options ?? []) {
      for (const tok of tokenize(opt)) auditGrammarWord(tok, taughtSet, extra, itemPath);
    }
    for (const ex of item.examples ?? []) {
      for (const tok of tokenize(ex)) auditGrammarWord(tok, taughtSet, extra, itemPath);
      checkLength(ex, topic.level, itemPath);
    }
    checkLength(item.sentence ?? '', topic.level, itemPath);
  }
}

// ---------------------------------------------------------------------------
// confusables (data/games/confusables/<lang>/<id>.json)
// ---------------------------------------------------------------------------

function auditConfusablesSet(set, filePath, seenSetIds) {
  const path = `confusables/${filePath}`;
  if (!set.id) p1.push({ path, issue: 'missing set id' });
  if (seenSetIds.has(set.id)) p2.push({ path, issue: `duplicate confusables set id "${set.id}"` });
  seenSetIds.add(set.id);
  if (!LEVELS.includes(set.level)) p1.push({ path, issue: `missing/unknown level: ${set.level}` });
  if (!Array.isArray(set.members) || set.members.length < 2) p1.push({ path, issue: 'needs >=2 members' });

  const taughtSet = cumulativeTaught(set.level ?? 'C1');
  const extra = glossaryTokenSet(set.glossary);
  const memberWords = new Set((set.members ?? []).map((m) => removeAccents(normalize(m.word ?? ''))));
  for (const w of memberWords) extra.add(w);

  for (const m of set.members ?? []) {
    const mPath = `${path} member "${m.word}"`;
    if (!m.word) p1.push({ path: mPath, issue: 'missing word' });
    checkLangs(m.gloss, `${mPath} gloss`);
    if (m.hint) checkLangs(m.hint, `${mPath} hint`);
    if (!Array.isArray(m.examples) || m.examples.length < 1) p1.push({ path: mPath, issue: 'needs >=1 example' });
    for (const ex of m.examples ?? []) {
      for (const tok of tokenize(ex)) {
        if (!tokenKnown(tok, taughtSet, extra)) p1.push({ path: mPath, issue: `untaught/unglossed Spanish word: "${tok}"` });
      }
      checkLength(ex, set.level, mPath);
    }
  }

  if (set.mnemonic) checkLangs(set.mnemonic, `${path} mnemonic`);

  const validTypes = new Set(['gap', 'reverse', 'listening']);
  (set.drills ?? []).forEach((d, i) => {
    const dPath = `${path} drill[${i}]`;
    if (!validTypes.has(d.type)) p1.push({ path: dPath, issue: `unknown drill type "${d.type}"` });
    if (!memberWords.has(removeAccents(normalize(d.correct ?? '')))) {
      p1.push({ path: dPath, issue: `correct "${d.correct}" is not one of this set's members` });
    }
    if (d.type === 'gap') {
      if (!d.sentence?.includes('___')) p1.push({ path: dPath, issue: 'gap drill sentence has no "___" blank' });
      else {
        for (const tok of tokenize(d.sentence.replace('___', ''))) {
          if (!tokenKnown(tok, taughtSet, extra)) p1.push({ path: dPath, issue: `untaught/unglossed Spanish word: "${tok}"` });
        }
        checkLength(d.sentence, set.level, dPath);
      }
    } else if (d.type === 'listening') {
      if (!d.sentence) p1.push({ path: dPath, issue: 'listening drill needs a sentence' });
      else {
        for (const tok of tokenize(d.sentence)) {
          if (!tokenKnown(tok, taughtSet, extra)) p1.push({ path: dPath, issue: `untaught/unglossed Spanish word: "${tok}"` });
        }
        checkLength(d.sentence, set.level, dPath);
      }
    }
  });
}

// ---------------------------------------------------------------------------
// story (data/games/stories/<lang>/<id>.json), GAMES.md 4.5
// ---------------------------------------------------------------------------

const STORY_TRACKS = new Set(['cdmx', 'crime', 'scifi']);

function auditStory(story, filePath, seenIds) {
  const path = `stories/${filePath}`;
  if (!story.id) p1.push({ path, issue: 'missing story id' });
  if (seenIds.has(story.id)) p2.push({ path, issue: `duplicate story id "${story.id}"` });
  seenIds.add(story.id);
  if (!LEVELS.includes(story.level)) p1.push({ path, issue: `missing/unknown level: ${story.level}` });
  if (!STORY_TRACKS.has(story.track)) p1.push({ path, issue: `missing/unknown track: ${story.track}` });
  checkLangs(story.title, `${path} title`);
  if (!story.cover) p1.push({ path, issue: 'missing cover emoji' });
  if (!Array.isArray(story.scenes) || story.scenes.length < 1) p1.push({ path, issue: 'needs >=1 scene' });

  const taughtSet = cumulativeTaught(story.level ?? 'C1');
  const seenSceneIds = new Set();

  // A newWords gloss holds for the REST of the story once introduced (the
  // screen passes the whole story's merged overrides to every scene's
  // GlossText, same reasoning as a topic-wide `glossary` elsewhere in this
  // script), not just the scene that first defines it, so the audit's
  // "known" set accumulates across scenes instead of resetting per scene.
  const extra = glossaryTokenSet(story.scenes?.flatMap((sc) => sc.newWords ?? []));

  for (const scene of story.scenes ?? []) {
    const scenePath = `${path} scene ${scene.id ?? '?'}`;
    if (!scene.id) p1.push({ path: scenePath, issue: 'missing scene id' });
    if (seenSceneIds.has(scene.id)) p2.push({ path: scenePath, issue: `duplicate scene id "${scene.id}"` });
    seenSceneIds.add(scene.id);

    const text = Object.values(scene.text ?? {}).join(' ');
    if (!text.trim()) {
      p1.push({ path: scenePath, issue: 'missing scene text' });
      continue;
    }
    checkLangs(scene.translation, `${scenePath} translation`);

    for (const nw of scene.newWords ?? []) {
      // Leniency matches myth's `gloss` field (not full checkLangs'd there
      // either): a native-language gloss for a word OUTSIDE the target-
      // language corpus doesn't need a same-language "translation" of
      // itself, just a real word and at least one native rendering.
      if (!nw.word) p1.push({ path: scenePath, issue: 'newWords entry missing word' });
      if (!nw.gloss || Object.keys(nw.gloss).length === 0) {
        p1.push({ path: scenePath, issue: `newWords[${nw.word}] missing gloss` });
      }
    }
    for (const tok of tokenize(text)) {
      if (!tokenKnown(tok, taughtSet, extra)) p1.push({ path: scenePath, issue: `untaught/unglossed Spanish word: "${tok}"` });
    }
    checkLength(text, story.level, scenePath);

    if (scene.question) {
      checkLangs(scene.question.prompt, `${scenePath} question prompt`);
      const opts = scene.question.options ?? [];
      if (opts.length < 2) p1.push({ path: scenePath, issue: 'question needs >=2 options' });
      if (!opts.some((o) => o.correct)) p1.push({ path: scenePath, issue: 'question has no correct option' });
      for (const opt of opts) {
        const textEntry = Object.entries(opt).find(([k]) => k !== 'correct');
        const optText = textEntry?.[1];
        if (typeof optText !== 'string' || !optText.trim()) {
          p1.push({ path: scenePath, issue: 'question option missing text' });
          continue;
        }
        for (const tok of tokenize(optText)) {
          if (!tokenKnown(tok, taughtSet, extra)) {
            p1.push({ path: scenePath, issue: `untaught/unglossed Spanish word in question option: "${tok}"` });
          }
        }
      }
    }
  }
}

function runStories() {
  const base = join(ROOT, 'data/games/stories');
  if (!existsSync(base)) return;
  const seenIds = new Set();
  for (const lang of readdirSync(base)) {
    const dir = join(base, lang);
    for (const file of jsonFilesIn(dir)) {
      const story = JSON.parse(readFileSync(join(dir, file), 'utf8'));
      auditStory(story, `${lang}/${file}`, seenIds);
    }
  }
}

// ---------------------------------------------------------------------------
// chat (data/games/chats/<lang>/<id>.json), GAMES.md 4.6
// ---------------------------------------------------------------------------

const CHAT_IF_PATTERN = /^checklist(>=|<=|>|<|==)\d+$|^default$/;

function auditChat(chat, filePath, seenIds) {
  const path = `chats/${filePath}`;
  const lang = filePath.split('/')[0];
  if (!chat.id) p1.push({ path, issue: 'missing chat id' });
  if (seenIds.has(chat.id)) p2.push({ path, issue: `duplicate chat id "${chat.id}"` });
  seenIds.add(chat.id);
  if (!LEVELS.includes(chat.level)) p1.push({ path, issue: `missing/unknown level: ${chat.level}` });
  checkLangs(chat.title, `${path} title`);

  const taughtSet = cumulativeTaught(chat.level ?? 'C1');
  const extra = glossaryTokenSet(chat.glossary);

  const setupIds = new Set();
  for (const q of chat.setup ?? []) {
    const qPath = `${path} setup[${q.id ?? '?'}]`;
    if (!q.id) p1.push({ path: qPath, issue: 'missing setup question id' });
    setupIds.add(q.id);
    checkLangs(q.prompt, `${qPath} prompt`);
    if (!Array.isArray(q.options) || q.options.length < 2) p1.push({ path: qPath, issue: 'needs >=2 options' });
    for (const opt of q.options ?? []) {
      if (!opt.value) p1.push({ path: qPath, issue: 'setup option missing value' });
      const text = opt.label?.[lang];
      if (typeof text !== 'string' || !text.trim()) {
        p1.push({ path: qPath, issue: `setup option "${opt.value}" missing '${lang}' label text` });
      } else {
        for (const tok of tokenize(text)) {
          if (!tokenKnown(tok, taughtSet, extra)) p1.push({ path: qPath, issue: `untaught/unglossed Spanish word in setup option: "${tok}"` });
        }
      }
    }
  }

  const nodeIds = new Set((chat.nodes ?? []).map((n) => n.id));
  const checklistIds = new Set((chat.checklist ?? []).map((c) => c.id));

  for (const node of chat.nodes ?? []) {
    const nPath = `${path} node ${node.id ?? '?'}`;
    if (!node.id) p1.push({ path: nPath, issue: 'missing node id' });
    const npcText = node.npc?.[lang];
    if (typeof npcText !== 'string' || !npcText.trim()) {
      p1.push({ path: nPath, issue: `missing '${lang}' npc text` });
    } else {
      for (const tok of tokenize(npcText)) {
        if (!tokenKnown(tok, taughtSet, extra)) p1.push({ path: nPath, issue: `untaught/unglossed Spanish word in npc: "${tok}"` });
      }
      checkLength(npcText, chat.level, nPath);
    }
    if (!Array.isArray(node.options) || node.options.length < 1) p1.push({ path: nPath, issue: 'needs >=1 option' });

    let nodeHasGood = false;
    for (const opt of node.options ?? []) {
      const oPath = `${nPath} option`;
      const text = opt[lang];
      if (typeof text !== 'string' || !text.trim()) {
        p1.push({ path: oPath, issue: `missing '${lang}' option text` });
      } else {
        for (const tok of tokenize(text)) {
          if (!tokenKnown(tok, taughtSet, extra)) p1.push({ path: oPath, issue: `untaught/unglossed Spanish word: "${tok}"` });
        }
        checkLength(text, chat.level, oPath);
      }
      if (opt.next && !nodeIds.has(opt.next)) p1.push({ path: oPath, issue: `dangling next -> "${opt.next}"` });
      if (opt.checklist && !checklistIds.has(opt.checklist)) p1.push({ path: oPath, issue: `unknown checklist ref "${opt.checklist}"` });
      if (opt.requires) {
        for (const k of Object.keys(opt.requires)) {
          if (!setupIds.has(k)) p2.push({ path: oPath, issue: `requires references unknown setup id "${k}"` });
        }
      }
      if (opt.good) nodeHasGood = true;
    }
    if ((node.options?.length ?? 0) >= 2 && !nodeHasGood) {
      p2.push({ path: nPath, issue: 'no option marked good:true at a real choice point' });
    }
  }

  for (const item of chat.checklist ?? []) {
    const iPath = `${path} checklist[${item.id ?? '?'}]`;
    if (!item.id) p1.push({ path: iPath, issue: 'missing checklist item id' });
    checkLangs(item.why, `${iPath} why`);
    if (!item.source?.label) p1.push({ path: iPath, issue: 'source missing a label (url stays optional, never fabricate one)' });
    checkLangs(item, `${iPath} phrasing`);
    const text = item[lang];
    if (typeof text === 'string') {
      for (const tok of tokenize(text)) {
        if (!tokenKnown(tok, taughtSet, extra)) p1.push({ path: iPath, issue: `untaught/unglossed Spanish word: "${tok}"` });
      }
    }
  }

  if (!Array.isArray(chat.endings) || chat.endings.length === 0) {
    p1.push({ path, issue: 'needs >=1 ending' });
  }
  for (const end of chat.endings ?? []) {
    const ePath = `${path} ending ${end.id ?? '?'}`;
    if (!end.id) p1.push({ path: ePath, issue: 'missing ending id' });
    checkLangs(end.title, `${ePath} title`);
    if (!CHAT_IF_PATTERN.test(end.if ?? '')) p1.push({ path: ePath, issue: `invalid if condition: "${end.if}"` });
  }
}

function runChats() {
  const base = join(ROOT, 'data/games/chats');
  if (!existsSync(base)) return;
  const seenIds = new Set();
  for (const lang of readdirSync(base)) {
    const dir = join(base, lang);
    for (const file of jsonFilesIn(dir)) {
      const chat = JSON.parse(readFileSync(join(dir, file), 'utf8'));
      auditChat(chat, `${lang}/${file}`, seenIds);
    }
  }
}

// ---------------------------------------------------------------------------
// myth (data/games/myths/<lang>/<track>.json), GAMES.md 4.13
// ---------------------------------------------------------------------------

const MYTH_TRACKS = new Set(['common', 'body', 'mexico', 'language']);
const MYTH_VERDICTS = new Set(['true', 'myth']);

function auditMythItem(item, filePath, seenIds) {
  const path = `myths/${filePath}#${item.id ?? '?'}`;
  if (!item.id) p1.push({ path, issue: 'missing item id' });
  if (seenIds.has(item.id)) p2.push({ path, issue: `duplicate myth item id "${item.id}"` });
  seenIds.add(item.id);
  if (!LEVELS.includes(item.level)) p1.push({ path, issue: `missing/unknown level: ${item.level}` });
  if (!MYTH_TRACKS.has(item.track)) p1.push({ path, issue: `missing/unknown track: ${item.track}` });
  if (!MYTH_VERDICTS.has(item.verdict)) p1.push({ path, issue: `missing/unknown verdict: ${item.verdict}` });
  if (!item.source?.label) p1.push({ path, issue: 'source missing a label (url stays optional, never fabricate one)' });

  const claimText = Object.values(item.claim ?? {}).join(' ');
  if (!claimText.trim()) {
    p1.push({ path, issue: 'missing claim text' });
    return;
  }
  checkLangs(item.explanation, `${path} explanation`);

  const taughtSet = cumulativeTaught(item.level ?? 'C1');
  const extra = glossaryTokenSet(item.gloss);
  for (const tok of tokenize(claimText)) {
    if (!tokenKnown(tok, taughtSet, extra)) {
      p1.push({ path, issue: `untaught/unglossed Spanish word: "${tok}"` });
    }
  }
  checkLength(claimText, item.level, path);
}

function runMyths() {
  const base = join(ROOT, 'data/games/myths');
  if (!existsSync(base)) return;
  const seenIds = new Set();
  for (const lang of readdirSync(base)) {
    const dir = join(base, lang);
    for (const file of jsonFilesIn(dir)) {
      const items = JSON.parse(readFileSync(join(dir, file), 'utf8'));
      for (const item of Array.isArray(items) ? items : [items]) {
        auditMythItem(item, `${lang}/${file}`, seenIds);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// ccat (data/games/ccat/<lang>/{antonyms,synonyms,word-problems}.json), GAMES.md 4.10
// ---------------------------------------------------------------------------

function auditCcatPair(item, filePath, kind, seenIds) {
  const path = `ccat/${filePath}#${item.id ?? '?'}`;
  if (!item.id) p1.push({ path, issue: 'missing item id' });
  if (seenIds.has(item.id)) p2.push({ path, issue: `duplicate ${kind} item id "${item.id}"` });
  seenIds.add(item.id);
  if (!LEVELS.includes(item.level)) p1.push({ path, issue: `missing/unknown level: ${item.level}` });
  if (!item.word) p1.push({ path, issue: 'missing word' });
  if (!item.correct) p1.push({ path, issue: 'missing correct' });
  if (!Array.isArray(item.distractors) || item.distractors.length < 3) {
    p1.push({ path, issue: 'needs >=3 distractors' });
  }

  const taughtSet = cumulativeTaught(item.level ?? 'C1');
  const allWords = [item.word, item.correct, ...(item.distractors ?? [])].filter(Boolean);
  const dupCheck = new Set(allWords.map((w) => removeAccents(normalize(w))));
  if (dupCheck.size !== allWords.length) p1.push({ path, issue: 'word/correct/distractors are not all distinct' });
  for (const w of allWords) {
    for (const tok of tokenize(w)) {
      if (!tokenKnown(tok, taughtSet, undefined)) p1.push({ path, issue: `untaught/unglossed Spanish word: "${tok}" (in "${w}")` });
    }
  }
}

function auditCcatWordProblem(item, filePath, seenIds) {
  const path = `ccat/${filePath}#${item.id ?? '?'}`;
  if (!item.id) p1.push({ path, issue: 'missing item id' });
  if (seenIds.has(item.id)) p2.push({ path, issue: `duplicate word-problem item id "${item.id}"` });
  seenIds.add(item.id);
  if (!LEVELS.includes(item.level)) p1.push({ path, issue: `missing/unknown level: ${item.level}` });
  checkLangs(item.prompt, `${path} prompt`);

  if (typeof item.a !== 'number' || typeof item.b !== 'number') {
    p1.push({ path, issue: 'a/b must be numbers' });
  }
  if (item.op !== '+' && item.op !== '-') {
    p1.push({ path, issue: `op must be "+" or "-", got "${item.op}"` });
  }
  const expected = item.op === '+' ? item.a + item.b : item.a - item.b;
  if (item.answer !== expected) {
    p1.push({ path, issue: `answer ${item.answer} does not match ${item.a} ${item.op} ${item.b} = ${expected}` });
  }
  if (!Array.isArray(item.distractors) || item.distractors.length < 3) {
    p1.push({ path, issue: 'needs >=3 numeric distractors' });
  } else if (item.distractors.some((d) => d === item.answer)) {
    p1.push({ path, issue: 'a distractor equals the correct answer' });
  }

  const esText = item.prompt?.es;
  if (typeof esText === 'string') {
    const taughtSet = cumulativeTaught(item.level ?? 'C1');
    for (const tok of tokenize(esText)) {
      if (!tokenKnown(tok, taughtSet, undefined)) p1.push({ path, issue: `untaught/unglossed Spanish word in prompt.es: "${tok}"` });
    }
    checkLength(esText, item.level, path);
  }
}

function runCcat() {
  const base = join(ROOT, 'data/games/ccat');
  if (!existsSync(base)) return;
  for (const lang of readdirSync(base)) {
    const dir = join(base, lang);
    const seenAntonymIds = new Set();
    for (const file of jsonFilesIn(dir).filter((f) => f === 'antonyms.json')) {
      const items = JSON.parse(readFileSync(join(dir, file), 'utf8'));
      for (const item of items) auditCcatPair(item, `${lang}/${file}`, 'antonym', seenAntonymIds);
    }
    const seenSynonymIds = new Set();
    for (const file of jsonFilesIn(dir).filter((f) => f === 'synonyms.json')) {
      const items = JSON.parse(readFileSync(join(dir, file), 'utf8'));
      for (const item of items) auditCcatPair(item, `${lang}/${file}`, 'synonym', seenSynonymIds);
    }
    const seenWordProblemIds = new Set();
    for (const file of jsonFilesIn(dir).filter((f) => f === 'word-problems.json')) {
      const items = JSON.parse(readFileSync(join(dir, file), 'utf8'));
      for (const item of items) auditCcatWordProblem(item, `${lang}/${file}`, seenWordProblemIds);
    }
  }
}

// ---------------------------------------------------------------------------
// Directory walkers
// ---------------------------------------------------------------------------

function jsonFilesIn(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => f.endsWith('.json'));
}

function runGrammar() {
  const base = join(ROOT, 'data/games/grammar');
  if (!existsSync(base)) return;
  for (const lang of readdirSync(base)) {
    const dir = join(base, lang);
    for (const file of jsonFilesIn(dir)) {
      const topic = JSON.parse(readFileSync(join(dir, file), 'utf8'));
      auditGrammarTopic(topic, `${lang}/${file}`);
    }
  }
}

function runConfusables() {
  const base = join(ROOT, 'data/games/confusables');
  if (!existsSync(base)) return;
  const seenSetIds = new Set();
  for (const lang of readdirSync(base)) {
    const dir = join(base, lang);
    for (const file of jsonFilesIn(dir)) {
      const set = JSON.parse(readFileSync(join(dir, file), 'utf8'));
      auditConfusablesSet(set, `${lang}/${file}`, seenSetIds);
    }
  }
}

// ---------------------------------------------------------------------------
// talk (data/games/talk/<lang>/<macro>-<level>.json), Átbeszélő fül
// ---------------------------------------------------------------------------
//
// Egy fájl = egy cella a makró×szint rácsban, benne a cella sztorija és
// párbeszéde. A tartalom ugyanaz a StoryData / ChatData alak, mint a Game
// fülön, ezért ugyanaz a két ellenőrző fut rá: a korpusz-fegyelem (csak
// tanult vagy glosszázott szó) az Átbeszélőben is kötelező.

const TALK_LEVELS = new Set(['A1', 'A2', 'B1', 'B2', 'C1']);

function runTalk() {
  const base = join(ROOT, 'data/games/talk');
  if (!existsSync(base)) return;
  const seenStoryIds = new Set();
  const seenChatIds = new Set();
  const seenCells = new Set();
  for (const lang of readdirSync(base)) {
    const dir = join(base, lang);
    for (const file of jsonFilesIn(dir)) {
      const path = `talk/${lang}/${file}`;
      const pack = JSON.parse(readFileSync(join(dir, file), 'utf8'));
      if (typeof pack.macro !== 'number') p1.push({ path, issue: 'missing macro number' });
      if (!TALK_LEVELS.has(pack.level)) p1.push({ path, issue: `missing/unknown level: ${pack.level}` });
      const cell = `${lang}|${pack.macro}|${pack.level}`;
      if (seenCells.has(cell)) p1.push({ path, issue: `duplicate macro+level cell "${cell}"` });
      seenCells.add(cell);
      if (file !== `${pack.macro}-${pack.level}.json`) {
        p2.push({ path, issue: `file name should be ${pack.macro}-${pack.level}.json` });
      }
      if (!pack.story) {
        p1.push({ path, issue: 'missing story' });
      } else {
        if (pack.story.level !== pack.level) p1.push({ path, issue: 'story level differs from pack level' });
        auditStory(pack.story, `${lang}/${file}`, seenStoryIds);
      }
      if (!pack.chat) {
        p1.push({ path, issue: 'missing chat' });
      } else {
        if (pack.chat.level !== pack.level) p1.push({ path, issue: 'chat level differs from pack level' });
        auditChat(pack.chat, `${lang}/${file}`, seenChatIds);
      }
    }
  }
}

runGrammar();
runConfusables();
runMyths();
runStories();
runChats();
runCcat();
runTalk();

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

console.log(`audit-games: ${p1.length} P1, ${p2.length} P2`);
if (p1.length > 0) {
  console.log('\n--- P1 (must fix) ---');
  for (const issue of p1) console.log(`  [${issue.path}] ${issue.issue}`);
}
if (p2.length > 0) {
  console.log('\n--- P2 (reported) ---');
  for (const issue of p2) console.log(`  [${issue.path}] ${issue.issue}`);
}

process.exit(p1.length > 0 ? 1 : 0);
