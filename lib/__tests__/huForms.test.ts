import { huHarmony } from '@/lib/huForms';
import { unknownTokens } from '@/lib/knownSentence';
import { adj, has, lacks, noun, verb } from '@/test-utils/huForms';

describe('huHarmony', () => {
  it('reads the last vowel, and looks one back after a neutral one', () => {
    expect(huHarmony('ház')).toBe('b');
    expect(huHarmony('kert')).toBe('f');
    expect(huHarmony('tükör')).toBe('r');
    expect(huHarmony('papír')).toBe('b');
    expect(huHarmony('kávé')).toBe('b');
    expect(huHarmony('hotel')).toBe('f');
    expect(huHarmony('testvér')).toBe('f');
    expect(huHarmony('büfé')).toBe('f');
    expect(huHarmony('szomszéd')).toBe('b');
  });

  it('knows the neutral-vowel nouns that take back endings', () => {
    expect(huHarmony('híd')).toBe('b');
    expect(huHarmony('cél')).toBe('b');
    expect(huHarmony('víz')).toBe('f');
  });
});

describe('huForms, nouns: plural, accusative, cases', () => {
  it('a back-vowel consonant-final noun (ház)', () => {
    has([noun('a ház')], 'házat', 'házak', 'házakat', 'házban', 'házba', 'házból', 'házon', 'házra', 'házról', 'háznál');
    has([noun('a ház')], 'házhoz', 'háztól', 'házzal', 'háznak', 'házért', 'házig');
  });

  it('a front-vowel consonant-final noun (kert) and a front rounded one (tükör)', () => {
    has([noun('a kert')], 'kertet', 'kertek', 'kertben', 'kertbe', 'kerten', 'kertre', 'kertnél', 'kerthez', 'kerttől', 'kerttel', 'kertnek');
    has([noun('a tükör')], 'tükörben', 'tükörhöz', 'tükörrel');
  });

  it('a vowel-final noun lengthens a/e (iroda -> irodában) and keeps the other vowels', () => {
    has([noun('az iroda')], 'irodában', 'irodát', 'irodák', 'irodával', 'irodán', 'irodából', 'irodába', 'irodáig');
    has([noun('a munka')], 'munkát', 'munkába', 'munkához');
    has([noun('az autó')], 'autót', 'autók', 'autóval', 'autóban', 'autóra');
    has([noun('a kefe')], 'kefét', 'keféből');
  });

  it('the accusative after l r n s sz z may be the bare -t', () => {
    has([noun('az asztal')], 'asztalt', 'asztalon', 'asztallal');
    has([noun('a tojás')], 'tojást', 'tojással', 'tojásban');
    has([noun('a doboz')], 'dobozt', 'dobozban', 'dobozzal');
    has([noun('az ember')], 'embert', 'emberek', 'emberrel');
  });

  it('with val/vel the consonant is doubled, also for a digraph and a doubled consonant', () => {
    has([noun('a busz')], 'busszal', 'buszon', 'buszok');
    has([noun('a lány')], 'lánnyal', 'lányok', 'lányt');
    has([noun('a csekk')], 'csekkel', 'csekkek');
  });

  it('-onként, the derived -i and -s adjectives', () => {
    has([noun('a vasárnap')], 'vasárnaponként', 'vasárnapon', 'vasárnapig', 'vasárnapra');
    has([noun('az iroda')], 'irodai');
    has([noun('az alma'), noun('a tojás')], 'almás', 'tojásos');
  });
});

describe('huForms, nouns: possessive endings', () => {
  it('the singular owner, one possession (anyám, fivérem, szükségünk, házuk)', () => {
    has([noun('az anya')], 'anyám', 'anyád', 'anyánk', 'anyátok');
    has([noun('a fivér')], 'fivérem', 'fivéred', 'fivére', 'fivérünk', 'fivéretek');
    has([noun('a szükség')], 'szükségem', 'szükséged', 'szüksége', 'szükségünk', 'szükségetek');
    has([noun('a ház')], 'házam', 'házad', 'háza', 'házunk', 'házatok', 'házuk');
    has([noun('az autó')], 'autóm', 'autód', 'autója', 'autónk', 'autótok', 'autójuk');
    has([noun('a kert')], 'kertem', 'kerted', 'kertje', 'kertünk', 'kertetek', 'kertjük');
  });

  it('several possessions (barátaim, gyerekeim, házaink)', () => {
    has([noun('a barát')], 'barátaim', 'barátaid', 'barátai', 'barátaink', 'barátaitok', 'barátaik');
    has([noun('a gyerek')], 'gyerekeim', 'gyerekei');
    has([noun('az autó')], 'autóim', 'autói');
  });

  it('a case on top of the possessive (anyámnak, irodámban, házamban, barátaimmal)', () => {
    has([noun('az anya')], 'anyámnak', 'anyámmal', 'anyámat', 'anyámról');
    has([noun('a ház')], 'házamban', 'házamat', 'házammal', 'házában', 'házát', 'házunkban', 'házait', 'házaiban');
    has([noun('a barát')], 'barátaimmal', 'barátaimat', 'barátomat', 'barátjával');
    has([noun('az iroda')], 'irodámban', 'irodáját');
  });
});

describe('huForms, adjectives and numerals', () => {
  it('an adjective takes the plural, the accusative, -an/-en, -ul and the comparative', () => {
    has([adj('nagy')], 'nagyok', 'nagyot', 'nagyon', 'nagyobb', 'nagyobbat', 'legnagyobb');
    has([adj('szép')], 'szépek', 'szépet', 'szépen');
    has([adj('drága')], 'drágák', 'drágát');
    has([adj('szomorú'), adj('gyakori')], 'szomorúak', 'gyakoriak');
    has([noun('spanyol')], 'spanyolul');
  });

  it('a numeral takes -kor and the accusative', () => {
    has([['tíz', 'num']], 'tízkor', 'tízet');
    has([['hat', 'num']], 'hatkor', 'hatot');
  });
});

describe('huForms, false positives', () => {
  it('rejects a suffix of the wrong vowel harmony', () => {
    lacks([noun('a ház')], 'házben', 'házbe', 'házhez', 'háznek', 'házvel', 'házet', 'házek', 'házből');
    lacks([noun('a kert')], 'kertban', 'kertba', 'kerthoz', 'kertnak', 'kertval', 'kertat', 'kertak');
    lacks([noun('a tükör')], 'tükörhoz', 'tükörban');
  });

  it('rejects an iroda form without the lengthening, and a suffix that does not exist', () => {
    lacks([noun('az iroda')], 'irodaban', 'irodat', 'irodak', 'irodam', 'irodavel', 'irodábban');
    lacks([noun('a ház')], 'házbanban', 'házakam', 'házmak', 'házás');
  });

  it('knows nothing of a word that was not learned', () => {
    lacks([noun('a ház')], 'kertben', 'asztalt', 'irodában', 'lovat');
    lacks([], 'házat', 'látok', 'volt');
  });

  it('keeps nouns and verbs apart', () => {
    lacks([noun('a ház')], 'házott', 'házol', 'házni');
    lacks([verb('látok')], 'látban', 'látat');
  });
});

describe('huForms, comparatives and the "ülj le" card', () => {
  it('the irregular comparatives of a learned adjective (kisebb, jobb, szebb, hosszabb, nehezebb)', () => {
    has([adj('kicsi')], 'kisebb', 'kisebbet', 'kisebbek', 'kisebben', 'legkisebb');
    has([adj('jó')], 'jobb', 'jobbat', 'jobban', 'legjobb');
    has([adj('szép')], 'szebb', 'szebben', 'legszebb');
    has([adj('hosszú')], 'hosszabb', 'hosszabban', 'leghosszabb');
    has([adj('nehéz')], 'nehezebb', 'nehezebben', 'legnehezebb');
    has([adj('nagy')], 'nagyobb', 'legnagyobb');
    has([adj('magas')], 'magasabb', 'legmagasabb');
  });

  it('a comparative needs its adjective to be learned', () => {
    lacks([adj('nagy')], 'kisebb', 'jobb', 'szebb', 'legkisebb');
    lacks([adj('kicsi')], 'jobb', 'nagyobb', 'kisebbb');
  });

  it('the card "ülj le" is a phrase, not an adjective, so it gives no noun forms (léhez)', () => {
    const cards = require('@/data/words/hu/a1.json') as { id: number; hu: string; pos: string }[];
    const card = cards.find((c) => c.id === 6985);
    expect(card?.hu).toBe('ülj le');
    expect(card?.pos).toBe('phrase');
    lacks([['ülj le', card?.pos]], 'léhez', 'lében', 'lét');
    const ctx = { learned: [{ text: 'ülj le', pos: card?.pos }] };
    expect(unknownTokens('Ülj le!', 'hu', ctx)).toEqual([]);
    expect(unknownTokens('Léhez ülj le.', 'hu', ctx)).toEqual(['léhez']);
  });

  it('a piñata form is recognised as one word', () => {
    has([noun('piñata')], 'piñata', 'piñatát', 'piñaták', 'piñatában', 'piñatával');
    lacks([noun('piñata')], 'piñatat', 'piñataban', 'piñatak');
  });
});
