# BUILD.md, Kimacha build manifest

> Token-burn manifest a `feedback_build_manifest_convention` szerint.
>
> **Trigger:** „make kimacha app" / „építsd a kimacha appot" / „build the app" →
> token-burn mód: kezdj az első nyitott (nem BLOCKED) queue-itemnél, haladj lefelé
> **per-step megerősítés nélkül**, commitolj item-enként (a státusz-tábla + queue
> frissítésével UGYANABBAN a commitban). Megállás: queue üres / acceptance kétszer
> bukik / runtime v. secret kell a usertől / egy item BLOCKED (ugord át).
>
> ⚠️ **NEM ugyanaz mint „build" / „kimacha build"** = APK-release (PATCH-bump,
> `eas build`, deploy Drive-ra; lásd `feedback_kimacha_build_release`). Az = kiadás.
> EZ (make/építsd app) = fejlesztés a queue-ból, nincs APK.
>
> Részletes bug/feedback-queue + spec: **`AGENTS.md`** (auto-betöltött `@AGENTS.md`)
> és `ITER3.md` (iter3 spec, lezárt). Korpusz-őr új tartalomnál: `node scripts/audit-corpus.mjs`.

---

## 1. Státusz (% kész, komponensenként)

Szám-becslések `project_word_expansion` memóriából (2026-06-13), nem élő-verifikált.

| Komponens | Állapot | % |
|---|---|---|
| App-motor (SRS, vizsga, tech-tree, UI) v3.0.28 | kész; FB132-134 benne, eszköz-verify hátra | ~95 |
| hu→es tartalom (spanyol, flagship) | **2026-08-16:** A0 100 / A1 931 / A2 792 / B1 898 / B2 519 / C1 404 / C2 92 (C2 BEFAGYASZTVA), topic-fa MINDEN szinten (B1 38 / B2 22 / C1 18); kumulált C1 = **3 644**, XLex-cél 4 000 → **356 hiány** | ~85 |
| hu→en tartalom (angol-cél) | A0 100 / A1 384 / A2 390 = **874 kártya, 41 topic**, audit P1=0; exam korpusz-tiszta; id-blokkok ~tele (2026-07-12) | ~80 |
| **Mátrix per-ág modell (A0 közös + A1+ ágankénti)** | en-ág (hu→en) A0/A1/A2 KÉSZ (480 kártya); **hu-ág A0 + A1 KÉSZ** (100 + 148 kártya, 10 + 15 topic, audit-hu gate A0/A1-re, 2026-08-15); de-ág + hu A2+ hátra | 55 |
| **es→hu kurzus (magyar cél)** | indítható (FB129 pár-szintű napi keret fix); tartalom A0 100 + A1 148 = 248 kártya, XLex A1-cél ~1200 → bővítés hátra | 25 |

---

## 2. Token-burn queue (sorrendben)

### ✅ Q0. [KÉSZ 2026-07-12, éjszakai műszak] Backup + Restore gomb

User: „backup gomb … ez fontos ez legyen az 1." Döntések AskUserQuestion-nel
pinnelve (2026-07-12): **export-fájl + share sheet** (nem Drive-auth, nem csak-lokális),
**restore IS kell**.

**Spec:**
- **Backup gomb** (Settings): a teljes tanulási állapot egyetlen JSON-fájlba
  (schemaVersion + exportedAt + appVersion + mind a 9 tábla: `cards`,
  `card_attempts`, `learn_settings`, `onboarding`, `selected_topic`,
  `spelling_list`, `streak`, `user_level`, `user_meta`), írás
  expo-file-system-mel cache-be, majd **Android share sheet** (expo-sharing):
  user menti Drive-ra/emailbe/akárhová. Offline, nincs app-beli Google-login.
- **Restore gomb** (Settings, backup alatt): expo-document-picker → JSON kiválasztás
  → séma+verzió validálás → **megerősítő dialog** (felülírja a jelenlegi haladást!)
  → tranzakcióban import (törlés+insert táblánként) → app-state reload
  (pendingAction minta). Hibás/idegen fájl: hibaüzenet, DB érintetlen.
- MINDKÉT db-fájl (`lib/database.ts` + `lib/database.web.ts` + IDatabase):
  `exportAll(): Promise<BackupPayload>` + `importAll(payload)` metóduspár;
  web = JSON letöltés/feltöltés (Blob + input file) vagy no-op toast, a
  wordsOnly/web-minta szerint.
- Függőség: `npx expo install expo-sharing expo-document-picker expo-file-system`
  (package.json-ban most NINCS; natív modul → új APK-build kell hozzá, ami amúgy
  is esedékes).
- i18n ×4: hu „Biztonsági mentés" / „Visszaállítás"; en „Backup" / „Restore";
  es „Copia de seguridad" / „Restaurar"; de „Sicherung" / „Wiederherstellen"
  + megerősítő-dialog szövegek.
- FeedbackButton már van a Settings tabon (FB40), nem kell új.

**Acceptance:** tsc 0; jest zöld + új unit-teszt: export→import kör-út egy
memória-db-n (payload minden táblát visszaad, importAll után azonos állapot);
adat-JSON érintetlen; eszköz-verify (share sheet + visszatöltés) = user, következő build.

### Q1. [UNBLOCKED es-ág (ITER4.md jóváhagyva 2026-07-22); en/hu/de ág még DESIGN-FIRST], Mátrix per-ág szókészlet: A0 közös, A1+ ágankénti

**User vízió (szó szerint, 2026-06-22, ne tömörítsd, ne javítsd):**

> Minden ágnak külön szavakat akarok. MErt az A0 szint az mindenhol a turista
> szint, ha beszélni akarod a nyelvet magara akarsz venni néhány szót kifejezést
> akkor az elég, és utána jön az igaz i nyelvtanulás. ÉS azt vettem észre hogy ez
> minden nyelvnél más sőt még ang magyarra is más mint magyarról angolra. Ezt
> kellene lekódolni majd és szavakat keresni ehez.

**Döntés (AskUserQuestion, 2026-06-22):** Mátrix, **bármely pár** a {es, hu, en, de}
nyelvek közt, **mindkét irány saját A1+ szókészlet** (mert hu→en ≠ en→hu).
~~A0 = közös „turista" szint, megosztott minden ágon.~~ → **FELÜLÍRVA (#2, 2026-06-22):
A0 = target-specifikus top-100** (lásd lent).

**User-szabály (szó szerint, 2026-06-22 #2, FONTOS, ne tömörítsd):**

> milyen nyelveken mennyi szavak vannak mátrix kell mindig az a lényeg a mátixnál,
> hogy amilyen nyelvre tanulunk azon nyelv fontos szavai legyenek benne a 100
> leggyakorobb szó kifejezés az A0 szinten és A1 től meg azok a szavak amik a
> nyelvvizsgákhoz kellenek ez egy fontos szabály

**Levezetve:** cél-nyelvenként (mátrix-cella):
- **A0** = a CÉL-nyelv 100 leggyakoribb szava/kifejezése (frekvencia-alapú, target-specifikus).
- **A1-től** = a CÉL-nyelv hivatalos **nyelvvizsgáihoz** kellő szókészlet (NEM nyers frekvencia;
  pl. es=DELE, en=Cambridge/IELTS, de=Goethe, hu=ECL/origó szólisták szintenként). Plafon B2
  (lásd Q2 ⛔ user-szabály: soha C1/C2).

✅ **FELOLDVA (2026-06-22, AskUserQuestion):** A0 = **target-specifikus top-100**. Minden cél-nyelv
saját `data/words/<target>/a0.json`-t kap, az adott nyelv VALÓDI 100 leggyakoribb szavával/kifejezésével
(es ≠ en ≠ de top-100). A korábbi „A0 közös/megosztott" döntés **ELAVULT**. A jelenlegi közös
`data/words/a0.json` (100, koncept/turista-alapú) → az **es-target A0-jává** migrálandó, és valódi
es-freq top-100-ra igazítandó (külön task).

**Modell:**
- **A0** = **target-specifikus** top-100 (a cél-nyelv 100 leggyakoribb szava/kifejezése),
  `data/words/<target>/a0.json`. Felülírja a korábbi „közös A0" modellt (2026-06-22 döntés).
- **A1+** = ágankénti (cél-nyelvenkénti) saját tartalom-track, az angol-track
  precedensét követve: `data/words/<target>/aN.json` (id-offset hogy ne ütközzön),
  `data/topics/<target>/aN.json` (cél-nyelv grammatika), `data/sublevels/<target>/aN.json`.
- A tananyag a **párfüggő** (native+target), nem csak target-függő.

**Design-kérdések, es-ágra FELOLDVA (`ITER4.md` D1–D7, 2026-07-22):**
1. ~~„hu→en ≠ en→hu" jelentése~~ → **hamis-barát fókusz** (D4/D7): native szerinti
   buktató-szavak distractor-súlyozása; csak distractor, külön kártya nincs.
2. ~~Szó-sourcing forrás~~ → **SUBTLEX család** (D3); es=SUBTLEX-ESP. A0=freq-rangsorolt
   TARTALMAS szó top-100 (funkciószó kiszűrve, D5); A1+=Cervantes Plan Curricular, B2 plafon (D6).
3. ~~es tárolás~~ → **marad megosztott = es-kanon** (D2), zéró migráció.
4. Topic-fa többi cél-nyelvhez → **HALASZTVA** (D1: csak es-ág; es-nek már van A0/A1/A2 fája).
5. `audit-corpus.mjs` minden cél-nyelvre → **HALASZTVA** (D1).

**es-ág build-terv (ITER4.md §2):** WP1 A0 top-100 realign (SUBTLEX-ESP, tartalmas szó) ·
WP2 A1+ bővítés Plan Curricular felé (B2 plafon, meglévő 882 marad) · WP3 hamis-barát
distractor-réteg. Munkacsomagonként commit + gate. **es-ág mostantól token-burn-ölhető.**
en/hu/de ág továbbra is DESIGN-FIRST (későbbi ITER doc).

**Acceptance (a tényleges build-höz, később):** `ITER4.md` jóváhagyva; per cél-nyelv
A0-közös + A1 saját track; `audit-corpus` P1=0 minden track-en; `tsc` tiszta; jest zöld;
`database.ts` ÉS `database.web.ts` együtt.

---

### ✅ Q2. [token-burn, CÉL ELÉRVE 2026-08-20] Spanyol szóbővítés

Forrás + pipeline: `project_word_expansion` memória + `feedback_burn_tokens_no_confirm`.
Trigger-szinonimák: „égesd a tokeneket" / „szavakat generálj" / „töltsd fel a szókészletet".

> 🎯 **USER-SZABÁLY (2026-07-28, FELÜLÍRJA a 2026-06-22-es „plafon = B2" szabályt):**
> a cél az XLex-sávok kumulált szókészlete MINDEN nyelvre, **plafon C1**
> (A1 ~1 200, A2 ~2 000, B1 ~3 000, B2 ~3 500, C1 ~4 000), **C2-t nem építünk**.
> Részletek + escape-klauzula (ha egy szinten nincs annyi hasznos szó, állj meg a
> sáv alatt és írd le, miért): `AGENTS.md` → „🎯 Szókincs-cél MINDEN nyelvre".
> Spanyol állapot: kumulált C1 = 3 386 (2026-07-28: B2 394→494), a ~4 000-es célig
> ≈ 610 szó hiányzik: B2 +197, C1 +417.

- **Forrás-váltás (2026-07-28): a SUBTLEX-ESP frekvencia-farok KIMERÜLT.** A teljes
  `word_batches/` (rang 1406–6604, 5 206 jelölt) szűrése után 907 maradt, és az is
  túlnyomórészt tulajdonnév (angol keresztnevek a feliratkorpuszból), vulgáris szó,
  klitikumos felszólító alak (`dame`, `cállate`) vagy már tanított ige ragozott
  alakja. Ezért B2/C1-en a forrás a **DELE/Plan Curricular sávok szemantikai
  doméneken** (ez amúgy is az `AGENTS.md` D6 szabálya: A1+ = vizsga-szókészlet,
  nem nyers frekvencia). A frekvencia-út A0-ra marad érvényes.
- Pipeline (a /tmp-ből promotálva, hogy túlélje a takarítást):
  `scripts/filter_words.js` (freq-jelölt szűrő, már csak referencia) →
  batch Sonnet agentek doménenként, spec: `scripts/word-card-spec.md` →
  `scripts/merge_word_batches.py`-helyett `scripts/merge_word_batches.js`
  (kereszt-batch dedup) → `scripts/append_words.py --level X --input ...` →
  `validate_words.py` + jest + tsc → commit/szint.
- **Futás 2026-07-28:** 7 agent indult (B2 3×100 domén: gazdaság / társadalom-jog /
  egészség-tudomány; C1 4×105: pszichológia / hivatalos-akadémiai regiszter /
  kultúra-történelem / precíz igék-kötőszavak). Session-limit megölte hetet
  kivéve egyet: **csak a B2 egészség-tudomány batch készült el** (`6203af4`, +100).
  Hátra: B2 gazdaság 100, B2 társadalom-jog 100 (a padlóhoz ~197 kell), és a
  4 C1 domén 105-ösével.
- **FIGYELEM:** ez a JELENLEGI megosztott-készlet modellben bővít. Ha Q1 (mátrix) elfogad,
  ez REFRAME-elődhet (es külön track). Q1 előtt ez a biztos autonóm munka.

**Futás 2026-08-16 (Opus, „token égetés"), +165 kártya, 5 commit:**
A0 100 / A1 931 / A2 792 / B1 898 / B2 519 / C1 404, kumulált C1 3 479 → **3 644**.
Új eszköz: `scripts/append_level_words.mjs` (szabad id-tartomány, minden szint elleni
jelentés-dedup, topicOrder-folytatás), ez a `append_words.py` utódja szint-bővítéshez.
Minden batch a legvékonyabb topicokat célozta (B2 `adverbios_modo_grado` 6 kártyáról
indult, B1 `sabores_preparacion_comida` 8-ról).

**Két megállapítás a következő futásnak:**
1. **Az A1/A2 sáv nem új szavakkal zárható.** A1-en a jelöltek ~75%-a (35/45) MÁR
   tanított valahol, jellemzően A0-n vagy A2-n (padre, hora, siempre, nube…), tehát a
   maradó ~169-es A1-hiány **szint-újrasúlyozás** kérdése (A2/B1-en ülő, kezdő-gyakoriságú
   kártyák lehúzása A1-re), nem tartalom-írásé. Ez user-döntés, mert a szintlépés a
   megjelenített kurrikulumot rendezi át (az FSRS-haladás nem vész el, az id marad).
2. **Egyes-többes iker-kártyák a B1-ben:** `el objeto`/`los objetos`, `el pedazo`/
   `los pedazos`, `el producto`/`los productos`, `la ciudadano`/`la discípulo` (rossz
   névelő). Az FB97 dedupe-őr ezeket nem fogja meg (más az `es` sztring). Külön
   takarítás-item, a `wordMerges` mintájára.

**Futás 2026-08-20 (Opus, „token égetés"), +360 kártya, 3 commit, A CÉL ELÉRVE:**
A0 100 / A1 931 / A2 792 / B1 898 / B2 **781** / C1 **502**, kumulált B2 **3 502**
(sáv ~3 500 ✅), kumulált C1 **4 004** (sáv ~4 000 ✅). C2-t a user-szabály szerint
nem építünk, tehát a spanyol ág szókincs-célja ezzel TELJESÍTVE.
- B2 +262: a tíz legvékonyabb topic feltöltve (adverbios_modo_grado 11→40,
  viajes_transporte 15→40, informacion_medios 16→38, verbos_accion_cotidiana 18→38,
  educacion 19→36, vivienda_hogar 21→34, caracter_comportamiento 21→41,
  verbos_mentales_abstractos 23→40, tecnologia_digital 23→40,
  emociones_sentimientos 24→40, sintomas_diagnostico 24→39, trabajo_economia 26→38,
  naturaleza_medioambiente 28→40).
- C1 +98: ciencia_investigacion 15→32, salud_avanzada 15→30, tecnologia_digital 17→29,
  filosofia_etica 20→32, derecho_justicia 21→33, medioambiente 21→31,
  verbos_proceso_abstracto, economia_mercado, industria_produccion, medios_discurso.
- Forrás: DELE/Plan Curricular szemantikai domének (a SUBTLEX-farok 2026-07-28 óta
  kimerült), írás közvetlenül Opusszal, nem batch-agentekkel.
- Skip-arány ~20%: az `append_level_words.mjs` fogta a más szinten már tanított
  jelölteket (pl. `profundamente` B1, `la entrevista` A1, `el guion` C1), a hiányt
  ugyanabban a körben pótoltam. Két rossz névelő (`el hinchazón`, `el placa solar`)
  kézzel javítva a beszúrás után, a mondat egyeztetésével együtt.
- Gate: tsc 0, jest 228/228, audit-corpus es/en/hu P1=0/P2=0.
- **Következő szint-munka NEM új szó**: a 2026-08-16-os megállapítás áll, az A1/A2
  hiány szint-újrasúlyozás (user-döntés), és a B1 egyes-többes iker-kártyák
  takarítása külön item.

### Q3. [token-burn, user 2026-07-12] hu A0 track (új) + en A1/A2 mélyítés spanyol-szintre

> ⚠️ FRISSÍTVE 2026-07-12: a régi Q3 („hu→en angol-track folytatása", Hátra-lista)
> ELAVULT, az en-track A0/A1/A2 szókincs+struktúra+exam-gate KÉSZ 2026-07-11-én
> (lásd Session log). Ez az item a maradék két konkrét user-kérést fedi.

**Sorrend: 3a előbb (kisebb, önálló), utána 3b. Mindkettő egyenként commit+gate.**

#### ✅ 3a. hu A0 track, nulláról, KÉSZ (`076dc9b`, 2026-07-12 éjszakai műszak)

Cél: hu A0 (10 topic / 3 al-szint, 100 szó) parity az es/en A0 mintával (FB21-minta).

- `data/words/hu/a0.json`: 100 kártya, a MAGYAR nyelv 100 leggyakoribb szava/kifejezése
  turista-szinten (matrix A0-szabály: cél-nyelv-specifikus top-100, `project_word_expansion`
  memória). id **6100-6199** (a meglévő `data/words/hu/a1.json` 6001-6006 stub-ot NE bántsd,
  nem ütközik vele). Minden kártya mind 4 nyelv (es/hu/en/de) + 4 `sentence_*` mező kötelező
  (a `hu` mező a TANULT szó, a másik 3 a lehetséges anyanyelvek fordítása/kontextusa).
- `data/topics/hu/a0.json` + `data/sublevels/hu/a0.json`: 10 topic / 3 al-szint, es/en A0
  topic-bontás mintájára (turista alapszókincs: köszönés, számok, színek, bemutatkozás, étel,
  stb.), saját magyar-specifikus felosztás, nem kell 1:1 másolni az es/en listát.
- `data/words.ts`: `huWordsByLevel.A0 = hu_a0` (2 sor, az en A0 wiring mintájára).
- `data/topics.ts`: `huTopicsByLevel.A0` + `huSubLevelsByLevel.A0` (a meglévő
  `huTopicsByLevel['A1']` minta mellé).
- Korpusz-gate: `scripts/audit-corpus-hu.mjs`, az `audit-corpus-en.mjs` másolataként
  (mezőnevek `_hu`-ra), P1=0 követelmény.
- Megjegyzés: ez CSAK adat+gate; onboarding UI-hoz NE nyúlj, a forrás/cél-nyelv választó
  (`app/onboarding.tsx`, `lib/languages.ts` `isPairSupported`) már generikus, minden
  {es,hu,en,de} párt enged; a hu A0 tartalom a meglévő UI-n automatikusan elérhető lesz,
  amint a fájlok+wiring megvan.

#### ✅ 3b. en A1/A2 mélyítés, KÉSZ az id-blokk plafonjáig (`6037ce9`+`9bd727a`+`36b8d48`+`cef4119`, 2026-07-12 éjszakai műszak)

> ⚠️ Az eredeti +400-500 A1 / +500-700 A2 cél az id-blokkokba NEM fér el (A1 blokk 5001-5399 =
> 199 szabad id volt, A2 blokk 5400-5799 = 220). A blokkok most majdnem tele: A1 384 kártya
> (16/topic, 15 tartalék id), A2 390 kártya (26/topic, 10 tartalék). További sűrítéshez
> user-döntés kell: id-blokk bővítés a validate-en-track.mjs-ben.

Jelenlegi állapot (2026-07-11 lezárva, ELLENŐRIZD indulás előtt `data/topics/en/`-ben,
mielőtt duplikálsz): en A0 = 100 szó / 10 topic (**10/topic, MÁR PARITÁS** az es A0-hoz,
NE nyúlj hozzá). en A1 = 200 szó / 24 topic (~8/topic; es A1: 882 szó / 46 topic ~19/topic).
en A2 = 180 szó / 15 topic (~12/topic; es A2: 900 szó / 15 topic = 60/topic).

- **A1**: bővítsd a 24 meglévő topicot, cél ~18-20 szó/topic (es-sűrűség) → nagyságrendileg
  +400-500 új kártya. Ha a `AGENTS.md` régi Hátra-listájából (this/that, have_got, can,
  question_words, prepositions, body, house, clothes, jobs, animals, weather, daily_routine)
  van olyan, ami MÉG nincs topicként lefedve, azt új topicként vedd fel; a többinél a
  meglévő topicokat mélyítsd.
- **A2**: bővítsd a 15 meglévő topicot, cél ~40-50 szó/topic → nagyságrendileg +500-700
  új kártya. Nem kell az es Origó-temario 1:1 leképezés, en-specifikus alszintezés marad.
- id-tartomány: `scripts/validate-en-track.mjs`-ben rögzített blokkok (A1 5001-5399,
  A2 5400-5799), jelenlegi max A1 id 5200, A2 max 5579, van hely bőven a blokkon belül.
  Ha egy blokk betelne, NE találj ki random tartományt: állj meg, jelezd a zárójelentésben.
- Minden batch után: `scripts/audit-corpus-en.mjs` (P1=0, kumulatív szint-szigorral) +
  `scripts/validate-en-track.mjs` + tsc + jest.
- Batch-elve dolgozz (Sonnet subagent, ~100-150 szó/batch, mint a 07-10/07-11 log-minta),
  COMMIT batchenként, státusz-táblát frissítsd.

**Közös acceptance (3a+3b):**
- `npx tsc --noEmit` 0 app-hiba; `npx jest` zöld (flaky examBuilder-szabály él: ha csak
  az bukik, futtasd újra, ne javítsd).
- Adat CSAK JSON-okba (`CLAUDE.md` szabály), `.ts` fájlokba csak import+wiring sor.
- `database.ts` / `database.web.ts` nem érintett (nincs új DB-mező ebben a task-ban).
- Session log + a fájl tetejei % státusz-tábla frissítve minden batch után.

---

## 3. Build contract

- Queue-item = **tiszta kód-írás + offline acceptance** (nincs runtime/eszköz). Runtime → 4. szekció.
- **Commit item-enként**, a státusz-tábla + queue frissítésével ugyanabban a commitban.
- Minden zöld mielőtt kész: `npx tsc --noEmit` hibátlan; `jest` zöld; `node scripts/audit-corpus.mjs` P1=0;
  web-konzisztencia (`lib/database.ts` ÉS `lib/database.web.ts` egyszerre).
- Adatot a szint-JSON-okba (`data/words/...`), SOHA a `.ts`-be (lásd `CLAUDE.md`).
- **Nincs push** (local-only). APK = külön „build" trigger, user-flow.
- Default `lang='es'` viselkedés bájtra ne változzon; csak `lang!=='es'` + létező tartalom térjen el.

## 4. Runtime checklist (csak a user tudja futtatni)

- APK release: „build" trigger → `eas build preview` + Drive-deploy (`deploy_kimacha_apk.py`, maszkolt creds).
- Telefon-verify: tech-tree vizuál, billentyűzet-stabilitás, FB-fixek élőben, words-only persist.
- `npx expo prebuild` után `AndroidManifest.xml windowSoftInputMode` ellenőrzés (billentyűzet-fix).

## 5. Session log

- **2026-06-22** (Opus): BUILD.md létrehozva a `feedback_build_manifest_convention` szerint.
  Per-ág szó-vízió rögzítve = Q1 (DESIGN-FIRST, BLOCKED). Mátrix-döntés (bármely pár, A0 közös)
  AskUserQuestion-nel pinnelve. Q2/Q3 = meglévő token-burn munkák átemelve. Nincs kód-változás, nincs commit.
- **2026-06-22** (Opus token-burn): committed Q3 en-track batch 1 (`c52bb10`, 62 szó volt uncommitted).
  Q2 es-bővítés folytatva: `filter_words.js` → curator agent (1402 jelölt → 448 curated, ~954 junk:
  tulajdonnév/ragozott alak/angol token kiszűrve) → Sonnet generátor agentek 100/batch.
  B2 wave: +310 szó (84→394, id 3008-3317, 3 batch), tsc 0 / jest 43 / audit P1=0. C1 batch (96)
  bukott session-limiten; C2 batch (42) generálva DE user-szabályra ELDOBVA: „C1/C2 soha, B1/B2 max".
  C1/C2 ezentúl befagyasztva. hu/ stub (6 szó, Q1-mátrix korai start) UNTRACKED hagyva (Q1 BLOCKED).
- **2026-06-27/28** (Opus): „nézd meg a feedbacket és fejleszd". Feedback-sheet triage: 10 új sor
  (FB21-30, 06-23/25). 3 design-döntés AskUserQuestion-nel. Token-burn a tiszta fixekre, commit
  item-enként: FB23 feedback-gomb tree-tabon (`5064ea1`); FB30 I-know-this fehér betű (`83bff68`);
  FB25 gépelés char-diff LCS piros/fehér (`804669b`); FB28 recognition-fallback helyesírás-variáns
  disztraktorokkal, új `lib/spellingVariants.ts` + teszt (`ad21b1a`); FB24+26+27 words-only TELJES
  újratervezés (fázis-tartó flashcard→typing-gate + interleave max-4-run, `d389b52`). FB21 (A0 topic)
  + FB22/29 (A2 topic) = DOC-FIRST: `docs/TOPICS-A0-A2.md` terv jóváhagyásra (`02f21c7`). Minden
  commit: tsc 0, jest 49/49 (+6 spellingVariants). Q1/Q2/Q3 érintetlen.
- **2026-06-28** (Opus): user-döntések a doc 5 kérdésére (A0 10-csoport IGEN, verbos_a0 egyben, A2 =
  konkrét magyar nyelvvizsga NEM DELE, váltás-jelzés toast, A0 előbb). FB21 A0 topic-build KÉSZ
  (`4d97224`): 100 szó → 10 topic / 3 al-szint, `data/topics/a0.json` + `data/sublevels/a0.json`,
  `topics.ts` wiring, `tree.tsx` gate bármely topic-os szintre, A0 szabad-választás, topic-váltás
  toast (FB21 UX, 4 nyelv). tsc 0, jest 49, audit P1=0, A0-integritás OK.
- **2026-06-28** (Opus + Sonnet subagentek): FB22/29 A2 topic-build KÉSZ (`b1e6d87`). User-választás:
  Origó (ITK/ELTE) alapfok szóbeli témalista (hivatalos PDF webről, 15 téma / 5 al-szint). 900 A2
  szó besorolva 6 párhuzamos Sonnet-ügynökkel (6×150, /tmp chunk+out fájlok, MY-kontextusból kihagyva),
  merge+validál script: mind 900 pontosan 1 témába, 0 árva, hézagmentes topicOrder. `data/topics/a2.json`
  + `data/sublevels/a2.json` + words-patch + topics.ts wiring; computeUnlockedTopics szabad-választás
  bármely topic-os szintre (A0/A1/A2). tsc 0, jest 49, audit P1=0. Eloszlás egyenetlen (trabajo_dia 190).
- **2026-07-10** (Opus): user-greenlight a Q1 en-track (hu→en) bővítésre a beillesztett 41-topic
  taxonómiával (design-block feloldva). STRUKTÚRA KÉSZ: `data/topics/en/{a0,a2}.json` (10+15 topic),
  `data/sublevels/en/{a0,a2}.json` (3+5), `topics/en/a1.json` +16 topic (order 9-24, A1.3-A1.6),
  `data/sublevels/en/a1.json` +A1.3-A1.6, `topics.ts` A0/A2 en wiring. GATE-INFRA KÉSZ:
  `scripts/audit-corpus-en.mjs` (en-aware korpusz-audit, sentence_en ⊆ taught en, szint-kumulatív)
  + `scripts/validate-en-track.mjs` (id-blokk A0 5800-5999 / A1 5001-5399 / A2 5400-5799, cross-level
  dedup, séma). es flagship `audit-corpus.mjs` bájtra érintetlen. tsc 0, jest 56/56, struct OK,
  validate OK; audit-en baseline 49 P1 (mind valódi A0-gap szó, az A0 smoke feloldja). Kártya-tartalom
  NULLA még: Sonnet-burn gated A0(smoke 100)→A1→A2, szintenként audit+validate+tsc+jest gate.
- **2026-07-10** (Opus + Sonnet subagent): A0 en smoke KÉSZ. `data/words/en/a0.json` = 100 kártya
  (10 topic × 10, id 5800-5899), `words.ts` A0 en wiring (2 sor). Gate: validate OK, tsc 0, jest 56/56.
  audit-en P1: 49→37, a maradék 37 MIND A1-örökség (a 62-kártyás batch-1 mondatai tanítatlan szavakra
  hivatkoznak: student/house/school/office/breakfast/friday/books/... + eat/drink/read/play/love), **0 db
  A0-kártya P1** (id-vel igazolva). A0 korpusz tiszta. o'clock→time csere (o'clock szám nélkül nem építhető
  A0-ból). A 37 A1-adósságot az A1 burn oldja fel (16 új topic tanítja a hiányzó szavakat + maradék
  legacy-mondat átírás). Következő: A1 138 kártya (id 5063-5200).
- **2026-07-11** (Opus + Sonnet subagent): A1 en burn KÉSZ. +138 kártya (id 5063-5200) a 16 új
  A1 topicban → `data/words/en/a1.json` 200 kártya. A meglévő 62 (5001-5062) szó-mezői ÉRINTETLENEK
  (id/es/hu/en/de/topic/topicOrder, git-diff igazolva), csak 15 legacy `sentence_*` átírva a korpusz-
  tisztaságért. Gate: validate OK (300 total), audit-en **P1=0 GLOBÁLISAN**, tsc 0, jest 56/56.
  A hu→en korpusz tiszta: minden sentence_en kizárólag tanított angol szóból + funkciószó. A 37
  A1-örökség P1 feloldva. Következő: A2 180 kártya (id 5400-5579), words.ts A2 wiring.
- **2026-07-11** (Opus + Sonnet subagent): A2 en burn KÉSZ. `data/words/en/a2.json` = 180 kártya
  (15 topic × 12, id 5400-5579), `words.ts` A2 en wiring. Gate: validate OK (480 total), audit-en
  **P1=0**, tsc 0, jest 56/56 (jest direkt binárral, az `npx` az rtk-proxyn elhasalt, nem teszthiba).
  **en-track A0/A1/A2 szókincs KÉSZ: 480 kártya (100+200+180), 41 topic, hu→en korpusz teljesen tiszta.**
  Hátra: en A0/A2 placement-exam tartalom (a `data/exams/en/` gap-kérdés path); telefon-verify a
  hu→en kurzuson (A0/A1/A2 tech-tree + tanulás); es/de/hu mátrix-ágak (Q1 többi cellája) külön.
- **2026-07-11** (Fable + Sonnet subagent): en A0/A1/A2 exam korpusz-igazítás KÉSZ. `audit-corpus-en.mjs`
  kiterjesztve az exam-fájlokra (kérdés-mondat + HELYES opció ⊆ tanított szókincs szint-kumulatív;
  a rossz distractorok mentesülnek, szándékosan hibás alakok, pl. „goed", legálisak). Baseline: 38
  P1-exam (14 A0 / 7 A1 / 17 A2), mind tanítatlan szóra épült (apple, teacher, film, cinema…).
  Sonnet átírta mind a 38-at tanított szavakra, grammar-target megtartva; Fable utó-QA: 2 junk
  „, " zero-article opció → „, " (2005 konvenció), 4 kétértelmű kérdés (2111 in/at hotel, 2112
  on/at corner, 2208 few/a few, 2209 is/was) egyértelműsítve. Gate: audit P1=0 + P1-exam=0,
  validate OK (480), exam-séma OK (3×18, 4 opció), tsc 0, jest 56/56. B1/B2 en exam érintetlen.
  Hátra vált.: examBuilder en↔hu drótozás (gazdag exam, most gap-fallback); telefon-verify.
- **2026-07-11** (Fable + Sonnet subagent): examBuilder en↔hu drótozás KÉSZ. `lib/examBuilder.ts`
  (target, counter) paraméterezés: es-kurzus változatlanul (target=es, counter=en, DELE authored
  blokk csak es-nél); en-target = en-track szavak + native counter (hu→en: en↔hu drillek).
  `ExamMode.tsx` useGenerated en-re is. Smoke: hu-en A0=17 / A1=20 drill („sarok"→„corner",
  hu prompt → en tile-rendezés near-miss distractorokkal); es A1=35 mind a 6 kind. Gate: tsc 0,
  jest 61/61 (+5 en-teszt), audit érintetlen. Hátra: telefon-verify hu→en exam; es/de/hu ágak (Q1).
- **2026-07-12** (Fable): user-kérés „backup gomb, legyen az 1." → **Q0 queue-item** (export+share
  + restore, döntések pinnelve AskUserQuestion-nel). Még nincs kód.
- **2026-07-12** (Fable, éjszakai műszak): **Q0 Backup+Restore KÉSZ (`6d85b75`).** Új `lib/backup.ts`
  (BackupPayload séma v1, 9 tábla, validátor); `exportAll`/`importAll` MINDKÉT db-fájlban +
  IDatabase (SQLite: tranzakcióban delete+insert, hibánál rollback = DB érintetlen; web:
  memória↔️tábla-sor konverzió, platformok közt hordozható payload); Settings 2 új sor:
  💾 Biztonsági mentés (expo-file-system File+Paths.cache → expo-sharing share sheet; web = Blob
  letöltés) + ♻️ Visszaállítás (expo-document-picker → validálás → megerősítő dialog → importAll →
  pendingAction reload; web = window.confirm). i18n ×4 (`backup` blokk). Függőségek (expo-sharing,
  expo-document-picker, expo-file-system) commitolva, **natív modul → új APK-build kell**. Gate:
  tsc 0, jest 65/65 (+4 backup-teszt: export→import kör-út memória-db-n + validátor). Eszköz-verify
  (share sheet + visszatöltés telefonon) = user, következő build.
- **2026-07-12** (Fable + Sonnet subagent, éjszakai műszak): **Q3a hu A0 track KÉSZ (`076dc9b`).**
  `data/words/hu/a0.json` = 100 kártya (10 topic × 10, id 6100-6199, turista top-100, mind 4 nyelv
  + 4 mondat), `data/topics/hu/a0.json` (10 topic, FB21-minta) + `data/sublevels/hu/a0.json` (3
  al-szint), words.ts + topics.ts hu A0 wiring (4 sor). Új `scripts/audit-corpus-hu.mjs` gate:
  magyar-tudatos stemmer (toldalék-strip, tő-belseji magánhangzó-rövidülés víz→vizet, epentézis
  étterem→éttermet, rendhagyó igeparadigmák jövök→jön), CSAK A0 (a hu/a1.json 6-kártyás stub védett,
  A1+ akkor csatlakozik, ha valódi track lesz). A meglévő `data/exams/hu/a0.json` 13 kérdése tanított
  szókincsre + helyes magyarra átírva (2 nyelvtani hiba is: „Ő tanár nem.", dupla-állítmányos 3015).
  Fable utó-QA a Sonnet-korpuszon: „vízet"→„vizet" helyesírás-fix + regiszter-fix (6122). Gate:
  audit-hu P1=0 + P1-exam=0, audit es/en érintetlen (P1=0), tsc 0, jest 65/65. Hátra a hu-ágból:
  hu A1+ (Q1 mátrix-cella), telefon-verify.
- **2026-07-12** (Fable + 4 párhuzamos Sonnet subagent, éjszakai műszak): **Q3b en A1/A2 mélyítés
  KÉSZ a blokk-plafonig.** A1: +184 kártya 2 batchben (`6037ce9` +96 id 5201-5296, `9bd727a` +88 id
  5297-5384) → mind a 24 topic 16 kártyás, A1 = 384. A2: +210 kártya 2 batchben (`36b8d48` +112 id
  5580-5691, `cef4119` +98 id 5692-5789) → mind a 15 topic 26 kártyás, A2 = 390. en-track összesen
  **874 kártya**. Párhuzamos-batch dup-ok javítva (chicken→goat, camera→cable), Fable utó-QA:
  nővérem→húgom a younger/youngest mondatokban. Gate minden batch után: validate OK, audit-en
  P1=0 + P1-exam=0, tsc 0, jest 65/65. ⚠️ Id-blokkok majdnem tele (A1: 15, A2: 10 tartalék);
  az eredeti +400-500/+500-700 cél NEM fért el, tovább-sűrítés = user-döntés (blokk-bővítés).
- **2026-07-22** (Opus): **Aktív-használat statisztika feature KÉSZ + commitolva** (uncommitted
  WIP volt a fában, befejezve + zöldre hozva). Új `lib/usageStats.ts` (tiszta helper:
  `localDateString`, `buildDayRange`, `summarizeUsage`) + `lib/usageTimer.ts` (foreground+interakció-
  kapuzott perc-számláló, AppState-tudatos, idle-timeout 30 s, „+1 perc wauuuuuuuu" toast-listener).
  Új `usage_minutes (date PK, minutes)` tábla mindkét DB-ben (`addUsageMinute`, `getUsageStats`,
  IDatabase szinkron), app-szintű (nem pair-scoped). Új `app/(tabs)/stats.tsx` Statisztika tab
  (ma/hét/összes/legjobb-nap/aktív-napok tile-ok, 7-napos oszlopdiagram, tanulási haladás: streak/
  elsajátított/mai ismétlések) + `components/UsageToast.tsx` + root-layout timer-wiring (capture-phase
  `noteInteraction`) + tab regisztráció. i18n ×4 (`tabs.stats`, `usage.plusOneMinute`, `stats.*` blokk).
  Új tesztek: `usageStats.test.ts` + `usageTimer.test.ts`. Gate: tsc 0, jest **76/76** (65→76, +11).
  Adat-JSON érintetlen. ⏳ Eszköz-verify a következő buildben (toast + Statisztika tab telefonon).
- **2026-07-30** (Opus): **Feedback-forduló FB66–FB81 KÉSZ** (user: „feedbackok megcsinálása").
  15 új sheet-sor triage-elve (07-28 → 07-30), 2 döntés AskUserQuestion-nel pinnelve.
  Commitok: `0b40bb4` 5 A1 mondat-QA (let's eat, somos amigos egyszerűsítve, hago la cama,
  la llave, me lavo) · `98106ad` üres gépelt válasz felfedi a helyes alakot (`skipped`
  eredmény) + gépelős képernyő görgethető (fejléc-ütközés vége) · `121832f` napi új-szó
  keret (`lib/newWordBudget.ts` + `learn_settings.daily_new_limit/new_bonus/new_bonus_date`,
  Settings stepper, Done-képernyő „+5 új szó") + stats „Ma" perc-egység · `c0c6aa2` napi
  üdvözlés az első indításkor (`user_meta.last_open_date` + `claimDailyGreeting`) ·
  `fdcd8ac` kártya „i" info-note (`lib/cardNotes.ts`: kézi note_<lang> nyer, különben RAE
  pair-noun / unos-unas szabály; kézi note las cortinas + la verdura). FB66 a user által
  visszavonva, FB80/FB81 info (adat helyes). Gate: tsc 0, jest **92/92** (82→92: +4
  capNewWords, +6 cardNotes), audit-corpus P1=0/P2=0. ⏳ Eszköz-verify a következő buildben.
- **2026-08-07** (Opus): **Feedback-forduló FB89–FB96 KÉSZ** (user: „kimacha app feedback
  értékelés és megnézése és javitása"). 12 új sheet-sor (08-04 → 08-07), 1 döntés
  AskUserQuestion-nel pinnelve: a mondat egyetlen célja a szó-megerősítés, és a leggyakrabban
  hibázott szavakhoz tartozzon. FB89 = P1 bug, a mondat-áradat gyökéroka: a pool a szabad
  helyeket töltötte mondattal, új `lib/sentenceMix.ts` (4:1 slot-cap + leggyengébb-szó-előre
  rangsor) mindkét db-implementációban. FB90 hibás válasz után magától nyíló ℹ️ jegyzet
  (gépelős + easy kártya). FB91/92/93/94 adat (testrész-névelő jegyzet 1115+1119, sala↔salón
  szétbogozás 1835, gyűrű-mondat csere 1687, pizsama alany-elhagyás jegyzet 1685). FB95 info,
  FB96 stale (FB83 kész, csak nem volt telepítve). **FB97** a user „sala/salón kétszer
  van benne?" kérdéséből: korpusz-takarítás, 177 azonos jelentésű duplikátum törölve
  (alacsonyabb szint nyer) + 538 ütköző szó-id feloldva (`scripts/dedupe-words.mjs`,
  generált `lib/wordMerges.ts`, DB-migráció mindkét implementációban, `pickSurvivor`
  haladás-összefésülés, őrző teszt). Korpusz 3478 → 3301 kártya, A0/A1 id-k érintetlenek.
  Gate: tsc 0, jest **117/117** (102→117: +7 sentenceMix, +8 corpusIntegrity),
  audit-corpus es/en/hu P1=0/P2=0, lint 18 = alapvonal. ⏳ Eszköz-verify + APK.
- **2026-08-08** (Opus): 3.0.10 bump + APK a Drive-ra (00:06-os build), majd **FB98**
  chat-kérésből (mondatvégi pont ne legyen hiba: `charDiff` írásjel-levágás + helyesírás-
  tréner `stripTrailingPunct`), utána **feedback-forduló FB99–FB101 KÉSZ** (user:
  „kimacha app feedback csinálás"), 3 új sheet-sor 05:27–05:41-ből, mind a 3.0.10-en.
  FB99 = a mondat-torlódás maradék gyökéroka: a DB a lekért szavakhoz mérte a mondat-
  slotokat, de a `capNewWords` (FB77 napi új-szó keret) utána vette ki a szavakat, így
  kimerült kereten mondat-túlsúly lett; fix `MAX_SENTENCES_PER_SESSION = 5` plafon +
  `capSentencesToCadence` a végleges listán. FB100 Stats „Ütemezés" kártya (most
  esedékes + ma/holnap/2-3/4-7/héten túli sávok + következő frissülés,
  `lib/schedulePreview.ts` + `getScheduledWordDueDates` mindkét db-ben, 4 nyelven).
  FB101 a Settings lap `ScrollView`-ba került (az alsó sorok, köztük az FB82 verzió-
  kiírás, elérhetetlenek voltak). Gate: tsc 0, jest **135/135** (123→135: +5 sentenceMix,
  +7 schedulePreview), audit-corpus P1=0/P2=0, lint 18 = alapvonal. ⏳ Eszköz-verify + APK.
- **2026-08-16** (Opus): három szálon ment a nap. (1) A `feat/placement-exams-progress`
  ágon állt ~8 300 sornyi nem-commitolt munka (B1/B2/C1 topic-fák, `wordPhase` +
  `topicMastery` modul, FB112-115 új-szó-keret fix, 3.0.27 bump) — gate zöld volt
  (tsc 0, jest 181/181, audit P1=0 es/en/hu), négy commitban lezárva (`3c20a8c`,
  `960fdc4`, `b9113d2`, `46c2fac`); HEAD addig nem is fordult volna, mert az
  `index.tsx` már a nem-commitolt `newWordBudget`/`wordPhase` API-t hívta.
  (2) **Feedback-forduló FB131–FB134 KÉSZ** (user: „kimacha app feedbaack building"),
  4 új sheet-sor 08-15/08-16-ból: FB132 nehézség-kapcsoló (ékezet számít, per pár,
  `answerMatch` + `charDiff` fold-szétválasztás, Settings „Nehézség" szekció),
  FB133 Done-képernyő +5/+10/+15 teli gombokkal, FB134 tapa-jegyzet; plusz a korábbi
  FB131 (`6a8ed03`) visszamenőleg dokumentálva. Gate: tsc 0, jest 190/190, lint 17
  (alapvonal 18). APK 3.0.28 buildelve + Drive-ra töltve (`kimacha-a1-release.apk`,
  SIZE_MATCH, a bundle-ben ellenőrizve az új stringek, tehát nem stale JS bundle).
  (3) **Q2 token-burn +165 kártya** 5 commitban (részletek a Q2 szekcióban), kumulált
  C1 3 479 → 3 644 a 4 000-es XLex-célból. ⏳ Eszköz-verify: FB132-134 a 3.0.28-on.
- **2026-08-18** (Opus): **Feedback-forduló FB137–FB139 KÉSZ** (user: „kimacha app
  feedback codeing ... teszteld le ... csinálj egy buildet"). 5 új sheet-sor 08-16
  10:24 → 08-17 22:26, ebből kettőt (10:24, 10:25) már az FB135/FB136 lefedett, tehát
  három ÚJ jegy: **FB137** P1 bug, a mondat-összerakós kártya a gépelős kártyák
  Levenshtein ≤2 tűrését használta, így egy karakternyire lévő csapda-csempét
  („hacen" a „hace" helyett) jónak fogadott el → `sentenceBuildMatch` csempéről
  csempére (`f3a83ab`); **FB138** a szó-kártya „✏️ Írd le" mezője a látható megfejtés
  alatt ült (a gyakorlás másolás volt) és hiba után bezárult → a megfejtés rejtve
  marad, míg a mező nyitva van, és újra beírható (`c6e79dc`); **FB139** új szó eddig
  csak az aktív témából jött, tehát a „+15 új szó" annyit adott, amennyi ott maradt →
  `borrowNewWords` a legközelebbi témákból tölti a hiányt, a kölcsönzött kártya fölött
  „Másik témából: …" sor, i18n ×4 (`313d17b`). Gate: tsc 0, jest **212/212**
  (197→212: +6 sentenceBuildMatch, +5 borrowNewWords, +4 borrow-smoke az igazi A1
  korpuszon), audit-corpus es/en/hu P1=0/P2=0, lint 17 (alapvonal 18).
  **APK 3.0.30 buildelve** (`android/app/build/outputs/apk/release/app-release.apk`,
  versionCode 30, 01:26); a bundle friss (`fromTopic` + `sentenceBuildMatch` benne van,
  tehát nem a 3.0.29 JS-e). Két ÚJ release-csapda dokumentálva az AGENTS.md-ben:
  `JAVA_HOME` a 11-es JDK-ra mutat (Gradle 17-et kér) és nincs `ANDROID_HOME` /
  üres `android/local.properties` — mindkettő úgy bukik, hogy a régi APK bent marad,
  tehát sikernek látszik. ⏳ Drive-deploy + eszköz-verify: FB137-139 a 3.0.30-on.
- **2026-08-20** (Opus): **Feedback-forduló FB140–FB148 KÉSZ** (user: „kimacha app
  feedback upgrade" + „fix them és állítsd be úgy hogy ha feedbackeket kapsz akkor
  lásd, hogy melyik kártyáról és melyik verziójú kimachaból kapod"). 9 új sheet-sor
  08-18 09:50 → 08-19 18:34, köztük az ELSŐ hu→en (angol-célú) teszt-jegyek.
  Három jegynek EGY gyökéroka volt: a WIP-szünet (`newWordIntake`) a „+N új szó"
  bónuszt a plafonba is beleszámolta, ezért torlódásnál a gomb semmit sem adott
  (**FB140**), friss kurzusban ettől üres lett a sor és „bugos szint"-nek látszott
  (**FB141**), és semmi nem mondta ki, miért csak ismétlés jön (**FB142**) → a
  bónusz most átmegy a szünetön, a Done képernyő pedig kiírja a kör összetételét
  („N új szó, M ismétlés") és a torlódás okát. További: **FB143** billentyűzet
  lemegy félre-koppintásra (kártya + helyesírás + feedback-modal Pressable,
  `keyboardDismissMode="on-drag"`), **FB144** hiányzó rendszer-TTS-hang esetén az app
  inkább néma, mint rossz nyelvű felolvasás (`lib/speech.ts` + Beállítás-figyelmeztetés),
  **FB145** szó-javaslat/autofill kikapcsolva minden válasz-mezőn (`lib/inputProps.ts`),
  **FB146** az összerakós mondat után is van „✏️ Írd le" gyakorlás, **FB147** heti cél
  elérve = 🏆 nagy gratuláció + zöld „✓ KÉSZ", **FB148** ünneplő overlay a tanult
  nyelvre + két beégetett magyar string i18n-be. Plusz a chat-kérés: a feedback-sor
  mostantól viszi a buildet is (`lib/appBuild.ts`, `v3.0.30 (30) · word:brother`
  a `Current Card` oszlopban + külön `appVersion` mező a jövőbeli sheet-oszlopnak).
  Gate: tsc 0, jest **228/228** (212→228), audit-corpus es/en/hu P1=0/P2=0,
  lint 17 (alapvonal 18). **APK 3.0.31 (versionCode 31) buildelve + Drive-ra töltve**
  (`kimacha-a1-release.apk`, 104 207 497 byte, SIZE_MATCH, FILE_ID
  `1SwZFdG5mLk1-Bh29G6HVQjNKmZTxdCiQ`); a Hermes-bundle friss, benne az új stringek
  (`Ebben a körben`, `Nincs telepítve`, `✓ KÉSZ`, `appVersion`), tehát nem a 3.0.30
  JS-e. A `strings` parancs a többbájtos találatokat szétvágja, ezért a bundle-ellenőrzés
  nyers bájt-kereséssel megbízhatóbb (utf-16-le + utf-8). ⏳ Eszköz-verify: FB140-148.
- **2026-08-20** (Opus, „token égetés"): **Q2 spanyol szóbővítés CÉL ELÉRVE**, +360
  kártya 3 commitban (`a1e22ce`, `f70370c`, `eed1c35`). B2 519→781, C1 404→502,
  kumulált B2 3 502 / C1 **4 004**, tehát az XLex-sávok teljesítve, C2 nem épül.
  Forrás DELE/Plan Curricular domének; a legvékonyabb topicokat töltöttem fel
  (adverbios_modo_grado 11→40 és társai), a ~20%-nyi más szinten már tanított
  jelöltet az append-script fogta, a hiányt ugyanabban a körben pótoltam.
  Gate: tsc 0, jest 228/228, audit-corpus es/en/hu P1=0/P2=0.
- **2026-08-20 (folytatás, „égesd tovább, az en ághoz csináld meg az ág-kapcsolót")**:
  **`--branch en|hu` kapcsoló** az `append_level_words.mjs`-ben (`bc229f3`): ágon a
  FEJSZÓ a tanított nyelv, a dedup csak az adott ágon belül fut (ugyanaz a spanyol
  glossza minden ágban jogos), a szintfájl `data/words/<branch>/<level>.json`.
  Plusz **ismeretlen-topic őr** (`3c67991`): egy kártya „cualidades" topickal ment be
  (a spanyol fa topicja), ami láthatatlanná tette volna, mert a Learn sor mindig
  topicra van szűkítve; a script most eldobja az ismeretlen topic-idt.
  **en A1: 384 → 1105 kártya, 12 batch, kumulált A1 484 → 1 205** (sáv ~1 200 ✅).
  Az en-audit (`audit-corpus-en.mjs`) minden batchnél fogta a szinten túli szavakat
  (soft, sweet, wear, cheap, university, backpack…), a mondatok ezért a
  taught(A0∪A1) halmazon belülre lettek húzva, nem a szó került előrébb.
  Gate minden batch után: tsc 0, jest 228/228, audit-corpus es/en/hu P1=0/P2=0.
  **en A2: 390 → 802 kártya, 6 batch, kumulált A2 1 595 → 2 007** (sáv ~2 000 ✅).
  Ezzel az ANGOL ág mindkét megírt sávja teljesítve: A0 100 / A1 1 105 / A2 802.
  Hátra az en ágon: B1+ szint egyáltalán nincs megírva (se szó, se topic-fa), az
  új szint-tervezés, nem szóbővítés.
- **2026-08-20 (folytatás, „bővítsd a szavakat és tesztelj")**: **magyar ág A1 sáv
  ZÁRVA**. hu A1 777 → 1 103 kártya, 6 batch, kumulált A1 877 → **1 203** (sáv
  ~1 200 ✅). A `--branch hu` kapcsoló ugyanazon az úton ment, mint az en ág.
  Tanulság: az ELSŐ batch 71-ből 42-t eldobott (a hu ág már tanította őket), ezért
  a második batchtől a teljes tanított hu fejszó-lista (906 szó) elé volt húzva a
  válogatás, onnantól a skip-arány ~0%. A hu-audit (`sentence_hu ⊆ taught`) 5
  mondatot fogott (friss, száraz, utazom, kelek, út) — ezek közül a hiányzó szavak
  egy része külön kártyaként ment be, a többi mondat lett visszahúzva.
  Adat-higiénia: 3 kártyán magyar szó maradt a SPANYOL mezőben (ritkán, kétezer,
  nem szabad) — javítva; érdemes a `validate_words.py`-ba egy „es-mező nem lehet
  azonos a hu-mezővel" ellenőrzés.
  Gate: tsc 0, jest 228/228, audit-corpus es/en/hu P1=0/P2=0, lint 17 (alapvonal 18).
  **Állás mindhárom ágon: es kumulált C1 4 004 ✅ / en A1 1 205 + A2 2 007 ✅ /
  hu A1 1 203 ✅. Hátra: hu A2+ és en B1+ szint-TERVEZÉS (topic-fa nincs), nem
  szóbővítés.**
- **2026-09-05 (Opus tervezett, Sonnet kezdte, Opus fejezte be): ITER5, Minimál
  tanulóképernyő-chrome.** Kálmán panasza: „a UI elkezdett massy lenni". Ok: 168
  visszajelzés, és majdnem mind saját ÁLLANDÓ UI-elemet kapott, három render-ág
  kézzel stackelte ugyanazt a fejlécet. Három mockup-változatból (Minimál /
  Javaslat / Pakli / Hüvelyk) Kálmán a **Minimál**-t választotta.
  Spec: `ITER5.md`. Terv-lap + névjegyzék: `Kimacha Minimál` és
  `Kimacha UI-nevek` artifact, plusz `docs/UI-NEVEK.md` a repóban.
  Eredmény: új `components/LearnChrome.tsx` (egy státusz-sor: szint · témakör ·
  ismert/összes · 🌱 · 🎓, alatta 5 képpontos haladás-vonal, ami koppintásra a
  MEGLÉVŐ `ProgressMeter`-t nyitja ki), a mód- és kölcsön-jelzés chipként a
  kártyára költözött (az `EasySentenceCard` új opcionális `chips` propot kapott),
  a két overlay egy toast-slot lett, a `subLevelLine` KIESETT (Kálmán döntése, a
  tech-fán megvan). Törölve: `HEADER_RESERVE_MIN`, `HEADER_FONT_SCALE_CAP`,
  `headerBottom` + `onLayout` mérés, és 16 elárvult stílus.
  `index.tsx` 336 sorral rövidebb lett (−250/+93). Kapu: tsc 0, jest 457/457,
  lint 70 (alapvonal változatlan), `data/` és mindkét `database` érintetlen.
  Hátra: eszköz-verify a következő APK-n (font_scale 1.5-nél is elférjen a sor).
- **2026-09-05** (Opus): **Feedback-forduló FB169 KÉSZ** (user: „nezd meg a kimacha
  app feedbackjét"). 1 új sheet-sor a FB168 óta (09-05 17:39, v3.1.3 (37)): a fejléc
  haladás-csíkjának kék részéből egy rózsaszín szakasz mutassa, hány szó vár még
  ismétlésre, és rövidüljön, ahogy fogynak. Kálmán döntése: a rózsaszín A KÉKBŐL vesz
  el (nem külön szakasz a sáv végén). `LearnChrome` új `reviewLeft` propja + második
  fill-View a kék jobb szélén; `index.tsx` a hátralévő sorból számolja a distinct,
  nem-új `wordId`-kat. Kapu: tsc 0, jest 461/461 (+4 új `LearnChrome` teszt), lint 70
  (alapvonal változatlan). Hátra: eszköz-verify a következő APK-n. Részletek: `AGENTS.md`
  „Feedback, 2026-09-05 forduló".
- **2026-09-06** (Opus): **FB170 KÉSZ** (chat-kérés képernyőképpel: „azt akarom hogy a
  check rész az pont a klaviatúrám felett legyen és nem kell ketto"). A gépelős kártya
  két Check gombja (FB5 kártyán belüli + régi kártya alatti sáv) helyett EGY dokkolt
  gomb a billentyűzet felső élén: `styles.dockedAction`, `bottom: kbHeight`, a magasság
  a `Keyboard` did-show/hide eseményeiből (az app.json `pan` marad, az a P0 IME-villogás
  javítása). `DOCK_RESERVE = 76` + `kbHeight` a scroll paddingjában. Kapu: tsc 0,
  jest 461/461, lint 70 (alapvonal változatlan). Hátra: eszköz-verify a következő APK-n.
- **2026-09-06** (Opus): **FB171 KÉSZ** (chat: „szeretném, ha lenne gy rózsaszín szám ami
  azt mutatja még mennyi szót kell ismételni"). A FB169-es sáv-farok mellé a szám is
  kikerült: `🔁{reviewLeft}` a fejléc jobb oldalán, `REVIEW_COLOR` (#F472B6), nullánál
  rejtve, ugyanaz a prop hajtja, mint a sávot. Kapu: tsc 0, jest 463/463 (+2 teszt),
  lint 70 (alapvonal változatlan). Hátra: eszköz-verify a következő APK-n.
- **2026-09-06** (Opus): **FB172 KÉSZ** (3.1.5 telefon-teszt: „a check es a klaviatura
  kozott túl nagy a hely fent a review tul messze van a tetejétől"). (1) A dokkolt Check
  egy navigációs-sávnyival a billentyűzet fölött lebegett: a nyers `keyboardDidShow`
  magasság a képernyő aljától mér, a sáv `bottom`-ja viszont a konténeréhez. Most
  `measureInWindow` + `endCoordinates.screenY` különbségéből számol (`syncDock`), tehát
  eszköz- és navigációsáv-független. (2) A gépelős kártya `typingCard` módosítót kapott
  (`minHeight: 0`, `flex-start`, `paddingTop: 18`), így a Review chip a kártya tetején ül.
  Kapu: tsc 0, jest 463/463, lint 70 (alapvonal változatlan).
- **2026-09-06** (Opus): **FB173 + FB174 KÉSZ** (3.1.6 telefon-teszt: „feedback gomb
  egybe csúszott" + „azt akarom látni, hogy mennyi van osszesen amit ismételni kell").
  FB173: a `FeedbackButton` `bottomOffset` propot kapott, a tanuló-képernyő
  `DOCK_RESERVE + dockOffset`-tel hívja, így a 💬 a dokkolt Check sáv fölé kerül.
  FB174: új `countDueReviewWords` / `countDueReviewWordsForLevel` a DB-ben (DISTINCT
  esedékes ismétlés-szó, limit nélkül); az `applyQueueSupply` ebből számol adag-méretet
  és hátralévő adagszámot, a fejlécben a 🔁-szám alatt `{size}/{left}` sor jelenik meg.
  Kapu: tsc 0, jest 465/465, lint 70 (alapvonal változatlan).
- **2026-09-06** (Opus): **FB175 KÉSZ** (3.1.7 telefon-teszt: „a kek csik belecsúszott
  ... feleslegesen van 2 szer ott a 32"). A FB172-es mérés képernyő- és ablak-koordinátát
  kevert (`endCoordinates.screenY` vs `measureInWindow`), ezért a gomb hol lebegett, hol
  a billentyűzet alá került. Számolás helyett: `app.json` → `softwareKeyboardLayoutMode:
  "resize"` (a P0 IME-villogás javításának 1. pontja, KAV `behavior` androidon marad
  `undefined`) + `tabBarHideOnKeyboard: true`, így a `bottom: 0` maga a billentyűzet
  felső éle. A `32/5` adag-sor `×5`-re rövidült. Kapu: tsc 0, jest 465/465, lint 70.
  ⚠️ Eszköz-teszten figyelni: a resize a régi villogás egyik résztvevője volt.
