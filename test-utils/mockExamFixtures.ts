// Practice-exam paper files for screen tests, made from the engine's fixtures (lib/exam/mock/__tests__/fixtures: filler
// text of the exact lengths of the format). A paper file takes the content of a fixture of the same kind of paper and the
// target / level / paper id of the wanted one, so a whole level can be put into the registry (`@/data/exams/mock`).
// It must not import the blueprint: the registry mock is built while the blueprint is loading.

import esB1Reading from '@/lib/exam/mock/__tests__/fixtures/es-b1-reading.good.json';
import esB2Writing from '@/lib/exam/mock/__tests__/fixtures/es-b2-writing.good.json';
import esC1Listening from '@/lib/exam/mock/__tests__/fixtures/es-c1-listening.good.json';
import enB1Reading from '@/lib/exam/mock/__tests__/fixtures/en-b1-reading.good.json';
import enB2Readinguse from '@/lib/exam/mock/__tests__/fixtures/en-b2-readinguse.good.json';
import enC1Listening from '@/lib/exam/mock/__tests__/fixtures/en-c1-listening.good.json';
import type { AuthoredPaperFile, MockTarget } from '@/lib/exam/mock/types';

type Level = AuthoredPaperFile['level'];

const SOURCES: Record<MockTarget, Record<string, unknown>> = {
  es: { reading: esB1Reading, listening: esC1Listening, writing: esB2Writing },
  en: { reading: enB1Reading, readinguse: enB2Readinguse, listening: enC1Listening, writing: esB2Writing },
};

/** The non-placeholder papers of a level, in the blueprint's order. */
const paperIds = (target: MockTarget, level: Level) => (target === 'es' ? ['reading', 'listening', 'writing'] : level === 'B1' ? ['reading', 'writing', 'listening'] : ['readinguse', 'writing', 'listening']);

/** Every paper file of one level (one form each), so that `mockAvailable(target, level)` is true. */
export function fixturePapers(target: MockTarget, level: Level): AuthoredPaperFile[] {
  return paperIds(target, level).map((paper) => ({ ...(SOURCES[target][paper] as AuthoredPaperFile), target, level, paper }));
}
