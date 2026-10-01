// PLAN-vizsga E. szakasz (Kálmán 2026-10-01): a próbavizsga pontozása és csoport-szabálya.
// Papíronként a nyers találat a papír 25 pontjára skálázódik; mindkét csoportban 30 / 50 kell
// (olvasás + írás; hallás + szóbeli). E2 a: amíg a szóbeli helyőrző, a 2. csoport = hallás x2,
// "provisional" jelzéssel. Írás: régi kulcsszavas tartalmi pontozás.

import { buildMockExam } from '../build';
import { getMockBlueprint } from '../blueprint';
import { countWords, fold, scoreMockExam, scoreMockTask } from '../score';
import { mockTaskItemCount, type MockAnswers, type MockExam, type MockTask } from '../types';
import { pcicItemsForLevel, setPcicTarget } from '@/data/pcic';

afterAll(() => setPcicTarget('es'));

const BP = getMockBlueprint('es', 'A1');

// Jó űrlap-értékek mezőfajtánként, és különböző szavak a szószám-jegyhez (a szó-ismétlés nem szöveg).
const GOOD_FORM = { fullname: 'Ana Kovács', word: 'húngara', address: 'Calle Ficticia 123', age: '30', phone: '5500000000', email: 'ana@example.com', level: 'A1' };
const DISTINCT_WORDS = 'casa perro gato libro mesa silla agua pan leche café trabajo escuela amigo familia ciudad calle parque tienda mercado cocina ventana puerta coche tren playa montaña verano invierno música deporte comida fiesta viaje cama sol luna cielo flor árbol río'.split(' ');

// Egy papír egyetlen feladatból áll, 25 tétellel: a találat = a pont, így a küszöbök pontosan vizsgálhatók.
function task25(skill: 'reading' | 'writing' | 'listening'): MockTask {
  if (skill === 'reading') return { id: 'r', kind: 'read_mc', instruction: '', passages: Array.from({ length: 25 }, (_, i) => ({ text: `t${i}`, options: ['a', 'b'], correct: 0 })) };
  if (skill === 'listening') return { id: 'l', kind: 'listen_mc', instruction: '', audio: [], questions: Array.from({ length: 25 }, () => ({ options: ['a', 'b'], correct: 0 })) };
  return { id: 'w', kind: 'form_fill', instruction: '', context: '', fields: Array.from({ length: 25 }, (_, i) => ({ id: `f${i}`, label: `f${i}`, type: 'text' as const })) };
}

const synthetic = (): MockExam => ({
  target: 'es',
  level: 'A1',
  seed: 1,
  groups: BP.groups,
  papers: BP.sections.map((s) => ({
    skill: s.skill,
    name: s.name,
    minutes: s.minutes,
    points: s.points,
    placeholder: s.skill === 'speaking',
    tasks: s.skill === 'speaking' ? [] : [task25(s.skill)],
  })),
});

function answers(reading: number, writing: number, listening: number): MockAnswers {
  const out: MockAnswers = { r: {}, w: {}, l: {} };
  for (let i = 0; i < reading; i++) out.r[String(i)] = 0;
  for (let i = 0; i < writing; i++) out.w[`f${i}`] = 'húngara';
  for (let i = 0; i < listening; i++) out.l[String(i)] = 0;
  return out;
}

describe('scoreMockExam: papír-pontok és csoport-szabály', () => {
  it('papíronként a találat a papír 25 pontjára skálázódik (rövidebb vizsga)', () => {
    setPcicTarget('es');
    const e = buildMockExam({ target: 'es', level: 'A1', items: pcicItemsForLevel('A1'), seed: 3 });
    const reading = e.papers[0];
    const total = reading.tasks.reduce((n, t) => n + mockTaskItemCount(t), 0);
    const half: MockAnswers = {};
    // Az első feladat minden tételét jól oldja meg: a találat kevesebb, mint a papír összes tétele.
    const first = reading.tasks[0];
    if (first.kind !== 'read_mc') throw new Error('nincs read_mc');
    first.passages.forEach((p, i) => ((half[first.id] ??= {})[String(i)] = p.correct));
    const result = scoreMockExam(e, half);
    expect(result.papers[0].correct).toBe(first.passages.length);
    expect(result.papers[0].total).toBe(total);
    expect(result.papers[0].points).toBe(Math.round((first.passages.length / total) * 25));
  });

  it('mindkét csoportban 30 / 50 kell: 15 + 15 a határ (átmegy), 14 + 15 már nem', () => {
    const e = synthetic();
    expect(scoreMockExam(e, answers(15, 15, 15)).groups.map((g) => g.passed)).toEqual([true, true]);
    expect(scoreMockExam(e, answers(15, 15, 15)).passed).toBe(true);
    const low1 = scoreMockExam(e, answers(14, 15, 25));
    expect(low1.groups[0]).toMatchObject({ points: 29, needed: 30, of: 50, passed: false });
    expect(low1.passed).toBe(false);
  });

  it('a szóbeli helyőrző: a 2. csoport = hallás x2, provisional; a szóbeli nem számít bele', () => {
    const e = synthetic();
    const r = scoreMockExam(e, answers(25, 25, 15));
    expect(r.papers[3]).toMatchObject({ skill: 'speaking', included: false, points: 0 });
    expect(r.groups[1]).toMatchObject({ points: 30, of: 50, needed: 30, passed: true, provisional: true });
    expect(r.provisional).toBe(true);
    expect(r.passed).toBe(true);
    const fail = scoreMockExam(e, answers(25, 25, 14));
    expect(fail.groups[1]).toMatchObject({ points: 28, passed: false });
    expect(fail.passed).toBe(false);
  });

  it('az 1. csoport nem provisional, az összpont csak a beszámított papírokból áll (3 x 25)', () => {
    const r = scoreMockExam(synthetic(), answers(25, 25, 25));
    expect(r.groups[0].provisional).toBe(false);
    expect([r.totalPoints, r.totalMax]).toEqual([75, 75]);
  });

  it('megválaszolatlan (lejárt óra) = 0 pont, a vizsga megbukik', () => {
    const r = scoreMockExam(synthetic(), {});
    expect(r.papers.map((p) => p.points)).toEqual([0, 0, 0, 0]);
    expect(r.passed).toBe(false);
  });

  it('a mintavizsga minden helyes válasszal átmegy (valódi tartalom)', () => {
    setPcicTarget('es');
    const e = buildMockExam({ target: 'es', level: 'A1', items: pcicItemsForLevel('A1'), seed: 11 });
    const all: MockAnswers = {};
    for (const p of e.papers) {
      for (const t of p.tasks) {
        const a: Record<string, string | number | boolean | null> = {};
        if (t.kind === 'read_mc') t.passages.forEach((x, i) => (a[String(i)] = x.correct));
        if (t.kind === 'gap_mc') t.gaps.forEach((x, i) => (a[String(i)] = x.correct));
        if (t.kind === 'listen_mc' || t.kind === 'listen_dialogue') t.questions.forEach((x, i) => (a[String(i)] = x.correct));
        if (t.kind === 'true_false') t.statements.forEach((x, i) => (a[String(i)] = x.answer));
        if (t.kind === 'match' || t.kind === 'listen_match') Object.assign(a, t.answer);
        if (t.kind === 'form_fill') for (const f of t.fields) a[f.id] = GOOD_FORM[f.check ?? 'word'];
        if (t.kind === 'short_message') a.text = `${t.points.map((x) => x.keywords[0]).join(' ')} ${DISTINCT_WORDS.slice(0, t.minWords).join(' ')}`;
        all[t.id] = a;
      }
    }
    const r = scoreMockExam(e, all);
    expect(r.papers.filter((p) => p.included).map((p) => p.points)).toEqual([25, 25, 25]);
    expect(r.passed).toBe(true);
  });
});

describe('scoreMockTask: tételenként', () => {
  it('írás: kulcsszavas tartalmi pontok (ékezet- és kisbetű-független) + szószám', () => {
    const t: MockTask = {
      id: 'w',
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
    const tf: MockTask = { id: 't', kind: 'true_false', instruction: '', text: '', statements: [{ s: 'x', answer: true }, { s: 'y', answer: false }] };
    expect(scoreMockTask(tf, { '0': true, '1': true }).correct).toBe(1);
    const m: MockTask = {
      id: 'm',
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
