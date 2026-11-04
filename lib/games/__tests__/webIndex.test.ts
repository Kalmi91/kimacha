// The web twins (`<x>.index.web.ts`, generated next to every `<x>.index.ts`) must list the same lessons in the same order and
// read, from the packs of webPacks.generated.ts, exactly what the bundled registry requires. Metro picks the twins on web only;
// jest (native platform) never does, so they are required here by their full name.
import { WEB_PACKS } from '../content/webPacks.generated';
import { prefetchContentPacks } from '../content/webPacks';

const LANES = ['es', 'en', 'hu', 'de'] as const;
const SIDECARS = [['es', 'hu'], ['es', 'de'], ['en', 'hu'], ['en', 'de'], ['hu', 'de'], ['de', 'hu']] as const;

const registry = (lang: string, file: string, module: string) => require(`../content/${file}${module}`)[`${lang.toUpperCase()}_GRAMMAR_INDEX`];
const sidecars = (lang: string, code: string, module: string) => require(`../content/${lang}.${code}.index${module}`)[`${lang.toUpperCase()}_GRAMMAR_${code.toUpperCase()}`];

// what the build script puts into each pack, taken from the bundled registries
function packsFromBundle(): Record<string, Record<string, unknown>> {
  const packs: Record<string, Record<string, unknown>> = {};
  for (const lang of LANES) {
    packs[`grammar-${lang}`] = Object.fromEntries(
      (registry(lang, `${lang}.index`, '') as { id: string; load: () => unknown }[]).map((e) => [e.id, e.load()]),
    );
  }
  for (const [lang, code] of SIDECARS) {
    const map = sidecars(lang, code, '') as Record<string, () => unknown>;
    packs[`grammar-${code}-${lang}`] = Object.fromEntries(Object.entries(map).map(([id, load]) => [id, load()]));
  }
  return packs;
}

describe('web content twins', () => {
  it('webPacks.generated.ts names exactly the packs the twins read', () => {
    const expected = [...LANES.map((l) => `grammar-${l}`), ...SIDECARS.map(([l, c]) => `grammar-${c}-${l}`)];
    expect(WEB_PACKS.map((p) => p.name).sort()).toEqual(expected.sort());
  });

  it.each(LANES)('%s: same lesson ids in the same order as the bundled registry', (lang) => {
    const ids = (index: { id: string }[]) => index.map((e) => e.id);
    expect(ids(registry(lang, `${lang}.index`, '.web'))).toEqual(ids(registry(lang, `${lang}.index`, '')));
  });

  it.each(SIDECARS)('%s lane, %s sidecars: same ids as the bundled sidecar map', (lang, code) => {
    expect(Object.keys(sidecars(lang, code, '.web'))).toEqual(Object.keys(sidecars(lang, code, '')));
  });

  it('with the packs loaded, every twin entry returns what the bundled entry returns', async () => {
    const packs = packsFromBundle();
    (globalThis as { fetch?: unknown }).fetch = async (url: string) => ({
      ok: true,
      status: 200,
      json: async () => packs[url.replace('/content/', '').replace('.json', '')],
    });
    await prefetchContentPacks();
    for (const lang of LANES) {
      const web = registry(lang, `${lang}.index`, '.web') as { id: string; load: () => unknown }[];
      const bundled = registry(lang, `${lang}.index`, '') as { id: string; load: () => unknown }[];
      web.forEach((e, i) => expect(e.load()).toEqual(bundled[i].load()));
    }
    for (const [lang, code] of SIDECARS) {
      const web = sidecars(lang, code, '.web') as Record<string, () => unknown>;
      const bundled = sidecars(lang, code, '') as Record<string, () => unknown>;
      for (const id of Object.keys(bundled)) expect(web[id]()).toEqual(bundled[id]());
    }
  });
});
