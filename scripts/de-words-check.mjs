// Checks the German A1 gloss overlays (gloss-de) against the Spanish, English and Hungarian A1 decks.
//   node scripts/de-words-check.mjs          errors only (exit 1 when there are any), warning count
//   node scripts/de-words-check.mjs --warn   also list the warnings (headword missing from the sentence,
//                                            possible formal Sie, tense or case above A1, ...)
// Run `node scripts/build-de-deck.mjs` afterwards to rebuild data/words/de.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const EM_DASH = String.fromCharCode(0x2014);
const base = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..') + '/';
const R = (f) => JSON.parse(fs.readFileSync(base + f, 'utf8'));
const errors = [], warns = [];
const E = (f, k, m) => errors.push(`${f} k=${k}: ${m}`);
const W = (f, k, m) => warns.push(`${f} k=${k}: ${m}`);
const ART = /^(der|die|das)\s+\S/;
const LANGS = new Set(['Spanisch', 'Englisch', 'Deutsch', 'Ungarisch', 'Französisch', 'Italienisch', 'Chinesisch', 'Japanisch']);
const NOART_OK = new Set(['rechts', 'links', 'erste', 'zweite', 'dritte', 'letzte Woche', 'letzten Winter', 'letztes Jahr', 'derselbe', 'noch einmal', 'Jahre alt', 'Weihnachten', 'Neujahr', 'Ostern', 'Gleis zwei', 'letzte Woche', 'gestern Morgen', 'jede Woche', 'jeden Monat', 'zweimal', 'einmal', 'fast immer', 'nie wieder', 'vielleicht', 'übermorgen', 'nächste Woche', 'nächstes Jahr', 'fünfundfünfzig', 'neunundneunzig', 'zweitausend', 'ich arbeite (morgen)']);
const PHRASE_OK = new Set(['die Katze schläft', 'der Hund frisst', 'der Zug kommt an', 'der Laden öffnet', 'das Museum schließt', 'der gleiche', 'die gleiche Farbe', 'der Frühling kommt', 'der Schnee fällt', 'der Wind weht', 'die Sonne scheint']);
const AUSTRIAN = ['jänner', 'paradeiser', 'velo', 'erdapfel', 'marille', 'topfen', 'sackerl', 'obers', 'fleischhauer', 'heuer', 'spital', 'grüezi', 'trottoir', 'billett', 'zmorge', 'znüni', 'zvieri', 'karfiol', 'melanzani', 'palatschinke', 'semmel', 'kren', 'schlagobers', 'faschiert', 'sessel', 'servus', 'nachtessen', 'poulet', 'glace', 'coiffeur', 'perron', 'natel'];
const IRREG = { du: ['dir', 'dich', 'dein'], ich: ['mir', 'mich', 'mein'], er: ['ihn', 'ihm', 'sein'], sie: ['ihr', 'ihnen', 'ihre'], wir: ['uns', 'unser'], ihr: ['euch', 'eure'], es: ['ihm'], sein: ['bin', 'bist', 'ist', 'sind', 'seid', 'war', 'gewesen'], haben: ['habe', 'hast', 'hat', 'habt', 'hatte', 'gehabt'], werden: ['werde', 'wirst', 'wird', 'wurde', 'geworden'], essen: ['isst', 'iss', 'gegessen', 'aß'], geben: ['gibt', 'gib', 'gegeben'], sehen: ['sieht', 'siehst', 'sah', 'gesehen'], lesen: ['liest', 'liesst', 'gelesen'], nehmen: ['nimmt', 'nimmst', 'genommen'], fahren: ['fährt', 'fährst', 'gefahren'], schlafen: ['schläft', 'schläfst', 'geschlafen'], laufen: ['läuft', 'läufst', 'gelaufen'], helfen: ['hilft', 'hilfst', 'geholfen'], sprechen: ['spricht', 'sprichst', 'gesprochen'], wissen: ['weiß', 'weißt', 'wusste', 'gewusst'], können: ['kann', 'kannst', 'könnt', 'konnte'], müssen: ['muss', 'musst', 'musste'], wollen: ['will', 'willst', 'wollt'], dürfen: ['darf', 'darfst', 'dürft'], sollen: ['soll', 'sollst', 'sollt'], mögen: ['mag', 'magst', 'möchte', 'möchtest', 'möchten', 'möchtet'], gehen: ['ging', 'gegangen'], kommen: ['kam', 'gekommen'], stehen: ['stand', 'gestanden'], tun: ['tue', 'tust', 'tut', 'getan'], treffen: ['trifft', 'triffst', 'getroffen'], vergessen: ['vergisst', 'vergessen'], waschen: ['wäscht', 'wäschst'], tragen: ['trägt', 'trägst', 'getragen'], fressen: ['frisst', 'frisst'], anfangen: ['fängt', 'fange'], einladen: ['lädt', 'ladest'], gefallen: ['gefällt'], aussehen: ['sieht', 'siehst'], 'es gibt': ['gibt'], bringen: ['bringe', 'bringt', 'gebracht'], denken: ['denke', 'denkt', 'gedacht'], kennen: ['kenne', 'kennt', 'gekannt'], heißen: ['heiße', 'heißt'], schneiden: ['schneide', 'schneidet'], schließen: ['schließe', 'schließt'], lassen: ['lasse', 'lässt', 'lässt'], fallen: ['fällt'], halten: ['hält'], rufen: ['rufe', 'ruft', 'gerufen'] };
const SIE_FORMAL = /(\b(Haben|Sind|Möchten|Können|Wollen|Müssen|Dürfen|Wie heißen|Wo wohnen|Was machen|Kommen|Brauchen|Sprechen|Haben) Sie\b)|[a-zäöüß,;:] (Sie|Ihnen|Ihr|Ihre|Ihren|Ihrem|Ihrer|Ihres)\b/;
const PRAET = /\b(war|waren|warst|hatte|hatten|ging|kam|sah|aß|trank|fuhr|las|schrieb|nahm|gab|ließ|blieb|stand|saß|lag|wusste|brachte|dachte|kannte|nannte|rief|lief|traf|zog|hielt|fand|verstand|begann|schlief|half|sprach|wurde|wurden|bekam|wollte|sollte)\b/;
const KONJ = /\b(würde|würden|würdest|wäre|wären|hätte|hätten|könnte|könnten|sollte|sollten|dürfte)\b/;
const PASSIV = /\b(wird|werden|wurde|wurden|wirst) [^.!?]*\b(ge\w+(t|en)|\w+iert)\b[.!?]?/;
const GEN = /\b(des|eines|meines|deines|seines|ihres|unseres|eures|Ihres|dieses) [A-ZÄÖÜ][a-zäöüß]+(es|s)\b/;
const OLDSPELL = /\b(daß|muß|mußt|Kuß|Fluß|Schloß|naß|läßt|ißt|wußte|Haß|Paß|Gruß(?!e))\b|Strasse|\bgross|\bweiss|heissen|heisst|\bFuss|Spass|\bsüss|draussen|\bausser|schliessen|Grüsse|\bgrosse|Strassen/;
function stemsOf(branch) {
  const b = branch.replace(/\(.*?\)/g, ' ').replace(/^(der|die|das|ein|eine)\s+/i, '').replace(/\bsich\b|\bjemanden\b|\bjemandem\b|\.\.\./g, ' ').trim();
  return b.split(/\s+/).filter((w) => w.length > 0);
}
function stemMatch(sentence, w, base) {
  const s = sentence.toLowerCase();
  const lw = w.toLowerCase();
  const cut = (x) => x.slice(0, Math.max(3, x.length - 2));
  const um = (x) => { const m = x.match(/^(.*)([aou])([^aeiouäöü]*)$/); return m ? m[1] + ({ a: 'ä', o: 'ö', u: 'ü' })[m[2]] + m[3] : x; };
  if (s.includes(cut(lw)) || s.includes(um(cut(lw)))) return true;
  if (s.includes(lw)) return true;
  const ir = IRREG[base] || IRREG[lw] || [];
  return ir.some((f) => new RegExp('(^|[^a-zäöüß])' + f + '([^a-zäöüß]|$)').test(s));
}
function checkWordInSentence(de, sentence) {
  const branches = de.split(' / ').map((x) => x.trim()).filter(Boolean);
  for (const br of branches) {
    const ws = stemsOf(br);
    if (!ws.length) continue;
    // separable verb: also test without a known prefix
    const ok = ws.every((w) => {
      if (stemMatch(sentence, w, br.toLowerCase())) return true;
      const m = w.toLowerCase().match(/^(zurück|hinunter|herunter|hinauf|fest|fern|durch|nach|weg|los|weh|dar|auf|aus|ein|mit|vor|her|hin|bei|ab|an|um|zu)(.{3,})$/);
      return m ? stemMatch(sentence, m[2], br.toLowerCase()) && stemMatch(sentence, m[1], '') : false;
    });
    if (ok) return true;
  }
  return false;
}
const FILES = [
  { dir: 'data/words-open', gl: 'data/words-open/gloss-de', key: 'order', lv: ['a1'], sent: 'sentence_es' },
  { dir: 'data/words/en', gl: 'data/words/en/gloss-de', key: 'id', lv: ['a0', 'a1'], sent: 'sentence_en' },
  { dir: 'data/words/hu', gl: 'data/words/hu/gloss-de', key: 'id', lv: ['a0', 'a1'], sent: 'sentence_hu' },
];
const stats = {};
for (const F of FILES) {
  for (const lv of F.lv) {
    const gf = `${F.gl}/${lv}.json`;
    if (!fs.existsSync(base + gf)) { errors.push(`${gf}: missing`); continue; }
    const raw = fs.readFileSync(base + gf, 'utf8');
    if (raw.includes(EM_DASH)) errors.push(`${gf}: em dash present`);
    if (!raw.endsWith(']\n')) errors.push(`${gf}: must end with newline after ]`);
    const g = JSON.parse(raw), src = R(`${F.dir}/${lv}.json`);
    stats[gf] = g.length;
    if (g.length !== src.length) errors.push(`${gf}: ${g.length} rows, source has ${src.length}`);
    const seen = new Set();
    src.forEach((c, i) => {
      const r = g[i]; const k = c[F.key];
      if (!r) return;
      if (r.k !== k) { E(gf, r.k, `row ${i} should have k=${k}`); return; }
      if (seen.has(r.k)) E(gf, r.k, 'duplicate k'); seen.add(r.k);
      const keys = Object.keys(r).join(',');
      if (keys !== 'k,de,sentence_de') E(gf, k, `keys ${keys}`);
      const de = r.de, s = r.sentence_de;
      if (typeof de !== 'string' || !de.trim()) { E(gf, k, 'empty de'); return; }
      if (de !== de.trim() || /\s{2,}/.test(de)) E(gf, k, `whitespace in de "${de}"`);
      if (/[?]|\|\||^\s*$/.test(de)) E(gf, k, `placeholder in de "${de}"`);
      if (/[,;]/.test(de.replace(/\(.*?\)/g, ''))) E(gf, k, `use " / " not , or ; in "${de}"`);
      if (s.includes(EM_DASH) || de.includes(EM_DASH)) E(gf, k, 'em dash');
      const branches = de.split(' / ').map((x) => x.trim());
      if (branches.some((b) => !b)) E(gf, k, `empty branch "${de}"`);
      if (c.pos === 'noun') {
        for (const b of branches) {
          const bare = b.replace(/\(.*?\)/g, '').trim();
          if (/^(ein|eine|einen|einem)\s/.test(bare)) { E(gf, k, `indefinite article in "${de}"`); continue; }
          if (ART.test(bare)) {
            const words = bare.split(/\s+/);
            const head = words[words.length - 1];
            if (!/^[A-ZÄÖÜ]/.test(head) && !/\bPl\.$/.test(b) && !PHRASE_OK.has(bare)) E(gf, k, `noun head not capitalised in "${b}"`);
          } else if (!(LANGS.has(bare) || NOART_OK.has(bare) || /^(mein|dein|sein|ihr|unser|euer|seine|meine|deine|ihre|unsere|eure)e?[rnms]?\s+\S/.test(bare) || /^(ich|du|er|sie|es|wir|ihr|man)\s/.test(bare))) {
            E(gf, k, `noun without article "${b}"`);
          }
        }
      } else {
        for (const b of branches) {
          const bare = b.replace(/\(.*?\)/g, '').trim();
          if (/^(der|die|das)\s+[A-ZÄÖÜ]/.test(bare) && c.pos !== 'phrase' && c.pos !== 'pron' && c.pos !== 'det' && c.pos !== 'adj' && c.pos !== 'num') W(gf, k, `non-noun (${c.pos}) with article "${b}"`);
        }
      }
      for (const b of branches) { const lb = b.toLowerCase(); for (const a of AUSTRIAN) if (new RegExp('(^|[^a-zäöüß])' + a + '([^a-zäöüß]|$)').test(lb)) E(gf, k, `Austrian/Swiss headword "${b}"`); }
      const hasS = !!c[F.sent];
      if (hasS && !s) { E(gf, k, 'missing sentence_de'); return; }
      if (!hasS && s) E(gf, k, 'sentence_de for card without sentence');
      if (!hasS) return;
      if (!/^[A-ZÄÖÜ„"]/.test(s)) E(gf, k, `sentence not upper-case at start: ${s}`);
      if (!/[.!?]["”“]?$/.test(s)) E(gf, k, `sentence end: ${s}`);
      if (/\s{2,}| [.,!?]/.test(s)) E(gf, k, `spacing: ${s}`);
      if (OLDSPELL.test(s + ' ' + de)) E(gf, k, `spelling ss/ß: ${s} | ${de}`);
      if (!checkWordInSentence(de, s)) W(gf, k, `headword "${de}" not in sentence: ${s}`);
      if (SIE_FORMAL.test(s)) W(gf, k, `formal Sie? ${s}`);
      if (PRAET.test(s)) W(gf, k, `Präteritum? ${s}`);
      if (KONJ.test(s)) W(gf, k, `Konjunktiv? ${s}`);
      if (PASSIV.test(s)) W(gf, k, `Passiv? ${s}`);
      if (GEN.test(s)) W(gf, k, `Genitiv? ${s}`);
      if (/\d/.test(s)) W(gf, k, `digit in sentence: ${s}`);
    });
  }
}
// empty higher-level files
for (const F of FILES) for (const lv of ['a2', 'b1', 'b2', 'c1']) { const f = `${F.gl}/${lv}.json`; if (!fs.existsSync(base + f)) errors.push(`${f}: missing`); }
console.log(stats);
const show = process.argv.includes('--warn') ? warns : warns.slice(0, 0);
console.log(`errors ${errors.length}, warnings ${warns.length}`);
errors.slice(0, 80).forEach((e) => console.log('ERR ', e));
show.forEach((w) => console.log('WARN', w));
process.exit(errors.length ? 1 : 0);
