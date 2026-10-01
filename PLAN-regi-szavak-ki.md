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
- [x] 2. (14:00) (C ág) Pontos leltár (csak olvasás) → kész, ha: a Leltár szakasz kitöltve: minden fogyasztó fájl:sor, mit használ, és mi a csere (words-open / angol track / törlés)
- [x] 3. (13:56, A ág, PR #68) Helyesírás-gyakorló ki: `app/spelling.tsx`, a Beállítások sora, a tanulókártya „✎ Add to spelling" gombja, a hozzá tartozó lib/db/i18n/teszt → kész, ha: typecheck:ci, lint, test:ci zöld
- [x] 4. (14:00, B ág: csak a halott testing/reanimatedMock.tsx ment ki, a lib/games a nyelvtan motorja, marad; a commit átvéve ide, B ág törölve) Játékok kódja ki (a UI-ból már nem elérhető): `lib/games/**`, `components/games/**`, ami csak a játékoké → kész, ha: kapu zöld; ami a nyelvtan is használ (pl. GlossText), az átáll, nem törlődik
- [x] 5. (14:11) (C ág) Nyelvtan + Kurzus fül + Beállítások + `lib/mixedSpeech` + `lib/pcicPos` átállítása a words-open spanyol szavaira → kész, ha: kapu zöld, és a Naplóban a lezáródó (szó hiányában nem nyitható) leckék listája
- [x] 6. (14:24) (C ág) PCIC ki: `data/pcic/**`, az `ES_WORD_SOURCE` kapcsoló és a 'legacy' ág, a PCIC-hez kötött jegyzet/jelentés/mondat-fájlok és -kód, `scripts/pcic-*.mjs` → kész, ha: kapu zöld
- [!] 7. (14:32, a kód kész, de a lessonQa kapu piros, lásd Napló) (C ág) Régi spanyol szólista ki: `data/words/{a0,a1,a2,b1,b2,c1,c2}.json`, `data/words/hu/**`, a csak ezeket kiszolgáló `data/words.ts`-részek és scriptek, CI-hivatkozások, a FrequencyWords/SUBTLEX forrásmegjelölés → kész, ha: kapu zöld, és `git grep` nem talál hivatkozást a törölt fájlokra
- [~] 7b. A nyelvtanleckék hiányzó szavai a words-openbe (Kálmán 14:36: „a, mehet”, a bővítés első adagja, SZAVAK.md SZ9) → kész, ha: `node scripts/words-open-check.mjs` ZÖLD, `lib/__tests__/lessonQa.test.ts` zöld (0 P1), typecheck:ci, lint, test:ci zöld
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

### 7b. lépés: a leckék szavai a words-openbe

- **Mi kell:** a 79 spanyol nyelvtan-lecke (`data/games/grammar/es/*.json`) minden olyan szava, amely a lemma-index (ragozott alak → words-open lemma, 36ed598) után sincs a words-openben (a 14:32-es mérés: 634 különböző szó). Először script listázza őket: szó, a feloldott lemma (igénél főnévi igenév, névszónál hímnem egyes szám), a legalacsonyabb lecke-szint, ahol előfordul, előfordulásszám. Kiszűrendő, ami nem szókártya: tulajdonnév, számjegy, a lecke nyelvtani címkéje. Ami csak ragozott alakja egy már meglévő lemmának, az nem új kártya, hanem az index hiánya (a ragozó motor javítása vagy a lemma-index bővítése).
- **Új kártya:** words-open séma (13 kulcs, opcionális `hint_en`), `order` 602-től folyamatosan, `level` = a legalacsonyabb lecke-szint, ahol a szó kell (A1-B2; ha a lecke C1-es, B2). Minden mező kitöltve (hu, en, de, négy mondat, `sentence_lemmas`), a mondat csak már tanult szóból (R4: a kártya szintjénél nem magasabb szintű kártyák), mexikói norma (S4), az SZ8 szabályai (azonos jelentés = ` / `, más jelentés = külön kártya + `hint_en`). Forrás: az AI saját tudása, külső szólista nem (licenc-tisztaság).
- **wordIds:** a leckék transform-`wordIds` mezőiben a régi szó-id-ket a words-open id-re (order) kell cserélni, script végzi, egyezés a lemmán át; ami nem oldható fel, az a Naplóba.
- **Adagok:** szintenként, kb. 150 kártya adagonként; adag után kapu (`words-open-check`) és commit (`feat(words): a nyelvtanleckék szavai a words-openben, N. adag`), a Naplóba darabszám + 10 véletlen új kártya (en → es, mondat).
- **Nem változik:** a meglévő 1-601 kártya, a leckék szövege (csak a `wordIds`).

## Leltár

Jelmagyarázat: csere = `words-open` (a spanyol szavak forrása), `angol track` (`data/words/en/**`, marad), `törlés (N. lépés)`, `marad` (nem szólista-keresés: típus, konstans vagy tiszta függvény). Keresés: `git grep` a `data/words`, `words.ts`, `data/pcic`, `pcicCorpus` mintákra (futásidejű kód, teszt, script, CI/doksi). Állás: 2026-10-01, `origin/main` 0adbeae. A régi szólista 4047 kártya, a words-open 601 (`order` 1-601, A1-B2, mező: order, level, pos, lemma, es, hu, en, de, sentence_*, sentence_lemmas, hint_en; nincs `id`, `gender`, `topic`).

### A) Régi spanyol szólista: `data/words/{a0..c2}.json` + `data/words.ts` segédek

Futásidejű kód:
- data/words.ts:53-61, a 7 JSON importja és a `words` tömb, csere: törlés (7. lépés), a segédek közben words-openre állnak (5. lépés)
- data/words.ts:69 `getWordsForLevel`, szint szerinti lista (hívói: games/content.ts, pcic.ts legacy ág, tesztek), csere: words-open (5. lépés), a régi törlés (7. lépés)
- data/words.ts:75 `findWordById`, id szerinti keresés (egyetlen hívó: app/spelling.tsx), csere: törlés (3. lépés, A ág, a hívóval; a függvény 7. lépés)
- data/words.ts:82,88 `getWordsForTopic`, `getWordTopic`, nincs nem-teszt hívó, csere: törlés (7. lépés)
- data/words.ts:108 `genderOf`, nincs nem-teszt hívó, csere: törlés (7. lépés)
- data/words.ts:137,180 `allWordsFor` + `findWordByText`, szöveg szerinti keresés `es/en/hu/de` mezőn (hívói: lib/games/gloss.ts, lib/mixedSpeech.ts), csere: words-open (5. lépés)
- data/words.ts:1-3,31 `Level`, `LEVELS`, `WordEntry`; :133 `normalizeWordToken`, típus/konstans/tiszta függvény, csere: marad
- data/pcic.ts:11,154-159, `getWordsForLevel` a `ES_WORD_SOURCE === 'legacy'` ágban (w<id> tételek), csere: törlés (6. lépés)
- data/pcic.ts:11,88,96,178,191-193, `WordEntry` típus az es→en angol trackhez (`data/words/en`), csere: angol track (marad)
- app/spelling.tsx:10,116, `findWordById(current.wordId)` a helyesírás-gyakorlóban, csere: törlés (3. lépés, A ág)
- lib/games/content.ts:9,25-28, `LEVELS`, `getWordsForLevel` a `cumulativeCorpusWordIds`-ben (a nyelvtan-képernyők „ismert szó" halmaza), csere: words-open (5. lépés)
- lib/games/gloss.ts:7,42, `findWordByText` a glosszához (nyelvtan-képernyők + játékok), csere: words-open (5. lépés, a `findWordByText`-en át)
- lib/grammar/tenseGate.ts:18,99,105,142, `words`: az igék főnévi alakjai az alak-térképhez, a nem-igék a homográf-szűrőhöz, csere: words-open (5. lépés)
- lib/mixedSpeech.ts:17,31, `findWordByText` a kevert nyelvű felolvasás szakaszolásához, csere: words-open (5. lépés)
- lib/pcicPos.ts:14,36,58, `words` a lemma → szófaj/nem indexhez, `WordPos`/`WordGender` típus, csere: words-open (5. lépés)
- app/(tabs)/course.tsx:10,79, `LEVELS`, `Level` (a Kurzus fül szintje), csere: marad (nincs szólista-keresés; az A0/C1/C2 szél a szint-clamp-pel)
- app/(tabs)/settings.tsx:12,100, `Level` típus, csere: marad
- app/grammar/[topic].tsx:10,157, `normalizeWordToken`, `Level`, csere: marad (a „known" halmaz a `cumulativeCorpusWordIds`-ből jön, 5. lépés)
- app/grammar/deck/[topic].tsx:13, `Level` típus, csere: marad
- components/grammar/GrammarDrill.tsx:7,1053, `normalizeWordToken`, csere: marad
- components/games/GlossText.tsx:9,90, `normalizeWordToken` (a nyelvtan is használja), csere: marad
- lib/grammar/lessonTypes.ts:13, lib/grammar/syllabus.ts:16, `Level` típus, csere: marad
- lib/grammar/tableDeck.ts:21,305,326,365, `normalizeWordToken`, `Level` (a szó-pakli már `pcicItemsForLevel`-ből, azaz words-openből épül), csere: marad
- lib/wordMerges.ts:8 (hívói: lib/db/migrations.ts:3, lib/database.web.ts:4), régi szó-id → id egyesítés a DB-migrációban, nem olvassa a korpuszt, csere: marad (régi haladás-sorok migrációja)

Tesztek:
- lib/__tests__/corpusIntegrity.test.ts:9,19-30,84-96, `words`, `getWordsForLevel`, `LEVELS`, WORD_MERGES-ellenőrzés a régi id-kra, en/hu JSON-olvasás, csere: a spanyol és hu részek és a WORD_MERGES-esetek törlése (7. lépés), az en-sáv esetei maradnak
- lib/__tests__/germanGender.test.ts:7,9, `words`, `genderOf` a régi kártyák német névelőjén, csere: törlés (7. lépés)
- lib/__tests__/wordPos.test.ts:14,22-35, `words` pos/gender-annotáció (A0..C1) + en/hu JSON-ok, csere: spanyol és hu rész törlése (7. lépés), en-sáv marad
- lib/__tests__/svCorpus.test.ts:15,17, `LEVELS`, `words` az sv-sáv id-ütközéséhez (a `data/words/sv` nincs a repóban), csere: a régi korpuszra hivatkozó rész törlése (7. lépés)
- lib/__tests__/wordLookup.test.ts:1, `words`, `findWordById`, `findWordByText`, `getWordsForLevel`, csere: `findWordByText` esetek words-openre (5. lépés), `findWordById`/`getWordsForLevel` esetek törlése (3./7. lépés)
- lib/__tests__/gloss.test.ts:1, `getWordsForLevel` a `resolveGloss`/`buildGlossMap` teszthez, csere: words-open (5. lépés)
- lib/__tests__/languages.test.ts:2,29, `getWordsForLevel('A1', target)` nem üres, csere: words-open (5. lépés)
- lib/__tests__/mixedSpeech.test.ts:1, lib/grammar/__tests__/speakNoSpanish.test.ts:5, közvetve a `findWordByText`-en, csere: words-open szavak (5. lépés)
- lib/__tests__/pcicPos.test.ts:1, pcicPosCoverage.test.ts:5, közvetve a `words`-ön (lemma-index), csere: words-open szavak (5. lépés)
- lib/__tests__/tenseGate.test.ts:1, knownSentence.test.ts:9, sentenceCards.test.ts:2, közvetve a `words`-ön (igealak-térkép), csere: words-open igék (5. lépés)
- lib/games/**/__tests__ (conjugate, grammarChoice stb.), nem importálnak szólistát, csere: nincs teendő

Scriptek (nem futnak az appban, a 7. lépés dönt):
- scripts/annotate-pos.mjs:24-29, a 6 régi JSON (pos/gender annotáció), csere: törlés (7. lépés)
- scripts/append_level_words.mjs:33, append_words.py:46, generate_words.py:128, generate_words_hybrid.py:205, validate_words.py:116, `data/words` írása/validálása, csere: törlés (7. lépés)
- scripts/audit-corpus.mjs:312-313, audit-games.mjs:266, audit-levels.mjs:27, audit-prompts.mjs:187, sentence-qa.mjs:82, sentence-specificity.mjs:46, a régi szint-JSON-ok olvasása, csere: törlés (7. lépés)
- scripts/dedupe-words.mjs:32, filter_words.js:107, freq-order.mjs:124, merge_word_batches.js:20, a régi JSON-ok építése/rendezése (filter_words: SUBTLEX-ESP-ből válogat), csere: törlés (7. lépés)
- scripts/pcic-check.mjs:134, pcic-level-fit.mjs:42, pcic-pos-gaps.mjs:24, pcic-sentences.mjs:38, a PCIC-scriptek a régi szólistát is olvassák, csere: törlés (6. lépés, a PCIC-scriptekkel)
- scripts/add-articles.js:154, add-german.js:414, a `data/words.ts` forrásszövegét írják (a JSON-szétvágás előtti egyszeri scriptek), csere: törlés (7. lépés)

Konfig/doksi:
- .gitignore:49, .easignore:33 (`data/words/backup_*/`), .github/CODEOWNERS:7,14, .github/CONTRIBUTING.md:35-37, a `data/words/` útvonalak, csere: törlés/átírás (7. lépés)
- CLAUDE.md:19-22 (repó-gyökér), docs/NORTH-STAR.md:49,63, data/LICENSE-WORDS.md, a régi szólista leírása és forrásmegjelölése (FrequencyWords/SUBTLEX), csere: átírás a words-openre (7. lépés)
- data/topics/{a0..c1}.json, data/sublevels/{a0..c1}.json, a régi szavak `topic` mezőjének témakör-listái, nincs kód-fogyasztó (a `data/topics/en`, `data/sublevels/en` a syllabusEn.ts-ben él, marad), csere: törlés (7. lépés; ez nincs a Specben, a törlés előtt Kálmán jóváhagyása kell)

### B) `data/words/hu/**` (magyar sáv)

- Nincs futásidejű kód-fogyasztó (Play-vágás 7. lépés: az app csak az en-es párt tölti).
- lib/__tests__/corpusIntegrity.test.ts:28-31,151,178, `HU_BRANCH_BY_LEVEL` (hu A0/A1), csere: törlés (7. lépés)
- lib/__tests__/wordPos.test.ts:32-35, `huAnnotated` (hu A0/A1), csere: törlés (7. lépés)
- scripts/annotate-pos.mjs:33-34, audit-corpus-hu.mjs:170, audit-prompts.mjs:195, merge-hu-batch.mjs:20,99, hu JSON írása/olvasása, csere: törlés (7. lépés)
- data/topics/hu/*.json, data/sublevels/hu/*.json, a hu sáv témakör-listái, nincs kód-fogyasztó, csere: törlés (7. lépés, Kálmán jóváhagyásával)

### C) `data/pcic/**` (PCIC-korpusz) és `data/pcicCorpus.ts`

Az app élő pakli-modulja a `data/pcic.ts` (words-open + angol track): ez NEM a `data/pcic/**`, marad; csak a legacy ága törlődik (lásd A). A `data/pcic/**` fájlokat az élő app nem tölti be (`lib/__tests__/noPcicInBundle.test.ts` őrzi).
- data/pcicCorpus.ts:14-25, a `data/pcic/{a1,a2,b1,b2}-{all,en,sentences}.json` és `a1-build.json` rejtett importja; hívói csak tesztek, csere: törlés (6. lépés)
- data/pcic.ts:3 (megjegyzés), lib/pcicSenses.ts:7, lib/pcicChains.ts:46, megjegyzések a rejtett PCIC-adatra; a kód no-op (`sensesFor` → undefined, `BUILD_BY_LEVEL` = {}), csere: megjegyzés-tisztítás (6. lépés)
- lib/pcicChains.ts, lib/pcicSenses.ts (+ hívóik app/(tabs)/index.tsx, components/learn/PcicRevealedAnswer.tsx), alvó PCIC-funkciók, nem olvasnak PCIC-adatot, csere: a 6. lépés dönt (a látható funkció nem változik, mert no-op)
- lib/__tests__/noPcicInBundle.test.ts:20,40,66, a nyers PCIC-importokat tiltó teszt, csere: törlés (6. lépés)
- lib/__tests__/pcicBrackets.test.ts:4-7, pcicChainCoverage.test.ts:7-9, pcicChains.test.ts:11,13, pcicDedupGuard.test.ts:11-12, pcicLevels.test.ts:18, pcicNotes.test.ts:11-12, pcicPlusLevel.test.ts:13,16, pcicPosCoverage.test.ts:7-10, a PCIC-json/`pcicCorpus` közvetlen olvasása, csere: törlés (6. lépés)
- data/__tests__/pcic.test.ts:12, az ÉLŐ `data/pcic.ts`-t teszteli (words-open + angol track), csere: marad (a legacy-ra hivatkozó esetek igazítva, 6. lépés)
- scripts/pcic-b1.mjs:43-44,379-380, pcic-check.mjs:26-34, pcic-dedup.mjs:52-55,188-219, pcic-level-fit.mjs:69-72,230-233, pcic-pos-gaps.mjs:71, pcic-sentences.mjs:59,81, PCIC-json olvasás/írás, csere: törlés (6. lépés)
- package.json:53-54, `pcic:b1`, `pcic:check` npm-scriptek, csere: törlés (6. lépés)
- docs/PCIC-WORKFLOW.md, docs/pcic-level-moves.md, PLAN-pcic.md, PCIC-doksik, csere: törlés/archiválás (6. lépés)
- app/(tabs)/index.tsx:241,311, components/learn/PcicRevealedAnswer.tsx:57, csak megjegyzés a `data/pcic/senses.json`, `<szint>-sentences.json` fájlokra, csere: megjegyzés-tisztítás (6. lépés)

## Napló

- 13:49 ág + worktree kész (`refactor/drop-legacy-words` origin/main 0adbeae-ről).
- 14:00 2. lépés kész: leltár kitöltve (A/B/C csoport), a kód-fogyasztó switch-lista az 5. lépéshez: games/content.ts, games/gloss.ts, tenseGate.ts, mixedSpeech.ts, pcicPos.ts; Kurzus/Beállítások/nyelvtan-képernyők csak típust/normalizeWordToken-t használnak (marad). Megállapítás: a nyelvtan-lecke szó-alapú zárolása (NY2 lockState) nem létezik a kódban (ed12c1c eltávolította), a szókapu = knownSentence + tenseGate (mondatkártya-kapu), a lezáródó leckék listája az 5. lépésnél készül.
- 14:11 5. lépés kész. Átállt a words-openre (új modul: data/openWords.ts, 601 kártya WordEntry-alakban, id = order, A0→A1, C1/C2→B2, a főnév neme a névelőből): data/words.ts `findWordByText` forrása (ezen át lib/games/gloss.ts és lib/mixedSpeech.ts), lib/games/content.ts `cumulativeCorpusWordIds`, lib/grammar/tenseGate.ts (igék és nem-igék, a perjeles alak minden alternatívája), lib/pcicPos.ts (lemma-index, a conj is). Nem kellett átírni (nincs szólista-keresés, csak Level/LEVELS/normalizeWordToken): Kurzus fül, Beállítások, app/grammar/**, components/grammar/**, lib/grammar/tableDeck.ts (a szó-pakli már a words-openből épült).
- 14:11 5. lépés, ZÁROLT LECKE: 0. Nincs szó-alapú lecke-zár a kódban (az NY2 lockState az ed12c1c-ben kikerült, a lockState.ts nincs a fán); a szókapu a knownSentence + tenseGate (mondatkártya-kapu), ami nem zár leckét. Előtte/utána script (ideiglenes jest-teszt, nem commitolva) a 79 V2-leckére: a szó-pakli (wordCellsForLesson, 8 kártya alatt nincs gomb) 0 leckében változott (34 lecke >= 8 kártya, 45 alatta, ebből 19 nulla), mert a pakli már a words-openből épült.
- 14:11 5. lépés, látható hatás: a glossza-lefedettség (a lecke táblázat-szavai közül hány oldódik fel koppintásra a korpuszból; a szerzői szószedet ezt felülírja) 43/79 leckében csökkent, mert a régi lista ragozott alakokat is tartalmazott, a words-open csak tőalakot: indefinido-10-verbos 56→7/70; indefinido-irregular 33→7/70; presente-irregular 32→7/142; marcadores-discursivos 68→51/131; numeros-hora-fecha 30→17/46; verbos-como-gustar 34→21/68; numerales-ordinales 37→24/79; sustantivo-numero 24→12/41; muy-mucho 29→17/41; clases-de-palabras 22→11/41 (a többi 33 lecke csökkenése legfeljebb 9 szó). Egyik lecke táblázata sem maradt feloldható korpusz-szó nélkül.
- 14:11 5. lépés, tenseGate: a 597 words-open példamondatból 18-nál változott a felismert igeidő (14 új felismerés, pl. vivir, escuchar, ocurrir; 4 kimaradás, ebből 3 `como`-s mondat, pl. „No como carne": a `como` kötőszóként a nem-ige szűrőbe esik, a kapu inkább enged); a 79 lecke közül 3 példamondat-halmazának igeidő-készlete változott (indefinido-irregular: indefinido+presente → indefinido; verbos-preposicion: indefinido+presente → presente; futuro-condicional-perfecto: a presente kiesett).
- 14:11 5. lépés, pcicPos: 19 words-open szónak (17 det + 2 interj: este, mi, todo, hola, gracias…) nincs chipje, mert az app Pos-készlete nem tartalmaz det/interj-et (a data/pcic.ts is így képez le); a régi lista ezekre véletlenül adott chipet (pl. pero = adj volt). Teszt-igazítások (csak szavak/darabszám): wordLookup, gloss, languages, mixedSpeech, tenseGate, pcicPos (a deber-ütközés fixture-rel, mert a words-openben nincs ütköző lemma), pcicPosCoverage (az élő words-open pakli tételein fut, a 19 det/interj kivétellel, `pos` nélkül hívva a posOf-ot); új teszt: data/__tests__/openWords.test.ts. Maradék régi-lista fogyasztó (nem az 5. lépés): data/pcic.ts legacy ág (6.), app/spelling.tsx (3., A ág), a tesztek és scriptek (7.).
- 14:12 C ág rebase az A ágra (refactor/drop-spelling, PR #68, egymásra épülő PR-ek), a B ág commitja átvéve (75b3413). Következik: glossza-lefedettség visszaállítása (ragozott alak → words-open lemma a lib/games/conjugate-tel), majd 6. és 7. lépés.
- 14:18 5. lépés javítás kész (glossza-lefedettség): a ragozott alak most a words-open lemmához oldódik (data/openWords.ts `findOpenWordByForm`, a `findWordByText` hívja csak `es` mezőre, a tő- és szuffixum-találat után): igéknél a lib/games/conjugate minden igeidő-alakja a words-open igékből (a motor által bizonytalannak tartott ige kimarad), főnév/melléknévnél többes, melléknévnél nemi alak és nemi többes (új tiszta modul: lib/esInflect.ts, a knownSentence ugyanezt használja). Szó, ami nincs a words-openben, nem kap glosszát (teszt: bailar). Lefedettség (táblázat-szavak, régi lista → words-open előtte → utána / összes, a nevező a tableWordKeys-szel újraszámolva): indefinido-10-verbos 56→7→57/70; indefinido-irregular 33→7→57/70; presente-irregular 32→7→77/142; marcadores-discursivos 68→51→74/132; numeros-hora-fecha 30→17→18/81; verbos-como-gustar 34→21→27/69; numerales-ordinales 37→24→32/92; sustantivo-numero 24→12→20/41; muy-mucho 29→17→27/42; clases-de-palabras 22→11→15/41. Összesen 1776 (régi) → 1555 (javítás előtt) → 2661 (után); a régi listához képest csökkenő leckék száma 43 → 8 (a maradék: számnevek, gustar-igék, mutató névmások, amik nincsenek a words-openben vagy nem főnév/melléknév/ige). Kapu: tsc, lint (0 hiba), test:ci (2071 zöld), words-open-check zöld, validate-en-track R11-R14 ok (az egyéb 1115 sorhiba a data/words/en id-blokkjairól szól, nem változott).
- 14:24 6. lépés kész (PCIC ki). Törölve: data/pcic/** (23 fájl, 2,4 MB), data/pcicCorpus.ts; az `ES_WORD_SOURCE` kapcsoló és a 'legacy' ág a data/pcic.ts-ből (a `getWordsForLevel` importtal együtt), a noteEn/noteHu mezők és a note_en/note_hu olvasás (az en→es words-open és az es→en data/words/en kártyákon nincs `note_en`, a ℹ️ jegyzet adat nélkül halott volt); lib/pcicNotes.ts + a ℹ️ gomb/szöveg az app/(tabs)/index.tsx-ből; lib/pcicSenses.ts (mindig undefined) + a jelentés-lista a prompt-ból és a PcicRevealedAnswer-ből; lib/pcicChains.ts (üres térkép, no-op) + a pcicIntroOrder egyszerűsítve (thinSentences marad, csoportkulcs = id); lib/pcicLevelFit.ts (csak a törölt scriptek és tesztjük használták); scripts/pcic-{b1,check,dedup,level-fit,pos-gaps,sentences}.mjs, a `pcic:b1` és `pcic:check` npm-script; docs/PCIC-WORKFLOW.md, docs/pcic-level-moves.md. Tesztek törölve: noPcicInBundle, pcicBrackets, pcicChainCoverage, pcicChains, pcicDedupGuard, pcicLevelFit, pcicNotes, pcicNotesFallback, pcicPlusLevel (describe.skip), app pcicNote; a pcicLevels.test.ts-ből a PCIC-korpuszt olvasó eset és importjai. MARADT szándékosan: lib/pcicLevelMoves.ts és lib/pcicDedupMoves.ts (a lib/db/migrations.ts régi PCIC-id → új id haladás-migrációja használja, nem adat-fogyasztó; csak a fejléc-komment módosult), a data/pcic.ts, lib/pcic{Levels,Session,Match,Pos,Stats}.ts (az élő tanulófül), PLAN-pcic.md (történet). Kapu: tsc zöld, lint 0 hiba (a 5 meglévő teszt-figyelmeztetés), test:ci 2026 zöld (132 suite), words-open-check zöld, validate-en-track R11-R14 ok.
- 14:32 7. lépés `[!]`: a törlés és az átállás kész, a kapu EGY teszten piros: lib/__tests__/lessonQa.test.ts (a scripts/audit-games.mjs-t futtatja, "0 P1" kapu). Ok: a 79 spanyol nyelvtan-lecke tartalma (data/games/grammar/es/*.json) a régi 4047 szavas listára épült; az audit-games a „tanított vagy szószedetes" szabályt és a transform item `wordIds` ellenőrzést most a words-openre (601 kártya) méri, és 3334 P1-et ad: (a) 1925 előfordulás / 634 különböző spanyol szó (78 leckében) nincs a words-openben és nincs a lecke szószedetében; (b) 1409 `wordIds references unknown card id` (10 leckében, a régi szó-id-kre mutat; az NY2 lecke-zár, ami ezeket olvasta, az ed12c1c-ben kikerült, futásidőben senki nem olvassa). Futásidőben semmi nem törik (a glossza az authored `glossary`-ből és a words-openből jön, a szókapu a knownSentence + tenseGate), csak a tartalom-ellenőrző kapu bukik. Kálmán/orkesztrátor döntése kell: (1) a 634 szó felvétele a lecke-szószedetekbe (tartalom-írás, fordítás kell), (2) az audit-games „untaught" és `wordIds` ellenőrzésének kivétele/átírása (a kapu gyengítése, ezt nem tettem meg), (3) a lecke-szókészlet szűkítése a words-openre (a leckék átírása). Megtörtént: a scripts/audit-games.mjs, sentence-qa.mjs, sentence-specificity.mjs a words-open fájlokat olvassa a régi a0..c2.json helyett; az audit-prompts.mjs es/hu sávja kikerült (az en sáv marad, a policyt a words-open-check.mjs és a corpusIntegrity en-esete őrzi).
- 14:32 7. lépés, mi ment ki: data/words/{a0,a1,a2,b1,b2,c1,c2}.json (7), data/words/hu/** (2 fájl); data/words.ts-ből a 7 import, `words`, `getWordsForLevel`, `findWordById`, `getWordsForTopic`, `getWordTopic`, `genderOf` (maradt: típusok, normalizeWordToken, findWordByText, a words-open kereső); lib/freqOrder.ts + teszt (FrequencyWords-sorrend, csak a törölt script használta); lib/__tests__/germanGender.test.ts (genderOf); 22 script/doksi a scripts/-ből: add-articles.js, add-german.js, annotate-pos.mjs, append_level_words.mjs, append_words.py, audit-corpus.mjs, audit-corpus-hu.mjs, audit-levels.mjs+md, audit-plan.mjs+md, audit-report.md, audit-report-hu.md, dedupe-words.mjs, filter_words.js, freq-order.mjs, generate_words.py, generate_words_hybrid.py, merge-hu-batch.mjs, merge_word_batches.js, validate_words.py, word-card-spec.md. Tesztek: corpusIntegrity (spanyol sáv a words-openre: egyedi id + egy-szint + névelő-egyezés maradt; a hu sáv, a WORD_MERGES-esetek, a spanyol sáv teljesség/prompt/szivárgás esetei törölve, mert a words-open más policyt követ és a words-open-check.mjs őrzi; az en-sáv esetei változatlanok), wordPos (csak az en-sáv), svCorpus és wordLookup (a régi szólistára hivatkozó rész), credits (a FrequencyWords/OpenSubtitles/CC BY-SA sorok helyett a CEFR-J marad, a hiányuk ellenőrizve). Credits: lib/i18n/en.ts+es.ts `body`, `frequencyWords*`, `openSubtitles*`, `license*` kulcsok és az app/credits.tsx sorai kivéve, a CEFR-J szöveg marad; data/LICENSE-WORDS.md átírva (words-open: AI-generált; en-sáv: AI + CEFR-J). Doksi/konfig: CLAUDE.md, docs/NORTH-STAR.md, .github/CONTRIBUTING.md, .github/CODEOWNERS (+/data/words-open/), .gitignore és .easignore `data/words/backup_*/` sora. Nem nyúltam hozzá (nem volt a Specben, Kálmán jóváhagyása kell): data/topics/{a0..c1}.json, data/sublevels/{a0..c1}.json, data/topics/hu, data/sublevels/hu; lib/wordMerges.ts és a lib/db migrációk (régi haladás-sorok); docs/TOPICS-A0-A2.md (történeti jegyzet az audit-corpus-ról). git grep (`data/words/(a0..c2).json|data/words/hu|data/pcic/|SUBTLEX|FrequencyWords`, PLAN-*.md nélkül): egyetlen találat, az app/__tests__/credits.test.tsx, ahol a teszt éppen azt állítja, hogy a FrequencyWords szöveg NINCS a képernyőn (indokolt). Kapu: tsc zöld, lint 0 hiba (5 meglévő teszt-figyelmeztetés), test:ci 1991 zöld + 1 piros (lessonQa, fent), words-open-check zöld, validate-en-track R11-R14 ok.
