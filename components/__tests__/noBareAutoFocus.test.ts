// FB617: a bare `autoFocus` loses Gboard input on Android (see useFocusOnNewCard). Every TextInput focuses through the hook.
import fs from 'fs';
import path from 'path';

const ROOT = path.join(__dirname, '..', '..');

function files(dir: string): string[] {
  const out: string[] = [];
  for (const f of fs.readdirSync(dir)) {
    const full = path.join(dir, f);
    if (fs.statSync(full).isDirectory()) {
      if (f !== '__tests__' && f !== 'node_modules') out.push(...files(full));
    } else if (full.endsWith('.tsx') || full.endsWith('.ts')) out.push(full);
  }
  return out;
}

describe('no bare autoFocus on a TextInput', () => {
  it('app/, components/ and lib/ use useFocusOnNewCard instead', () => {
    const bad: string[] = [];
    for (const dir of ['app', 'components', 'lib']) {
      for (const file of files(path.join(ROOT, dir))) {
        const lines = fs.readFileSync(file, 'utf8').split('\n');
        lines.forEach((line, i) => {
          // the JSX attribute on any line (continuation lines too), not a word in a comment
          if (/^\s*(\/\/|\*|\/\*)/.test(line)) return;
          if (/autoFocus\s*(=|\/>|>|$)/.test(line)) bad.push(`${path.relative(ROOT, file)}:${i + 1}`);
        });
      }
    }
    expect(bad).toEqual([]);
  });
});
