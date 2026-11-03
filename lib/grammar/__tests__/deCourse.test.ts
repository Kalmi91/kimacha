// The German grammar course (target de: es→de, en→de and hu→de): the syllabus lists the 75 topics of A1 to C1, the
// lessons that exist (6 today, 75 when the course is complete: counted from the files, never hard-coded) are all
// registered in the syllabus order, each loads with its Hungarian sidecar, the derived decks are off, the read-aloud
// text uses the German voice for the «...» snippets. A topic whose lesson file is not written yet is "coming soon".

import { existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { getGrammarTopic, getGrammarTopicIds, getGrammarTopics, isArticleSetItem, type GrammarItem } from '@/lib/games/content';
import { buildGrammarRound } from '@/lib/games/grammarChoice';
import { isVosotrosItem } from '@/lib/grammar/vosotros';
import { DE_GRAMMAR_INDEX } from '@/lib/games/content/de.index';
import { speechLang } from '@/lib/languages';
import { lessonSpeechSegments } from '@/lib/mixedSpeech';
import { lang4Keys } from '../overlay';
import {
  getGrammarSyllabus,
  getGrammarTier,
  hasLesson,
  lessonCoverage,
  lessonKinds,
  nextWrittenTopic,
  orphanLessons,
  syllabusForLevel,
  syllabusLevels,
  syllabusTopic,
  topicsForUnit,
  unitsForLevel,
} from '../syllabus';
import { tableCellsForLesson, wordCellsForLesson } from '../tableDeck';

const ROOT = join(__dirname, '..', '..', '..');
const DATA = join(ROOT, 'data', 'games', 'grammar', 'de');
const files = readdirSync(DATA)
  .filter((f) => f.endsWith('.json'))
  .map((f) => f.slice(0, -5));

const topics = () => syllabusLevels('de').flatMap((l) => syllabusForLevel(l, 'de'));
/** The topics that have a lesson file, in syllabus order. */
const written = () => topics().filter((t) => files.includes(t.id));

describe('German grammar syllabus (lang = de)', () => {
  it('has the levels A1 to C1, 24 + 19 + 16 + 10 + 6 topics, 26 units', () => {
    expect(syllabusLevels('de')).toEqual(['A1', 'A2', 'B1', 'B2', 'C1']);
    expect(syllabusForLevel('A1', 'de')).toHaveLength(24);
    expect(syllabusForLevel('A2', 'de')).toHaveLength(19);
    expect(syllabusForLevel('B1', 'de')).toHaveLength(16);
    expect(syllabusForLevel('B2', 'de')).toHaveLength(10);
    expect(syllabusForLevel('C1', 'de')).toHaveLength(6);
    expect(syllabusLevels('de').flatMap((l) => unitsForLevel(l, 'de'))).toHaveLength(26);
    expect(lessonCoverage('de')).toEqual({ written: files.length, planned: 75 });
  });

  it('puts every topic in a unit of its level, with a title in en, es and hu (and a blurb for every topic)', () => {
    for (const lvl of syllabusLevels('de')) {
      for (const unit of unitsForLevel(lvl, 'de')) {
        expect(topicsForUnit(unit.id, 'de').length).toBeGreaterThan(0);
        for (const l of ['en', 'es', 'hu']) expect(unit.title[l]?.trim()).toBeTruthy();
      }
    }
    for (const topic of topics()) {
      expect(unitsForLevel(topic.level, 'de').map((u) => u.id)).toContain(topic.unit);
      for (const l of ['en', 'es', 'hu']) {
        expect(topic.title[l]?.trim()).toBeTruthy();
        expect(topic.blurb[l]?.trim()).toBeTruthy();
      }
    }
    expect(unitsForLevel('A1', 'de').map((u) => u.id).slice(0, 2)).toEqual(['laute', 'grundlagen']);
    expect(syllabusTopic('aussprache-umlaute', 'de')?.level).toBe('A1');
    expect(syllabusTopic('modalpartikeln', 'de')?.level).toBe('C1');
  });

  it('has unique topic ids and shares none with the Spanish, English or Hungarian syllabus', () => {
    const ids = topics().map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    const others = new Set([
      ...getGrammarSyllabus().map((t) => t.id),
      ...syllabusLevels('en').flatMap((l) => syllabusForLevel(l, 'en')).map((t) => t.id),
      ...syllabusLevels('hu').flatMap((l) => syllabusForLevel(l, 'hu')).map((t) => t.id),
    ]);
    for (const id of ids) expect(others.has(id)).toBe(false);
  });
});

describe('German lessons: registry', () => {
  it('lists exactly the lesson files, in the syllabus order (none missing, none orphaned)', () => {
    const ids = written().map((t) => t.id);
    expect(ids).toHaveLength(files.length);
    expect(getGrammarTopicIds('de')).toEqual(ids);
    expect(DE_GRAMMAR_INDEX.map((e) => e.id)).toEqual(ids);
    expect(orphanLessons('de')).toEqual([]);
    expect(getGrammarTopics('de')).toHaveLength(files.length);
  });

  it('every written lesson loads, with its topic id and the level of its syllabus entry; the others are "coming soon"', () => {
    for (const t of topics()) {
      expect(hasLesson('de', t.id)).toBe(files.includes(t.id));
      if (!files.includes(t.id)) {
        expect(getGrammarTopic('de', t.id)).toBeUndefined();
        expect(lessonKinds('de', t.id)).toEqual([]);
        continue;
      }
      const lesson = getGrammarTopic('de', t.id)!;
      expect(lesson.schema).toBe(2);
      expect(lesson.topic).toBe(t.id);
      expect(lesson.level).toBe(t.level);
      // artikel-genus also carries the der / die / das noun task, with its own button
      expect(lessonKinds('de', t.id)).toEqual(t.id === 'artikel-genus' ? ['choice', 'article', 'form', 'why'] : ['choice', 'form', 'why']);
    }
  });

  it('every text of a lesson has its Hungarian version (the sidecar covers the lesson)', () => {
    for (const lesson of getGrammarTopics('de')) {
      const sidecar = join(ROOT, 'data', 'games', 'grammar-hu', 'de', `${lesson.topic}.json`);
      expect(existsSync(sidecar)).toBe(true);
      const hu = JSON.parse(readFileSync(sidecar, 'utf8')) as Record<string, string>;
      // the generated noun task of artikel-genus carries its Hungarian texts itself (lib/grammar/nounArticles.ts)
      const authored = { ...lesson, items: lesson.items.filter((i) => !isArticleSetItem(i as GrammarItem)) };
      for (const key of lang4Keys(authored)) expect([lesson.topic, key, (hu[key] ?? '').trim().length > 0]).toEqual([lesson.topic, key, true]);
      expect(lesson.speak.hu?.trim()).toBeTruthy();
      expect(lesson.title.hu?.trim()).toBeTruthy();
    }
  });
});

describe('German grammar bands', () => {
  it('every topic has a band, only the three full-inventory topics stay on "full"', () => {
    const FULL = new Set(['komposita-wortbildung', 'n-deklination', 'modalpartikeln']);
    for (const t of topics()) {
      if (FULL.has(t.id)) expect(getGrammarTier(t.id)).toBe('full');
      else expect([t.id, getGrammarTier(t.id)]).not.toEqual([t.id, 'full']);
    }
    expect(getGrammarTier('aussprache-umlaute')).toBe('core');
    expect(getGrammarTier('praesens-regelmaessig')).toBe('core-plus');
    expect(getGrammarTier('artikel-genus')).toBe('exam');
    expect(getGrammarTier('nebensatz-weil-dass')).toBe('core-plus');
    expect(getGrammarTier('konjunktiv-i-indirekte-rede')).toBe('core');
    expect(getGrammarTier('funktionsverbgefuege')).toBe('exam');
  });

  it('the chain of next lessons skips the unwritten topics and ends at the last written one', () => {
    const ids = written().map((t) => t.id);
    ids.slice(0, -1).forEach((id, i) => expect(nextWrittenTopic('de', id)?.id).toBe(ids[i + 1]));
    expect(nextWrittenTopic('de', ids[ids.length - 1])).toBeUndefined();
    expect(nextWrittenTopic('de', 'no-such-topic')).toBeUndefined();
  });
});

describe('German lessons: the round', () => {
  it('no German item is taken for a Spanish vosotros exercise, so the whole lesson is played', () => {
    for (const lesson of getGrammarTopics('de')) {
      expect((lesson.items as GrammarItem[]).filter(isVosotrosItem)).toEqual([]);
      expect(lesson.items.length).toBeGreaterThanOrEqual(30);
      // artikel-genus: the noun task is a seeded sample of 20, not all of its (hundreds of) items
      if (lesson.topic !== 'artikel-genus') expect(buildGrammarRound(lesson, 1)).toHaveLength(lesson.items.length);
    }
  });
});

describe('German lessons: derived decks and read-aloud', () => {
  it('the table deck and the word deck are off for every de lesson (they would build Spanish cards)', () => {
    for (const lesson of getGrammarTopics('de')) {
      expect(tableCellsForLesson(lesson, 'de')).toEqual([]);
      expect(wordCellsForLesson(lesson, 'de')).toEqual([]);
    }
  });

  it('the table deck is off for a Hungarian or German table even where its shape would pass for a Spanish one', () => {
    const lesson = {
      id: 'x',
      body: [
        {
          kind: 'table',
          id: 't',
          title: { en: 't', es: 't' },
          header: [{ en: 'Meaning', es: 'Significado' }, { en: 'Word', es: 'Palabra' }],
          rows: [['I', 'ich']],
        },
      ],
      items: [],
    } as never;
    expect(tableCellsForLesson(lesson)).toHaveLength(1);
    expect(tableCellsForLesson(lesson, 'de')).toEqual([]);
    expect(tableCellsForLesson(lesson, 'hu')).toEqual([]);
  });

  it('the «...» snippets of the read-aloud text are read with the German voice, the rest in the learner\'s language', () => {
    expect(speechLang('de')).toBe('de-DE');
    for (const lesson of getGrammarTopics('de')) {
      for (const contentLang of ['en', 'es', 'hu'] as const) {
        const segments = lessonSpeechSegments(lesson.speak, contentLang, 'de');
        expect(segments.some((s) => s.lang === 'de')).toBe(true);
        expect(segments.some((s) => s.lang === contentLang)).toBe(true);
        for (const s of segments) expect(['de', contentLang]).toContain(s.lang);
      }
    }
  });
});
