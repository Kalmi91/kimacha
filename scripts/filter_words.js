#!/usr/bin/env node
// Word-expansion candidate filter (rebuild; the /tmp original was wiped).
// Reads SUBTLEX-ESP ranked candidates from word_batches/*.txt, drops everything
// already covered by the shared deck (exact, gender/number variant, or any
// conjugated form of a taught verb), plus junk (proper nouns, English, enclitics).
// Prints the survivors rank-ascending: "<pos>\t<rank>\t<word>".

const fs = require('fs');
const path = require('path');
const ROOT = '/home/kalmi/ai/kimacha';

const fold = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// ---------------------------------------------------------------- conjugator
// Generates the forms a taught infinitive can surface as, so that e.g. "puedo"
// is recognised as covered by "poder". Over-generation is fine (worst case we
// skip a candidate that deserved a card); under-generation leaks junk.
const STEM_CHANGE = [
  [/e([^aeiou]+)(ar|er|ir)$/, 'ie'],   // pensar → piensa, querer → quiere
  [/o([^aeiou]+)(ar|er|ir)$/, 'ue'],   // poder → puede, dormir → duerme
  [/e([^aeiou]+)ir$/, 'i'],            // pedir → pide
];

function stemVariants(inf) {
  const f = fold(inf);
  const stem = f.slice(0, -2);
  const out = new Set([stem]);
  for (const [re, repl] of STEM_CHANGE) {
    const m = f.match(re);
    if (!m) continue;
    const idx = f.lastIndexOf(m[0]);
    out.add((f.slice(0, idx) + m[0].replace(/^(.)/, repl)).slice(0, -2));
  }
  // c→z / g→j / gu→g spelling shifts (empezar → empiezo, coger → cojo)
  for (const s of [...out]) {
    if (s.endsWith('c')) out.add(s.slice(0, -1) + 'z');
    if (s.endsWith('z')) out.add(s.slice(0, -1) + 'c');
    if (s.endsWith('g')) out.add(s.slice(0, -1) + 'j');
    if (s.endsWith('gu')) out.add(s.slice(0, -1));
  }
  return [...out];
}

const ENDINGS = {
  ar: ['o', 'as', 'a', 'amos', 'ais', 'an', 'e', 'es', 'emos', 'eis', 'en',
       'aba', 'abas', 'abamos', 'aban', 'e', 'aste', 'o', 'amos', 'aron',
       'ando', 'ado', 'ada', 'ados', 'adas', 'ara', 'aras', 'aran', 'ase'],
  er: ['o', 'es', 'e', 'emos', 'eis', 'en', 'a', 'as', 'amos', 'an',
       'ia', 'ias', 'iamos', 'ian', 'i', 'iste', 'io', 'imos', 'ieron',
       'iendo', 'ido', 'ida', 'idos', 'idas', 'iera', 'ieras', 'ieran', 'iese'],
};
ENDINGS.ir = ENDINGS.er;

function conjugations(inf) {
  const f = fold(inf);
  const kind = f.slice(-2);
  if (!ENDINGS[kind]) return [];
  const forms = new Set([f]);
  for (const stem of stemVariants(f)) {
    for (const e of ENDINGS[kind]) forms.add(stem + e);
    // future / conditional build on the whole infinitive
  }
  for (const e of ['e', 'as', 'a', 'emos', 'an', 'ia', 'ias', 'iamos', 'ian']) forms.add(f + e);
  return [...forms];
}

// Truly irregular high-frequency verbs: full paradigms are not derivable.
const IRREGULAR = {
  ser: 'soy eres es somos sois son era eras eramos eran fui fuiste fue fuimos fueron sea seas seamos sean siendo sido sere seras sera seremos seran seria',
  estar: 'estoy estas esta estamos estais estan estaba estabas estabamos estaban estuve estuviste estuvo estuvimos estuvieron este estes estemos esten estando estado estare',
  ir: 'voy vas va vamos vais van iba ibas ibamos iban fui fuiste fue fuimos fueron vaya vayas vayamos vayan yendo ido ire iras ira iremos iran iria',
  haber: 'he has ha hemos habeis han habia habias habiamos habian hube hubo hubieron haya hayas hayamos hayan habiendo habido habra habria hay',
  tener: 'tengo tienes tiene tenemos teneis tienen tenia tenias teniamos tenian tuve tuviste tuvo tuvimos tuvieron tenga tengas tengamos tengan teniendo tenido tendra tendre tendria ten',
  hacer: 'hago haces hace hacemos haceis hacen hacia hacias haciamos hacian hice hiciste hizo hicimos hicieron haga hagas hagamos hagan haciendo hecho hecha hara hare haria haz',
  poder: 'puedo puedes puede podemos podeis pueden podia podias podiamos podian pude pudiste pudo pudimos pudieron pueda puedas podamos puedan pudiendo podido podra podre podria',
  querer: 'quiero quieres quiere queremos quereis quieren queria querias queriamos querian quise quisiste quiso quisimos quisieron quiera quieras queramos quieran queriendo querido querra querria quisiera',
  saber: 'se sabes sabe sabemos sabeis saben sabia sabias sabiamos sabian supe supiste supo supimos supieron sepa sepas sepamos sepan sabiendo sabido sabra sabre sabria',
  decir: 'digo dices dice decimos decis dicen decia decias deciamos decian dije dijiste dijo dijimos dijeron diga digas digamos digan diciendo dicho dicha dira dire diria di',
  ver: 'veo ves ve vemos veis ven veia veias veiamos veian vi viste vio vimos vieron vea veas veamos vean viendo visto vista vere veria',
  dar: 'doy das da damos dais dan daba dabas daban di diste dio dimos dieron de des demos den dando dado dara dare daria',
  venir: 'vengo vienes viene venimos venis vienen venia venias venian vine viniste vino vinimos vinieron venga vengas vengamos vengan viniendo venido vendra vendre vendria ven',
  poner: 'pongo pones pone ponemos poneis ponen ponia ponias ponian puse pusiste puso pusimos pusieron ponga pongas pongamos pongan poniendo puesto puesta pondra pondre pondria pon',
  salir: 'salgo sales sale salimos salis salen salia salias salian sali saliste salio salimos salieron salga salgas salgamos salgan saliendo salido saldra saldre saldria sal',
  traer: 'traigo traes trae traemos traeis traen traia traias traian traje trajiste trajo trajimos trajeron traiga traigas traigan trayendo traido traera',
  oir: 'oigo oyes oye oimos ois oyen oia oias oian oi oiste oyo oimos oyeron oiga oigas oigamos oigan oyendo oido oira',
  creer: 'creo crees cree creemos creeis creen creia creias creian crei creiste creyo creimos creyeron crea creas creamos crean creyendo creido creera',
  leer: 'leo lees lee leemos leen leia leian lei leiste leyo leyeron lea leas lean leyendo leido leera',
  seguir: 'sigo sigues sigue seguimos seguis siguen seguia seguian segui seguiste siguio siguieron siga sigas sigamos sigan siguiendo seguido seguira',
  conocer: 'conozco conoces conoce conocemos conocen conocia conocian conoci conociste conocio conocieron conozca conozcas conozcan conociendo conocido conocera',
  parecer: 'parezco pareces parece parecemos parecen parecia parecian pareci parecio parecieron parezca parezcan pareciendo parecido parecera',
  sentir: 'siento sientes siente sentimos sienten sentia sentian senti sentiste sintio sintieron sienta sientas sintamos sientan sintiendo sentido sentira',
  dormir: 'duermo duermes duerme dormimos duermen dormia dormian dormi durmio durmieron duerma duermas duerman durmiendo dormido dormira',
  morir: 'muero mueres muere morimos mueren moria morian mori murio murieron muera mueras mueran muriendo muerto muerta morira',
  pedir: 'pido pides pide pedimos piden pedia pedian pedi pidio pidieron pida pidas pidan pidiendo pedido pedira',
  jugar: 'juego juegas juega jugamos juegan jugaba jugaban jugue jugo jugaron juegue jueguen jugando jugado jugara',
  llevar: 'llevo llevas lleva llevamos llevan llevaba llevaban lleve llevaste llevo llevaron llevando llevado llevara',
};

// -------------------------------------------------------------- taught set
const LEVELS = ['a0', 'a1', 'a2', 'b1', 'b2', 'c1', 'c2'];
const covered = new Set();
const taughtWords = [];

function addCovered(w) { covered.add(fold(w)); }

for (const lv of LEVELS) {
  const cards = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/words', lv + '.json'), 'utf8'));
  for (const c of cards) {
    for (const variant of String(c.es).split('/')) {
      const clean = variant.trim().toLowerCase()
        .replace(/\(.*?\)/g, ' ')
        .replace(/[¿?¡!.,;:"']/g, ' ')
        .replace(/^(el|la|los|las|un|una|unos|unas)\s+/, '');
      for (const tok of clean.split(/\s+/).filter(Boolean)) {
        taughtWords.push(tok);
        addCovered(tok);
      }
    }
  }
}

// gender / number variants of every taught word
for (const w of [...taughtWords]) {
  const f = fold(w);
  addCovered(f + 's');
  addCovered(f + 'es');
  if (f.endsWith('o')) { addCovered(f.slice(0, -1) + 'a'); addCovered(f.slice(0, -1) + 'os'); addCovered(f.slice(0, -1) + 'as'); }
  if (f.endsWith('a')) { addCovered(f.slice(0, -1) + 'o'); addCovered(f.slice(0, -1) + 'os'); addCovered(f.slice(0, -1) + 'as'); }
  if (f.endsWith('z')) addCovered(f.slice(0, -1) + 'ces');
  if (/(ar|er|ir)$/.test(f) && f.length >= 4) for (const form of conjugations(f)) addCovered(form);
}

// irregular paradigms: apply when the lemma (or any of its forms) is taught
for (const [lemma, forms] of Object.entries(IRREGULAR)) {
  const list = forms.split(' ');
  const known = covered.has(fold(lemma)) || list.some((f) => covered.has(f));
  if (!known) continue;
  for (const f of list) addCovered(f);
}

// -------------------------------------------------------------- junk lists
const PROPER = new Set(('boston chloe kent chuck cristo alemania madrid espana ana juan maria mario '
  + 'pedro carlos luis jose jack john mike tom bob sam max jim harry peter paul george frank fred '
  + 'york paris londres roma italia francia china japon mexico europa america africa asia navidad '
  + 'jesus michael david daniel sarah anna emma lisa jenny bobby joey ricky tommy charlie eddie ross '
  + 'texas california florida vegas hollywood chicago miami seattle brooklyn manhattan londres '
  + 'richard robert william james henry arthur alex nick steve joe billy jerry gary larry danny '
  + 'susan laura julia elena carmen rosa lucia marta sofia clara diana monica sandra patricia '
  + 'inglaterra rusia berlin moscu cuba brasil argentina colombia peru chile canada australia '
  + 'kevin brian scott adam ryan jason justin dylan lucas noah ethan logan mason caleb wyatt '
  + 'phoebe rachel monica joey chandler homer bart lisa marge ned sherlock watson potter').split(/\s+/));

const ENGLISH = new Set(('love huh yeah okay hey wow hello bye baby boy girl man woman god damn '
  + 'the and you are for with this that what where when how why who all right show time night day '
  + 'life sir mister miss doctor please thanks sorry good bad big small new old yes get got going '
  + 'come here there like just know think want need make take give look see say tell').split(/\s+/));

// -------------------------------------------------------------- candidates
const dir = path.join(ROOT, 'word_batches');
const seen = new Set();
const cands = [];
for (const f of fs.readdirSync(dir).filter((n) => n.endsWith('.txt'))) {
  for (const line of fs.readFileSync(path.join(dir, f), 'utf8').split('\n')) {
    const m = line.trim().match(/^(\d+)\s+(\S+)$/);
    if (!m) continue;
    const rank = parseInt(m[1], 10);
    const word = m[2].toLowerCase();
    if (seen.has(word)) continue;
    seen.add(word);
    cands.push({ rank, word });
  }
}
cands.sort((a, b) => a.rank - b.rank);

const reasons = {};
const kept = [];
for (const c of cands) {
  const f = fold(c.word);
  let why = null;
  if (f.length < 4) why = 'short';
  else if (!/^[a-zñü]+$/.test(f)) why = 'nonword';
  else if (covered.has(f)) why = 'covered';
  else if (PROPER.has(f)) why = 'proper';
  else if (ENGLISH.has(f)) why = 'english';
  else {
    const enc = f.match(/^(.+?)(melo|selo|sela|telo|nos|les|los|las|me|te|se|le|lo|la)$/);
    if (enc && /(ar|er|ir)$/.test(enc[1]) && enc[1].length >= 4) why = 'enclitic';
    else if (enc && /(ando|iendo)$/.test(enc[1])) why = 'enclitic';
  }
  if (why) { reasons[why] = (reasons[why] || 0) + 1; continue; }
  kept.push(c);
}

fs.writeFileSync(process.argv[2] || '/dev/stdout',
  kept.map((c, i) => `${i + 1}\t${c.rank}\t${c.word}`).join('\n') + '\n');
console.error('in:', cands.length, 'kept:', kept.length, JSON.stringify(reasons));
