import { splitByMarkers } from '@/lib/mixedSpeech';

const hu = { learnedLang: 'es', nativeLang: 'hu' };

// LECKE-SEMA 3.2: a V2 `speak` mező «...»-jelölésből vágja a nyelvváltást,
// nem korpusz-találgatásból.
describe('splitByMarkers', () => {
  it('splits balanced markers into alternating native/learned segments', () => {
    const segments = splitByMarkers('Azt mondja: «Soy profesor». Érted?', hu);
    expect(segments).toEqual([
      { text: 'Azt mondja:', lang: 'hu' },
      { text: 'Soy profesor', lang: 'es' },
      { text: '. Érted?', lang: 'hu' },
    ]);
  });

  it('handles a marker at the very start', () => {
    const segments = splitByMarkers('«Soy profesor» azt jelenti.', hu);
    expect(segments).toEqual([
      { text: 'Soy profesor', lang: 'es' },
      { text: 'azt jelenti.', lang: 'hu' },
    ]);
  });

  it('handles a marker at the very end', () => {
    const segments = splitByMarkers('Így mondjuk: «Soy profesor»', hu);
    expect(segments).toEqual([
      { text: 'Így mondjuk:', lang: 'hu' },
      { text: 'Soy profesor', lang: 'es' },
    ]);
  });

  it('returns one native segment when there are no markers', () => {
    const segments = splitByMarkers('Ez a mondat teljesen magyar.', hu);
    expect(segments).toEqual([{ text: 'Ez a mondat teljesen magyar.', lang: 'hu' }]);
  });

  it('treats the rest as native when a marker is unbalanced', () => {
    const segments = splitByMarkers('Azt mondja: «Soy profesor de verdad.', hu);
    expect(segments).toEqual([
      { text: 'Azt mondja:', lang: 'hu' },
      { text: 'Soy profesor de verdad.', lang: 'hu' },
    ]);
  });
});
