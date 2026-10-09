import { Platform } from 'react-native';

import { isGrammarPaletteId, type GrammarPaletteId } from '@/constants/GrammarPalettes';
import { isSkinSelection, parseSkinMix, type SkinMix, type SkinMode, type SkinSelection } from '@/constants/Skins';
import type { DB } from '@/lib/database';

// Web test hooks for the automated UI-overlap test (scripts/ui-overlap.mjs).
// They only live under Platform.OS === 'web'; on native getWebTestParams() is null, nothing changes.
// Parameters of window.location.search:
//   skin=<SkinId|mix>   the chosen theme (with mix: mix=<colors>.<font>.<shape>.<decor>)
//   mode=light|dark     overrides the Settings Auto / Light / Dark
//   pal=<sub-palette>   the Neo-brutalist sub-palette (brand|electric|lime|cyan|orange|classic)
//   onboarded=1         puts onboarding into the done state with basic data (en→es, A1)
type WebTestParams = {
  skin?: SkinSelection;
  mix?: SkinMix;
  mode?: SkinMode;
  pal?: GrammarPaletteId;
  onboarded?: boolean;
};

// An invalid / unknown parameter is left out; if none is valid, null.
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

// Writes the parameters into the db, BEFORE the ThemeProvider mounts (check() in app/_layout.tsx).
export async function applyWebTestParams(db: DB, p: WebTestParams): Promise<void> {
  if (p.onboarded) {
    await db.setOnboarding('en', 'es');
    await db.setPcicLevel('A1');
  }
  if (p.pal) await db.setGrammarPalette(p.pal);
  if (p.mix) await db.setSkinMix(p.mix);
  if (p.skin) await db.setSkin(p.skin);
}
