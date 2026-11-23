import type { GrammarRoundItem } from '@/lib/games/grammarChoice';
import type { Lang4 } from '@/lib/grammar/lessonTypes';

// One mistaken answer of a round, as the result screen lists it ("Mistakes:"): the task, what the learner gave
// (null when the task kind does not report it, then only the right solution is shown) and the right solution.
export interface GrammarMiss {
  prompt: string;
  given: string | null;
  correct: string;
}

const loc = (l: Lang4, lang: string): string => (l as unknown as Record<string, string>)[lang] ?? l.en;

// the sentence with the word at `index` (space-split) replaced; an empty replacement deletes the word
const replaceWord = (sentence: string, index: number, word: string): string => {
  const words = sentence.split(' ');
  if (word === '') words.splice(index, 1);
  else words[index] = word;
  return words.join(' ');
};

/** The task and the right solution of a mistaken non-choice item; null where there is nothing sensible to list (matching). */
export function missOfItem(item: GrammarRoundItem['item'], contentLang: string, given?: string): GrammarMiss | null {
  const g = given && given.trim() !== '' ? given.trim() : null;
  switch (item.kind) {
    case 'match':
      // a match item has no single answer: the task is the Spanish side, the solution is every pair
      return { prompt: item.pairs.map((p) => p.es).join(' · '), given: null, correct: item.pairs.map((p) => `${p.es} = ${p.en}`).join(' · ') };
    case 'form':
      return { prompt: `${item.person} · ${item.verb}`, given: g, correct: item.answer };
    case 'why':
      return { prompt: item.es, given: g, correct: loc(item.options[item.correctIndex].text, contentLang) };
    case 'transform':
      return { prompt: loc(item.prompt, contentLang), given: g, correct: item.answer };
    case 'write':
      return { prompt: loc(item.prompt, contentLang), given: g, correct: item.es };
    case 'order':
      return { prompt: loc(item.prompt, contentLang), given: g, correct: item.es };
    case 'dictation':
      return { prompt: loc(item.tr, contentLang), given: g, correct: item.es };
    case 'spot': {
      const correct = replaceWord(item.es, item.wrongIndex, item.options[item.correctIndex]);
      // given is the option picked; the sentence as the learner left it
      const left = given === undefined ? null : replaceWord(item.es, item.wrongIndex, given);
      return { prompt: item.es, given: left !== null && left !== correct ? left : null, correct };
    }
    case 'fix':
      return { prompt: item.es, given: g === null ? null : replaceWord(item.es, item.wrongIndex, g), correct: replaceWord(item.es, item.wrongIndex, item.answer) };
    case 'opencloze': {
      let n = 0;
      return { prompt: item.text, given: g, correct: item.text.replace(/___/g, () => item.answers[n++] ?? '___') };
    }
    case 'bank':
      return { prompt: item.es, given: g === null ? null : item.es.replace('___', g), correct: item.es.replace('___', item.answer) };
    case 'noun':
      return { prompt: item.base, given: g, correct: item.answer };
    default:
      return null;
  }
}
