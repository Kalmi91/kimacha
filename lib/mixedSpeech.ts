// The text of a grammar lesson is mixed: the explanation goes in the learner's own language, the
// EXAMPLES in it are Spanish ("NOUN: a thing or a person (casa, perro)"). Read aloud with one
// voice, the Spanish example sounds with the explanation language's pronunciation, which spoils
// exactly what it wants to teach. This module cuts the text into language sections; the
// read-aloud itself is the job of lib/speech.ts.

interface SpeechSegment {
  text: string;
  /** The language of the section: the code of the learned language, or that of the content. */
  lang: string;
}

interface SplitOptions {
  learnedLang: string;
  nativeLang: string;
}

// in the `speak` field of a V2 lesson the Spanish sections are marked with
// «...» at authoring time, they are not worked out afterwards by
// guessing from the corpus (that was the earlier bug: the wrong
// voice on an unknown word).
export function splitByMarkers(text: string, opts: SplitOptions): SpeechSegment[] {
  const segments: SpeechSegment[] = [];
  let i = 0;
  while (i < text.length) {
    const open = text.indexOf('«', i);
    if (open === -1) {
      const rest = text.slice(i).trim();
      if (rest) segments.push({ text: rest, lang: opts.nativeLang });
      break;
    }
    const before = text.slice(i, open).trim();
    if (before) segments.push({ text: before, lang: opts.nativeLang });

    const close = text.indexOf('»', open + 1);
    if (close === -1) {
      // No closing mark: from the opening mark to the end of the sentence we read it
      // natively (the mark itself is not text, it is left out).
      const rest = text.slice(open + 1).trim();
      if (rest) segments.push({ text: rest, lang: opts.nativeLang });
      break;
    }
    const inside = text.slice(open + 1, close).trim();
    if (inside) segments.push({ text: inside, lang: opts.learnedLang });
    i = close + 1;
  }
  return segments;
}
