// The German tense gate (lib/grammar/deTenseGate.ts): which tense or structure a sentence uses, and which level teaches it.

import { DE_STRUCTURE_LEVEL, detectDeStructures, deStructuresAbove, type DeStructure } from '../grammar/deTenseGate';

const found = (sentence: string): DeStructure[] => [...detectDeStructures(sentence)].sort();

describe('the present tense needs no gate', () => {
  it.each([
    'Ich gehe nach Hause.',
    'Ich stehe um sieben Uhr auf.',
    'Es wird kalt.',
    'Ich möchte Arzt werden und arbeiten.',
    'Das Fenster ist geschlossen.',
    'Ich habe Hunger.',
    'Ich kann hier mit meiner Mutter essen.',
    'Komm bitte her!',
  ])('%s', (sentence) => {
    expect(found(sentence)).toEqual([]);
  });
});

describe('perfect', () => {
  it('a common verb is taught at A1, every other verb at A2', () => {
    expect(found('Ich habe Suppe gegessen.')).toEqual(['perfekt_common']);
    expect(found('Gestern bin ich zum Arzt gegangen.')).toEqual(['perfekt_common']);
    expect(found('Ich bin gestern aufgestanden.')).toEqual(['perfekt_common']);
    expect(found('Wir haben das Bild gemalt.')).toEqual(['perfekt']);
    expect(deStructuresAbove('Ich habe Suppe gegessen.', 'A1')).toEqual([]);
    expect(deStructuresAbove('Wir haben das Bild gemalt.', 'A1')).toEqual(['perfekt']);
    expect(deStructuresAbove('Wir haben das Bild gemalt.', 'A2')).toEqual([]);
  });

  it('sein + the participle of a haben verb is a state, not a tense', () => {
    expect(found('Die Tür ist geöffnet.')).toEqual([]);
    expect(found('Er ist verheiratet.')).toEqual([]);
  });

  it('auxiliary and participle must stand in the same clause', () => {
    expect(found('Die Hitze war extrem, deshalb sind wir geblieben.')).toEqual(['perfekt_common', 'praeteritum_basic']);
    expect(deStructuresAbove('Ich hatte Hunger, also habe ich Brot gegessen.', 'A2')).toEqual([]);
  });
});

describe('preterite', () => {
  it('sein, haben and the modals at A2, every other verb at B1', () => {
    expect(found('Er war müde.')).toEqual(['praeteritum_basic']);
    expect(found('Wir hatten Hunger.')).toEqual(['praeteritum_basic']);
    expect(found('Ich konnte nicht kommen.')).toEqual(['praeteritum_basic']);
    expect(found('Ich aß einen Apfel.')).toEqual(['praeteritum']);
    expect(found('Er stand um sieben Uhr auf.')).toEqual(['praeteritum']);
    expect(found('Ich kannte ihn.')).toEqual(['praeteritum']);
    expect(deStructuresAbove('Er war müde.', 'A1')).toEqual(['praeteritum_basic']);
    expect(deStructuresAbove('Ich aß einen Apfel.', 'A2')).toEqual(['praeteritum']);
    expect(deStructuresAbove('Ich aß einen Apfel.', 'B1')).toEqual([]);
  });

  it('a capital inside the sentence is a noun, never a verb form', () => {
    expect(found('Ich wohne im Band 3 neben dem Schloss.')).toEqual([]);
  });
});

describe('future, subjunctive, passive, past perfect', () => {
  it('future I: werden + infinitive (B1); werden alone is no future', () => {
    expect(found('Ich werde morgen kommen.')).toEqual(['futur1']);
    expect(found('Es wird sehr schön sein.')).toEqual(['futur1']);
    expect(found('Es wird kalt.')).toEqual([]);
    expect(found('Ich möchte Lehrer werden und arbeiten.')).toEqual([]);
    expect(found('Er wird morgen gegessen haben.')).toEqual(['futur2']);
  });

  it('subjunctive II: würde + infinitive, hätte, wäre, könnte (B1); the past form at B2', () => {
    expect(found('Ich würde gern essen.')).toEqual(['konjunktiv2']);
    expect(found('Ich hätte gern einen Kaffee.')).toEqual(['konjunktiv2']);
    expect(found('Das wäre schön.')).toEqual(['konjunktiv2']);
    expect(found('Ich könnte das machen.')).toEqual(['konjunktiv2']);
    expect(found('Ich hätte das gewusst.')).toEqual(['konjunktiv2_vergangenheit']);
    expect(deStructuresAbove('Ich hätte gern einen Kaffee.', 'A2')).toEqual(['konjunktiv2']);
    expect(deStructuresAbove('Ich hätte das gewusst.', 'B1')).toEqual(['konjunktiv2_vergangenheit']);
  });

  it('passive: present at B1, preterite and perfect at B2', () => {
    expect(found('Das Haus wird gebaut.')).toEqual(['passiv_praesens']);
    expect(found('Das Haus wurde gebaut.')).toEqual(['passiv_praeteritum']);
    expect(found('Das Haus ist gebaut worden.')).toEqual(['passiv_perfekt']);
    expect(deStructuresAbove('Das Haus wird gebaut.', 'A2')).toEqual(['passiv_praesens']);
    expect(deStructuresAbove('Das Haus wurde gebaut.', 'B1')).toEqual(['passiv_praeteritum']);
  });

  it('past perfect (B2) and subjunctive I in reported speech (B2)', () => {
    expect(found('Er hatte schon gegessen.')).toEqual(['plusquamperfekt']);
    expect(found('Sie war schon gegangen.')).toEqual(['plusquamperfekt']);
    expect(found('Er sagt, er sei krank.')).toEqual(['konjunktiv1']);
    expect(found('Er sagte, er komme morgen.')).toEqual(['konjunktiv1', 'praeteritum']);
    expect(found('Ich komme morgen.')).toEqual([]);
    expect(deStructuresAbove('Er hatte schon gegessen.', 'B1')).toEqual(['plusquamperfekt']);
    expect(deStructuresAbove('Er hatte schon gegessen.', 'B2')).toEqual([]);
  });

  it('the own subjunctive II of a strong verb is C1; where preterite and subjunctive II coincide the earlier level wins', () => {
    expect(found('Wenn ich käme, wäre er froh.')).toEqual(['konjunktiv2', 'konjunktiv2_other']);
    expect(found('Ich sollte gehen.')).toEqual(['praeteritum_basic']);
  });
});

describe('the table', () => {
  it('every structure has a level, A1 only for the perfect of the commonest verbs', () => {
    expect(Object.keys(DE_STRUCTURE_LEVEL)).toHaveLength(14);
    expect(Object.entries(DE_STRUCTURE_LEVEL).filter(([, level]) => level === 'A1').map(([name]) => name)).toEqual(['perfekt_common']);
  });
});
