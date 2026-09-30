// Az angol sáv játék-tartalmának regisztrációja (es→en irány: spanyol anyanyelvű
// tanul angolt). Ugyanaz a köteg-minta, mint a `es.ts`: a `content.ts` csak
// összefűzi. Új angol lecke = egy `data/games/grammar/en/<id>.json` + egy import
// és egy sor a `grammarTopics`-ban ide. A témák, amikhez még nincs lecke, a
// Nyelvtan fülön „próximamente” jelvényt kapnak.

import type { GrammarTopicData, LanguageContentBundle } from '../content';

import grammarEnToBe from '@/data/games/grammar/en/to-be.json';
import grammarEnArticles from '@/data/games/grammar/en/articles.json';
import grammarEnPresentSimple from '@/data/games/grammar/en/present-simple.json';
import grammarEnPlurals from '@/data/games/grammar/en/plurals.json';
import grammarEnThisThat from '@/data/games/grammar/en/this-that.json';
import grammarEnPossessives from '@/data/games/grammar/en/possessives.json';
import grammarEnThereIsAre from '@/data/games/grammar/en/there-is-are.json';
import grammarEnPrepositions from '@/data/games/grammar/en/prepositions.json';
import grammarEnHaveGot from '@/data/games/grammar/en/have-got.json';
import grammarEnCanAbility from '@/data/games/grammar/en/can-ability.json';
import grammarEnQuestionWords from '@/data/games/grammar/en/question-words.json';
import grammarEnPresentContinuous from '@/data/games/grammar/en/present-continuous.json';
import grammarEnPastSimpleRegular from '@/data/games/grammar/en/past-simple-regular.json';
import grammarEnPastSimpleIrregular from '@/data/games/grammar/en/past-simple-irregular.json';
import grammarEnGoingTo from '@/data/games/grammar/en/going-to.json';
import grammarEnWill from '@/data/games/grammar/en/will.json';
import grammarEnPresentPerfect from '@/data/games/grammar/en/present-perfect.json';
import grammarEnComparatives from '@/data/games/grammar/en/comparatives.json';

export const enContent: LanguageContentBundle = {
  grammarTopics: [grammarEnToBe, grammarEnArticles, grammarEnPresentSimple, grammarEnPlurals, grammarEnThisThat, grammarEnPossessives, grammarEnThereIsAre, grammarEnPrepositions, grammarEnHaveGot, grammarEnCanAbility, grammarEnQuestionWords, grammarEnPresentContinuous, grammarEnPastSimpleRegular, grammarEnPastSimpleIrregular, grammarEnGoingTo, grammarEnWill, grammarEnPresentPerfect, grammarEnComparatives] as unknown as GrammarTopicData[],
};
