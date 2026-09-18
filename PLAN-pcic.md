# PLAN, 2026-09-17, PCIC B1 szólista fül (Anki-módszer, helyesírás) a Kimacha 1-ben

Kálmán kérése: új fül a Kimacha 1-ben a Cervantes PCIC B1 szavaival (a K2 `data/pcic/*b1-b2.clean.md` leltárakból), csak spanyol + angol, ismétlés Anki-módszerrel (SM-2: Again/Hard/Good/Easy), nincs 3 lapos létra, csak a szó helyesírása (angol fent, spanyolt gépeled). Először a lista 20%-a, ha jó, több. Cél: megnézni, jobbak-e a PCIC-szavak az AI-generáltaknál.
Feltevés: mondatot nem generálunk, csak ami a leltárban eleve van (szó + kifejezés + mondat-sablon).
Szabály rögzítve (2026-09-17): Kimacha 1 = szavak, Kimacha 2 = nyelvtan + történetek (`AGENTS.md` „KÉT APP, KÉT CÉL").
Külön fájl, mert `PLAN.md` és `PLAN-fb0917.md` más session alatt fut.
Ág: `feat/pcic-b1`, worktree `~/ai/kimacha-wt-pcic`, main-ből (5a009c0, v4.0.16). PR mainbe Kálmán szavára.
Becslés: ~120-180K token (Sonnet `iro` agentek), ~2 óra agent-idő. Fable: terv + instrukció + kapu-olvasás.

- [x] 1. Worktree + ág `feat/pcic-b1`; a két `*b1-b2.clean.md` másolása `data/pcic/`-be (forrás-megjelöléssel) → kész, ha: `git worktree list` mutatja, fájlok bent [2026-09-17]
- [x] 2. Kinyerő script `scripts/pcic-b1.ts`: B1 tételek → `data/pcic/b1-all.json` `{id, es, kind: word|phrase|sentence, section}` (tilde-sor = egy kifejezés, vesszős sor = külön szavak, `[...]` hivatkozás eldobva), dupla nélkül; rétegzett 20% minta (minden 5.) → `data/pcic/b1-sample.json` → kész, ha: darabszám + 20 véletlen tétel Kálmán elé, jóváhagyva [2026-09-18, minta OK: rövid kifejezés marad]
- [x] 3. Angol fordítás Sonnet-adagokban (150/adag) a mintára, `en` mező; audit: nincs üres `en`, nincs dupla `es` → kész, ha: audit 0 hiba [2026-09-18]
- [x] 4. SM-2 ütemező `lib/sm2.ts` (Anki alap: 1 nap → 6 nap → ×ease, ease 2,5-ről indul, Again = lapse, újra 1 nap, ease −0,2; Hard ×1,2, ease −0,15; Easy ×1,3, ease +0,15; 20 új/nap) + `pcic_cards` tábla a `lib/database.ts`-ben, a FSRS `cards` táblától független → kész, ha: jest az intervallum-lépcsőre + lapse-re zöld [2026-09-18]
- [x] 5. Fül `app/(tabs)/pcic.tsx` + `_layout.tsx` bejegyzés: angol fent, spanyol gépelés, felfedés után betű-diff (`lib/charDiff.ts`) + 4 Anki-gomb (találat szerint előre kijelölve: pontos = Good, 1 betű = Hard, más = Again), nap végén összesítő → kész, ha: tsc 0, lint 0, jest zöld [2026-09-18, jest 1023/0]
- [~] 6. APK a branchről + Drive → kész, ha: Kálmán a telefonon látja a fület
- [ ] 7. Kálmán ítélete (jobb-e a PCIC-szó): ha igen, maradék 80% + PR mainbe; ha nem, ág marad, nem merge → kész, ha: döntés a PLAN-ba írva

Önellenőrzés (menet végén): subagentek száma, Fable-válaszok száma lépésenként.
