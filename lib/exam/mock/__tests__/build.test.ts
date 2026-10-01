// PLAN-vizsga E. szakasz (15-16. lépés): a próbavizsga feladatsor-építője a valódi szint-szavakon
// (data/words-open es-irányban, data/words/en az en-irányban). Kálmán E5 c: a feladatsor a szint
// szavaiból áll; ugyanaz a seed ugyanazt a vizsgát adja (a részenkénti mentés ebből folytat).

import { pcicItemsForLevel, setPcicTarget, type PcicItem } from '@/data/pcic';
import { getMockBlueprint, mockAvailable, MOCK_LEVELS } from '../blueprint';
import { buildMockExam, mockExamSignature, sentenceWords, singleWordForm } from '../build';
import type { MockExam, MockLevel, MockTarget, MockTask } from '../types';
import { mockTaskItemCount } from '../types';

afterAll(() => setPcicTarget('es'));

function exam(target: MockTarget, level: MockLevel, seed = 1) {
  setPcicTarget(target);
  const items = pcicItemsForLevel(level);
  return { items, exam: buildMockExam({ target, level, items, seed }) };
}

const paper = (e: MockExam, skill: string) => e.papers.find((p) => p.skill === skill)!;
const kinds = (tasks: MockTask[]) => tasks.map((t) => t.kind);

describe('blueprint: irányonkénti, szintenkénti vizsga-alak', () => {
  it('es A1: a hivatalos percek (45/25/25/10), minden papír 25 pont', () => {
    const a1 = getMockBlueprint('es', 'A1').sections;
    expect(a1.map((s) => [s.skill, s.minutes, s.points])).toEqual([
      ['reading', 45, 25],
      ['writing', 25, 25],
      ['listening', 25, 25],
      ['speaking', 10, 25],
    ]);
  });

  it('két csoport, mindkettőben 30 / 50', () => {
    const g = getMockBlueprint('es', 'A1').groups;
    expect(g.map((x) => [x.skills, x.needed, x.of])).toEqual([
      [['reading', 'writing'], 30, 50],
      [['listening', 'speaking'], 30, 50],
    ]);
  });

  it('es→en: még nincs próbavizsga (az A1-nek nincs ellenőrzött hivatalos alakja)', () => {
    expect(MOCK_LEVELS.es).toEqual(['A1']);
    expect(MOCK_LEVELS.en).toEqual([]);
    expect(mockAvailable('en', 'A1')).toBe(false);
    expect(mockAvailable('en', 'A2')).toBe(false);
    expect(() => getMockBlueprint('en', 'A1')).toThrow();
  });
});

describe('buildMockExam: es A1 (angolul beszélő tanul spanyolt)', () => {
  const { items, exam: e } = exam('es', 'A1');

  it('négy papír a hivatalos sorrendben, a szóbeli helyőrző feladat nélkül', () => {
    expect(e.papers.map((p) => p.skill)).toEqual(['reading', 'writing', 'listening', 'speaking']);
    expect(paper(e, 'speaking').placeholder).toBe(true);
    expect(paper(e, 'speaking').tasks).toHaveLength(0);
    expect(e.papers.filter((p) => p.skill !== 'speaking').every((p) => !p.placeholder && p.tasks.length > 0)).toBe(true);
  });

  it('olvasás: szöveg-értés, párosítás, igaz/hamis, lyukas mondat; hallás: három feladat; írás: űrlap + üzenet', () => {
    expect(kinds(paper(e, 'reading').tasks)).toEqual(['read_mc', 'match', 'true_false', 'gap_mc']);
    expect(kinds(paper(e, 'listening').tasks)).toEqual(['listen_mc', 'listen_match', 'listen_dialogue']);
    expect(kinds(paper(e, 'writing').tasks)).toEqual(['form_fill', 'short_message']);
  });

  it('a tételszám a tervet követi (A1: 3 szöveg, 5 párosítás, 4 állítás, 5 lyuk; 5 / 4 / 3 hallás)', () => {
    const [read, match, tf, gap] = paper(e, 'reading').tasks.map(mockTaskItemCount);
    expect([read, match, tf, gap]).toEqual([3, 5, 4, 5]);
    expect(paper(e, 'listening').tasks.map(mockTaskItemCount)).toEqual([5, 4, 3]);
  });

  it('ugyanaz a seed ugyanazt a vizsgát adja, más seed mást; az ujjlenyomat ezt követi', () => {
    const again = exam('es', 'A1', 1).exam;
    const other = exam('es', 'A1', 2).exam;
    expect(again.papers).toEqual(e.papers);
    expect(mockExamSignature(again)).toBe(mockExamSignature(e));
    expect(mockExamSignature(other)).not.toBe(mockExamSignature(e));
  });

  it('a feladat-id-k egyediek és a papír nevét viselik', () => {
    const ids = e.papers.flatMap((p) => p.tasks.map((t) => t.id));
    expect(new Set(ids).size).toBe(ids.length);
    expect(paper(e, 'reading').tasks[0].id).toBe('reading-1');
  });

  it('az utasítás célnyelvű és sorszámozott (TAREA n.)', () => {
    expect(paper(e, 'reading').tasks.map((t) => t.instruction.slice(0, 9))).toEqual(['TAREA 1. ', 'TAREA 2. ', 'TAREA 3. ', 'TAREA 4. ']);
  });

  it('minden olvasott mondat a szint egy tételének példamondata (nincs kézzel írt szöveg)', () => {
    const sentences = new Set(items.map((i) => i.exampleEs?.trim()));
    for (const task of paper(e, 'reading').tasks) {
      if (task.kind === 'match') for (const p of task.prompts) expect(sentences.has(p.text)).toBe(true);
      if (task.kind === 'read_mc') {
        for (const p of task.passages) {
          const whole = [...sentences].filter((s) => s && p.text.includes(s));
          expect(whole.length).toBeGreaterThanOrEqual(2);
        }
      }
    }
  });

  it('a párosításban minden prompt jó válasza a saját fordítása, egy jelentés több a promptnál', () => {
    for (const task of [...paper(e, 'reading').tasks, ...paper(e, 'listening').tasks]) {
      if (task.kind !== 'match' && task.kind !== 'listen_match') continue;
      expect(task.options.length).toBe(task.prompts.length + 1);
      const sources = new Set(items.map((i) => i.exampleEn?.trim()));
      for (const p of task.prompts) expect(sources.has(task.options.find((o) => o.id === task.answer[p.id])!.text)).toBe(true);
      expect(new Set(Object.values(task.answer)).size).toBe(task.prompts.length);
      expect(new Set(task.options.map((o) => o.text)).size).toBe(task.options.length);
      if (task.kind === 'listen_match') expect(task.audio).toHaveLength(task.prompts.length);
    }
  });

  it('a lyukas mondatban a jó válasz a kihagyott szó (egy szó, 3 különböző lehetőség)', () => {
    const gap = paper(e, 'reading').tasks.find((t) => t.kind === 'gap_mc');
    if (gap?.kind !== 'gap_mc') throw new Error('nincs gap');
    for (const g of gap.gaps) {
      expect(g.text.split('___')).toHaveLength(2);
      expect(g.options).toHaveLength(3);
      expect(new Set(g.options).size).toBe(3);
      const filled = g.text.replace('___', g.options[g.correct]);
      expect(items.some((i) => i.exampleEs && sentenceWords(i.exampleEs).join(' ').toLowerCase() === sentenceWords(filled).join(' ').toLowerCase())).toBe(true);
    }
  });

  it('az igaz/hamis szövegben pontosan annyi igaz állítás van, ahogy a terv mondja', () => {
    const tf = paper(e, 'reading').tasks.find((t) => t.kind === 'true_false');
    if (tf?.kind !== 'true_false') throw new Error('nincs true_false');
    expect(tf.statements.filter((s) => s.answer)).toHaveLength(2);
    expect(tf.statements.filter((s) => !s.answer)).toHaveLength(2);
  });

  it('a hallás-kérdések: soronként egy kérdés, 3 különböző válasz, a jó a hallott mondat fordítása', () => {
    const lm = paper(e, 'listening').tasks[0];
    if (lm.kind !== 'listen_mc') throw new Error('nincs listen_mc');
    expect(lm.questions).toHaveLength(lm.audio.length);
    const byTarget = new Map(items.map((i) => [i.exampleEs?.trim(), i.exampleEn?.trim()]));
    lm.questions.forEach((q, i) => {
      expect(q.options).toHaveLength(3);
      expect(new Set(q.options).size).toBe(3);
      expect(q.options[q.correct]).toBe(byTarget.get(lm.audio[i]));
    });
  });

  it('egy mondat egy feladatsoron belül csak egy helyen a gazda (nincs ismétlődő hallás/olvasás mondat)', () => {
    const heard = paper(e, 'listening').tasks.flatMap((t) => ('audio' in t && t.audio ? t.audio : []));
    expect(new Set(heard).size).toBe(heard.length);
  });
});

describe('segédek', () => {
  it('singleWordForm: névelő és zárójel nélkül, csak egy szavas alak', () => {
    const it = (es: string, en = ''): PcicItem => ({ id: 'x', es, en, kind: 'word', section: '', order: 1 });
    expect(singleWordForm(it('la ventana'), 'es')).toBe('ventana');
    expect(singleWordForm(it('el carro (MX) / el coche'), 'es')).toBe('carro');
    expect(singleWordForm(it('buenas noches'), 'es')).toBeNull();
    expect(singleWordForm(it('x', 'to eat'), 'en')).toBe('eat');
    expect(singleWordForm(it('yo'), 'es')).toBeNull();
  });
});
