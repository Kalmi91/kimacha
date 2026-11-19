// E206: the 💬 button has ONE place, the Learn card's: the top right of the screen (the right end of its top row, or the
// top right corner inside the safe area), at the Learn card's size. A static read of the source: no ScreenFeedback /
// FeedbackButton call may ask for the old floating ('fab') or draggable button, or for a bottom offset.
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..', '..');
const SKIP = new Set(['node_modules', '.git', 'android', 'ios', 'dist', 'coverage', '__tests__', '.expo']);

function sources(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(e.name)) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) sources(full, out);
    else if (/\.tsx$/.test(e.name)) out.push(full);
  }
  return out;
}

// every `<ScreenFeedback ... />` / `<FeedbackButton ... />` tag (the text up to its closing `/>`)
function calls(src: string): string[] {
  return src.match(/<(?:ScreenFeedback|FeedbackButton)\b[\s\S]*?\/>/g) ?? [];
}

describe('feedback button placement standard (E206)', () => {
  const files = sources(ROOT).filter((f) => !/components[\/]FeedbackModal\.tsx$/.test(f));
  const found = files.flatMap((f) => calls(fs.readFileSync(f, 'utf8')).map((c) => ({ f: path.relative(ROOT, f), c })));

  it('finds the calls (the scan is not silently empty)', () => {
    expect(found.length).toBeGreaterThanOrEqual(25);
  });

  it.each(['placement="fab"', 'draggable', 'bottomOffset', 'compact'])('no call asks for %s', (what) => {
    expect(found.filter(({ c }) => c.includes(what)).map(({ f }) => f)).toEqual([]);
  });

  it('every call that names a placement uses header, inline or corner', () => {
    const bad = found.filter(({ c }) => /placement=/.test(c) && !/placement="(header|inline|corner)"/.test(c));
    expect(bad.map(({ f }) => f)).toEqual([]);
  });
});
