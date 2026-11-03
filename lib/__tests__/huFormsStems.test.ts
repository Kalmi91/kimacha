import { huStemChangingWords } from '@/lib/huForms';
import { has, lacks, noun } from '@/test-utils/huForms';

// One expectation per row of the stem-changing table: the forms that differ from the plain paradigm.
const STEM_CHANGING: Record<string, string[]> = {
  ló: ['lovat', 'lovak', 'lova', 'lovon', 'lóval', 'lónak', 'lóban'],
  tó: ['tavat', 'tavak', 'tava', 'tavon', 'tóval', 'tóban'],
  kő: ['követ', 'kövek', 'köve', 'kövön', 'kővel', 'kőben'],
  fű: ['füvet', 'füvek', 'füve', 'füvön', 'fűvel', 'fűben'],
  hó: ['havat', 'havak', 'hava', 'havon', 'hóval', 'hóban'],
  szó: ['szót', 'szavak', 'szava', 'szóval', 'szóban'],
  nyár: ['nyarat', 'nyarak', 'nyara', 'nyáron', 'nyárral', 'nyárban'],
  tél: ['telet', 'telek', 'tele', 'télen', 'téllel', 'télben'],
  víz: ['vizet', 'vizek', 'vize', 'vízen', 'vízzel', 'vízben'],
  kéz: ['kezet', 'kezek', 'keze', 'kezem', 'kézen', 'kézzel', 'kézben'],
  tűz: ['tüzet', 'tüzek', 'tüze', 'tűzön', 'tűzzel', 'tűzben'],
  út: ['utat', 'utak', 'útja', 'úton', 'úttal', 'útban'],
  kút: ['kutat', 'kutak', 'kútja', 'kúton', 'kúttal', 'kútban'],
  híd: ['hidat', 'hidak', 'hídja', 'hídon', 'híddal', 'hídban'],
  ég: ['eget', 'egek', 'ege', 'égen', 'éggel', 'égben'],
  nyúl: ['nyulat', 'nyulak', 'nyula', 'nyúllal', 'nyúlban'],
  név: ['nevet', 'nevek', 'neve', 'nevem', 'nevén', 'névvel', 'névben'],
  tér: ['teret', 'terek', 'tere', 'téren', 'térrel', 'térben'],
  erő: ['erőt', 'erők', 'ereje', 'erejét', 'erővel', 'erőben'],
  idő: ['időt', 'idők', 'ideje', 'idejét', 'idővel', 'időben', 'időm'],
  fiú: ['fiam', 'fia', 'fiúk', 'fiúnak', 'fiúval'],
  lélek: ['lelkek', 'lelket', 'lelke', 'lelkem', 'lélekben', 'lélekkel'],
  ajak: ['ajkak', 'ajkat', 'ajka', 'ajakban', 'ajakkal'],
  bokor: ['bokrot', 'bokrok', 'bokra', 'bokorban', 'bokorral'],
  tükör: ['tükröt', 'tükrök', 'tükre', 'tükröm', 'tükörben', 'tükörrel'],
  torony: ['tornyot', 'tornyok', 'tornya', 'toronyban', 'toronnyal'],
  ökör: ['ökröt', 'ökrök', 'ökre', 'ökörben', 'ökörrel'],
  teher: ['terhet', 'terhek', 'terhe', 'teherben', 'teherrel'],
  szerelem: ['szerelmet', 'szerelmek', 'szerelme', 'szerelemben', 'szerelemmel'],
  sarok: ['sarkot', 'sarkok', 'sarka', 'sarokban', 'sarokkal', 'sarkon'],
  farok: ['farkat', 'farkak', 'farka', 'farokban'],
  torok: ['torkot', 'torkok', 'torka', 'torokban'],
  étterem: ['éttermet', 'éttermek', 'étterme', 'étteremben', 'étteremmel'],
  terem: ['termet', 'termek', 'terme', 'teremben', 'teremmel'],
  derék: ['derekat', 'derekam', 'derékban', 'derékkal'],
  egér: ['egeret', 'egerek', 'egere', 'egérrel', 'egérben'],
  pohár: ['poharat', 'poharak', 'poharam', 'pohárban', 'pohárral'],
  tenyér: ['tenyeret', 'tenyerek', 'tenyere', 'tenyerem', 'tenyérben', 'tenyérrel'],
  gyökér: ['gyökeret', 'gyökerek', 'gyökere', 'gyökérrel', 'gyökérben'],
  kenyér: ['kenyeret', 'kenyerek', 'kenyere', 'kenyérben', 'kenyérrel'],
  levél: ['levelet', 'levelek', 'levele', 'levélben', 'levéllel'],
  tehén: ['tehenet', 'tehenek', 'tehene', 'tehénnel', 'tehénben'],
  madár: ['madarat', 'madarak', 'madara', 'madárral', 'madárban'],
  szülő: ['szüleim', 'szüleid', 'szülei', 'szüleink', 'szülők', 'szülőt', 'szülőnek', 'szüleimnek', 'szüleimmel'],
  szülők: ['szüleim', 'szüleimnek', 'szülőknek'],
  nagyszülő: ['nagyszüleim', 'nagyszüleimet', 'nagyszülők'],
  nagyszülők: ['nagyszüleim', 'nagyszüleimmel'],
  anya: ['anyám', 'anyja', 'anyját', 'anyák', 'anyával', 'anyámnak'],
  apa: ['apám', 'apja', 'apját', 'apák', 'apával', 'apámnak'],
  nagyapa: ['nagyapám', 'nagyapja', 'nagyapát', 'nagyapámnak'],
  nagybácsi: ['nagybátyám', 'nagybátyámmal', 'nagybácsit', 'nagybácsik'],
  nagynéni: ['nagynéném', 'nagynénémmel', 'nagynénit', 'nagynénik'],
};

// One negative expectation per row: the long stem takes no accusative, plural or possessive (vízet, kézek), the
// short stem takes no consonant-initial case (vizben), and an ending of the wrong harmony is still wrong.
const STEM_LACKS: Record<string, string[]> = {
  ló: ['lót', 'lók', 'lovban'],
  tó: ['tót', 'tók', 'tavban'],
  kő: ['kőt', 'kők', 'kövben'],
  fű: ['fűt', 'fűk', 'füvben'],
  hó: ['hót', 'hók', 'havban'],
  szó: ['szavban', 'szavval', 'szavnak'],
  nyár: ['nyárat', 'nyárak', 'nyarban'],
  tél: ['télet', 'télek', 'telben'],
  víz: ['vízet', 'vízek', 'vízem', 'vizben', 'vizzel'],
  kéz: ['kézet', 'kézek', 'kézem', 'kezben', 'kezzel'],
  tűz: ['tűzet', 'tűzek', 'tűzem', 'tüzben'],
  út: ['útat', 'útak', 'útam', 'utban'],
  kút: ['kútat', 'kútak', 'kutban'],
  híd: ['hídat', 'hídak', 'hidban'],
  ég: ['éget', 'égek', 'egben'],
  nyúl: ['nyúlat', 'nyúlak', 'nyulban'],
  név: ['névet', 'névek', 'névem', 'nevben'],
  tér: ['téret', 'térek', 'terben'],
  erő: ['erejben', 'erejnek', 'erejvel'],
  idő: ['idejben', 'idejnek', 'idejvel'],
  fiú: ['fiban', 'finak', 'fival'],
  lélek: ['lelkben', 'lélekek', 'lélekot'],
  ajak: ['ajkban', 'ajakot', 'ajakak'],
  bokor: ['bokort', 'bokroban', 'bokrban'],
  tükör: ['tükörot', 'tükröban', 'tükrben'],
  torony: ['toronyot', 'tornyban', 'toronyak'],
  ökör: ['ökörot', 'ökrben', 'ökrban'],
  teher: ['teheret', 'terhben', 'teherek'],
  szerelem: ['szerelemet', 'szerelmben', 'szerelemek'],
  sarok: ['sarokot', 'sarokak', 'sarkban', 'sarokon'],
  farok: ['farokat', 'farokak', 'farkban'],
  torok: ['torokat', 'torokak', 'torkban'],
  étterem: ['étteremet', 'étteremek', 'éttermben'],
  terem: ['teremet', 'teremek', 'termben'],
  derék: ['derékat', 'derékak', 'derekban'],
  egér: ['egérek', 'egért', 'egerben'],
  pohár: ['pohárat', 'pohárak', 'poharban'],
  tenyér: ['tenyérek', 'tenyért', 'tenyerben'],
  gyökér: ['gyökérek', 'gyökért', 'gyökerben'],
  kenyér: ['kenyérek', 'kenyért', 'kenyerben'],
  levél: ['levélek', 'levélet', 'levelben'],
  tehén: ['tehénet', 'tehének', 'tehenben'],
  madár: ['madárat', 'madárak', 'madarban'],
  szülő: ['szülnek', 'szülben', 'szüleben'],
  szülők: ['szülnek', 'szülben'],
  nagyszülő: ['nagyszülnek', 'nagyszülben'],
  nagyszülők: ['nagyszülnek', 'nagyszülben'],
  anya: ['anyjban', 'anyjnak', 'anyjval'],
  apa: ['apjban', 'apjnak', 'apjval'],
  nagyapa: ['nagyapjban', 'nagyapjnak'],
  nagybácsi: ['nagybátyban', 'nagybátyval'],
  nagynéni: ['nagynénban', 'nagynénval'],
};

describe('huForms, stem-changing nouns', () => {
  it('every row of the table has an expectation, and no expectation is orphaned', () => {
    expect(Object.keys(STEM_CHANGING).sort()).toEqual(huStemChangingWords().sort());
  });

  it('every row of the table has a negative expectation too', () => {
    expect(Object.keys(STEM_LACKS).sort()).toEqual(huStemChangingWords().sort());
  });

  it.each(Object.entries(STEM_CHANGING))('%s', (word, forms) => {
    has([noun(word)], ...forms);
    lacks([noun(word)], ...STEM_LACKS[word]);
  });

  it('does not give the stem change to the wrong cases', () => {
    lacks([noun('ló')], 'lót', 'lók', 'lóm', 'lovval', 'lovban', 'lovnak');
    lacks([noun('tó')], 'tót', 'tavban');
    lacks([noun('tükör')], 'tükörot', 'tükröban', 'tükört');
    lacks([noun('bokor')], 'bokort', 'bokroban');
    lacks([noun('lélek')], 'lelkben', 'lélket');
  });
});
