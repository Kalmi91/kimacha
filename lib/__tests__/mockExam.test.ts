// The mock-exam engine: the paper shapes, the marking and the group pass rule.
// The numbers checked here are the published ones (sources in lib/exam/types.ts).

jest.mock('../database', () => jest.requireActual('../database.web'));

import { getBlueprint } from '../exam/blueprint';
import { buildMockExam } from '../exam/buildMockExam';
import { scoreExam, scoreTask, countWords, fold, type ExamAnswers } from '../exam/score';
import { taskItemCount, type ExamTask } from '../exam/types';

describe('exam blueprints follow the published structures', () => {
  it('DELE A1: four papers, 25 points each, group 1 = reading + writing', () => {
    const bp = getBlueprint('es', 'A1');
    expect(bp.modelName).toBe('DELE A1');
    expect(bp.sections.map((s) => s.skill)).toEqual(['reading', 'writing', 'listening', 'speaking']);
    expect(bp.sections.find((s) => s.skill === 'reading')!.minutes).toBe(45);
    expect(bp.sections.find((s) => s.skill === 'listening')!.minutes).toBe(25);
    expect(bp.sections.every((s) => s.points === 25)).toBe(true);
    expect(bp.groups).toEqual([
      { skills: ['reading', 'writing'], needed: 30, of: 50 },
      { skills: ['listening', 'speaking'], needed: 30, of: 50 },
    ]);
  });

  it('DELE A2 has the longer papers', () => {
    const bp = getBlueprint('es', 'A2');
    expect(bp.sections.find((s) => s.skill === 'reading')!.minutes).toBe(60);
    expect(bp.sections.find((s) => s.skill === 'listening')!.minutes).toBe(40);
    expect(bp.sections.find((s) => s.skill === 'writing')!.minutes).toBe(45);
  });

  it('Goethe A1 is one 60/100 group, Goethe A2 splits written vs speaking', () => {
    expect(getBlueprint('de', 'A1').groups).toEqual([
      { skills: ['listening', 'reading', 'writing', 'speaking'], needed: 60, of: 100 },
    ]);
    expect(getBlueprint('de', 'A2').groups).toEqual([
      { skills: ['reading', 'listening', 'writing'], needed: 45, of: 75 },
      { skills: ['speaking'], needed: 15, of: 25 },
    ]);
  });

  it('A0 sits the A1 paper, and an unauthored level gets the generic shape', () => {
    expect(getBlueprint('es', 'A0').modelName).toBe('DELE A1');
    expect(getBlueprint('es', 'B2').modelName).toBe('B2');
    expect(getBlueprint('hu', 'A1').sections.map((s) => s.name)).toContain('Olvasott szöveg értése');
  });
});

describe('buildMockExam', () => {
  // FB199: a speaking task without content points falls back to the self-rating,
  // which is not a mark. Every paper the app can build has to be markable.
  it('gives every speaking task content points and a word count', () => {
    const offenders: string[] = [];
    for (const lang of ['es', 'en', 'de']) {
      for (const level of ['A0', 'A1', 'A2', 'B1']) {
        const exam = buildMockExam(lang, 'hu', level);
        const speaking = exam.sections.find((s) => s.skill === 'speaking');
        for (const task of speaking?.tasks ?? []) {
          if (task.kind !== 'speaking_prompt') continue;
          if (!task.points?.length || !task.minWords) offenders.push(`${lang} ${level} ${task.id}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('builds the four authored Spanish A1 papers', () => {
    const exam = buildMockExam('es', 'hu', 'A1');
    expect(exam.modelName).toBe('DELE A1');
    expect(exam.sections.map((s) => s.skill)).toEqual(['reading', 'writing', 'listening', 'speaking']);
    expect(exam.generatedFallback).toBe(false);

    const reading = exam.sections.find((s) => s.skill === 'reading')!;
    expect(reading.tasks).toHaveLength(4);
    // The real DELE A1 reading paper is 25 items; the authored one matches it.
    expect(reading.tasks.reduce((sum, t) => sum + taskItemCount(t), 0)).toBe(25);
  });

  it('every authored task can be answered and marked (es/de/en, A1 and A2)', () => {
    for (const lang of ['es', 'de', 'en']) {
      for (const level of ['A1', 'A2']) {
        const exam = buildMockExam(lang, 'hu', level);
        expect(exam.generatedFallback).toBe(false);
        for (const section of exam.sections) {
          expect(section.tasks.length).toBeGreaterThan(0);
          for (const task of section.tasks) {
            expect(taskItemCount(task)).toBeGreaterThan(0);
            // Marking an empty answer sheet must never throw.
            expect(() => scoreTask(task, {})).not.toThrow();
          }
        }
      }
    }
  });

  it('falls back to generated papers for a level with no written exam', () => {
    const exam = buildMockExam('es', 'hu', 'B1');
    expect(exam.generatedFallback).toBe(true);
    expect(exam.sections.length).toBeGreaterThan(0);
    expect(exam.sections.some((s) => s.skill === 'reading')).toBe(true);
    expect(exam.sections.some((s) => s.skill === 'writing')).toBe(true);
  });
});

/** Fill in the answer sheet: `perfect` = every right answer, else all wrong. */
function fillSheet(exam: ReturnType<typeof buildMockExam>, perfect: boolean): ExamAnswers {
  const answers: ExamAnswers = {};
  for (const section of exam.sections) {
    for (const task of section.tasks) {
      const sheet: Record<string, string | boolean | number | null> = {};
      const t = task as ExamTask;
      switch (t.kind) {
        case 'match':
        case 'listen_match':
          for (const prompt of t.prompts) {
            const right = t.answer[prompt.id];
            sheet[prompt.id] = perfect ? right : t.options.find((o) => o.id !== right)!.id;
          }
          break;
        case 'text_mc':
        case 'listen_mc':
        case 'listen_dialogue':
          t.questions.forEach((q, i) => {
            sheet[String(i)] = perfect ? q.correct : (q.correct + 1) % q.options.length;
          });
          break;
        case 'true_false':
          t.statements.forEach((st, i) => {
            sheet[String(i)] = perfect ? st.answer : !st.answer;
          });
          break;
        case 'gap_mc':
          t.gaps.forEach((gap, i) => {
            sheet[String(i)] = perfect ? gap.correct : (gap.correct + 1) % gap.options.length;
          });
          break;
        case 'form_fill':
          for (const field of t.fields) sheet[field.id] = perfect ? (field.type === 'number' ? '42' : 'Kálmán') : '';
          break;
        case 'short_message':
          sheet.text = perfect
            ? `${t.points.map((p) => p.keywords[0]).join(' ')} ${'palabra '.repeat(t.minWords)}`
            : '';
          break;
        case 'speaking_prompt':
          sheet.self = perfect ? 2 : 0;
          break;
        default:
          break;
      }
      answers[task.id] = sheet;
    }
  }
  return answers;
}

describe('marking and the pass rule', () => {
  it('a perfect Spanish A1 sheet is APTO with full points', () => {
    const exam = buildMockExam('es', 'hu', 'A1');
    const result = scoreExam(exam, fillSheet(exam, true));
    expect(result.passed).toBe(true);
    expect(result.totalPoints).toBe(100);
    for (const group of result.groups) expect(group.points).toBe(50);
  });

  it('an empty sheet fails both groups', () => {
    const exam = buildMockExam('es', 'hu', 'A1');
    const result = scoreExam(exam, {});
    expect(result.passed).toBe(false);
    expect(result.totalPoints).toBe(0);
    expect(result.groups.every((g) => !g.passed)).toBe(true);
  });

  it('a perfect reading+writing but empty listening+speaking still fails (no compensation)', () => {
    const exam = buildMockExam('es', 'hu', 'A1');
    const answers = fillSheet(exam, true);
    for (const section of exam.sections) {
      if (section.skill === 'listening' || section.skill === 'speaking') {
        for (const task of section.tasks) answers[task.id] = {};
      }
    }
    const result = scoreExam(exam, answers);
    expect(result.groups[0].passed).toBe(true);
    expect(result.groups[1].passed).toBe(false);
    expect(result.passed).toBe(false);
  });

  it('Goethe A1 has one group, so a weak paper CAN be compensated', () => {
    const exam = buildMockExam('de', 'hu', 'A1');
    const answers = fillSheet(exam, true);
    const listening = exam.sections.find((s) => s.skill === 'listening')!;
    for (const task of listening.tasks) answers[task.id] = {};
    const result = scoreExam(exam, answers);
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0].points).toBe(75);
    expect(result.passed).toBe(true); // 75 >= 60 of 100
  });

  it('scales a partial paper to its published point value', () => {
    const exam = buildMockExam('es', 'hu', 'A1');
    const reading = exam.sections.find((s) => s.skill === 'reading')!;
    const answers = fillSheet(exam, true);
    // Wipe two of the four reading tasks: 25 items -> 14 correct.
    answers[reading.tasks[2].id] = {};
    answers[reading.tasks[3].id] = {};
    const result = scoreExam(exam, answers);
    const readingResult = result.sections.find((s) => s.skill === 'reading')!;
    expect(readingResult.total).toBe(25);
    expect(readingResult.correct).toBe(11); // tasks 1 and 2 = 5 + 6 items
    expect(readingResult.points).toBe(Math.round((11 / 25) * 25));
  });

  it('marks a written message on content points and length', () => {
    const exam = buildMockExam('es', 'hu', 'A1');
    const writing = exam.sections.find((s) => s.skill === 'writing')!;
    const message = writing.tasks.find((t) => t.kind === 'short_message')!;
    const scored = scoreTask(message, {
      text:
        'Me llamo Kálmán y soy de Hungría. Ahora vivo en la Ciudad de México, en la colonia Narvarte. El fin de semana voy al mercado por la mañana y juego al fútbol con mis amigos por la tarde. ¿Y tú, qué haces los domingos?',
    });
    expect(scored.correct).toBe(scored.total); // all points + word count
  });

  it('marks a form on completeness and field type, not on truth', () => {
    const exam = buildMockExam('es', 'hu', 'A1');
    const writing = exam.sections.find((s) => s.skill === 'writing')!;
    const form = writing.tasks.find((t) => t.kind === 'form_fill')!;
    const half = scoreTask(form, { nombre: 'Kálmán', edad: 'treinta' });
    expect(half.correct).toBe(1); // the name counts, the written-out age does not
  });

  // FB199: the speaking paper is spoken into the microphone and marked from the
  // transcript. The 0/1/2 self-rating stays as the fallback, scaled to the same
  // total, so a paper is worth the same whichever route answered it.
  it('falls back to the 0/1/2 self-assessment with no transcript', () => {
    const exam = buildMockExam('es', 'hu', 'A1');
    const speaking = exam.sections.find((s) => s.skill === 'speaking')!;
    const task = speaking.tasks[0];
    const total = taskItemCount(task);
    expect(scoreTask(task, { self: 2 }).correct).toBe(total);
    expect(scoreTask(task, { self: 1 }).correct).toBe(total / 2);
    expect(scoreTask(task, {}).correct).toBe(0);
  });

  it('marks the spoken answer on the transcript, point by point', () => {
    const exam = buildMockExam('es', 'hu', 'A1');
    const speaking = exam.sections.find((s) => s.skill === 'speaking')!;
    const task = speaking.tasks[0];

    const full = scoreTask(task, {
      transcript:
        'Me llamo Daniel y tengo treinta y cuatro años. Soy de Hungría, pero ahora vivo en la Ciudad de México. Vivo con mi novia. Trabajo con computadoras y estudio español todos los días. Hablo húngaro, inglés y un poco de español.',
    });
    expect(full.correct).toBe(full.total); // every content point plus the word count

    // Two content points said, and far too short for the word count.
    const thin = scoreTask(task, { transcript: 'Me llamo Daniel. Tengo treinta y cuatro años.' });
    expect(thin.correct).toBe(2);
    expect(thin.items[thin.items.length - 1].ok).toBe(false);

    // A self-rating cannot rescue a transcript that said nothing.
    const contradicted = scoreTask(task, { transcript: 'hola', self: 2 });
    expect(contradicted.correct).toBe(0);
  });
});

describe('marking helpers', () => {
  it('folds case and accents for keyword matching', () => {
    expect(fold('Me LLAMO Kálmán')).toBe('me llamo kalman');
  });
  it('counts words', () => {
    expect(countWords('  uno  dos tres ')).toBe(3);
    expect(countWords('')).toBe(0);
  });
});
