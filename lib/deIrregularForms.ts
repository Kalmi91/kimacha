// The hand-checked German tables behind `lib/deForms.ts` (the recognition of word forms for the "learned
// words only" gate): strong and mixed verbs, the verbs with a fully irregular present, the verb prefixes, the
// adjectives with umlaut or an irregular degree. Pure data, no imports. It is for RECOGNITION: a verb that is
// missing here is read as a weak verb, which gives a form that does not exist rather than a wrong sentence.

// infinitive, changed stem of du / er ("-" = none), preterite (3rd person; "a/b" = two forms), participle,
// auxiliary of the perfect (h = haben, s = sein, hs = both). A preterite on -te takes the weak endings (mixed verbs).
const STRONG_TABLE = `
backen bäck backte/buk gebacken h
befehlen befiehl befahl befohlen h
beginnen - begann begonnen h
beißen - biss gebissen h
betrügen - betrog betrogen h
biegen - bog gebogen hs
bieten - bot geboten h
binden - band gebunden h
bitten - bat gebeten h
blasen bläs blies geblasen h
bleiben - blieb geblieben s
braten brät briet gebraten h
brechen brich brach gebrochen hs
brennen - brannte gebrannt h
bringen - brachte gebracht h
denken - dachte gedacht h
dringen - drang gedrungen s
empfehlen empfiehl empfahl empfohlen h
erschrecken erschrick erschrak erschrocken s
essen iss aß gegessen h
fahren fähr fuhr gefahren hs
fallen fäll fiel gefallen s
fangen fäng fing gefangen h
finden - fand gefunden h
fliegen - flog geflogen hs
fliehen - floh geflohen s
fließen - floss geflossen s
fressen friss fraß gefressen h
frieren - fror gefroren h
geben gib gab gegeben h
gehen - ging gegangen s
gelingen - gelang gelungen s
gelten gilt galt gegolten h
genießen - genoss genossen h
geschehen geschieh geschah geschehen s
gewinnen - gewann gewonnen h
gießen - goss gegossen h
gleichen - glich geglichen h
graben gräb grub gegraben h
greifen - griff gegriffen h
halten hält hielt gehalten h
hängen - hing/hängte gehangen/gehängt h
heben - hob gehoben h
heißen - hieß geheißen h
helfen hilf half geholfen h
kennen - kannte gekannt h
klingen - klang geklungen h
kommen - kam gekommen s
kriechen - kroch gekrochen s
laden läd lud geladen h
lassen läss ließ gelassen h
laufen läuf lief gelaufen s
leiden - litt gelitten h
leihen - lieh geliehen h
lesen lies las gelesen h
liegen - lag gelegen h
lügen - log gelogen h
meiden - mied gemieden h
messen miss maß gemessen h
nehmen nimm nahm genommen h
nennen - nannte genannt h
pfeifen - pfiff gepfiffen h
raten rät riet geraten h
reiben - rieb gerieben h
reißen - riss gerissen hs
reiten - ritt geritten hs
rennen - rannte gerannt s
riechen - roch gerochen h
rufen - rief gerufen h
saufen säuf soff gesoffen h
schaffen - schuf/schaffte geschaffen/geschafft h
scheiden - schied geschieden hs
scheinen - schien geschienen h
schieben - schob geschoben h
schießen - schoss geschossen h
schlafen schläf schlief geschlafen h
schlagen schläg schlug geschlagen h
schleichen - schlich geschlichen s
schließen - schloss geschlossen h
schmeißen - schmiss geschmissen h
schneiden - schnitt geschnitten h
schreiben - schrieb geschrieben h
schreien - schrie geschrien h
schreiten - schritt geschritten s
schweigen - schwieg geschwiegen h
schwimmen - schwamm geschwommen hs
schwören - schwor geschworen h
sehen sieh sah gesehen h
senden - sandte/sendete gesandt/gesendet h
singen - sang gesungen h
sinken - sank gesunken s
sitzen - saß gesessen h
sprechen sprich sprach gesprochen h
springen - sprang gesprungen s
stechen stich stach gestochen h
stehen - stand gestanden h
stehlen stiehl stahl gestohlen h
steigen - stieg gestiegen s
sterben stirb starb gestorben s
stoßen stöß stieß gestoßen h
streichen - strich gestrichen h
streiten - stritt gestritten h
tragen träg trug getragen h
treffen triff traf getroffen h
treiben - trieb getrieben hs
treten tritt trat getreten hs
trinken - trank getrunken h
verderben verdirb verdarb verdorben h
vergessen vergiss vergaß vergessen h
verlieren - verlor verloren h
verschwinden - verschwand verschwunden s
wachsen wächs wuchs gewachsen s
waschen wäsch wusch gewaschen h
weisen - wies gewiesen h
wenden - wandte/wendete gewandt/gewendet h
werben wirb warb geworben h
werfen wirf warf geworfen h
wiegen - wog gewogen h
ziehen - zog gezogen hs
zwingen - zwang gezwungen h
`;

export interface StrongVerb {
  /** du / er stem when it changes (gib, fähr), '' = no change. */
  stem2: string;
  /** Preterite stems (3rd person singular). */
  prat: string[];
  /** Participles, with the ge- prefix as in the plain verb. */
  part: string[];
  /** Auxiliary of the perfect: 'haben' | 'sein' | 'both'. */
  aux: 'haben' | 'sein' | 'both';
}

export const STRONG_VERBS: ReadonlyMap<string, StrongVerb> = new Map(
  STRONG_TABLE.trim()
    .split('\n')
    .map((line) => {
      const [inf, stem2, prat, part, aux] = line.trim().split(/\s+/);
      const entry: StrongVerb = {
        stem2: stem2 === '-' ? '' : stem2,
        prat: prat.split('/'),
        part: part.split('/'),
        aux: aux === 'h' ? 'haben' : aux === 's' ? 'sein' : 'both',
      };
      return [inf, entry] as const;
    }),
);

/** A verb with a fully written-out paradigm. Order of the six lists: ich du er/sie/es wir ihr sie/Sie. */
export interface SpecialVerb {
  praes: string[];
  imp: string[];
  prat: string[];
  k2: string[];
  k1: string[];
  part: string[];
  aux: 'haben' | 'sein';
}

const six = (text: string): string[] => text.split(' ');

export const SPECIAL_VERBS: ReadonlyMap<string, SpecialVerb> = new Map<string, SpecialVerb>([
  ['sein', { praes: six('bin bist ist sind seid sind'), imp: ['sei', 'seid', 'seien'], prat: six('war warst war waren wart waren'), k2: six('wäre wärst wäre wären wäret wären'), k1: six('sei seiest sei seien seiet seien'), part: ['gewesen'], aux: 'sein' }],
  ['haben', { praes: six('habe hast hat haben habt haben'), imp: ['hab', 'habe', 'habt', 'haben'], prat: six('hatte hattest hatte hatten hattet hatten'), k2: six('hätte hättest hätte hätten hättet hätten'), k1: six('habe habest habe haben habet haben'), part: ['gehabt'], aux: 'haben' }],
  ['werden', { praes: six('werde wirst wird werden werdet werden'), imp: ['werde', 'werdet', 'werden'], prat: six('wurde wurdest wurde wurden wurdet wurden').concat(['ward']), k2: six('würde würdest würde würden würdet würden'), k1: six('werde werdest werde werden werdet werden'), part: ['geworden', 'worden'], aux: 'sein' }],
  ['tun', { praes: six('tue tust tut tun tut tun'), imp: ['tu', 'tue', 'tut', 'tun'], prat: six('tat tatest tat taten tatet taten').concat(['tatst']), k2: six('täte tätest täte täten tätet täten'), k1: six('tue tuest tue tuen tuet tuen'), part: ['getan'], aux: 'haben' }],
  ['wissen', { praes: six('weiß weißt weiß wissen wisst wissen'), imp: ['wisse', 'wisst', 'wissen'], prat: six('wusste wusstest wusste wussten wusstet wussten'), k2: six('wüsste wüsstest wüsste wüssten wüsstet wüssten'), k1: six('wisse wissest wisse wissen wisset wissen'), part: ['gewusst'], aux: 'haben' }],
  ['können', { praes: six('kann kannst kann können könnt können'), imp: [], prat: six('konnte konntest konnte konnten konntet konnten'), k2: six('könnte könntest könnte könnten könntet könnten'), k1: six('könne könnest könne können könnet können'), part: ['gekonnt', 'können'], aux: 'haben' }],
  ['müssen', { praes: six('muss musst muss müssen müsst müssen'), imp: [], prat: six('musste musstest musste mussten musstet mussten'), k2: six('müsste müsstest müsste müssten müsstet müssten'), k1: six('müsse müssest müsse müssen müsset müssen'), part: ['gemusst', 'müssen'], aux: 'haben' }],
  ['wollen', { praes: six('will willst will wollen wollt wollen'), imp: [], prat: six('wollte wolltest wollte wollten wolltet wollten'), k2: six('wollte wolltest wollte wollten wolltet wollten'), k1: six('wolle wollest wolle wollen wollet wollen'), part: ['gewollt', 'wollen'], aux: 'haben' }],
  ['sollen', { praes: six('soll sollst soll sollen sollt sollen'), imp: [], prat: six('sollte solltest sollte sollten solltet sollten'), k2: six('sollte solltest sollte sollten solltet sollten'), k1: six('solle sollest solle sollen sollet sollen'), part: ['gesollt', 'sollen'], aux: 'haben' }],
  ['dürfen', { praes: six('darf darfst darf dürfen dürft dürfen'), imp: [], prat: six('durfte durftest durfte durften durftet durften'), k2: six('dürfte dürftest dürfte dürften dürftet dürften'), k1: six('dürfe dürfest dürfe dürfen dürfet dürfen'), part: ['gedurft', 'dürfen'], aux: 'haben' }],
  ['mögen', { praes: six('mag magst mag mögen mögt mögen'), imp: [], prat: six('mochte mochtest mochte mochten mochtet mochten'), k2: six('möchte möchtest möchte möchten möchtet möchten'), k1: six('möge mögest möge mögen möget mögen'), part: ['gemocht', 'mögen'], aux: 'haben' }],
]);

/** The modal verbs: their preterite is taught with sein and haben (A2), their subjunctive II with würde (B1). */
export const MODAL_VERBS: ReadonlySet<string> = new Set(['können', 'müssen', 'wollen', 'sollen', 'dürfen', 'mögen', 'möchten']);

// Verb prefixes. A separable prefix goes to the end of the main clause ("Ich stehe um sieben Uhr auf").
export const SEPARABLE_PREFIXES: readonly string[] = [
  'zusammen', 'zurecht', 'zurück', 'vorbei', 'hinzu', 'dazu', 'fern', 'spazieren', 'kennen', 'heraus', 'herein', 'herauf', 'herunter', 'hinaus', 'hinein',
  'hinauf', 'hinunter', 'voraus', 'weiter', 'wieder', 'empor', 'heran', 'herum', 'hervor', 'nieder', 'durch', 'heim',
  'fest', 'fort', 'frei', 'hoch', 'statt', 'teil', 'über', 'unter', 'bei', 'dar', 'ein', 'her', 'hin', 'los', 'mit', 'nach',
  'vor', 'weg', 'weh', 'auf', 'aus', 'ab', 'an', 'um', 'zu', 'leid', 'raus', 'rein', 'rauf', 'runter',
].sort((a, b) => b.length - a.length);

export const INSEPARABLE_PREFIXES: readonly string[] = ['miss', 'emp', 'ent', 'ver', 'zer', 'be', 'ge', 'er'];

// Verbs on a prefix that can be separable, but are not (stress on the verb): they take no ge- and do not split.
export const INSEPARABLE_VERBS: ReadonlySet<string> = new Set([
  'überlegen', 'übersetzen', 'übernachten', 'überraschen', 'übertreiben', 'überweisen', 'überzeugen', 'überprüfen',
  'überqueren', 'überwinden', 'übernehmen', 'übergeben', 'überleben', 'übertragen', 'überfallen', 'überholen',
  'unterschreiben', 'unterhalten', 'unterrichten', 'unterstützen', 'unterscheiden', 'untersuchen', 'unternehmen',
  'unterbrechen', 'unterbringen', 'wiederholen', 'umarmen', 'umgeben', 'umfassen', 'umringen', 'durchsuchen',
  'durchschauen', 'durchqueren', 'durchdenken', 'übertreffen', 'übersehen', 'übersteigen', 'überfahren',
]);

// Prefixed verbs whose perfect takes sein although the base verb takes haben (aufstehen, einschlafen) or the prefix is inseparable.
export const SEIN_PERFECT_VERBS: ReadonlySet<string> = new Set([
  'aufstehen', 'einschlafen', 'aufwachen', 'passieren', 'entstehen', 'erwachen', 'ertrinken', 'verreisen', 'begegnen', 'entkommen',
  'misslingen', 'verunglücken', 'aufbleiben', 'wegbleiben', 'hinfallen', 'umfallen', 'ausrutschen', 'abreisen', 'anreisen', 'erscheinen',
  'vergehen', 'entgehen', 'ergehen', 'zerfallen', 'verfallen', 'aufsteigen', 'absteigen', 'einsteigen', 'aussteigen', 'umsteigen',
  'einreisen', 'ausreisen', 'abstürzen', 'ertrinken', 'verschwinden', 'wegfliegen', 'wegrennen', 'losgehen', 'weitergehen',
]);

// Verbs whose first letters look like a prefix but are none (they are checked before the prefix split).
export const NOT_PREFIXED: ReadonlySet<string> = new Set(['antworten', 'hinken', 'losen', 'anmuten', 'umsatteln']);

// Adjectives with an umlaut in the comparative and the superlative.
export const UMLAUT_ADJECTIVES: ReadonlySet<string> = new Set([
  'alt', 'jung', 'lang', 'kurz', 'arm', 'kalt', 'warm', 'stark', 'schwach', 'scharf', 'dumm', 'klug', 'krank', 'gesund',
  'hart', 'nass', 'schwarz', 'rot', 'grob', 'glatt', 'fromm', 'kräftig', 'blass', 'nah', 'oft', 'groß', 'hoch',
]);

// Comparative, superlative stem (the -e / -en endings and "am ...sten" are added by the module).
export const IRREGULAR_DEGREES: ReadonlyMap<string, readonly [string, string]> = new Map([
  ['gut', ['besser', 'best']],
  ['viel', ['mehr', 'meist']],
  ['gern', ['lieber', 'liebst']],
  ['gerne', ['lieber', 'liebst']],
  ['hoch', ['höher', 'höchst']],
  ['nah', ['näher', 'nächst']],
  ['wenig', ['weniger', 'wenigst']],
  ['bald', ['eher', 'ehest']],
  ['groß', ['größer', 'größt']],
]);

// Verbs of the first levels whose perfect a learner meets at A1 (everyday actions); at A2 every verb takes the perfect.
export const A1_PERFECT_VERBS: ReadonlySet<string> = new Set([
  'haben', 'sein', 'gehen', 'kommen', 'machen', 'essen', 'trinken', 'sehen', 'fahren', 'spielen', 'arbeiten', 'lernen',
  'kaufen', 'schlafen', 'lesen', 'schreiben', 'sprechen', 'nehmen', 'geben', 'finden', 'bleiben', 'wohnen', 'treffen',
  'hören', 'sagen', 'kochen', 'bestellen', 'bezahlen', 'besuchen', 'tanzen', 'singen', 'reisen', 'fliegen', 'laufen',
  'schwimmen', 'helfen', 'bringen', 'aufstehen', 'ankommen', 'anrufen', 'einkaufen', 'abfahren', 'mitkommen', 'mitnehmen',
  'aussteigen', 'einsteigen', 'umsteigen', 'fernsehen', 'aufräumen', 'frühstücken', 'duschen', 'putzen', 'tun', 'werden',
  'heißen', 'kennenlernen', 'warten', 'fragen', 'antworten', 'zahlen', 'lieben', 'brauchen', 'suchen', 'öffnen', 'schließen',
  'anfangen', 'beginnen', 'enden', 'dauern', 'regnen', 'schneien', 'fotografieren', 'telefonieren', 'studieren', 'verstehen',
  'vergessen', 'verlieren', 'bekommen', 'gewinnen', 'lachen', 'weinen', 'sitzen', 'stehen', 'liegen', 'wissen', 'denken',
]);
