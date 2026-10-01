import { detectStructures, resetFormIndex } from '../grammar/tenseGate';

beforeEach(() => resetFormIndex());

describe('detectStructures', () => {
  it('names the compound tenses by their auxiliary and participle', () => {
    // FB196 kiváltó esete: „The clients have arrived" spanyol párja.
    expect([...detectStructures('Los clientes han llegado temprano hoy.')]).toContain('perfecto');
    expect([...detectStructures('¿No habías estado aquí antes?')]).toContain('pluscuamperfecto');
    expect([...detectStructures('Habré terminado el trabajo.')]).toContain('futuro_perfecto');
    expect([...detectStructures('Habría llegado antes.')]).toContain('condicional_perfecto');
  });

  it('reads the simple tenses off the conjugation engine', () => {
    expect([...detectStructures('Yo hablo español.')]).toContain('presente');
    expect([...detectStructures('Ayer comí en casa.')]).toContain('indefinido');
    expect([...detectStructures('Antes vivíamos aquí.')]).toContain('imperfecto');
    expect([...detectStructures('Mañana hablaré con él.')]).toContain('futuro');
    expect([...detectStructures('Yo viajaría más.')]).toContain('condicional');
  });

  it('does not mistake a noun for a verb form it happens to share', () => {
    // estudio = tanulmány ÉS estudiar jelen ideje; entre = között ÉS entrar kötőmódja;
    // viaje = utazás ÉS viajar kötőmódja. (A words-openben nincs "vino".)
    expect(detectStructures('El estudio de España.').has('presente')).toBe(false);
    expect(detectStructures('El gato está entre la mesa y la silla.').has('subjuntivo_presente')).toBe(false);
    expect(detectStructures('Estoy emocionado por el viaje.').has('subjuntivo_presente')).toBe(false);
    expect(detectStructures('Compro el billete en la agencia de viajes.').has('subjuntivo_presente')).toBe(false);
  });

  it('separates a command from a subordinate subjunctive, they share the form', () => {
    expect([...detectStructures('Tome asiento, por favor.')]).toContain('imperativo');
    expect([...detectStructures('No seas tonto, escúchame.')]).toContain('imperativo');
    expect([...detectStructures('Espero que usted vea el problema.')]).toContain('subjuntivo_presente');
    expect(detectStructures('Espero que usted vea el problema.').has('imperativo')).toBe(false);
  });

  it('needs a trigger before it calls something a subjunctive', () => {
    expect([...detectStructures('No creo que él sepa la verdad.')]).toContain('subjuntivo_presente');
    expect(detectStructures('Tengo varios libros sobre este tema.').has('subjuntivo_presente')).toBe(false);
  });
});
