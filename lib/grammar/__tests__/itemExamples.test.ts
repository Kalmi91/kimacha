// Every choice item and every rule block has its example sentences: the drill and the lesson
// screen read them without a fallback, and a missing array crashed the app ("Something went wrong").
import fs from 'node:fs';
import path from 'node:path';

const root = path.join(__dirname, '../../../data/games/grammar');
type Item = { id: string; kind?: string; examples?: unknown };
type Block = { kind: string; points?: { examples?: unknown }[]; items?: { examples?: unknown }[]; pairs?: { examples?: unknown }[] };

const lessons = ['es', 'en', 'de', 'hu'].flatMap((target) =>
  fs
    .readdirSync(path.join(root, target))
    .filter((f) => f.endsWith('.json'))
    .map((f) => {
      const json = JSON.parse(fs.readFileSync(path.join(root, target, f), 'utf8')) as { items?: Item[]; body?: Block[] };
      return [`${target}/${f.replace('.json', '')}`, json] as const;
    }),
);

const isExampleList = (v: unknown) => Array.isArray(v) && v.length > 0 && v.every((s) => typeof s === 'string' && s.trim() !== '' && !s.includes('___'));

describe('grammar example sentences', () => {
  it('finds the lessons of all four target languages', () => {
    expect(lessons.length).toBeGreaterThan(100);
  });

  it.each(lessons)('%s: every choice and article item has example sentences', (_name, lesson) => {
    const missing = (lesson.items ?? [])
      .filter((it) => !it.kind || it.kind === 'choice' || it.kind === 'article')
      .filter((it) => !isExampleList(it.examples))
      .map((it) => it.id);
    expect(missing).toEqual([]);
  });

  it.each(lessons)('%s: every usage point, list item and contrast pair has an examples array', (_name, lesson) => {
    const bad = (lesson.body ?? []).filter((b) => {
      const entries = b.kind === 'usage' ? b.points : b.kind === 'list' ? b.items : b.kind === 'contrast' ? b.pairs : undefined;
      return (entries ?? []).some((e) => !Array.isArray(e.examples));
    });
    expect(bad.map((b) => b.kind)).toEqual([]);
  });
});
