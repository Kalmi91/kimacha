import type { SkinDecor } from '@/components/skins/types';

// Senior: no drawn decor. The layout is in the buttons: push buttons stacked
// vertically, full width, with icon + text, at least 48 high (buttonVariant 'stacked', read by
// BrutalBox / BrutalButton), and next to the sound button a text label
// "Read aloud" (speakLabel, drawn by SkinSpeakLabel).
export const seniorDecor: SkinDecor = {
  buttonVariant: 'stacked',
  speakLabel: true,
};
