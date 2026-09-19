# PLAN, 2026-09-18, Feedback-kör sheet FB300-316, v4.0.15-4.0.18 telefon-teszt

Státusz: FUT, 1-8. lépés KÉSZ, 9. lépés (FB316) Sonnet-agentnél, utána 10-12 (sheet + AGENTS.md + PR + önellenőrzés).
Ág: `fix/fb-round-0918` (saját worktree `~/ai/kimacha-wt-fb0918`, ÁG-SZABÁLY szerint), PR mainbe Kálmán szavára, build külön.
Becslés (korrigált 2026-09-18, a 09-17-es menet önellenőrzése után: ott a terv 350-480K-t mondott, a tény 2,7M subagent-token volt): ~2-3M token, ~6-10 óra agent-idő. Bontás: PCIC 2-4. lépés ~200-350K (Sonnet `iro`), korpusz 6-7. lépés ~650K-1M (script + audit-őr ~150-250K, ~1000 prompt Sonnet-átnézése adagonként + alkalmazás ~500-800K), nyelvtan 8-9. lépés ~800K-1,2M (fókusz-menet az index.tsx 62K-s fájlján ~400-600K, 38 új mondat + kör-mechanika ~400-600K), doksik + sheet + PR ~100K, orkesztráció ~200K.
Sheet-sorok = FB-számok (F oszlop `státusz` a menet végén töltődik).

## Kálmán döntései (2026-09-18)

- Q1 = (c): szabály + teljes korpusz-újraglosszázás most.
- Q2 cognate: „ez már nem él az új szókészlettel, ez már nem gond" → nincs teendő, PROMPT-POLICY 11/6 lezárva.
- Q3 példamondat a zárójel helyett: „elavult, ne foglalkozz vele" → nincs UI-változás, a zárójel csak átfogalmazódik.
- Q4 FB311 = SZ6: külön session (Gemini-script Kálmán termináljából), itt nem épül.
- Q5 FB315-316: „csináld meg a nyelvtani részt" → ebben a menetben; a képernyő-leírás jóváhagyva („go", 2026-09-18). FB316 szókészlet: csak a mostani 28 szó, a változatosság a személyekből („28 szónak van 60 változata, 1 szónak van 6 formája, akkor abból össze jön 50 mondat, ezek a szavak a 10 most frequent verbs in Spanish"), új szó nem kerül a leckébe.

## Sorok és hova tartoznak

| FB | képernyő | mi | hova |
|---|---|---|---|
| 300 | grammar:presente-irregular:drill, 4.0.15 | „nem jön be a következő szó" | = FB299, javítva 2863085 (4.0.16+), csak telefon-verify |
| 301 | word:tratar | „() helyett példamondat, hogyan kell használni" | Q3: elavult; a zárójel átfogalmazódik (7. lépés) |
| 302 | word:ready (about to; also: clever) | „a zárójelet nem értem" | PROMPT-POLICY v1 (also: tilos, 2 kártya) |
| 303 | word:tratar | „itt sem értem a ()-t" | ugyanaz |
| 304 | word:to try (tratar de + inf.) / to treat | „a spanyol szó benne van" | PROMPT-POLICY v1: spanyol a prompt-oldalon tilos (7 kártya) |
| 305 | word:necesitaba (necesitar) | „ha a múlt idő a lényeg, csak az angol múlt idő legyen ott" | PROMPT-POLICY v1: ragozott kártya = csak az angol alak (74 kártya) |
| 306 | word:to recycle (előző: extra) | „extra spanyolul = angolul, felesleges; szabályokat kell megfogalmaznunk" | Q2: nem gond; a szabályok = 5. lépés |
| 307 | word:I/he needed (to need) | „a / jelet nem szeretem, csak az egyik legyen" | PROMPT-POLICY v1: egy személy (3 kártya), „/" csak szinonimára |
| 308 | pcic, 4.0.17 | „again hard good easy színezni, mint a másikban" | kód: 2 gomb színe a Learn fül szerint (SZ1 után 2 gomb) |
| 309 | pcic | „Check gomb helye és színe, mint a másik résznél" | kód |
| 310 | pcic | „tetejére, mennyi szó van ebben a témakörben" | kód |
| 311 | pcic | „mondatok a szavakról, ha nem tudom, mondja ki" | = SZ6, külön session (Q4) |
| 312 | pcic | „I know-ra nyomok, semmi nem történik" | kód: az utolsó learning-lap azonnal visszajön (2 lépés), lépés-jelvény |
| 313 | pcic | „egyszer nyomtam, elfogyott, mi történt?" | ugyanaz + done-képernyő |
| 314 | pcic | „nem lehet több szót tanulni, képernyő, ahol többet tanulhatok" | kód: done-képernyőn „+10 új szó" |
| 315 | grammar:indefinido-10-verbos:lesson | „Ezen szavak tanulása gomb, benne ezek a szavak" | kód: fókusz-menet a Learn fülön (8. lépés), NYELVTAN.md NY9 |
| 316 | grammar:indefinido-10-verbos:lesson | „50 különböző mondat, nem egyszerre, legyen feladat" | tartalom + kód: 50 transform item, 10-es körök (9. lépés), NYELVTAN.md NY10 |

## Képernyő-leírás (FB315-316, jóváhagyásra)

- FB315: a lecke-képernyőn (zárt és nyitott állapotban is) a zár-sáv alatt egy gomb: „Ezen szavak tanulása (N)", N = a lecke transform-szavai közül a még nem ismertek. Koppintásra a Learn fül nyílik fókusz-módban: a sor csak a lecke szavaiból áll (új + esedékes), nincs témakör-kölcsönzés, a tetején sáv „indefinido szavai · 12/28 ismert · ✕". A menet a szokásos 3-lapos ciklus. Kilépés a ✕-szel vagy ha minden szó ismert (akkor a sáv „kész, vissza a leckéhez").
- FB316: a lecke mondat-készlete 12-ről 50 transform itemre nő (mind a lecke szó-halmazából, NY1 validátor őrzi). A „Mondat-átírás" gomb egy 10-es kört indít: a legkevesebbszer gyakorolt itemek előre, azon belül véletlen sorrend. Kör végén összesítő + „Még 10" gomb. Item-számláló a `game_progress`-ben.

## Lépések

- [x] 1. (KÉSZ 2026-09-18, wt `~/ai/kimacha-wt-fb0918`, tsc 0, jest 1074/1077: a 3 `*.play.test.tsx` csak teljes futásban, terhelés alatt bukik időtúllépéssel, külön futtatva 14/14 zöld, nem ennek a menetnek a hibája) Worktree + ág `fix/fb-round-0918` → kész, ha: `git worktree list` mutatja, tsc+jest zöld az alapon
- [x] 2. (KÉSZ 2026-09-18, ac07929; tsc 0, jest 1080/1080) PCIC gombok (FB308+309): Tudtam `#38BDF8`, Nem tudtam `#1D4ED8` nyugalomban (SZ4 zöld/piros villanás marad), Check gomb közvetlenül a mező alá, `inlineCheckBtn` stílus („✓ Check", `#38BDF8`) → kész, ha: tsc + jest zöld, pcic teszt frissítve
- [x] 3. (KÉSZ 2026-09-18, 81d01bd) PCIC fejléc (FB310): a PCIC-tételek száma a fejlécben (`N szó`) → kész, ha: header string tartalmazza, teszt zöld
- [x] 4. (KÉSZ 2026-09-18, a4a328b; +2 teszt: newLimit határeset, egyelemű sor requeue; 1 Sonnet `iro` agent a 2-4. lépésre, 162K token, 1 piros→zöld kör) PCIC utolsó lap (FB312-314): learning lépés-jelvény a lapon (`1/2` → `2/2`), done-képernyőn „+10 új szó" gomb, csak ha van még be nem vezetett tétel (`pickSm2Session` extra kerettel) → kész, ha: pickSm2Session teszt az extra keretre + jest zöld
- [x] 5. (KÉSZ 2026-09-18, ai-workspace a49dcb0) PROMPT-POLICY.md 12-15. szakasz (1:1): spanyol a prompt-oldalon tilos; ragozott kártya = egy személy, csak az angol alak, lemma nélkül; zárójel = köznyelvi használat, „also:" és rövidítés/zsargon tilos; „/" csak angol szinonimára, két jelentésre nem; 11/6 lezárva → kész, ha: fájl frissítve (ai-workspace commit)
- [x] 6. (KÉSZ 2026-09-18, 9f5153f; 83 en mező, audit-prompts 0/0, corpusIntegrity 16/16; a 12. szakasz audit-őre (spanyol címszó az en promptban) a 7. lépés alkalmazásával együtt megy Sonnetnek; nyitott: `tratar` „to try (to do something)" vs `intentar` „to try (attempt)" = PROMPT-POLICY 3. szakasz kérdés, Kálmán dönt) Adat-javítás scripttel + kézzel: 7 spanyol-a-promptban (tratar, ganas, respecto, 4 haber), 74 ragozott `(to X)` + 3 `I/he`, 2 `also:` → kész, ha: `audit-prompts` 0 ütközés, corpusIntegrity + jest zöld
- [x] 7. (KÉSZ 2026-09-18; őr-agent 138K token. ADAT: 1099 prompt 11 batchben, 2 Sonnet `iro` (1-6: 309K, 7-11: 268K token), 286 prompt átírva (ebből 85 „/"-szétbontás egy fő jelentésre, a másik jegyzetbe), 227 jegyzet-kiegészítés (note_en + note_hu), 22 kézi javítás ütközésre / szófaj-csúszásra; commitok 91b5b5e (B1-C2) + 917a7b5 (A0-B1); audit-prompts 0/0, corpusIntegrity 16/16, audit-corpus 0/0. Kalibrációs kérdés Kálmánnak: a „/"-szétbontás igéknél is (hacer: „to do" / „to make" → a mondat szerinti egy; querer, llevar, tomar, tocar…), ez a 15. szakasz betű szerinti alkalmazása, a másik jelentés a jegyzetben. a 12. szakasz audit-őre KÉSZ a3fe8fd (`headwordLeaks` a `lib/promptOverlap.ts`-ben + corpusIntegrity eset + audit-prompts `leak` sor, 0 találat; 10 cognate téves riasztás az őrben szűrve, adat érintetlen)) Korpusz-átnézés: ~376 zárójeles + ~642 „/"-es prompt Sonnet-adagokban (100/adag, sentence_en-nel), javaslat-fájl → alkalmazás → kész, ha: minden adag lefutott, audit 0, jest zöld
- [x] 8. (KÉSZ 2026-09-18, b2f066e; tsc 0, lint 0 error (22 warning = alap), jest 1097/1097; +3 teszt: focusWords, focusSmoke (lib-szintű, a React-ág nincs tiszta függvényben), learnWordsButton; agent 276K token; Sonnet `iro`, brief `TASK-8.md`; a 7. lépés 7-11. batche közben alkalmazva: 91b5b5e, 110 prompt + 95 jegyzet, 1 ütközés kézzel (6813 vanguardista), audit 0/0; agent 7-11: 268K token) FB315 fókusz-menet (képernyő-leírás jóváhagyása után): lecke-gomb + Learn fül fókusz-mód (store/route param, `scoped` = lecke-szavak, kölcsönzés ki, sáv) → kész, ha: tsc + jest zöld, új teszt a fókusz-sorra
- [~] 9. (FUT 2026-09-18, Sonnet `iro`, brief `TASK-9.md`, két commit: tartalom, kód) FB316 50 mondat + 10-es körök: 38 új transform item Sonnet-adagokban (NY1 validátor 0 hiba), kör-mechanika + számláló → kész, ha: validátor 0, jest zöld
- [ ] 10. Sheet F oszlop FB300-316 + AGENTS.md B) sorok + NYELVTAN.md NY9/NY10 + SZAVAK.md SZ6-jegyzet (FB311 külön session) → kész, ha: sheet kitöltve, számok = sheet sorok, ai-workspace commit
- [ ] 11. PR `fix/fb-round-0918` → main → kész, ha: PR nyitva, mainbe Kálmán szavára; build külön
- [ ] 12. Önellenőrzés (subagent-szám, válasz-szám) → kész, ha: a fájl alján

## Tények (2026-09-18 felmérés)

- FB300 = FB299 (`2863085`, Match/Form/Why item React `key` hiánya), a sor 4.0.15-ös, a javítás 4.0.16-tól bent.
- FB312 oka: `requeueAfterGrade` a `due === today` learning-lapot a sor végére teszi; ha az az utolsó lap, azonnal visszajön (LEARNING_STEPS = 2), második Tudtam után graduál → sor üres → „Done for today" (FB313).
- FB308 a 4.0.17-es 4 gombra jött; 4.0.18-ban SZ1 óta 2 gomb, de nyugalomban `colors.card` színű, csak nyomásra zöld/piros (SZ4). Learn fül: Good `#38BDF8`, Again `#1D4ED8`, Check `inlineCheckBtn` `#38BDF8` a mező alatt.
- Korpusz (3990 szó): 376 zárójeles en, 2 `also:`, 74 ragozott `(to X)` az en-ben, 3 `I/he`, ~7 valódi spanyol a promptban, 642 „ / " szinonima-prompt.
- Napi új keret: `DEFAULT_NEW_LIMIT = 20` (`lib/sm2.ts`), csak az új lapokat korlátozza.
- indefinido-10-verbos: 12 transform item, 28 egyedi wordId (numerikus string, `data/words` id-k); a Learn fül témakör-alapú (`getWordsForTopic`), szólistás menet nincs még.
