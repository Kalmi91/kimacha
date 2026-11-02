// The German word forms behind the "learned words only" gate (lib/deForms.ts): one rule per test, on words of the deck.

import {
  deAdjectiveForms,
  deColourCompounds,
  deCompoundNumber,
  deInfinitiveOf,
  deNominalisedForms,
  deNounForms,
  deOrdinalForms,
  deTimeAdverb,
  deVerb,
  deVerbTokens,
  type DeTense,
} from '../deForms';

const forms = (infinitive: string, tense: DeTense): string[] => deVerb(infinitive).forms.filter((f) => f.tense === tense).map((f) => f.form);
const plain = (infinitive: string, level: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' = 'C1'): string[] => deVerbTokens(infinitive, level).plain;

describe('verbs: the present', () => {
  it('regular verbs: -e -st -t -en, with e-insertion after d / t and before m / n after a consonant', () => {
    expect(forms('wohnen', 'praes')).toEqual(expect.arrayContaining(['wohne', 'wohnst', 'wohnt', 'wohnen']));
    expect(forms('arbeiten', 'praes')).toEqual(expect.arrayContaining(['arbeite', 'arbeitest', 'arbeitet']));
    expect(forms('öffnen', 'praes')).toEqual(expect.arrayContaining(['öffnest', 'öffnet']));
    expect(forms('warten', 'praes')).toEqual(expect.arrayContaining(['wartest', 'wartet']));
  });

  it('stems on s ß x z take -t in the du form, -sch does not', () => {
    expect(forms('heißen', 'praes')).toContain('heißt');
    expect(forms('reisen', 'praes')).toContain('reist');
    expect(forms('tanzen', 'praes')).toContain('tanzt');
    expect(forms('duschen', 'praes')).toContain('duschst');
  });

  it('-eln and -ern verbs drop the e of the ich form', () => {
    expect(forms('sammeln', 'praes')).toEqual(expect.arrayContaining(['sammle', 'sammelst', 'sammelt', 'sammeln']));
    expect(forms('wandern', 'praes')).toEqual(expect.arrayContaining(['wandere', 'wandre', 'wanderst']));
  });

  it('stem changes: e>i, e>ie, a>ä, au>äu, with the du / er forms only', () => {
    expect(forms('geben', 'praes')).toEqual(expect.arrayContaining(['gebe', 'gibst', 'gibt', 'geben', 'gebt']));
    expect(forms('sehen', 'praes')).toEqual(expect.arrayContaining(['siehst', 'sieht']));
    expect(forms('lesen', 'praes')).toEqual(expect.arrayContaining(['liest']));
    expect(forms('essen', 'praes')).toEqual(expect.arrayContaining(['isst']));
    expect(forms('nehmen', 'praes')).toEqual(expect.arrayContaining(['nimmst', 'nimmt']));
    expect(forms('fahren', 'praes')).toEqual(expect.arrayContaining(['fährst', 'fährt']));
    expect(forms('schlafen', 'praes')).toEqual(expect.arrayContaining(['schläfst', 'schläft']));
    expect(forms('laufen', 'praes')).toEqual(expect.arrayContaining(['läufst', 'läuft']));
    expect(forms('halten', 'praes')).toEqual(expect.arrayContaining(['hältst', 'hält']));
    expect(forms('sprechen', 'praes')).toEqual(expect.arrayContaining(['sprichst', 'spricht']));
    expect(forms('sehen', 'praes')).not.toContain('sehst');
  });

  it('the irregular verbs: sein, haben, werden, wissen, tun and the modals', () => {
    expect(forms('sein', 'praes')).toEqual(['bin', 'bist', 'ist', 'sind', 'seid', 'sind']);
    expect(forms('haben', 'praes')).toEqual(expect.arrayContaining(['habe', 'hast', 'hat', 'habt']));
    expect(forms('werden', 'praes')).toEqual(expect.arrayContaining(['werde', 'wirst', 'wird']));
    expect(forms('wissen', 'praes')).toEqual(expect.arrayContaining(['weiß', 'weißt', 'wisst']));
    expect(forms('können', 'praes')).toEqual(expect.arrayContaining(['kann', 'kannst', 'könnt']));
    expect(forms('müssen', 'praes')).toEqual(expect.arrayContaining(['muss', 'musst']));
    expect(forms('dürfen', 'praes')).toEqual(expect.arrayContaining(['darf', 'darfst']));
    expect(forms('mögen', 'praes')).toEqual(expect.arrayContaining(['mag', 'möchte', 'möchtest', 'möchten']));
    expect(deVerb('können').modal).toBe(true);
    expect(deVerb('gehen').modal).toBe(false);
  });

  it('the imperative: e>i stems keep the change, a>ä does not', () => {
    expect(forms('geben', 'imp')).toContain('gib');
    expect(forms('nehmen', 'imp')).toContain('nimm');
    expect(forms('fahren', 'imp')).toContain('fahr');
    expect(forms('arbeiten', 'imp')).toContain('arbeite');
    expect(forms('sein', 'imp')).toContain('sei');
  });
});

describe('verbs: participle II', () => {
  it('weak: ge-...-t, with e-insertion; strong: from the table', () => {
    expect(forms('machen', 'part')).toEqual(['gemacht']);
    expect(forms('arbeiten', 'part')).toEqual(['gearbeitet']);
    expect(forms('gehen', 'part')).toEqual(['gegangen']);
    expect(forms('kommen', 'part')).toEqual(['gekommen']);
    expect(forms('trinken', 'part')).toEqual(['getrunken']);
    expect(forms('bringen', 'part')).toEqual(['gebracht']);
    expect(forms('sein', 'part')).toEqual(['gewesen']);
  });

  it('no ge- after be- ver- er- ent- and in -ieren verbs', () => {
    expect(forms('bezahlen', 'part')).toEqual(['bezahlt']);
    expect(forms('besuchen', 'part')).toEqual(['besucht']);
    expect(forms('verkaufen', 'part')).toEqual(['verkauft']);
    expect(forms('erklären', 'part')).toEqual(['erklärt']);
    expect(forms('studieren', 'part')).toEqual(['studiert']);
    expect(forms('telefonieren', 'part')).toEqual(['telefoniert']);
  });

  it('prefixed strong verbs come from their base', () => {
    expect(forms('verstehen', 'part')).toEqual(['verstanden']);
    expect(forms('bekommen', 'part')).toEqual(['bekommen']);
    expect(forms('beginnen', 'part')).toEqual(['begonnen']);
    expect(forms('vergessen', 'part')).toEqual(['vergessen']);
    expect(forms('gefallen', 'part')).toEqual(['gefallen']);
  });

  it('separable verbs put the prefix before the ge-', () => {
    expect(forms('aufstehen', 'part')).toEqual(['aufgestanden']);
    expect(forms('einkaufen', 'part')).toEqual(['eingekauft']);
    expect(forms('anrufen', 'part')).toEqual(['angerufen']);
    expect(forms('ankommen', 'part')).toEqual(['angekommen']);
    expect(forms('ausprobieren', 'part')).toEqual(['ausprobiert']);
    expect(forms('zurückkommen', 'part')).toEqual(['zurückgekommen']);
    // um- / über- / unter- that do not separate
    expect(forms('übersetzen', 'part')).toEqual(['übersetzt']);
    expect(forms('unterschreiben', 'part')).toEqual(['unterschrieben']);
  });
});

describe('verbs: separable', () => {
  it('a finite form stands apart from its prefix, joined in a subordinate clause; the zu-infinitive is one word', () => {
    const verb = deVerb('aufstehen');
    expect(verb.separable).toBe('auf');
    expect(verb.forms).toEqual(expect.arrayContaining([
      { form: 'stehe', tense: 'praes', prefix: 'auf' },
      { form: 'aufstehe', tense: 'praes' },
      { form: 'aufzustehen', tense: 'inf' },
      { form: 'aufstehen', tense: 'inf' },
    ]));
    expect(deVerbTokens('aufstehen', 'A1').split).toEqual(expect.arrayContaining([{ form: 'steht', prefix: 'auf' }]));
    expect(plain('aufstehen', 'A1')).not.toContain('steht');
  });

  it('an inseparable verb has no detached prefix', () => {
    expect(deVerb('verstehen').separable).toBe('');
    expect(deVerbTokens('verstehen', 'A1').split).toEqual([]);
    expect(plain('verstehen', 'A1')).toEqual(expect.arrayContaining(['verstehe', 'versteht', 'verstehst']));
  });

  it('a modal or a strong verb behind a prefix keeps its own forms (vorhaben, wehtun)', () => {
    expect(deVerb('vorhaben').separable).toBe('vor');
    expect(deVerbTokens('vorhaben', 'A1').split).toEqual(expect.arrayContaining([{ form: 'habe', prefix: 'vor' }]));
    expect(deVerb('wehtun').separable).toBe('weh');
  });
});

describe('verbs: tenses by level', () => {
  it('the preterite of sein, haben and the modals is taught at A2, every other verb at B1', () => {
    expect(plain('sein', 'A1')).not.toContain('war');
    expect(plain('sein', 'A2')).toContain('war');
    expect(plain('können', 'A2')).toContain('konnte');
    expect(plain('arbeiten', 'A2')).not.toContain('arbeitete');
    expect(plain('arbeiten', 'B1')).toContain('arbeitete');
    expect(plain('gehen', 'A2')).not.toContain('ging');
    expect(plain('gehen', 'B1')).toContain('ging');
    expect(forms('bringen', 'prat')).toContain('brachte');
  });

  it('subjunctive II: würde / hätte / wäre / könnte at B1, the own forms of other verbs at C1; möchte is a present form', () => {
    expect(plain('mögen', 'A1')).toContain('möchte');
    expect(plain('werden', 'A2')).not.toContain('würde');
    expect(plain('werden', 'B1')).toContain('würde');
    expect(plain('haben', 'B1')).toContain('hätte');
    expect(plain('sein', 'B1')).toContain('wäre');
    expect(plain('können', 'B1')).toContain('könnte');
    expect(plain('gehen', 'B2')).not.toContain('ginge');
    expect(plain('gehen', 'C1')).toContain('ginge');
    expect(plain('kommen', 'C1')).toContain('käme');
  });

  it('subjunctive I (reported speech) at B2', () => {
    expect(plain('sein', 'B1')).not.toContain('seiest');
    expect(plain('sein', 'B2')).toContain('seiest');
    expect(plain('sein', 'A1')).toContain('sei'); // the imperative
    expect(plain('kommen', 'B2')).toEqual(expect.arrayContaining(['komme', 'kommest']));
  });

  it('möchten is the subjunctive forms of mögen only', () => {
    expect(plain('möchten', 'A1')).toEqual(expect.arrayContaining(['möchte', 'möchtest', 'möchten', 'möchtet']));
    expect(plain('möchten', 'A1')).not.toContain('mag');
  });
});

describe('deInfinitiveOf', () => {
  it('reads the verb out of a dictionary alternative', () => {
    expect(deInfinitiveOf('gehen')).toBe('gehen');
    expect(deInfinitiveOf('sich freuen')).toBe('freuen');
    expect(deInfinitiveOf('sein (Identität, Eigenschaft)')).toBe('sein');
    expect(deInfinitiveOf('zu Fuß gehen')).toBe('gehen');
    expect(deInfinitiveOf('Rad fahren')).toBe('fahren');
    expect(deInfinitiveOf('aufstehen')).toBe('aufstehen');
    expect(deInfinitiveOf('möchten')).toBe('möchten');
  });

  it('a noun, a conjugated phrase of the deck and a one-letter word are no infinitive', () => {
    expect(deInfinitiveOf('das Essen')).toBeNull();
    expect(deInfinitiveOf('ich bin gegangen')).toBeNull();
    expect(deInfinitiveOf('sie arbeiten')).toBeNull();
    expect(deInfinitiveOf('es hat ... gegeben (Singular)')).toBeNull();
    expect(deInfinitiveOf('gut')).toBeNull();
  });
});

describe('adjectives', () => {
  it('the endings -e -en -er -es -em; the comparative and superlative only from A2', () => {
    expect(deAdjectiveForms('neu', 'A1')).toEqual(expect.arrayContaining(['neue', 'neuen', 'neuer', 'neues', 'neuem']));
    expect(deAdjectiveForms('klein', 'A1')).not.toContain('kleinste');
    const a2 = deAdjectiveForms('klein', 'A2');
    expect(a2).toEqual(expect.arrayContaining(['kleiner', 'kleinere', 'kleineren', 'kleinste', 'kleinsten', 'kleinstem']));
  });

  it('stems on -e take the consonant only; -el and -er after a vowel drop the e; hoch becomes hoh-', () => {
    expect(deAdjectiveForms('müde', 'A1')).toEqual(expect.arrayContaining(['müden', 'müder', 'müdes', 'müdem']));
    expect(deAdjectiveForms('dunkel', 'A2')).toEqual(expect.arrayContaining(['dunkle', 'dunklen', 'dunkler']));
    expect(deAdjectiveForms('teuer', 'A2')).toEqual(expect.arrayContaining(['teure', 'teuren', 'teurer']));
    expect(deAdjectiveForms('hoch', 'A2')).toEqual(expect.arrayContaining(['hohe', 'hohen', 'höher', 'höchsten']));
  });

  it('umlaut and irregular degrees', () => {
    expect(deAdjectiveForms('alt', 'A2')).toEqual(expect.arrayContaining(['älter', 'älteste', 'ältesten']));
    expect(deAdjectiveForms('groß', 'A2')).toEqual(expect.arrayContaining(['größer', 'größten']));
    expect(deAdjectiveForms('gut', 'A2')).toEqual(expect.arrayContaining(['besser', 'beste', 'besten']));
    expect(deAdjectiveForms('gern', 'A2')).toEqual(expect.arrayContaining(['lieber', 'liebsten']));
    expect(deAdjectiveForms('gut', 'A1')).not.toContain('besser');
  });
});

describe('nouns, numbers, times, colours', () => {
  it('the plural from the data and its dative (+n, but not after -n or -s); the genitive from B1', () => {
    expect(deNounForms('hund', 'm', ['hunde'], 'A1').sort()).toEqual(['hunde', 'hunden']);
    expect(deNounForms('kind', 'n', ['kinder'], 'A1')).toEqual(['kinder', 'kindern']);
    expect(deNounForms('frau', 'f', ['frauen'], 'A1')).toEqual(['frauen']);
    expect(deNounForms('auto', 'n', ['autos'], 'A1')).toEqual(['autos']);
    expect(deNounForms('hund', 'm', ['hunde'], 'B1')).toEqual(expect.arrayContaining(['hundes', 'hunds']));
    expect(deNounForms('frau', 'f', ['frauen'], 'B1')).not.toContain('fraus');
    expect(deNounForms('tisch', 'm', [], 'A1')).toEqual([]);
  });

  it('nominalised adjectives take the adjective endings', () => {
    expect(deNominalisedForms('angestellte')).toEqual(['angestellte', 'angestellten', 'angestellter', 'angestelltes', 'angestelltem']);
  });

  it('ordinals, compound cardinals, adverbs on -s, dark / light colours', () => {
    expect(deOrdinalForms('zwei')).toEqual(expect.arrayContaining(['zweite', 'zweiten']));
    expect(deOrdinalForms('drei')).toContain('dritten');
    expect(deOrdinalForms('zwanzig')).toContain('zwanzigste');
    expect(deOrdinalForms('zehn')).toContain('zehnte');
    expect(deCompoundNumber('einunddreißig')).toEqual(['ein', 'dreißig']);
    expect(deCompoundNumber('dreißig')).toBeNull();
    expect(deTimeAdverb('Sonntag')).toEqual(['sonntags']);
    expect(deTimeAdverb('Hund')).toEqual([]);
    expect(deColourCompounds('blau')).toEqual(expect.arrayContaining(['dunkelblau', 'hellblaue']));
    expect(deColourCompounds('gut')).toEqual([]);
  });
});
