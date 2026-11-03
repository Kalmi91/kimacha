import { DE_DRILL_TENSES, DE_PERSONS, deConjugation, isDrillVerb, personsFor, type DeDrillTense, type DePerson } from '@/lib/deConjugate';
import { deVerb, deVerbTokens } from '@/lib/deForms';
import { drillVerbs } from '@/lib/games/deTenseDrill';

const ans = (inf: string, tense: DeDrillTense, person: DePerson, own = false) => deConjugation(inf, tense, person, { own })?.answer;
const six = (inf: string, tense: DeDrillTense, own = false) => DE_PERSONS.map((p) => ans(inf, tense, p, own));

describe('Präsens', () => {
  it('regular verbs, with the e of arbeitest / öffnest and the t of du reist / tanzt', () => {
    expect(six('wohnen', 'praesens')).toEqual(['ich wohne', 'du wohnst', 'er wohnt', 'wir wohnen', 'ihr wohnt', 'sie wohnen']);
    expect(six('arbeiten', 'praesens')).toEqual(['ich arbeite', 'du arbeitest', 'er arbeitet', 'wir arbeiten', 'ihr arbeitet', 'sie arbeiten']);
    expect(ans('öffnen', 'praesens', 'du')).toBe('du öffnest');
    expect(ans('reisen', 'praesens', 'du')).toBe('du reist');
    expect(ans('tanzen', 'praesens', 'du')).toBe('du tanzt');
    expect(ans('duschen', 'praesens', 'du')).toBe('du duschst');
    expect(ans('heißen', 'praesens', 'er')).toBe('er heißt');
  });

  it('-eln and -ern verbs: ich sammle, ich wandere (and the other spelling is accepted)', () => {
    expect(ans('sammeln', 'praesens', 'ich')).toBe('ich sammle');
    expect(deConjugation('sammeln', 'praesens', 'ich')?.accept).toContain('ich sammele');
    expect(ans('wandern', 'praesens', 'ich')).toBe('ich wandere');
    expect(deConjugation('wandern', 'praesens', 'ich')?.accept).toContain('ich wandre');
  });

  it('stem changes: e>i, e>ie, a>ä, au>äu, with du and er only', () => {
    expect(six('geben', 'praesens')).toEqual(['ich gebe', 'du gibst', 'er gibt', 'wir geben', 'ihr gebt', 'sie geben']);
    expect(ans('sehen', 'praesens', 'du')).toBe('du siehst');
    expect(ans('lesen', 'praesens', 'er')).toBe('er liest');
    expect(ans('essen', 'praesens', 'du')).toBe('du isst');
    expect(ans('nehmen', 'praesens', 'du')).toBe('du nimmst');
    expect(six('fahren', 'praesens')).toEqual(['ich fahre', 'du fährst', 'er fährt', 'wir fahren', 'ihr fahrt', 'sie fahren']);
    expect(ans('schlafen', 'praesens', 'er')).toBe('er schläft');
    expect(ans('laufen', 'praesens', 'du')).toBe('du läufst');
    expect(ans('halten', 'praesens', 'du')).toBe('du hältst');
    expect(ans('halten', 'praesens', 'er')).toBe('er hält');
    expect(ans('treffen', 'praesens', 'er')).toBe('er trifft');
    expect(ans('waschen', 'praesens', 'du')).toBe('du wäschst');
    expect(ans('lassen', 'praesens', 'du')).toBe('du lässt');
  });

  it('sein, haben, werden, wissen and the modals', () => {
    expect(six('sein', 'praesens')).toEqual(['ich bin', 'du bist', 'er ist', 'wir sind', 'ihr seid', 'sie sind']);
    expect(ans('haben', 'praesens', 'du')).toBe('du hast');
    expect(ans('werden', 'praesens', 'er')).toBe('er wird');
    expect(ans('wissen', 'praesens', 'ich')).toBe('ich weiß');
    expect(six('können', 'praesens')).toEqual(['ich kann', 'du kannst', 'er kann', 'wir können', 'ihr könnt', 'sie können']);
    expect(ans('müssen', 'praesens', 'ihr')).toBe('ihr müsst');
  });

  it('a separable verb sets its prefix apart, an inseparable one does not', () => {
    expect(six('aufstehen', 'praesens')).toEqual(['ich stehe auf', 'du stehst auf', 'er steht auf', 'wir stehen auf', 'ihr steht auf', 'sie stehen auf']);
    expect(ans('anrufen', 'praesens', 'er')).toBe('er ruft an');
    expect(ans('mitnehmen', 'praesens', 'du')).toBe('du nimmst mit');
    expect(ans('verstehen', 'praesens', 'ich')).toBe('ich verstehe');
    expect(ans('besuchen', 'praesens', 'du')).toBe('du besuchst');
    expect(ans('empfehlen', 'praesens', 'er')).toBe('er empfiehlt');
  });
});

describe('Präteritum', () => {
  it('weak, strong, mixed and special verbs', () => {
    expect(six('machen', 'praeteritum')).toEqual(['ich machte', 'du machtest', 'er machte', 'wir machten', 'ihr machtet', 'sie machten']);
    expect(six('arbeiten', 'praeteritum')[1]).toBe('du arbeitetest');
    expect(six('gehen', 'praeteritum')).toEqual(['ich ging', 'du gingst', 'er ging', 'wir gingen', 'ihr gingt', 'sie gingen']);
    expect(ans('finden', 'praeteritum', 'du')).toBe('du fandest');
    expect(ans('finden', 'praeteritum', 'ihr')).toBe('ihr fandet');
    expect(six('bringen', 'praeteritum')).toEqual(['ich brachte', 'du brachtest', 'er brachte', 'wir brachten', 'ihr brachtet', 'sie brachten']);
    expect(six('sein', 'praeteritum')).toEqual(['ich war', 'du warst', 'er war', 'wir waren', 'ihr wart', 'sie waren']);
    expect(ans('haben', 'praeteritum', 'du')).toBe('du hattest');
    expect(ans('können', 'praeteritum', 'wir')).toBe('wir konnten');
    expect(ans('wissen', 'praeteritum', 'er')).toBe('er wusste');
  });

  it('du lasest, ihr last; du aßest; ihr hieltet', () => {
    expect(ans('lesen', 'praeteritum', 'du')).toBe('du lasest');
    expect(ans('lesen', 'praeteritum', 'ihr')).toBe('ihr last');
    expect(ans('essen', 'praeteritum', 'du')).toBe('du aßest');
    expect(ans('halten', 'praeteritum', 'ihr')).toBe('ihr hieltet');
  });

  it('separable and inseparable verbs', () => {
    expect(ans('aufstehen', 'praeteritum', 'ich')).toBe('ich stand auf');
    expect(ans('mitbringen', 'praeteritum', 'wir')).toBe('wir brachten mit');
    expect(ans('verstehen', 'praeteritum', 'du')).toBe('du verstandest');
    expect(ans('bekommen', 'praeteritum', 'er')).toBe('er bekam');
  });
});

describe('Perfekt', () => {
  it('haben and sein, the participle with and without ge-', () => {
    expect(six('machen', 'perfekt')).toEqual(['ich habe gemacht', 'du hast gemacht', 'er hat gemacht', 'wir haben gemacht', 'ihr habt gemacht', 'sie haben gemacht']);
    expect(six('gehen', 'perfekt')[2]).toBe('er ist gegangen');
    expect(ans('kommen', 'perfekt', 'wir')).toBe('wir sind gekommen');
    expect(ans('sein', 'perfekt', 'ich')).toBe('ich bin gewesen');
    expect(ans('werden', 'perfekt', 'er')).toBe('er ist geworden');
    expect(ans('studieren', 'perfekt', 'ich')).toBe('ich habe studiert');
    expect(ans('verstehen', 'perfekt', 'du')).toBe('du hast verstanden');
    expect(ans('bekommen', 'perfekt', 'ich')).toBe('ich habe bekommen');
    expect(ans('reisen', 'perfekt', 'ich')).toBe('ich bin gereist');
  });

  it('a separable verb puts the ge- inside the participle', () => {
    expect(ans('aufstehen', 'perfekt', 'ich')).toBe('ich bin aufgestanden');
    expect(ans('anrufen', 'perfekt', 'er')).toBe('er hat angerufen');
    expect(ans('einkaufen', 'perfekt', 'wir')).toBe('wir haben eingekauft');
    expect(ans('ankommen', 'perfekt', 'sie')).toBe('sie sind angekommen');
  });

  it('fahren / fliegen / schwimmen: sein, and haben is accepted too', () => {
    expect(ans('fahren', 'perfekt', 'ich')).toBe('ich bin gefahren');
    expect(deConjugation('fahren', 'perfekt', 'ich')?.accept).toContain('ich habe gefahren');
  });

  it('the pronoun is optional, er also takes sie and es, sie also Sie', () => {
    const er = deConjugation('gehen', 'perfekt', 'er')!;
    expect(er.accept).toEqual(expect.arrayContaining(['ist gegangen', 'sie ist gegangen', 'es ist gegangen']));
    const sie = deConjugation('gehen', 'praesens', 'sie')!;
    expect(sie.answer).toBe('sie gehen');
    expect(sie.accept).toEqual(expect.arrayContaining(['gehen', 'Sie gehen']));
  });

  it('is not asked where the auxiliary or the participle is not certain, or the construction is another one', () => {
    for (const verb of ['können', 'müssen', 'wollen', 'dürfen', 'mögen']) expect(deConjugation(verb, 'perfekt', 'ich')).toBeNull();
    for (const verb of ['ziehen', 'umziehen', 'treten', 'klettern', 'zerbrechen', 'verbrennen']) expect(deConjugation(verb, 'perfekt', 'ich')).toBeNull();
    expect(deConjugation('hängen', 'perfekt', 'ich')).toBeNull();
  });
});

describe('Futur I and Konjunktiv II', () => {
  it('werden + Infinitiv', () => {
    expect(six('gehen', 'futur1')).toEqual(['ich werde gehen', 'du wirst gehen', 'er wird gehen', 'wir werden gehen', 'ihr werdet gehen', 'sie werden gehen']);
    expect(ans('aufstehen', 'futur1', 'ich')).toBe('ich werde aufstehen');
    expect(deConjugation('können', 'futur1', 'ich')).toBeNull();
    expect(deConjugation('werden', 'futur1', 'ich')).toBeNull();
  });

  it('würde + Infinitiv for every verb, the own form for sein, haben and the modals', () => {
    expect(six('gehen', 'konjunktiv2')).toEqual(['ich würde gehen', 'du würdest gehen', 'er würde gehen', 'wir würden gehen', 'ihr würdet gehen', 'sie würden gehen']);
    expect(ans('aufstehen', 'konjunktiv2', 'wir')).toBe('wir würden aufstehen');
    expect(six('sein', 'konjunktiv2')).toEqual(['ich wäre', 'du wärst', 'er wäre', 'wir wären', 'ihr wäret', 'sie wären']);
    expect(ans('haben', 'konjunktiv2', 'du')).toBe('du hättest');
    expect(ans('können', 'konjunktiv2', 'ich')).toBe('ich könnte');
    expect(ans('müssen', 'konjunktiv2', 'er')).toBe('er müsste');
    expect(ans('mögen', 'konjunktiv2', 'ich')).toBe('ich möchte');
    // wollte / sollte are the preterite
    expect(deConjugation('wollen', 'konjunktiv2', 'ich')).toBeNull();
    expect(deConjugation('sollen', 'konjunktiv2', 'ich')).toBeNull();
  });

  it('the own form of an everyday verb (C1), with "würde + Infinitiv" accepted as well', () => {
    expect(ans('gehen', 'konjunktiv2', 'ich', true)).toBe('ich ginge');
        expect(ans('geben', 'konjunktiv2', 'er', true)).toBe('er gäbe');
    expect(ans('finden', 'konjunktiv2', 'ihr', true)).toBe('ihr fändet');
    expect(ans('wissen', 'konjunktiv2', 'ich', true)).toBe('ich wüsste');
    expect(ans('bringen', 'konjunktiv2', 'ich', true)).toBe('ich brächte');
    expect(deConjugation('gehen', 'konjunktiv2', 'ich', { own: true })?.accept).toContain('ich würde gehen');
    expect(ans('kommen', 'konjunktiv2', 'du', true)).toBe('du kämest');
    expect(deConjugation('kommen', 'konjunktiv2', 'du', { own: true })?.accept).toEqual(expect.arrayContaining(['du kämst', 'du würdest kommen']));
    // a verb without a common own form stays "würde + Infinitiv" even then
    expect(ans('arbeiten', 'konjunktiv2', 'ich', true)).toBe('ich würde arbeiten');
  });
});

describe('what the drill refuses', () => {
  it('reflexive verbs, phrases and words that are not verbs', () => {
    for (const bad of ['sich freuen', 'Rad fahren', 'Hund', 'es gibt', 'ich gehe']) expect(isDrillVerb(bad)).toBe(false);
  });

  it('strong verbs the tables lack, and words that only look prefixed', () => {
    for (const bad of ['verzeihen', 'ausweichen', 'schmelzen', 'fernsehen', 'bellen', 'zubereiten', 'vorbereiten', 'gleiten', 'backen', 'hängen', 'schaffen', 'erklimmen']) {
      expect(isDrillVerb(bad)).toBe(false);
    }
  });

  it('weather and happenings only in the third person', () => {
    expect(personsFor('regnen')).toEqual(['er']);
    expect(personsFor('passieren')).toEqual(['er', 'sie']);
    expect(deConjugation('regnen', 'praesens', 'ich')).toBeNull();
    expect(ans('regnen', 'praesens', 'er')).toBe('er regnet');
    expect(personsFor('gehen')).toEqual(DE_PERSONS);
  });

  it('a verb that is weak by default is still asked when the table says nothing against it', () => {
    expect(ans('heiraten', 'praesens', 'er')).toBe('er heiratet');
    expect(ans('trennen', 'praeteritum', 'ich')).toBe('ich trennte');
    expect(ans('begleiten', 'perfekt', 'ich')).toBe('ich habe begleitet');
    expect(ans('analysieren', 'perfekt', 'ich')).toBe('ich habe analysiert');
  });
});

describe('the German deck', () => {
  const verbs = drillVerbs();

  it('most of the verbs of the deck can be drilled, at every level', () => {
    expect(verbs.length).toBeGreaterThan(1000);
    for (const level of ['A1', 'A2', 'B1', 'B2', 'C1']) expect(verbs.filter((v) => v.level === level).length).toBeGreaterThan(30);
  });

  it('every form is a form lib/deForms.ts recognises, for the right tense', () => {
    const wrong: string[] = [];
    for (const { infinitive } of verbs) {
      const tokens = deVerbTokens(infinitive, 'C1');
      const finite = new Set([...tokens.plain, ...tokens.split.map((s) => s.form)]);
      for (const tense of DE_DRILL_TENSES) {
        for (const person of personsFor(infinitive)) {
          for (const own of [false, true]) {
            const c = deConjugation(infinitive, tense, person, { own });
            if (!c) continue;
            const words = c.answer.split(' ').slice(1);
            if (words.some((w) => !w || w.includes('undefined'))) wrong.push(`${infinitive} ${tense} ${person}: ${c.answer}`);
            for (const form of [c.answer, ...c.accept.filter((a) => !(own && /(?:st|t)$/.test(a) && /[äöü]/.test(a) && !a.includes('würd')))]) {
              const parts = form.split(' ');
              const rest = ['ich', 'du', 'er', 'sie', 'es', 'wir', 'ihr', 'Sie'].includes(parts[0]) ? parts.slice(1) : parts;
              const known = [...finite, 'werde', 'wirst', 'wird', 'werden', 'werdet', 'würde', 'würdest', 'würden', 'würdet', 'habe', 'hast', 'hat', 'habt', 'haben', 'bin', 'bist', 'ist', 'sind', 'seid'];
              // the finite word (or the participle / infinitive that goes with the auxiliary) is a known form of the verb
              const lastIsVerbForm = rest.every((w) => known.includes(w) || w === infinitive || deVerb(infinitive).forms.some((f) => f.form === w) || tokens.split.some((s) => s.prefix === w));
              if (!lastIsVerbForm) wrong.push(`${infinitive} ${tense} ${person}: ${form}`);
            }
          }
        }
      }
    }
    expect(wrong.slice(0, 20)).toEqual([]);
  });

  it('no answer holds an em dash, a double space or a lone pronoun', () => {
    for (const { infinitive } of verbs.slice(0, 400)) {
      for (const tense of DE_DRILL_TENSES) {
        const c = deConjugation(infinitive, tense, personsFor(infinitive)[0]);
        if (c) expect(c.answer).toMatch(/^[a-zäöüßA-Z]+( [a-zäöüßA-Z]+)+$|^[a-zäöüß]+ [a-zäöüß]+$/);
      }
    }
  });
});
