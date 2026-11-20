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
export function missOfItem(item: GrammarRoundItem['item'], contentLang: string): GrammarMiss | null {
  switch (item.kind) {
    case 'match':
      return null;
    case 'form':
      return { prompt: `${item.person} · ${item.verb}`, given: null, correct: item.answer };
    case 'why':
      return { prompt: item.es, given: null, correct: loc(item.options[item.correctIndex].text, contentLang) };
    case 'transform':
      return { prompt: loc(item.prompt, contentLang), given: null, correct: item.answer };
    case 'write':
      return { prompt: loc(item.prompt, contentLang), given: null, correct: item.es };
    case 'order':
      return { prompt: loc(item.prompt, contentLang), given: null, correct: item.es };
    case 'dictation':
      return { prompt: loc(item.tr, contentLang), given: null, correct: item.es };
    case 'spot':
      return { prompt: item.es, given: null, correct: replaceWord(item.es, item.wrongIndex, item.options[item.correctIndex]) };
    case 'fix':
      return { prompt: item.es, given: null, correct: replaceWord(item.es, item.wrongIndex, item.answer) };
    case 'opencloze': {
      let n = 0;
      return { prompt: item.text, given: null, correct: item.text.replace(/___/g, () => item.answers[n++] ?? '___') };
    }
    case 'bank':
      return { prompt: item.es, given: null, correct: item.es.replace('___', item.answer) };
    case 'noun':
      return { prompt: item.base, given: null, correct: item.answer };
    default:
      return null;
  }
}
