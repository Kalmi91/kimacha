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

function collectRoutes(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === '__tests__' ? [] : collectRoutes(full);
    if (!entry.name.endsWith('.tsx') || entry.name === '_layout.tsx') return [];
    return [full];
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
      expect(fs.readFileSync(file, 'utf8')).toContain('<FeedbackButton');
    },
  );
});
