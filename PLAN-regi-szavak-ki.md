# PLAN-regi-szavak-ki: a nem pénzzé tehető régi szavak kidobása, a nyelvtan és a Kurzus fül átáll a words-open-ra

Ág: `refactor/drop-legacy-words`, worktree: `C:\AI\kimacha-szavak-wt-drop-legacy` (node_modules = junction a fő klónra, npm install/ci tilos).
Indult: 2026-10-01 13:49. Becslés: kb. 5 óra, 8/10; ágakra bontva, párhuzamos alagentekkel kb. 3 óra (Kálmán 13:50: „a felépítés a plant csinálsz aminek a taskjait subagentek építig külön ágaok”).

**Ágak:** A = `refactor/drop-spelling` (3. lépés, worktree `C:\AI\kimacha-szavak-wt-drop-spelling`); B = `refactor/drop-games` (4. lépés, worktree `C:\AI\kimacha-szavak-wt-drop-games`); C = ez az ág (2., 5., 6. lépés, a 7. csak az A és a B mergelése után, rebase-zel). Mindegyik ág saját PR. Ezt a fájlt csak a C ág (és az orkesztrátor) írja; az A és B ág nem nyúl hozzá. Előzmény: `PLAN-tobbjelentes.md` 6. lépés (leltár) és PR #66.

## Kálmán döntései (szó szerint, 2026-10-01)

- „okés akkor menjenek a szavak most, az a lényeg, hogy az eladható felé haladjunk"
- „játékok már nincs enek ez nem számít helyesírás haszontalan funkció azt vedd ki. nyelvtan fontos az jó de a válasz a átállnak" (a = a régi szavakra épülő részek átállnak a 600 words-open szóra)
- Korábban: a PCIC nem adható el (Cervantes jogi oldala, 2026-09-25), a régi spanyol szólista a SUBTLEX-ESP-ből válogatott (`scripts/filter_words.js`), az angol track (`data/words/en/**`) MARAD (AI + CEFR-J, forrásmegjelöléssel).

## Lépések

- [x] 1. (13:49) Ág + worktree + ez a terv → kész, ha: a worktree áll
- [~] 2. (C ág) Pontos leltár (csak olvasás) → kész, ha: a Leltár szakasz kitöltve: minden fogyasztó fájl:sor, mit használ, és mi a csere (words-open / angol track / törlés)
- [~] 3. (A ág) Helyesírás-gyakorló ki: `app/spelling.tsx`, a Beállítások sora, a tanulókártya „✎ Add to spelling" gombja, a hozzá tartozó lib/db/i18n/teszt → kész, ha: typecheck:ci, lint, test:ci zöld
- [ ] 4. (B ág, az A után indul) Játékok kódja ki (a UI-ból már nem elérhető): `lib/games/**`, `components/games/**`, ami csak a játékoké → kész, ha: kapu zöld; ami a nyelvtan is használ (pl. GlossText), az átáll, nem törlődik
- [ ] 5. (C ág) Nyelvtan + Kurzus fül + Beállítások + `lib/mixedSpeech` + `lib/pcicPos` átállítása a words-open spanyol szavaira → kész, ha: kapu zöld, és a Naplóban a lezáródó (szó hiányában nem nyitható) leckék listája
- [ ] 6. (C ág) PCIC ki: `data/pcic/**`, az `ES_WORD_SOURCE` kapcsoló és a 'legacy' ág, a PCIC-hez kötött jegyzet/jelentés/mondat-fájlok és -kód, `scripts/pcic-*.mjs` → kész, ha: kapu zöld
- [ ] 7. (C ág, az A és B merge után) Régi spanyol szólista ki: `data/words/{a0,a1,a2,b1,b2,c1,c2}.json`, `data/words/hu/**`, a csak ezeket kiszolgáló `data/words.ts`-részek és scriptek, CI-hivatkozások, a FrequencyWords/SUBTLEX forrásmegjelölés → kész, ha: kapu zöld, és `git grep` nem talál hivatkozást a törölt fájlokra
- [ ] 8. Web-build füstteszt néma felolvasással: tanulófül mindkét irányban, egy nyelvtanlecke megnyílik, Kurzus fül, Beállítások → kész, ha: nincs hiba a konzolon, képernyőkép a Naplóban leírva
- [ ] 9. Kapu + push + PR → kész, ha: PR nyitva; merge Kálmán szavára

## Spec (a subagent ezt hajtja végre 1:1)

- **Ami marad:** `data/words-open/**` (angol→spanyol szópakli, a spanyol szavak forrása mostantól mindenhol), `data/words/en/**` (spanyol→angol pakli és az angol nyelvtan táblái), a nyelvtan-fül, a Kurzus fül, a tanulófül, a hibáim-pakli (`app/mistakes/**`).
- **Csere-szabály:** ahol a kód a régi spanyol szólistából keresett szót (szint, szófaj, fordítás, felolvasás, glossza, nyelvtani szókapu), ott a words-open kártyáiból keres: `es` (perjeles alaknál az első alternatíva a fő alak, de a keresés minden alternatívát ismerjen), `lemma`, `level`, `pos`, `en`, `hu`, `de`, mondatok. A words-open `level`-je A1-B2; ahol a régi kód A0-t vagy C1/C2-t várt, ott az A1 az alsó és a B2 a felső határ.
- **Szókapu a nyelvtanban** (`lib/grammar/tenseGate.ts` és társai): a szabály („soha nincs mondat ismeretlen szóval") marad; ha egy lecke mondatához szükséges szó nincs a words-openben, a lecke lezárva marad (nem dobunk hibát, nem engedjük ismeretlen szóval). A lezáródó leckék listája a Naplóba.
- **Tanulási haladás:** a törölt tételek (régi `w<id>`, PCIC-id-k) haladás-sorai az adatbázisban maradhatnak, de az app nem omolhat össze tőlük, és a statisztika/Kurzus számlálói nem számolhatják őket.
- **Tesztek:** a törölt funkciók tesztjei törlődnek; a megmaradó funkciók tesztjei az új forráshoz igazodnak (a meglévő elvárásokat ne gyengítsd, csak a darabszámokat és a szavakat).
- **Commit:** lépésenként egy (vagy adagonként) Conventional Commit, nevesített `git add`, AI-marker nélkül; push csak a 9. lépésben.
- Ha egy fogyasztót nem lehet a fenti szabállyal átállítani, vagy egy törlés látható funkciót vinne el a fent felsoroltakon kívül: állj meg, írd a Naplóba `[!]` jellel, és jelents.

## Leltár

(a 2. lépés tölti ki)

## Napló

- 13:49 ág + worktree kész (`refactor/drop-legacy-words` origin/main 0adbeae-ről).
