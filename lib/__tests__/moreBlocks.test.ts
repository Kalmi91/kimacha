import { parseMoreBlocks, splitSentences } from '../grammar/moreBlocks';

describe('parseMoreBlocks', () => {
  it('turns a numbered exception list into a heading plus items', () => {
    const more =
      "Exceptions: 1) An EVENT's location takes ser (La fiesta es aquí.), an OBJECT's location takes estar (La casa está aquí.). " +
      '2) Marital status usually takes estar (estoy casado/soltero), though ser appears regionally too. ' +
      '3) A few adjectives change meaning with the two verbs: ser aburrido (boring) vs estar aburrido (bored).';

    const blocks = parseMoreBlocks(more);

    expect(blocks[0]).toEqual({ kind: 'heading', text: 'Exceptions' });
    expect(blocks.filter((b) => b.kind === 'item')).toHaveLength(3);
    expect(blocks[1]).toMatchObject({ kind: 'item', label: '1' });
    expect(blocks[3]).toMatchObject({ kind: 'item', label: '3' });
    // A szöveg 1:1 marad, csak a sorszám kerül le az elejéről.
    expect(blocks[2]).toMatchObject({
      text: 'Marital status usually takes estar (estoy casado/soltero), though ser appears regionally too.',
    });
  });

  it('keeps a list that has no intro sentence', () => {
    const blocks = parseMoreBlocks('1) Első eset. 2) Második eset.');
    expect(blocks).toEqual([
      { kind: 'item', label: '1', text: 'Első eset.' },
      { kind: 'item', label: '2', text: 'Második eset.' },
    ]);
  });

  it('splits plain prose into one bullet per rule', () => {
    const more =
      'For emphasis you can add: a mí me gusta, a ti te gusta. It is optional, but it clears up who le refers to (him or her). ' +
      'Several infinitives still take the SINGULAR: Me gusta comer y beber.';

    const blocks = parseMoreBlocks(more);

    expect(blocks).toHaveLength(3);
    expect(blocks.every((b) => b.kind === 'bullet')).toBe(true);
    expect(blocks[1]).toMatchObject({
      text: 'It is optional, but it clears up who le refers to (him or her).',
    });
  });

  it('leaves a single sentence as one paragraph', () => {
    expect(parseMoreBlocks('Hay has no plural form: hay tres libros.')).toEqual([
      { kind: 'para', text: 'Hay has no plural form: hay tres libros.' },
    ]);
  });

  it('keeps every written paragraph', () => {
    const blocks = parseMoreBlocks('Rápido lehet melléknév.\n\nMucho ugyanígy működik.');
    expect(blocks).toEqual([
      { kind: 'para', text: 'Rápido lehet melléknév.' },
      { kind: 'para', text: 'Mucho ugyanígy működik.' },
    ]);
  });

  it('loses no character of the lesson text', () => {
    const more = 'Kivételek: 1) Az agua nőnemű, de el agua. 2) A -ma végű szavak hímneműek.';
    const joined = parseMoreBlocks(more)
      .map((b) => b.text)
      .join(' ');
    expect(joined).toBe('Kivételek Az agua nőnemű, de el agua. A -ma végű szavak hímneműek.');
  });
});

describe('splitSentences', () => {
  it('does not break inside parentheses', () => {
    expect(splitSentences('La fiesta es aquí (mañana. hoy) y ya está. Fin.')).toEqual([
      'La fiesta es aquí (mañana. hoy) y ya está.',
      'Fin.',
    ]);
  });

  it('does not break after an abbreviation', () => {
    expect(splitSentences('Se usa p. ej. Con amigos.')).toEqual(['Se usa p. ej. Con amigos.']);
  });

  it('does not break inside a decimal number', () => {
    expect(splitSentences('El 1.5 es normal.')).toEqual(['El 1.5 es normal.']);
  });

  it('breaks before an accented capital', () => {
    expect(splitSentences('Ez az egyik. Útközben a másik.')).toEqual([
      'Ez az egyik.',
      'Útközben a másik.',
    ]);
  });
});

describe('parseMoreBlocks, egységes tördelés', () => {
  it('does not mix bullets and bare paragraphs in one block', () => {
    const more = 'Első szabály. Második szabály.\n\nHarmadik szabály.';
    const blocks = parseMoreBlocks(more);
    expect(blocks.map((b) => b.kind)).toEqual(['bullet', 'bullet', 'bullet']);
  });
});
