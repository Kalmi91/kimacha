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

const GRAMMAR_WORD_CLASSES = ['noun', 'verb', 'adjective', 'adverb', 'article', 'pronoun', 'preposition'];

// TASK-9: object/reflexive pronouns and the bare negator are exempt from the
// self-revealing check below, see the comment at its call site.
const OBJECT_PRONOUN_WORDS = new Set(['me', 'te', 'se', 'nos', 'os', 'le', 'les', 'lo', 'los', 'la', 'las', 'no']);

// A jelölős mondat szavai, ugyanaz a vágás, mint lib/games/grammarMark.ts-ben.
function markWords(sentence) {
  return (sentence.match(/[\p{L}\p{M}\d]+(?:['’-][\p{L}\p{M}\d]+)*/gu) ?? []).map((w) => normalize(w));
}

// ---------------------------------------------------------------------------
// LECKE-SEMA 4: LessonV2 (schema 2) body/speak/match/form ellenőrzés. A
// régi (rule/more, gap/mark-only) leckéknél ez a szakasz nem fut; azok
// pontosan úgy futnak tovább, ahogy eddig.
// ---------------------------------------------------------------------------

function tableIdsOf(topic) {
  const ids = new Set();
  for (const block of topic.body ?? []) {
    if (block?.kind === 'table' && block.id) ids.add(block.id);
  }
  return ids;
}

function auditExamplePairs(examples, path, minCount) {
  if (!Array.isArray(examples) || examples.length < minCount) {
    p1.push({ path, issue: `needs >=${minCount} examples` });
    return;
  }
  for (const ex of examples) {
    if (!ex?.es) p1.push({ path, issue: 'example missing es' });
    checkLangs(ex?.tr, `${path} example tr`);
  }
}

function auditLessonBody(topic, path) {
  if (!Array.isArray(topic.body) || topic.body.length === 0) {
    p1.push({ path, issue: 'V2 lesson missing body blocks' });
    return;
  }
  const seenTableIds = new Set();
  topic.body.forEach((block, i) => {
    const blockPath = `${path} body[${i}:${block?.kind ?? '?'}]`;
    switch (block?.kind) {
      case 'text':
      case 'tip':
        checkLangs(block.text, `${blockPath} text`);
        break;
      case 'list':
      case 'usage': {
        const points = block.kind === 'list' ? block.items : block.points;
        if (!Array.isArray(points) || points.length === 0) {
          p1.push({ path: blockPath, issue: `${block.kind} block has no points` });
          break;
        }
        points.forEach((point, pi) => {
          checkLangs(point?.text, `${blockPath} point[${pi}] text`);
          auditExamplePairs(point?.examples, `${blockPath} point[${pi}]`, 2);
        });
        break;
      }
      case 'examples':
        auditExamplePairs(block.examples, blockPath, 1);
        break;
      case 'table':
        if (!block.id) p1.push({ path: blockPath, issue: 'table missing id' });
        else if (seenTableIds.has(block.id)) p1.push({ path: blockPath, issue: `duplicate table id "${block.id}"` });
        seenTableIds.add(block.id);
        checkLangs(block.title, `${blockPath} title`);
        if (!Array.isArray(block.header) || block.header.length === 0) {
          p1.push({ path: blockPath, issue: 'table missing header' });
        } else {
          block.header.forEach((cell, ci) => checkLangs(cell, `${blockPath} header[${ci}]`));
        }
        if (!Array.isArray(block.rows) || block.rows.length < 1) {
          p1.push({ path: blockPath, issue: 'table needs >=1 row' });
        }
        // FB378: enPrompt, when present, is rows x verb-columns (rows minus
        // the person column), one English sentence per cell.
        if (block.enPrompt !== undefined) {
          const verbCols = (block.header?.length ?? 1) - 1;
          if (!Array.isArray(block.enPrompt) || block.enPrompt.length !== (block.rows?.length ?? 0)) {
            p1.push({ path: blockPath, issue: `enPrompt needs ${block.rows?.length ?? 0} rows, has ${block.enPrompt?.length ?? 0}` });
          } else {
            block.enPrompt.forEach((row, ri) => {
              if (!Array.isArray(row) || row.length !== verbCols) {
                p1.push({ path: `${blockPath} enPrompt[${ri}]`, issue: `needs ${verbCols} cells, has ${row?.length ?? 0}` });
              } else {
                row.forEach((cell, ci) => {
                  if (typeof cell !== 'string' || !cell.trim()) {
                    p1.push({ path: `${blockPath} enPrompt[${ri}][${ci}]`, issue: 'empty enPrompt cell' });
                  }
                });
              }
            });
          }
        }
        break;
      case 'contrast':
        if (!Array.isArray(block.pairs) || block.pairs.length === 0) {
          p1.push({ path: blockPath, issue: 'contrast block has no pairs' });
          break;
        }
        block.pairs.forEach((pair, pi) => {
          if (!pair?.a || !pair?.b) p1.push({ path: `${blockPath} pair[${pi}]`, issue: 'contrast pair missing a/b' });
          checkLangs(pair?.note, `${blockPath} pair[${pi}] note`);
          auditExamplePairs(pair?.examples, `${blockPath} pair[${pi}]`, 2);
        });
        break;
      default:
        p1.push({ path: blockPath, issue: `unknown body block kind "${block?.kind}"` });
    }
  });
}

function auditLessonSpeak(topic, path) {
  checkLangs(topic.speak, `${path} speak`);
  for (const lang of LANGS) {
    const text = topic.speak?.[lang];
    if (typeof text !== 'string') continue;
    const speakPath = `${path} speak[${lang}]`;
    const opens = (text.match(/«/g) ?? []).length;
    const closes = (text.match(/»/g) ?? []).length;
    if (opens === 0) p1.push({ path: speakPath, issue: 'no «...» marked segment (spec: at least one Spanish section)' });
    if (opens !== closes) p1.push({ path: speakPath, issue: 'unbalanced «» markers' });
    if (/[0-9]/.test(text)) p1.push({ path: speakPath, issue: 'digits not allowed in speak text' });
    if (/[()]/.test(text)) p1.push({ path: speakPath, issue: 'parentheses not allowed in speak text' });
  }
}

function auditMatchItem(item, itemPath) {
  const pairs = item.pairs;
  if (!Array.isArray(pairs) || pairs.length < 5 || pairs.length > 6) {
    p1.push({ path: itemPath, issue: `match item needs 5-6 pairs, has ${pairs?.length ?? 0}` });
    return;
  }
  const esSeen = new Set();
  const enSeen = new Set();
  for (const pair of pairs) {
    if (!pair?.es) p1.push({ path: itemPath, issue: 'match pair missing es' });
    if (!pair?.en) p1.push({ path: itemPath, issue: 'match pair missing en' });
    if (pair?.es) {
      if (esSeen.has(pair.es)) p1.push({ path: itemPath, issue: `duplicate match es "${pair.es}"` });
      esSeen.add(pair.es);
    }
    if (pair?.en) {
      if (enSeen.has(pair.en)) p1.push({ path: itemPath, issue: `duplicate match en "${pair.en}"` });
      enSeen.add(pair.en);
    }
    if (pair?.es && pair?.en && pair.es.toLowerCase() === pair.en.toLowerCase()) {
      p1.push({ path: itemPath, issue: `match pair es and en are identical: "${pair.es}"` });
    }
  }
}

// TASK-9 (12. lépés): a pilot 3-tagú összevont személy ("él/ella/usted",
// "ellos/ellas/ustedes") mindig szóköz nélkül áll a "/" körül; egy 2-tagú,
// nemek szerint szétválasztott címke (pronombres-od "él / usted (masculino)")
// szándékosan más alak, azt ez a minta nem érinti.
const FORM_PILOT_TRIO_TYPO = /\bél\s*\/\s*ella\s*\/\s*usted\b|\bellos\s*\/\s*ellas\s*\/\s*ustedes\b/i;

function auditFormItem(item, itemPath, topic, tableIds) {
  if (!item.person) p1.push({ path: itemPath, issue: 'form item missing person' });
  else if (FORM_PILOT_TRIO_TYPO.test(item.person) && !['él/ella/usted', 'ellos/ellas/ustedes'].includes(item.person)) {
    p1.push({ path: itemPath, issue: `form item person "${item.person}" must use the pilot label with no spaces around "/"` });
  }
  if (!item.verb) p1.push({ path: itemPath, issue: 'form item missing verb' });
  if (!item.answer) p1.push({ path: itemPath, issue: 'form item missing answer' });
  if (!item.table || !tableIds.has(item.table)) {
    p1.push({ path: itemPath, issue: `form item references unknown table "${item.table}"` });
    return;
  }
  const table = topic.body.find((b) => b.kind === 'table' && b.id === item.table);
  // Több igés tábla (fejléc: Személy | hablar | comer | vivir): az ige oszlopát a
  // fejléc `es` cellája adja; egy igés táblánál (Személy | ser) a második oszlop.
  const verbCol = (table?.header ?? []).findIndex((h, ci) => ci > 0 && h?.es === item.verb);
  const col = verbCol > 0 ? verbCol : 1;
  const row = table?.rows?.find((r) => r[0] === item.person);
  if (!row) {
    p1.push({ path: itemPath, issue: `form item person "${item.person}" not found in table "${item.table}"` });
  } else if (row[col] !== item.answer) {
    p1.push({ path: itemPath, issue: `form item answer "${item.answer}" does not match table row form "${row[col]}"` });
  }
}

// TASK-8 (D4, FB288): "miért ez a mondat", correctIndex érvényes, pontosan 3
// opció, opció-szövegek egyediek (hu-n), minden opció mind a 4 nyelven, a nem
// jó opciókon van `wrong` mind a 4 nyelven, `es` nem üres és `tr.es` === `es`.
function auditWhyItem(item, itemPath) {
  const options = Array.isArray(item.options) ? item.options : [];
  if (options.length !== 3) {
    p1.push({ path: itemPath, issue: `why item needs exactly 3 options, has ${options.length}` });
  }
  if (typeof item.correctIndex !== 'number' || item.correctIndex < 0 || item.correctIndex >= options.length) {
    p1.push({ path: itemPath, issue: `why item correctIndex ${item.correctIndex} out of range` });
  }
  if (!item.es) p1.push({ path: itemPath, issue: 'why item missing es' });
  if (item.es && item.tr?.es !== item.es) p1.push({ path: itemPath, issue: 'why item tr.es must equal es' });
  // FB376: ha van `focus`, pontosan úgy kell szerepelnie `es`-ben, ahogy áll.
  if (item.focus && item.es && !item.es.includes(item.focus)) {
    p1.push({ path: itemPath, issue: `why item focus "${item.focus}" not found in es "${item.es}"` });
  }

  const huSeen = new Set();
  options.forEach((opt, i) => {
    checkLangs(opt?.text, `${itemPath} option ${i} text`);
    if (opt?.text?.hu) {
      if (huSeen.has(opt.text.hu)) p1.push({ path: itemPath, issue: `duplicate why option text (hu) "${opt.text.hu}"` });
      huSeen.add(opt.text.hu);
    }
    if (i !== item.correctIndex) {
      if (!opt?.wrong) {
        p1.push({ path: itemPath, issue: `why option ${i} missing wrong explanation` });
      } else {
        checkLangs(opt.wrong, `${itemPath} option ${i} wrong`);
      }
    }
  });
}

// NY1 (NYELVTAN.md "Adatformátum"): a lessonTypes.ts TENSE_IDS másolata, mert
// ez a script nem tudja importálni a TS fájlt.
const TENSE_IDS = [
  'presente',
  'indefinido',
  'imperfecto',
  'perfecto',
  'futuro-simple',
  'ir-a',
  'condicional',
  'subjuntivo-presente',
];

// Kártya-id (string) -> szint, a hat words-fájlból egyszer felépítve, a
// transform item `wordIds` szint-ellenőrzéséhez.
const wordLevelById = new Map();
for (const lvl of LEVELS) {
  for (const card of loadLevelWords(lvl)) {
    wordLevelById.set(String(card.id), lvl);
  }
}

function auditTenseField(tense, itemPath) {
  if (!tense || typeof tense !== 'object') {
    p1.push({ path: itemPath, issue: 'missing tense field' });
    return;
  }
  if (!TENSE_IDS.includes(tense.from)) p1.push({ path: itemPath, issue: `unknown tense.from "${tense.from}"` });
  if (!TENSE_IDS.includes(tense.to)) p1.push({ path: itemPath, issue: `unknown tense.to "${tense.to}"` });
  if (tense.from === tense.to) p1.push({ path: itemPath, issue: 'tense.from must differ from tense.to' });
}

// NY1: az igeidő-drill mondat-átírás item-fajtája. `wordIds` a mondat
// kártyáira mutat (ez hajtja az NY2 unlockot), mindegyiknek léteznie kell és
// a lecke szintjénél nem lehet magasabb szintű.
function auditTransformItem(item, itemPath, topic) {
  auditTenseField(item.tense, itemPath);
  checkLangs(item.prompt, `${itemPath} prompt`);
  if (!item.answer) p1.push({ path: itemPath, issue: 'transform item missing answer' });
  if (item.prompt?.es && item.answer && item.prompt.es === item.answer) {
    p1.push({ path: itemPath, issue: 'transform prompt.es must differ from answer' });
  }
  if (item.accept !== undefined) {
    if (!Array.isArray(item.accept)) {
      p1.push({ path: itemPath, issue: 'transform accept must be an array' });
    } else {
      for (const alt of item.accept) {
        if (alt === item.answer) p1.push({ path: itemPath, issue: `transform accept entry equals answer: "${alt}"` });
        if (item.prompt?.es && alt === item.prompt.es) {
          p1.push({ path: itemPath, issue: `transform accept entry equals prompt.es: "${alt}"` });
        }
      }
    }
  }
  if (!Array.isArray(item.wordIds) || item.wordIds.length === 0) {
    p1.push({ path: itemPath, issue: 'transform wordIds must be a non-empty array' });
  } else {
    const levelIdx = LEVELS.indexOf(topic.level);
    for (const id of item.wordIds) {
      const wordLevel = wordLevelById.get(String(id));
      if (wordLevel === undefined) {
        p1.push({ path: itemPath, issue: `wordIds references unknown card id "${id}"` });
      } else if (levelIdx !== -1 && LEVELS.indexOf(wordLevel) > levelIdx) {
        p1.push({
          path: itemPath,
          issue: `wordIds card "${id}" is level ${wordLevel}, above the lesson's level ${topic.level}`,
        });
      }
    }
  }
  checkLangs(item.why, `${itemPath} why`);
}

function auditGrammarTopic(topic, filePath) {
  const path = `grammar/${filePath}`;
  if (!topic.topic) p1.push({ path, issue: 'missing topic id' });
  if (!LEVELS.includes(topic.level)) p1.push({ path, issue: `missing/unknown level: ${topic.level}` });

  checkLangs(topic.title, `${path} title`);

  const isV2 = topic.schema === 2;
  if (isV2) {
    if ('rule' in topic) p1.push({ path, issue: 'V2 lesson (schema 2) must not have a rule field' });
    if ('more' in topic) p1.push({ path, issue: 'V2 lesson (schema 2) must not have a more field' });
    auditLessonBody(topic, path);
    auditLessonSpeak(topic, path);
  } else {
    checkLangs(topic.rule, `${path} rule`);
    if (topic.more) checkLangs(topic.more, `${path} more`);
  }
  const tableIds = isV2 ? tableIdsOf(topic) : null;

  const taughtSet = cumulativeTaught(topic.level ?? 'C1');
  const extra = glossaryTokenSet(topic.glossary);

  const seenIds = new Set();
  for (const item of topic.items ?? []) {
    const itemPath = `${path} item ${item.id ?? '?'}`;
    if (seenIds.has(item.id)) p2.push({ path: itemPath, issue: `duplicate item id "${item.id}"` });
    seenIds.add(item.id);

    // NY1: a `tense` mező choice/form/why itemen is megjelenhet (a jelvényhez);
    // ahol van, ugyanaz a from/to ellenőrzés fut, mint a transform itemen.
    if (item.kind !== 'transform' && item.tense) auditTenseField(item.tense, itemPath);

    // LECKE-SEMA 2: match/form saját ellenőrzőt kap, a gap/mark-os ág alatta
    // változatlan (a "mint eddig" spec-ígéret).
    if (item.kind === 'match') {
      auditMatchItem(item, itemPath);
      continue;
    }
    if (item.kind === 'form') {
      auditFormItem(item, itemPath, topic, tableIds ?? new Set());
      continue;
    }
    if (item.kind === 'why') {
      auditWhyItem(item, itemPath);
      continue;
    }
    if (item.kind === 'transform') {
      auditTransformItem(item, itemPath, topic);
      continue;
    }

    // FB219: a jelölős tétel kész mondatot ad, és a mondat egyik szavára kell
    // koppintani, tehát se lyuk, se opció-lista nincs benne.
    const isMark = item.kind === 'mark';
    if (isMark) {
      if (item.sentence?.includes('___')) p1.push({ path: itemPath, issue: 'mark item must not have a "___" blank' });
      if (!GRAMMAR_WORD_CLASSES.includes(item.target)) {
        p1.push({ path: itemPath, issue: `unknown mark target "${item.target}"` });
      }
      const words = markWords(item.sentence ?? '');
      const occurrences = words.filter((w) => w === normalize(item.answer ?? ''));
      const wanted = (item.answerIndex ?? 0) + 1;
      if (occurrences.length < wanted) {
        p1.push({ path: itemPath, issue: `mark answer "${item.answer}" not found in the sentence` });
      }
    } else {
      if (!item.sentence?.trim()) p1.push({ path: itemPath, issue: 'empty sentence' });
      else if (!item.sentence.includes('___')) p1.push({ path: itemPath, issue: 'sentence has no "___" blank' });
      if (!Array.isArray(item.options) || item.options.length < 2) p1.push({ path: itemPath, issue: 'needs >=2 options' });
      if (typeof item.correct !== 'number' || item.correct < 0 || item.correct >= (item.options?.length ?? 0)) {
        p1.push({ path: itemPath, issue: `correct index ${item.correct} out of range` });
      }
      if (Array.isArray(item.options)) {
        const seenOpts = new Set();
        for (const opt of item.options) {
          if (seenOpts.has(opt)) p1.push({ path: itemPath, issue: `duplicate option "${opt}"` });
          seenOpts.add(opt);
        }
        // TASK-9 (12. lépés, 2.3): önmagát eláruló tétel, ha a jó válasz
        // szövege szó szerint (egész szóként, nem más szó részeként, pl.
        // "nos" a "nosotros"-ban) ott áll a mondatban a lyukon kívül. A
        // tárgy-/részeshatározó névmások (lo/la/los/las/le/les/me/te/se/
        // nos/os) és a puszta "no" kimaradnak: ezek a determinánsokkal
        // alakilag egyeznek (pl. pronombres-od "¿La mochila? La llevo
        // yo."), vagy a negáció lecke tárgya maga ("No, no como carne."),
        // ez a lecke szándékos mintája, nem hiba.
        const correctText = item.options[item.correct];
        const correctNorm = normalize(correctText ?? '');
        const restOfSentence = (item.sentence ?? '').replace('___', '');
        if (correctText && !OBJECT_PRONOUN_WORDS.has(correctNorm) && tokenize(restOfSentence).includes(correctNorm)) {
          p1.push({ path: itemPath, issue: `self-revealing: correct answer "${correctText}" appears literally in the prompt` });
        }
      }
    }

    checkLangs(item.why, `${itemPath} why`);
    for (const opt of isMark ? [] : item.options ?? []) {
      if (opt === item.options[item.correct]) continue;
      if (!item.wrong?.[opt]) {
        p1.push({ path: itemPath, issue: `missing wrong[] explanation for option "${opt}"` });
      } else {
        checkLangs(item.wrong[opt], `${itemPath} wrong[${opt}]`);
      }
    }
    // A jelölős tétel `wrong` kulcsai a mondat szavai: ami ott van, annak négy
    // nyelven kell szólnia, de nem kötelező minden szóra írni (a képernyőnek van
    // általános tartalék-szövege).
    for (const key of isMark ? Object.keys(item.wrong ?? {}) : []) {
      checkLangs(item.wrong[key], `${itemPath} wrong[${key}]`);
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

runGrammar();

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
