// The gate script of the authored B1-C1 papers (scripts/mock-exam-check.mjs): a good fixture of each kind family passes,
// and each rule has a bad fixture (a good one with one thing broken). The script runs as a process, like the gate.
// Fixtures: lib/exam/mock/__tests__/fixtures (filler text of the exact lengths of the format, not real exam content).

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const SCRIPT = path.join(__dirname, '..', '..', '..', '..', 'scripts', 'mock-exam-check.mjs');
const FIXTURES = path.join(__dirname, 'fixtures');
const GOOD = ['es-b1-reading', 'en-b1-reading', 'en-b2-readinguse', 'es-c1-listening', 'es-b2-writing', 'en-c1-listening'];

// Fixtures are edited freely here, the script is what validates them.
type Json = any;

let tmp: string;
beforeAll(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mock-exam-check-'));
});
afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));

function run(...args: string[]) {
  const r = spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8' });
  const out = `${r.stdout}${r.stderr}`;
  return { status: r.status, out, lines: out.trim().split(/\r?\n/), last: out.trim().split(/\r?\n/).pop() ?? '' };
}

const good = (name: string): Json => JSON.parse(fs.readFileSync(path.join(FIXTURES, `${name}.good.json`), 'utf8'));
let counter = 0;
function write(data: Json, name = 'fixture'): string {
  const file = path.join(tmp, `${name}-${counter++}.json`);
  fs.writeFileSync(file, JSON.stringify(data));
  return file;
}
/** A good fixture with one thing changed; returns the check result of it. */
function broken(name: string, change: (data: Json) => void, ...flags: string[]) {
  const data = good(name);
  change(data);
  return run(...flags, write(data));
}
const tasks = (data: Json): Json[] => data.forms[0].tasks;
const cut = (text: string, words: number) => text.split(' ').slice(0, words).join(' ');

describe('good fixtures', () => {
  it.each(GOOD)('%s passes the check, also with --strict', (name) => {
    const file = path.join(FIXTURES, `${name}.good.json`);
    for (const flags of [[], ['--strict']]) {
      const r = run(...flags, file);
      expect(r.out).not.toMatch(/ERROR/);
      expect(r.status).toBe(0);
      expect(r.last).toBe('mock-exam-check: OK (1 files, 0 errors, 0 warnings)');
    }
  });

  it('several files at once, also with a * in the path (PowerShell does not expand it)', () => {
    const r = run(path.join(FIXTURES, '*.good.json'));
    expect(r.status).toBe(0);
    expect(r.last).toBe(`mock-exam-check: OK (${GOOD.length} files, 0 errors, 0 warnings)`);
    expect(run(path.join(FIXTURES, 'es-*.good.json')).last).toContain('(3 files');
  });

  it('only the given files are looked at: a broken file next to them is not', () => {
    const bad = write({ nonsense: true });
    const r = run(path.join(FIXTURES, 'es-b1-reading.good.json'));
    expect(r.status).toBe(0);
    expect(run(bad).status).toBe(1);
  });
});

describe('forms that are not written yet', () => {
  const empty = () => write({ target: 'es', level: 'B1', paper: 'reading', forms: [] });

  it('an empty forms list is a warning, an error with --strict', () => {
    const file = empty();
    const soft = run(file);
    expect(soft.status).toBe(0);
    expect(soft.out).toMatch(/WARN .*forms is empty: not written yet/);
    expect(soft.last).toBe('mock-exam-check: OK (1 files, 0 errors, 1 warnings)');
    const strict = run('--strict', file);
    expect(strict.status).toBe(1);
    expect(strict.last).toBe('mock-exam-check: FAIL (1 files, 1 errors, 0 warnings)');
  });
});

describe('the rules, each with a bad fixture', () => {
  const fails = (r: ReturnType<typeof run>, pattern: RegExp) => {
    expect(r.status).toBe(1);
    expect(r.out).toMatch(pattern);
    expect(r.last).toMatch(/^mock-exam-check: FAIL/);
  };

  it('marker error: the {{n}} markers must be 1..n once each, in order', () => {
    fails(broken('es-b1-reading', (d) => (tasks(d)[3].text = tasks(d)[3].text.replace('{{3}}', '{{4}}'))), /markers must be \{\{1\}\}\.\.\{\{n\}\} once each and in order/);
    fails(broken('es-b1-reading', (d) => (tasks(d)[3].text = tasks(d)[3].text.replace('{{2}}', '{{1}}'))), /markers must be/);
    fails(broken('es-b1-reading', (d) => (tasks(d)[4].text = tasks(d)[4].text.replace('{{6}}', 'xxx'))), /markers but|markers must be/);
  });

  it('wrong count: questions, gaps, prompts, options, fragments, tasks', () => {
    fails(broken('es-b1-reading', (d) => tasks(d)[1].questions.pop()), /5 questions, the format wants 6/);
    fails(broken('es-b1-reading', (d) => tasks(d)[0].prompts.pop()), /prompts, the format wants 6|answer must have exactly one entry per prompt id/);
    fails(broken('es-b1-reading', (d) => tasks(d)[0].options.pop()), /9 options, the format wants 10/);
    fails(broken('es-b1-reading', (d) => tasks(d)[3].fragments.pop()), /7 fragments, the format wants 8/);
    fails(broken('es-b1-reading', (d) => tasks(d)[1].questions[0].options.push('d')), /4 options, the format wants 3/);
    fails(broken('es-b1-reading', (d) => tasks(d).pop()), /4 tasks, the es-b1-reading format has 5/);
    fails(broken('es-c1-listening', (d) => tasks(d)[1].clips.pop()), /3 clips, the format wants 4/);
    fails(broken('en-b2-readinguse', (d) => tasks(d)[3].items.pop()), /5 items, the format wants 6/);
  });

  it('the order of the tasks, their kind, skill and marks are the format of the paper', () => {
    fails(broken('es-b1-reading', (d) => tasks(d).reverse()), /kind "cloze", the format wants "match_pool"/);
    fails(broken('en-b2-readinguse', (d) => (tasks(d)[0].skill = 'reading')), /skill "reading", the format wants "use"/);
    fails(broken('en-b2-readinguse', (d) => delete tasks(d)[3].marks), /marks 1, the format wants 2/);
    fails(broken('en-b2-readinguse', (d) => (tasks(d)[1].marks = 3)), /marks 3, the format wants 1/);
    fails(broken('es-b1-reading', (d) => (d.paper = 'bogus')), /there is no paper "bogus" in the es B1 format/);
  });

  it('unique violation: a unique pool uses an option once at most; the flag is the format flag', () => {
    fails(broken('es-b1-reading', (d) => (tasks(d)[0].answer.p2 = tasks(d)[0].answer.p1)), /unique is true but an option is the answer of more than one prompt/);
    fails(broken('es-b1-reading', (d) => (tasks(d)[0].unique = false)), /unique is false, the format wants true/);
    fails(broken('es-b1-reading', (d) => (tasks(d)[2].unique = true)), /unique is true, the format wants false/);
  });

  it('answer keys point at existing ids, in range, and a fragment fits one gap only', () => {
    fails(broken('es-b1-reading', (d) => (tasks(d)[0].answer.p1 = 'zz')), /answer\["p1"\] = "zz" is not an option id/);
    fails(broken('es-b1-reading', (d) => (tasks(d)[1].questions[2].correct = 3)), /questions\[2\]: correct \(3\) is not an index of the 3 options/);
    fails(broken('es-b1-reading', (d) => (tasks(d)[3].answer['2'] = 'nope')), /answer\["2"\] = "nope" is not a fragment id/);
    fails(broken('es-b1-reading', (d) => (tasks(d)[3].answer['2'] = tasks(d)[3].answer['1'])), /a fragment is the answer of more than one gap/);
    fails(broken('es-b1-reading', (d) => delete tasks(d)[3].answer['6']), /answer must have the keys|markers but/);
    fails(broken('es-b1-reading', (d) => (tasks(d)[4].gaps[0].correct = -1)), /gaps\[0\]: correct \(-1\)/);
    fails(broken('es-b1-reading', (d) => (tasks(d)[1].questions[0].options[1] = tasks(d)[1].questions[0].options[0])), /two options are the same/);
  });

  it('pick_statements: pick equals the number of right statements', () => {
    fails(broken('es-c1-listening', (d) => (tasks(d)[0].pick = 5)), /pick \(5\) must equal correct\.length \(6\)/);
    fails(broken('es-c1-listening', (d) => (tasks(d)[0].correct[0] = 99)), /correct must be a list of statement indices/);
    fails(broken('es-c1-listening', (d) => tasks(d)[0].statements.pop()), /11 statements, the format wants 12|statement indices/);
  });

  it('forbidden word (es norm): vosotros, coche, ordenador, zumo, móvil, os; and no em dash anywhere', () => {
    const words: [string, RegExp][] = [
      ['vosotros', /M6: .* "vosotr" is not Mexican usage/],
      ['El coche es rojo', /M6: .* "coche" is not Mexican usage/],
      ['mi ordenador nuevo', /"ordenador"/],
      ['un zumo de naranja', /"zumo"/],
      ['mi móvil nuevo', /"móvil"/],
      ['os lo digo', /"os"/],
    ];
    for (const [word, pattern] of words) fails(broken('es-b1-reading', (d) => (tasks(d)[1].text += ` ${word}`)), pattern);
    // the plain words that are only look-alikes do not trigger it
    expect(broken('es-b1-reading', (d) => (tasks(d)[1].text = cut(tasks(d)[1].text, 420) + ' los pozos del automóvil')).out).not.toMatch(/M6/);
    fails(broken('es-b1-reading', (d) => (tasks(d)[1].text += ' una cosa '+'\u2014'+' otra cosa')), /M7: .* em dash/);
    fails(broken('en-b2-readinguse', (d) => (tasks(d)[4].text += ' a thing '+'\u2013'+' another')), /M7: .* em dash/);
    // the English files are not held to the Spanish norm
    expect(broken('en-b2-readinguse', (d) => (tasks(d)[4].text += ' coche zumo')).out).not.toMatch(/M6/);
  });

  it('text lengths: 15% tolerance around the band (400-450 words: 340 passes, 335 does not; 517 passes, 520 does not)', () => {
    const passage = (n: number) => (d: Json) => (tasks(d)[1].text = cut(`${tasks(d)[1].text} ${tasks(d)[1].text}`, n));
    expect(broken('es-b1-reading', passage(341)).status).toBe(0);
    fails(broken('es-b1-reading', passage(335)), /the passage is 335 words, the format wants 400-450 \(\+-15%\)/);
    expect(broken('es-b1-reading', passage(517)).status).toBe(0);
    fails(broken('es-b1-reading', passage(520)), /the passage is 520 words/);
    fails(broken('es-b1-reading', (d) => (tasks(d)[0].options[0].text = cut(tasks(d)[0].options[0].text, 10))), /options\[0\]: the option text is 10 words/);
    fails(broken('es-c1-listening', (d) => (tasks(d)[0].audio = tasks(d)[0].audio.slice(0, 10))), /the recording is \d+ words, the format wants 700-750/);
  });

  it('essay: the official min / max words, the number of choices and the kind of input', () => {
    fails(broken('es-b2-writing', (d) => (tasks(d)[0].choices[0].minWords = 140)), /choices\[0\]: 140-180 words, the official limits are 150-180/);
    fails(broken('es-b2-writing', (d) => (tasks(d)[1].choices[1].maxWords = 200)), /choices\[1\]: 150-200 words, the official limits are 150-180/);
    fails(broken('es-b2-writing', (d) => tasks(d)[1].choices.pop()), /1 choices, the format wants 2/);
    fails(broken('es-b2-writing', (d) => delete tasks(d)[0].choices[0].audio), /a recorded input is needed here/);
    fails(broken('es-b2-writing', (d) => delete tasks(d)[1].choices[0].input), /a written input is needed here/);
    fails(broken('es-b2-writing', (d) => (tasks(d)[1].choices[0].points = [])), /points must be a non-empty list/);
    fails(broken('es-b2-writing', (d) => (tasks(d)[1].choices[0].points[0].keywords = [])), /keywords must be a non-empty list/);
  });

  it('gap kinds: multiple choice, open, word formation; accepted answers one word where the format says so', () => {
    fails(broken('en-b2-readinguse', (d) => delete tasks(d)[2].gaps[3].stem), /gaps\[3\]: a word-formation gap needs a stem/);
    fails(broken('en-b2-readinguse', (d) => (tasks(d)[1].gaps[0] = { options: ['a', 'b', 'c', 'd'], correct: 0 })), /gaps\[0\]: an open gap is needed here/);
    fails(broken('en-b2-readinguse', (d) => (tasks(d)[0].gaps[0] = { answers: ['x'] })), /gaps\[0\]: a multiple-choice gap is needed here/);
    fails(broken('en-b2-readinguse', (d) => (tasks(d)[1].gaps[0].stem = 'STEM')), /this open gap has no stem/);
    fails(broken('en-b1-reading', (d) => (tasks(d)[5].gaps[0].answers = ['two words'])), /gaps\[0\]: answer "two words" is not 1 word\(s\)/);
    fails(broken('en-b1-reading', (d) => (tasks(d)[0].clips[0].text = cut(`${tasks(d)[0].clips[0].text} ${tasks(d)[0].clips[0].text} ${tasks(d)[0].clips[0].text}`, 50))), /clips\[0\]: the clip is 50 words, the format wants at most 40 \(\+15%\)/);
  });

  it('the same recordings in the two matching tasks of the C1 listening', () => {
    fails(broken('en-c1-listening', (d) => (tasks(d)[4].prompts[0].audio[0].text = 'something else')), /the recordings must be the same as in task 4/);
  });

  it('schema: missing fields, unknown kind, bad audio line', () => {
    fails(broken('es-b1-reading', (d) => delete tasks(d)[1].instruction), /instruction must be a non-empty string/);
    fails(broken('es-b1-reading', (d) => (tasks(d)[1].kind = 'mystery')), /unknown kind "mystery"/);
    fails(broken('es-c1-listening', (d) => (tasks(d)[2].audio[0].speaker = 'x')), /speaker "x" is not m, f or n/);
    fails(broken('es-c1-listening', (d) => (tasks(d)[2].text = 'a written text too')), /exactly one of text \/ audio is needed/);
    fails(broken('es-b1-reading', (d) => (d.forms[0].id = '')), /needs an id and a task list/);
    fails(broken('es-b1-reading', (d) => d.forms.push({ id: 'f1', tasks: tasks(d) })), /form ids are not unique/);
    fails(broken('es-b1-reading', (d) => (d.target = 'fr')), /target "fr" must be es or en/);
    expect(run(path.join(tmp, 'does-not-exist.json')).out).toMatch(/the file does not exist/);
    expect(run('--bogus').status).toBe(1);
  });
});

/** A complete es B1 listening paper made of filler, to try the listening-only rules (the dialogue of task 5). */
function esB1Listening(): Json {
  const w = (n: number, k = 0) => Array.from({ length: n }, (_, i) => ['casa', 'grande', 'tiempo', 'amigo'][(i + k) % 4]).join(' ');
  const mc = (i: number, fixed = false) => ({ stem: `P${i}`, options: fixed ? ['Hombre', 'Mujer', 'Ninguno'] : [`a${i}`, `b${i}`, `c${i}`], correct: i % 3 });
  const lines = (n: number, speakers?: string[]) =>
    Array.from({ length: Math.ceil(n / 25) }, (_, i) => ({ ...(speakers ? { speaker: speakers[i % speakers.length] } : {}), text: w(Math.min(25, n - i * 25), i) }));
  const task = (rest: Json) => ({ skill: 'listening', instruction: 'Escuche.', ...rest });
  const six = <T>(make: (i: number) => T) => Array.from({ length: 6 }, (_, i) => make(i));
  return {
    target: 'es',
    level: 'B1',
    paper: 'listening',
    forms: [
      {
        id: 'f1',
        tasks: [
          task({ kind: 'clips_mc', clips: six((i) => ({ audio: lines(50), questions: [mc(i)] })) }),
          task({ kind: 'passage_mc', audio: lines(425), questions: six((i) => mc(i)) }),
          task({ kind: 'clips_mc', clips: six((i) => ({ audio: lines(62), questions: [mc(i)] })) }),
          task({
            kind: 'match_pool',
            prompts: six((i) => ({ id: `p${i + 1}`, audio: lines(60) })),
            options: Array.from({ length: 9 }, (_, i) => ({ id: String.fromCharCode(97 + i), text: w(10, i) })),
            answer: Object.fromEntries(six((i) => [`p${i + 1}`, String.fromCharCode(97 + i)])),
            unique: true,
          }),
          task({ kind: 'passage_mc', audio: lines(275, ['m', 'f']), questions: six((i) => mc(i, true)) }),
        ],
      },
    ],
  };
}

describe('es B1 listening: the dialogue needs a man and a woman and the fixed options', () => {
  const check = (change: (d: Json) => void) => {
    const data = esB1Listening();
    change(data);
    return run(write(data));
  };

  it('a complete paper passes', () => {
    const r = check(() => undefined);
    expect(r.out).not.toMatch(/ERROR/);
    expect(r.status).toBe(0);
  });

  it('only one speaker in the dialogue, or other options', () => {
    const r = check((d) => tasks(d)[4].audio.forEach((l: Json) => (l.speaker = 'm')));
    expect(r.out).toMatch(/needs lines of speaker "f"/);
    expect(r.status).toBe(1);
    expect(check((d) => (tasks(d)[4].questions[0].options = ['Uno', 'Dos', 'Tres'])).out).toMatch(/the options must be hombre \/ mujer \/ ninguno/);
  });

  it('a written text where a recording is needed', () => {
    const r = check((d) => {
      tasks(d)[1].text = tasks(d)[1].audio.map((l: Json) => l.text).join(' ');
      delete tasks(d)[1].audio;
    });
    expect(r.out).toMatch(/a recording is needed here, not a written text/);
  });
});

describe('the answer key: --blind and --grade', () => {
  const keyed = /"(correct|answer|answers)"\s*:/;

  it('--blind writes the same paper without correct / answer / answers', () => {
    for (const name of GOOD) {
      const out = path.join(tmp, `${name}.blind.json`);
      const r = run('--blind', path.join(FIXTURES, `${name}.good.json`), out);
      expect(r.status).toBe(0);
      const text = fs.readFileSync(out, 'utf8');
      expect(text).not.toMatch(keyed);
      if (name !== 'es-b2-writing') expect(JSON.stringify(good(name))).toMatch(keyed); // an essay has no key
      // nothing else changed: the key-free copy of the original is the blind file
      const strip = (v: Json): Json => (Array.isArray(v) ? v.map(strip) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).filter(([k]) => !['correct', 'answer', 'answers'].includes(k)).map(([k, x]) => [k, strip(x)])) : v);
      expect(JSON.parse(text)).toEqual(strip(good(name)));
      // and the blind copy is no longer a valid paper: the key is missing
      expect(run(out).status).toBe(name === 'es-b2-writing' ? 0 : 1);
    }
  });

  it('--grade: a copy with the same key agrees; every difference is listed', () => {
    for (const name of GOOD) {
      const full = path.join(FIXTURES, `${name}.good.json`);
      const r = run('--grade', full, write(good(name)));
      expect(r.status).toBe(0);
      expect(r.out).not.toMatch(/DEVIATION/);
      expect(r.last).toMatch(/^grade: (\d+)\/\1 keyed items agree, 0 deviations$/);
    }
    const given = good('es-b1-reading');
    tasks(given)[1].questions[2].correct = (tasks(given)[1].questions[2].correct + 1) % 3;
    tasks(given)[0].answer.p3 = 'a';
    delete tasks(given)[3].answer['4'];
    const r = run('--grade', path.join(FIXTURES, 'es-b1-reading.good.json'), write(given));
    expect(r.status).toBe(1);
    expect(r.lines.filter((l) => l.startsWith('DEVIATION'))).toHaveLength(3);
    expect(r.out).toMatch(/DEVIATION forms\[0\]\.tasks\[1\]\.questions\[2\]\.correct: key \d, given \d/);
    expect(r.out).toMatch(/DEVIATION forms\[0\]\.tasks\[0\]\.answer\.p3: key "[a-z]", given "a"/);
    expect(r.out).toMatch(/DEVIATION forms\[0\]\.tasks\[3\]\.answer\.4: key "f\d", given nothing/);
    expect(r.last).toMatch(/3 deviations$/);
  });

  it('--grade: an open answer agrees if it matches any accepted one without case, spaces and punctuation', () => {
    const given = good('en-b2-readinguse');
    const key = tasks(good('en-b2-readinguse'))[1].gaps[0].answers[0] as string;
    tasks(given)[1].gaps[0].answers = [`  ${key.toUpperCase()}! `];
    tasks(given)[1].gaps[1].answers = ['something else'];
    const r = run('--grade', path.join(FIXTURES, 'en-b2-readinguse.good.json'), write(given));
    expect(r.lines.filter((l) => l.startsWith('DEVIATION'))).toHaveLength(1);
    expect(r.out).toMatch(/tasks\[1\]\.gaps\[1\]\.answers: key \[/);
  });

  it('--grade: a pick list is compared as a set; usage errors exit 1', () => {
    const given = good('es-c1-listening');
    tasks(given)[0].correct = [...tasks(given)[0].correct].reverse();
    expect(run('--grade', path.join(FIXTURES, 'es-c1-listening.good.json'), write(given)).status).toBe(0);
    expect(run('--grade', path.join(FIXTURES, 'es-c1-listening.good.json')).status).toBe(1);
    expect(run('--blind', path.join(FIXTURES, 'es-c1-listening.good.json')).status).toBe(1);
  });
});

// ---------------------------------------------------------------- speaking papers (S1-S7)

/** One task of a speaking file in the shape of the script's SPEC table: choices, prep seconds, talk minutes, turns per choice, photos per choice. */
type Row = { choices: number; prep?: number; talk: [number, number]; turns: number; follows?: number; photos?: string[][] };
const WORDS = 'casa mesa libro tiempo amigo ciudad trabajo familia verano musica cocina parque viaje estudio'.split(' ');
const ES_B1: Row[] = [
  { choices: 2, prep: 900, talk: [2, 3], turns: 1 },
  { choices: 2, talk: [3, 4], turns: 5, follows: 1 },
  { choices: 2, talk: [2, 3], turns: 2, photos: [['ph1'], ['ph2']] },
  { choices: 2, talk: [2, 3], turns: 4, follows: 3, photos: [['ph1'], ['ph2']] },
];
const EN_B2: Row[] = [
  { choices: 1, talk: [2, 2], turns: 3 },
  { choices: 1, talk: [1, 1], turns: 2, photos: [['ph1', 'ph2']] },
  { choices: 1, talk: [3, 4], turns: 2 },
  { choices: 1, talk: [4, 4], turns: 3 },
];

/** A speaking file of the given rows: every turn has two content points, and a model answer that gets both. */
function speakingData(target: 'es' | 'en', level: string, rows: Row[], minWords = 10): Json {
  return {
    target,
    level,
    paper: 'speaking',
    forms: [
      {
        id: 'f1',
        tasks: rows.map((r, ti) => ({
          kind: 'speaking',
          skill: 'speaking',
          instruction: `Hable del tema numero ${ti + 1} con tranquilidad.`,
          ...(r.prep ? { prepSeconds: r.prep } : {}),
          talkMinutes: r.talk,
          ...(r.follows ? { follows: r.follows } : {}),
          choices: Array.from({ length: r.choices }, (_, ci) => ({
            id: 'abc'[ci],
            title: `Tema ${ci + 1}`,
            prompt: `Describa la situacion ${ti + 1}${'abc'[ci]} con detalle.`,
            ...(r.photos ? { photos: r.photos[ci] } : {}),
            turns: Array.from({ length: r.turns }, (_, k) => ({
              id: `t${k + 1}`,
              ask: `Que opina de la pregunta ${k + 1}?`,
              minWords,
              points: [
                { id: 'p1', label: 'primero', keywords: ['casa', 'jardin', 'pueblo', 'barrio'] },
                { id: 'p2', label: 'segundo', keywords: ['libro', 'novela', 'revista', 'cuento'] },
              ],
              model: WORDS.join(' '),
            })),
          })),
        })),
      },
    ],
  };
}

describe('speaking papers (S1-S7)', () => {
  let registry: string;
  beforeAll(() => {
    // a photo registry with two photo files, and one entry whose file is missing
    const dir = path.join(tmp, 'photos');
    fs.mkdirSync(dir);
    for (const key of ['ph1', 'ph2']) fs.writeFileSync(path.join(dir, `${key}.jpg`), 'jpg');
    registry = path.join(dir, 'photos.json');
    fs.writeFileSync(registry, JSON.stringify({ ph1: { file: 'ph1.jpg' }, ph2: { file: 'ph2.jpg' }, ph3: { file: 'ph3.jpg' } }));
  });

  const esB1 = () => speakingData('es', 'B1', ES_B1);
  const enB2 = () => speakingData('en', 'B2', EN_B2);
  const check = (data: Json, ...flags: string[]) => run('--photos', registry, ...flags, write(data));
  const broke = (change: (d: Json) => void, make: () => Json = esB1) => {
    const data = make();
    change(data);
    return check(data);
  };
  const choiceOf = (d: Json, task: number, c = 0): Json => tasks(d)[task].choices[c];
  const turnOf = (d: Json, task: number, k = 0): Json => choiceOf(d, task).turns[k];
  const fails = (r: ReturnType<typeof run>, pattern: RegExp) => {
    expect(r.out).toMatch(pattern);
    expect(r.status).toBe(1);
    expect(r.last).toMatch(/^mock-exam-check: FAIL/);
  };

  it('a complete paper passes, also with --strict (es B1 with follows + photos, en B2 with two photos)', () => {
    for (const make of [esB1, enB2]) {
      for (const flags of [[], ['--strict']]) {
        const r = check(make(), ...flags);
        expect(r.out).not.toMatch(/ERROR/);
        expect(r.status).toBe(0);
        expect(r.last).toBe('mock-exam-check: OK (1 files, 0 errors, 0 warnings)');
      }
    }
  });

  it('an empty speaking file is only a warning, also with --strict (the app keeps its placeholder)', () => {
    for (const level of ['A1', 'A2', 'B1', 'B2', 'C1']) {
      const r = run('--strict', write({ target: 'en', level, paper: 'speaking', forms: [] }));
      expect(r.status).toBe(0);
      expect(r.out).toMatch(/WARN .*forms is empty: not written yet/);
      expect(r.last).toBe('mock-exam-check: OK (1 files, 0 errors, 1 warnings)');
    }
  });

  it('S1: a speaking file holds speaking tasks only, and a speaking task is nowhere else', () => {
    fails(broke((d) => (tasks(d)[0].kind = 'essay')), /S1: a speaking file holds kind "speaking" tasks only, not "essay"/);
    fails(broke((d) => (tasks(d)[0].skill = 'writing')), /S1: skill "writing", a speaking file holds skill "speaking" tasks only/);
    // a speaking task in another paper's file
    const misplaced = good('es-b2-writing');
    tasks(misplaced)[0].skill = 'speaking';
    fails(run(write(misplaced)), /S1: a speaking task belongs in a \*-speaking.json file/);
    const asKind = good('es-b2-writing');
    tasks(asKind)[0].kind = 'speaking';
    fails(run(write(asKind)), /S1: a speaking task belongs in a \*-speaking.json file/);
  });

  it('S2: 1-3 choices with unique ids; follows is an earlier speaking task with the same choice ids', () => {
    fails(broke((d) => (choiceOf(d, 0).id = 'b')), /S2: choice ids must be unique non-empty strings/);
    fails(broke((d) => tasks(d)[0].choices.push({ ...choiceOf(d, 0), id: 'c' }, { ...choiceOf(d, 0), id: 'd' })), /S2: choices must be a list of 1-3 choices/);
    fails(broke((d) => (tasks(d)[1].follows = 2)), /S2: follows \(2\) must be the ordinal of an earlier task \(1\.\.1\)/);
    fails(broke((d) => (tasks(d)[0].follows = 1)), /S2: follows \(1\) must be the ordinal of an earlier task/);
    fails(broke((d) => (choiceOf(d, 1, 1).id = 'c')), /S2: follows 1: the choice ids \(a, c\) differ from the followed task's \(a, b\)/);
    fails(broke((d) => (tasks(d)[3].follows = 3.5)), /S2: follows \(3.5\)/);
  });

  it('S3: turns need an id, ask, model, minWords and 0-4 points of 4-8 keywords; M8 holds for the keywords', () => {
    fails(broke((d) => (choiceOf(d, 0).turns = [])), /S3: choices\[0\]: turns must be a non-empty list/);
    fails(broke((d) => (choiceOf(d, 1).turns[1].id = 't1')), /S3: choices\[0\]: turn ids must be unique/);
    fails(broke((d) => (turnOf(d, 0).ask = ' ')), /S3: .*turns\[0\]: ask and model must be non-empty strings/);
    fails(broke((d) => delete turnOf(d, 0).model), /S3: .*ask and model must be non-empty strings/);
    fails(broke((d) => (turnOf(d, 0).minWords = 0)), /S3: .*minWords must be a positive integer/);
    fails(broke((d) => (turnOf(d, 0).points = Array.from({ length: 5 }, (_, i) => ({ id: `p${i}`, label: 'x', keywords: ['casa', 'jardin', 'pueblo', 'barrio'] })))), /S3: .*points must be a list of 0-4 content points/);
    fails(broke((d) => (turnOf(d, 0).points[1].id = 'p1')), /S3: .*every point needs a unique id and a label/);
    fails(broke((d) => (turnOf(d, 0).points[0].keywords = ['casa', 'jardin', 'pueblo'])), /S3: .*points\[0\]: keywords must be a list of 4-8 non-empty strings/);
    fails(broke((d) => (turnOf(d, 0).points[0].keywords = ['casa', 'jardin', 'pueblo', 'barrio', 'campo', 'playa', 'calle', 'plaza', 'cerro'])), /S3: .*keywords must be a list of 4-8/);
    fails(broke((d) => (turnOf(d, 0).points[0].keywords = ['casa', 'jardin', 'pueblo', 'es'])), /M8: .*points\[0\]: keyword "es" is a single word under 4 letters/);
    // no points at all is fine: only the word count counts
    expect(broke((d) => (turnOf(d, 0).points = [])).status).toBe(0);
  });

  it('S4: the model answer reaches minWords and gets every point, scored like the app (folded words, keyword at a word start)', () => {
    fails(broke((d) => (turnOf(d, 0).model = 'casa libro')), /S4: .*turns\[0\]: the model answer has 2 meaningful words, minWords is 10/);
    fails(broke((d) => (turnOf(d, 0).model = WORDS.filter((w) => w !== 'casa').join(' '))), /S4: .*turns\[0\]\.points\[0\] "p1": the model answer gets no point here/);
    // a keyword matches at a word start ("tiemp" finds "tiempo"), not inside a word ("iempo" does not)
    expect(broke((d) => (turnOf(d, 0).points[0].keywords = ['tiemp', 'jardin', 'pueblo', 'barrio'])).status).toBe(0);
    fails(broke((d) => (turnOf(d, 0).points[0].keywords = ['iempo', 'jardin', 'pueblo', 'barrio'])), /S4: .*points\[0\] "p1"/);
    // case and accents do not matter
    const accented = broke((d) => {
      turnOf(d, 0).model = WORDS.join(' ').replace('musica', `M${String.fromCharCode(0xda)}SICA`);
      turnOf(d, 0).points[0].keywords = ['musica', 'jardin', 'pueblo', 'barrio'];
    });
    expect(accented.status).toBe(0);
    // the pasted question does not count as words: a model that repeats the task text loses them
    fails(broke((d) => (turnOf(d, 0).model = `Que opina de la pregunta 1 ${WORDS.slice(0, 3).join(' ')}`)), /S4: .*turns\[0\]: the model answer has/);
  });

  it('S5: every photo key is in the registry and has its file', () => {
    fails(broke((d) => (choiceOf(d, 2).photos = ['nope'])), /S5: choices\[0\]: photo "nope" is not in photos.json/);
    fails(broke((d) => (choiceOf(d, 2).photos = ['ph3'])), /S5: choices\[0\]: photo "ph3" has no photo file \(ph3.jpg \/ ph3.jpg\)/);
    fails(broke((d) => (choiceOf(d, 2).photos = [])), /photos must be a non-empty list of unique photo keys/);
    const noRegistry = run('--photos', path.join(tmp, 'nowhere', 'photos.json'), write(esB1()));
    fails(noRegistry, /S5: .*cannot be checked: photos.json does not exist yet/);
  });

  it('S6: choices, prepSeconds, talkMinutes, follows, turns and photos are those of the format table', () => {
    fails(broke((d) => (tasks(d)[0].prepSeconds = 600)), /S6: prepSeconds 600, the format wants 900/);
    fails(broke((d) => delete tasks(d)[0].prepSeconds), /S6: prepSeconds 0, the format wants 900/);
    fails(broke((d) => (tasks(d)[1].talkMinutes = [2, 3])), /S6: talkMinutes \[2,3\], the format wants \[3,4\]/);
    fails(broke((d) => tasks(d)[0].choices.pop()), /S6: 1 choices, the format wants 2/);
    fails(broke((d) => choiceOf(d, 1).turns.pop()), /S6: choices\[0\]: 4 turns, the format wants 5/);
    fails(broke((d) => delete choiceOf(d, 2).photos), /S6: choices\[0\]: 0 photos, the format wants 1/);
    fails(broke((d) => (choiceOf(d, 3, 1).photos = ['ph1'])), /S6: choices\[1\]: the photos must be those of the same choice of task 3/);
    fails(broke((d) => delete tasks(d)[1].follows), /S6: follows nothing, the format wants 1/);
    fails(broke((d) => tasks(d).pop()), /M2: form f1: 3 tasks, the es-b1-speaking format has 4/);
    fails(broke((d) => (choiceOf(d, 0).photos = ['ph1']), enB2), /S6: choices\[0\]: 1 photos, the format wants 0/);
    fails(broke((d) => (choiceOf(d, 1).photos = ['ph1']), enB2), /S6: choices\[0\]: 1 photos, the format wants 2/);
  });

  it('S7: the minWords of the turns (longest choice per task) fit the paper: 20 words a minute', () => {
    // es B1: 15 minutes -> 300 words; 12 turns of 10 words per choice = 120 words fine, 30 words a turn = 360 words too many
    fails(check(speakingData('es', 'B1', ES_B1, 30)), /S7: form f1: the turns' minWords add up to 360, the 15 minute paper allows 300/);
    // en B2: 14 minutes -> 280 words; 10 turns
    fails(check(speakingData('en', 'B2', EN_B2, 29)), /S7: form f1: the turns' minWords add up to 290, the 14 minute paper allows 280/);
    // the longest choice counts, not the sum of the choices (2 choices of 10 turns of 10 words = 120, not 240)
    expect(check(esB1()).out).not.toMatch(/S7/);
  });

  it('M6 / M7 hold for the speaking fields (ask, model, prompt, bullets, input)', () => {
    fails(broke((d) => (turnOf(d, 0).ask = 'Que opina del coche?')), /M6: forms\[0\]\.tasks\[0\]\.choices\[0\]\.turns\[0\]\.ask: "coche" is not Mexican usage/);
    fails(broke((d) => (choiceOf(d, 0).bullets = [`una raya ${String.fromCharCode(0x2014)} aqui`])), /M7: forms\[0\]\.tasks\[0\]\.choices\[0\]\.bullets\[0\]: em dash/);
    fails(broke((d) => (choiceOf(d, 0).input = 'Vosotros decis')), /M6: .*input: "Vosotr" is not Mexican usage/);
    fails(broke((d) => (turnOf(d, 0).model = `${WORDS.join(' ')} ${String.fromCharCode(0x2013)}`)), /M7: .*model: em dash/);
  });

  it('--blind leaves out the points and the model answers of a speaking paper, nothing else', () => {
    const full = write(esB1());
    const out = path.join(tmp, 'speaking.blind.json');
    const r = run('--blind', full, out);
    expect(r.status).toBe(0);
    expect(r.last).toBe(`blind: ${out} written without points / model`);
    const text = fs.readFileSync(out, 'utf8');
    expect(text).not.toMatch(/"(points|model)"\s*:/);
    const strip = (v: Json): Json => (Array.isArray(v) ? v.map(strip) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).filter(([k]) => !['points', 'model'].includes(k)).map(([k, x]) => [k, strip(x)])) : v);
    expect(JSON.parse(text)).toEqual(strip(esB1()));
  });

  describe('--grade: the answers are scored like the app and the points that came are listed per turn', () => {
    const answersOf = (d: Json, choice = 'a'): Json[] => tasks(d).map((t: Json) => ({ choice, ...Object.fromEntries(t.choices[0].turns.map((turn: Json) => [turn.id, turn.model])) }));

    it('the model answers get everything: no deviation, one TURN line per turn', () => {
      const key = write(esB1());
      const r = run('--grade', key, write(answersOf(esB1())));
      expect(r.status).toBe(0);
      expect(r.lines.filter((l) => l.startsWith('TURN'))).toHaveLength(12);
      expect(r.out).toMatch(/TURN forms\[0\]\.tasks\[0\]\.t1 \(choice a\): got p1, got p2, got 14\/10 words/);
      expect(r.last).toBe('grade: 36/36 keyed items agree, 0 deviations');
      // the same answers keyed by the form id
      expect(run('--grade', key, write({ f1: answersOf(esB1()) })).status).toBe(0);
    });

    it('a missing point, a short answer and a missing answer are deviations (exit 1)', () => {
      const given = answersOf(esB1());
      given[0].t1 = WORDS.filter((w) => w !== 'casa').join(' ');
      given[1].t2 = 'casa libro';
      delete given[1].t3;
      const r = run('--grade', write(esB1()), write(given));
      expect(r.status).toBe(1);
      expect(r.out).toMatch(/TURN forms\[0\]\.tasks\[0\]\.t1 \(choice a\): MISSED p1, got p2, got 13\/10 words/);
      expect(r.out).toMatch(/DEVIATION forms\[0\]\.tasks\[0\]\.t1\.p1: "primero" not given, keywords \["casa"/);
      expect(r.out).toMatch(/DEVIATION forms\[0\]\.tasks\[1\]\.t2\.words: 2 meaningful words, minWords 10/);
      expect(r.out).toMatch(/TURN forms\[0\]\.tasks\[1\]\.t3 \(choice a\): MISSED p1, MISSED p2, MISSED 0\/10 words/);
      expect(r.last).toMatch(/^grade: \d+\/36 keyed items agree, 7 deviations$/);
    });

    it("the choice follows the app: the pick, else the followed task's pick, else the first", () => {
      const key = esB1();
      // choice b of tasks 1 and 2 asks for another word
      for (const task of [0, 1]) choiceOf(key, task, 1).turns[0].points[0].keywords = ['jardin', 'pueblo', 'barrio', 'campo'];
      const given = answersOf(esB1(), 'b');
      delete given[1].choice; // task 2 follows task 1 and inherits its pick
      const r = run('--grade', write(key), write(given));
      expect(r.out).toMatch(/TURN forms\[0\]\.tasks\[0\]\.t1 \(choice b\): MISSED p1/);
      expect(r.out).toMatch(/TURN forms\[0\]\.tasks\[1\]\.t1 \(choice b\): MISSED p1/);
      const noPick = answersOf(esB1(), 'b');
      delete noPick[0].choice;
      delete noPick[1].choice;
      expect(run('--grade', write(key), write(noPick)).out).toMatch(/TURN forms\[0\]\.tasks\[1\]\.t1 \(choice a\): got p1/);
    });
  });
});
