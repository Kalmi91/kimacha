// A nyelvtan-lecke szövege kevert: a magyarázat a tanuló saját nyelvén megy, a
// benne lévő PÉLDÁK spanyolul („FŐNÉV: dolog vagy személy (casa, perro)"). Egy
// hanggal felolvasva a spanyol példa magyar kiejtéssel szól, ami pont azt rontja
// el, amit tanítani akar. Ez a modul vágja szét a szöveget nyelv-szakaszokra; a
// felolvasás maga a lib/speech.ts dolga.

interface SpeechSegment {
  text: string;
  /** A szakasz nyelve: a tanult nyelv kódja, vagy a tartalom nyelvéé. */
  lang: string;
}

interface SplitOptions {
  learnedLang: string;
  nativeLang: string;
}

// LECKE-SEMA 3.2: a V2 lecke `speak` mezőjében a spanyol szakaszok «...»
// jelöléssel vannak megjelölve a szerzőség idején, nem korpusz-találgatással
// derülnek ki utólag (ez volt FB216/FB234 hibája: ismeretlen szónál rossz
// hang).
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
      // Nincs záró jel: a nyitó jeltől a mondat végéig natívan olvassuk fel
      // (a jelölés maga nem szöveg, kimarad).
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
