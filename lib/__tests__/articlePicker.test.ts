import {
  ARTICLE_OPTIONS,
  articleOf,
  articlePickerApplies,
  articleRowAppliesForPos,
  bodyOf,
  composeAnswer,
} from '../articlePicker';
import { gradePcicAnswer } from '../pcicMatch';
import { kindOfEs } from '../../data/pcic';

describe('articlePickerApplies', () => {
  it('shows the chips on Spanish word cards', () => {
    expect(articlePickerApplies('es', true)).toBe(true);
  });

  it('stays on verb and adjective cards too, where ⊘ is the right answer (FB214)', () => {
    // The button row does not depend on the part of speech: it is up to the learner to decide whether an article is needed.
    expect(articlePickerApplies('es', true)).toBe(true);
  });

  it('stays away from sentence cards', () => {
    expect(articlePickerApplies('es', false)).toBe(false);
  });

  it('stays away from other target languages', () => {
    expect(articlePickerApplies('en', true)).toBe(false);
    expect(articlePickerApplies('de', true)).toBe(false);
  });
});

describe('composeAnswer', () => {
  it('joins the picked article to the typed body', () => {
    expect(composeAnswer('el', 'pimiento')).toBe('el pimiento');
    expect(composeAnswer('las', ' gafas ')).toBe('las gafas');
  });

  it('leaves the body alone when no article is picked', () => {
    // precedent: `correos` has no article, ⊘ has to stay possible.
    expect(composeAnswer('', 'correos')).toBe('correos');
  });

  it('never leaves a trailing space when nothing is typed yet', () => {
    expect(composeAnswer('la', '')).toBe('la');
    expect(composeAnswer('', '')).toBe('');
  });
});

describe('articleOf / bodyOf', () => {
  it('splits a definite article off the correct form', () => {
    expect(articleOf('el pimiento')).toBe('el');
    expect(bodyOf('el pimiento')).toBe('pimiento');
    expect(articleOf('las gafas')).toBe('las');
    expect(bodyOf('las gafas')).toBe('gafas');
  });

  it('reports no article for article-less forms', () => {
    expect(articleOf('correos')).toBe('');
    expect(bodyOf('correos')).toBe('correos');
  });

  it('does not mistake an indefinite article or a lookalike word for one', () => {
    // `un/una` is not offered as a chip, and `ellos` merely starts with "el".
    expect(articleOf('un libro')).toBe('');
    expect(articleOf('ellos hablan')).toBe('');
  });

  it('round-trips every offered article', () => {
    for (const art of ARTICLE_OPTIONS) {
      expect(articleOf(composeAnswer(art, 'casa'))).toBe(art);
      expect(bodyOf(composeAnswer(art, 'casa'))).toBe('casa');
    }
  });
});

describe('articlePickerApplies with the expected answer (FB262-264)', () => {
  it('hides the chips on a bare multi-word phrase', () => {
    expect(articlePickerApplies('es', true, 'voy a viajar')).toBe(false);
    expect(articlePickerApplies('es', true, 'van a llegar')).toBe(false);
  });

  it('keeps the chips on single words and on article-led compounds', () => {
    expect(articlePickerApplies('es', true, 'perro')).toBe(true);
    expect(articlePickerApplies('es', true, 'el fin de semana')).toBe(true);
    expect(articlePickerApplies('es', true, 'las gafas')).toBe(true);
  });

  it('keeps the chips when any " / " alternative is a single word', () => {
    expect(articlePickerApplies('es', true, 'parar / detener')).toBe(true);
    expect(articlePickerApplies('es', true, 'ir a pie / caminar')).toBe(true);
  });
});

describe('articlePickerApplies on sentence cards (FB291)', () => {
  it('hides the chips on a full sentence even when it starts with an article', () => {
    expect(articlePickerApplies('es', true, 'El gato está en la mesa.')).toBe(false);
    expect(articlePickerApplies('es', true, '¿Dónde está el baño?')).toBe(false);
  });

  it('keeps the earlier word-level rules (FB262)', () => {
    expect(articlePickerApplies('es', true, 'el fin de semana')).toBe(true);
    expect(articlePickerApplies('es', true, 'perro')).toBe(true);
    expect(articlePickerApplies('es', true, 'voy a viajar')).toBe(false);
  });
});

describe('articleRowAppliesForPos (PCIC chip)', () => {
  it('applies when the pos is unknown (null), the ⊘ answer is still worth asking', () => {
    expect(articleRowAppliesForPos(null)).toBe(true);
  });

  it('applies on a noun', () => {
    expect(articleRowAppliesForPos({ pos: 'noun' })).toBe(true);
    expect(articleRowAppliesForPos({ pos: 'noun', gender: 'f' })).toBe(true);
  });

  it('does not apply once the chip already names a non-noun part of speech', () => {
    expect(articleRowAppliesForPos({ pos: 'verb' })).toBe(false);
    expect(articleRowAppliesForPos({ pos: 'adj' })).toBe(false);
    expect(articleRowAppliesForPos({ pos: 'adv' })).toBe(false);
    expect(articleRowAppliesForPos({ pos: 'pron' })).toBe(false);
    expect(articleRowAppliesForPos({ pos: 'prep' })).toBe(false);
    expect(articleRowAppliesForPos({ pos: 'num' })).toBe(false);
    expect(articleRowAppliesForPos({ pos: 'phrase' })).toBe(false);
    expect(articleRowAppliesForPos({ pos: 'conj' })).toBe(false);
  });
});

// A " / " form whose every alternative is
// "article + one word" behaves like a single-word noun.
describe('slash-separated (" / ") answer', () => {
  const answer = 'el carro / el coche / el auto';

  it('kind: word if every alternative is article + one word; phrase if any is multi-word', () => {
    expect(kindOfEs(answer)).toBe('word');
    expect(kindOfEs('hacer / ejecutar')).toBe('word');
    expect(kindOfEs('el fin de semana')).toBe('phrase');
    expect(kindOfEs('el carro / el fin de semana')).toBe('phrase');
    expect(kindOfEs('tocar/sentir frío')).toBe('phrase');
  });

  it('the article button row appears', () => {
    expect(articlePickerApplies('es', true, answer)).toBe(true);
  });

  it('the article + word of any alternative is accepted (composeAnswer + grader)', () => {
    expect(gradePcicAnswer(composeAnswer('el', 'coche'), answer).match).toBe('exact');
    expect(gradePcicAnswer(composeAnswer('el', 'auto'), answer).match).toBe('exact');
    expect(gradePcicAnswer(composeAnswer('la', 'obra'), 'la obra / el drama').match).toBe('exact');
    expect(gradePcicAnswer(composeAnswer('el', 'drama'), 'la obra / el drama').match).toBe('exact');
    expect(gradePcicAnswer(composeAnswer('', 'coche'), answer).match).not.toBe('exact');
  });

  it('on a wrong answer the article of the nearest alternative goes back to the button row', () => {
    const g = gradePcicAnswer(composeAnswer('el', 'cochee'), answer);
    expect(articleOf(g.best)).toBe('el');
    expect(bodyOf(g.best)).toBe('coche');
  });
});
