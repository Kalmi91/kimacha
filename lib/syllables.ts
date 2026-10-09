// Könnyű olvasás téma: spanyol szótagoló. Egy szót szótagokra bont úgy, hogy az
// eredeti betűk (kis-/nagybetű, ékezet) megmaradnak: syllabify('carro') -> ['ca', 'rro'].
// Egyszerűsített, de a gyakori szabályokat tudja: diftongus / triftongus egy magban, hiátus
// (két erős magánhangzó vagy ékezetes í / ú) két szótag, ch / ll / rr / qu / gu(e,i) egy hang,
// mássalhangzó-csoport (pl, tr ...) együtt marad, mexikói tl együtt (a-tlas).

const STRONG = 'aeoáéóàèò';
const ACCENTED_WEAK = 'íú';
const LETTERS = /[a-záéíóúüñàèòïç]/i;

// Együtt maradó mássalhangzó-párok (a második l / r, plus tl).
const CLUSTERS = new Set(['pl', 'pr', 'bl', 'br', 'cl', 'cr', 'dr', 'fl', 'fr', 'gl', 'gr', 'kl', 'kr', 'tl', 'tr']);
const DIGRAPHS = new Set(['ch', 'll', 'rr']);

type Unit = { text: string; vowel: boolean };

function isVowelAt(low: string, i: number): boolean {
  const c = low[i];
  if (STRONG.includes(c) || ACCENTED_WEAK.includes(c)) return true;
  if (c === 'u' || c === 'ü' || c === 'i' || c === 'ï') {
    // qu / gu + e, i: az u néma, mássalhangzó-jellegű (que, guerra); gü-nél hangzik.
    if (c === 'u' && i > 0 && (low[i - 1] === 'q' || low[i - 1] === 'g') && 'eéií'.includes(low[i + 1] ?? '')) return false;
    return true;
  }
  // y csak szó végén magánhangzó (muy, hoy), vagy egyedül (y).
  if (c === 'y') return i === low.length - 1;
  return false;
}

// Betű-egységek: magánhangzó vagy mássalhangzó (a ch / ll / rr / qu / gu egy egység).
function units(word: string): Unit[] {
  const low = word.toLowerCase();
  const out: Unit[] = [];
  let i = 0;
  while (i < word.length) {
    if (isVowelAt(low, i)) {
      out.push({ text: word[i], vowel: true });
      i += 1;
      continue;
    }
    const pair = low.slice(i, i + 2);
    if (DIGRAPHS.has(pair)) {
      out.push({ text: word.slice(i, i + 2), vowel: false });
      i += 2;
    } else if ((pair === 'qu' || pair === 'gu') && !isVowelAt(low, i + 1)) {
      out.push({ text: word.slice(i, i + 2), vowel: false });
      i += 2;
    } else {
      out.push({ text: word[i], vowel: false });
      i += 1;
    }
  }
  return out;
}

// Két szomszédos magánhangzó egy magba tartozik (diftongus), ha legalább az egyik gyenge és
// nem ékezetes (í, ú): ciu-dad, bue-no, ai-re. Két erős vagy ékezetes gyenge: hiátus (le-er, ra-íz).
function joins(prev: string, next: string): boolean {
  const p = prev.toLowerCase();
  const n = next.toLowerCase();
  if (ACCENTED_WEAK.includes(p) || ACCENTED_WEAK.includes(n)) return false;
  const pStrong = STRONG.includes(p);
  const nStrong = STRONG.includes(n);
  return !(pStrong && nStrong);
}

function isCluster(a: Unit, b: Unit): boolean {
  return CLUSTERS.has((a.text + b.text).toLowerCase());
}

// Egy szó (betűk) szótagjai. A nem betű karaktert tartalmazó szót a hívó előbb tördelje (lásd syllabifyPhrase).
export function syllabify(word: string): string[] {
  const all = units(word);
  if (all.length === 0 || !all.some((u) => u.vowel)) return word ? [word] : [];

  // Magok: egymás melletti magánhangzó-egységek, diftongusonként összevonva.
  const nuclei: { start: number; end: number }[] = [];
  for (let i = 0; i < all.length; i++) {
    if (!all[i].vowel) continue;
    const last = nuclei[nuclei.length - 1];
    if (last && last.end === i - 1 && joins(all[i - 1].text, all[i].text)) last.end = i;
    else nuclei.push({ start: i, end: i });
  }

  // A magok közti mássalhangzó-csoport vágási pontja (az index, ahol az új szótag kezdődik).
  const cuts: number[] = [];
  for (let n = 0; n < nuclei.length - 1; n++) {
    const from = nuclei[n].end + 1;
    const to = nuclei[n + 1].start; // a mássalhangzók: [from, to)
    const count = to - from;
    if (count <= 0) cuts.push(to); // hiátus: közvetlenül a következő magnál vágunk
    else if (count === 1) cuts.push(from);
    else if (count === 2) cuts.push(isCluster(all[from], all[from + 1]) ? from : from + 1);
    else if (isCluster(all[to - 2], all[to - 1])) cuts.push(to - 2);
    else cuts.push(to - 1);
  }

  const result: string[] = [];
  let begin = 0;
  for (const cut of cuts) {
    result.push(all.slice(begin, cut).map((u) => u.text).join(''));
    begin = cut;
  }
  result.push(all.slice(begin).map((u) => u.text).join(''));
  return result;
}

// Egy kifejezés (szóköz, kötőjel, írásjel): szavanként a szótagok; a nem betű részek külön elemek
// (`syllables: null`), hogy a hívó változatlanul kirajzolhassa őket.
type PhrasePart = { text: string; syllables: string[] | null };

export function syllabifyPhrase(text: string): PhrasePart[] {
  const parts: PhrasePart[] = [];
  let buf = '';
  let inWord = false;
  const flush = () => {
    if (!buf) return;
    parts.push({ text: buf, syllables: inWord ? syllabify(buf) : null });
    buf = '';
  };
  for (const ch of text) {
    const letter = LETTERS.test(ch);
    if (buf && letter !== inWord) flush();
    inWord = letter;
    buf += ch;
  }
  flush();
  return parts;
}
