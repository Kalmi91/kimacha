import { gerundForms } from '../esGerunds';

describe('gerundForms', () => {
  it('-ar takes -ando, stem changes included', () => {
    expect(gerundForms('hablar')).toEqual(['hablando']);
    expect(gerundForms('jugar')).toEqual(['jugando']);
    expect(gerundForms('pensar')).toEqual(['pensando']);
    expect(gerundForms('dar')).toEqual(['dando']);
  });

  it('-er / -ir take -iendo', () => {
    expect(gerundForms('comer')).toEqual(['comiendo']);
    expect(gerundForms('vivir')).toEqual(['viviendo']);
    expect(gerundForms('hacer')).toEqual(['haciendo']);
    expect(gerundForms('querer')).toEqual(['queriendo']);
    expect(gerundForms('ver')).toEqual(['viendo']);
    expect(gerundForms('ser')).toEqual(['siendo']);
    expect(gerundForms('salir')).toEqual(['saliendo']);
  });

  it('a vowel before the ending gives -yendo', () => {
    expect(gerundForms('leer')).toEqual(['leyendo']);
    expect(gerundForms('creer')).toEqual(['creyendo']);
    expect(gerundForms('caer')).toEqual(['cayendo']);
    expect(gerundForms('traer')).toEqual(['trayendo']);
    expect(gerundForms('oír')).toEqual(['oyendo']);
    expect(gerundForms('huir')).toEqual(['huyendo']);
    expect(gerundForms('construir')).toEqual(['construyendo']);
  });

  it('the silent u of -guir / -quir is not a vowel before the ending', () => {
    expect(gerundForms('distinguir', 'distinguieron')).toEqual(['distinguiendo']);
    expect(gerundForms('seguir', 'siguieron')).toEqual(['siguiendo']);
    expect(gerundForms('delinquir')).toEqual(['delinquiendo']);
  });

  it('an -ir stem change comes from the 3rd person plural indefinido', () => {
    expect(gerundForms('dormir', 'durmieron')).toEqual(['durmiendo']);
    expect(gerundForms('pedir', 'pidieron')).toEqual(['pidiendo']);
    expect(gerundForms('sentir', 'sintieron')).toEqual(['sintiendo']);
    expect(gerundForms('morir', 'murieron')).toEqual(['muriendo']);
    expect(gerundForms('corregir', 'corrigieron')).toEqual(['corrigiendo']);
    expect(gerundForms('construir', 'construyeron')).toEqual(['construyendo']);
  });

  it('after ñ / ll the i goes (-endo)', () => {
    expect(gerundForms('teñir', 'tiñeron')).toEqual(['tiñendo']);
    expect(gerundForms('gruñir')).toEqual(['gruñendo']);
    expect(gerundForms('bullir')).toEqual(['bullendo']);
  });

  it('the verbs that go their own way', () => {
    expect(gerundForms('ir')).toEqual(['yendo']);
    expect(gerundForms('poder')).toEqual(['pudiendo']);
    expect(gerundForms('decir')).toEqual(['diciendo']);
    expect(gerundForms('bendecir')).toEqual(['bendiciendo']);
    expect(gerundForms('venir')).toEqual(['viniendo']);
    expect(gerundForms('intervenir')).toEqual(['interviniendo']);
    expect(gerundForms('reír')).toEqual(['riendo']);
    expect(gerundForms('sonreír')).toEqual(['sonriendo']);
    expect(gerundForms('freír')).toEqual(['friendo']);
  });

  it('a j-stem indefinido does not decide the gerund (conducir, traer)', () => {
    expect(gerundForms('conducir', 'condujeron')).toEqual(['conduciendo']);
    expect(gerundForms('traer', 'trajeron')).toEqual(['trayendo']);
  });

  it('nothing for what is not an infinitive', () => {
    expect(gerundForms('casa')).toEqual([]);
    expect(gerundForms('')).toEqual([]);
  });
});
