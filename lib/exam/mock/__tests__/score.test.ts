// PLAN-vizsga E. szakasz (Kálmán 2026-10-01): a próbavizsga pontozása és az átmenési szabályok.
// Készségenként a nyers találat a készség 25 pontjára skálázódik; az átmenést a vizsga szabálya dönti:
//  - groups (es): mindkét csoportban 30 / 50 (olvasás + írás; hallás + szóbeli), a 2. csoport helyőrző
//    szóbeli mellett = hallás x2, "provisional" jelzéssel;
//  - total (en A1): 100-ból 50, részenkénti minimum nélkül (kompenzáló), a hiányzó szóbelit a másik három
//    arányából számolja, "provisional";
//  - average (en A2): a készségek százalékos átlaga a közelítő küszöbhöz mérve, részenkénti minimum nélkül.
// Írás: régi kulcsszavas tartalmi pontozás (a szigorításról lásd writing.test.ts).

import { pcicItemsForLevel, setPcicTarget } from '@/data/pcic';
import { AVERAGE_PASS_PCT, TOTAL_PASS_POINTS } from '../blueprint';
import { buildMockExam } from '../build';
import { countWords, fold, scoreMockExam, scoreMockTask } from '../score';
import { mockTaskItemCount, type MockAnswers, type MockExam, type MockRule, type MockSkill, type MockTask } from '../types';

afterAll(() => setPcicTarget('es'));

const SKILL_NAMES: Record<MockSkill, string> = { reading: 'Reading', writing: 'Writing', listening: 'Listening', speaking: 'Speaking' };
const GROUPS: MockRule = {
  kind: 'groups',
  groups: [
    { skills: ['reading', 'writing'], needed: 30, of: 50 },
    { skills: ['listening', 'speaking'], needed: 30, of: 50 },
  ],
};
const TOTAL: MockRule = { kind: 'total', needed: TOTAL_PASS_POINTS, of: 100 };
const AVERAGE: MockRule = { kind: 'average', passPct: AVERAGE_PASS_PCT, approximate: true };

// Egy készség = egy feladat 25 tétellel: a találat = a pont, így a küszöbök pontosan vizsgálhatók.
function task25(skill: MockSkill): MockTask {
  const id = skill.slice(0, 1);
  if (skill === 'writing') return { id, skill, kind: 'form_fill', instruction: '', context: '', fields: Array.from({ length: 25 }, (_, i) => ({ id: `f${i}`, label: `f${i}`, type: 'text' as const })) };
  return { id, skill, kind: 'listen_mc', instruction: '', audio: [], questions: Array.from({ length: 25 }, () => ({ options: ['a', 'b'], correct: 0 })) };
}

/** Négy készség; a szóbeli helyőrző (nincs feladata), hacsak nem kérik. */
const synthetic = (rule: MockRule, withSpeaking = false): MockExam => ({
  target: 'en',
  level: 'A1',
  seed: 1,
  official: false,
  skillNames: SKILL_NAMES,
  rule,
  papers: [
    { id: 'written', name: 'Written', minutes: 60, points: 75, placeholder: false, tasks: [task25('reading'), task25('writing'), task25('listening')] },
    { id: 'speaking', name: 'Speaking', minutes: 5, points: 25, placeholder: !withSpeaking, tasks: withSpeaking ? [task25('speaking')] : [] },
  ],
});

function answers(reading: number, writing: number, listening: number, speaking = 0): MockAnswers {
  const out: MockAnswers = { r: {}, w: {}, l: {}, s: {} };
  for (let i = 0; i < reading; i++) out.r[String(i)] = 0;
  for (let i = 0; i < writing; i++) out.w[`f${i}`] = 'húngara';
  for (let i = 0; i < listening; i++) out.l[String(i)] = 0;
  for (let i = 0; i < speaking; i++) out.s[String(i)] = 0;
  return out;
}

const pointsOf = (e: MockExam, a: MockAnswers) => Object.fromEntries(scoreMockExam(e, a).skills.map((s) => [s.skill, s.points]));

describe('készségenkénti pont: a papíroktól független, a találat a 25 pontra skálázódik', () => {
  it('a készség pontja a találat aránya x 25, akárhány papírban vannak a feladatai', () => {
    expect(pointsOf(synthetic(TOTAL), answers(10, 20, 5))).toEqual({ reading: 10, writing: 20, listening: 5, speaking: 0 });
  });

  it('valódi feladatsoron: az első olvasás-feladat találata arányosan skálázódik', () => {
    setPcicTarget('es');
    const e = buildMockExam({ target: 'es', level: 'A1', items: pcicItemsForLevel('A1'), seed: 3 });
    const reading = e.papers.find((p) => p.id === 'reading')!;
    const total = reading.tasks.reduce((n, t) => n + mockTaskItemCount(t), 0);
    const first = reading.tasks[0];
    if (first.kind !== 'read_mc') throw new Error('nincs read_mc');
    const half: MockAnswers = {};
    first.passages.forEach((p, i) => ((half[first.id] ??= {})[String(i)] = p.correct));
    const result = scoreMockExam(e, half);
    const skill = result.skills.find((s) => s.skill === 'reading')!;
    expect(skill.correct).toBe(first.passages.length);
    expect(skill.total).toBe(total);
    expect(skill.points).toBe(Math.round((first.passages.length / total) * 25));
  });

  it('megválaszolatlan (lejárt óra) = 0 pont, a vizsga megbukik (minden szabályon)', () => {
    for (const rule of [GROUPS, TOTAL, AVERAGE]) {
      const r = scoreMockExam(synthetic(rule), {});
      expect(r.skills.map((s) => s.points)).toEqual([0, 0, 0, 0]);
      expect(r.passed).toBe(false);
    }
  });
});

describe('spanyol szabály: csoportonként 30 / 50, hallás x2 a helyőrző szóbeli mellett', () => {
  it('15 + 15 a határ (átmegy), 14 + 15 már nem', () => {
    const e = synthetic(GROUPS);
    const ok = scoreMockExam(e, answers(15, 15, 15));
    if (ok.rule.kind !== 'groups') throw new Error('nem csoport');
    expect(ok.rule.groups.map((g) => g.passed)).toEqual([true, true]);
    expect(ok.passed).toBe(true);
    const low = scoreMockExam(e, answers(14, 15, 25));
    if (low.rule.kind !== 'groups') throw new Error('nem csoport');
    expect(low.rule.groups[0]).toMatchObject({ points: 29, needed: 30, of: 50, passed: false });
    expect(low.passed).toBe(false);
  });

  it('a szóbeli helyőrző: a 2. csoport = hallás x2, provisional; a szóbeli nem számít bele', () => {
    const r = scoreMockExam(synthetic(GROUPS), answers(25, 25, 15));
    expect(r.skills.find((s) => s.skill === 'speaking')).toMatchObject({ included: false, points: 0 });
    if (r.rule.kind !== 'groups') throw new Error('nem csoport');
    expect(r.rule.groups[1]).toMatchObject({ points: 30, of: 50, needed: 30, passed: true, provisional: true });
    expect(r.provisional).toBe(true);
    expect(r.passed).toBe(true);
    const fail = scoreMockExam(synthetic(GROUPS), answers(25, 25, 14));
    if (fail.rule.kind !== 'groups') throw new Error('nem csoport');
    expect(fail.rule.groups[1]).toMatchObject({ points: 28, passed: false });
    expect(fail.passed).toBe(false);
  });

  it('az 1. csoport nem provisional, az összpont csak a beszámított készségekből áll (3 x 25)', () => {
    const r = scoreMockExam(synthetic(GROUPS), answers(25, 25, 25));
    if (r.rule.kind !== 'groups') throw new Error('nem csoport');
    expect(r.rule.groups[0].provisional).toBe(false);
    expect([r.totalPoints, r.totalMax]).toEqual([75, 75]);
  });
});

describe('angol A1 szabály: összpont 50 / 100, a készségek kompenzálnak, a hiányzó szóbeli arányosan pótolva', () => {
  it('mind a négy készséggel: 50 az átmenés határa, 49 már nem; részenkénti minimum nincs', () => {
    const e = synthetic(TOTAL, true);
    const pass = scoreMockExam(e, answers(25, 25, 0, 0));
    expect(pass.rule).toMatchObject({ kind: 'total', points: 50, needed: 50, of: 100, passed: true, provisional: false });
    expect(pass.provisional).toBe(false);
    expect(pass.passed).toBe(true);
    const fail = scoreMockExam(e, answers(25, 24, 0, 0));
    expect(fail.rule).toMatchObject({ points: 49, passed: false });
    // Egy készségből nulla is mehet, ha a többi pótolja (nincs készségenkénti minimum).
    expect(scoreMockExam(e, answers(25, 25, 25, 0)).passed).toBe(true);
  });

  it('a szóbeli helyőrző: a három készség összege az arányos 100-ra skálázva (összeg / 75 x 100), provisional', () => {
    const e = synthetic(TOTAL);
    // 38 / 75 = 50,7 -> 51 (átmegy), 37 / 75 = 49,3 -> 49 (nem).
    const ok = scoreMockExam(e, answers(13, 13, 12));
    expect(ok.rule).toMatchObject({ kind: 'total', points: 51, passed: true, provisional: true });
    expect(ok.provisional).toBe(true);
    const no = scoreMockExam(e, answers(13, 12, 12));
    expect(no.rule).toMatchObject({ points: 49, passed: false, provisional: true });
  });

  it('kompenzálás: az egyik készség 0, a másik kettő teljes = átmegy (67 / 100 arányosan)', () => {
    const r = scoreMockExam(synthetic(TOTAL), answers(25, 25, 0));
    expect(r.rule).toMatchObject({ points: 67, passed: true });
  });
});

describe('angol A2 szabály: a készségek százalékos átlaga, közelítő küszöb, részenkénti minimum nélkül', () => {
  it('az átlag a küszöb fölött átmegy, alatta nem; a szóbeli (helyőrző) kimarad az átlagból, provisional', () => {
    const e = synthetic(AVERAGE);
    const ok = scoreMockExam(e, answers(18, 18, 18));
    expect(ok.rule).toMatchObject({ kind: 'average', pct: 72, passPct: AVERAGE_PASS_PCT, approximate: true, passed: true, provisional: true });
    const no = scoreMockExam(e, answers(17, 17, 17));
    expect(no.rule).toMatchObject({ pct: 68, passed: false });
    expect(no.passed).toBe(false);
  });

  it('kompenzálás: egy gyenge készség (40%) mellett két teljes átlaga 80%, átmegy', () => {
    const r = scoreMockExam(synthetic(AVERAGE), answers(25, 10, 25));
    expect(r.rule).toMatchObject({ pct: 80, passed: true });
  });

  it('mind a négy készséggel az átlag mind a négyből jön', () => {
    const r = scoreMockExam(synthetic(AVERAGE, true), answers(25, 25, 0, 0));
    expect(r.rule).toMatchObject({ pct: 50, passed: false, provisional: false });
  });

  it('a küszöb egyetlen konstans (közelítő érték, Kálmán 2026-10-01: 70%)', () => {
    expect(AVERAGE_PASS_PCT).toBe(70);
  });
});

describe('diktálás: szavankénti pontozás, hallás ÉS írás jegy', () => {
  const dict = (text = 'We go shopping on Saturday. There are no buses.'): MockTask => ({
    id: 'd',
    skill: 'listening',
    kind: 'dictation',
    instruction: '',
    audio: [],
    text,
  });

  it('pontosan leírt szöveg = minden jegy, kis/nagybetű és írásjel nélkül is', () => {
    const r = scoreMockTask(dict(), { text: 'we go shopping on saturday there are no buses' });
    expect(r.correct).toBe(r.total);
    expect(r.total).toBe(2 * 9);
  });

  it('elírt vagy kihagyott szó nem pont, a többi igen; üres = 0', () => {
    const typo = scoreMockTask(dict(), { text: 'We go shoping on Saturday. There are no buses.' });
    expect(typo.correct).toBe(typo.total - 2); // a "shopping" hallás- és írás-jegye
    const missing = scoreMockTask(dict(), { text: 'We go shopping Saturday. There are buses.' });
    expect(missing.correct).toBe(missing.total - 4);
    expect(scoreMockTask(dict(), {}).correct).toBe(0);
    expect(scoreMockTask(dict(), { text: 'asdf' }).correct).toBe(0);
  });

  it('a szavak a hallás és az írás készségbe is számítanak (a szóbeli nem)', () => {
    const e: MockExam = {
      ...synthetic(TOTAL),
      papers: [{ id: 'written', name: 'Written', minutes: 60, points: 75, placeholder: false, tasks: [dict(), { ...task25('reading') }] }],
    };
    const r = scoreMockExam(e, { d: { text: 'We go shopping on Saturday. There are no buses.' } });
    const by = Object.fromEntries(r.skills.map((s) => [s.skill, s]));
    expect([by.listening.correct, by.listening.total]).toEqual([9, 9]);
    expect([by.writing.correct, by.writing.total]).toEqual([9, 9]);
    expect(by.listening.points).toBe(25);
    expect(by.writing.points).toBe(25);
  });
});

describe('begépelt hézag', () => {
  const gaps: MockTask = {
    id: 'g',
    skill: 'reading',
    kind: 'gap_type',
    instruction: '',
    gaps: [
      { text: 'I ___ find my phone.', answer: "can't" },
      { text: 'We eat ___ on Fridays.', answer: 'fish' },
    ],
  };

  it('kis/nagybetű és aposztróf nélkül is elfogadott, az üres és a rossz nem', () => {
    expect(scoreMockTask(gaps, { '0': 'cant', '1': 'FISH' }).correct).toBe(2);
    expect(scoreMockTask(gaps, { '0': "can't", '1': 'meat' }).correct).toBe(1);
    expect(scoreMockTask(gaps, { '0': '', '1': '  ' }).correct).toBe(0);
  });
});

describe('valódi feladatsorok: minden helyes válasszal átmennek', () => {
  function solve(e: MockExam): MockAnswers {
    const all: MockAnswers = {};
    for (const p of e.papers) {
      for (const t of p.tasks) {
        const a: Record<string, string | number | boolean | null> = {};
        if (t.kind === 'read_mc') t.passages.forEach((x, i) => (a[String(i)] = x.correct));
        if (t.kind === 'gap_mc') t.gaps.forEach((x, i) => (a[String(i)] = x.correct));
        if (t.kind === 'gap_type') t.gaps.forEach((x, i) => (a[String(i)] = x.answer));
        if (t.kind === 'dictation') a.text = t.text;
        if (t.kind === 'listen_mc' || t.kind === 'listen_dialogue') t.questions.forEach((x, i) => (a[String(i)] = x.correct));
        if (t.kind === 'true_false') t.statements.forEach((x, i) => (a[String(i)] = x.answer));
        if (t.kind === 'match' || t.kind === 'listen_match') Object.assign(a, t.answer);
        if (t.kind === 'form_fill') for (const f of t.fields) a[f.id] = GOOD_FORM[f.check ?? 'word'];
        if (t.kind === 'short_message') a.text = `${t.points.map((x) => x.keywords[0]).join(' ')} ${DISTINCT_WORDS.slice(0, t.minWords).join(' ')}`;
        all[t.id] = a;
      }
    }
    return all;
  }

  const GOOD_FORM = { fullname: 'Ana Kovács', word: 'húngara', address: 'Calle Rébsamen 431', age: '30', phone: '5540990187', email: 'ana@example.com', level: 'A1' };
  // 125 különböző, magánhangzós "szó" a szószám-jegyhez (a szó-ismétlés nem szöveg).
  const SYL = ['ba', 'de', 'fi', 'ko', 'mu'];
  const DISTINCT_WORDS = Array.from({ length: 125 }, (_, i) => `${SYL[i % 5]}${SYL[Math.floor(i / 5) % 5]}${SYL[Math.floor(i / 25) % 5]}n`);

  for (const [target, level] of [['es', 'A1'], ['es', 'A2'], ['en', 'A1'], ['en', 'A2']] as const) {
    it(`${target} ${level}`, () => {
      setPcicTarget(target);
      const e = buildMockExam({ target, level, items: pcicItemsForLevel(level), seed: 11 });
      const r = scoreMockExam(e, solve(e));
      expect(r.skills.filter((s) => s.included).map((s) => s.points)).toEqual([25, 25, 25]);
      expect(r.passed).toBe(true);
      expect(r.provisional).toBe(true);
    });
  }
});

describe('scoreMockTask: tételenként', () => {
  it('írás: kulcsszavas tartalmi pontok (ékezet- és kisbetű-független) + szószám', () => {
    const t: MockTask = {
      id: 'w',
      skill: 'writing',
      kind: 'short_message',
      instruction: '',
      prompt: '',
      minWords: 5,
      points: [
        { id: 'a', label: 'a', keywords: ['me llamo'] },
        { id: 'b', label: 'b', keywords: ['sábado'] },
      ],
    };
    expect(mockTaskItemCount(t)).toBe(3);
    const full = scoreMockTask(t, { text: 'ME LLAMO Ana y el SABADO voy a casa' });
    expect(full).toMatchObject({ correct: 3, total: 3 });
    const part = scoreMockTask(t, { text: 'Me llamo Ana' });
    expect(part.correct).toBe(1);
    expect(scoreMockTask(t, {}).correct).toBe(0);
  });

  it('űrlap: kitöltve, és szám-mezőben szám; igaz/hamis és párosítás a kulcs szerint', () => {
    const form: MockTask = {
      id: 'f',
      skill: 'writing',
      kind: 'form_fill',
      instruction: '',
      context: '',
      fields: [
        { id: 'n', label: 'Nombre', type: 'text' },
        { id: 'e', label: 'Edad', type: 'number' },
      ],
    };
    expect(scoreMockTask(form, { n: 'Kálmán', e: 'treinta' }).correct).toBe(1);
    expect(scoreMockTask(form, { n: 'Kálmán', e: '30' }).correct).toBe(2);
    const tf: MockTask = { id: 't', skill: 'reading', kind: 'true_false', instruction: '', text: '', statements: [{ s: 'x', answer: true }, { s: 'y', answer: false }] };
    expect(scoreMockTask(tf, { '0': true, '1': true }).correct).toBe(1);
    const m: MockTask = {
      id: 'm',
      skill: 'reading',
      kind: 'match',
      instruction: '',
      prompts: [{ id: 'p1', text: 'hola' }],
      options: [{ id: 'a', text: 'hello' }, { id: 'b', text: 'bye' }],
      answer: { p1: 'a' },
    };
    expect(scoreMockTask(m, { p1: 'a' }).items[0]).toMatchObject({ label: 'hola', given: 'hello', expected: 'hello', ok: true });
    expect(scoreMockTask(m, { p1: 'b' }).correct).toBe(0);
  });

  it('segédek: fold és countWords', () => {
    expect(fold('  Sábado ’X’ ')).toBe("sabado 'x'");
    expect(countWords('  uno  dos tres ')).toBe(3);
    expect(countWords('')).toBe(0);
  });
});
