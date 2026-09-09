// FB221, Kálmán 2026-09-10 (grammar:ser-estar:drill): „I do not like the structure
// of the more I want it to be more cleare and organized".
//
// A leckék `more` mezője egy bekezdésnyi próza. Van, ahol számozott kivétel-lista
// ül benne („Exception classes: 1) … 2) … 3) …"), van, ahol több különálló
// szabály egymás után. Egyetlen <Text>-ként kiírva ez szövegfal, pont a
// kivételeknél, ahol a legjobban számít, hogy külön lássa őket az ember.
//
// A lecke SZÖVEGÉT nem írjuk át (a tartalom 1:1 marad, ez a fájlokban él), csak
// felismerjük a benne lévő szerkezetet, és soronként adjuk vissza. Így minden
// meglévő lecke azonnal tagolt lesz, adat-migráció nélkül.

export type MoreBlock =
  /** A számozott lista bevezetője, pl. „Exception classes". */
  | { kind: 'heading'; text: string }
  /** A lista egy eleme, a saját sorszámával. */
  | { kind: 'item'; label: string; text: string }
  /** Külön szabály/mondat, sorszám nélkül. */
  | { kind: 'bullet'; text: string }
  /** Egyetlen mondatnyi bekezdés, felsorolás-jel nélkül. */
  | { kind: 'para'; text: string };

/** „1) ", „2) ", … a bekezdésen belül, sor elején vagy szóköz után. */
const NUMBERED = /(?:^|\s)(\d{1,2})\)\s+/g;

/**
 * Rövid, kisbetűs szócska a pont előtt: rövidítés (p. ej.), nem mondatvég.
 * A magyar sorszámok (1. 2.) nem gond, azokat a NUMBERED külön kezeli.
 */
function endsAbbreviation(sentenceSoFar: string): boolean {
  const lastWord = sentenceSoFar.trim().split(/\s+/).pop() ?? '';
  const bare = lastWord.replace(/[.!?]+$/, '');
  return bare.length <= 2 && bare === bare.toLowerCase();
}

function startsSentence(ch: string): boolean {
  if ('¿¡"“«('.includes(ch)) return true;
  // Nagybetű nyelvfüggetlenül: az ékezetes betűkre is igaz, a számokra nem.
  return ch !== ch.toLowerCase() && ch === ch.toUpperCase();
}

/**
 * Mondatokra bont úgy, hogy a zárójelen belüli pont („(La fiesta es aquí.)")
 * nem vág. Ha nem talál mondathatárt, egyetlen elemet ad vissza.
 */
export function splitSentences(text: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === '(') depth += 1;
    else if (ch === ')') depth = Math.max(0, depth - 1);
    if (depth > 0) continue;
    if (ch !== '.' && ch !== '!' && ch !== '?') continue;

    // A mondatvégi írásjel-csoport végére ugrunk (pl. „…?!").
    let end = i;
    while (end + 1 < text.length && '.!?'.includes(text[end + 1])) end += 1;
    let next = end + 1;
    while (next < text.length && text[next] === ' ') next += 1;
    if (next === end + 1) continue; // nincs szóköz utána: tizedespont, rövidítés
    if (next >= text.length) break;
    if (!startsSentence(text[next])) continue;
    if (endsAbbreviation(text.slice(start, end + 1))) continue;

    out.push(text.slice(start, end + 1).trim());
    start = next;
    i = next - 1;
  }
  const tail = text.slice(start).trim();
  if (tail) out.push(tail);
  return out.length ? out : [text.trim()];
}

function parseParagraph(paragraph: string): MoreBlock[] {
  const text = paragraph.trim();
  if (!text) return [];

  NUMBERED.lastIndex = 0;
  const marks: { at: number; after: number; label: string }[] = [];
  let m: RegExpExecArray | null;
  while ((m = NUMBERED.exec(text)) !== null) {
    marks.push({ at: m.index, after: m.index + m[0].length, label: m[1] });
  }

  // Egyetlen „1)" még nem lista, az lehet egy zárójeles hivatkozás is.
  if (marks.length >= 2) {
    const blocks: MoreBlock[] = [];
    const intro = text.slice(0, marks[0].at).trim().replace(/[:：]$/, '').trim();
    if (intro) blocks.push({ kind: 'heading', text: intro });
    marks.forEach((mark, i) => {
      const end = i + 1 < marks.length ? marks[i + 1].at : text.length;
      const body = text.slice(mark.after, end).trim();
      if (body) blocks.push({ kind: 'item', label: mark.label, text: body });
    });
    return blocks;
  }

  const sentences = splitSentences(text);
  if (sentences.length < 2) return [{ kind: 'para', text }];
  return sentences.map((s) => ({ kind: 'bullet', text: s }));
}

/**
 * A `more` prózát tagolt blokkokra bontja: bevezető + számozott kivételek, vagy
 * mondatonként egy-egy felsorolás-pont.
 *
 * @param more a lecke `more` szövege a felhasználó nyelvén
 * @returns a megjelenítendő blokkok, a szöveg változtatása nélkül
 */
export function parseMoreBlocks(more: string): MoreBlock[] {
  const blocks = more.split(/\n+/).flatMap((paragraph) => parseParagraph(paragraph));
  // Egy blokkon belül ne keveredjen a felsorolás-pontos és a csupasz bekezdés:
  // ha a szöveg bárhol pontokra bomlott, a magányos bekezdések is pontot kapnak.
  if (!blocks.some((b) => b.kind === 'bullet')) return blocks;
  return blocks.map((b) => (b.kind === 'para' ? { kind: 'bullet', text: b.text } : b));
}
