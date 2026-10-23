// the gate of data/exams/mock/photos.json. Every entry has an author + licence + Commons source URL, the
// licence is one of the allowed ones, the image file exists, its size is fine, and the require map of
// data/examPhotos.ts knows exactly these files.
import fs from 'node:fs';
import path from 'node:path';
import photos from '../exams/mock/photos.json';
import { EXAM_PHOTO_META, EXAM_PHOTO_SOURCES, examPhoto } from '../examPhotos';

const ROOT = path.resolve(__dirname, '..', '..');
const entries = Object.entries(photos as Record<string, Record<string, unknown>>);
const MAX_BYTES = 150 * 1024;
const ALLOWED_LICENSE = /^(CC0|Public domain|CC BY (\d\.\d)|CC BY-SA (\d\.\d))$/;
const EXPECTED_KEYS = [
  'es-a2-1', 'es-a2-2', 'es-b1-1', 'es-b1-2', 'es-b2-1', 'es-b2-2',
  'en-a1-1', 'en-a1-2', 'en-b1-1', 'en-b1-2', 'en-b2-1', 'en-b2-2', 'en-c1-1', 'en-c1-2', 'en-c1-3',
];

describe('data/exams/mock/photos.json speaking-task photos', () => {
  it('has exactly the 15 planned keys', () => {
    expect(entries.map(([key]) => key).sort()).toEqual([...EXPECTED_KEYS].sort());
  });

  it('every entry has an author, an allowed license and a Wikimedia Commons source URL', () => {
    const bad: string[] = [];
    for (const [key, e] of entries) {
      for (const k of ['author', 'license', 'sourceUrl', 'file', 'modified'] as const) {
        if (typeof e[k] !== 'string' || (e[k] as string).trim() === '') bad.push(`${key}: hiányzik a ${k}`);
      }
      if (typeof e.license === 'string' && !ALLOWED_LICENSE.test(e.license)) bad.push(`${key}: nem engedett licenc (${e.license})`);
      if (typeof e.sourceUrl === 'string' && !e.sourceUrl.startsWith('https://commons.wikimedia.org/wiki/File:')) {
        bad.push(`${key}: a sourceUrl nem Commons fájl-oldal`);
      }
      if (!Number.isInteger(e.width) || !Number.isInteger(e.height)) bad.push(`${key}: width/height nem egész`);
      if (e.width !== 640) bad.push(`${key}: a szélesség nem 640`);
      if (e.file !== `${key}.jpg`) bad.push(`${key}: a file neve nem <kulcs>.jpg`);
    }
    expect(bad).toEqual([]);
  });

  it('the image file exists, at most 150 KB, and the require map knows it', () => {
    const bad: string[] = [];
    for (const [key, e] of entries) {
      const file = path.join(ROOT, 'assets', 'exam-photos', String(e.file));
      if (!fs.existsSync(file)) bad.push(`${key}: nincs fájl (${String(e.file)})`);
      else if (fs.statSync(file).size > MAX_BYTES) bad.push(`${key}: ${fs.statSync(file).size} bájt, több mint 150 KB`);
      if (!EXAM_PHOTO_SOURCES[String(e.file)]) bad.push(`${key}: az examPhotos.ts require-térképe nem ismeri: ${String(e.file)}`);
    }
    expect(bad).toEqual([]);
  });

  it('there is no orphan file in the require map or in assets/exam-photos', () => {
    const used = new Set(entries.map(([, e]) => String(e.file)));
    expect(Object.keys(EXAM_PHOTO_SOURCES).filter((f) => !used.has(f))).toEqual([]);
    const onDisk = fs.readdirSync(path.join(ROOT, 'assets', 'exam-photos'));
    expect(onDisk.filter((f) => !used.has(f))).toEqual([]);
  });

  it('examPhoto brings the photo of a key, and undefined for an unknown key', () => {
    const bad: string[] = [];
    for (const [key] of entries) {
      const p = examPhoto(key);
      if (!p) bad.push(`${key}: az examPhoto nem ad képet`);
      else if (p.author !== EXAM_PHOTO_META[key].author || p.sourceUrl !== EXAM_PHOTO_META[key].sourceUrl) bad.push(`${key}: a kép adatai nem egyeznek`);
    }
    expect(bad).toEqual([]);
    expect(examPhoto('es-a1-1')).toBeUndefined();
    expect(examPhoto('')).toBeUndefined();
  });
});
