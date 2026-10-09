// a data/words-open/images.json kapuja. Minden bejegyzés egy létező
// `o<order>` kártya, van szerzője + licence + Commons forrás-URL-je, a kép-fájl létezik, a mérete rendben,
// és a data/wordImages.ts require-térképe pont ezeket a fájlokat tudja.
import fs from 'node:fs';
import path from 'node:path';
import images from '../words-open/images.json';
import { IMAGE_META, IMAGE_SOURCES, wordImageFor } from '../wordImages';
import { findPcicItem, setPcicTarget } from '../pcic';

const ROOT = path.resolve(__dirname, '..', '..');
const entries = Object.entries(images as Record<string, Record<string, unknown>>);
const MAX_BYTES = 60 * 1024;

describe('data/words-open/images.json kártya-képek', () => {
  afterEach(() => setPcicTarget('es'));

  it('van legalább egy kép', () => {
    expect(entries.length).toBeGreaterThan(0);
  });

  it('minden bejegyzésnek van szerzője, licence és Wikimedia Commons forrás-URL-je', () => {
    const bad: string[] = [];
    for (const [id, e] of entries) {
      for (const k of ['author', 'license', 'sourceUrl', 'file'] as const) {
        if (typeof e[k] !== 'string' || (e[k] as string).trim() === '') bad.push(`${id}: hiányzik a ${k}`);
      }
      if (typeof e.sourceUrl === 'string' && !e.sourceUrl.startsWith('https://commons.wikimedia.org/wiki/File:')) {
        bad.push(`${id}: a sourceUrl nem Commons fájl-oldal`);
      }
      if (!Number.isInteger(e.width) || !Number.isInteger(e.height)) bad.push(`${id}: width/height nem egész`);
    }
    expect(bad).toEqual([]);
  });

  it('a kép-fájl létezik, legfeljebb 60 KB, és a require-térkép ismeri', () => {
    const bad: string[] = [];
    for (const [id, e] of entries) {
      const file = path.join(ROOT, 'assets', 'word-images', String(e.file));
      if (!fs.existsSync(file)) bad.push(`${id}: nincs fájl (${String(e.file)})`);
      else if (fs.statSync(file).size > MAX_BYTES) bad.push(`${id}: ${fs.statSync(file).size} bájt, több mint 60 KB`);
      if (!IMAGE_SOURCES[String(e.file)]) bad.push(`${id}: a wordImages.ts require-térképe nem ismeri: ${String(e.file)}`);
    }
    expect(bad).toEqual([]);
  });

  it('a require-térképben nincs árva fájl', () => {
    const used = new Set(entries.map(([, e]) => String(e.file)));
    expect(Object.keys(IMAGE_SOURCES).filter((f) => !used.has(f))).toEqual([]);
  });

  it('minden kulcs egy létező o<order> kártya, és a PcicItem.image a képet hozza', () => {
    setPcicTarget('es');
    const bad: string[] = [];
    for (const [id] of entries) {
      const item = /^o\d+$/.test(id) ? findPcicItem(id) : undefined;
      if (!item) bad.push(`${id}: nincs ilyen kártya`);
      else if (!item.image || item.image.author !== IMAGE_META[id].author) bad.push(`${id}: a kártya image-e nem egyezik`);
    }
    expect(bad).toEqual([]);
  });

  it('a cropped jelző az images.json modified mezőjéből jön, és van vágott és nem vágott kép is', () => {
    setPcicTarget('es');
    const flags = entries.map(([id, e]) => [id, wordImageFor(id)?.cropped, /cropped/i.test(String(e.modified ?? ''))] as const);
    expect(flags.filter(([, got, want]) => got !== want).map(([id]) => id)).toEqual([]);
    expect(flags.some(([, c]) => c)).toBe(true);
    expect(flags.some(([, c]) => !c)).toBe(true);
  });

  it('a képtelen kártyán nincs image', () => {
    setPcicTarget('es');
    expect(findPcicItem('o1')?.image).toBeUndefined();
    expect(wordImageFor('o1')).toBeUndefined();
  });
});
