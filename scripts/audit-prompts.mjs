#!/usr/bin/env node
/**
 * audit-prompts.mjs, PROMPT-POLICY 1 + 9: listázza azokat a szó-párokat
 * (fürtöket), ahol egy szinten belül két szónak ugyanaz (vagy résszel
 * átfedő) a promptja, tehát a tanuló nem tudja eldönteni, melyik szót
 * kérdezi a kártya. Ez a PROMPT-POLICY 9.1 "egyszeri korpusz-menet" input
 * listája: a scripts/audit-prompts.md a korpusz-kör (4. lépés) forrása.
 *
 * Run: node scripts/audit-prompts.mjs
 *
 * A fürt-logika a lib/promptOverlap.ts-ben él; ez a szkript .mjs, nem tud
 * TS-t importálni build-lépés nélkül, ezért az alábbi négy függvény
 * (isConjugatedForm/normalizeSense/promptSenses/bareSense/normalizedPrompt/
 * findPromptOverlaps) DUPLIKÁLVA van innen, ha az egyik oldalon változik
 * a szabály, a másikon is át kell vezetni (keep in sync; a
 * lib/__tests__/promptOverlap.test.ts a TS oldalt fedi).
 */

import { readFileSync, readdirSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// --- same as lib/promptOverlap.ts, keep in sync -----------------------------

const ARTICLES = {
  en: /^(the|a|an)\s+/,
  es: /^(el|la|los|las|un|una|unos|unas)\s+/,
  hu: /^az?\s+/,
};

function isConjugatedForm(headword) {
  return headword.includes('(');
}

function stripArticle(sense, lang) {
  const re = ARTICLES[lang];
  return re ? sense.replace(re, '') : sense;
}

function normalizeSense(raw, lang) {
  return stripArticle(raw.trim().toLowerCase(), lang).replace(/[.\s]+$/, '').trim();
}

function promptSenses(prompt, lang) {
  return prompt.split(' / ').map((part) => normalizeSense(part, lang)).filter(Boolean);
}

function bareSense(sense) {
  return sense.replace(/\s*\([^)]*\)\s*$/, '').trim();
}

function normalizedPrompt(prompt, lang) {
  return promptSenses(prompt, lang).join(' / ');
}

function findPromptOverlaps(words, lang) {
  const active = words.filter((w) => !isConjugatedForm(w.headword) && w.prompt.trim());
  const clusters = [];

  // 1) EXACT
  const byFullPrompt = new Map();
  for (const w of active) {
    const key = normalizedPrompt(w.prompt, lang);
    const list = byFullPrompt.get(key) ?? [];
    list.push(w);
    byFullPrompt.set(key, list);
  }
  const exactIds = new Set();
  for (const list of byFullPrompt.values()) {
    if (list.length < 2) continue;
    clusters.push({ kind: 'exact', sense: null, words: list });
    for (const w of list) exactIds.add(w.id);
  }

  // 2) PARTIAL, csak azok közt, akik nem már exact-duplikátumok.
  const rest = active.filter((w) => !exactIds.has(w.id));
  const keyIndex = new Map();
  for (const w of rest) {
    const keys = new Set();
    for (const sense of promptSenses(w.prompt, lang)) {
      keys.add(sense);
      keys.add(bareSense(sense));
    }
    for (const key of keys) {
      const list = keyIndex.get(key) ?? [];
      list.push(w);
      keyIndex.set(key, list);
    }
  }
  const indexOf = new Map(rest.map((w, i) => [w.id, i]));
  const parent = rest.map((_, i) => i);
  const find = (i) => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]];
      i = parent[i];
    }
    return i;
  };
  const union = (a, b) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[ra] = rb;
  };
  for (const list of keyIndex.values()) {
    if (list.length < 2) continue;
    const first = indexOf.get(list[0].id);
    for (let j = 1; j < list.length; j++) union(first, indexOf.get(list[j].id));
  }
  const groups = new Map();
  rest.forEach((w, i) => {
    const r = find(i);
    const list = groups.get(r) ?? [];
    list.push(w);
    groups.set(r, list);
  });
  for (const groupWords of groups.values()) {
    if (groupWords.length < 2) continue;
    const groupIds = new Set(groupWords.map((w) => w.id));
    let sense = null;
    for (const [key, kwords] of keyIndex) {
      if (kwords.filter((w) => groupIds.has(w.id)).length >= 2) {
        sense = key;
        break;
      }
    }
    clusters.push({ kind: 'partial', sense, words: groupWords });
  }

  return clusters;
}

// --- end duplicated block -----------------------------------------------

// PROMPT-POLICY facts (2026-09-14 spec header): a "prompt field" az a mező,
// amit a tanuló olvas és el kell döntenie, melyik tanult szóra gondol a
// kártya; a "headword" az a mező, amit tanul (ez adja a ragozott-alak szűrést,
// PROMPT-POLICY 8). Mindhárom sáv ugyanazt a WordEntry szerkezetet hordozza,
// csak a headword/prompt mező más-más.
const BANDS = [
  {
    label: 'es',
    dir: join(ROOT, 'data/words'),
    headwordField: 'es',
    promptField: 'en',
    promptLang: 'en',
    expected: { exact: 17, partial: 179 },
  },
  {
    label: 'hu',
    dir: join(ROOT, 'data/words/hu'),
    headwordField: 'hu',
    promptField: 'en',
    promptLang: 'en',
    expected: { exact: 24, partial: 19 },
  },
  {
    label: 'en',
    dir: join(ROOT, 'data/words/en'),
    headwordField: 'en',
    promptField: 'hu',
    promptLang: 'hu',
    expected: { exact: 11, partial: 26 },
  },
];

function loadWords(dir) {
  const files = readdirSync(dir).filter((f) => f.endsWith('.json'));
  const byLevel = new Map();
  for (const file of files) {
    const entries = JSON.parse(readFileSync(join(dir, file), 'utf8'));
    for (const w of entries) {
      const list = byLevel.get(w.level) ?? [];
      list.push(w);
      byLevel.set(w.level, list);
    }
  }
  return byLevel;
}

let report = `# Prompt policy audit (PROMPT-POLICY 1 + 9)\n\n`;
report += `Generated: ${new Date().toISOString()}\n\n`;
report += `Ez a riport a PROMPT-POLICY 9.1 "egyszeri korpusz-menet" bemenete: minden\n`;
report += `sor egy szó, ami egy másik szóval megosztja a promptját (egy szinten belül).\n`;
report += `A \`[exact]\` a teljesen azonos promptot jelöli, a \`[partial: <sense>]\` a\n`;
report += `részleges átfedést és annak okát (a közös, normalizált sense).\n\n`;

const summaryLines = [];

for (const band of BANDS) {
  const byLevel = loadWords(band.dir);
  const levels = [...byLevel.keys()].sort();
  let exactTotal = 0;
  let partialTotal = 0;
  report += `## ${band.label} sáv\n\n`;
  report += `- headword mező: \`${band.headwordField}\`, prompt mező: \`${band.promptField}\`\n`;
  report += `- spec-elvárás: ${band.expected.exact} exact + ${band.expected.partial} partial\n\n`;

  for (const level of levels) {
    const words = byLevel.get(level);
    const inputs = words.map((w) => ({
      id: w.id,
      headword: String(w[band.headwordField] ?? ''),
      prompt: String(w[band.promptField] ?? ''),
    }));
    const clusters = findPromptOverlaps(inputs, band.promptLang);
    if (clusters.length === 0) continue;

    report += `### ${level}\n\n`;
    for (const cluster of clusters) {
      const tag = cluster.kind === 'exact' ? '[exact]' : `[partial: ${cluster.sense}]`;
      report += `${tag}\n`;
      for (const w of cluster.words) {
        const full = words.find((x) => x.id === w.id);
        const note = String(full?.note_en ?? full?.note_hu ?? full?.note_es ?? '').slice(0, 60);
        report += `- ${w.id} | ${w.headword} | ${w.prompt}${note ? ` | ${note}` : ''}\n`;
      }
      report += `\n`;
      if (cluster.kind === 'exact') exactTotal += cluster.words.length;
      else partialTotal += cluster.words.length;
    }
  }

  const matchNote =
    exactTotal === band.expected.exact && partialTotal === band.expected.partial
      ? 'matches spec'
      : 'DIFFERS from spec';
  summaryLines.push(`${band.label}: ${exactTotal} exact, ${partialTotal} partial (${matchNote})`);
}

report += `## Summary\n\n`;
for (const line of summaryLines) report += `- ${line}\n`;

writeFileSync(join(ROOT, 'scripts/audit-prompts.md'), report, 'utf8');

console.log('Prompt policy audit complete.');
for (const line of summaryLines) console.log(line);
console.log('Report: scripts/audit-prompts.md');
