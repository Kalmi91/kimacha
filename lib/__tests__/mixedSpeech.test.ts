import { lessonSpeechSegments, splitByMarkers } from '@/lib/mixedSpeech';

const hu = { learnedLang: 'es', nativeLang: 'hu' };

// the V2 `speak` field cuts the language switches from the «...» markup,
// not from corpus guessing.
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

describe('lessonSpeechSegments', () => {
  const speak = { en: 'Say «I am a teacher» like this.', es: 'Dilo «I am a teacher» así.', hu: 'Így mondd: «I am a teacher»' };

  it('reads the Hungarian text with the Hungarian voice and the marked sections with the learned language', () => {
    expect(lessonSpeechSegments(speak, 'hu', 'en')).toEqual([
      { text: 'Így mondd:', lang: 'hu' },
      { text: 'I am a teacher', lang: 'en' },
    ]);
  });

  it('keeps the en and es sources as they were', () => {
    expect(lessonSpeechSegments(speak, 'es', 'en')[0]).toEqual({ text: 'Dilo', lang: 'es' });
    expect(lessonSpeechSegments(speak, 'en', 'es')[0]).toEqual({ text: 'Say', lang: 'en' });
  });

  it('a lesson without Hungarian text falls back to the English text and the English voice', () => {
    const noHu = { en: speak.en, es: speak.es };
    expect(lessonSpeechSegments(noHu, 'hu', 'es')).toEqual([
      { text: 'Say', lang: 'en' },
      { text: 'I am a teacher', lang: 'es' },
      { text: 'like this.', lang: 'en' },
    ]);
  });
});
