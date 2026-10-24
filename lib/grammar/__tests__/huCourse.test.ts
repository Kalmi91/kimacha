// The Hungarian grammar course (target hu: es→hu and en→hu): the syllabus lists exactly the 40
// lesson files, every lesson loads, levels A1 and A2, the derived decks are off, the read-aloud text
// uses the Hungarian voice for the «...» snippets.

import { readdirSync } from 'fs';
import { join } from 'path';
import { getGrammarTopic, getGrammarTopicIds, getGrammarTopics, type GrammarItem } from '@/lib/games/content';
import { buildGrammarRound } from '@/lib/games/grammarChoice';
import { isVosotrosItem } from '@/lib/grammar/vosotros';
import { HU_GRAMMAR_INDEX } from '@/lib/games/content/hu.index';
import { speechLang } from '@/lib/languages';
import { lessonSpeechSegments } from '@/lib/mixedSpeech';
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

const DATA = join(__dirname, '..', '..', '..', 'data', 'games', 'grammar', 'hu');
const files = readdirSync(DATA)
  .filter((f) => f.endsWith('.json'))
  .map((f) => f.slice(0, -5));

const topics = () => [...syllabusForLevel('A1', 'hu'), ...syllabusForLevel('A2', 'hu')];

describe('Hungarian grammar syllabus (lang = hu)', () => {
  it('has the levels A1 and A2, 24 + 16 topics', () => {
    expect(syllabusLevels('hu')).toEqual(['A1', 'A2']);
    expect(syllabusForLevel('A1', 'hu')).toHaveLength(24);
    expect(syllabusForLevel('A2', 'hu')).toHaveLength(16);
    expect(lessonCoverage('hu')).toEqual({ written: 40, planned: 40 });
  });

  it('groups the topics into the ten units, each with topics and a title in both languages', () => {
    expect(unitsForLevel('A1', 'hu').map((u) => u.id)).toEqual(['hangok', 'alapok', 'jelen', 'helyek', 'birtoklas', 'kerdes', 'mindennap']);
    expect(unitsForLevel('A2', 'hu').map((u) => u.id)).toEqual(['mult-jovo', 'modok', 'osszetett']);
    for (const lvl of syllabusLevels('hu')) {
      for (const unit of unitsForLevel(lvl, 'hu')) {
        expect(topicsForUnit(unit.id, 'hu').length).toBeGreaterThan(0);
        for (const l of ['en', 'es']) expect(unit.title[l]).toBeTruthy();
      }
    }
    for (const topic of topics()) {
      for (const l of ['en', 'es']) {
        expect(topic.title[l]).toBeTruthy();
        expect(topic.blurb[l]).toBeTruthy();
      }
    }
  });

  it('lists exactly the 40 lesson files, in the registry order (none missing, none orphaned)', () => {
    const ids = topics().map((t) => t.id);
    expect(ids).toHaveLength(40);
    expect(new Set(ids).size).toBe(40);
    expect([...ids].sort()).toEqual([...files].sort());
    expect(getGrammarTopicIds('hu')).toEqual(ids);
    expect(HU_GRAMMAR_INDEX.map((e) => e.id)).toEqual(ids);
    expect(orphanLessons('hu')).toEqual([]);
  });

  it('every lesson loads, with its topic id and the level of its syllabus entry', () => {
    for (const t of topics()) {
      expect(hasLesson('hu', t.id)).toBe(true);
      const lesson = getGrammarTopic('hu', t.id)!;
      expect(lesson.schema).toBe(2);
      expect(lesson.topic).toBe(t.id);
      expect(lesson.level).toBe(t.level);
      expect(lessonKinds('hu', t.id)).toEqual(['choice', 'form', 'why']);
    }
    expect(getGrammarTopics('hu')).toHaveLength(40);
  });

  it('every topic has a band (not the default) and the A1 → A2 chain of next lessons is unbroken', () => {
    for (const t of topics()) expect(getGrammarTier(t.id)).not.toBe('full');
    expect(getGrammarTier('hangrend')).toBe('core-plus');
    expect(getGrammarTier('vonatkozo-nevmasok')).toBe('exam');
    const ids = topics().map((t) => t.id);
    ids.slice(0, -1).forEach((id, i) => expect(nextWrittenTopic('hu', id)?.id).toBe(ids[i + 1]));
    expect(nextWrittenTopic('hu', ids[ids.length - 1])).toBeUndefined();
    expect(nextWrittenTopic('hu', 'melleknev')?.id).toBe('mult-ido');
    expect(syllabusTopic('mult-ido', 'hu')?.level).toBe('A2');
  });

  it('does not share topic ids with the Spanish or English syllabus', () => {
    const others = new Set([
      ...getGrammarSyllabus().map((t) => t.id),
      ...syllabusLevels('en').flatMap((l) => syllabusForLevel(l, 'en')).map((t) => t.id),
    ]);
    for (const t of topics()) expect(others.has(t.id)).toBe(false);
  });
});

describe('Hungarian lessons: the round', () => {
  it('no Hungarian item is taken for a Spanish vosotros exercise, so the whole lesson is played (30 items)', () => {
    for (const lesson of getGrammarTopics('hu')) {
      expect((lesson.items as GrammarItem[]).filter(isVosotrosItem)).toEqual([]);
      expect(buildGrammarRound(lesson, 1)).toHaveLength(30);
    }
  });
});

describe('Hungarian lessons: derived decks and read-aloud', () => {
  it('the table deck and the word deck are off for every hu lesson (they would build Spanish cards)', () => {
    for (const lesson of getGrammarTopics('hu')) {
      expect(tableCellsForLesson(lesson)).toEqual([]);
      expect(wordCellsForLesson(lesson, 'hu')).toEqual([]);
    }
  });

  it('the «...» snippets of speak.en / speak.es are read with the Hungarian voice, the rest in the learner\'s language', () => {
    expect(speechLang('hu')).toBe('hu-HU');
    for (const lesson of getGrammarTopics('hu')) {
      for (const contentLang of ['en', 'es'] as const) {
        const segments = lessonSpeechSegments(lesson.speak, contentLang, 'hu');
        expect(segments.some((s) => s.lang === 'hu')).toBe(true);
        expect(segments.some((s) => s.lang === contentLang)).toBe(true);
        for (const s of segments) expect(['hu', contentLang]).toContain(s.lang);
      }
    }
  });
});
