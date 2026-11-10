// The gate script of the mock exam gap topics (scripts/mock-topic-check.mjs): the SHIPPED files pass (so a bad topic fails
// test:ci too) and a fixture with an unknown topic id fails naming the file, the task and the gap. The script runs as a
// process, like the gate.

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ROOT = path.join(__dirname, '..', '..', '..', '..');
const SCRIPT = path.join(ROOT, 'scripts', 'mock-topic-check.mjs');

function run(...args: string[]) {
  const r = spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8' });
  const out = `${r.stdout}${r.stderr}`.trim();
  return { status: r.status, out, last: out.split(/\r?\n/).pop() ?? '' };
}

let tmp: string;
beforeAll(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mock-topic-check-'));
});
afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));

const fixture = (name: string, topics: (string | undefined)[], kind: 'cloze' | 'transform' = 'cloze') => {
  const file = path.join(tmp, name);
  const list = topics.map((topic) => (kind === 'cloze' ? { options: ['a', 'b', 'c'], correct: 0, ...(topic ? { topic } : {}) } : { first: 'a', key: 'k', before: 'b', after: 'c', answers: ['x'], ...(topic ? { topic } : {}) }));
  const task = kind === 'cloze' ? { kind, skill: 'reading', instruction: 'x', text: 'x', gaps: list } : { kind, skill: 'reading', instruction: 'x', items: list };
  fs.writeFileSync(file, JSON.stringify({ target: 'es', level: 'B1', paper: 'reading', forms: [{ id: 'f1', tasks: [{ kind: 'passage_mc', skill: 'reading', instruction: 'x' }, task] }] }), 'utf8');
  return file;
};

describe('mock-topic-check', () => {
  it('is green on the shipped files and prints tagged / gaps', () => {
    const r = run();
    expect(r.status).toBe(0);
    expect(r.last).toMatch(/^mock-topic-check: OK/);
    expect(r.out).toMatch(/es-b1-reading\.json: 4 \/ 6/);
  });

  it('is green on a fixture with known topics and untagged gaps', () => {
    const r = run(fixture('es-b1-reading.json', ['imperfecto', undefined, 'perfecto']));
    expect(r.status).toBe(0);
    expect(r.out).toMatch(/es-b1-reading\.json: 2 \/ 3/);
  });

  it('checks transform items too', () => {
    const r = run(fixture('es-b2-reading.json', ['nope-topic'], 'transform'));
    expect(r.status).toBe(1);
    expect(r.out).toMatch(/es-b2-reading\.json: forms\[0\] task 2 \(transform\) item 1: topic "nope-topic"/);
  });

  it('is red on an unknown topic id and names the file, the task and the gap', () => {
    const r = run(fixture('es-b1-reading.json', ['imperfecto', 'no-such-topic']));
    expect(r.status).toBe(1);
    expect(r.out).toMatch(/ERROR es-b1-reading\.json: forms\[0\] task 2 \(cloze\) gap 2: topic "no-such-topic"/);
    expect(r.last).toMatch(/^mock-topic-check: FAIL/);
  });

  it('is red on a topic of a language that has no syllabus file', () => {
    const r = run(fixture('en-b1-reading.json', ['imperfecto']));
    expect(r.status).toBe(1);
    expect(r.out).toMatch(/no syllabus file for the language "en"/);
  });
});
