// Photos for the speaking part of the mock exams, from Wikimedia Commons, bundled into the app.
// The metadata (author, licence, source URL) lives in data/exams/mock/photos.json, keyed by the photo key
// (`<target>-<level>-<n>`, e.g. `es-b1-1`); the files are under assets/exam-photos/. Metro can only do static
// require, so the file name -> source map is maintained by hand here; the gate of
// data/__tests__/examPhotos.test.ts checks that the two agree.
import type { ImageSourcePropType } from 'react-native';
import photosJson from '@/data/exams/mock/photos.json';

type ExamPhotoMeta = {
  file: string;
  width: number;
  height: number;
  author: string;
  license: string;
  sourceUrl: string;
  modified?: string;
};

export type ExamPhoto = {
  source: ImageSourcePropType;
  width: number;
  height: number;
  author: string;
  license: string;
  sourceUrl: string;
};

export const EXAM_PHOTO_SOURCES: Record<string, ImageSourcePropType> = {
  'es-a2-1.jpg': require('../assets/exam-photos/es-a2-1.jpg'),
  'es-a2-2.jpg': require('../assets/exam-photos/es-a2-2.jpg'),
  'es-b1-1.jpg': require('../assets/exam-photos/es-b1-1.jpg'),
  'es-b1-2.jpg': require('../assets/exam-photos/es-b1-2.jpg'),
  'es-b2-1.jpg': require('../assets/exam-photos/es-b2-1.jpg'),
  'es-b2-2.jpg': require('../assets/exam-photos/es-b2-2.jpg'),
  'en-a1-1.jpg': require('../assets/exam-photos/en-a1-1.jpg'),
  'en-a1-2.jpg': require('../assets/exam-photos/en-a1-2.jpg'),
  'en-b1-1.jpg': require('../assets/exam-photos/en-b1-1.jpg'),
  'en-b1-2.jpg': require('../assets/exam-photos/en-b1-2.jpg'),
  'en-b2-1.jpg': require('../assets/exam-photos/en-b2-1.jpg'),
  'en-b2-2.jpg': require('../assets/exam-photos/en-b2-2.jpg'),
  'en-c1-1.jpg': require('../assets/exam-photos/en-c1-1.jpg'),
  'en-c1-2.jpg': require('../assets/exam-photos/en-c1-2.jpg'),
  'en-c1-3.jpg': require('../assets/exam-photos/en-c1-3.jpg'),
};

export const EXAM_PHOTO_META = photosJson as Record<string, ExamPhotoMeta>;

// The photo of a speaking-task photo key (e.g. `en-b2-1`), or undefined if there is none.
export function examPhoto(key: string): ExamPhoto | undefined {
  const meta = EXAM_PHOTO_META[key];
  const source = meta && EXAM_PHOTO_SOURCES[meta.file];
  if (!meta || !source) return undefined;
  return { source, width: meta.width, height: meta.height, author: meta.author, license: meta.license, sourceUrl: meta.sourceUrl };
}
