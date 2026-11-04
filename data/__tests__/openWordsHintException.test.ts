// R13 of scripts/multi-meaning-rules.mjs (a hint only on a multi-meaning card) has one card-level exception: o1666 (la cintura,
// waist), FB560. A card outside the list still fails R13. The rules module is ESM, so it runs as a process, like the gate.
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const RULES = pathToFileURL(path.join(__dirname, '..', '..', 'scripts', 'multi-meaning-rules.mjs')).href;

function failuresFor(cards: { order: number; en: string; es: string; hint_en: string }[]): string[] {
  const code = `
    import { checkMultiMeaning } from ${JSON.stringify(RULES)};
    const out = [];
    checkMultiMeaning({
      cards: JSON.parse(process.argv[1]), qKey: 'en', aKey: 'es', hintKey: 'hint_en', articles: ['a', 'an', 'the'], ignore: ['to'],
      tag: (c) => '#' + c.order, fail: (rule, msg) => out.push(rule + ' ' + msg), splitAlternatives: true, stripQualifiers: true,
    });
    console.log(JSON.stringify(out));
  `;
  const r = spawnSync(process.execPath, ['--input-type=module', '-e', code, JSON.stringify(cards)], { encoding: 'utf8' });
  expect(r.status).toBe(0);
  return JSON.parse(r.stdout.trim().split(/\r?\n/).pop() ?? '[]');
}

describe('R13 exception list (scripts/multi-meaning-rules.mjs)', () => {
  it('o1666 (waist) may carry a hint although its question is not multi-meaning', () => {
    const out = failuresFor([{ order: 1666, en: 'waist', es: 'la cintura', hint_en: 'The pants are big for my *waist*.' }]);
    expect(out).toEqual([]);
  });

  it('a card outside the list still fails R13 with the same kind of hint', () => {
    const out = failuresFor([{ order: 1667, en: 'chair', es: 'la silla', hint_en: 'The *chair* is red.' }]);
    expect(out.filter((m) => m.startsWith('R13'))).toHaveLength(1);
  });
});
