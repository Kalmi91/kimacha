import fs from 'fs';
import path from 'path';

// Every route screen must name its feedback card (<ScreenFeedback />); the one button is drawn by the screen frame in the
// root stack's and the tab navigator's screenLayout (lib/screenFeedback.tsx). Exempt: no learning content.
const EXEMPT = [
  '+not-found.tsx', // error
  'credits.tsx', // legal
  'onboarding.tsx', // intro
  'theme-mix.tsx', // settings
  'themes.tsx', // settings
];

const APP_DIR = path.resolve(__dirname, '..');
const ROOT = path.resolve(APP_DIR, '..');

function collectRoutes(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === '__tests__' ? [] : collectRoutes(full);
    if (!entry.name.endsWith('.tsx') || entry.name === '_layout.tsx') return [];
    return [full];
  });
}

// A route passes when it renders <ScreenFeedback /> itself or through a component it imports directly
// (a screen split into a view file, like the Learn tab, keeps the contract through the view).
function namesFeedbackCard(file: string, depth = 0): boolean {
  const src = fs.readFileSync(file, 'utf8');
  if (src.includes('<ScreenFeedback')) return true;
  if (depth >= 1) return false;
  const specs = [...src.matchAll(/from '([^']+)'/g)].map((m) => m[1]);
  return specs.some((spec) => {
    const base = spec.startsWith('@/')
      ? path.resolve(ROOT, spec.slice(2))
      : spec.startsWith('.')
        ? path.resolve(path.dirname(file), spec)
        : null;
    if (!base) return false;
    const candidate = [`${base}.tsx`, path.join(base, 'index.tsx')].find((c) => fs.existsSync(c));
    return candidate ? namesFeedbackCard(candidate, depth + 1) : false;
  });
}

describe('screen contract', () => {
  const routes = collectRoutes(APP_DIR).filter((f) => !EXEMPT.includes(path.basename(f)));

  it('finds route files', () => {
    expect(routes.length).toBeGreaterThan(5);
  });

  it.each(routes.map((f) => [path.relative(APP_DIR, f).split(path.sep).join('/'), f]))(
    '%s names its feedback card',
    (_name, file) => {
      expect(namesFeedbackCard(file)).toBe(true);
    },
  );

  // The button is mounted by the frame, never by a screen: a hand-mounted <FeedbackButton /> is a copy that can drift.
  it('no screen or component mounts a FeedbackButton by hand', () => {
    const sources = [APP_DIR, path.join(ROOT, 'components')].flatMap(function walk(dir: string): string[] {
      return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) return entry.name === '__tests__' ? [] : walk(full);
        return /\.tsx$/.test(entry.name) && entry.name !== 'FeedbackModal.tsx' ? [full] : [];
      });
    });
    expect(sources.filter((f) => fs.readFileSync(f, 'utf8').includes('<FeedbackButton'))).toEqual([]);
  });

  it('the root stack and the tab navigator both wrap their screens in the feedback frame', () => {
    for (const layout of [path.join(APP_DIR, '_layout.tsx'), path.join(APP_DIR, '(tabs)', '_layout.tsx')]) {
      expect(fs.readFileSync(layout, 'utf8')).toContain('<ScreenFeedbackFrame>');
    }
  });
});

// The FeedbackButton's language-pair label has one format, "en→es" (lib/languagePair.ts pairOf):
// no hyphenated "en-es" and no bare "-" literal next to a languagePair (a Feedback list could not
// be grouped by direction when the same direction showed up under several spellings).
function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === '__tests__' ? [] : sourceFiles(full);
    return /\.tsx?$/.test(entry.name) ? [full] : [];
  });
}

describe('language pair label', () => {
  const files = [APP_DIR, path.join(ROOT, 'components'), path.join(ROOT, 'lib', 'learn')].flatMap(sourceFiles);
  const OFF_FORMAT = /languagePair\b[^\n]*(['"`])(?:[a-z]{2}-[a-z]{2}|-)\1/;

  it('scans source files', () => {
    expect(files.length).toBeGreaterThan(20);
  });

  it('has no hyphenated or bare "-" pair literal', () => {
    const offenders = files
      .filter((f) => OFF_FORMAT.test(fs.readFileSync(f, 'utf8')))
      .map((f) => path.relative(ROOT, f).split(path.sep).join('/'));
    expect(offenders).toEqual([]);
  });
});
