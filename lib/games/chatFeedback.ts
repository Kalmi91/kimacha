// FB200, Kálmán 2026-09-09 (game:chat): „hát itt nincs semmi gond, ha nem azt
// nyomom amit kell". A chat eddig néma volt a gyenge válaszra: a checklist csak a
// beszélgetés VÉGÉN mutatta meg, mit hagyott ki, addigra viszont már nem tudta,
// melyik koppintásnál veszett el.
//
// A K14-es döntés („a rossz válasz nem büntet") megmarad: nincs pontlevonás és
// nincs visszalépés, a beszélgetés ugyanúgy megy tovább azon az ágon, amit
// választott. Csak kap egy azonnali jegyzetet arról, mi lett volna a jobb mondat
// és miért, tehát a játék tanít is, nem csak elágazik.

import type { ChatChecklistItem, ChatNodeOption } from '@/lib/games/content';

export interface MissedHint {
  /** A jobb válasz szövege a tanult nyelven. */
  better: string;
  /** Miért az a jobb, a tartalom nyelvén (üres, ha nincs checklist-indok). */
  why: string;
}

function textOf(option: ChatNodeOption, lang: string): string {
  const own = option[lang];
  if (typeof own === 'string') return own;
  const first = Object.entries(option).find(
    ([key, value]) => typeof value === 'string' && key !== 'next' && key !== 'checklist'
  );
  return (first?.[1] as string) ?? '';
}

function whyOf(item: ChatChecklistItem | undefined, lang: string): string {
  if (!item) return '';
  return item.why[lang] ?? item.why.en ?? Object.values(item.why)[0] ?? '';
}

/** Számít-e jó lépésnek: checklist-tétel vagy kézzel `good`-nak jelölt opció. */
function isGood(option: ChatNodeOption): boolean {
  return !!option.checklist || option.good === true;
}

/**
 * A csomópont opciói közül a legjobb KIHAGYOTT válasz, ha a választott opció
 * gyengébb volt nála. `null`, ha jól választott, vagy ha ezen a csomóponton
 * nem is volt jobb lehetőség (akkor nincs mit tanítani).
 *
 * A már megszerzett checklist-tételek nem számítanak kihagyásnak: ha egyszer
 * kimondta a lényeget, a második megfogalmazás elhagyása nem hiba.
 */
export function missedHint(
  options: ChatNodeOption[],
  pickedIndex: number,
  achieved: ReadonlySet<string>,
  checklist: ChatChecklistItem[],
  learnedLang: string,
  contentLang: string
): MissedHint | null {
  const picked = options[pickedIndex];
  if (!picked || isGood(picked)) return null;

  const better =
    options.find((opt) => opt.checklist && !achieved.has(opt.checklist)) ??
    options.find((opt) => opt.good === true);
  if (!better) return null;

  const text = textOf(better, learnedLang);
  if (!text) return null;

  const item = better.checklist ? checklist.find((c) => c.id === better.checklist) : undefined;
  return { better: text, why: whyOf(item, contentLang) };
}
