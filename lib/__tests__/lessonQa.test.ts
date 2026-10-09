// The automated drill QA of the 17 schema-2 lessons should be
// part of the gate, not just a script run by hand. `scripts/audit-games.mjs`
// already checks every item of every schema-2 lesson (choice correctIndex/uniqueness/
// a prompt that gives itself away, form table-cell match, match pairs, why rules,
// see the script's header comment); this test only runs it and ties
// its result to the gate, so a future data regression fails under jest too.
import { spawnSync } from 'child_process';
import path from 'path';

const SCRIPT = path.join(__dirname, '..', '..', 'scripts', 'audit-games.mjs');

describe('audit-games (lesson QA gate)', () => {
  it('reports 0 P1 issues across all game content, including the 17 schema-2 lessons', () => {
    const result = spawnSync(process.execPath, [SCRIPT], { encoding: 'utf8' });
    const summary = result.stdout.split('\n')[0] ?? '';
    if (result.status !== 0) {
      throw new Error(`audit-games.mjs failed (${summary}):\n${result.stdout}\n${result.stderr}`);
    }
    expect(summary).toMatch(/^audit-games: 0 P1/);
  });
});
