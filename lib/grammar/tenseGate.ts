// FB196, Kálmán 2026-09-09 (easy:The clients have): „megint a have arrived os mondatot
// teszed be pedig még ezt a nyelvtani szerkezetet nem tanítottad ez a hiba töbazőr
// előfordúlt erre figyelj old meg, hogy többszőr ne legyen. legyen olyan hogy bizonyos
// nyelvtani szerkezeteket feloldunk és akkor lehet mondjuk vizsgára is menni, meg akkor
// adja be ide is a mondatokat".
//
// A korpusz-audit eddig a SZÓKINCSET őrizte: minden szó legyen tanult. A NYELVTANT
// semmi nem őrizte, ezért egy A1-es szó példamondata nyugodtan használhatott A2-es
// összetett múltat („han llegado" = have arrived). Ez a modul zárja azt a rést.
//
// A felismerés nem heurisztika: a `lib/games/conjugate.ts` ragozó motorja már
// legenerálja a ragozott alakokat a korpusz igéiből, ezért egy alak → szerkezet
// térképet építünk, és a mondat szavait egyszerűen kikeressük. Ami nincs a
// térképen, az nem is számít, tehát téves riasztás nem keletkezik.
// Az összetett igeidőket (haber + participio) külön mintázat fogja, mert azok
// két szóból állnak, és pont ezek a leggyakoribb szint-túllépések.

import { LEVELS, words, type Level } from '@/data/words';
import { TENSES, conjugate, type Tense as SimpleTense } from '@/lib/games/conjugate';

export type Structure =
  | SimpleTense
  | 'perfecto'
  | 'pluscuamperfecto'
  | 'futuro_perfecto'
  | 'condicional_perfecto'
  | 'imperativo';

/** Melyik szinten TANÍTJUK a szerkezetet (lib/grammar/syllabus.ts sorrendje). */
export const STRUCTURE_LEVEL: Record<Structure, Level> = {
  // A jelen idő az alapállás: már az A0-s mondatok is ebben állnak, a tanterv
  // A1-es `presente-regular` témája a szabályt írja le, nem vezeti be a használatát.
  presente: 'A0',
  indefinido: 'A2',
  imperfecto: 'A2',
  futuro: 'A2',
  perfecto: 'A2',
  condicional: 'B1',
  subjuntivo_presente: 'B1',
  pluscuamperfecto: 'B1',
  futuro_perfecto: 'C1',
  condicional_perfecto: 'C1',
  // A felszólítás usted-alakja és a tiltás ALAKRA kötőmód (tome, no seas), de a
  // tanterv A2-ben tanítja, és nem kötőmódi mellékmondat. Külön szerkezet, hogy
  // egy A2-es „Tome asiento" ne bukjon el a B1-es kötőmód-kapun.
  imperativo: 'A2',
};

/** A tanterv témája, aminek a teljesítése feloldja a szerkezetet. */
export const STRUCTURE_TOPIC: Record<Structure, string> = {
  presente: 'presente-regular',
  indefinido: 'indefinido-regular',
  imperfecto: 'imperfecto',
  futuro: 'futuro-simple',
  perfecto: 'perfecto',
  condicional: 'condicional-simple',
  subjuntivo_presente: 'subjuntivo-presente-forma',
  pluscuamperfecto: 'pluscuamperfecto',
  futuro_perfecto: 'futuro-condicional-perfecto',
  condicional_perfecto: 'futuro-condicional-perfecto',
  imperativo: 'imperativo-afirmativo',
};

const HABER_PRESENT = new Set(['he', 'has', 'ha', 'hemos', 'habeis', 'habéis', 'han']);
const HABER_IMPERFECT = new Set(['habia', 'había', 'habias', 'habías', 'habiamos', 'habíamos', 'habiais', 'habíais', 'habian', 'habían']);
const HABER_FUTURE = new Set(['habre', 'habré', 'habras', 'habrás', 'habra', 'habrá', 'habremos', 'habreis', 'habréis', 'habran', 'habrán']);
const HABER_CONDITIONAL = new Set(['habria', 'habría', 'habrias', 'habrías', 'habriamos', 'habríamos', 'habriais', 'habríais', 'habrian', 'habrían']);

// A rendhagyó participiumok, amiket az -ado/-ido minta nem fog meg.
const IRREGULAR_PARTICIPLES = new Set([
  'visto', 'hecho', 'dicho', 'escrito', 'puesto', 'vuelto', 'abierto', 'muerto',
  'roto', 'cubierto', 'descrito', 'devuelto', 'resuelto', 'satisfecho', 'impreso',
]);

function isParticiple(token: string): boolean {
  return /(?:ado|ados|ada|adas|ido|idos|ida|idas)$/.test(token) || IRREGULAR_PARTICIPLES.has(token);
}

// A `que` szándékosan NINCS itt: a „que + kötőmód" pont a mellékmondati kötőmód,
// nem felszólítás.
const COMMAND_LEAD_INS = new Set(['no', 'nunca', 'jamas', 'jamás', 'y', 'pero']);

// A kötőmódot a spanyolban kiváltó szó hívja elő. Kiváltó nélkül egy kötőmódi
// ALAKÚ szó szinte biztosan főnév (tema, salga mint „kimenetel"), ezért csak
// kiváltó jelenlétében számítjuk kötőmódnak. Ez a kapu inkább téveszt lefelé.
const SUBJUNCTIVE_TRIGGERS = new Set([
  'que', 'ojala', 'ojalá', 'quiza', 'quizá', 'quizas', 'quizás', 'acaso',
  'cuando', 'aunque', 'mientras', 'hasta', 'antes', 'despues', 'después', 'sin',
  'para', 'como', 'donde', 'dónde', 'tal',
]);

/** Felszólítás-pozíció: tagmondat eleje, tiltás után, vagy tapadó névmással. */
function isCommandPosition(tokens: string[], i: number): boolean {
  if (/(?:me|te|se|nos|le|les|lo|la|los|las)$/.test(tokens[i]) && tokens[i].length > 5) return true;
  if (i === 0) return true;
  const prev = tokens[i - 1];
  return COMMAND_LEAD_INS.has(prev) && i <= 2;
}

export function tokenize(sentence: string): string[] {
  return sentence
    .toLowerCase()
    .replace(/[¿?¡!.,;:()"«»]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

// Alak → szerkezet. Ütközésnél (pl. a -ar igék `hablamos` alakja jelen ÉS
// befejezett múlt is) a KORÁBBAN tanított szerkezet nyer, hogy egy szabályos
// A1-es mondat sose essen fenn a kapun.
let formIndex: Map<string, Structure> | null = null;

function levelRank(level: Level): number {
  return LEVELS.indexOf(level);
}

function buildFormIndex(): Map<string, Structure> {
  const index = new Map<string, Structure>();
  const infinitives = new Set<string>();
  for (const w of words) {
    if (w.pos !== 'verb') continue;
    const es = String(w.es ?? '').trim().toLowerCase();
    // A szótári alakok között ragozott bejegyzés is van („yo hablo"), abból nem
    // lehet ragozni; csak a főnévi igenevek kellenek.
    if (/^[a-záéíóúñü]+(ar|er|ir)$/.test(es)) infinitives.add(es);
  }
  for (const inf of infinitives) {
    for (const tense of TENSES) {
      const forms = conjugate(inf, tense);
      if (!forms) continue;
      for (const { form } of forms) {
        const key = form.toLowerCase();
        const seen = index.get(key);
        if (seen && levelRank(STRUCTURE_LEVEL[seen]) <= levelRank(STRUCTURE_LEVEL[tense])) continue;
        index.set(key, tense);
      }
    }
  }
  return index;
}

function getFormIndex(): Map<string, Structure> {
  if (!formIndex) formIndex = buildFormIndex();
  return formIndex;
}

// Homográfok. A ragozott alakok fele egyben főnév vagy elöljáró is: `vino`
// (bor / venir múltja), `entre` (között / entrar kötőmódja), `viaje` (utazás /
// viajar kötőmódja), `tema` (téma / temer kötőmódja). Ha a szó a korpuszban NEM
// igeként szerepel, nem igealaknak vesszük: a kapu inkább engedjen át egy
// gyanús mondatot, mint hogy szabályos mondatokat kényszerítsen átírásra.
let nonVerbForms: Set<string> | null = null;

function getNonVerbForms(): Set<string> {
  if (nonVerbForms) return nonVerbForms;
  const set = new Set<string>();
  for (const w of words) {
    if (w.pos === 'verb') continue;
    // A `phrase` bejegyzések több szóból állnak („no hablo español"), és a
    // szavaik közt IGEALAK is van. Ha azokat felvennénk, a saját alak-térképünket
    // ütnénk ki: a „hablo" nem-igévé válna. A kifejezéseket ezért kihagyjuk.
    if (w.pos === 'phrase') continue;
    const es = String(w.es ?? '').trim().toLowerCase();
    if (!es) continue;
    // A szótári alak névelővel jön („el vino"), a mondatban névelő nélkül áll.
    for (const part of es.split(/\s+/)) {
      if (['el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas'].includes(part)) continue;
      set.add(part);
      // A szótári alak egyes számban áll, a mondatban lehet többes: „viajes".
      set.add(`${part}s`);
      if (/[^aeiouáéíóú]$/.test(part)) set.add(`${part}es`);
    }
  }
  nonVerbForms = set;
  return set;
}

/** Tesztekhez: felejtse el a legenerált alak-térképet. */
export function resetFormIndex(): void {
  formIndex = null;
  nonVerbForms = null;
}

/** Milyen igeidőket használ a mondat. Ismeretlen alak nem kerül bele. */
export function detectStructures(sentence: string): Set<Structure> {
  const tokens = tokenize(sentence);
  const found = new Set<Structure>();
  const consumed = new Set<number>();

  // Összetett igeidők: haber + participio. Ez a kettő együtt egyértelmű, és
  // pont ez volt a hibás eset („han llegado" egy A1-es mondatban).
  for (let i = 0; i < tokens.length - 1; i++) {
    const aux = tokens[i];
    if (!isParticiple(tokens[i + 1])) continue;
    let structure: Structure | null = null;
    if (HABER_PRESENT.has(aux)) structure = 'perfecto';
    else if (HABER_IMPERFECT.has(aux)) structure = 'pluscuamperfecto';
    else if (HABER_FUTURE.has(aux)) structure = 'futuro_perfecto';
    else if (HABER_CONDITIONAL.has(aux)) structure = 'condicional_perfecto';
    if (!structure) continue;
    found.add(structure);
    consumed.add(i);
    consumed.add(i + 1);
  }

  const index = getFormIndex();
  const nonVerbs = getNonVerbForms();
  tokens.forEach((token, i) => {
    if (consumed.has(i)) return;
    if (nonVerbs.has(token)) return;
    const structure = index.get(token);
    if (!structure) return;
    // A kötőmódi ALAK felszólításként is áll: „Tome asiento", „No seas tonto",
    // „Avísame". Ilyenkor a tanterv felszólítás-témája a mérce (A2), nem a
    // kötőmódi mellékmondaté (B1). Felszólításnak vesszük, ha a tagmondat élén
    // áll, ha tiltószó előzi, vagy ha névmás tapadt hozzá.
    if (structure === 'subjuntivo_presente') {
      if (isCommandPosition(tokens, i)) {
        found.add('imperativo');
        return;
      }
      if (!tokens.slice(0, i).some((t) => SUBJUNCTIVE_TRIGGERS.has(t))) return;
    }
    found.add(structure);
  });

  return found;
}

/**
 * Melyik szerkezetek szabadok. Ami a tanuló szintje ALATT tanítódik, azon már
 * túl van; a saját szintjén akkor szabad, ha a nyelvtani leckét elvégezte
 * („bizonyos nyelvtani szerkezeteket feloldunk"). A jelen idő mindig szabad.
 */
export function unlockedStructures(level: Level, doneTopicIds: Set<string> = new Set()): Set<Structure> {
  const out = new Set<Structure>();
  const learnerRank = levelRank(level);
  for (const key of Object.keys(STRUCTURE_LEVEL) as Structure[]) {
    if (key === 'presente') {
      out.add(key);
      continue;
    }
    if (levelRank(STRUCTURE_LEVEL[key]) < learnerRank) out.add(key);
    else if (doneTopicIds.has(STRUCTURE_TOPIC[key])) out.add(key);
  }
  return out;
}

/** Amit a mondat használ, de a tanuló még nem oldott fel. Üres = mehet. */
export function lockedStructuresIn(
  sentence: string,
  level: Level,
  doneTopicIds: Set<string> = new Set()
): Structure[] {
  const unlocked = unlockedStructures(level, doneTopicIds);
  return [...detectStructures(sentence)].filter((st) => !unlocked.has(st));
}

export function sentenceAllowed(
  sentence: string,
  level: Level,
  doneTopicIds: Set<string> = new Set()
): boolean {
  return lockedStructuresIn(sentence, level, doneTopicIds).length === 0;
}

/**
 * Korpusz-ellenőrzéshez: a mondat a SAJÁT szintje fölé nyúl-e. Itt nincs
 * lecke-feloldás, a kérdés az, hogy a szint tananyaga elbírja-e a mondatot.
 */
export function structuresAboveLevel(sentence: string, level: Level): Structure[] {
  const rank = levelRank(level);
  return [...detectStructures(sentence)].filter((st) => levelRank(STRUCTURE_LEVEL[st]) > rank);
}

/**
 * FB196 futásidejű kapu: kiszűri a sor MONDAT-kártyáit, ha olyan nyelvtant
 * használnak, amit a tanuló még nem oldott fel. A szókártyák érintetlenek: egy
 * szó megtanulható azelőtt is, hogy a mondatait érteni tudná.
 *
 * A szűrés a lekérdezés UTÁN fut, ezért mindegy, melyik úton került a kártya a
 * sorba (szint, téma, kölcsönzés): ha a szerkezet zárva van, nem jelenik meg.
 */
export function filterLockedSentences<T extends { type: string; word: { [k: string]: unknown } }>(
  items: T[],
  level: Level,
  doneTopicIds: Set<string> = new Set()
): T[] {
  const unlocked = unlockedStructures(level, doneTopicIds);
  return items.filter((item) => {
    if (item.type !== 'sentence') return true;
    const sentence = String(item.word.sentence_es ?? '');
    if (!sentence) return true;
    for (const structure of detectStructures(sentence)) {
      if (!unlocked.has(structure)) return false;
    }
    return true;
  });
}
