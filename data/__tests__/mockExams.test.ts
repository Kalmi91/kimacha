// The authored B1-C1 practice-exam papers (data/exams/mock/*.json): every file passes scripts/mock-exam-check.mjs (the
// format of PLAN-vizsga-b1c1.md: task order, counts, text lengths, schema, es norm). A file with no forms yet is only a
// warning here; `node scripts/mock-exam-check.mjs --strict` is the gate for finished content.

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { MOCK_AUTHORED } from '../exams/mock';

const ROOT = path.join(__dirname, '..', '..');
const DIR = path.join(ROOT, 'data', 'exams', 'mock');
const SCRIPT = path.join(ROOT, 'scripts', 'mock-exam-check.mjs');

const FILES = [
  ...['b1', 'b2', 'c1'].flatMap((level) => ['reading', 'listening', 'writing'].map((paper) => `es-${level}-${paper}.json`)),
  ...['reading', 'writing', 'listening'].map((paper) => `en-b1-${paper}.json`),
  ...['b2', 'c1'].flatMap((level) => ['readinguse', 'writing', 'listening'].map((paper) => `en-${level}-${paper}.json`)),
  // the speaking paper of every level (A1-C1), both directions
  ...['es', 'en'].flatMap((target) => ['a1', 'a2', 'b1', 'b2', 'c1'].map((level) => `${target}-${level}-speaking.json`)),
];

// hu (Hungarian, E90): the same 14 papers as es (A1 / A2 speaking only, B1-C1 four papers each). A hu B2 / C1 file that is not
// written yet may be missing; once it is on disk it is checked and wired like the others.
const HU_FILES = [
  ...['a1', 'a2'].map((level) => `hu-${level}-speaking.json`),
  ...['b1', 'b2', 'c1'].flatMap((level) => ['reading', 'listening', 'writing', 'speaking'].map((paper) => `hu-${level}-${paper}.json`)),
];
const HU_PENDING = HU_FILES.filter((name) => /^hu-(b2|c1)-/.test(name));
const ON_DISK = fs.readdirSync(DIR).filter((n) => n.endsWith('.json') && n !== 'photos.json');
const CHECKED = [...FILES, ...HU_FILES.filter((name) => ON_DISK.includes(name))];

describe('data/exams/mock', () => {
  it('has the 28 es / en paper files (18 B1-C1 papers + 10 speaking papers) and the hu ones (14 once B2 / C1 are written), one per direction, level and paper', () => {
    expect(FILES).toHaveLength(28);
    expect(HU_FILES).toHaveLength(14);
    // photos.json is the photo registry of the speaking papers (S5), not a paper file
    expect([...ON_DISK].sort()).toEqual([...CHECKED].sort());
    // only the pending hu B2 / C1 papers may be missing
    expect(HU_FILES.filter((name) => !ON_DISK.includes(name)).every((name) => HU_PENDING.includes(name))).toBe(true);
  });

  it('the registry lists exactly those files (a hu B2 / C1 file on disk is wired once it is written; until then it is only checked)', () => {
    const named = MOCK_AUTHORED.map((f) => `${f.target}-${f.level.toLowerCase()}-${f.paper}.json`);
    expect(named.every((name) => CHECKED.includes(name))).toBe(true);
    expect([...CHECKED.filter((name) => !HU_PENDING.includes(name))].sort()).toEqual([...named.filter((name) => !HU_PENDING.includes(name))].sort());
    for (const f of MOCK_AUTHORED) expect(Array.isArray(f.forms)).toBe(true);
  });

  it.each(CHECKED)('%s passes the check', (name) => {
    const r = spawnSync(process.execPath, [SCRIPT, path.join(DIR, name)], { encoding: 'utf8' });
    const out = `${r.stdout}${r.stderr}`;
    expect(out).not.toMatch(/^ERROR/m);
    expect(r.status).toBe(0);
  });
});
