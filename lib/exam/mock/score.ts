// a próbavizsga pontozása, ahogy a régi
// (4afeb8c^) lib/exam/score.ts: tételenként, aztán KÉSZSÉGENKÉNT a készség 25 pontjára skálázva
// (a telefonos vizsga rövidebb a valódinál), aztán a vizsga átmenési szabálya szerint
// (lib/exam/mock/types.ts MockRule):
//  - groups (spanyol): csoportonként 30 / 50, a 2. csoport helyőrző szóbeli mellett = hallás x2;
//  - total (angol A1): összpont 100-ból, részenkénti minimum nélkül; a hiányzó szóbelit a másik
//    három készség aránya pótolja (összeg / beszámított maximum x 100), "provisional" jelzéssel;
//  - average (angol A2): a beszámított készségek százalékos átlaga egy küszöbhöz mérve (közelítő
//    érték, lib/exam/mock/blueprint.ts AVERAGE_PASS_PCT), a hiányzó szóbeli itt is kimarad.
//
// Írás-rész: nincs önértékelés, a régi kulcsszavas tartalmi pontozás marad (egy tartalmi
// pont egy jegy, plusz egy jegy a szószám eléréséért), de csak értelmes szövegre: a bemásolt
// feladat-szöveg, az értelmetlen vagy ismételt szó és a túl rövid szöveg nem kap pontot, az űrlap
// mezői pedig a fajtájuknak megfelelő értéket kérik (lib/exam/mock/writing.ts). A szóbeli régi
// önértékelése itt nincs.

import { assessMessage, checkField, countWords, fold, foldedTokens } from './writing';
import { mockTaskItemCount, type MockAnswers, type MockExam, type MockSkill, type MockTask, type MockTaskAnswer } from './types';

/** Egy készség pontja a valódi vizsgán (mind a négy 25). */
const SKILL_POINTS = 25;

const SKILL_ORDER: MockSkill[] = ['reading', 'writing', 'listening', 'speaking'];

interface MockItemResult {
  /** Mit kérdezett a feladat (a célnyelvi szöveg vagy az állítás). */
  label: string;
  given: string;
  expected: string;
  ok: boolean;
  /** Ha eltér a feladat készségétől (a diktálás szavai hallás- és írás-jegyet is adnak). */
  skill?: MockSkill;
}

interface MockTaskResult {
  taskId: string;
  skill: MockSkill;
  correct: number;
  total: number;
  items: MockItemResult[];
}

export interface MockPaperResult {
  id: string;
  name: string;
  tasks: MockTaskResult[];
}

export interface MockSkillResult {
  skill: MockSkill;
  name: string;
  correct: number;
  total: number;
  /** A nyers találat a készség pontjára skálázva (nem beszámított készségnél 0). */
  points: number;
  maxPoints: number;
  /** False a helyőrző készségnél (szóbeli): nincs benne a pontozásban. */
  included: boolean;
}

interface MockGroupResult {
  skills: MockSkill[];
  points: number;
  needed: number;
  of: number;
  passed: boolean;
  /** Igaz, ha a csoport egy helyőrző készség helyett a másik készség dupláját kapta (E2 a). */
  provisional: boolean;
}

export type MockRuleResult =
  | { kind: 'groups'; groups: MockGroupResult[]; passed: boolean; provisional: boolean }
  | { kind: 'total'; points: number; needed: number; of: number; passed: boolean; provisional: boolean }
  | { kind: 'average'; pct: number; passPct: number; approximate: true; passed: boolean; provisional: boolean };

export interface MockResult {
  papers: MockPaperResult[];
  skills: MockSkillResult[];
  rule: MockRuleResult;
  passed: boolean;
  provisional: boolean;
  totalPoints: number;
  totalMax: number;
}

export { countWords, fold };

/** A pontozás környezete: a célnyelvi szótár az írás értelmességének ellenőrzéséhez (nélküle ez a lépés kimarad). */
interface MockScoreContext {
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

/**
 * Diktálás: a leírt szavak közül a helyes sorrendű közös részsorozat (LCS) a jó; minden várt szó
 * egy hallás- és egy írás-jegy. Az írásjel, a kis/nagybetű és az ékezet nem számít, a helyesírás igen.
 */
function dictationItems(expectedText: string, typed: string): MockItemResult[] {
  const exp = foldedTokens(expectedText);
  const got = foldedTokens(typed);
  const dp: number[][] = Array.from({ length: exp.length + 1 }, () => new Array<number>(got.length + 1).fill(0));
  for (let i = exp.length - 1; i >= 0; i--) {
    for (let j = got.length - 1; j >= 0; j--) {
      dp[i][j] = exp[i] === got[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const okAt = new Array<boolean>(exp.length).fill(false);
  for (let i = 0, j = 0; i < exp.length && j < got.length; ) {
    if (exp[i] === got[j]) {
      okAt[i] = true;
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) i++;
    else j++;
  }
  const items: MockItemResult[] = [];
  exp.forEach((word, i) => {
    for (const skill of ['listening', 'writing'] as const) {
      items.push({ label: word, given: okAt[i] ? word : '', expected: word, ok: okAt[i], skill });
    }
  });
  return items;
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
    case 'gap_type':
      // Begépelt hézag: a hiányzó szó, kis/nagybetű és ékezet nélkül egyezve.
      task.gaps.forEach((g, i) => {
        const given = String(answer[String(i)] ?? '').trim();
        const same = (x: string) => fold(x).replace(/'/g, '');
        items.push({ label: g.text, given, expected: g.answer, ok: given !== '' && same(given) === same(g.answer) });
      });
      break;
    case 'dictation':
      items.push(...dictationItems(task.text, String(answer.text ?? '')));
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
  return { taskId: task.id, skill: task.skill, correct: items.filter((i) => i.ok).length, total: items.length || mockTaskItemCount(task), items };
}

export function scoreMockExam(exam: MockExam, answers: MockAnswers, ctx: MockScoreContext = {}): MockResult {
  const papers: MockPaperResult[] = exam.papers.map((paper) => ({
    id: paper.id,
    name: paper.name,
    tasks: paper.tasks.map((task) => scoreMockTask(task, answers[task.id], ctx)),
  }));

  // Készségenként: a feladatok tételei (a diktálás szavai két készségbe számítanak).
  const tally = new Map<MockSkill, { correct: number; total: number }>();
  const hasTasks = new Set<MockSkill>();
  for (const paper of exam.papers) for (const task of paper.tasks) hasTasks.add(task.skill);
  for (const paper of papers) {
    for (const task of paper.tasks) {
      for (const item of task.items) {
        const skill = item.skill ?? task.skill;
        const entry = tally.get(skill) ?? { correct: 0, total: 0 };
        entry.total += 1;
        if (item.ok) entry.correct += 1;
        tally.set(skill, entry);
      }
    }
  }
  const skills: MockSkillResult[] = SKILL_ORDER.map((skill) => {
    const { correct, total } = tally.get(skill) ?? { correct: 0, total: 0 };
    // A helyőrző készség (nincs feladata: ma a szóbeli) nincs beszámítva; a feladattal vagy tétellel rendelkező mindig igen.
    const included = hasTasks.has(skill) || tally.has(skill);
    const points = included && total > 0 ? Math.round((correct / total) * SKILL_POINTS) : 0;
    return { skill, name: exam.skillNames[skill], correct, total, points, maxPoints: SKILL_POINTS, included };
  });
  const bySkill = new Map(skills.map((s) => [s.skill, s]));
  const real = skills.filter((s) => s.included && s.total > 0);
  const provisional = skills.some((s) => !s.included);

  let rule: MockRuleResult;
  if (exam.rule.kind === 'groups') {
    const groups: MockGroupResult[] = [];
    for (const group of exam.rule.groups) {
      const members = group.skills.map((s) => bySkill.get(s)).filter((p): p is MockSkillResult => !!p);
      const present = members.filter((p) => p.included && p.total > 0);
      // Egy csoport, aminek egyik készségén sincs tartalom, nem buktathat: kiesik a szabályból.
      if (present.length === 0) continue;
      const groupProvisional = members.some((p) => !p.included);
      const realMax = present.reduce((n, p) => n + p.maxPoints, 0);
      const raw = present.reduce((n, p) => n + p.points, 0);
      const points = groupProvisional ? raw * (group.of / realMax) : raw;
      groups.push({ skills: group.skills, points, needed: group.needed, of: group.of, passed: points >= group.needed, provisional: groupProvisional });
    }
    rule = { kind: 'groups', groups, passed: groups.every((g) => g.passed), provisional: groups.some((g) => g.provisional) };
  } else if (exam.rule.kind === 'total') {
    // Összpont, részenkénti minimum nélkül; a hiányzó készséget a többi aránya pótolja.
    const max = real.reduce((n, s) => n + s.maxPoints, 0);
    const sum = real.reduce((n, s) => n + s.points, 0);
    const points = max > 0 ? Math.round((sum / max) * exam.rule.of) : 0;
    rule = { kind: 'total', points, needed: exam.rule.needed, of: exam.rule.of, passed: max > 0 && points >= exam.rule.needed, provisional };
  } else {
    // A beszámított készségek százalékos átlaga (egyenlő súly).
    const pct = real.length > 0 ? Math.round(real.reduce((n, s) => n + (s.points / s.maxPoints) * 100, 0) / real.length) : 0;
    rule = { kind: 'average', pct, passPct: exam.rule.passPct, approximate: true, passed: real.length > 0 && pct >= exam.rule.passPct, provisional };
  }

  const included = skills.filter((s) => s.included);
  return {
    papers,
    skills,
    rule,
    passed: rule.passed,
    provisional: rule.provisional,
    totalPoints: included.reduce((n, s) => n + s.points, 0),
    totalMax: included.reduce((n, s) => n + s.maxPoints, 0),
  };
}
