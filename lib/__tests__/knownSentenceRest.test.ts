import { isSentenceKnown, knownTokens, unknownTokens, type LearnedEntry, type ResolvedTense } from '../knownSentence';
import { resetFormIndex } from '../grammar/tenseGate';

beforeEach(() => resetFormIndex());

const PRESENTE: ReadonlySet<ResolvedTense> = new Set<ResolvedTense>(['presente']);
const ALL: ReadonlySet<ResolvedTense> = new Set<ResolvedTense>([
  'presente', 'indefinido', 'imperfecto', 'futuro', 'condicional', 'subjuntivo_presente', 'subjuntivo_imperfecto',
]);

function es(...learned: Array<string | LearnedEntry>) {
  return knownTokens('es', { learned, tenses: ALL });
}
function en(...learned: Array<string | LearnedEntry>) {
  return knownTokens('en', { learned });
}
const verb = (text: string): LearnedEntry => ({ text, pos: 'verb' });
const adj = (text: string): LearnedEntry => ({ text, pos: 'adj' });
const noun = (text: string): LearnedEntry => ({ text, pos: 'noun' });
const phrase = (text: string): LearnedEntry => ({ text, pos: 'phrase' });

describe('knownSentence, Spanish gerundio', () => {
  it('a learned verb gives its gerundio, regular and irregular', () => {
    expect(es(verb('hablar')).has('hablando')).toBe(true);
    expect(es(verb('comer')).has('comiendo')).toBe(true);
    expect(es(verb('leer')).has('leyendo')).toBe(true);
    expect(es(verb('oír')).has('oyendo')).toBe(true);
    expect(es(verb('caer')).has('cayendo')).toBe(true);
    expect(es(verb('ir')).has('yendo')).toBe(true);
    expect(es(verb('dormir')).has('durmiendo')).toBe(true);
    expect(es(verb('pedir')).has('pidiendo')).toBe(true);
    expect(es(verb('decir')).has('diciendo')).toBe(true);
    expect(es(verb('venir')).has('viniendo')).toBe(true);
    expect(es(verb('sentir')).has('sintiendo')).toBe(true);
    expect(es(verb('poder')).has('pudiendo')).toBe(true);
  });

  it('a reflexive verb gives the gerundio of its base verb', () => {
    expect(es(verb('acostarse')).has('acostando')).toBe(true);
  });

  it('stands in no tense: it is known even when no tense is unlocked', () => {
    const known = knownTokens('es', { learned: [verb('trabajar')] });
    expect(known.has('trabajando')).toBe(true);
    expect(known.has('trabajo')).toBe(false);
  });

  it('a sentence with estar + gerundio passes when both verbs are learned', () => {
    const ctx = { learned: [verb('estar'), verb('trabajar')], tenses: PRESENTE };
    expect(isSentenceKnown('Estoy trabajando.', 'es', ctx)).toBe(true);
    expect(isSentenceKnown('Sigo trabajando.', 'es', ctx)).toBe(false); // seguir is not learned
  });

  it('false positives: the wrong stem, and a verb that is not learned', () => {
    expect(es(verb('dormir')).has('dormiendo')).toBe(false);
    expect(es(verb('pedir')).has('pediendo')).toBe(false);
    expect(es(verb('leer')).has('leiendo')).toBe(false);
    expect(es(verb('hablar')).has('comiendo')).toBe(false);
    expect(es(noun('el libro')).has('librando')).toBe(false);
  });
});

describe('knownSentence, Spanish -ísimo, demasiado, bastante', () => {
  it('a learned adjective gives its absolute superlative in four forms', () => {
    const known = es(adj('alto'));
    for (const f of ['altísimo', 'altísima', 'altísimos', 'altísimas']) expect(known.has(f)).toBe(true);
    expect(es(adj('rico')).has('riquísimo')).toBe(true);
    expect(es(adj('fácil')).has('facilísimo')).toBe(true);
  });

  it('muchísimo, demasiado and bastante are free words', () => {
    const known = es();
    const words = [
      'muchísimo', 'muchísima', 'muchísimos', 'muchísimas',
      'demasiado', 'demasiada', 'demasiados', 'demasiadas', 'bastante', 'bastantes',
    ];
    for (const f of words) expect(known.has(f)).toBe(true);
  });

  it('false positives: an adjective that is not learned, and a noun, give no superlative', () => {
    expect(es(adj('alto')).has('bajísimo')).toBe(false);
    expect(es(noun('el libro')).has('librísimo')).toBe(false);
    expect(es(adj('limpio')).has('limpísimo')).toBe(false);
  });
});

describe('knownSentence, Spanish feminine of the occupation nouns', () => {
  it('the listed masculine noun gives the feminine and both plurals', () => {
    const known = es(noun('el secretario'));
    for (const f of ['secretario', 'secretarios', 'secretaria', 'secretarias']) expect(known.has(f)).toBe(true);
    expect(es(noun('el abogado')).has('abogada')).toBe(true);
    expect(es(noun('el científico')).has('científica')).toBe(true);
    expect(es(noun('el escritor')).has('escritora')).toBe(true);
  });

  it('a sentence with the feminine passes only when the masculine is learned', () => {
    expect(isSentenceKnown('La abogada.', 'es', { learned: [noun('el abogado')], tenses: PRESENTE })).toBe(true);
    expect(isSentenceKnown('La abogada.', 'es', { learned: [noun('el libro')], tenses: PRESENTE })).toBe(false);
  });

  it('false positives: a noun that is not on the list has no feminine', () => {
    expect(es(noun('el libro')).has('libra')).toBe(false);
    expect(es(noun('el gato')).has('gata')).toBe(false);
    expect(es(adj('alto')).has('secretaria')).toBe(false);
  });
});

describe('knownSentence, Spanish imperative stays blocked', () => {
  it('a reflexive imperative is not recognised from the learned verb', () => {
    const ctx = { learned: [verb('apurarse'), verb('limpiarse'), verb('subir')], tenses: ALL };
    for (const word of ['apúrate', 'límpiate', 'súbete']) {
      expect(unknownTokens(`${word} ya.`, 'es', ctx)).toContain(word);
    }
  });
});

describe('knownSentence, English articles and noun phrases', () => {
  it('the article of the card does not stop the plural', () => {
    expect(en('an apple').has('apples')).toBe(true);
    expect(en('a machine').has('machines')).toBe(true);
    expect(en('an arm').has('arms')).toBe(true);
    expect(en('the family').has('families')).toBe(true);
    expect(en('a man').has('men')).toBe(true);
  });

  it('the article gives the plural only, not verb forms', () => {
    const known = en('an apple');
    expect(known.has('appled')).toBe(false);
    expect(known.has('appling')).toBe(false);
  });

  it('the last word of a noun phrase takes the plural (bus stop → stops, phone number → numbers)', () => {
    expect(en(noun('bus stop')).has('stops')).toBe(true);
    expect(en(noun('phone number')).has('numbers')).toBe(true);
    expect(en(noun('loose end')).has('ends')).toBe(true);
    expect(en(noun('restaurant bill')).has('bills')).toBe(true);
    expect(en(noun('per cent')).has('cents')).toBe(true);
    expect(en(noun('old man')).has('men')).toBe(true);
  });

  it('a noun phrase gives no verb form, and its first word no plural', () => {
    const known = en(noun('bus stop'));
    expect(known.has('stopped')).toBe(false);
    expect(known.has('stopping')).toBe(false);
    expect(known.has('buses')).toBe(false);
  });

  it('false positives: the head is elsewhere with of / a hyphen, and a phrase card is not a noun', () => {
    expect(en(noun('cup of tea')).has('cups')).toBe(false);
    expect(en(noun('cup of tea')).has('teas')).toBe(false);
    expect(en(noun('father-in-law')).has('laws')).toBe(false);
    expect(en(phrase('read the newspaper')).has('newspapers')).toBe(false);
    expect(en(phrase('bus stop')).has('stops')).toBe(false);
  });

  it('an already plural head gets no second -es', () => {
    expect(en(noun('wild birds')).has('birdses')).toBe(false);
    expect(en(noun('wild birds')).has('birds')).toBe(true);
  });

  it('the sentence of the corpus passes', () => {
    const ctx = { learned: ['an apple', noun('bus stop'), 'she', 'has', 'five', 'in', 'her', 'bag'] };
    expect(isSentenceKnown('She has five apples in her bag.', 'en', ctx)).toBe(true);
    expect(isSentenceKnown('She has five pears in her bag.', 'en', ctx)).toBe(false);
  });
});

describe('knownSentence, English comparative and superlative', () => {
  it('a learned adjective gives -er / -est (and the irregular ones)', () => {
    expect(en(adj('safe')).has('safer')).toBe(true);
    expect(en(adj('safe')).has('safest')).toBe(true);
    expect(en(adj('old')).has('oldest')).toBe(true);
    expect(en(adj('big')).has('bigger')).toBe(true);
    expect(en(adj('happy')).has('happier')).toBe(true);
    expect(en(adj('good')).has('better')).toBe(true);
    expect(en(adj('big / large')).has('larger')).toBe(true);
    expect(en(adj('nearby / close')).has('closer')).toBe(true);
  });

  it('false positives: another word, a noun and a long adjective get no degree form', () => {
    expect(en(adj('tall')).has('taller')).toBe(true);
    expect(en(adj('tall')).has('smaller')).toBe(false);
    expect(en(noun('safe')).has('safer')).toBe(false);
    expect(en(adj('beautiful')).has('beautifuler')).toBe(false);
    expect(en(adj('beautiful')).has('beautifulest')).toBe(false);
  });
});

describe('knownSentence, English question words and place words', () => {
  it('what, who, whom, whose, which, where, why, how, there, here, yes are free words', () => {
    const known = en();
    for (const w of ['what', 'who', 'whom', 'whose', 'which', 'where', 'why', 'how', 'there', 'here', 'yes']) {
      expect(known.has(w)).toBe(true);
    }
  });

  it('their contractions pass through the clitic stem', () => {
    expect(unknownTokens("Where's the school? There's a bus.", 'en', { learned: ['school', 'bus'] })).toEqual([]);
  });

  it('a word that only looks like them stays unknown', () => {
    expect(en().has('whenever')).toBe(false);
    expect(en().has('somewhere')).toBe(false);
  });
});

describe('knownSentence, English verbs inside a phrase card', () => {
  it('after a modal, "do not" and the infinitive to of going / nice', () => {
    const smoke = en(phrase('you cannot smoke'));
    for (const f of ['smoke', 'smokes', 'smoked', 'smoking']) expect(smoke.has(f)).toBe(true);
    expect(en(phrase('you must not smoke here')).has('smoking')).toBe(true);
    const travel = en(phrase('I am going to travel'));
    for (const f of ['travels', 'traveled', 'traveling', 'travelling']) expect(travel.has(f)).toBe(true);
    expect(en(phrase('nice to meet you')).has('meets')).toBe(true);
    expect(en(phrase("he doesn't work")).has('working')).toBe(true);
    expect(en(phrase('I can swim')).has('swam')).toBe(true);
    expect(en(phrase("no worries / don't worry")).has('worried')).toBe(true);
  });

  it('false positives: the to of a place, a pronoun after the modal, a verb card with another shape', () => {
    expect(en(phrase('go to school')).has('schooling')).toBe(false);
    expect(en(phrase('listen to music')).has('listening')).toBe(false);
    expect(en(phrase('can you help me')).has('helping')).toBe(false);
    expect(en(phrase('next to the bank')).has('banking')).toBe(false);
    expect(en(phrase('I am not eating')).has('eats')).toBe(false);
  });

  it('a noun card does not get verb forms from its words', () => {
    expect(en(noun('can opener')).has('opens')).toBe(false);
    expect(en(noun('will power')).has('powering')).toBe(false);
  });

  it('the sentence of the corpus passes', () => {
    const ctx = { learned: [phrase('you cannot smoke'), 'is', 'bad', 'for', 'your', 'lungs', 'please', 'stop'] };
    expect(isSentenceKnown('Smoking is bad for your lungs.', 'en', ctx)).toBe(true);
  });
});
