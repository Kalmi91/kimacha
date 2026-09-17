// TASK-9 (PLAN-fb0917 12. lépés): a 17 schema-2 lecke gépi drill-QA-ja a
// kapu része legyen, ne csak kézzel futtatott szkript. `scripts/audit-games.mjs`
// már minden schema-2 lecke item-jét ellenőrzi (choice correctIndex/egyediség/
// önmagát-eláruló prompt, form tábla-cella egyezés, match párok, why szabályok,
// lásd a szkript fejléc-kommentjét); ez a teszt csak lefuttatja és a kapuhoz
// köti az eredményét, hogy egy jövőbeli adat-regresszió jest alatt is elbukjon.
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
