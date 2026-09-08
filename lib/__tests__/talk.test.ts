import { MACROS, TALK_LEVELS, topicsByMacro, macroWords, levelsWithWords, getMacro } from '../talk/catalog';
import { buildTalkQuiz, MIN_QUIZ_WORDS } from '../talk/quiz';
import { getTalkPacks, getTalkPack, getTalkStory, getTalkChat, levelsWithPack } from '../talk/packs';
import { getTopicsForLevel } from '@/data/topics';

describe('talk catalog', () => {
  it('covers every PCIC macro used by the tree topics', () => {
    const known = new Set(MACROS.map((m) => m.macro));
    for (const level of TALK_LEVELS) {
      for (const topic of getTopicsForLevel(level, 'es')) {
        if (topic.type !== 'vocab') continue;
        expect(known.has(topic.macro ?? 0)).toBe(true);
      }
    }
  });

  it('groups the same subject across levels under one macro', () => {
    // compras (A1), compras_servicios (A2), compras_productos_b1 (B1) mind a 12-es makró.
    const list = topicsByMacro('es').get(12) ?? [];
    const ids = list.map((mt) => mt.topic.id);
    expect(ids).toContain('compras');
    expect(ids).toContain('compras_servicios');
    expect(ids).toContain('compras_productos_b1');
  });

  it('has vocabulary for the shopping macro at A1 and B1', () => {
    expect(macroWords(12, 'A1', 'es').length).toBeGreaterThan(MIN_QUIZ_WORDS);
    expect(macroWords(12, 'B1', 'es').length).toBeGreaterThan(MIN_QUIZ_WORDS);
    expect(levelsWithWords(12, 'es')).toEqual(expect.arrayContaining(['A1', 'A2', 'B1']));
  });

  it('names every macro in all four languages', () => {
    for (const m of MACROS) {
      expect(m.name_hu.length).toBeGreaterThan(0);
      expect(m.name_en.length).toBeGreaterThan(0);
      expect(m.name_es.length).toBeGreaterThan(0);
      expect(m.name_de.length).toBeGreaterThan(0);
      expect(getMacro(m.macro)).toBe(m);
    }
  });
});

describe('talk quiz', () => {
  it('builds four-option items from the cell vocabulary', () => {
    const items = buildTalkQuiz(12, 'A1', 'es', 'hu', 42, 8);
    expect(items.length).toBe(8);
    for (const item of items) {
      expect(item.options.length).toBe(4);
      expect(item.prompt.length).toBeGreaterThan(0);
      expect(new Set(item.options).size).toBe(4);
      expect(item.options[item.correctIndex].length).toBeGreaterThan(0);
    }
  });

  it('is deterministic for the same seed and varies with a different one', () => {
    const a = buildTalkQuiz(12, 'A1', 'es', 'hu', 7, 5);
    const b = buildTalkQuiz(12, 'A1', 'es', 'hu', 7, 5);
    const c = buildTalkQuiz(12, 'A1', 'es', 'hu', 8, 5);
    expect(a.map((i) => i.wordId)).toEqual(b.map((i) => i.wordId));
    expect(a.map((i) => i.wordId)).not.toEqual(c.map((i) => i.wordId));
  });

  it('returns nothing for a cell with no vocabulary', () => {
    expect(buildTalkQuiz(19, 'A1', 'es', 'hu', 1)).toEqual([]);
  });
});

describe('talk packs', () => {
  it('ships the shopping macro at A1 and B1', () => {
    expect(levelsWithPack('es', 12).sort()).toEqual(['A1', 'B1']);
    expect(getTalkPack('es', 12, 'A1')).toBeDefined();
    expect(getTalkPack('es', 12, 'B1')).toBeDefined();
    expect(getTalkPack('es', 12, 'C1')).toBeUndefined();
  });

  it('keeps every pack self-consistent and findable by content id', () => {
    for (const pack of getTalkPacks('es')) {
      expect(pack.story.level).toBe(pack.level);
      expect(pack.chat.level).toBe(pack.level);
      expect(pack.story.scenes.length).toBeGreaterThan(0);
      expect(pack.chat.nodes.length).toBeGreaterThan(0);
      expect(getTalkStory('es', pack.story.id)).toBe(pack.story);
      expect(getTalkChat('es', pack.chat.id)).toBe(pack.chat);
    }
  });

  it('does not leak talk content into the Game tab pools', () => {
    // A Game fül sztorijai és csevegései külön tömbben élnek, ezért a fül
    // kínálata nem változik attól, hogy az Átbeszélő kap új pakkot.
    const { getStories, getChats } = require('@/lib/games/content');
    const talkStoryIds = getTalkPacks('es').map((p) => p.story.id);
    const talkChatIds = getTalkPacks('es').map((p) => p.chat.id);
    for (const st of getStories('es')) expect(talkStoryIds).not.toContain(st.id);
    for (const ch of getChats('es')) expect(talkChatIds).not.toContain(ch.id);
  });
});
