// PCIC B1 corpus extraction (PLAN-pcic.md 2. lepes, 3. kor, 2026-09-18).
//
// 2. kor: az elso kor a .clean.md fajlokra epult, de azok elvesztettek a
// cimszo/peldamondat es a tilde/vesszo szerkezetet (ket bug: "cualidad Es
// una persona con muchas cualidades." osszeragadas, "ministro ... ), jefe de
// Estado, ..." osszeragadt tilde+vesszo). A forras most a NYERS
// pandoc-markdown, ahol a szerkezet HTML <table>/<td>/<ul>/<li>/<br/>/<em>
// formaban megvan.
//
// 3. kor: stabil, tartalom-alapu id (sha1(es) elso 8 hex-je) es `order` mezo,
// mert a pcic_cards.item_id majd erre mutat, es a szabaly-javitasok nem
// tolhatjak el a sorszamos id-kat. Tobbszoros tilde (Descartes-szorzat) a
// "tener ~ una buena/una mala ~ actitud" tipusu darabokhoz; az egy-tildes
// eset valtozatlan.
//
// `--level a2|b2` a ket-oszlopos tablazatok MASODIK <td>-jet dolgozza fel az
// elso helyett, ugyanazzal a kinyero logikaval; alapertelmezes: b1 (elso <td>).
// a1/a2 az A1-A2 inventario md-kbol olvas, b1/b2 a B1-B2 md-kbol.
//
// Usage: node scripts/pcic-b1.mjs [--level a1|a2|b1|b2]
//
// FIGYELEM (FB363/FB367, 2026-09-23): a *-all.json / *-sample.json most kezzel
// javitva van (region-cimke szetszedett zarojel-parok osszevonva, `region` es
// `mx` mezok). Ujrafutas felulirja ezeket: a kezzel felvitt `region`, `mx`,
// `pos` mezok es a modositott `es` ertekek elvesznek.

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

const LEVEL_ARG_IDX = process.argv.indexOf('--level');
const level = LEVEL_ARG_IDX !== -1 ? process.argv[LEVEL_ARG_IDX + 1] : 'b1';
if (!['a1', 'a2', 'b1', 'b2'].includes(level)) {
  console.error(`Unknown --level: ${level} (expected a1, a2, b1 or b2)`);
  process.exit(1);
}

const isA = level === 'a1' || level === 'a2';
const HEADER_PAIR = isA ? ['A1', 'A2'] : ['B1', 'B2'];
const SOURCE_SUFFIX = isA ? 'a1-a2' : 'b1-b2';
const TD_INDEX = level === 'a1' || level === 'b1' ? 0 : 1;

const SOURCES = [
  { tag: '08', path: `data/pcic/08_nociones_generales_inventario_${SOURCE_SUFFIX}.md` },
  { tag: '09', path: `data/pcic/09_nociones_especificas_inventario_${SOURCE_SUFFIX}.md` },
];

// ---------------------------------------------------------------------------
// HTML helpers
// ---------------------------------------------------------------------------

function decodeEntities(text) {
  return text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&amp;/gi, '&')
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)));
}

// Strip any remaining HTML tag, decode entities, collapse whitespace.
function stripTags(text) {
  return decodeEntities(text.replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

// Heading text cleanup: unescape pandoc's backslash-escapes ("1\." -> "1."),
// drop "[ v. ... ]" cross-references and "[text](../link)" markdown links.
function cleanHeading(text) {
  let t = text.replace(/\\([.\-[\]()*_~`>#+!])/g, '$1');
  t = t.replace(/\[[^\]]*\]\([^)]*\)/g, '');
  t = t.replace(/\[[^\]]*\]/g, '');
  return t.replace(/\s+/g, ' ').trim();
}

// Recursively walk a <ul>, starting right after its opening tag (`pos`).
// A <li> that itself wraps a nested <ul> is a category label, not a lexical
// item (e.g. "Lugares de trabajo<ul><li>departamento ~ ...</li>...</ul>"):
// its own text is discarded and only the nested <li>s are kept (flattened).
// Returns the leaf <li> inner-HTML strings and the position right after the
// matching </ul>.
function parseUl(html, pos) {
  const items = [];
  for (;;) {
    const liOpen = html.indexOf('<li>', pos);
    const ulClose = html.indexOf('</ul>', pos);
    if (liOpen === -1 || (ulClose !== -1 && ulClose < liOpen)) {
      return { items, endPos: ulClose === -1 ? html.length : ulClose + 5 };
    }
    const contentStart = liOpen + 4;
    const nestedUlOpen = html.indexOf('<ul>', contentStart);
    const liClose = html.indexOf('</li>', contentStart);
    if (nestedUlOpen !== -1 && (liClose === -1 || nestedUlOpen < liClose)) {
      const nested = parseUl(html, nestedUlOpen + 4);
      items.push(...nested.items);
      const afterClose = html.indexOf('</li>', nested.endPos);
      pos = afterClose === -1 ? nested.endPos : afterClose + 5;
    } else {
      items.push(html.slice(contentStart, liClose));
      pos = liClose + 5;
    }
  }
}

// A <td> can hold several sibling <h4>/<p>/<ul> groups (deeper sub-headings
// inside the B1 cell). Section tracking only cares about the heading above
// the table, so these inner groups are just skipped between <ul> blocks.
function extractLeafLis(tdContent) {
  const items = [];
  let cursor = 0;
  for (;;) {
    const ulOpen = tdContent.indexOf('<ul>', cursor);
    if (ulOpen === -1) break;
    const { items: liTexts, endPos } = parseUl(tdContent, ulOpen + 4);
    items.push(...liTexts);
    cursor = endPos;
  }
  return items;
}

// ---------------------------------------------------------------------------
// Headword-text rules (a <li> elso resze)
// ---------------------------------------------------------------------------

// Rule 1: split on "," / ";" but not inside parentheses or square brackets
// (a "[México, Cuba y Venezuela] a la mejor" region-tag list must survive as
// one piece, not "[México" + "Cuba y Venezuela] a la mejor"; FB363).
function splitOutsideParens(text) {
  const parts = [];
  let depth = 0;
  let buf = '';
  for (const ch of text) {
    if (ch === '(' || ch === '[') depth++;
    if (ch === ')' || ch === ']') depth = Math.max(0, depth - 1);
    if ((ch === ',' || ch === ';') && depth === 0) {
      parts.push(buf);
      buf = '';
    } else {
      buf += ch;
    }
  }
  parts.push(buf);
  return parts;
}

// Rule 2: tilde piece -> head + tail, tail split on "/", outer parens
// around the tail dropped ("(de Interior/de Defensa)" -> "de Interior/de Defensa").
function splitTildePiece(piece) {
  const idx = piece.indexOf('~');
  const head = piece.slice(0, idx).trim();
  let tail = piece.slice(idx + 1).trim();
  if (tail.startsWith('(') && tail.endsWith(')')) {
    tail = tail.slice(1, -1).trim();
  }
  return tail.split('/').map((t) => `${head} ${t.trim()}`.replace(/\s+/g, ' ').trim());
}

// Multiple tildes in one piece ("tener ~ una buena/una mala ~ actitud",
// "ser ~ bueno/malo ~ en/para/con"): split on every "~" into segments, split
// each segment on "/" into alternatives (no "/" -> one alternative); a
// parenthesised group with more than one alternative loses its outer parens
// ("(de Interior/de Defensa)" -> "de Interior", "de Defensa"), but a single-
// alternative parenthesised segment keeps them ("(de)" stays "(de)"). The
// result is the Cartesian product of all segments' alternatives, space-joined.
const MAX_TILDE_PRODUCT = 12;
const tildeProductTruncations = [];

function splitAltSegment(segment) {
  const trimmed = segment.trim();
  if (trimmed.startsWith('(') && trimmed.endsWith(')')) {
    const inner = trimmed.slice(1, -1).trim();
    if (inner.includes('/')) return inner.split('/').map((a) => a.trim());
    return [trimmed];
  }
  if (trimmed.includes('/')) return trimmed.split('/').map((a) => a.trim());
  return [trimmed];
}

function splitMultiTildePiece(piece) {
  const segments = piece
    .split('~')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  let combos = [''];
  for (const segment of segments) {
    const alts = splitAltSegment(segment);
    const next = [];
    for (const combo of combos) {
      for (const alt of alts) {
        next.push(combo ? `${combo} ${alt}` : alt);
      }
    }
    combos = next;
  }
  if (combos.length > MAX_TILDE_PRODUCT) {
    tildeProductTruncations.push({ piece, total: combos.length });
    combos = combos.slice(0, MAX_TILDE_PRODUCT);
  }
  return combos;
}

// Rule 3: no tilde -> split on "/" only when every side is a single word.
function splitSlashPiece(piece) {
  if (piece.includes('/')) {
    const parts = piece.split('/').map((p) => p.trim());
    if (parts.every((p) => p.length > 0 && !/\s/.test(p))) {
      return parts;
    }
    return [parts.join(' / ')];
  }
  return [piece];
}

// Rule 4 + 5: trim, collapse spaces, drop trailing ".", classify word/phrase.
function finalizeHeadword(raw) {
  let text = raw.replace(/\s+/g, ' ').trim();
  if (text.endsWith('.')) text = text.slice(0, -1).trim();
  if (text.length <= 1) return null;
  let kind;
  if (text.includes('[') || text.includes(' + ')) {
    kind = 'pattern';
  } else {
    kind = /\s/.test(text) ? 'phrase' : 'word';
  }
  return { es: text, kind };
}

function processHeadwordText(naked) {
  const out = [];
  for (const piece of splitOutsideParens(naked)) {
    const trimmed = piece.trim();
    if (!trimmed) continue;
    const tildeCount = (trimmed.match(/~/g) || []).length;
    let variants;
    if (tildeCount >= 2) {
      variants = splitMultiTildePiece(trimmed);
    } else if (tildeCount === 1) {
      variants = splitTildePiece(trimmed);
    } else {
      variants = splitSlashPiece(trimmed);
    }
    for (const variant of variants) {
      const item = finalizeHeadword(variant);
      if (item) out.push(item);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Per-<li> processing: headword segment(s) + <em> example sentences
// ---------------------------------------------------------------------------

function processLi(rawLiHtml) {
  // Drop trailing reference-only paragraphs, e.g. <p>[<a href="...">v. Gramatica 7.4.</a>]</p>.
  let html = rawLiHtml.replace(/<p>\s*\[[\s\S]*?\]\s*<\/p>/g, '');
  // Remaining <p> is just a transparent wrapper around the real content.
  html = html.replace(/<\/?p>/g, '');

  const rawParts = html.split(/<br\s*\/?\s*>/i);
  const headwordItems = processHeadwordText(stripTags(rawParts[0] ?? ''));
  const sentences = [];

  for (let i = 1; i < rawParts.length; i++) {
    const part = rawParts[i].trim();
    const emMatch = part.match(/^<em>([\s\S]*)<\/em>$/i);
    if (emMatch) {
      const text = stripTags(emMatch[1]);
      if (text.length > 1) {
        const kind = /[.?!]$/.test(text) ? 'sentence' : 'phrase';
        sentences.push({ es: text, kind });
      }
    } else {
      // A <br/>-part that is not a pure <em> example is additional headword
      // text (e.g. regional variants like "[Hispanoamerica] a la fija"),
      // not a sentence: run it through the same headword rules instead of
      // dropping it.
      const text = stripTags(part);
      if (text) headwordItems.push(...processHeadwordText(text));
    }
  }

  return { headwordItems, sentences };
}

// ---------------------------------------------------------------------------
// Document walk: headings (section) + <table> blocks (B1 = first <td>)
// ---------------------------------------------------------------------------

const collected = []; // { es, kind, source, section, headwordEs?, liGroup }
const skippedTables = [];
let liGroupCounter = 0;

for (const { tag, path } of SOURCES) {
  const text = readFileSync(path, 'utf8');
  const blockRe = /^(#{1,3})[ \t]+(.*)$|(<table>[\s\S]*?<\/table>)/gm;
  let currentSection = null;
  let match;

  while ((match = blockRe.exec(text))) {
    if (match[1]) {
      currentSection = cleanHeading(match[2]);
      continue;
    }
    const tableHtml = match[3];
    const theadMatch = tableHtml.match(/<thead>([\s\S]*?)<\/thead>/);
    const headers = theadMatch
      ? [...theadMatch[1].matchAll(/<th[^>]*>([\s\S]*?)<\/th>/g)].map((m) => stripTags(m[1]))
      : [];
    if (!(headers.length === 2 && headers[0] === HEADER_PAIR[0] && headers[1] === HEADER_PAIR[1])) {
      skippedTables.push({ source: tag, section: currentSection, headers });
      continue;
    }
    const tbodyMatch = tableHtml.match(/<tbody>([\s\S]*?)<\/tbody>/);
    if (!tbodyMatch) continue;
    const tdMatches = [...tbodyMatch[1].matchAll(/<td>([\s\S]*?)<\/td>/g)];
    const tdMatch = tdMatches[TD_INDEX];
    if (!tdMatch) continue;

    for (const liHtml of extractLeafLis(tdMatch[1])) {
      const { headwordItems, sentences } = processLi(liHtml);
      const firstEs = headwordItems.length > 0 ? headwordItems[0].es : null;
      for (const hw of headwordItems) {
        collected.push({ es: hw.es, kind: hw.kind, source: tag, section: currentSection, liGroup: liGroupCounter });
      }
      for (const example of sentences) {
        collected.push({
          es: example.es,
          kind: example.kind,
          source: tag,
          section: currentSection,
          headwordEs: firstEs,
          liGroup: liGroupCounter,
        });
      }
      liGroupCounter++;
    }
  }
}

// Stable, content-based id: sha1 of the lowercased/trimmed `es`, first 8 hex
// chars. Keeps pcic_cards.item_id valid across re-runs and rule fixes.
function stableId(es) {
  return `${level}-${createHash('sha1').update(es.toLowerCase().trim()).digest('hex').slice(0, 8)}`;
}

// Global dedup, first occurrence wins (kisbetus `es` szerint).
const idMap = new Map();
let order = 0;
const all = [];

for (const item of collected) {
  const key = item.es.toLowerCase();
  if (idMap.has(key)) continue;
  const id = stableId(item.es);
  idMap.set(key, id);

  const entry = { id, order, es: item.es, kind: item.kind, source: item.source, section: item.section };
  if (item.headwordEs != null) {
    const headwordId = idMap.get(item.headwordEs.toLowerCase());
    if (headwordId) entry.headword = headwordId;
  }
  entry._liGroup = item.liGroup;
  all.push(entry);
  order++;
}

const sample = all.filter((item) => item._liGroup % 5 === 0);

const strip = (item) => {
  const { _liGroup, ...rest } = item;
  return rest;
};

writeFileSync(`data/pcic/${level}-all.json`, JSON.stringify(all.map(strip), null, 2) + '\n');
writeFileSync(`data/pcic/${level}-sample.json`, JSON.stringify(sample.map(strip), null, 2) + '\n');

console.log(`${level}-all.json: ${all.length} items`);
console.log(`${level}-sample.json: ${sample.length} items`);
console.log(`skipped tables: ${skippedTables.length}`);
if (skippedTables.length) console.log(skippedTables);
console.log(`tilde-product truncated to ${MAX_TILDE_PRODUCT}: ${tildeProductTruncations.length}`);
if (tildeProductTruncations.length) console.log(tildeProductTruncations);
