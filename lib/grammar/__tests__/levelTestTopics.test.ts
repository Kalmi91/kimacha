// The Grammar tab's level percent counts the written lessons of a level; the level test asks the written lessons that
// have a usable question (a match card does not count). Both sets must be the same, and every level of every course must be
// finishable: a topic can tick whatever number of exercise kinds its lesson has (a lesson of one kind, like es A2
// indefinido-10-verbos with only transform items, used to stay open forever and the level never finished).

import { levelDone, kindsOfCtx, pickLevelNext } from '@/lib/grammar/levelTest';
import { levelTestCtx } from '@/lib/grammar/levelTestView';
import { hasLesson, syllabusForLevel, syllabusLevels } from '@/lib/grammar/syllabus';
import { appendEvidence, type TopicEvidence } from '@/lib/grammar/randomRound';
import { questionsOf, topicKindCount, type RoundData } from '@/lib/grammar/randomRoundView';

jest.setTimeout(240000);

const SEED = 1;

describe.each(['es', 'en', 'hu', 'de'])('level test over the real %s course', (lang) => {
  const contentLang = lang === 'en' ? 'es' : 'en';
  const levels = syllabusLevels(lang);

  it.each(levels)('%s: every written lesson has a question, and always-right answers finish the level', (lvl) => {
    const d: RoundData = {
      learnedLang: lang,
      contentLang,
      userLevel: lvl,
      levels,
      startLevel: lvl,
      topics: syllabusForLevel(lvl, lang).filter((tp) => hasLesson(lang, tp.id)),
      cache: { seed: -1, map: new Map() },
    };
    let evidence = new Map<string, TopicEvidence>();
    let ctx = levelTestCtx(d, SEED, lvl, evidence);
    const ids = ctx.topics.map((tp) => tp.id);
    // the Grammar tab's percent and the test count the same topics
    expect(ids).toEqual(d.topics.map((tp) => tp.id));
    // the Grammar tab's kind count (lesson row tick, level button) is the test's
    for (const id of ids) expect(topicKindCount(lang, contentLang, id)).toBe(kindsOfCtx(ctx)(id));

    let prev: string | undefined;
    const limit = ids.length * 12 + 20;
    let steps = 0;
    while (steps < limit && !levelDone(ids, evidence, kindsOfCtx(ctx))) {
      const next = pickLevelNext(ctx, prev, SEED + steps);
      expect(next).not.toBeNull();
      const q = questionsOf(d, SEED, next!.topicId).find((x) => x.id === next!.qid)!;
      evidence = new Map(evidence).set(next!.topicId, appendEvidence(evidence.get(next!.topicId), { id: q.id, kind: q.kind, ok: true, at: '2026-11-01' }));
      ctx = levelTestCtx(d, SEED, lvl, evidence);
      prev = next!.topicId;
      steps++;
    }
    expect(levelDone(ids, evidence, kindsOfCtx(ctx))).toBe(true);
    expect(steps).toBeLessThan(limit);
  });
});
