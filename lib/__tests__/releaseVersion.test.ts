// The release flow bumps the version in package.json and in app.json (expo.version, expo.android.versionCode)
// together; a missed one fails here (package.json fell behind app.json from 4.1.14 to 4.1.18 before this test).

import { readFileSync } from 'fs';
import { join } from 'path';

const ROOT = join(__dirname, '..', '..');
const readJson = (name: string) => JSON.parse(readFileSync(join(ROOT, name), 'utf8'));
const pkg = readJson('package.json');
const { expo } = readJson('app.json');

describe('release version', () => {
  it('app.json expo.version is a plain X.Y.Z', () => {
    expect(expo.version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('package.json version equals app.json expo.version', () => {
    expect(pkg.version).toBe(expo.version);
  });

  it('app.json android.versionCode is a positive integer', () => {
    expect(Number.isInteger(expo.android.versionCode)).toBe(true);
    expect(expo.android.versionCode).toBeGreaterThanOrEqual(1);
  });
});
