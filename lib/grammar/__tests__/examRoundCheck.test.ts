// The gate script of the exam round's gap texts (scripts/exam-round-check.mjs): a generated good file passes, each rule has a
// bad copy (a good one with one thing broken), and the SHIPPED files under data/grammar/exam-round must pass, so a bad file
// fails test:ci too. The script runs as a process, like the gate.

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ROOT = path.join(__dirname, '..', '..', '..');
const SCRIPT = path.join(ROOT, 'scripts', 'exam-round-check.mjs');

type Json = any;

let tmp: string;
beforeAll(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'exam-round-check-'));
});
afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));

function run(...args: string[]) {
  const r = spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8' });
  const out = `${r.stdout}${r.stderr}`.trim();
  return { status: r.status, out, last: out.split(/\r?\n/).pop() ?? '' };
}

// the written A1 topics of the Spanish syllabus (the same rule as the script)
const A1: string[] = (JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'grammar', 'syllabus.json'), 'utf8')).topics as { id: string; level: string }[])
  .filter((tp) => tp.level === 'A1' && fs.existsSync(path.join(ROOT, 'data', 'games', 'grammar', 'es', `${tp.id}.json`)))
  .map((tp) => tp.id);

// 70 filler words plus the markers: inside the A1 band
const FILLER = (n: number) => Array.from({ length: n }, (_, i) => `palabra${String.fromCharCode(97 + (i % 26))}`).join(' ');
const body = () => ['uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis'].map((w, i) => `${FILLER(11)} ${w} {{${i + 1}}}`).join(' ') + ' fin';

/** 12 texts, 72 gaps over the topics in turn: every topic 2-3 times, 6 different topics per text, positions 0/1/2 balanced. */
function good(): Json {
  const texts = Array.from({ length: 12 }, (_, t) => ({
    id: `es-a1-${String(t + 1).padStart(2, '0')}`,
    title: `Texto ${t + 1}`,
    text: body(),
    gaps: Array.from({ length: 6 }, (_, i) => {
      const k = t * 6 + i;
      const correct = k % 3;
      const options = ['x', 'y', 'z'].map((c) => `${c}${k}`);
      return { options, correct, topic: A1[k % A1.length] };
    }),
  }));
  return { lang: 'es', level: 'A1', texts };
}

let counter = 0;
function write(data: Json, name = 'es-a1.json'): string {
  const dir = path.join(tmp, `case-${counter++}`);
  fs.mkdirSync(dir);
  const file = path.join(dir, name);
  fs.writeFileSync(file, JSON.stringify(data));
  return file;
}
function broken(change: (data: Json) => void, ...flags: string[]) {
  const data = good();
  change(data);
  return run(...flags, write(data));
}
const fails = (r: ReturnType<typeof run>, rule: string) => {
  expect(r.status).toBe(1);
  expect(r.out).toMatch(new RegExp(`ERROR ${rule}:`));
  expect(r.last).toMatch(/^exam-round-check: FAIL/);
};

describe('exam-round-check', () => {
  it('the generated fixture needs enough A1 topics', () => {
    expect(A1.length).toBeGreaterThanOrEqual(12);
  });

  it('a good file passes', () => {
    const r = run(write(good()));
    expect(r.out).toBe('exam-round-check: OK (1 files, 0 errors, 0 warnings)');
    expect(r.status).toBe(0);
  });

  it('the shipped files pass (an empty texts list is only a warning)', () => {
    const r = run();
    expect(r.last).toMatch(/^exam-round-check: OK/);
  });

  it('an empty texts list: a warning, an error with --strict', () => {
    const empty = { lang: 'es', level: 'A1', texts: [] };
    expect(run(write(empty)).last).toBe('exam-round-check: OK (1 files, 0 errors, 1 warnings)');
    expect(run('--strict', write(empty)).last).toBe('exam-round-check: FAIL (1 files, 1 errors, 0 warnings)');
  });

  it('R1: the header must match the file name, ids unique and well formed', () => {
    fails(run(write(good(), 'es-a2.json')), 'R1');
    fails(broken((d) => (d.lang = 'en')), 'R1');
    fails(broken((d) => (d.texts[1].id = d.texts[0].id)), 'R1');
    fails(broken((d) => (d.texts[0].id = 'es-a1-1')), 'R1');
  });

  it('R2: markers, gap count, a word between markers, the word band', () => {
    fails(broken((d) => (d.texts[0].text = d.texts[0].text.replace('{{3}}', '{{4}} {{3}}'))), 'R2');
    fails(broken((d) => (d.texts[0].text = d.texts[0].text.replace('{{2}}', '{{1}}'))), 'R2');
    fails(broken((d) => (d.texts[0].text = d.texts[0].text.replace(/\{\{3\}\}[^{]*\{\{4\}\}/, '{{3}} {{4}}'))), 'R2');
    fails(broken((d) => d.texts[0].gaps.pop()), 'R2');
    fails(broken((d) => (d.texts[0].text = FILLER(10) + ' {{1}} a {{2}} b {{3}} c {{4}} d {{5}} e {{6}}')), 'R2');
    fails(broken((d) => (d.texts[0].text = d.texts[0].text + ' ' + FILLER(60))), 'R2');
    fails(run(write({ ...good(), level: 'A2' }, 'es-a2.json')), 'R2');
  });

  it('R3: three different non-empty options, correct in range, a known topic', () => {
    fails(broken((d) => d.texts[0].gaps[0].options.pop()), 'R3');
    fails(broken((d) => (d.texts[0].gaps[0].options[1] = d.texts[0].gaps[0].options[0].toUpperCase())), 'R3');
    fails(broken((d) => (d.texts[0].gaps[0].options[2] = ' ')), 'R3');
    fails(broken((d) => (d.texts[0].gaps[0].correct = 3)), 'R3');
    fails(broken((d) => (d.texts[0].gaps[0].topic = 'no-such-topic')), 'R3');
  });

  it('R4: at least 4 different topics in a text, none more than twice', () => {
    fails(broken((d) => d.texts[0].gaps.forEach((g: Json, i: number) => (g.topic = A1[i % 3]))), 'R4');
    fails(broken((d) => d.texts[0].gaps.forEach((g: Json, i: number) => (g.topic = A1[i < 3 ? 0 : i]))), 'R4');
  });

  it('R5: at least 10 texts; every topic 2 gaps or skipped with a reason, at most 3, a skipped topic has no gap', () => {
    fails(broken((d) => d.texts.splice(9)), 'R5');
    // a topic whose gaps are all moved elsewhere has fewer than 2
    fails(broken((d) => d.texts.forEach((x: Json) => x.gaps.forEach((g: Json) => g.topic === A1[0] && (g.topic = A1[1])))), 'R5');
    const skipOk = good();
    skipOk.texts.forEach((x: Json) => x.gaps.forEach((g: Json) => g.topic === A1[0] && (g.topic = A1[1])));
    skipOk.skip = [{ topic: A1[0], why: 'no gap fits an exam text' }];
    expect(run(write(skipOk)).out).not.toMatch(/ERROR R5/);
    fails(broken((d) => (d.skip = [{ topic: A1[0], why: 'x' }])), 'R5'); // skipped but has gaps
    fails(broken((d) => (d.skip = [{ topic: A1[0], why: '' }])), 'R5');
    fails(broken((d) => (d.skip = A1.slice(0, 4).map((topic) => ({ topic, why: 'x' })))), 'R5');
  });

  it('R6: the position of the right option is balanced', () => {
    fails(broken((d) => d.texts.forEach((x: Json) => x.gaps.forEach((g: Json) => (g.correct = 0)))), 'R6');
    // balanced over the file, but one text has the same position 4 times
    fails(
      broken((d) => {
        d.texts[0].gaps.forEach((g: Json, i: number) => (g.correct = i < 4 ? 1 : 0));
        d.texts[1].gaps.forEach((g: Json, i: number) => (g.correct = i < 4 ? 0 : 1));
      }),
      'R6',
    );
  });

  it('R7: no em dash, no vosotros form, no Spain-only word', () => {
    fails(broken((d) => (d.texts[0].title = `Un ${String.fromCharCode(0x2014)} texto`)), 'R7');
    fails(broken((d) => (d.texts[0].gaps[0].options[0] = 'vosotros')), 'R7');
    fails(broken((d) => (d.texts[0].text += ' el ordenador')), 'R7');
    fails(broken((d) => (d.texts[0].text += ' os llamo')), 'R7');
  });

  it('R7: vosotros verb forms fail (tenéis, habláis, sois), the numbers dieciséis and veintiséis do not', () => {
    fails(broken((d) => (d.texts[0].gaps[0].options[0] = 'tenéis')), 'R7');
    fails(broken((d) => (d.texts[0].gaps[0].options[0] = 'habláis')), 'R7');
    fails(broken((d) => (d.texts[0].text += ' vosotros sois')), 'R7');
    fails(broken((d) => (d.texts[0].text += ' vais')), 'R7');
    const ok = run(write((() => { const d = good(); d.texts[0].text += ' dieciséis y veintiséis'; return d; })()));
    expect(ok.out).toBe('exam-round-check: OK (1 files, 0 errors, 0 warnings)');
    // país and París end in ís and stay allowed
    const pais = good();
    pais.texts[0].gaps[0].options[0] = 'país';
    expect(run(write(pais)).out).not.toMatch(/ERROR R7/);
  });

  it('a file that is not JSON fails', () => {
    const dir = path.join(tmp, `case-${counter++}`);
    fs.mkdirSync(dir);
    const file = path.join(dir, 'es-a1.json');
    fs.writeFileSync(file, '{ nope');
    fails(run(file), 'R1');
  });
});
