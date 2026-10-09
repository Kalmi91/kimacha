import { Platform } from 'react-native';

import { isGrammarPaletteId, type GrammarPaletteId } from '@/constants/GrammarPalettes';
import { isSkinSelection, parseSkinMix, type SkinMix, type SkinMode, type SkinSelection } from '@/constants/Skins';
import type { DB } from '@/lib/database';

// PLAN-temak (F agent): web teszt-horgok az automata UI-átfedés teszthez (scripts/ui-overlap.mjs).
// Csak Platform.OS === 'web' alatt élnek; natívon a getWebTestParams() null, semmi nem változik.
// A window.location.search paraméterei:
//   skin=<SkinId|mix>   a választott téma (mix mellé: mix=<colors>.<font>.<shape>.<decor>)
//   mode=light|dark     a Beállítások Auto / Light / Dark felülírása
//   pal=<al-paletta>    a Neo-brutál al-paletta (brand|electric|lime|cyan|orange|classic)
//   onboarded=1         az onboarding kész-állapotba kerül alapadatokkal (en→es, A1)
type WebTestParams = {
  skin?: SkinSelection;
  mix?: SkinMix;
  mode?: SkinMode;
  pal?: GrammarPaletteId;
  onboarded?: boolean;
};

// Érvénytelen / ismeretlen paraméter kimarad; ha egy sem érvényes, null.
export function parseWebTestParams(search: string): WebTestParams | null {
  const q = new URLSearchParams(search);
  const out: WebTestParams = {};
  const skin = q.get('skin');
  if (isSkinSelection(skin)) out.skin = skin;
  const mixRaw = q.get('mix');
  if (mixRaw) {
    const [colors, font, shape, decor] = mixRaw.split('.');
    const mix = parseSkinMix(JSON.stringify({ colors, font, shape, decor }));
    if (mix) out.mix = mix;
  }
  const mode = q.get('mode');
  if (mode === 'light' || mode === 'dark') out.mode = mode;
  const pal = q.get('pal');
  if (isGrammarPaletteId(pal)) out.pal = pal;
  if (q.get('onboarded') === '1') out.onboarded = true;
  return Object.keys(out).length > 0 ? out : null;
}

export function getWebTestParams(): WebTestParams | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  return parseWebTestParams(window.location.search);
}

// A db-be írja a paramétereket, még a ThemeProvider mountja ELŐTT (app/_layout.tsx check()).
export async function applyWebTestParams(db: DB, p: WebTestParams): Promise<void> {
  if (p.onboarded) {
    await db.setOnboarding('en', 'es');
    await db.setPcicLevel('A1');
  }
  if (p.pal) await db.setGrammarPalette(p.pal);
  if (p.mix) await db.setSkinMix(p.mix);
  if (p.skin) await db.setSkin(p.skin);
}
