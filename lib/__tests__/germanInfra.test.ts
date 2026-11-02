// German (de) as a fourth language, the plumbing that is not a deck or a screen of its own: the word
// gate, the exercises that read a card's two sides, the places that have no German content yet (they
// say so, they never answer in Spanish or English), and the UI strings that name a language.

import { setPcicTarget, type PcicItem } from '@/data/pcic';
import { cumulativeCorpusWordIds, getGrammarTopicIds } from '@/lib/games/content';
import { findWordByText } from '@/data/words';
import { germanReadings, strictAnswerMatch } from '@/lib/answerMatch';
import { placementPoolFor } from '@/lib/exam/placementQuestions';
import { mockAvailable, MOCK_LEVELS } from '@/lib/exam/mock/blueprint';
import { mockInstruction } from '@/lib/exam/mock/author';
import { TASK_PREFIX } from '@/lib/exam/mock/types';
import { syllabusLevels, syllabusForLevel, syllabusTopic, unitsForLevel } from '@/lib/grammar/syllabus';
import { wordCellsForLesson } from '@/lib/grammar/tableDeck';
import { stringsFor, setLanguage, t } from '@/lib/i18n';
import { isSentenceKnown, knownTokens, sentenceTokens, unknownTokens } from '@/lib/knownSentence';
import { exampleIn, wordIn } from '@/lib/pcicItemText';
import { buildBoards, isMatchUsable, matchCard } from '@/lib/practice/match';
import { gapTaskFor } from '@/lib/practice/gapFill';
import { scrambleWord } from '@/lib/practice/scramble';
import { situationsFor } from '@/lib/practice/situations';
import { storiesFor } from '@/lib/practice/stories';

const dog: PcicItem = {
  id: 'd100001',
  es: 'el perro',
  en: 'the dog',
  hu: 'a kutya',
  de: 'der Hund',
  kind: 'word',
  section: '',
  order: 0,
  pos: 'noun',
  exampleEs: 'El perro duerme.',
  exampleEn: 'The dog sleeps.',
  exampleHu: 'A kutya alszik.',
  exampleDe: 'Der Hund schläft.',
};

afterEach(() => {
  setPcicTarget('es', 'en');
  setLanguage('en');
});

describe('the word gate, German', () => {
  it('reads umlauts and ß as letters, lower-cases, and ignores a bracketed gloss of the headword', () => {
    expect(sentenceTokens('Das Mädchen ißt die Straße entlang.', 'de')).toEqual(['das', 'mädchen', 'ißt', 'die', 'straße', 'entlang']);
    expect(knownTokens('de', { learned: [{ text: 'die Leute (Pl.)' }] }).has('pl')).toBe(false);
    expect(knownTokens('de', { learned: [{ text: 'die Leute (Pl.)' }] }).has('leute')).toBe(true);
  });

  it('knows the articles and the common conjunctions without learning them', () => {
    const known = knownTokens('de', { learned: [] });
    for (const word of ['der', 'die', 'das', 'den', 'dem', 'ein', 'eine', 'und', 'oder', 'aber', 'nicht']) expect(known.has(word)).toBe(true);
    expect(known.has('hund')).toBe(false);
  });

  it('lets a sentence through only when every word is learned (a capitalised noun is not a free name)', () => {
    const ctx = { learned: ['Hund', 'schläft'] };
    expect(isSentenceKnown('Der Hund schläft.', 'de', ctx)).toBe(true);
    expect(isSentenceKnown('Der Hund schläft und der Garten auch.', 'de', ctx)).toBe(false);
    expect(unknownTokens('Der Hund liebt den Garten.', 'de', { learned: ['Hund', 'liebt'] })).toEqual(['garten']);
  });

  it('is not the Spanish or the English gate', () => {
    // the Spanish article is not a free word of German, so a Spanish sentence never passes the German gate
    expect(isSentenceKnown('El perro duerme.', 'de', { learned: ['perro', 'duerme'] })).toBe(false);
    expect(knownTokens('de', { learned: [] }).has('el')).toBe(false);
    expect(knownTokens('de', { learned: [] }).has('the')).toBe(false);
  });
});

describe('a deck card read by language', () => {
  it('has a German word and a German example sentence, and no other language answers for it', () => {
    expect(wordIn(dog, 'de')).toBe('der Hund');
    expect(exampleIn(dog, 'de')).toBe('Der Hund schläft.');
    expect(exampleIn(dog, 'hu')).toBe('A kutya alszik.');
    expect(exampleIn({ ...dog, exampleDe: undefined }, 'de')).toBeUndefined();
  });

  it('match game: German on the left with the other language of the pair on the right', () => {
    setPcicTarget('de', 'hu');
    expect(matchCard(dog, 'de')).toEqual({ es: 'der Hund', en: 'a kutya' });
    setPcicTarget('es', 'de');
    expect(matchCard(dog, 'es')).toEqual({ es: 'der Hund', en: 'el perro' });
    // a Hungarian target keeps Hungarian on the left (the rule of the hu pairs), the German prompt on the right
    setPcicTarget('hu', 'de');
    expect(matchCard(dog, 'hu')).toEqual({ es: 'a kutya', en: 'der Hund' });
    expect(isMatchUsable(dog, 'de')).toBe(true);
    // a card with no German text cannot be a pair
    expect(isMatchUsable({ ...dog, de: undefined }, 'es')).toBe(false);
    expect(buildBoards([dog], 'hu')).toEqual([['d100001']]);
  });

  it('the letter game sets the German article apart, it is not scrambled', () => {
    setPcicTarget('de', 'en');
    const word = scrambleWord(dog, 'de');
    expect(word.article).toBe('der');
    expect(word.letters.join('')).toBe('Hund');
    expect(word.say).toBe('der Hund');
    expect(word.meaning).toBe('the dog');
  });

  it('the gap game blanks the noun of a German sentence, article left out of the match', () => {
    setPcicTarget('de', 'en');
    expect(gapTaskFor(dog, 'de')).toMatchObject({ before: 'Der ', answer: 'Hund', after: ' schläft.', translation: 'The dog sleeps.', meaning: 'the dog' });
  });

  it('the gap game finds an umlaut word whole (Mädchen is one word)', () => {
    setPcicTarget('de', 'en');
    const girl: PcicItem = { ...dog, de: 'das Mädchen', en: 'the girl', exampleDe: 'Das Mädchen lacht.', exampleEn: 'The girl laughs.' };
    expect(gapTaskFor(girl, 'de')).toMatchObject({ answer: 'Mädchen' });
  });
});

describe('typing German', () => {
  it('the answer matcher takes the digraph spellings, and never swaps der / die / das', () => {
    expect(germanReadings('Straße')).toEqual(['Strasse']);
    expect(strictAnswerMatch('die Strasse', 'die Straße', { lang: 'de' })).toBe(true);
    expect(strictAnswerMatch('schoen', 'schön', { lang: 'de' })).toBe(true);
    expect(strictAnswerMatch('die Hund', 'der Hund', { lang: 'de', eitherArticle: true })).toBe(false);
  });
});

describe('places with no German content yet say so, they never answer in another language', () => {
  it('has the German grammar course (its own syllabus, never the Spanish one), but no tappable word and no known word', () => {
    expect(getGrammarTopicIds('de').length).toBeGreaterThan(0);
    expect(syllabusLevels('de')).toEqual(['A1', 'A2', 'B1', 'B2', 'C1']);
    expect(syllabusForLevel('A1', 'de').map((t) => t.id)).toContain('aussprache-umlaute');
    expect(unitsForLevel('A1', 'de').length).toBeGreaterThan(0);
    expect(syllabusTopic('presente-regular', 'de')).toBeUndefined();
    expect(syllabusTopic('praesens-regelmaessig', 'de')).toBeDefined();
    expect(syllabusLevels('es').length).toBeGreaterThan(0);
    expect(findWordByText('perro', 'es', 'de')).toBeUndefined();
    expect(cumulativeCorpusWordIds('B1', 'de').size).toBe(0);
    expect(wordCellsForLesson({ id: 'x', items: [] } as never, 'de')).toEqual([]);
  });

  it('has German stories (A1 so far), and the dialogues exist for the Spanish and the German target in every learner language, never for English or Hungarian', () => {
    expect(storiesFor('de').length).toBeGreaterThanOrEqual(20);
    expect(storiesFor('de').some((story) => story.level === 'A1')).toBe(true);
    for (const source of ['en', 'hu', 'de'] as const) expect(situationsFor('es', source).length).toBeGreaterThan(0);
    for (const source of ['en', 'hu', 'es'] as const) expect(situationsFor('de', source).length).toBeGreaterThan(0);
    expect(situationsFor('en', 'de')).toEqual([]);
    expect(situationsFor('hu', 'de')).toEqual([]);
  });

  it('has a practice exam on every level, the paper words are German', () => {
    expect(MOCK_LEVELS.de).toEqual(['A1', 'A2', 'B1', 'B2', 'C1']);
    expect(mockAvailable('de', 'A1')).toBe(true);
    expect(mockAvailable('de', 'B1')).toBe(true);
    expect(mockInstruction('de', 'read_mc', 1)).toMatch(/^TEIL 1\. /);
    expect(mockInstruction('de', 'listen_mc', 2, 1)).toContain('einmal');
    expect('TEIL 3. Lesen Sie den Text.'.replace(TASK_PREFIX, '')).toBe('Lesen Sie den Text.');
  });

  it('draws the placement gap sentences of a German target from the written German lessons and the authored bank, never from the der / die / das noun task', () => {
    const a1 = placementPoolFor('A1', 'de').gaps;
    const bank = a1.filter((g) => g.topicId === 'placement');
    const fromLessons = a1.filter((g) => g.topicId !== 'placement');
    expect(bank).toHaveLength(20);
    expect(fromLessons.length).toBeGreaterThan(0);
    expect(a1.length).toBeLessThan(600);
    expect(a1.every((g) => g.sentence.includes('___') && !g.itemId.startsWith('art-n-'))).toBe(true);
    expect(fromLessons.map((g) => g.topicId)).toContain('aussprache-umlaute');
    expect(fromLessons.every((g) => syllabusForLevel('A1', 'de').some((tp) => tp.id === g.topicId))).toBe(true);
  });
});

describe('the UI strings that name a language', () => {
  it('German has strings of its own: neither English nor Spanish', () => {
    setLanguage('de');
    const german = t();
    setLanguage('en');
    expect(german).not.toBe(t());
    expect(german.onboarding.learnTitle).toBe('Welche Sprache möchtest du lernen?');
    expect(stringsFor('de')).not.toBe(stringsFor('en'));
    expect(stringsFor('de')).not.toBe(stringsFor('es'));
  });

  it('names German in the typing and speaking prompts of every UI language', () => {
    for (const code of ['en', 'es', 'hu']) {
      setLanguage(code);
      const s = t();
      expect(s.card.typeIn('de')).not.toBe(s.card.typeIn('en'));
      expect(s.card.typeIn('de')).not.toBe(s.card.typeIn('es'));
      expect(s.card.typeIn('de')).not.toBe(s.card.typeIn('hu'));
      expect(s.exam.speakTranslate('de')).not.toBe(s.exam.speakTranslate('en'));
      expect(s.exam.speakTranslate('de')).not.toBe(s.exam.speakTranslate('hu'));
    }
    setLanguage('en');
    expect(t().card.typeIn('de')).toBe('Type in German');
    setLanguage('es');
    expect(t().card.typeIn('de')).toBe('Escribe en alemán');
    setLanguage('hu');
    expect(t().card.typeIn('de')).toBe('Írd be németül');
  });

  it('the grammar tab has a "no German course yet" line in every UI language', () => {
    for (const code of ['en', 'es', 'hu']) {
      setLanguage(code);
      expect(t().grammar.noCourse.length).toBeGreaterThan(10);
    }
  });
});
