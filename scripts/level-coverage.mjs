// Prints the level test coverage table over the real A1 data (FB595, FB597, FB598): per topic tier, questions available and
// times asked in the first 20/40/100/500 answers for two simulated learners, early question repeats, every A1 question
// played with its own answer, and topics without a usable question. Runs the jest test in report mode.
import { spawnSync } from 'node:child_process';

const r = spawnSync('npx', ['jest', 'lib/grammar/__tests__/levelCoverage.test.ts', '--coverage=false', '--runInBand'], {
  env: { ...process.env, LEVEL_COVERAGE_REPORT: '1' },
  encoding: 'utf8',
  shell: true,
});
const out = `${r.stdout ?? ''}${r.stderr ?? ''}`;
const start = out.indexOf('## always right');
console.log(start >= 0 ? out.slice(start) : out);
process.exit(r.status ?? 1);
