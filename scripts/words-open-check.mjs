// Kapu a szabad szókészlethez (data/words-open/{a1,a2,b1,b2}.json), PLAN-words-open.md R1-R8.
// Futtatás: node scripts/words-open-check.mjs [--level a1|a2|b1|b2] [--list-only]
//   --list-only  csak R1-R2 és R11-R14 (a lista kész, a mondatok még nincsenek)
//   --level X    az R3-R10 csak az X szint kártyáin fut (a keresésekhez mindig mind a 600 kártya betöltődik)
//   --to N       az R3-R10 csak az order <= N kártyákon fut (félkész szint ellenőrzése)
// Szabályonként kiírja a hibák számát és az első 5 példát, hibánál exit 1.
// PLAN-tobbjelentes.md 2. lépés: R1/R2 lazítás (több jelentés, 600 fölötti kártyák), R11-R14 (scripts/multi-meaning-rules.mjs).
//
// R6 (szint-nyelvtan): a lib/grammar/tenseGate.ts NEM használható újra, mert az alak-térképét a régi
// data/words korpusz igéiből építi (a szabad készlet így tőle függene) és TS-alias-importot használ.
// Helyette: a lib/games/conjugate.ts (tiszta kód, adat nélkül) ragozó táblái + saját szabályos
// alak-generálás a kizárt (tőhangváltó) igékre; a mondat igéit a sentence_lemmas alapján sorolja be.
// Amit a script NEM lát: a táblákban és a generálásban nem szereplő rendhagyó alakok (ismeretlen alak
// átengedve), a tú-felszólító (megegyezik a jelen 3. személlyel), a mondat természetessége.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkMultiMeaning } from './multi-meaning-rules.mjs';
import { importTs } from './lib/importTs.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.join(ROOT, 'data', 'words-open');
const LEVELS = ['a1', 'a2', 'b1', 'b2'];
const LEVEL_RANK = { A1: 1, A2: 2, B1: 3, B2: 4 };
const KEYS = [
  'order', 'level', 'pos', 'lemma', 'es', 'hu', 'en', 'de',
  'sentence_es', 'sentence_hu', 'sentence_en', 'sentence_de', 'sentence_lemmas',
];
const POS = new Set(['noun', 'verb', 'adj', 'adv', 'pron', 'det', 'prep', 'conj', 'num', 'interj']);
const MAX_TOKENS = { A1: 8, A2: 10, B1: 12, B2: 14 };
const EMPTY_SENTENCE_MAX_ORDER = 20;

// ---------------------------------------------------------------- argumentumok
const args = process.argv.slice(2);
const listOnly = args.includes('--list-only');
let onlyLevel = null;
const ti = args.indexOf('--to');
const toOrder = ti !== -1 ? Number(args[ti + 1]) : Infinity; // csak az order <= N kártyákra futnak az R3-R10 (részkészlet-ellenőrzés)
const li = args.indexOf('--level');
if (li !== -1) {
  onlyLevel = (args[li + 1] || '').toLowerCase();
  if (!LEVELS.includes(onlyLevel)) {
    console.error('--level értéke a1|a2|b1|b2 lehet');
    process.exit(2);
  }
}

// ---------------------------------------------------------------- szabály-gyűjtő
const RULES = {};
const R10_STATS = [];
function fail(rule, msg) {
  (RULES[rule] ||= []).push(msg);
}
const tag = (c) => `#${c.order} ${c.lemma}`;

// ---------------------------------------------------------------- betöltés
const cards = [];
const fileProblems = [];
for (const lv of LEVELS) {
  const file = path.join(DIR, `${lv}.json`);
  let arr;
  try {
    arr = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    fileProblems.push(`${lv}.json nem olvasható: ${String(e.message).slice(0, 80)}`);
    continue;
  }
  if (!Array.isArray(arr)) {
    fileProblems.push(`${lv}.json nem tömb`);
    continue;
  }
  arr.forEach((c, idx) => cards.push({ ...c, __file: lv, __idx: idx }));
}
fileProblems.forEach((m) => fail('R2', m));

// ---------------------------------------------------------------- R1 egyediség (a lemma+en és az es+en PÁR; egy lemma több jelentéssel több kártyán lehet)
function checkUnique(field) {
  const seen = new Map();
  for (const c of cards) {
    const v = c[field];
    if (typeof v !== 'string' || typeof c.en !== 'string') continue;
    const k = `${v}\u0000${c.en}`;
    if (seen.has(k)) fail('R1', `${field}+en "${v}" / "${c.en}" kétszer: #${seen.get(k)} és #${c.order}`);
    else seen.set(k, c.order);
  }
}
checkUnique('lemma');
checkUnique('es');

// ---------------------------------------------------------------- R2 darabszám, sáv, kulcsok
for (const lv of LEVELS) {
  const n = cards.filter((c) => c.__file === lv).length;
  if (!fileProblems.some((m) => m.startsWith(lv)) && n < 150) fail('R2', `${lv}.json ${n} kártya (kell: legalább 150)`);
}
// order egyedi és hézagmentes 1..N (a tömbbeli hely nem számít: a 601-től új kártya a testvére mellé kerül)
const sortedOrders = cards.map((c) => c.order).sort((a, b) => a - b);
for (let i = 0; i < sortedOrders.length; i++) {
  if (sortedOrders[i] !== i + 1) {
    fail('R2', `order hézag/ismétlődés: a rendezett lista ${i + 1}. helyén ${sortedOrders[i]} áll`);
    break;
  }
}
for (const c of cards) {
  if (!Number.isInteger(c.order)) {
    fail('R2', `${c.__file}.json[${c.__idx}] order nem egész`);
    continue;
  }
  // a szintet a fájl dönti el (a nyelvtanleckék szavai a lecke szintjére kerülnek, az order marad): a level mező = a fájl szintje
  if (c.level !== c.__file.toUpperCase()) fail('R2', `${tag(c)}: ${c.__file}.json fájlban ${c.level} szint`);
  const keys = Object.keys(c).filter((k) => !k.startsWith('__'));
  const wantKeys = keys.includes('hint_en') ? [...KEYS.slice(0, 8), 'hint_en', ...KEYS.slice(8)] : KEYS; // hint_en: opcionális 14. kulcs a de után
  if (keys.join(',') !== wantKeys.join(',')) fail('R2', `${tag(c)}: kulcsok/sorrend eltér: ${keys.join(',')}`);
  if (!POS.has(c.pos)) fail('R2', `${tag(c)}: pos "${c.pos}" érvénytelen`);
  for (const k of ['lemma', 'es', 'hu', 'en', 'de', 'sentence_es', 'sentence_hu', 'sentence_en', 'sentence_de']) {
    if (typeof c[k] !== 'string') fail('R2', `${tag(c)}: ${k} nem string`);
  }
  if (!Array.isArray(c.sentence_lemmas) || c.sentence_lemmas.some((x) => typeof x !== 'string')) {
    fail('R2', `${tag(c)}: sentence_lemmas nem string-tömb`);
  }
  if (typeof c.lemma === 'string') {
    if (!c.lemma || c.lemma !== c.lemma.toLowerCase() || /\s/.test(c.lemma)) fail('R2', `${tag(c)}: lemma nem csupasz kisbetűs szó`);
    // perjeles es-nél (S1) a fő alak, vagyis az első alternatíva felel meg a lemmának
    const esMain = typeof c.es === 'string' ? c.es.split(' / ')[0] : c.es;
    if (c.pos === 'noun') {
      if (esMain !== `el ${c.lemma}` && esMain !== `la ${c.lemma}` && esMain !== `los ${c.lemma}` && esMain !== `las ${c.lemma}`) {
        fail('R2', `${tag(c)}: főnév es-e névelős lemma kell legyen, most "${c.es}"`);
      }
    } else if (esMain !== c.lemma) fail('R2', `${tag(c)}: es "${c.es}" != lemma`);
  }
}

// ---------------------------------------------------------------- R11-R14 több jelentésű szavak (hint, perjeles válasz)
checkMultiMeaning({
  cards, qKey: 'en', aKey: 'es', hintKey: 'hint_en', articles: ['a', 'an', 'the'], ignore: ['to'], tag, fail,
});

// ---------------------------------------------------------------- R3-R9 (csak ha nem --list-only)
if (!listOnly) {
  // lemma -> kártyák (egy lemma több jelentéssel több kártyán lehet)
  const byLemma = new Map();
  for (const c of cards) if (typeof c.lemma === 'string') byLemma.set(c.lemma, [...(byLemma.get(c.lemma) || []), c]);
  const isVerb = (l) => byLemma.get(l)?.some((k) => k.pos === 'verb') ?? false;
  // „már tanult”: az alacsonyabb szintű fájlok minden kártyája + a saját fájl tömbjében a kártya előtti (és a kártya maga)
  const known = (k, c) => LEVEL_RANK[k.level] < LEVEL_RANK[c.level] || (k.level === c.level && k.__idx <= c.__idx);
  const target = cards.filter((c) => (!onlyLevel || c.__file === onlyLevel) && c.order <= toOrder);

  const tokenize = (s) =>
    s.toLowerCase().replace(/[¿?¡!.,;:()"«»…]/g, ' ').split(/\s+/).filter(Boolean);
  const strip = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');

  // ----- R5 rendhagyó-alak lista: csak valódi (token>lemma) párok, ékezettel, kisbetűvel
  const IRREG_SRC = {
    ser: 'soy eres es somos son sois fui fuiste fue fuimos fueron era eras éramos eran sea seas seamos sean sido fuera fueras fuéramos fueran fuese',
    ir: 'voy vas va vamos van vais fui fuiste fue fuimos fueron iba ibas íbamos iban vaya vayas vayamos vayan ido fuera fueras fuéramos fueran fuese',
    haber: 'he hube hubiste hubo hubimos hubieron hubiera hubieras hubiéramos hubieran hubiese',
    negar: 'niego niegas niega niegan',
    saber: 'sé supe supiste supo supimos supieron sepa sepas sepamos sepan supiera',
    poder: 'puedo puedes puede pueden pude pudiste pudo pudimos pudieron pueda puedas puedan pudiendo pudiera pudieras pudiéramos pudieran',
    decir: 'digo dices dice dicen dijo dije dijiste dijimos dijeron diga digas digamos digan dicho diciendo dijera',
    hacer: 'hice hiciste hizo hicimos hicieron hiciera hecho',
    dar: 'doy di diste dio dimos dieron dé des demos den diera',
    tener: 'tienes tiene tienen tuve tuviste tuvo tuvimos tuvieron tuviera tuviese',
    venir: 'vienes viene vienen vine viniste vino vinimos vinieron viniera viniendo',
    ver: 'vi visto vio viste vimos vieron viendo viera',
    poner: 'puse pusiste puso pusimos pusieron puesto pusiera',
    dormir: 'duermo duermes duerme duermen durmió durmieron durmiendo durmamos',
    volver: 'vuelvo vuelves vuelve vuelven vuelto volvió',
    pensar: 'pienso piensas piensa piensan',
    pedir: 'pido pides pide piden pidió pidieron pidiendo pida',
    perder: 'pierdo pierdes pierde pierden perdió',
    cerrar: 'cierro cierras cierra cierran',
    contar: 'cuento cuentas cuenta cuentan',
    costar: 'cuesta cuestan',
    sentir: 'siento sientes siente sienten sintió',
    sentar: 'siento sientas sienta sientan',
    seguir: 'sigo sigues sigue siguen siguió siguiendo',
    servir: 'sirvo sirves sirve sirven',
    morir: 'muero mueres muere mueren murió muerto',
    mostrar: 'muestro muestras muestra muestran',
    recordar: 'recuerdo recuerdas recuerda recuerdan',
    el: 'la las los',
    lo: 'la las los',
    y: 'e',
    o: 'u',
    yo: 'mí',
    tú: 'ti',
    bueno: 'mejor mejores',
    malo: 'peor peores',
    grande: 'mayor mayores',
    pequeño: 'menor menores',
  };
  const IRREG = new Set();
  for (const [lemma, forms] of Object.entries(IRREG_SRC)) {
    for (const f of forms.split(/\s+/)) IRREG.add(`${f}>${lemma}`);
  }
  const plausible = (token, lemma) => {
    if (IRREG.has(`${token}>${lemma}`)) return true;
    const a = strip(token);
    const b = strip(lemma);
    const n = Math.min(2, a.length, b.length);
    return a.slice(0, n) === b.slice(0, n);
  };

  // ----- R6 igeidő-besorolás: conjugate.ts táblái + saját szabályos generálás
  const { conjugate, TENSES } = await importTs(path.join(ROOT, 'lib', 'games', 'conjugate.ts'));

  const STRUCT_LEVEL = {
    presente: 1,
    perfecto: 2, indefinido: 2, imperfecto: 2, gerundio_estar: 2,
    gerundio: 3, futuro: 3, condicional: 3, imperativo: 3, subjuntivo_presente: 3,
    subjuntivo_imperfecto: 4, pluscuamperfecto: 4, futuro_perfecto: 4, condicional_perfecto: 4,
    subjuntivo_perfecto: 4, si_mondat: 4,
  };
  const RANK_NAME = { 1: 'A1', 2: 'A2', 3: 'B1', 4: 'B2' };
  const PART_RE = /(?:ado|ados|ada|adas|ido|idos|ida|idas)$/;
  const IRREG_PART = new Set([
    'visto', 'hecho', 'dicho', 'escrito', 'puesto', 'vuelto', 'abierto', 'muerto', 'roto', 'cubierto',
    'descrito', 'devuelto', 'resuelto', 'satisfecho', 'impreso',
  ]);
  const GERUND_RE = /(?:ando|iendo|yendo)$/;
  const SUBJ_IMPF_RE =
    /(?:[aá]r?amos|aras?|aran|ieras?|iéramos|ieran|ieses?|iésemos|iesen|ases?|ásemos|asen|yeras?|yeran|uvieras?|uvieran|iciera|ubiera|udiera|upiera|usiera|iniera|ijera|ijeran|fueras?|fuéramos|fueran|fuese)$/;
  const COMMAND_LEAD_INS = new Set(['no', 'nunca', 'jamás', 'y', 'pero']);
  const HABER_TO = {
    presente: 'perfecto', imperfecto: 'pluscuamperfecto', indefinido: 'pluscuamperfecto',
    futuro: 'futuro_perfecto', condicional: 'condicional_perfecto', subjuntivo_presente: 'subjuntivo_perfecto',
  };
  const ENDINGS = {
    presente: { ar: ['o', 'as', 'a', 'amos', 'an'], er: ['o', 'es', 'e', 'emos', 'en'], ir: ['o', 'es', 'e', 'imos', 'en'] },
    indefinido: { ar: ['é', 'aste', 'ó', 'amos', 'aron'], er: ['í', 'iste', 'ió', 'imos', 'ieron'], ir: ['í', 'iste', 'ió', 'imos', 'ieron'] },
    imperfecto: { ar: ['aba', 'abas', 'aba', 'ábamos', 'aban'], er: ['ía', 'ías', 'ía', 'íamos', 'ían'], ir: ['ía', 'ías', 'ía', 'íamos', 'ían'] },
    subjuntivo_presente: { ar: ['e', 'es', 'e', 'emos', 'en'], er: ['a', 'as', 'a', 'amos', 'an'], ir: ['a', 'as', 'a', 'amos', 'an'] },
  };
  const FUT = ['é', 'ás', 'á', 'emos', 'án'];
  const COND = ['ía', 'ías', 'ía', 'íamos', 'ían'];

  const paradigmCache = new Map();
  function addForm(map, form, tense) {
    const k = form.toLowerCase();
    if (!map.has(k)) map.set(k, new Set());
    map.get(k).add(tense);
  }
  function stemVariants(stem, cls) {
    const out = new Set([stem]);
    const swapLast = (s, ch, rep) => {
      const i = s.lastIndexOf(ch);
      return i === -1 ? null : s.slice(0, i) + rep + s.slice(i + 1);
    };
    for (const [ch, rep] of [['e', 'ie'], ['e', 'i'], ['o', 'ue'], ['u', 'ue'], ['o', 'u']]) {
      const v = swapLast(stem, ch, rep);
      if (v) out.add(v);
    }
    const last = stem.slice(-1);
    if (last === 'c') {
      out.add(`${stem.slice(0, -1)}qu`);
      out.add(`${stem.slice(0, -1)}z`);
      out.add(`${stem.slice(0, -1)}zc`);
    }
    if (last === 'g') { out.add(`${stem}u`); out.add(`${stem.slice(0, -1)}j`); }
    if (last === 'z') out.add(`${stem.slice(0, -1)}c`);
    if (last === 'u' && cls !== 'ar') out.add(`${stem}y`);
    if (/[aeiou]$/.test(last) && cls !== 'ar') out.add(`${stem}y`);
    return [...out];
  }
  function localForms(lemma, map) {
    const cls = lemma.slice(-2);
    if (!['ar', 'er', 'ir'].includes(cls) || lemma.length < 4) return;
    const stem = lemma.slice(0, -2);
    for (const [tense, byCls] of Object.entries(ENDINGS)) {
      for (const s of stemVariants(stem, cls)) {
        for (const e of byCls[cls]) addForm(map, s + e, tense);
      }
    }
    for (const e of FUT) addForm(map, lemma + e, 'futuro');
    for (const e of COND) addForm(map, lemma + e, 'condicional');
  }
  function paradigm(lemma) {
    if (paradigmCache.has(lemma)) return paradigmCache.get(lemma);
    const map = new Map();
    let any = false;
    for (const t of TENSES) {
      const forms = conjugate(lemma, t);
      if (!forms) continue;
      any = true;
      for (const f of forms) addForm(map, f.form, t);
    }
    if (!any) localForms(lemma, map);
    if (lemma === 'haber') addForm(map, 'hay', 'presente');
    paradigmCache.set(lemma, map);
    return map;
  }

  /** Visszaadja a mondat [szerkezet, token] párjait. A lemma-lista alapján dolgozik. */
  function detect(tokens, lemmas) {
    const found = [];
    tokens.forEach((t, i) => {
      const l = lemmas[i];
      if (t === 'si') found.push(['si_mondat', t]);
      if (!isVerb(l)) return;
      if (t === l) return;
      const prevL = lemmas[i - 1];
      if (PART_RE.test(t) || IRREG_PART.has(t)) {
        if (prevL === 'haber' && l !== 'haber') {
          const aux = paradigm('haber').get(tokens[i - 1]);
          const tense = aux ? [...aux].sort((a, b) => STRUCT_LEVEL[HABER_TO[a]] - STRUCT_LEVEL[HABER_TO[b]])[0] : null;
          if (tense && HABER_TO[tense]) found.push([HABER_TO[tense], `${tokens[i - 1]} ${t}`]);
        }
        return;
      }
      const tenses = paradigm(l).get(t);
      if (!tenses && GERUND_RE.test(t)) {
        // előbb a ragozási tábla: entiendo, mando jelen idő, nem gerundium
        found.push([prevL === 'estar' ? 'gerundio_estar' : 'gerundio', t]);
        return;
      }
      if (tenses) {
        const sorted = [...tenses].sort((a, b) => STRUCT_LEVEL[a] - STRUCT_LEVEL[b]);
        let s = sorted[0];
        if (s === 'subjuntivo_presente') {
          const cmd = i === 0 || (COMMAND_LEAD_INS.has(tokens[i - 1]) && i <= 2);
          if (cmd) s = 'imperativo';
        }
        found.push([s, t]);
        return;
      }
      if (SUBJ_IMPF_RE.test(t)) found.push(['subjuntivo_imperfecto', t]);
    });
    return found;
  }

  // ----- a szabályok futtatása a célkártyákon
  const seenSentences = new Map();
  for (const c of target) {
    const isEmpty =
      c.sentence_es === '' && c.sentence_hu === '' && c.sentence_en === '' && c.sentence_de === '' &&
      Array.isArray(c.sentence_lemmas) && c.sentence_lemmas.length === 0;
    const isFull =
      c.sentence_es !== '' && c.sentence_hu !== '' && c.sentence_en !== '' && c.sentence_de !== '' &&
      Array.isArray(c.sentence_lemmas) && c.sentence_lemmas.length > 0;

    // R9 (kiegészítés, nem a spec része): üres szó-glossza hiányzó fordítás
    for (const k of ['hu', 'en', 'de']) if (!c[k]) fail('R9', `${tag(c)}: üres ${k} glossza`);

    // R7 üres mondat csak az elején
    if (!isEmpty && !isFull) fail('R7', `${tag(c)}: a 4 sentence_* mező és a sentence_lemmas vagy mind üres, vagy mind kitöltött`);
    else if (isEmpty && c.order > EMPTY_SENTENCE_MAX_ORDER) fail('R7', `${tag(c)}: üres mondat order>${EMPTY_SENTENCE_MAX_ORDER}`);
    if (!isFull) continue;

    const s = c.sentence_es;
    const tokens = tokenize(s);
    const lemmas = c.sentence_lemmas;

    // R3 teljes mondat
    if (!/^[¿¡]*[A-ZÁÉÍÓÚÑÜ]/.test(s)) fail('R3', `${tag(c)}: nem nagybetűvel kezdődik: "${s}"`);
    if (!/[.!?]$/.test(s)) fail('R3', `${tag(c)}: nem . ! ? zárja: "${s}"`);
    if (tokens.length < 3) fail('R3', `${tag(c)}: ${tokens.length} szó-token (min 3): "${s}"`);
    if (!lemmas.some((l) => isVerb(l))) fail('R3', `${tag(c)}: nincs ige-lemma: "${s}"`);

    // R4 csak tanult szó
    if (tokens.length !== lemmas.length) {
      fail('R4', `${tag(c)}: ${tokens.length} token, ${lemmas.length} lemma: "${s}"`);
    } else {
      lemmas.forEach((l) => {
        const ks = byLemma.get(l);
        if (!ks) fail('R4', `${tag(c)}: "${l}" nem kártya-lemma`);
        else if (!ks.some((k) => known(k, c))) fail('R4', `${tag(c)}: "${l}" (#${ks[0].order}) ${LEVEL_RANK[ks[0].level] > LEVEL_RANK[c.level] ? 'magasabb szintű' : 'később jön'}`);
      });
    }
    if (!lemmas.includes(c.lemma)) fail('R4', `${tag(c)}: a kártya saját lemmája nincs a mondatban`);

    // R5 lemma-hihetőség
    if (tokens.length === lemmas.length) {
      tokens.forEach((t, i) => {
        if (!plausible(t, lemmas[i])) fail('R5', `${tag(c)}: "${t}" > "${lemmas[i]}" nem hihető`);
      });
    }

    // R6 hossz + igeidő
    const rank = LEVEL_RANK[c.level];
    if (tokens.length > MAX_TOKENS[c.level]) fail('R6', `${tag(c)}: ${tokens.length} szó > ${MAX_TOKENS[c.level]} (${c.level}): "${s}"`);
    if (tokens.length === lemmas.length) {
      for (const [st, tok] of detect(tokens, lemmas)) {
        if (STRUCT_LEVEL[st] > rank) fail('R6', `${tag(c)}: "${tok}" = ${st} (${RANK_NAME[STRUCT_LEVEL[st]]}) ${c.level}-en: "${s}"`);
      }
    }

    // R8 azonos mondat
    if (seenSentences.has(s)) fail('R8', `${tag(c)}: "${s}" már: #${seenSentences.get(s)}`);
    else seenSentences.set(s, c.order);
  }

  // R10 (kiegészítés, PLAN Minőség): alanyi névmással kezdődő mondat szintenként legfeljebb 25%.
  const SUBJECT_PRON = new Set(['yo', 'tú', 'él', 'ella', 'nosotros', 'ellos', 'usted']);
  for (const lv of LEVELS) {
    const inLevel = target.filter((c) => c.__file === lv && Array.isArray(c.sentence_lemmas) && c.sentence_lemmas.length > 0);
    if (!inLevel.length) continue;
    const pron = inLevel.filter((c) => SUBJECT_PRON.has(c.sentence_lemmas[0]));
    const pct = Math.round((pron.length / inLevel.length) * 100);
    R10_STATS.push(`${lv.toUpperCase()} ${pron.length}/${inLevel.length} = ${pct}%`);
    if (pron.length * 4 > inLevel.length) {
      fail('R10', `${lv.toUpperCase()}: alanyi névmással kezdődő mondat ${pron.length}/${inLevel.length} (${pct}%) > 25%`);
    }
  }
}

// ---------------------------------------------------------------- jelentés
const ruleList = listOnly
  ? ['R1', 'R2', 'R11', 'R12', 'R13', 'R14']
  : ['R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7', 'R8', 'R9', 'R10', 'R11', 'R12', 'R13', 'R14'];
let bad = 0;
for (const r of ruleList) {
  const errs = RULES[r] || [];
  bad += errs.length;
  console.log(`${r}: ${errs.length ? `${errs.length} hiba` : 'ok'}${r === 'R10' && R10_STATS.length ? ` (${R10_STATS.join('; ')})` : ''}`);
  errs.slice(0, 5).forEach((e) => console.log(`   ${e}`));
}
const scope = listOnly ? 'lista' : onlyLevel ? onlyLevel.toUpperCase() : 'mind';
console.log(bad ? `words-open-check: PIROS (${bad} hiba, ${scope})` : `words-open-check: ZÖLD (${scope}, ${cards.length} kártya)`);
process.exit(bad ? 1 : 0);
