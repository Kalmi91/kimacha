// FB754 / FB755 / FB763: the Correct / Wrong badge of a grammar exercise lives inside AnswerFeedbackBox only.

import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..', '..');
const OWNER = 'components/grammar/AnswerFeedbackBox.tsx';

// A bare badge with no feedback box next to it: path -> why it stays.
const BARE_BADGES: Record<string, string> = {
  'components/grammar/LessonTest.tsx': 'the lesson test verdict (passed / not yet) on the result screen, not an answer box',
  'app/grammar/random.tsx': 'the floating right-mark over the next question (the answer box itself uses AnswerFeedbackBox)',
};

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === '__tests__' || e.name === 'node_modules') continue;
      out.push(...walk(p));
    } else if (/\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)) out.push(p);
  }
  return out;
}

const files = [...walk(path.join(ROOT, 'components', 'grammar')), ...walk(path.join(ROOT, 'app', 'grammar'))].map((f) => ({
  rel: path.relative(ROOT, f).split(path.sep).join('/'),
  src: fs.readFileSync(f, 'utf8'),
}));

describe('one answer feedback box', () => {
  it('ResultBadge is imported only by AnswerFeedbackBox and the listed bare badges', () => {
    const bad = files
      .filter((f) => /(?:import|export)\s[^;]*?from\s*['"][^'"]*\/ResultBadge['"]|require\(\s*['"][^'"]*\/ResultBadge['"]\s*\)/.test(f.src) && f.rel !== OWNER && !(f.rel in BARE_BADGES))
      .map((f) => `${f.rel}: use AnswerFeedbackBox`);
    expect(bad).toEqual([]);
  });

  it('the allow-listed files still really use a bare badge', () => {
    const stale = Object.keys(BARE_BADGES).filter((rel) => !files.find((f) => f.rel === rel)?.src.includes('<ResultBadge'));
    expect(stale).toEqual([]);
  });

  it('no filled result box (resultFill) and no BrutalFeedback remains', () => {
    const bad = files.filter((f) => /\bresultFill\(|\bBrutalFeedback\b/.test(f.src)).map((f) => `${f.rel}: use AnswerFeedbackBox`);
    expect(bad).toEqual([]);
  });
});
