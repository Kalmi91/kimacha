// FB25: char-level diff for typed answers, highlights the mistyped letters.
// FB84: a letter the user left out used to be skipped silently, so "we hav"
// looked flawless next to "we have". Missing letters are emitted too, flagged
// `missing`, so the UI can show which character was dropped.
//
// The learning cards fold case + accents (those are forgiven by
// strictAnswerMatch), the spelling trainer does not, because it grades
// byte-for-byte and every visual difference has to show up. Hence the `fold`
// flag; the rendered characters are always the user's own.

export interface DiffChar {
  ch: string;
  wrong: boolean;
  missing?: boolean;
}

const foldChar = (ch: string): string =>
  ch.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

// FB98: the closing punctuation of a sentence is never the mistake. The grader
// already ignores it (strictAnswerMatch strips punctuation), but the diff still
// painted the dropped "." amber, so an otherwise small slip looked like two
// errors. Both tails come off before the diff; the one the learner typed is
// re-appended as a neutral character, the one they left out is simply not shown.
const LEADING_PUNCT = /^[¡¿"'(]+/;
const TRAILING_PUNCT = /[.!?…,;:¡¿"')]+$/;

// [leading punctuation, letters, trailing punctuation]
const splitEdges = (text: string): [string, string, string] => {
  const lead = text.match(LEADING_PUNCT)?.[0] ?? '';
  const rest = text.slice(lead.length);
  const tail = rest.match(TRAILING_PUNCT)?.[0] ?? '';
  return [lead, tail ? rest.slice(0, -tail.length) : rest, tail];
};

export const stripTrailingPunct = (text: string): string => text.replace(TRAILING_PUNCT, '');

export function charDiff(typed: string, correct: string, fold = true): DiffChar[] {
  const [typedLead, typedCore, typedTail] = splitEdges(typed);
  const [, correctCore] = splitEdges(correct);
  const a = [...typedCore];
  const b = [...correctCore];
  const an = fold ? a.map(foldChar) : a;
  const bn = fold ? b.map(foldChar) : b;
  const m = an.length, n = bn.length;
  // dp[i][j] = length of the longest common subsequence of a[i:] and b[j:].
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      dp[i][j] = an[i] === bn[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const out: DiffChar[] = [];
  for (const ch of typedLead) out.push({ ch, wrong: false });
  let i = 0, j = 0;
  while (i < m || j < n) {
    if (i < m && j < n && an[i] === bn[j]) {
      out.push({ ch: a[i], wrong: false }); i++; j++;
    } else if (i < m && (j >= n || dp[i + 1][j] >= dp[i][j + 1])) {
      out.push({ ch: a[i], wrong: true }); i++;                // typed char not in correct
    } else {
      out.push({ ch: b[j], wrong: true, missing: true }); j++; // letter left out
    }
  }
  for (const ch of typedTail) out.push({ ch, wrong: false });
  return out;
}
