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
