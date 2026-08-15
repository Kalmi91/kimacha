#!/usr/bin/env node
/**
 * merge-hu-batch.mjs, merge authored Hungarian A1 card batches into the track.
 *
 * A batch file is a JSON array of 9-string rows:
 *   [topic, es, hu, en, de, sentence_es, sentence_hu, sentence_en, sentence_de]
 * which is what the content-authoring runs produce. This script assigns ids and
 * topicOrder, refuses anything malformed or duplicated, and (unless --write) only
 * reports. Topics still have to be declared in data/topics/hu/a1.json afterwards.
 *
 * Usage: node scripts/merge-hu-batch.mjs [--write] <batch.json> [batch2.json ...]
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const TARGET = join(ROOT, 'data/words/hu/a1.json');

const args = process.argv.slice(2);
const write = args.includes('--write');
const files = args.filter((a) => a !== '--write');
if (files.length === 0) {
  console.error('usage: node scripts/merge-hu-batch.mjs [--write] <batch.json> ...');
  process.exit(2);
}

const cards = JSON.parse(readFileSync(TARGET, 'utf8'));
const known = new Map(cards.map((c) => [c.hu.toLowerCase(), c.id]));
const usedIds = new Set(cards.map((c) => c.id));
const order = new Map();
for (const c of cards) order.set(c.topic, Math.max(order.get(c.topic) ?? 0, c.topicOrder));

let nextId = Math.max(...usedIds) + 1;
const accepted = [];
const rejected = [];

const LATIN_ONLY = /^[^ŐőŰű]*$/; // ő/ű never appear in es/en/de

for (const file of files) {
  let rows;
  try {
    rows = JSON.parse(readFileSync(file, 'utf8'));
  } catch (err) {
    rejected.push([file, '(file)', `unreadable: ${err.message}`]);
    continue;
  }
  if (!Array.isArray(rows)) {
    rejected.push([file, '(file)', 'not a JSON array']);
    continue;
  }
  for (const row of rows) {
    const label = Array.isArray(row) ? row[2] : '(row)';
    if (!Array.isArray(row) || row.length !== 9 || row.some((v) => typeof v !== 'string' || !v.trim())) {
      rejected.push([file, label, 'row is not 9 non-empty strings']);
      continue;
    }
    const [topic, es, hu, en, de, ses, shu, sen, sde] = row.map((v) => v.trim());
    const key = hu.toLowerCase();
    if (known.has(key)) {
      rejected.push([file, hu, `headword already taught (id ${known.get(key)})`]);
      continue;
    }
    if (!shu.toLowerCase().includes(hu.replace(/^(a|az) /, '').toLowerCase().split(' ')[0].slice(0, 4))) {
      rejected.push([file, hu, 'example sentence does not contain the headword']);
      continue;
    }
    // A Hungarian-only letter in a Spanish/English/German field means the
    // authoring leaked the wrong language into the translation.
    for (const [field, value] of [['es', es], ['en', en], ['de', de], ['sentence_es', ses], ['sentence_en', sen], ['sentence_de', sde]]) {
      if (!LATIN_ONLY.test(value)) rejected.push([file, hu, `${field} contains Hungarian letters: ${value}`]);
    }
    known.set(key, nextId);
    order.set(topic, (order.get(topic) ?? 0) + 1);
    accepted.push({
      id: nextId++,
      level: 'A1',
      es, hu, en, de,
      topic,
      topicOrder: order.get(topic),
      sentence_es: ses,
      sentence_hu: shu,
      sentence_en: sen,
      sentence_de: sde,
    });
  }
}

for (const [file, word, why] of rejected) console.log(`SKIP  ${file.split('/').pop()}  ${word}: ${why}`);
const byTopic = {};
for (const c of accepted) byTopic[c.topic] = (byTopic[c.topic] ?? 0) + 1;
console.log(`\naccepted ${accepted.length}, rejected ${rejected.length}`);
console.log('per topic:', Object.entries(byTopic).map(([t, n]) => `${t}:${n}`).join(' '));

if (write && accepted.length > 0) {
  writeFileSync(TARGET, JSON.stringify([...cards, ...accepted], null, 2) + '\n');
  console.log(`\nwrote ${cards.length + accepted.length} cards to data/words/hu/a1.json`);
} else {
  console.log('\ndry run, pass --write to apply');
}
