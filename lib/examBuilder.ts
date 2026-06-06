import { getWordsForLevel } from '@/data/words';

export type ExamDir = ['es', 'en'] | ['en', 'es'];

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
 * Returns 2-3 words from the level vocabulary that are NOT already in the answer.
 */
function buildDistractors(answerTokens: string[], levelWords: any[], targetLang: 'es' | 'en', count = 3): string[] {
  const answerSet = new Set(answerTokens.map(t => t.toLowerCase()));
  const pool = levelWords
    .map(w => String(w[targetLang] ?? '').split(' / ')[0].trim())
    .filter(w => w && !answerSet.has(w.toLowerCase()));
  return sample(pool, count);
}

/** Build exam items for A0 level. Returns exactly 17 items per spec §5. */
function buildA0Exam(pair: string): ExamItem[] {
  const words = getWordsForLevel('A0');
  // Only words with both sentence fields
  const withSentences = words.filter((w: any) => w.sentence_es && w.sentence_en);

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

  // A: word_type es→en × 3
  for (let i = 0; i < 3; i++) {
    const w = pickWord();
    if (!w) break;
    usedWordIds.add(w.id);
    items.push({ kind: 'word_type', dir: ['es', 'en'], prompt: String(w.es), answer: String(w.en) });
  }

  // B: word_type en→es × 2
  for (let i = 0; i < 2; i++) {
    const w = pickWord();
    if (!w) break;
    usedWordIds.add(w.id);
    items.push({ kind: 'word_type', dir: ['en', 'es'], prompt: String(w.en), answer: String(w.es) });
  }

  // C: sent_order es→en × 5
  for (let i = 0; i < 5; i++) {
    const w = pickSentenceWord();
    if (!w) break;
    usedSentenceIds.add(w.id);
    const answerTokens = tokenise(String(w.sentence_en));
    const distractors = buildDistractors(answerTokens, words, 'en');
    items.push({
      kind: 'sent_order',
      dir: ['es', 'en'],
      prompt: String(w.sentence_es),
      answerTokens,
      distractors,
    });
  }

  // D: sent_order en→es × 3
  for (let i = 0; i < 3; i++) {
    const w = pickSentenceWord();
    if (!w) break;
    usedSentenceIds.add(w.id);
    const answerTokens = tokenise(String(w.sentence_es));
    const distractors = buildDistractors(answerTokens, words, 'es');
    items.push({
      kind: 'sent_order',
      dir: ['en', 'es'],
      prompt: String(w.sentence_en),
      answerTokens,
      distractors,
    });
  }

  // E: sent_type en→es × 2
  for (let i = 0; i < 2; i++) {
    const w = pickSentenceWord();
    if (!w) break;
    usedSentenceIds.add(w.id);
    items.push({
      kind: 'sent_type',
      dir: ['en', 'es'],
      prompt: String(w.sentence_en),
      answer: String(w.sentence_es),
    });
  }

  // E: sent_type es→en × 2
  for (let i = 0; i < 2; i++) {
    const w = pickSentenceWord();
    if (!w) break;
    usedSentenceIds.add(w.id);
    items.push({
      kind: 'sent_type',
      dir: ['es', 'en'],
      prompt: String(w.sentence_es),
      answer: String(w.sentence_en),
    });
  }

  return shuffle(items);
}

/** Build exam items for A1 level. Returns exactly 20 items per spec §7. */
function buildA1Exam(pair: string): ExamItem[] {
  const a1Words = getWordsForLevel('A1');
  const withSentences = a1Words.filter((w: any) => w.sentence_es && w.sentence_en);

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

  // Mirror of A0 structure (17 items) using A1 content
  // A: word_type es→en × 3
  for (let i = 0; i < 3; i++) {
    const w = pickWord();
    if (!w) break;
    usedWordIds.add(w.id);
    items.push({ kind: 'word_type', dir: ['es', 'en'], prompt: String(w.es), answer: String(w.en) });
  }

  // B: word_type en→es × 2
  for (let i = 0; i < 2; i++) {
    const w = pickWord();
    if (!w) break;
    usedWordIds.add(w.id);
    items.push({ kind: 'word_type', dir: ['en', 'es'], prompt: String(w.en), answer: String(w.es) });
  }

  // C: sent_order es→en × 5
  for (let i = 0; i < 5; i++) {
    const w = pickSentenceWord();
    if (!w) break;
    usedSentenceIds.add(w.id);
    const answerTokens = tokenise(String(w.sentence_en));
    const distractors = buildDistractors(answerTokens, a1Words, 'en');
    items.push({
      kind: 'sent_order',
      dir: ['es', 'en'],
      prompt: String(w.sentence_es),
      answerTokens,
      distractors,
    });
  }

  // D: sent_order en→es × 3
  for (let i = 0; i < 3; i++) {
    const w = pickSentenceWord();
    if (!w) break;
    usedSentenceIds.add(w.id);
    const answerTokens = tokenise(String(w.sentence_es));
    const distractors = buildDistractors(answerTokens, a1Words, 'es');
    items.push({
      kind: 'sent_order',
      dir: ['en', 'es'],
      prompt: String(w.sentence_en),
      answerTokens,
      distractors,
    });
  }

  // E: sent_type en→es × 2
  for (let i = 0; i < 2; i++) {
    const w = pickSentenceWord();
    if (!w) break;
    usedSentenceIds.add(w.id);
    items.push({
      kind: 'sent_type',
      dir: ['en', 'es'],
      prompt: String(w.sentence_en),
      answer: String(w.sentence_es),
    });
  }

  // E: sent_type es→en × 2
  for (let i = 0; i < 2; i++) {
    const w = pickSentenceWord();
    if (!w) break;
    usedSentenceIds.add(w.id);
    items.push({
      kind: 'sent_type',
      dir: ['es', 'en'],
      prompt: String(w.sentence_es),
      answer: String(w.sentence_en),
    });
  }

  // 3 extra authored items: gap_mc + match + reading_mc (from a1_tasks.json)
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const tasks: any[] = require('@/data/exams/a1_tasks.json');
    const gapItems = tasks.filter((t: any) => t.kind === 'gap_mc');
    const matchItems = tasks.filter((t: any) => t.kind === 'match');
    const readingItems = tasks.filter((t: any) => t.kind === 'reading_mc');

    const gap = sample(gapItems, 1)[0];
    if (gap) {
      items.push({ kind: 'gap_mc', sentence: gap.sentence, options: gap.options, correctIndex: gap.correctIndex });
    }
    const match = sample(matchItems, 1)[0];
    if (match) {
      items.push({ kind: 'match', pairs: match.pairs });
    }
    const reading = sample(readingItems, 1)[0];
    if (reading) {
      items.push({ kind: 'reading_mc', text: reading.text, question: reading.question, options: reading.options, correctIndex: reading.correctIndex });
    }
  } catch {
    // a1_tasks.json not yet present — authored items will be empty
  }

  return shuffle(items);
}

/**
 * Build an exam for the given level and pair.
 * Returns a fixed-composition array of ExamItems (shuffled).
 */
export function buildExam(level: 'A0' | 'A1', pair: string): ExamItem[] {
  if (level === 'A0') return buildA0Exam(pair);
  if (level === 'A1') return buildA1Exam(pair);
  return [];
}
