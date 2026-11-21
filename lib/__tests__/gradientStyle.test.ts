import fs from 'fs';
import path from 'path';
import { Platform } from 'react-native';
import { gradientStyle } from '@/lib/gradientStyle';

// 4.2.11 closed at every start on the Night theme: RN 0.85's `experimental_backgroundImage`
// threw in LinearGradient.nativeCreate while drawing the tab capsule. Native must never get it.
describe('gradientStyle', () => {
  it('native: a solid colour, no experimental gradient', () => {
    const s = gradientStyle('#EC4899', '#22D3EE') as Record<string, unknown>;
    expect(s).toEqual({ backgroundColor: '#EC4899' });
  });

  it('web: keeps the CSS gradient', () => {
    const spy = jest.replaceProperty(Platform, 'OS', 'web');
    expect(gradientStyle('#EC4899', '#22D3EE')).toEqual({ backgroundImage: 'linear-gradient(90deg, #EC4899, #22D3EE)' });
    spy.restore();
  });
});

// Static guard: no RN `experimental_*` style prop anywhere in the app source. They are untested on
// Android release builds; one already crashed a release. Use a plain style or a web-only branch.
describe('no experimental_ style props in the app source', () => {
  const root = path.resolve(__dirname, '../..');
  const dirs = ['app', 'components', 'lib', 'constants'];
  const files: string[] = [];
  const walk = (d: string) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) {
        if (e.name !== '__tests__' && e.name !== 'node_modules') walk(p);
      } else if (/\.(ts|tsx)$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)) files.push(p);
    }
  };
  dirs.forEach((d) => fs.existsSync(path.join(root, d)) && walk(path.join(root, d)));

  it('scans the source tree', () => expect(files.length).toBeGreaterThan(50));

  it('finds no experimental_ style key', () => {
    const hits: string[] = [];
    for (const f of files) {
      fs.readFileSync(f, 'utf8').split(/\r?\n/).forEach((line, i) => {
        if (/^\s*\/\//.test(line)) return;
        if (/\bexperimental_[A-Za-z]+\s*:/.test(line)) hits.push(`${path.relative(root, f)}:${i + 1}`);
      });
    }
    expect(hits).toEqual([]);
  });
});
