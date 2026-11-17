// The content gate of the task types (scripts/grammar-task-gate.mjs): every core topic of a SWITCHED-ON level has at
// least N items of every type the level uses. The shipped data pass (no level is on yet); a fixture with a missing type
// fails naming the topic and the type; `--all` shows the shipped A1 as the gate would see it.

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { coreTopicsForLevel } from '../taskTypes';

const ROOT = path.join(__dirname, '..', '..', '..');
const SCRIPT = path.join(ROOT, 'scripts', 'grammar-task-gate.mjs');

function run(...args: string[]) {
  const r = spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8' });
  const out = `${r.stdout}${r.stderr}`.trim();
  return { status: r.status, out, last: out.split(/\r?\n/).pop() ?? '' };
}

let tmp: string;
beforeAll(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'grammar-task-gate-'));
});
afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));

const TYPES = { choice: ['choice'], form: ['form', 'noun'], opencloze: ['opencloze'] };
const items = (kind: string, n: number) => Array.from({ length: n }, (_, i) => ({ id: `${kind}-${i}`, kind: kind === 'choice' ? 'gap' : kind }));

function fixture(name: string, enabled: boolean, perType: Record<string, number>, exempt?: Record<string, string[]>) {
  const dir = path.join(tmp, name);
  fs.mkdirSync(path.join(dir, 'lessons'), { recursive: true });
  const config = path.join(dir, 'config.json');
  fs.writeFileSync(
    config,
    JSON.stringify({ minPerType: 5, ...(exempt ? { exempt } : {}), coreTiers: ['core', 'core-plus'], types: TYPES, levels: { A1: { enabled, types: ['choice', 'form', 'opencloze'] } } })
  );
  const syllabus = path.join(dir, 'syllabus.json');
  fs.writeFileSync(syllabus, JSON.stringify({ topics: [{ id: 'topic-core', level: 'A1' }, { id: 'topic-exam', level: 'A1' }] }));
  const tiers = path.join(dir, 'tiers.json');
  fs.writeFileSync(tiers, JSON.stringify({ 'topic-core': 'core-plus', 'topic-exam': 'exam' }));
  const all = [...items('choice', perType.choice ?? 0), ...items('form', perType.form ?? 0), ...items('noun', perType.noun ?? 0), ...items('opencloze', perType.opencloze ?? 0)];
  fs.writeFileSync(path.join(dir, 'lessons', 'topic-core.json'), JSON.stringify({ topic: 'topic-core', items: all }));
  fs.writeFileSync(path.join(dir, 'lessons', 'topic-exam.json'), JSON.stringify({ topic: 'topic-exam', items: [] }));
  return ['--config', config, '--syllabus', syllabus, '--tiers', tiers, '--lessons', path.join(dir, 'lessons')];
}

describe('grammar-task-gate', () => {
  it('is green on the shipped files (all five levels are switched on and complete)', () => {
    const r = run();
    expect(r.status).toBe(0);
    expect(r.last).toBe('grammar-task-gate: OK (5 levels checked, 0 gaps)');
  });

  it('a switched-on level with a missing type FAILS, naming the topic and the type', () => {
    const r = run(...fixture('missing', true, { choice: 5, form: 5, opencloze: 4 }));
    expect(r.status).toBe(1);
    expect(r.out).toContain('topic-core');
    expect(r.out).toContain('opencloze');
    expect(r.out).toContain('4/5');
    expect(r.last).toMatch(/^grammar-task-gate: FAIL/);
  });

  it('a type with no item at all fails too (the test would silently skip it)', () => {
    const r = run(...fixture('zero', true, { choice: 5, form: 5 }));
    expect(r.status).toBe(1);
    expect(r.out).toContain('0/5');
  });

  it('five of every type passes, `noun` counts under form, and only core topics are checked', () => {
    const r = run(...fixture('full', true, { choice: 5, form: 2, noun: 3, opencloze: 5 }));
    expect(r.status).toBe(0);
    expect(r.out).not.toContain('topic-exam');
    expect(r.last).toMatch(/^grammar-task-gate: OK/);
  });

  it('an exempt type is not required for that topic; without the exemption the gap shows', () => {
    const perType = { choice: 5, form: 0, opencloze: 5 };
    expect(run(...fixture('noexempt', true, perType)).out).toContain('topic-core form: 0/5');
    const r = run(...fixture('exempt', true, perType, { 'topic-core': ['form'] }));
    expect(r.status).toBe(0);
    expect(r.last).toMatch(/^grammar-task-gate: OK/);
  });

  it('an unknown topic or type in the exempt list is an error', () => {
    const topic = run(...fixture('exempt-topic', true, { choice: 5, form: 5, opencloze: 5 }, { nope: ['form'] }));
    expect(topic.status).toBe(1);
    expect(topic.out).toContain('unknown topic "nope"');
    const type = run(...fixture('exempt-type', true, { choice: 5, form: 5, opencloze: 5 }, { 'topic-core': ['nope'] }));
    expect(type.status).toBe(1);
    expect(type.out).toContain('unknown type "nope"');
  });

  it('a level that is switched off is not checked', () => {
    expect(run(...fixture('off', false, {})).status).toBe(0);
  });

  it('--all checks every level whatever its switch: the exit code says whether any gap is left', () => {
    const r = run('--all');
    const gaps = r.out.split('\n').filter((l) => l.startsWith('ERROR '));
    expect(r.status).toBe(gaps.length > 0 ? 1 : 0);
    expect(r.last).toMatch(/^grammar-task-gate: (OK|FAIL)/);
    expect(gaps).toEqual([]); // the core topics of every level, A1 to C1, have the content now
  });

  it('the script and the app read the same core topics (one marking: the syllabus tier)', () => {
    // an empty lessons folder: every core topic counts 0 items, so the script names all of them whatever the shipped data holds
    const empty = path.join(tmp, 'empty-lessons');
    fs.mkdirSync(empty, { recursive: true });
    const r = run('--all', '--lessons', empty);
    const scriptTopics = new Set([...r.out.matchAll(/^ERROR A1 (\S+) /gm)].map((m) => m[1]));
    expect([...scriptTopics].sort()).toEqual([...coreTopicsForLevel('A1')].sort());
  });
});
