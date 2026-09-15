// PROMPT-POLICY 6 + 7: két apró jelző a tanulókártyán, mindkettő a prompt
// mellett, minden lapon (nem csak megfejtés után), mert a szó tulajdonsága,
// nem a válaszé.
//   - flag: 🇲🇽, ha a szó csak Mexikóban él (word.region === 'mx'). Mező
//     nélkül = spanyolországi, nincs zászló.
//   - chip: "⚠︎ ..." címke, ha a szó többese rendhagyó (word.plural ===
//     'irregular', pl. el lápiz -> los lápices), vagy a szó csak többesben
//     él (word.plural === 'only', pl. las gafas).

import type { WordEntry } from '@/data/words';

export interface CardMarkerWord {
  region?: WordEntry['region'];
  plural?: WordEntry['plural'];
}

export interface CardMarkerStrings {
  card: {
    regionMx: string;
    irregularPlural: string;
    pluralOnly: string;
  };
}

export interface CardMarkers {
  flag?: string;
  flagLabel?: string;
  chip?: string;
}

export function cardMarkers(word: CardMarkerWord, s: CardMarkerStrings): CardMarkers {
  const markers: CardMarkers = {};

  if (word.region === 'mx') {
    markers.flag = '🇲🇽';
    markers.flagLabel = s.card.regionMx;
  }

  if (word.plural === 'irregular') {
    markers.chip = `⚠︎ ${s.card.irregularPlural}`;
  } else if (word.plural === 'only') {
    markers.chip = `⚠︎ ${s.card.pluralOnly}`;
  }

  return markers;
}
