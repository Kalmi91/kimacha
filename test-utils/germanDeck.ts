// A small German deck for tests that must not depend on how far the generated deck (data/words/de) is. Use it as the A1 file:
//   jest.mock('@/data/words/de/a1.json', () => require('@/test-utils/germanDeck').germanDeckA1());
// The cards have the shape of data/words/de (scripts/build-de-deck.mjs): three genders, umlauts, ß, a bracketed gloss, an
// alternative, a plural-only noun, and an example sentence of every word that contains the word itself. Most sentences are
// "article noun ist adjective" in all four languages (es "es", en "is", hu none): whoever knows the nouns, the adjectives and
// the card "ist" knows the sentence, so the reading round can use them.

type Row = {
  de: string;
  es: string;
  en: string;
  hu: string;
  pos: string;
  sentence: { de: string; es: string; en: string; hu: string };
};

export const GERMAN_DECK_ROWS: Row[] = [
  { de: 'groß', es: 'grande', en: 'big', hu: 'nagy', pos: 'adj', sentence: { de: 'Das Auto ist groß.', es: 'El carro es grande.', en: 'The car is big.', hu: 'Az autó nagy.' } },
  { de: 'klein', es: 'pequeño', en: 'small', hu: 'kicsi', pos: 'adj', sentence: { de: 'Die Katze ist klein.', es: 'El gato es pequeño.', en: 'The cat is small.', hu: 'A macska kicsi.' } },
  { de: 'heiß', es: 'caliente', en: 'hot', hu: 'forró', pos: 'adj', sentence: { de: 'Der Tag ist heiß.', es: 'El día es caliente.', en: 'The day is hot.', hu: 'A nap forró.' } },
  { de: 'kalt (Temperatur)', es: 'frío', en: 'cold', hu: 'hideg', pos: 'adj', sentence: { de: 'Die Nacht ist kalt.', es: 'La noche es fría.', en: 'The night is cold.', hu: 'Az éjszaka hideg.' } },
  { de: 'schön', es: 'bonito', en: 'beautiful', hu: 'szép', pos: 'adj', sentence: { de: 'Die Frau ist schön.', es: 'La mujer es bonita.', en: 'The woman is beautiful.', hu: 'A nő szép.' } },
  { de: 'hässlich', es: 'feo', en: 'ugly', hu: 'csúnya', pos: 'adj', sentence: { de: 'Der Hund ist hässlich.', es: 'El perro es feo.', en: 'The dog is ugly.', hu: 'A kutya csúnya.' } },
  { de: 'der Tag', es: 'el día', en: 'day', hu: 'nap', pos: 'noun', sentence: { de: 'Der Tag ist heiß.', es: 'El día es caliente.', en: 'The day is hot.', hu: 'A nap forró.' } },
  { de: 'die Nacht', es: 'la noche', en: 'night', hu: 'éjszaka', pos: 'noun', sentence: { de: 'Die Nacht ist kalt.', es: 'La noche es fría.', en: 'The night is cold.', hu: 'Az éjszaka hideg.' } },
  { de: 'der Mann', es: 'el hombre', en: 'man', hu: 'férfi', pos: 'noun', sentence: { de: 'Der Mann ist groß.', es: 'El hombre es grande.', en: 'The man is big.', hu: 'A férfi nagy.' } },
  { de: 'die Frau', es: 'la mujer', en: 'woman', hu: 'nő', pos: 'noun', sentence: { de: 'Die Frau ist schön.', es: 'La mujer es bonita.', en: 'The woman is beautiful.', hu: 'A nő szép.' } },
  { de: 'das Auto', es: 'el carro', en: 'car', hu: 'autó', pos: 'noun', sentence: { de: 'Das Auto ist groß.', es: 'El carro es grande.', en: 'The car is big.', hu: 'Az autó nagy.' } },
  { de: 'der Hund', es: 'el perro', en: 'dog', hu: 'kutya', pos: 'noun', sentence: { de: 'Der Hund ist hässlich.', es: 'El perro es feo.', en: 'The dog is ugly.', hu: 'A kutya csúnya.' } },
  { de: 'ist', es: 'es', en: 'is', hu: 'van', pos: 'verb', sentence: { de: 'Das Auto ist groß.', es: 'El carro es grande.', en: 'The car is big.', hu: 'Az autó nagy.' } },
  { de: 'kommen', es: 'venir', en: 'to come', hu: 'jönni', pos: 'verb', sentence: { de: 'Wir wollen kommen.', es: 'Queremos venir.', en: 'We want to come.', hu: 'Jönni akarunk.' } },
  { de: 'gehen', es: 'ir', en: 'to go', hu: 'menni', pos: 'verb', sentence: { de: 'Wir wollen gehen.', es: 'Queremos ir.', en: 'We want to go.', hu: 'Menni akarunk.' } },
  { de: 'kaufen', es: 'comprar', en: 'to buy', hu: 'venni', pos: 'verb', sentence: { de: 'Ich will ein Auto kaufen.', es: 'Quiero comprar un carro.', en: 'I want to buy a car.', hu: 'Autót akarok venni.' } },
  { de: 'verkaufen', es: 'vender', en: 'to sell', hu: 'eladni', pos: 'verb', sentence: { de: 'Ich will das Auto verkaufen.', es: 'Quiero vender el carro.', en: 'I want to sell the car.', hu: 'El akarom adni az autót.' } },
  { de: 'öffnen', es: 'abrir', en: 'to open', hu: 'kinyitni', pos: 'verb', sentence: { de: 'Ich will das Auto öffnen.', es: 'Quiero abrir el carro.', en: 'I want to open the car.', hu: 'Ki akarom nyitni az autót.' } },
  { de: 'schließen / zumachen', es: 'cerrar', en: 'to close', hu: 'bezárni', pos: 'verb', sentence: { de: 'Ich will das Auto schließen.', es: 'Quiero cerrar el carro.', en: 'I want to close the car.', hu: 'Be akarom zárni az autót.' } },
  { de: 'die Katze', es: 'el gato', en: 'cat', hu: 'macska', pos: 'noun', sentence: { de: 'Die Katze ist klein.', es: 'El gato es pequeño.', en: 'The cat is small.', hu: 'A macska kicsi.' } },
  { de: 'das Mädchen', es: 'la niña', en: 'girl', hu: 'kislány', pos: 'noun', sentence: { de: 'Das Mädchen ist schön.', es: 'La niña es bonita.', en: 'The girl is beautiful.', hu: 'A kislány szép.' } },
  { de: 'die Straße', es: 'la calle', en: 'street', hu: 'utca', pos: 'noun', sentence: { de: 'Die Straße ist groß.', es: 'La calle es grande.', en: 'The street is big.', hu: 'Az utca nagy.' } },
  { de: 'die Leute (Pl.)', es: 'la gente', en: 'people', hu: 'emberek', pos: 'noun', sentence: { de: 'Die Leute kommen.', es: 'La gente viene.', en: 'The people are coming.', hu: 'Az emberek jönnek.' } },
];

/** The cards of the A1 file, with ids 200001... (the English deck's id space) and the source card `e<id>`. */
export const germanDeckA1 = () =>
  GERMAN_DECK_ROWS.map((row, i) => ({
    id: 200001 + i,
    level: 'A1',
    de: row.de,
    es: row.es,
    en: row.en,
    hu: row.hu,
    sentence_de: row.sentence.de,
    sentence_es: row.sentence.es,
    sentence_en: row.sentence.en,
    sentence_hu: row.sentence.hu,
    pos: row.pos,
    src: `e${i + 1}`,
  }));
