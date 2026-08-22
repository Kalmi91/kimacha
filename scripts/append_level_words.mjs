#!/usr/bin/env node
// Append new cards to a Spanish level file, the safe way.
//
// `append_words.py` predates the topic trees and the 2026-08-07 dedupe cleanup:
// it numbers from the global max id (which now runs into the en/hu id blocks),
// only dedupes the exact `es` string inside one level, and cannot fill in
// `topic` / `topicOrder`. This script does all four:
//
//   * ids come from --start-id upward, skipping every id already used anywhere
//     in data/words (shared deck + en/hu branch tracks), so no cross-track clash;
//   * a candidate is dropped if its headword (article stripped) is already in the
//     deck, or if it shares an en/hu sense with an existing card of the same
//     headword, i.e. exactly what corpusIntegrity.test.ts guards;
//   * topicOrder continues the card's own topic;
//   * field order matches the existing entries, output stays 2-space JSON.
//
// Usage:
//   node scripts/append_level_words.mjs --level A1 --input cards.json --start-id 3871
//   node scripts/append_level_words.mjs --level A1 --branch en --input cards.json --start-id 7600
//   ... add --dry-run to see what it would do.
//
// --branch en|hu appends to the English- or Hungarian-target track
// (data/words/<branch>/<level>.json) instead of the shared Spanish deck. On a
// branch the HEADWORD is the language being taught, so the duplicate rules compare
// English to English (or Hungarian to Hungarian), and only against that track: the
// same Spanish gloss legitimately appears in every track.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WORDS = path.join(ROOT, 'data', 'words');

const arg = (name, fallback = null) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : process.argv[i + 1];
};
const level = (arg('level') ?? '').toUpperCase();
const input = arg('input');
const startId = Number(arg('start-id'));
const dryRun = process.argv.includes('--dry-run');
// Kálmán 2026-08-20: "az en ághoz csináld meg az ág-kapcsolót". Without it the
// script could only grow the shared Spanish deck (data/words/<level>.json), so the
// English- and Hungarian-target tracks had no safe append path at all.
const branch = (arg('branch') ?? '').toLowerCase();
const BRANCHES = { en: 'en', hu: 'hu' };
if (branch && !BRANCHES[branch]) {
  console.error(`unknown branch "${branch}", expected one of: ${Object.keys(BRANCHES).join(', ')}`);
  process.exit(2);
}
if (!level || !input || !Number.isFinite(startId)) {
  console.error('usage: --level A1 --input cards.json --start-id 3871 [--branch en|hu] [--dry-run]');
  process.exit(2);
}

const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));

// Every word file that exists, branch tracks included: ids must be unique across
// all of them, because findWordById falls back to the shared deck.
const allWordFiles = [];
const walk = (dir) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p);
    else if (entry.name.endsWith('.json') && !entry.name.includes('backup')) allWordFiles.push(p);
  }
};
walk(WORDS);

const usedIds = new Set();
for (const file of allWordFiles) for (const w of readJson(file)) usedIds.add(w.id);

// The headword of a card is the word being TAUGHT: Spanish on the shared deck,
// English on the en branch, Hungarian on the hu branch. The duplicate rules below
// all key on it, so a branch append compares English to English.
const headwordField = branch ? BRANCHES[branch] : 'es';
const ARTICLES = {
  es: /^(el|la|los|las|un|una)\s+/,
  en: /^(the|a|an|to)\s+/,
  hu: /^(a|az)\s+/,
};
const stripArticle = (s) =>
  String(s ?? '').toLowerCase().trim().replace(ARTICLES[headwordField], '');
// Same normalisation as corpusIntegrity.test.ts: articles off in every language
// the fields can carry, otherwise "az uzsonna" and "uzsonna" read as two words.
const senses = (s) =>
  new Set(
    String(s ?? '')
      .split(/[/,]/)
      .map((x) =>
        x
          .toLowerCase()
          .trim()
          .replace(/^(the|an|a|az|to)\s+/, '')
          .replace(/^(el|la|los|las)\s+/, '')
          .replace(/[.\s]+$/, '')
      )
      .filter(Boolean)
  );

// The pool a candidate is checked against is the track it joins, and only that
// track: the shared deck teaches Spanish headwords, the branches teach their own,
// so "the flashlight" being in the en branch says nothing about the Spanish deck
// and vice versa. Within a track the rule is unchanged, one headword per sense.
const wordsDir = branch ? path.join(WORDS, BRANCHES[branch]) : WORDS;
const trackFiles = allWordFiles.filter((f) => path.dirname(f) === wordsDir);
const existing = [];
for (const file of trackFiles) for (const w of readJson(file)) existing.push(w);
const byHeadword = new Map();
for (const w of existing) {
  const key = stripArticle(w[headwordField]);
  if (!byHeadword.has(key)) byHeadword.set(key, []);
  byHeadword.get(key).push(w);
}

const levelPath = path.join(wordsDir, `${level.toLowerCase()}.json`);
if (!fs.existsSync(levelPath)) {
  console.error(`no such level file: ${path.relative(ROOT, levelPath)}`);
  process.exit(2);
}
const levelCards = readJson(levelPath);
const nextOrder = new Map();
for (const w of levelCards) {
  if (!w.topic) continue;
  nextOrder.set(w.topic, Math.max(nextOrder.get(w.topic) ?? 0, Number(w.topicOrder) || 0));
}

// A card whose topic id is not in the level's topic tree is invisible: the Learn
// tab scopes every queue to a topic, so it would sit in the file forever without
// ever being taught. Caught the hard way on 2026-08-20 ("cualidades", a typo for
// a topic that only exists on the Spanish deck).
const topicsPath = path.join(ROOT, 'data', 'topics', ...(branch ? [BRANCHES[branch]] : []), `${level.toLowerCase()}.json`);
const knownTopics = fs.existsSync(topicsPath)
  ? new Set(readJson(topicsPath).map((t) => t.id))
  : null;

const REQUIRED = ['es', 'hu', 'en', 'de', 'sentence_es', 'sentence_hu', 'sentence_en', 'sentence_de'];
const candidates = readJson(path.resolve(input));
const added = [];
const skipped = [];
let id = startId;

for (const c of candidates) {
  const missing = REQUIRED.filter((f) => !String(c[f] ?? '').trim());
  if (missing.length) {
    skipped.push(`${c[headwordField] ?? c.es ?? '?'}: missing ${missing.join(', ')}`);
    continue;
  }
  // Two language fields carrying the SAME string is almost always a draft slip:
  // the author left the Hungarian word in the Spanish column (caught on the hu
  // branch 2026-08-20: "ritkán", "kétezer", "nem szabad"). Real cognates that
  // repeat across languages are rare enough to fix by hand.
  const sameFields = ['es', 'hu', 'en', 'de'].flatMap((a, i, all) =>
    all.slice(i + 1).filter((b) => String(c[a]).trim().toLowerCase() === String(c[b]).trim().toLowerCase()).map((b) => `${a}=${b}`)
  );
  if (sameFields.length) {
    skipped.push(`${c[headwordField] ?? '?'}: identical fields (${sameFields.join(', ')}), likely a wrong-language cell`);
    continue;
  }
  if (c.topic && knownTopics && !knownTopics.has(c.topic)) {
    skipped.push(`${c[headwordField] ?? '?'}: unknown topic "${c.topic}" for ${branch ? `${branch}/` : ''}${level}`);
    continue;
  }
  const key = stripArticle(c[headwordField]);
  // The sense check runs on the OTHER fields: two cards with the same headword are
  // the same card only if a meaning repeats. On a branch the headword is already
  // one of them, so it drops out of the sense pair (en branch: check hu + es).
  const senseFields = ['en', 'hu', 'es'].filter((f) => f !== headwordField);
  const clash = (byHeadword.get(key) ?? []).find((w) =>
    senseFields.some((field) => {
      const mine = senses(c[field]);
      for (const s of senses(w[field])) if (mine.has(s)) return true;
      return false;
    })
  );
  const label = c[headwordField];
  if (clash) {
    skipped.push(`${label}: already taught as ${clash.level} ${clash.id} (${clash[headwordField]})`);
    continue;
  }
  if (byHeadword.has(key) && !clash) {
    console.log(`  NOTE ${label}: same headword as an existing card, different sense, keeping it`);
  }
  while (usedIds.has(id)) id++;
  const order = (nextOrder.get(c.topic) ?? 0) + 1;
  nextOrder.set(c.topic, order);
  const card = {
    id,
    level,
    es: c.es,
    hu: c.hu,
    en: c.en,
    de: c.de,
    ...(c.topic ? { topic: c.topic, topicOrder: order } : {}),
    sentence_es: c.sentence_es,
    sentence_hu: c.sentence_hu,
    sentence_en: c.sentence_en,
    sentence_de: c.sentence_de,
    ...(c.note_hu ? { note_hu: c.note_hu, note_en: c.note_en, note_es: c.note_es, note_de: c.note_de } : {}),
  };
  usedIds.add(id);
  byHeadword.set(key, [...(byHeadword.get(key) ?? []), card]);
  added.push(card);
}

for (const line of skipped) console.log(`  SKIP ${line}`);
console.log(`\n${dryRun ? 'would add' : 'added'}: ${added.length}, skipped: ${skipped.length}`);
if (!added.length || dryRun) process.exit(0);

fs.writeFileSync(levelPath, `${JSON.stringify([...levelCards, ...added], null, 2)}\n`, 'utf8');
console.log(`${branch ? `${branch}/` : ''}${level}: ${levelCards.length} -> ${levelCards.length + added.length} cards, ids ${added[0].id}-${added[added.length - 1].id}`);
