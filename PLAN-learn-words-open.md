# PLAN, az új szókészlet a tanulófülön (2026-10-01)

Kálmán (2026-10-01 00:00 körül): „2a az új szavakat akarom letesztelni”, „mehet most” (éjszakai kivétel,
ő ébren dönt). Cél: a `data/words-open/` 600 kártyája (PR #59, mainben) legyen a tanulófül
(en→es pakli) forrása, hogy telefonon kipróbálhassa. A régi `data/words/**` NEM törlődik.
Ág: `feat/learn-words-open`, worktree `C:\AI\kimacha-wt-learn-open`. Becslés: 6/10, 1,5-2 óra.

- [x] 1. A tanulófül en→es paklija a `data/words-open`-ből épül → kész, ha: typecheck + az érintett tesztek zöldek (00:09)
- [x] 2. B2 a szintválasztóban → kész, ha: a B2 választható és 150 tételt ad (00:11)
- [x] 3. A régi haladás megmarad → kész, ha: teszt bizonyítja, hogy a régi `w<id>` SRS-sor nem törlődik a DB-ből (00:12)
- [x] 4. Teljes kapu → kész, ha: `npm run typecheck:ci`, `npm run lint`, `npm run test:ci` zöld (00:13)
- [x] 5. Képernyőkép (web), PR, merge Kálmán szavára → kész, ha: kép a PR előtt, PR nyitva (00:30, PR #60 mergelve)
- [~] 5a. Kártya-hibák: „1 days” → „1 day” (4 nyelv), a „DIDN'T KNOW” / „KNEW IT” gomb egyforma, tördelés és fekete folt nélkül → kész, ha: új képernyőkép, kapu zöld, PR mergelve (ág `fix/learn-card-buttons`) (kód kész, kép kész 00:32)
- [ ] 6. 4.1.7 build a Linuxon, Drive → kész, ha: `/kimacha-build` minden ellenőrzése zöld

## Spec az 1-4. lépéshez (a subagent 1:1 ezt hajtja végre)

1. `data/pcic.ts`: az `ITEMS_BY_LEVEL_ES` (en→es irány) A1/A2/B1/B2 tételei a
   `data/words-open/a1.json` … `b2.json`-ból jönnek (A1 = csak a1.json, nincs külön A0).
   - Új id-tér: `o<order>` (pl. `o12`), hogy ne ütközzön a régi `w<id>` és az es→en `e<id>` id-kkel.
   - `order` = a fájl `order` mezője; `es`, `en` a kártyából; `kind` a meglévő `kindOfEs`-sel;
     `exampleEs`/`exampleEn` = `sentence_es`/`sentence_en`, üres string esetén `undefined`;
     `pos`: a words-open pos (noun, verb, adj, adv, pron, det, prep, conj, num, interj) leképezése
     az app `Pos` típusára; ami nem képezhető le, `undefined`.
   - A régi építő (`itemsFromWords` a `data/words`-ből) MARADJON a kódban egy egysoros kapcsolóval
     (pl. `const ES_WORD_SOURCE: 'open' | 'legacy' = 'open'`), hogy egy sorral vissza lehessen állni.
     A `data/words/**` fájlokhoz nem nyúlunk.
   - Az es→en irány (`ITEMS_BY_LEVEL_EN`, `e<id>`) változatlan.
2. `PCIC_VIEW_LEVELS`-be kerüljön `B2` is (az en→es iránynál 150 tétel). Nézd meg, hol szűr a
   szintválasztó és az onboarding szintkérdése („0 tétel = nem kínáljuk fel"), és hogy a B2 rendesen
   megjelenik-e; a 4 nyelvű i18n-feliratok, ha hiányoznak, mind a 4 nyelven.
3. Régi haladás: a `dropOrphanCards` csak memóriában szűr, ez jó. Ellenőrizd, hogy a
   `lib/pcicLevels.ts` `matchesLevel`, a `lib/pcicLevelMoves.ts` és a `lib/database.ts` /
   `database.web.ts` sehol nem TÖRLI a DB-ből azokat a `pcic_cards` sorokat, amelyek id-je nincs a
   betöltött korpuszban (régi `w<id>` sorok). Ha valahol törölné, azt az `o` id-térre szűkítsd.
   Írj tesztet: egy régi `w<id>` sor a váltás után is megvan a DB-ben (web-adatbázison vagy mockon,
   ahogy a meglévő tesztek csinálják). Az `matchesLevel` id-előtag tartalékszabálya kezelje az
   `o<order>` id-ket (a szint a `levelOfItem`-ből jöjjön).
4. Tesztek: amelyik meglévő teszt a régi `data/words` konkrét szavaira épít az en→es paklinál
   (pl. `app/(tabs)/__tests__/pcicArticle.test.tsx`, `pcicBrutal.test.tsx`, `lib/__tests__/`),
   azt az új adathoz igazítsd úgy, hogy ugyanazt a viselkedést ellenőrizze; tesztet ne törölj és ne
   skippelj. A `lib/__tests__/noPcicInBundle.test.ts` maradjon zöld.

Szabályok: smallest diff, a környező kód stílusa, a magyar kommentek mintája; `lib/database.ts` és
`lib/database.web.ts` szinkronban. Conventional Commit, AI-marker NÉLKÜL (se Co-Authored-By, se
„Generated with”); `git add` nevesítve, soha `-A`. Push NEM kell, PR-t az orkesztrátor nyit.
