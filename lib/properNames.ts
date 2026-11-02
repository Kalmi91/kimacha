// Capitalised words of a sentence, for the proper-name rule of the "learned words only" gate
// (lib/knownSentence.ts). A pure module: it only reads capitals, it does not know a language.
// scripts/gen-corpus-names.mjs reads the corpus with the same rule (lib/__tests__/properNames.test.ts keeps them equal).

export interface CapitalizedWord {
  /** The word as written, without the punctuation around it ("Tom's", "Budapesten"). */
  word: string;
  /** It opens a sentence or a quotation: its capital is only the capital of a sentence start. */
  initial: boolean;
}

// What opens a new sentence for the capital: the start, the end mark of the one before, a quotation or a
// parenthesis. A capital after one of these is not evidence of a name (conservative: "Mr. Smith" counts Smith as initial).
const OPENER = /["“«¿¡(‘'[]/;
const SENTENCE_END = /[.!?…:]/;
// Letters and digits of the three languages (Latin-1 and Latin Extended-A/B cover á é í ó ö ő ú ü ű ñ).
const EDGE = /^([^A-Za-z0-9À-ɏ]*)(.*?)([^A-Za-z0-9À-ɏ]*)$/;

/** The words that start with a capital letter, each marked whether it stands at the start of a sentence. */
export function capitalizedWords(sentence: string): CapitalizedWord[] {
  const out: CapitalizedWord[] = [];
  let atStart = true;
  for (const chunk of sentence.split(/\s+/)) {
    if (!chunk) continue;
    const [, lead, word, trail] = EDGE.exec(chunk) as RegExpExecArray;
    const initial = atStart || OPENER.test(lead);
    if (word && word[0] !== word[0].toLowerCase()) out.push({ word, initial });
    atStart = SENTENCE_END.test(word ? trail : chunk) || (!word && atStart);
  }
  return out;
}
