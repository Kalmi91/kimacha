#!/usr/bin/env node
// Merge the per-agent card batches into one file per level, dropping anything
// that collides with the existing deck or with an earlier batch.
// Usage: node merge_batches.js <scratchdir>

const fs = require('fs');
const path = require('path');
const SP = process.argv[2];
const ROOT = '/home/kalmi/ai/kimacha';

const fold = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const bare = (s) => fold(s).replace(/^(el|la|los|las|un|una|unos|unas)\s+/, '');

const FIELDS = ['es', 'hu', 'en', 'de', 'sentence_es', 'sentence_hu', 'sentence_en', 'sentence_de'];
const DE_ART = /^(der|die|das|ein|eine|einem|einer|eines)\s+/i;

// keys already in the deck
const keys = new Set();
for (const lv of ['a0', 'a1', 'a2', 'b1', 'b2', 'c1', 'c2']) {
  for (const c of JSON.parse(fs.readFileSync(path.join(ROOT, 'data/words', lv + '.json'), 'utf8'))) {
    keys.add(fold(c.es));
    keys.add(bare(c.es));
  }
}

const groups = { B2: ['new_b2_1.json', 'new_b2_2.json', 'new_b2_3.json'],
                 C1: ['new_c1_1.json', 'new_c1_2.json', 'new_c1_3.json', 'new_c1_4.json'] };

const report = [];
for (const [level, files] of Object.entries(groups)) {
  const out = [];
  for (const f of files) {
    const p = path.join(SP, f);
    if (!fs.existsSync(p)) { report.push(`${f}: MISSING`); continue; }
    let cards;
    try { cards = JSON.parse(fs.readFileSync(p, 'utf8')); }
    catch (e) { report.push(`${f}: PARSE ERROR ${e.message}`); continue; }
    let dupes = 0, bad = 0;
    for (const c of cards) {
      const missing = FIELDS.filter((k) => !String(c[k] || '').trim());
      if (missing.length) { bad++; continue; }
      const k = bare(c.es);
      if (keys.has(fold(c.es)) || keys.has(k)) { dupes++; continue; }
      keys.add(fold(c.es)); keys.add(k);
      // strip a stray German article, the append script would only warn
      c.de = String(c.de).replace(DE_ART, '');
      out.push(Object.fromEntries(FIELDS.map((f2) => [f2, String(c[f2]).trim()])));
    }
    report.push(`${f}: in ${cards.length}, kept ${cards.length - dupes - bad}, dupe ${dupes}, incomplete ${bad}`);
  }
  fs.writeFileSync(path.join(SP, `merged_${level.toLowerCase()}.json`), JSON.stringify(out, null, 2) + '\n');
  report.push(`>> merged_${level.toLowerCase()}.json: ${out.length} cards`);
}
console.log(report.join('\n'));
