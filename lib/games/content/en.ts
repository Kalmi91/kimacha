// Az angol sáv játék-tartalmának regisztrációja (es→en irány: spanyol anyanyelvű
// tanul angolt). Ugyanaz a köteg-minta, mint a `es.ts`: a `content.ts` csak
// összefűzi. Új angol lecke = egy `data/games/grammar/en/<id>.json` + egy import
// és egy sor a `grammarTopics`-ban ide. Egyelőre nincs megírt lecke, a Nyelvtan
// fül a témákat „próximamente” jelvénnyel mutatja.

import type { LanguageContentBundle } from '../content';

export const enContent: LanguageContentBundle = {
  grammarTopics: [],
};
