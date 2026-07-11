import { getWordsForLevel } from '@/data/words';
import { nearMissDistractors } from './distractors';

export type ExamDir = [string, string];

export type ExamItem =
  | { kind: 'word_type';   dir: ExamDir; prompt: string; answer: string }
  | { kind: 'sent_order';  dir: ExamDir; prompt: string; answerTokens: string[]; distractors: string[] }
  | { kind: 'sent_type';   dir: ExamDir; prompt: string; answer: string }
  | { kind: 'gap_mc';      sentence: string; options: string[]; correctIndex: number }
  | { kind: 'match';       pairs: { left: string; right: string }[] }
  | { kind: 'reading_mc';  text: string; question: string; options: string[]; correctIndex: number };

/** Shuffle an array in-place (Fisher-Yates) and return it. */
function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Pick `n` unique items from `arr` at random. */
function sample<T>(arr: T[], n: number): T[] {
  return shuffle([...arr]).slice(0, n);
}

/**
 * Tokenise a sentence for sent_order: strip punctuation, split on whitespace.
 */
function tokenise(sentence: string): string[] {
  return sentence.replace(/[.!?¡¿,;:]/g, '').split(/\s+/).filter(Boolean);
}

/**
 * Build the distractor tile pool for a sent_order item.
 * Near-miss forms (sibling articles, same-stem conjugations) instead of
 * random vocabulary, so exam tiles are confusable too (FB1 follow-up).
 */
function buildDistractors(answerTokens: string[], levelWords: any[], targetLang: string, count = 3): string[] {
  const pool = levelWords.map(w => String(w[targetLang] ?? '').split(' / ')[0].trim());
  return nearMissDistractors(answerTokens, pool, targetLang, count);
}

/** Build exam items for A0 level. Returns exactly 17 items per spec §5. */
function buildA0Exam(target: string, counter: string): ExamItem[] {
  const words = getWordsForLevel('A0', target);
  // Only words with both sentence fields
  const withSentences = words.filter((w: any) => w[`sentence_${target}`] && w[`sentence_${counter}`]);

  const usedWordIds = new Set<number>();
  const usedSentenceIds = new Set<number>();

  const pickWord = (exclude?: Set<number>): any => {
    const pool = words.filter((w: any) => !usedWordIds.has(w.id) && !(exclude?.has(w.id)));
    return sample(pool, 1)[0];
  };

  const pickSentenceWord = (): any => {
    const pool = withSentences.filter((w: any) => !usedSentenceIds.has(w.id) && !usedWordIds.has(w.id));
    return sample(pool, 1)[0];
  };

  const items: ExamItem[] = [];

  // A: word_type target→counter × 3
  for (let i = 0; i < 3; i++) {
    const w = pickWord();
    if (!w) break;
    usedWordIds.add(w.id);
    items.push({ kind: 'word_type', dir: [target, counter], prompt: String(w[target]), answer: String(w[counter]) });
  }

  // B: word_type counter→target × 2
  for (let i = 0; i < 2; i++) {
    const w = pickWord();
    if (!w) break;
    usedWordIds.add(w.id);
    items.push({ kind: 'word_type', dir: [counter, target], prompt: String(w[counter]), answer: String(w[target]) });
  }

  // C: sent_order target→counter × 5
  for (let i = 0; i < 5; i++) {
    const w = pickSentenceWord();
    if (!w) break;
    usedSentenceIds.add(w.id);
    const answerTokens = tokenise(String(w[`sentence_${counter}`]));
    const distractors = buildDistractors(answerTokens, words, counter);
    items.push({
      kind: 'sent_order',
      dir: [target, counter],
      prompt: String(w[`sentence_${target}`]),
      answerTokens,
      distractors,
    });
  }

  // D: sent_order counter→target × 3
  for (let i = 0; i < 3; i++) {
    const w = pickSentenceWord();
    if (!w) break;
    usedSentenceIds.add(w.id);
    const answerTokens = tokenise(String(w[`sentence_${target}`]));
    const distractors = buildDistractors(answerTokens, words, target);
    items.push({
      kind: 'sent_order',
      dir: [counter, target],
      prompt: String(w[`sentence_${counter}`]),
      answerTokens,
      distractors,
    });
  }

  // E: sent_type counter→target × 2
  for (let i = 0; i < 2; i++) {
    const w = pickSentenceWord();
    if (!w) break;
    usedSentenceIds.add(w.id);
    items.push({
      kind: 'sent_type',
      dir: [counter, target],
      prompt: String(w[`sentence_${counter}`]),
      answer: String(w[`sentence_${target}`]),
    });
  }

  // E: sent_type target→counter × 2
  for (let i = 0; i < 2; i++) {
    const w = pickSentenceWord();
    if (!w) break;
    usedSentenceIds.add(w.id);
    items.push({
      kind: 'sent_type',
      dir: [target, counter],
      prompt: String(w[`sentence_${target}`]),
      answer: String(w[`sentence_${counter}`]),
    });
  }

  return shuffle(items);
}

/** Build exam items for A1 level. Returns exactly 35 items per spec §7 (exam-realistic mix). */
function buildA1Exam(target: string, counter: string): ExamItem[] {
  const a1Words = getWordsForLevel('A1', target);
  const withSentences = a1Words.filter((w: any) => w[`sentence_${target}`] && w[`sentence_${counter}`]);

  const usedWordIds = new Set<number>();
  const usedSentenceIds = new Set<number>();

  const pickWord = (): any => {
    const pool = a1Words.filter((w: any) => !usedWordIds.has(w.id));
    return sample(pool, 1)[0];
  };

  const pickSentenceWord = (): any => {
    const pool = withSentences.filter((w: any) => !usedSentenceIds.has(w.id) && !usedWordIds.has(w.id));
    return sample(pool, 1)[0];
  };

  const items: ExamItem[] = [];

  // Generated drills (20), A1 content
  // A: word_type target→counter × 4
  for (let i = 0; i < 4; i++) {
    const w = pickWord();
    if (!w) break;
    usedWordIds.add(w.id);
    items.push({ kind: 'word_type', dir: [target, counter], prompt: String(w[target]), answer: String(w[counter]) });
  }

  // B: word_type counter→target × 2
  for (let i = 0; i < 2; i++) {
    const w = pickWord();
    if (!w) break;
    usedWordIds.add(w.id);
    items.push({ kind: 'word_type', dir: [counter, target], prompt: String(w[counter]), answer: String(w[target]) });
  }

  // C: sent_order target→counter × 6
  for (let i = 0; i < 6; i++) {
    const w = pickSentenceWord();
    if (!w) break;
    usedSentenceIds.add(w.id);
    const answerTokens = tokenise(String(w[`sentence_${counter}`]));
    const distractors = buildDistractors(answerTokens, a1Words, counter);
    items.push({
      kind: 'sent_order',
      dir: [target, counter],
      prompt: String(w[`sentence_${target}`]),
      answerTokens,
      distractors,
    });
  }

  // D: sent_order counter→target × 4
  for (let i = 0; i < 4; i++) {
    const w = pickSentenceWord();
    if (!w) break;
    usedSentenceIds.add(w.id);
    const answerTokens = tokenise(String(w[`sentence_${target}`]));
    const distractors = buildDistractors(answerTokens, a1Words, target);
    items.push({
      kind: 'sent_order',
      dir: [counter, target],
      prompt: String(w[`sentence_${counter}`]),
      answerTokens,
      distractors,
    });
  }

  // E: sent_type counter→target × 2
  for (let i = 0; i < 2; i++) {
    const w = pickSentenceWord();
    if (!w) break;
    usedSentenceIds.add(w.id);
    items.push({
      kind: 'sent_type',
      dir: [counter, target],
      prompt: String(w[`sentence_${counter}`]),
      answer: String(w[`sentence_${target}`]),
    });
  }

  // E: sent_type target→counter × 2
  for (let i = 0; i < 2; i++) {
    const w = pickSentenceWord();
    if (!w) break;
    usedSentenceIds.add(w.id);
    items.push({
      kind: 'sent_type',
      dir: [target, counter],
      prompt: String(w[`sentence_${target}`]),
      answer: String(w[`sentence_${counter}`]),
    });
  }

  // Authored DELE-style items (15): 6 gap_mc + 3 match + 6 reading_mc (from
  // a1_tasks.json). Spanish-authored content, so only included for the es
  // course, other targets get the 20 generated drills only.
  if (target === 'es') {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const tasks: any[] = require('@/data/exams/a1_tasks.json');
      const gapItems = tasks.filter((t: any) => t.kind === 'gap_mc');
      const matchItems = tasks.filter((t: any) => t.kind === 'match');
      const readingItems = tasks.filter((t: any) => t.kind === 'reading_mc');

      for (const gap of sample(gapItems, 6)) {
        items.push({ kind: 'gap_mc', sentence: gap.sentence, options: gap.options, correctIndex: gap.correctIndex });
      }
      for (const m of sample(matchItems, 3)) {
        items.push({ kind: 'match', pairs: m.pairs });
      }
      for (const reading of sample(readingItems, 6)) {
        items.push({ kind: 'reading_mc', text: reading.text, question: reading.question, options: reading.options, correctIndex: reading.correctIndex });
      }
    } catch {
      // a1_tasks.json not yet present, authored items will be empty
    }
  }

  return shuffle(items);
}

/**
 * Build an exam for the given level and pair.
 * Returns a fixed-composition array of ExamItems (shuffled).
 *
 * `target` (the learned language) drives which word set / sentence fields feed
 * the exam; `counter` is the other exam side. For the es course this resolves
 * to the original hardwired (target='es', counter='en') pair regardless of
 * native language, so its output stays distribution-identical.
 */
export function buildExam(level: 'A0' | 'A1', pair: string): ExamItem[] {
  const [native, target] = pair.split('-');
  const counter = target === 'es' ? 'en' : native;
  if (level === 'A0') return buildA0Exam(target, counter);
  if (level === 'A1') return buildA1Exam(target, counter);
  return [];
}
