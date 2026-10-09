import type { ComponentType, ReactNode } from 'react';

// the theme's decor layer. Every field is optional; whatever is missing is a no-op, and the current
// look stays unchanged. The decors are registered in components/skins/index.ts.
// `children` is always the base (decor-free) content: the decor can wrap or replace it.
export type SkinDecor = {
  // The screen's background layer (behind the content, above the background color; SkinBackdrop puts it in absolute).
  Backdrop?: ComponentType;
  // Decor around the tab screens' header (e.g. lines on both sides of the title).
  HeaderOrnament?: ComponentType<{ children: ReactNode }>;
  // The frame / decor around the Words tab's card.
  CardFrame?: ComponentType<{ children: ReactNode }>;
  // How the word is shown on the card (syllabification, drop cap, reading band ...); `word` = the raw text,
  // `lang` = the word's language (optional: konnyu only syllabifies Spanish words).
  WordRenderer?: ComponentType<{ word: string; lang?: string; children: ReactNode }>;
  // Button variant (senior: stacked, icon + text; zen: text only; retro95: first letter underlined).
  buttonVariant?: 'default' | 'stacked' | 'text' | 'bevel';
  // Senior: a text label next to the sound button ("Read aloud"); see SkinSpeakLabel.
  speakLabel?: boolean;
  // Retro95: the fill of the docked Check bar is `a` (dark blue, white text);
  // ink by default, as on Neo-brutal.
  checkFill?: 'a';
};
