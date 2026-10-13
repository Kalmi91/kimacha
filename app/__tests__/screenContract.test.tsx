import fs from 'fs';
import path from 'path';

// Every route screen must offer the feedback button. Exempt: no learning content.
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

// A route passes when it renders the button itself or through a component it imports directly
// (a screen split into a view file, like the Learn tab, keeps the contract through the view).
function rendersFeedbackButton(file: string, depth = 0): boolean {
  const src = fs.readFileSync(file, 'utf8');
  if (src.includes('<FeedbackButton')) return true;
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
    return candidate ? rendersFeedbackButton(candidate, depth + 1) : false;
  });
}

describe('screen contract', () => {
  const routes = collectRoutes(APP_DIR).filter((f) => !EXEMPT.includes(path.basename(f)));

  it('finds route files', () => {
    expect(routes.length).toBeGreaterThan(5);
  });

  it.each(routes.map((f) => [path.relative(APP_DIR, f).split(path.sep).join('/'), f]))(
    '%s renders a FeedbackButton',
    (_name, file) => {
      expect(rendersFeedbackButton(file)).toBe(true);
    },
  );
});
