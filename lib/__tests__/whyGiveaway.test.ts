// The why-item give-away rule of scripts/audit-games.mjs (P1): see scripts/whyGiveaway.cjs.
const { whyGiveaways, overlayGiveaways, containsTarget, sameWord } = require('../../scripts/whyGiveaway.cjs');

const opt = (en: string, es: string = en) => ({ text: { en, es } });

describe('whyGiveaways', () => {
  it('flags a parenthesis in any option, in any language', () => {
    const item = {
      target: 'cuál',
      correctIndex: 0,
      options: [opt('asking to pick from a known set'), opt('asking for a definition'), opt('asking a quantity', 'pidiendo una cantidad (cuánto)')],
    };
    const issues = whyGiveaways(item);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toContain('option 2 text.es');
  });

  it('flags the target in the right option when not every option has it', () => {
    const item = {
      target: 'mucho',
      correctIndex: 2,
      options: [opt('muy + adjective'), opt('mucho + noun'), opt('verb + mucho')],
    };
    expect(whyGiveaways(item).join(' ')).toContain('shares the target word');
  });

  it('flags a form of the target (accent and case ignored)', () => {
    const item = {
      target: 'hablaba',
      correctIndex: 0,
      options: [opt('Hablaba is a habit'), opt('a single finished event'), opt('a command')],
    };
    expect(whyGiveaways(item)).toHaveLength(1);
  });

  it('accepts the target when every option has it, or when only a wrong option has it', () => {
    const everyOption = {
      target: 'cuál',
      correctIndex: 1,
      options: [opt('qué vs cuál'), opt('cuál picks from a set'), opt('cuál is never plural')],
    };
    expect(whyGiveaways(everyOption)).toEqual([]);
    const wrongOnly = {
      target: 'cuál',
      correctIndex: 0,
      options: [opt('asking to pick from a known set'), opt('cuál asks for a definition'), opt('asking a quantity')],
    };
    expect(whyGiveaways(wrongOnly)).toEqual([]);
  });

  it('passes a clean item and ignores an item without a target', () => {
    const clean = { target: 'a', correctIndex: 0, options: [opt('a job takes an article'), opt('the only one, so the'), opt('general sense, no article')] };
    expect(whyGiveaways(clean)).toHaveLength(1);
    const cleanOk = { target: 'doctor', correctIndex: 0, options: [opt('a job takes an article'), opt('the only one, so the'), opt('general sense, no article')] };
    expect(whyGiveaways(cleanOk)).toEqual([]);
    expect(whyGiveaways({ correctIndex: 0, options: [opt('x'), opt('y'), opt('z')] })).toEqual([]);
    expect(whyGiveaways({})).toEqual([]);
  });
});

describe('containsTarget', () => {
  it('matches whole words and multi-word targets, not substrings', () => {
    expect(containsTarget('uses es here', 'es')).toBe(true);
    expect(containsTarget('un profesor', 'es')).toBe(false);
    expect(containsTarget('me lo da', 'me lo')).toBe(true);
    expect(containsTarget('lo me da', 'me lo')).toBe(false);
    expect(containsTarget('anything', '')).toBe(false);
  });
});

describe('stricter rule (review of the first version), real cases', () => {
  it('matches short targets and plurals: Cuál/cuales, ojos/ojo', () => {
    expect(sameWord('cual', 'cuales')).toBe(true);
    expect(sameWord('ojo', 'ojos')).toBe(true);
    expect(sameWord('the', 'there')).toBe(false);
    const item = { es: '¿Cuál es tu apellido?', target: 'Cuál', correctIndex: 0, options: [opt('elección entre cuales opciones'), opt('definición'), opt('cantidad')] };
    expect(whyGiveaways(item, 'es').join(' ')).toContain('"cual"');
    const ojos = { es: 'Tiene ojos azules.', target: 'ojos', correctIndex: 1, options: [opt('un color'), opt('un ojo del rostro'), opt('una forma')] };
    expect(whyGiveaways(ojos, 'es').join(' ')).toContain('"ojos"');
  });

  it('flags any word of a multi-word target that only the right option shares', () => {
    const cases: [string, string, string[], number][] = [
      ['Tengo más de treinta años.', 'más de treinta', ['número con más/menos de', 'sustantivo con tanto/a', 'comparativo irregular'], 0],
      ['El café está abierto.', 'está abierta', ['ser + participio', 'estar + participio', 'estar + gerundio'], 1],
      ['Me parece que tienes razón.', 'Me parece que', ['negación', 'opinión: parecer + adjetivo', 'parte del cuerpo'], 1],
    ];
    for (const [es, target, texts, ci] of cases) {
      const item = { es, target, correctIndex: ci, options: [opt(texts[0]), opt(texts[1]), opt(texts[2])] };
      expect(whyGiveaways(item, 'es').length).toBeGreaterThan(0);
    }
  });

  it('flags a sentence word only the right option cites (de relativsaetze: mit ... Freund)', () => {
    const item = {
      es: 'Der Freund, mit dem ich reise, heißt Paul.',
      target: 'dem',
      correctIndex: 0,
      options: [opt('mit takes the dative and Freund is masculine'), opt('the friend is the object, so the accusative'), opt('ich is in the dative')],
    };
    expect(whyGiveaways(item).join(' ')).toContain('"freund"');
  });

  it('does not flag shared function words, nor an English stem that looks like a Spanish word', () => {
    const habit = { es: 'Siempre había mucha gente.', target: 'había', correctIndex: 0, options: [opt('a scene or a habit in the past', 'una escena o costumbre en el pasado'), opt('one event', 'un hecho'), opt('the future', 'el futuro')] };
    expect(whyGiveaways(habit, 'es')).toEqual([]);
  });

  it('flags brackets, and a parenthesis in an overlay text (not in the wrong text)', () => {
    const item = { es: 'x', target: 'y', correctIndex: 0, options: [opt('rule [y]'), opt('b'), opt('c')] };
    expect(whyGiveaways(item).join(' ')).toContain('parenthesis or bracket');
    const clean = { options: [opt('rule one'), opt('b'), opt('c')] };
    expect(overlayGiveaways(clean, { 'rule one': 'Regel eins (Plural)' })).toHaveLength(1);
    expect(overlayGiveaways(clean, { 'rule one': 'Regel eins' })).toEqual([]);
  });
});
