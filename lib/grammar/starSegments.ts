// Splits an example sentence at its `*...*` pairs: the starred parts are highlighted, the stars themselves are
// never kept. An unpaired star stays in the text as a plain character.
export interface StarSegment {
  text: string;
  bold: boolean;
}

export function starSegments(sentence: string): StarSegment[] {
  const out: StarSegment[] = [];
  const re = /\*([^*]+)\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(sentence)) !== null) {
    if (m.index > last) out.push({ text: sentence.slice(last, m.index), bold: false });
    out.push({ text: m[1], bold: true });
    last = m.index + m[0].length;
  }
  if (last < sentence.length) out.push({ text: sentence.slice(last), bold: false });
  return out;
}
