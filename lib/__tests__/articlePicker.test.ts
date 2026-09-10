import {
  ARTICLE_OPTIONS,
  articleOf,
  articlePickerApplies,
  bodyOf,
  composeAnswer,
} from '../articlePicker';

describe('articlePickerApplies', () => {
  it('shows the chips on Spanish word cards', () => {
    expect(articlePickerApplies('es', true)).toBe(true);
  });

  it('stays on verb and adjective cards too, where ⊘ is the right answer (FB214)', () => {
    // A gombsor nem a szófajtól függ: a tanuló dolga eldönteni, kell-e névelő.
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
    // FB184 precedent: `correos` has no article, ⊘ has to stay possible.
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
