import type { SkinDecor } from '@/components/skins/types';

// Senior: nincs rajzolt dísz. Az elrendezés a gombokban van: a push-gombok egymás
// alatt, teljes szélességben, ikonnal + szöveggel, min. 48 magasan (buttonVariant 'stacked', a
// BrutalBox / BrutalButton olvassa), és a hang-gomb mellett szöveges "Felolvas" felirat
// (speakLabel, a SkinSpeakLabel rajzolja).
export const seniorDecor: SkinDecor = {
  buttonVariant: 'stacked',
  speakLabel: true,
};
