// The hand-written tables behind lib/huForms.ts (the Hungarian "learned words only" gate): the stem-changing
// nouns, the nouns with a form list instead of a pattern, the irregular verbs with every form, and the closed
// word classes. Data only, no logic.

// Stem-changing nouns (hand table, the words of the corpus). "word>stem,stem": `word` stays the stem for the
// consonant-initial cases (lóval, lónak), each `stem` is the one before a vowel (lovat, lovak, lova, lovon).
// A trailing "+" keeps the ordinary paradigm of `word` as well (szó: szót and szavak). A trailing "~" keeps the
// long `word` only before the consonant-initial endings and the superessive (víz: vízben, vízzel, vízen, but vizet,
// vizek; the accusative and the plural are the short stem's); "~j" adds the j-possessive (út: útja). A stem ending
// in "!" is one that, like the lengthened iroda -> irodá-, takes every ending (nagybátyá-m).
export const STEM_CHANGING_NOUNS = `
ló>lov tó>tav kő>köv fű>füv hó>hav szó>szav+ nyár>nyar~ tél>tel~ víz>viz~ kéz>kez~ tűz>tüz~
út>ut~j kút>kut~j híd>hid~j ég>eg~ nyúl>nyul név>nev~ tér>ter~ erő>erej+ idő>idej+ fiú>fi+
lélek>lelk ajak>ajk bokor>bokr tükör>tükr torony>torny ökör>ökr teher>terh szerelem>szerelm sarok>sark farok>fark torok>tork
étterem>étterm terem>term derék>derek egér>eger~ pohár>pohar~ tenyér>tenyer gyökér>gyöker
kenyér>kenyer levél>level tehén>tehen madár>madar~
szülő>szül+ szülők>szül+ nagyszülő>nagyszül+ nagyszülők>nagyszül+ anya>anyj+ apa>apj+ nagyapa>nagyapj+
nagybácsi>nagybátyá!+ nagynéni>nagynéné!+
`;
// Words whose forms are not a pattern at all (szülő -> szüleim, nagybácsi -> nagybátyám): listed as they are.
export const RAW_NOUN_FORMS: Record<string, string> = {
  spanyol: 'spanyolul',
  angol: 'angolul',
  magyar: 'magyarul',
  német: 'németül',
  francia: 'franciául',
  olasz: 'olaszul',
  hét: 'hétkor',
  éjfél: 'éjfélkor',
  karácsony: 'karácsonykor',
  óra: 'órakor',
  húsvét: 'húsvétkor',
  könnyű: 'könnyebb könnyebben',
  // The irregular comparatives (nagyobb, magasabb are regular and need no row).
  kicsi: 'kisebb kisebbet kisebbek kisebben legkisebb',
  jó: 'jobb jobbat jobbak jobban legjobb',
  szép: 'szebb szebbet szebbek szebben legszebb',
  hosszú: 'hosszabb hosszabbat hosszabbak hosszabban leghosszabb',
  nehéz: 'nehezebb nehezebbet nehezebbek nehezebben legnehezebb',
};
// Irregular verbs, every form listed (the regular endings do not fit them). A family is switched on by any of
// its forms in a learned verb entry; its forms then count as known, with a preverb in front as well.
export const IRREGULAR_VERB_FAMILIES: Record<string, string> = {
  lenni: `
    vagyok vagy van vagyunk vagytok vannak voltam voltál volt voltunk voltatok voltak
    leszek leszel lesz leszünk lesztek lesznek lettem lettél lett lettünk lettetek lettek
    lennék lennél lenne lennénk lennétek lennének lenni lennem lenned lennie lennünk lennetek lenniük légy legyen legyünk legyetek legyenek való lévő volna`,
  menni: `
    megyek mész megy megyünk mentek mennek mentem mentél ment mentünk mentetek
    mennék mennél menne mennénk mennétek mennének menni menj menjen menjünk menjetek menjenek`,
  jönni: `
    jövök jössz jön jövünk jöttök jönnek jöttem jöttél jött jöttünk jöttetek jöttek
    jönnék jönnél jönne jönnénk jönnétek jönnének jönni gyere gyertek jöjj jöjjön jöjjünk jöjjetek jöjjenek jövő`,
  enni: `
    eszem eszel eszik eszünk esztek esznek eszed eszi esszük eszitek ettem ettél evett ettünk ettetek ettek
    etted ette ettük ettétek ették ennék ennél enne ennénk ennétek ennének enném ennéd enné enni
    egyél egyen együnk egyetek egyenek edd egye együk egyétek egyék`,
  inni: `
    iszom iszol iszik iszunk isztok isznak iszod issza isszuk isszátok isszák ittam ittál ivott ittunk ittatok ittak
    ittad itta ittuk ittátok itták innék innál inna innánk innátok innának innám innád inná inni
    igyál igyon igyunk igyatok igyanak idd igya igyuk igyátok igyák`,
  venni: `
    veszek veszel vesz veszünk vesztek vesznek veszem veszed veszi vesszük veszitek veszik
    vettem vettél vett vettünk vettetek vettek vetted vette vettük vettétek vették
    vennék vennél venne vennénk vennétek vennének venném vennéd venné venni
    vegyél vegyen vegyünk vegyetek vegyenek vedd vegye vegyük vegyétek vegyék`,
  tenni: `
    teszek teszel tesz teszünk tesztek tesznek teszem teszed teszi tesszük teszitek teszik
    tettem tettél tett tettünk tettetek tettek tetted tette tettük tettétek tették
    tennék tennél tenne tennénk tennétek tennének tenném tennéd tenné tenni
    tegyél tegyen tegyünk tegyetek tegyenek tedd tegye tegyük tegyétek tegyék`,
  vinni: `
    viszek viszel visz viszünk visztek visznek viszem viszed viszi visszük viszitek viszik
    vittem vittél vitt vittünk vittetek vittek vitted vitte vittük vittétek vitték
    vinnék vinnél vinne vinnénk vinnétek vinnének vinném vinnéd vinné vinni
    vigyél vigyen vigyünk vigyetek vigyenek vidd vigye vigyük vigyétek vigyék`,
  hinni: `
    hiszek hiszel hisz hiszünk hisztek hisznek hiszem hiszed hiszi hisszük hiszitek hiszik
    hittem hittél hitt hittünk hittetek hittek hitted hitte hittük hittétek hitték
    hinnék hinnél hinne hinnénk hinnétek hinnének hinném hinnéd hinné hinni
    higgy higgyél higgyen higgyünk higgyetek higgyenek`,
  aludni: `
    alszom alszol alszik alszunk alusztok alszanak aludtam aludtál aludt aludtunk aludtatok aludtak
    aludnék aludnál aludna aludnánk aludnátok aludnának aludni aludj aludjon aludjunk aludjatok aludjanak`,
  feküdni: `
    fekszem fekszel fekszik fekszünk fekszetek feküsznek feküdtem feküdtél feküdt feküdtünk feküdtetek feküdtek
    feküdnék feküdnél feküdne feküdnénk feküdnétek feküdnének feküdni feküdj feküdjön feküdjünk feküdjetek feküdjenek`,
};
// Closed word classes (2026-11-02): demonstratives, postpositions, preverbs and the quantity words take no new
// members and carry no content of their own, so a sentence is not blocked by them. Listed with all their forms.
// Adverbs (itt, ott, mindig, ...) and the personal-pronoun case forms (nekem, velem, rám) are NOT here: those
// are learned or left out on purpose.
const CLOSED_CLASS_SOURCE = `
  ez ezt ezek ezeket ennek ezeknek ebben ezekben ebből ezekből erre ezekre erről ezekről ennél ezeknél
  ehhez ezekhez ettől ezektől ezzel ezekkel ezért ezen ezeken eddig ebbe ezekbe
  az azt azok azokat annak azoknak abban azokban abból azokból arra azokra arról azokról annál azoknál
  ahhoz azokhoz attól azoktól azzal azokkal azért azon azokon addig abba azokba
  ilyen ilyet ilyenek olyan olyat olyanok ennyi annyi
  miatt mellett előtt után alatt fölött felett között nélkül szerint felé óta helyett mögött iránt által ellen körül közben
  mellé alá elé fölé mögé közé mellől alól elől fölül mögül közül felől számára részére
  közelében közelébe közeléből
  fel le át rá vissza össze haza oda ide
  két sok sokat kevés keveset kevesebb kevesebbet több többet néhány összes minden mindent mindennek mindenben mindenki mindenkit
  mindenkinek mindenkivel mindenkitől mindenkiről mindenkiért
`;
export const HU_CLOSED_CLASS: string[] = CLOSED_CLASS_SOURCE.split(/\s+/).filter(Boolean);
