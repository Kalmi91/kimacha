// PLAN-vizsga E. szakasz (Kálmán, 2026-10-01): a próbavizsga pontozása, ahogy a régi
// (4afeb8c^) lib/exam/score.ts: tételenként, aztán papíronként a papír 25 pontjára skálázva
// (a telefonos vizsga rövidebb a valódinál), aztán csoportonként a csoport küszöbéhez mérve
// (100-ból 60, és mindkét csoportban 30 / 50). Nincs élet, nincs azonnali visszajelzés.
//
// E2 a: amíg a szóbeli helyőrző, a 2. csoport pontja = a hallás pontja szorozva (50 / 25),
// vagyis hallás x2, és az eredmény "provisional" jelzést kap.
//
// Írás-rész: nincs önértékelés, a régi kulcsszavas tartalmi pontozás marad (egy tartalmi
// pont egy jegy, plusz egy jegy a szószám eléréséért), de csak értelmes szövegre: a bemásolt
// feladat-szöveg, az értelmetlen vagy ismételt szó és a túl rövid szöveg nem kap pontot, az űrlap
// mezői pedig a fajtájuknak megfelelő értéket kérik (lib/exam/mock/writing.ts). A szóbeli régi
// önértékelése itt nincs.

import { assessMessage, checkField, countWords, fold } from './writing';
import { mockTaskItemCount, type MockAnswers, type MockExam, type MockSkill, type MockTask, type MockTaskAnswer } from './types';

export interface MockItemResult {
  /** Mit kérdezett a feladat (a célnyelvi szöveg vagy az állítás). */
  label: string;
  given: string;
  expected: string;
  ok: boolean;
}

export interface MockTaskResult {
  taskId: string;
  correct: number;
  total: number;
  items: MockItemResult[];
}

export interface MockPaperResult {
  skill: MockSkill;
  name: string;
  correct: number;
  total: number;
  /** A nyers találat a papír pontjára skálázva (nem tartalmazó helyőrzőnél 0). */
  points: number;
  maxPoints: number;
  /** False a helyőrző papírnál (szóbeli): nincs benne a pontozásban. */
  included: boolean;
  tasks: MockTaskResult[];
}

export interface MockGroupResult {
  skills: MockSkill[];
  points: number;
  needed: number;
  of: number;
  passed: boolean;
  /** Igaz, ha a csoport egy helyőrző papír helyett a másik papír dupláját kapta (E2 a). */
  provisional: boolean;
}

export interface MockResult {
  papers: MockPaperResult[];
  groups: MockGroupResult[];
  passed: boolean;
  provisional: boolean;
  totalPoints: number;
  totalMax: number;
}

export { countWords, fold };

/** A pontozás környezete: a célnyelvi szótár az írás értelmességének ellenőrzéséhez (nélküle ez a lépés kimarad). */
export interface MockScoreContext {
  lexicon?: ReadonlySet<string>;
}

function choiceItem(label: string, options: string[], correct: number, given: unknown): MockItemResult {
  return {
    label,
    given: typeof given === 'number' ? (options[given] ?? '') : '',
    expected: options[correct] ?? '',
    ok: given === correct,
  };
}

export function scoreMockTask(task: MockTask, answer: MockTaskAnswer = {}, ctx: MockScoreContext = {}): MockTaskResult {
  const items: MockItemResult[] = [];
  switch (task.kind) {
    case 'match':
    case 'listen_match':
      task.prompts.forEach((p, i) => {
        const expectedId = task.answer[p.id];
        const givenId = answer[p.id];
        items.push({
          label: task.kind === 'match' ? p.text : (task.audio?.[i] ?? ''),
          given: task.options.find((o) => o.id === givenId)?.text ?? '',
          expected: task.options.find((o) => o.id === expectedId)?.text ?? '',
          ok: givenId === expectedId,
        });
      });
      break;
    case 'read_mc':
      task.passages.forEach((p, i) => items.push(choiceItem(p.text, p.options, p.correct, answer[String(i)])));
      break;
    case 'gap_mc':
      task.gaps.forEach((g, i) => items.push(choiceItem(g.text, g.options, g.correct, answer[String(i)])));
      break;
    case 'listen_mc':
    case 'listen_dialogue':
      task.questions.forEach((q, i) => items.push(choiceItem(task.audio[i] ?? '', q.options, q.correct, answer[String(i)])));
      break;
    case 'true_false':
      task.statements.forEach((st, i) => {
        const given = answer[String(i)];
        items.push({ label: st.s, given: given === true ? '✓' : given === false ? '✗' : '', expected: st.answer ? '✓' : '✗', ok: given === st.answer });
      });
      break;
    case 'form_fill':
      // Az űrlap a tanuló saját adata, igazságra nem pontozható: kitöltve és a mező fajtájának megfelelő,
      // értelmes érték kell (szám a számnál, e-mail cím a címnél, két szavas név a névnél, nem betűhalmaz).
      for (const f of task.fields) {
        const raw = String(answer[f.id] ?? '').trim();
        items.push({ label: f.label, given: raw, expected: f.type === 'number' ? '123' : '…', ok: checkField(f, raw) });
      }
      break;
    case 'short_message': {
      const text = String(answer.text ?? '');
      // A bemásolt feladat-szöveg nem számít: az utasítás és a feladat-szöveg a hivatkozás.
      const a = assessMessage(text, [task.instruction, task.prompt], ctx.lexicon);
      // Tartalmi pont csak értelmes és legalább a fele minimum-szószámú szövegre jár (két szóba zsúfolt kulcsszó nem).
      const enough = a.valid && a.words >= Math.ceil(task.minWords / 2);
      const raw = fold(text);
      for (const p of task.points) {
        // A csak írásjelből álló kulcsszó (kérdőjel) a nyers szövegen fut, mert a szavakból az írásjel kiesik.
        const ok = enough && p.keywords.some((kw) => (/[a-z0-9]/.test(fold(kw)) ? a.text : raw).includes(fold(kw)));
        items.push({ label: p.label, given: ok ? '✓' : '✗', expected: p.keywords[0], ok });
      }
      items.push({ label: `≥ ${task.minWords}`, given: String(a.valid ? a.words : 0), expected: String(task.minWords), ok: a.valid && a.words >= task.minWords });
      break;
    }
  }
  return { taskId: task.id, correct: items.filter((i) => i.ok).length, total: mockTaskItemCount(task), items };
}

export function scoreMockExam(exam: MockExam, answers: MockAnswers, ctx: MockScoreContext = {}): MockResult {
  const papers: MockPaperResult[] = exam.papers.map((paper) => {
    const tasks = paper.tasks.map((task) => scoreMockTask(task, answers[task.id], ctx));
    const correct = tasks.reduce((n, t) => n + t.correct, 0);
    const total = tasks.reduce((n, t) => n + t.total, 0);
    const included = !paper.placeholder;
    const points = included && total > 0 ? Math.round((correct / total) * paper.points) : 0;
    return { skill: paper.skill, name: paper.name, correct, total, points, maxPoints: paper.points, included, tasks };
  });

  const bySkill = new Map(papers.map((p) => [p.skill, p]));
  const groups: MockGroupResult[] = [];
  for (const group of exam.groups) {
    const members = group.skills.map((s) => bySkill.get(s)).filter((p): p is MockPaperResult => !!p);
    const real = members.filter((p) => p.included);
    // Egy csoport, aminek egyik papírján sincs tartalom, nem buktathat: kiesik a szabályból.
    if (!real.some((p) => p.total > 0)) continue;
    const provisional = real.length < members.length;
    const realMax = real.reduce((n, p) => n + p.maxPoints, 0);
    const raw = real.reduce((n, p) => n + p.points, 0);
    const points = provisional ? raw * (group.of / realMax) : raw;
    groups.push({ skills: group.skills, points, needed: group.needed, of: group.of, passed: points >= group.needed, provisional });
  }

  const included = papers.filter((p) => p.included);
  return {
    papers,
    groups,
    passed: groups.every((g) => g.passed),
    provisional: groups.some((g) => g.provisional),
    totalPoints: included.reduce((n, p) => n + p.points, 0),
    totalMax: included.reduce((n, p) => n + p.maxPoints, 0),
  };
}
