// Practice exam scoring, as in the old
// (4afeb8c^) lib/exam/score.ts: per item, then PER SKILL scaled to the skill's 25 points
// (the phone exam is shorter than the real one), then by the exam's pass rule
// (lib/exam/mock/types.ts MockRule):
//  - groups (Spanish): 30 / 50 per group, with a placeholder speaking the 2nd group = listening x2;
//  - total (English A1): total out of 100, no per-skill minimum; the missing speaking is made up from the
//    ratio of the other three skills (sum / counted maximum x 100), flagged "provisional";
//  - average (English A2): the percentage average of the counted skills against a threshold (approximate
//    value, lib/exam/mock/blueprint.ts AVERAGE_PASS_PCT), the missing speaking is left out here too;
//  - scale (English B1 / B2 / C1): per skill the hit ratio x the real paper's maximum is a raw score, which is turned into a
//    scale score along the rule's anchors; the average of the counted skills against the needed scale score.
//    An item can weigh more than one mark (`marks` of the task): the hit ratio of a skill is weighed by the marks.
//
// Writing part: there is no self-assessment, the old keyword-based content scoring stays (one content
// point is one mark, plus one mark for reaching the word count), but only for meaningful text: pasted
// task text, nonsense or repeated words and too short a text get no points, and the form
// fields are asked for a value matching their kind (lib/exam/mock/writing.ts). The old self-assessment of
// speaking is not here.

import { assessMessage, checkField, countWords, fold, foldedTokens } from './writing';
import { mockTaskMarks, type MockAnswers, type MockExam, type MockSkill, type MockTask, type MockTaskAnswer } from './types';

/** A skill's points on the real exam (all four are 25). */
const SKILL_POINTS = 25;

const SKILL_ORDER: MockSkill[] = ['reading', 'use', 'writing', 'listening', 'speaking'];

interface MockItemResult {
  /** What the task asked (the target-language text or the statement). */
  label: string;
  given: string;
  expected: string;
  ok: boolean;
  /** If it differs from the task's skill (the words of a dictation give both a listening and a writing mark). */
  skill?: MockSkill;
  /** How many marks the item is worth (default 1; the `marks` of the task). */
  marks?: number;
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
  /** The raw hits scaled to the skill's points (0 for a skill that is not counted). */
  points: number;
  maxPoints: number;
  /** False for the placeholder skill (speaking): it is not part of the scoring. */
  included: boolean;
  /** The scale score of the skill (only under a scale rule, for a counted skill). */
  scale?: number;
}

interface MockGroupResult {
  skills: MockSkill[];
  points: number;
  needed: number;
  of: number;
  passed: boolean;
  /** True if the group got double the other skill instead of a placeholder skill. */
  provisional: boolean;
}

export type MockRuleResult =
  | { kind: 'groups'; groups: MockGroupResult[]; passed: boolean; provisional: boolean }
  | { kind: 'total'; points: number; needed: number; of: number; passed: boolean; provisional: boolean }
  | { kind: 'average'; pct: number; passPct: number; approximate: true; passed: boolean; provisional: boolean }
  | { kind: 'scale'; points: number; needed: number; approximate: true; passed: boolean; provisional: boolean };

export interface MockResult {
  papers: MockPaperResult[];
  skills: MockSkillResult[];
  rule: MockRuleResult;
  passed: boolean;
  provisional: boolean;
  totalPoints: number;
  totalMax: number;
  /** The average scale score (only under a scale rule). */
  scaleTotal?: number;
}

export { countWords, fold };

/** The scoring context: the target-language dictionary for checking that the writing is meaningful (without it this step is skipped). */
interface MockScoreContext {
  lexicon?: ReadonlySet<string>;
}

/** Open answers are compared without case, spaces and punctuation ("Don't" = "dont"). */
const looseKey = (text: string) => fold(text).replace(/[^a-z0-9]/g, '');
const openMatches = (given: string, accepted: string[]) => {
  const key = looseKey(given);
  return key !== '' && accepted.some((a) => looseKey(a) === key);
};

/**
 * A raw score on the anchors ([raw, scale] pairs, ascending): linear between two anchors, outside the range along the
 * first / last segment; the raw score is clipped to 0..officialMax first, so the result stays on the paper's range.
 */
export function scaleScore(anchors: [raw: number, scale: number][], officialMax: number, raw: number): number {
  const x = Math.min(Math.max(raw, 0), officialMax);
  const last = anchors.length - 1;
  const i = x <= anchors[0][0] ? 0 : x >= anchors[last][0] ? last - 1 : anchors.findIndex((a, k) => x >= a[0] && x < anchors[k + 1][0]);
  const [x0, y0] = anchors[i];
  const [x1, y1] = anchors[i + 1];
  return y0 + ((x - x0) * (y1 - y0)) / (x1 - x0);
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
 * Dictation: of the written words, the common subsequence (LCS) in the correct order counts as right; every expected
 * word is one listening and one writing mark. Punctuation, case and accents do not matter, spelling does.
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
      // Typed gap: the missing word, matched without case and accents.
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
      // The form is the learner's own data, it cannot be scored for truth: it needs a filled-in, meaningful value that matches
      // the field's kind (a number for a number, an e-mail address for an address, a two-word name for a name, not a jumble of letters).
      for (const f of task.fields) {
        const raw = String(answer[f.id] ?? '').trim();
        items.push({ label: f.label, given: raw, expected: f.type === 'number' ? '123' : '…', ok: checkField(f, raw) });
      }
      break;
    case 'short_message': {
      const text = String(answer.text ?? '');
      // Pasted task text does not count: the instruction and the task text are the reference.
      const a = assessMessage(text, [task.instruction, task.prompt], ctx.lexicon);
      // A content point is given only for meaningful text of at least half the minimum word count (a keyword crammed into two words does not count).
      const enough = a.valid && a.words >= Math.ceil(task.minWords / 2);
      const raw = fold(text);
      for (const p of task.points) {
        // A keyword made only of punctuation (a question mark) runs on the raw text, because punctuation drops out of the words.
        const ok = enough && p.keywords.some((kw) => (/[a-z0-9]/.test(fold(kw)) ? a.text : raw).includes(fold(kw)));
        items.push({ label: p.label, given: ok ? '✓' : '✗', expected: p.keywords[0], ok });
      }
      items.push({ label: `≥ ${task.minWords}`, given: String(a.valid ? a.words : 0), expected: String(task.minWords), ok: a.valid && a.words >= task.minWords });
      break;
    }
    case 'passage_mc':
      task.questions.forEach((q, i) => items.push(choiceItem(q.stem, q.options, q.correct, answer[String(i)])));
      break;
    case 'clips_mc': {
      let n = 0; // the question index counts across the clips
      for (const clip of task.clips) for (const q of clip.questions) items.push(choiceItem(q.stem, q.options, q.correct, answer[String(n++)]));
      break;
    }
    case 'match_pool':
      task.prompts.forEach((p) => {
        const expectedId = task.answer[p.id];
        const givenId = answer[p.id];
        items.push({
          label: p.text ?? p.audio?.map((l) => l.text).join(' ') ?? '',
          given: task.options.find((o) => o.id === givenId)?.text ?? '',
          expected: task.options.find((o) => o.id === expectedId)?.text ?? '',
          ok: givenId === expectedId,
        });
      });
      break;
    case 'gapped_text':
      Object.keys(task.answer)
        .sort((a, b) => Number(a) - Number(b))
        .forEach((gap) => {
          const givenId = answer[gap];
          items.push({
            label: gap,
            given: task.fragments.find((f) => f.id === givenId)?.text ?? '',
            expected: task.fragments.find((f) => f.id === task.answer[gap])?.text ?? '',
            ok: givenId === task.answer[gap],
          });
        });
      break;
    case 'cloze':
      task.gaps.forEach((g, i) => {
        if ('options' in g) items.push(choiceItem(String(i + 1), g.options, g.correct, answer[String(i)]));
        else {
          const given = String(answer[String(i)] ?? '').trim();
          items.push({ label: g.stem ?? String(i + 1), given, expected: g.answers[0] ?? '', ok: openMatches(given, g.answers) });
        }
      });
      break;
    case 'pick_statements':
      // One mark per right statement that was picked (the UI lets the learner pick `pick` statements at most).
      task.correct.slice(0, task.pick).forEach((idx) => {
        const picked = answer[String(idx)] === true;
        items.push({ label: task.statements[idx] ?? '', given: picked ? '✓' : '', expected: '✓', ok: picked });
      });
      break;
    case 'transform':
      task.items.forEach((it, i) => {
        const given = String(answer[String(i)] ?? '').trim();
        items.push({ label: `${it.first} ${it.key}`, given, expected: it.answers[0] ?? '', ok: openMatches(given, it.answers) });
      });
      break;
    case 'essay': {
      // The chosen task (no choice yet: the first one); as the short message: content points by keyword + the word count, only for meaningful text.
      const choice = task.choices.find((c) => c.id === answer.choice) ?? task.choices[0];
      if (!choice) break;
      const text = String(answer.text ?? '');
      const a = assessMessage(text, [task.instruction, choice.prompt, choice.input ?? ''], ctx.lexicon);
      const enough = a.valid && a.words >= Math.ceil(choice.minWords / 2);
      const raw = fold(text);
      for (const p of choice.points) {
        const ok = enough && p.keywords.some((kw) => (/[a-z0-9]/.test(fold(kw)) ? a.text : raw).includes(fold(kw)));
        items.push({ label: p.label, given: ok ? '✓' : '✗', expected: p.keywords[0], ok });
      }
      // min <= words <= max x 1.2 (integer arithmetic: words x 5 <= max x 6)
      const inRange = a.valid && a.words >= choice.minWords && a.words * 5 <= choice.maxWords * 6;
      items.push({ label: `${choice.minWords}-${choice.maxWords}`, given: String(a.valid ? a.words : 0), expected: `${choice.minWords}-${choice.maxWords}`, ok: inRange });
      break;
    }
  }
  const marks = 'marks' in task ? task.marks : undefined;
  if (marks && marks !== 1) for (const item of items) item.marks = marks;
  const weight = (i: MockItemResult) => i.marks ?? 1;
  return {
    taskId: task.id,
    skill: task.skill,
    correct: items.filter((i) => i.ok).reduce((n, i) => n + weight(i), 0),
    total: items.reduce((n, i) => n + weight(i), 0) || mockTaskMarks(task),
    items,
  };
}

export function scoreMockExam(exam: MockExam, answers: MockAnswers, ctx: MockScoreContext = {}): MockResult {
  const papers: MockPaperResult[] = exam.papers.map((paper) => ({
    id: paper.id,
    name: paper.name,
    tasks: paper.tasks.map((task) => scoreMockTask(task, answers[task.id], ctx)),
  }));

  // Per skill: the tasks' items (the words of a dictation count into two skills).
  const tally = new Map<MockSkill, { correct: number; total: number }>();
  const hasTasks = new Set<MockSkill>();
  for (const paper of exam.papers) for (const task of paper.tasks) hasTasks.add(task.skill);
  for (const paper of papers) {
    for (const task of paper.tasks) {
      for (const item of task.items) {
        const skill = item.skill ?? task.skill;
        const entry = tally.get(skill) ?? { correct: 0, total: 0 };
        const weight = item.marks ?? 1;
        entry.total += weight;
        if (item.ok) entry.correct += weight;
        tally.set(skill, entry);
      }
    }
  }
  // Use of English is a skill only in the exams that have such a task.
  const skills: MockSkillResult[] = SKILL_ORDER.filter((skill) => skill !== 'use' || hasTasks.has('use')).map((skill) => {
    const { correct, total } = tally.get(skill) ?? { correct: 0, total: 0 };
    // A placeholder skill (no task: speaking today) is not counted; one with a task or an item always is.
    const included = hasTasks.has(skill) || tally.has(skill);
    const points = included && total > 0 ? Math.round((correct / total) * SKILL_POINTS) : 0;
    return { skill, name: exam.skillNames[skill] ?? skill, correct, total, points, maxPoints: SKILL_POINTS, included };
  });
  const bySkill = new Map(skills.map((s) => [s.skill, s]));
  const real = skills.filter((s) => s.included && s.total > 0);
  const provisional = skills.some((s) => !s.included);

  let rule: MockRuleResult;
  let scaleTotal: number | undefined;
  if (exam.rule.kind === 'groups') {
    const groups: MockGroupResult[] = [];
    for (const group of exam.rule.groups) {
      const members = group.skills.map((s) => bySkill.get(s)).filter((p): p is MockSkillResult => !!p);
      const present = members.filter((p) => p.included && p.total > 0);
      // A group in which no skill has any content cannot fail: it drops out of the rule.
      if (present.length === 0) continue;
      const groupProvisional = members.some((p) => !p.included);
      const realMax = present.reduce((n, p) => n + p.maxPoints, 0);
      const raw = present.reduce((n, p) => n + p.points, 0);
      const points = groupProvisional ? raw * (group.of / realMax) : raw;
      groups.push({ skills: group.skills, points, needed: group.needed, of: group.of, passed: points >= group.needed, provisional: groupProvisional });
    }
    rule = { kind: 'groups', groups, passed: groups.every((g) => g.passed), provisional: groups.some((g) => g.provisional) };
  } else if (exam.rule.kind === 'total') {
    // Total score, no per-skill minimum; the missing skill is made up from the ratio of the others.
    const max = real.reduce((n, s) => n + s.maxPoints, 0);
    const sum = real.reduce((n, s) => n + s.points, 0);
    const points = max > 0 ? Math.round((sum / max) * exam.rule.of) : 0;
    rule = { kind: 'total', points, needed: exam.rule.needed, of: exam.rule.of, passed: max > 0 && points >= exam.rule.needed, provisional };
  } else if (exam.rule.kind === 'scale') {
    // Raw ratio x the real paper's maximum -> scale score along the anchors; the average of the counted skills, rounded.
    const conv = exam.rule.skills;
    const counted = real.filter((s) => conv[s.skill]);
    for (const s of counted) {
      const { officialMax, anchors } = conv[s.skill]!;
      s.scale = Math.round(scaleScore(anchors, officialMax, (s.correct / s.total) * officialMax));
    }
    scaleTotal = counted.length > 0 ? Math.round(counted.reduce((n, s) => n + s.scale!, 0) / counted.length) : 0;
    rule = { kind: 'scale', points: scaleTotal, needed: exam.rule.needed, approximate: true, passed: counted.length > 0 && scaleTotal >= exam.rule.needed, provisional };
  } else {
    // The percentage average of the counted skills (equal weight).
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
    ...(scaleTotal !== undefined ? { scaleTotal } : {}),
  };
}
