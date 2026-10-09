// Builder of the practice exam task set.
// The old (4afeb8c^) lib/exam/buildMockExam.ts built from hand-written JSON and the old vocabulary;
// this one builds from the level's words (the caller supplies the `pcicItemsForLevel` items) and the
// items' example sentences. The learned state does NOT matter: the task set is made of the level's words, and for an
// unknown word the UI gives a glossary (lib/exam/mock/glossary.ts). The same seed
// gives the same exam (part-by-part saving can resume from it).
//
// The task allocation comes from the blueprint `plan` (lib/exam/mock/blueprint.ts): the official Spanish
// shape, English A1 and English A2 each ask for different tasks and paper layouts.
//
// Pure module: no database, no loaded corpus, the caller supplies the data.

import type { PcicItem } from '@/data/pcic';
import { hashString, shuffleArray, shuffleOptions } from '@/lib/shuffle';
import { mockInstruction, MOCK_WRITING, type MockInstructionKind } from './author';
import { getMockBlueprint } from './blueprint';
import {
  DEFAULT_PLAYS,
  type MockExam,
  type MockGapMcTask,
  type MockLevel,
  type MockListenTask,
  type MockMatchTask,
  type MockPaper,
  type MockReadMcTask,
  type MockSkill,
  type MockTarget,
  type MockTask,
  type MockTrueFalseTask,
} from './types';

interface MockBuildInput {
  target: MockTarget;
  level: MockLevel;
  /** The level's cards (`pcicItemsForLevel`, those of the active direction). */
  items: PcicItem[];
  seed: number;
}

interface Sentence {
  itemId: string;
  source: string;
  target: string;
}

const MIN_WORDS = 3;
const PUNCT = /[¿?¡!.,;:()"«»]/g;
const ARTICLE: Record<MockTarget, RegExp> = {
  es: /^(el|la|los|las|un|una)\s+/i,
  en: /^(to|the|a|an)\s+/i,
};
// Numerals, pronouns, prepositions and conjunctions would fit several answers: they are neither a host nor a trap in the gaps.
const AMBIGUOUS_POS = new Set(['num', 'pron', 'prep', 'conj']);

export function sentenceWords(sentence: string): string[] {
  return sentence.replace(PUNCT, ' ').split(/\s+/).filter(Boolean);
}

/** The item's target-language form without article / "to" and parentheses, as a single word; otherwise null. */
export function singleWordForm(item: PcicItem, target: MockTarget): string | null {
  const raw = (target === 'es' ? item.es : item.en).split(' / ')[0].replace(/\(.*?\)/g, '').trim();
  const bare = raw.replace(ARTICLE[target], '').trim().toLowerCase();
  if (!bare || /\s/.test(bare) || bare.length < MIN_WORDS) return null;
  return bare;
}

/** The sentence with the word's single occurrence replaced by `___`; null if it is absent or occurs more than once. */
function gapSentence(sentence: string, word: string): string | null {
  const tokens = sentence.split(/\s+/);
  const hits: number[] = [];
  tokens.forEach((tok, i) => {
    if (tok.replace(PUNCT, '').toLowerCase() === word) hits.push(i);
  });
  if (hits.length !== 1) return null;
  const m = tokens[hits[0]].match(/^([¿¡"«(]*)(.*?)([?!.,;:)"»]*)$/);
  if (!m) return null;
  tokens[hits[0]] = `${m[1]}___${m[3]}`;
  return tokens.join(' ');
}

/** A gap sentence: the host sentence, the gapped text, the omitted word and (if requested) the 3 answers. */
interface GapEntry {
  sentence: Sentence;
  text: string;
  word: string;
  options?: string[];
  correct?: number;
}

type MockBody = MockTask extends infer T ? (T extends MockTask ? Omit<T, 'id' | 'instruction' | 'skill'> : never) : never;

/** The finished skeleton of a task: the id and the instruction come from the paper assembly (the number comes from its position within the paper). */
interface Draft {
  skill: MockSkill;
  /** The kind of instruction; null for an authored task (the authored text stays there). */
  instruction: MockInstructionKind | null;
  task: MockTask;
}

const AUTHORED_PREFIX = /^(TAREA|PART) \d+\.\s*/;

export function buildMockExam(input: MockBuildInput): MockExam {
  const { target, level, items, seed } = input;
  const bp = getMockBlueprint(target, level);
  const c = bp.counts;
  const key = `${target}:${level}:${seed}`;
  const rank = (part: string) => hashString(`${key}:${part}`);

  // Sentence pool: the example sentences of the level's cards, within the level's grammar (word-count cap),
  // the source-language sentences are unique (no two identical answer options).
  const seenSource = new Set<string>();
  const pool: Sentence[] = [];
  for (const it of shuffleArray(items, rank('pool'))) {
    const tgt = (target === 'es' ? it.exampleEs : it.exampleEn)?.trim();
    const src = (target === 'es' ? it.exampleEn : it.exampleEs)?.trim();
    if (!tgt || !src) continue;
    const n = sentenceWords(tgt).length;
    if (n < MIN_WORDS || n > c.maxWords) continue;
    const dedupe = src.toLowerCase();
    if (seenSource.has(dedupe)) continue;
    seenSource.add(dedupe);
    pool.push({ itemId: it.id, source: src, target: tgt });
  }

  const used = new Set<string>();
  const take = (n: number): Sentence[] => {
    const out: Sentence[] = [];
    for (const s of pool) {
      if (out.length >= n) break;
      if (used.has(s.itemId)) continue;
      used.add(s.itemId);
      out.push(s);
    }
    return out;
  };
  // Wrong answer options: the source-language form of any other sentence (it need not be "used up").
  const decoys = (avoid: Sentence[], n: number, part: string): Sentence[] => {
    const skip = new Set(avoid.map((s) => s.itemId));
    return shuffleArray(
      pool.filter((s) => !skip.has(s.itemId)),
      rank(part),
    ).slice(0, n);
  };
  const choice = (correct: string, wrong: string[], part: string) => {
    const { options, correctIndex } = shuffleOptions([correct, ...wrong], 0, rank(part));
    return { options, correct: correctIndex };
  };

  // --- Gap sentences: reserved up front, because few sentences qualify (single-word, a target word that occurs once).
  const gapWordOf = new Map<string, string>();
  for (const it of items) {
    const w = singleWordForm(it, target);
    if (w) gapWordOf.set(it.id, w);
  }
  const byId = new Map(items.map((i) => [i.id, i]));
  const reserveGaps = (n: number, withOptions: boolean): GapEntry[] => {
    const out: GapEntry[] = [];
    for (const s of pool) {
      if (out.length >= n) break;
      if (used.has(s.itemId)) continue;
      const word = gapWordOf.get(s.itemId);
      const text = word ? gapSentence(s.target, word) : null;
      if (!word || !text) continue;
      const host = byId.get(s.itemId);
      if (host?.pos && AMBIGUOUS_POS.has(host.pos)) continue;
      if (!withOptions) {
        used.add(s.itemId);
        out.push({ sentence: s, text, word });
        continue;
      }
      const inSentence = new Set(sentenceWords(s.target).map((w) => w.toLowerCase()));
      const others = shuffleArray(
        items.filter(
          (i) =>
            i.id !== s.itemId &&
            gapWordOf.has(i.id) &&
            !(i.pos && AMBIGUOUS_POS.has(i.pos)) &&
            gapWordOf.get(i.id) !== word &&
            !inSentence.has(gapWordOf.get(i.id)!),
        ),
        rank(`gapw:${s.itemId}`),
      );
      // One trap has the same part of speech (plausible), the other a different one (does not fit grammatically), so
      // that there are not two equally good answers.
      const same = others.filter((i) => host?.pos && i.pos === host.pos);
      const diff = others.filter((i) => !(host?.pos && i.pos === host.pos));
      const picked = [same[0], diff[0], same[1], diff[1]].filter((i): i is PcicItem => !!i).slice(0, 2);
      const wrong = picked.map((i) => gapWordOf.get(i.id)!);
      if (wrong.length < 2 || new Set(wrong).size < 2) continue;
      used.add(s.itemId);
      out.push({ sentence: s, text, word, ...choice(word, wrong, `gap:${s.itemId}`) });
    }
    return out;
  };
  const gapMcHosts = reserveGaps(c.readGaps, true);
  const gapTypeHosts = reserveGaps(c.readGapType, false);
  const gapListenHosts = reserveGaps(c.listenFill, false);

  // --- Task skeletons (the id and the instruction come from the assembly).
  const draft = (skill: MockSkill, instruction: MockInstructionKind, task: MockBody): Draft => ({
    skill,
    instruction,
    task: { id: '', instruction: '', skill, ...task } as MockTask,
  });

  // Reading: a two-sentence text, the right answer is the source-language translation of the two sentences.
  const readMc = (): Draft | null => {
    const passages: MockReadMcTask['passages'] = [];
    for (let k = 0; k < c.readPassages; k++) {
      const [a, b] = take(2);
      if (!a || !b) break;
      const [x, y] = decoys([a, b], 2, `rp:${k}`);
      if (!x || !y) break;
      passages.push({ text: `${a.target} ${b.target}`, ...choice(`${a.source} ${b.source}`, [`${a.source} ${x.source}`, `${y.source} ${b.source}`], `rpo:${k}:${a.itemId}`) });
    }
    return passages.length ? draft('reading', 'read_mc', { kind: 'read_mc', passages }) : null;
  };

  // Matching sentences to their meanings (one extra meaning), read or heard.
  const matchDraft = (kind: 'match' | 'listen_match', n: number, part: string, plays?: number): Draft | null => {
    const picked = take(n);
    if (picked.length < 3) return null;
    const extra = decoys(picked, 1, part);
    const texts = shuffleArray([...picked.map((s) => s.source), ...extra.map((s) => s.source)], rank(`${part}:order`));
    const options = texts.map((text, i) => ({ id: String.fromCharCode(97 + i), text }));
    const answer: Record<string, string> = {};
    const prompts = picked.map((s, i) => {
      const pid = `p${i + 1}`;
      answer[pid] = options.find((o) => o.text === s.source)!.id;
      return { id: pid, text: kind === 'match' ? s.target : '' };
    });
    const body: Omit<MockMatchTask, 'id' | 'instruction' | 'skill'> = {
      kind,
      ...(kind === 'listen_match' ? { audio: picked.map((s) => s.target), plays: plays ?? DEFAULT_PLAYS } : {}),
      prompts,
      options,
      answer,
    };
    return draft(kind === 'match' ? 'reading' : 'listening', kind, body);
  };

  // A three-line text and statements (a true one is the translation of a sentence from the text, a false one of another).
  const trueFalse = (): Draft | null => {
    const text = take(c.readTextSentences);
    if (text.length < 2) return null;
    const nTrue = Math.min(c.readTrue, text.length);
    const wrong = decoys(text, c.readTrueFalse - nTrue, 'rtf');
    const statements = shuffleArray(
      [...text.slice(0, nTrue).map((s) => ({ s: s.source, answer: true })), ...wrong.map((s) => ({ s: s.source, answer: false }))],
      rank('rtf:order'),
    );
    const body: Omit<MockTrueFalseTask, 'id' | 'instruction' | 'skill'> = { kind: 'true_false', text: text.map((s) => s.target).join(' '), statements };
    return draft('reading', 'true_false', body);
  };

  const gapMc = (): Draft | null => {
    if (gapMcHosts.length < 2) return null;
    const gaps: MockGapMcTask['gaps'] = gapMcHosts.map((g) => ({ text: g.text, options: g.options!, correct: g.correct! }));
    return draft('reading', 'gap_mc', { kind: 'gap_mc', gaps });
  };

  const gapType = (): Draft | null =>
    gapTypeHosts.length >= 2 ? draft('reading', 'gap_type', { kind: 'gap_type', gaps: gapTypeHosts.map((g) => ({ text: g.text, answer: g.word, hint: g.word[0] })) }) : null;

  // Gap filled after listening: the sentences are read aloud, the gapped text is on screen.
  const listenFill = (plays: number): Draft | null =>
    gapListenHosts.length >= 2
      ? draft('listening', 'listen_fill', {
          kind: 'gap_type',
          audio: gapListenHosts.map((g) => g.sentence.target),
          plays,
          gaps: gapListenHosts.map((g) => ({ text: g.text, answer: g.word })),
        })
      : null;

  // Short announcements / dialogue: one question per line ("what did you hear").
  const listenDraft = (kind: 'listen_mc' | 'listen_dialogue', n: number, part: string, plays: number): Draft | null => {
    const picked = take(n);
    if (picked.length < 2) return null;
    const questions = picked.map((s, i) => {
      const wrong = decoys([s], 2, `${part}:${i}`).map((d) => d.source);
      return choice(s.source, wrong, `${part}o:${i}:${s.itemId}`);
    });
    const body: Omit<MockListenTask, 'id' | 'instruction' | 'skill'> = { kind, audio: picked.map((s) => s.target), plays, questions };
    return draft('listening', kind, body);
  };

  // Dictation: the sentences must be written down verbatim (counts as a listening AND a writing mark).
  const dictation = (plays: number): Draft | null => {
    if (c.dictationSentences <= 0) return null;
    const picked = take(c.dictationSentences);
    if (picked.length < c.dictationSentences) return null;
    return draft('listening', 'dictation', { kind: 'dictation', audio: picked.map((s) => s.target), plays, text: picked.map((s) => s.target).join(' ') });
  };

  // --- Writing: the authored tasks (with instruction and content points); the number comes from the assembly.
  const writing: Draft[] = (MOCK_WRITING[`${target}:${level}`] ?? []).map((w) => ({
    skill: 'writing' as const,
    instruction: null,
    task: { ...w, id: '', skill: 'writing', instruction: w.instruction.replace(AUTHORED_PREFIX, '') } as MockTask,
  }));

  const drafts: Record<MockSkill, (Draft | null)[]> = { reading: [], writing, listening: [], speaking: [] };
  if (bp.plan === 'es-official') {
    drafts.reading = [readMc(), matchDraft('match', c.readMatch, 'rm'), trueFalse(), gapMc()];
    drafts.listening = [
      listenDraft('listen_mc', c.listenMc, 'lm', DEFAULT_PLAYS),
      matchDraft('listen_match', c.listenMatch, 'lx'),
      listenDraft('listen_dialogue', c.listenDialogue, 'ld', DEFAULT_PLAYS),
    ];
  } else if (bp.plan === 'en-a1') {
    // The first part of listening can be heard once, the dictation and the gaps twice; paper order: listening, reading, writing.
    drafts.listening = [listenDraft('listen_mc', c.listenMc, 'lm', 1), dictation(DEFAULT_PLAYS), listenFill(DEFAULT_PLAYS)];
    drafts.reading = [gapMc(), readMc(), gapType()];
  } else {
    drafts.reading = [readMc(), matchDraft('match', c.readMatch, 'rm'), trueFalse(), gapMc(), gapType()];
    drafts.listening = [
      listenDraft('listen_mc', c.listenMc, 'lm', DEFAULT_PLAYS),
      listenFill(DEFAULT_PLAYS),
      listenDraft('listen_dialogue', c.listenDialogue, 'ld', DEFAULT_PLAYS),
      matchDraft('listen_match', c.listenMatch, 'lx'),
    ];
  }

  // --- Papers: the tasks of the paper's skills one after another, a task's number is its position within the paper.
  const papers: MockPaper[] = bp.papers.map((spec) => {
    const tasks: MockTask[] = [];
    for (const skill of spec.skills) {
      for (const d of drafts[skill]) {
        if (!d) continue;
        const n = tasks.length + 1;
        const plays = 'plays' in d.task && typeof d.task.plays === 'number' ? d.task.plays : DEFAULT_PLAYS;
        const instruction = d.instruction ? mockInstruction(target, d.instruction, n, plays) : `${target === 'es' ? 'TAREA' : 'PART'} ${n}. ${d.task.instruction}`;
        tasks.push({ ...d.task, id: `${spec.id}-${n}`, instruction } as MockTask);
      }
    }
    return { id: spec.id, name: spec.name, minutes: spec.minutes, points: spec.skills.length * 25, placeholder: !!spec.placeholder, tasks };
  });

  return { target, level, seed, official: bp.official, papers, skillNames: bp.skillNames, rule: bp.rule };
}

/** The content fingerprint of the task set: a saved exam can be resumed only if we get this same set back. */
export function mockExamSignature(exam: MockExam): string {
  return String(hashString(JSON.stringify(exam.papers.map((p) => p.tasks))));
}
