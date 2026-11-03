import { HU_CLOSED_CLASS } from '@/lib/huForms';
import { isSentenceKnownIn, knownTokens } from '@/lib/knownSentence';
import { has, lacks, verb } from '@/test-utils/huForms';

describe('huForms, verbs: ordinary stems', () => {
  it('present indefinite and definite (látok, kérek, olvasok, főzök)', () => {
    has([verb('látok')], 'látok', 'látsz', 'lát', 'látunk', 'láttok', 'látnak', 'látom', 'látod', 'látja', 'látjuk', 'látjátok', 'látják');
    has([verb('kérek')], 'kérek', 'kérsz', 'kér', 'kérünk', 'kértek', 'kérnek', 'kérem', 'kéred', 'kéri', 'kérjük', 'kéritek', 'kérik');
    has([verb('olvasok')], 'olvasol', 'olvas', 'olvasunk', 'olvasnak', 'olvasom', 'olvassa', 'olvassuk', 'olvasták');
    has([verb('főzök')], 'főzöl', 'főzünk', 'főznek', 'főzi', 'főzzük', 'főztök');
  });

  it('past indefinite and definite (láttam, kértem, olvastam, főztem, hallgattam)', () => {
    has([verb('látok')], 'láttam', 'láttál', 'látott', 'láttunk', 'láttatok', 'láttak', 'látta', 'láttuk', 'láttátok', 'látták');
    has([verb('kérek')], 'kértem', 'kértél', 'kért', 'kértünk', 'kértetek', 'kérte', 'kértük');
    has([verb('olvasok')], 'olvastam', 'olvasott', 'olvastuk');
    has([verb('főzök')], 'főztem', 'főzött', 'főztük');
    has([verb('hallgatok')], 'hallgattam', 'hallgatott');
  });

  it('conditional (-na/-ne, -ná/-né), infinitive and imperative', () => {
    has([verb('látok')], 'látnék', 'látnál', 'látna', 'látnánk', 'látnátok', 'látnának', 'látnám', 'látná', 'látni');
    has([verb('kérek')], 'kérnék', 'kérnél', 'kérne', 'kérnénk', 'kérné', 'kérni', 'kérj', 'kérjen', 'kérjünk', 'kérd', 'kérlek');
    has([verb('szeret')], 'szeretne', 'szeretnék', 'szeretném', 'szeretni', 'szeretlek');
    has([verb('tanulok')], 'tanuljak', 'tanulj', 'tanuljon', 'tanulni');
  });

  it('the infinitive with a personal ending and -hat/-het', () => {
    has([verb('fizetek')], 'fizetned', 'fizetnem', 'fizetnie', 'fizethet', 'fizethetek');
    has([verb('döntök')], 'döntenünk', 'dönthetsz');
    has([verb('kérek')], 'kérhetek', 'kérhetsz');
    has([verb('kapok')], 'kaphatok', 'kaphatsz');
  });

  it('an -ik verb from its first person (dolgozom, úszom, játszom)', () => {
    has([verb('dolgozom')], 'dolgozik', 'dolgozol', 'dolgozunk', 'dolgoznak', 'dolgoztam', 'dolgozott', 'dolgozni');
    has([verb('úszom')], 'úszik', 'úszol', 'úsznak', 'úsztam');
    has([verb('játszom')], 'játszanak', 'játszik');
  });

  it('a verb entry may be a person form, a bare stem or a list', () => {
    has([verb('én látok')], 'látnak', 'láttam');
    has([verb('olvas')], 'olvasok', 'olvasott');
    has([verb('tesz / rak')], 'rakok', 'rakott', 'rakni');
  });

  it('derives the verbal noun and the participle (tanítás, pihenés, dolgozó)', () => {
    has([verb('tanítok')], 'tanítás', 'tanítást', 'tanításhoz', 'tanító');
    has([verb('pihenek')], 'pihenés', 'pihenést');
    has([verb('dolgozom')], 'dolgozó', 'dolgozók');
  });

  it('érez: érzek, érzem', () => {
    has([verb('érzek')], 'érzek', 'érzem');
    has([verb('érez / sajnál')], 'érzek', 'érzem', 'sajnálom');
  });

  it('rejects the wrong harmony and a form of another stem', () => {
    lacks([verb('látok')], 'látek', 'látnek', 'láttek', 'látünk', 'látetek');
    lacks([verb('kérek')], 'kérok', 'kérnak', 'kértam');
    lacks([verb('látok')], 'kérek', 'olvasok');
  });
});

describe('huForms, verbs: the -ott- past', () => {
  it('the whole paradigm for a stem ending in t (tartottam, futottam, tanítottam)', () => {
    has([verb('tartok')], 'tartottam', 'tartottál', 'tartott', 'tartottunk', 'tartottatok', 'tartottak', 'tartotta', 'tartottuk', 'tartották');
    has([verb('futok')], 'futottam', 'futottak', 'futott');
    has([verb('tanítok')], 'tanítottam', 'tanítottál', 'tanítottak', 'tanította');
    has([verb('értek')], 'értettem', 'értettek', 'értette', 'értették');
    has([verb('sütök')], 'sütöttem', 'sütöttek', 'sütötte');
  });

  it('a short hand list of other stems has it too (hallottam, játszottak, megoldották)', () => {
    has([verb('hallok')], 'hallottam', 'hallottál', 'hallottunk', 'hallott', 'hallották', 'meghallottam');
    has([verb('játszom')], 'játszottam', 'játszottak', 'játszott');
    has([verb('megoldom')], 'megoldottam', 'megoldották', 'megoldott');
  });

  it('any other stem has only the 3rd person -ott/-ett/-ött (olvasott, but olvastam)', () => {
    has([verb('olvasok')], 'olvasott', 'olvastam', 'olvastak', 'olvasta');
    has([verb('dolgozom')], 'dolgozott', 'dolgoztam', 'dolgoztak');
    has([verb('tanulok')], 'tanult', 'tanultam', 'tanultunk');
    has([verb('főzök')], 'főzött', 'főztem');
    lacks([verb('olvasok')], 'olvasottam', 'olvasottál', 'olvasottunk', 'olvasottatok', 'olvasottak', 'olvasotta', 'olvasottuk');
    lacks([verb('dolgozom')], 'dolgozottam', 'dolgozottunk', 'dolgozottak');
    lacks([verb('tanulok')], 'tanulottam', 'tanulottál', 'tanulottak');
    lacks([verb('főzök')], 'főzöttem', 'főzöttek', 'főzötte');
    lacks([verb('kérek')], 'kérettem', 'kérettek');
  });

  it('the -hat/-het of can / may doubles its t (kaphattam), it has no -ott- paradigm', () => {
    has([verb('kapok')], 'kaphattam', 'kaphatott', 'kaphattak');
    has([verb('kérek')], 'kérhettem', 'kérhetett', 'kérhettek');
    lacks([verb('kapok')], 'kaphatottam', 'kaphatottak');
    lacks([verb('kérek')], 'kérhetettem', 'kérhetettek');
  });
});

describe('huForms, verbs: preverbs and irregular verbs', () => {
  it('a preverb in front of a learned verb (megérkezik, elmegyek, megláttam)', () => {
    has([verb('érkezem')], 'megérkezik', 'megérkeztem');
    has([verb('látok')], 'megláttam', 'meglátja', 'felláttam');
    has([verb('megyek')], 'elmegyek', 'bemegy', 'kimentem', 'visszamegy', 'hazamennek');
  });

  it('lenni: volt, voltam, lesz, lenne, lennie', () => {
    has([verb('én vagyok')], 'volt', 'voltam', 'voltunk', 'voltak', 'lesz', 'leszek', 'lenne', 'lennék', 'lenni', 'lennie', 'legyen', 'van', 'vannak');
  });

  it('menni, jönni, enni, inni', () => {
    has([verb('megyek')], 'mész', 'megy', 'megyünk', 'mennek', 'mentem', 'ment', 'mentünk', 'mennék', 'menne', 'menni', 'menjen');
    has([verb('jövök')], 'jössz', 'jön', 'jönnek', 'jöttem', 'jött', 'jönne', 'jönni', 'gyere');
    has([verb('eszem')], 'ettem', 'evett', 'ettünk', 'ettek', 'enne', 'enni', 'eszik', 'eszünk', 'esznek', 'eszi', 'esszük');
    has([verb('iszom')], 'ittam', 'ivott', 'ittunk', 'inna', 'inni', 'iszik', 'isznak', 'issza', 'isszuk');
  });

  it('venni, tenni, vinni, hinni, aludni, feküdni', () => {
    has([verb('veszek')], 'vettem', 'vett', 'vennék', 'venni', 'vesz', 'veszünk', 'vegye');
    has([verb('teszem')], 'tettem', 'tett', 'tenne', 'tenni', 'teszek', 'tesznek');
    has([verb('viszek')], 'vittem', 'vitt', 'vinne', 'vinni', 'visz');
    has([verb('hiszek')], 'hittem', 'hitt', 'hinne', 'hinni', 'hisz');
    has([verb('alszom')], 'aludtam', 'aludt', 'aludna', 'aludni', 'alszik', 'alszanak');
    has([verb('fekszem')], 'feküdtem', 'feküdt', 'feküdni', 'fekszik');
  });

  it('does not give an irregular verb to a learner who has not learned it', () => {
    lacks([verb('látok')], 'volt', 'mentem', 'ettem', 'lesz');
  });
});

describe('huForms, closed word classes', () => {
  it('lists the forms the brief names', () => {
    for (const word of ['ez', 'ezt', 'ennek', 'ebben', 'ezzel', 'az', 'azt', 'annak', 'abban', 'azzal']) expect(HU_CLOSED_CLASS).toContain(word);
    for (const word of ['miatt', 'mellett', 'előtt', 'után', 'alatt', 'fölött', 'között', 'nélkül', 'szerint', 'felé', 'óta', 'helyett', 'közelében', 'mögött']) {
      expect(HU_CLOSED_CLASS).toContain(word);
    }
    for (const word of ['fel', 'le', 'át', 'rá', 'vissza', 'össze', 'haza', 'oda', 'ide']) expect(HU_CLOSED_CLASS).toContain(word);
    for (const word of ['két', 'sok', 'sokat', 'kevés', 'minden']) expect(HU_CLOSED_CLASS).toContain(word);
  });

  it('keeps adverbs and content words out', () => {
    for (const word of ['mindig', 'itt', 'ott', 'nagyon', 'ház', 'kettő']) expect(HU_CLOSED_CLASS).not.toContain(word);
  });

  it('a closed-class form needs no learned card', () => {
    const known = knownTokens('hu', { learned: [] });
    expect(isSentenceKnownIn('Ez a ház miatt.', 'hu', known)).toBe(false);
    expect(isSentenceKnownIn('Ezzel az előtt után.', 'hu', known)).toBe(true);
  });
});

describe('huForms, the corpus', () => {
  it('lets most of the Hungarian example sentences through once every card is learned', () => {
    const cards: { hu: string; pos?: string; sentence_hu?: string }[] = [];
    for (const level of ['a0', 'a1', 'a2', 'b1', 'b2', 'c1']) {
      cards.push(...require(`@/data/words/hu/${level}.json`));
    }
    const known = knownTokens('hu', { learned: cards.map((c) => ({ text: c.hu, pos: c.pos })) });
    const sentences = cards.map((c) => c.sentence_hu).filter((s): s is string => !!s);
    const passing = sentences.filter((s) => isSentenceKnownIn(s, 'hu', known)).length;
    // Without the inflection rules 1513 of 4963 pass; the rest fail mostly on words without a card (fivér, film).
    expect(passing).toBeGreaterThan(3800);
  });
});
