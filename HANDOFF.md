# HANDOFF — v1.3: Két-kártya motor (értés + beszéd) + A0/A1 vizsga

> **Ez egy MOTOR-REBUILD, nem gyors patch.** v1.3 = a tanulómotor átáll
> recepció/produkció **két külön FSRS kártyára** szavanként, és erre épül az
> A0 + A1 vizsga. Egy nagy kiadás (user döntés: B beolvad v1.3-ba).
>
> **Olvasd:** `EXAM_SPEC.md` = vizsga MECHANIKA spec (súlyozott válogatás, retry,
> sessions, analytics — ezek érvényesek). DE a **mastery-definíciót** (EXAM_SPEC 1.
> szekció, „1 kártya/szó") ez a doksi **FELÜLÍRJA**: mastery mostantól a
> PRODUKCIÓS kártyán mérve.
>
> **Expo v56 docs:** https://docs.expo.dev/versions/v56.0.0/ — kód előtt nézd.

---

## 1. Miért (a tervezési indok)

Értés (es→hu: látod `gato` → "macska") és beszéd (hu→es: gondolod "macska" →
előásod `gato`) **két külön készség.** Passzív szókincs ≫ aktív. App célja =
BESZÉLGETNI → a beszéd a mért fő készség, az értés az on-ramp.

Eddig: 1 db `type='word'` kártya, ami reps-fázisokkal (reps0 es→hu flashcard →
reps1 hu→es flashcard → reps2+ hu→es gépelés) bundle-ölte a két irányt. Egy
"mastery" szám összemosta őket → nem látszott elválik-e az értés a beszédtől, és
a kapu nem a beszédet mérte.

**Új modell (B):** szavanként 2 független kártya, külön ütemezés, külön mastery.
Kapu = **beszéd-mastery**. Az on-ramp megmarad: a beszéd-kártya csak akkor nyílik,
ha az értés-kártya már érett.

## 2. Beégetett döntések (user) — NE kérdezd újra

| Téma | Döntés |
|------|--------|
| Modell | **B**: 2 kártya/szó (recognition + production), külön FSRS state |
| Kiadás | B beolvad v1.3-ba, egy nagy release. Nincs köztes ship |
| Kapu (gate) | **beszéd**(production)-mastery: production kártya `state≥2 && stability>10`, szint szavainak **80%-a** |
| Pass küszöb | **80%** a vizsgán (spec szerint, 20/25) |
| Scope | CSAK A0 + A1 vizsga kiadhatóra. B1–C2 vizsga / NPC / STT / backend = NEM v1.3 |
| Migráció | meglévő `type='word'` → recognition kártya (state örökli); production kártya FRISS state-tel. **Jelenlegi beszéd-haladás resetel** — pre-release, vállalt |
| A1 content | KÉSZ (507 szó, 38 topic). Ne bővítsd, ne írd át |

---

## 3. Architektúra — háromlépcsős kártya-lánc

Minden szó 3 kártyát kap (a `cards.type` oszlop hordozza a készséget):

| type | irány | gyakorlat | mikor nyílik |
|------|-------|-----------|--------------|
| `recognition` | es→hu | flashcard reveal (értés) | azonnal (új szó) |
| `production` | hu→es | szó begépelése (beszéd) | ha recognition **érett** |
| `sentence` | hu→es mondat | tap-to-order → gépelés | ha production **érett** |

„Érett" = `state≥2 && stability>10` (ugyanaz mint a mastery küszöb).

Unlock = `buried` flaggel: a production és sentence kártya **`buried=1`-gyel jön
létre** (rejtett, nem jön a sorba). A grade-flow nyit: amikor a recognition kártya
eléri az érettséget → production `buried=0` + `due=now`; amikor a production érik →
sentence `buried=0` + `due=now`.

> Ez megőrzi a recepció→produkció→mondat on-ramp-et, csak most külön FSRS state-tel.

---

## 4. DB változások (`lib/database.ts` + `lib/database.web.ts`)

### 4a. Kártya-típusok
- `ensureCardsForWords` (`:229`): a `['word','sentence']` lista helyett
  **`['recognition','production','sentence']`**.
- A `production` és `sentence` kártyát **`buried=1`-gyel** seedeld (a `recognition`
  marad `buried=0`). Az `INSERT` jelenleg nem ad `buried`-et → DEFAULT 0; tedd
  explicitté production/sentence-re az 1-et (külön INSERT vagy paraméter).
- `ensureCard` (`:216`) hasonlóan, ha máshol hívják.

### 4b. Minden `type='word'` query átírása
Keresd meg az ÖSSZES `type = 'word'` előfordulást és igazítsd a készséghez:
- `getMasteredWordCount` (`:462-475`): `type='word'` → **`type='production'`**
  (a kapu a beszédet méri). Ez a v1.3 gate forrása.
- `getNextWordCards` new/review split (`:335`, `:340`, `reps=0` vs `reps>0`):
  a fázis most NEM reps, hanem KÁRTYA. A recognition és production külön sor.
  Strukturáld át: a sor a due `recognition` / `production` / `sentence` kártyákból
  jön (lásd 5. tanulóloop). A reps-alapú fázis-szétválasztás megszűnik.
- Bármely más `type='word'` (analytics, topic-reps) → értelmezd: ha „látta a szót"
  szemantika kell → recognition; ha „tudja produkálni" → production.

### 4c. Új/igazított metódus: érettség-alapú unlock
A grade után kell egy lépés ami a következő stage kártyáját unburyolja. Ajánlott
új DB-metódus (native + web):
```ts
// Ha a kártya érett (state>=2 && stability>10), unbury-olja a megadott típusút.
unburyIfMatured(wordId: number, maturedType: string, nextType: string): Promise<void>;
// pl. unburyIfMatured(id,'recognition','production') és (id,'production','sentence')
```
Vagy a grade-flow-ban (index.tsx) explicit: érettség-ellenőrzés után `unbury` hívás
(`buried=0` + `due=now`). Implementáld ahogy tisztább, de a lánc MŰKÖDJÖN.

### 4d. Mastery — két irány (analytics + esetleg UI)
- `getMasteredWordCount(level)` → production-alapú (a kapu).
- Opcionális de ajánlott: `getRecognitionMasteredCount(level)` az értés-bar-hoz +
  analytics-hoz. (Ha kihagyod, jelöld.)

### 4e. Migráció (a meglévő `open()` migrációs blokkba, a lang_pair után)
A jelenlegi telepítések `type='word'` sorokkal rendelkeznek. Egyszeri migráció:
1. `UPDATE cards SET type='recognition' WHERE type='word'` (állapot örökli).
2. Minden érintett szóra hozz létre `production` kártyát FRISS (`createEmptyCard`)
   state-tel, `buried=1` (vagy `buried=0` ha a recognition már érett — eldöntheted,
   de a friss state miatt úgyis újra kell érlelni; egyszerűbb mindig `buried=1` és
   az első load unburyolja az érett recognition-höz tartozót).
3. `sentence` kártyák már léteznek (régi `['word','sentence']`); állítsd
   `buried=1`-re amíg a production nem érett (vagy hagyd, és a lánc rendezi).
4. Guard: csak ha még nincs migrálva (pl. nincs egyetlen `type='recognition'` sor se).
   Kövesd a meglévő migrációs minta stílusát (`:145-199`).

> **Web (`database.web.ts`):** MemoryDB-ben ugyanez logikailag (nincs perzisztens
> régi adat, de a kártya-típusok + unbury + production-mastery konzisztens legyen).

---

## 5. Tanulóloop (`app/(tabs)/index.tsx`)

Jelenleg (`:71-96`) a reps a 'word' kártyán adja a fázist. Átírás:

- A sor (`queue`) most a due **recognition / production / sentence** kártyákból áll
  (buried=0). A kártya `type`-ja adja a gyakorlat módját:
  - `recognition`: **es→hu flashcard** (mutat spanyol, reveal magyar, self-grade).
  - `production`: **hu→es gépelés** (mutat magyar, begépeli spanyolt; első pár
    expozíció lehet reveal-scaffold, utána tiszta gépelés — tartsd a meglévő
    typing UI-t, irány hu→es).
  - `sentence`: tap-to-order (új) → gépelés (érett) — meglévő `EasySentenceCard` /
    typing branch, irány hu→es.
- A `TypingDir` / reps-fázis logika (`:24,:71-96`) leegyszerűsödik: az irányt a
  kártya `type` adja, nem a reps.
- **Grade után:** FSRS update a saját kártyára (`updateCard(wordId, type, card)`),
  majd **unlock-lánc**: ha recognition most lett érett → unbury production; ha
  production most lett érett → unbury sentence (4c).
- Topic-unlock (`computeUnlockedTopics`, `:101`): a „szó látva" feltétel most
  recognition-reps>0 alapú legyen (értés = a szó bevezetve).

---

## 6. Vizsga (A0 + A1) — EXAM_SPEC mechanika + beszéd-fókusz

A vizsga MECHANIKÁJA az EXAM_SPEC szerint (súlyozott válogatás 3., pass/fail+retry
4., recordExamAttempt/Session, analytics 11.). Az alábbiak a B-modellhez igazítás:

### 6a. Kapu
`examAvailable = getExamQuestionsForLevel(level).length >= passThreshold(level)
&& productionMasteredPct >= 80`, ahol `productionMasteredPct =
getMasteredWordCount(level) / totalLevelWords(level) * 100` (production-alapú, 4b).
- `index.tsx` `:172`/`:280` `getReviewedWordCount` → az új production-mastery forrás.
- `:426` `>= 70` → `>= 80` + pool-check.

### 6b. Méret / pass (változatlan, spec 2.)
A0=25, A1=25 kérdés, pass 20/25. `examSize`/`passThreshold` már megvan (`data/exams.ts`).

### 6c. Kérdéstípusok — beszéd-súlyozott (a kapu beszédet mér → a vizsga is)
- **A0:** `gap` (feleletválasztós = **cued produkció** spanyolul) a fő + pár `es→hu`
  translate (értés-ellenőrzés). **NINCS szabad hu→es gépelés A0-n** (kezdőnek hideg
  produkció túl durva — a gap a scaffold).
  → **Tartalom:** `data/exams/a0.json` jelenlegi 10 db `hu_es` translate (id 31–40)
  konvertáld: vagy **`es_hu`-ra** (értés), vagy alakítsd `gap` cued-produkcióvá.
  Dedup a meglévőkkel. A0 marad 40 kérdés.
- **A1:** `gap` + **`hu_es` translate (szabad produkció)** + (ha van) mondat-jellegű.
  Itt vezetjük be a hideg produkciót. A1 marad 30 kérdés, irányok maradnak.
- ExamCard már `normalizeAnswer`-t használ (`:73-75`) — kész.

### 6d. Súlyozott válogatás + retry + sessions
EXAM_SPEC 3./4./7. szerint `ExamMode.tsx`-ben (most hardcode 10/9, `:25,:34,:36,:51,:59,:79`):
`size=examSize(level)`, `pass=passThreshold(level)`, `getExamLastResults` súlyozás,
`recordExamAttempt` kérdésenként, `recordExamSession` a végén (PASS+FAIL), FAIL→„Újra".

---

## 7. analytics + i18n

### analytics (`lib/analytics.ts`, spec 11.)
`getExamSummary()` → `examsTaken`, `examsPassed`, `examPassRate`, `lastExamLevel`.
Ajánlott plusz: `recognitionMasteredPct` vs `productionMasteredPct` (lásd 4d) — hogy
lásd elválik-e értés/beszéd a usereknél.

### i18n (`lib/i18n/{hu,en,es,de}.ts`), Title Case gombok
```
exam.retry           Újra / Retry / Reintentar / Nochmal
exam.backToLearning  Vissza A Tanuláshoz / Back To Learning / Volver Al Aprendizaje / Zurück Zum Lernen
exam.notYet          Még Nem, De Közel Vagy! / Not Yet, But You're Close! / ¡Aún No, Pero Estás Cerca! / Noch Nicht, Aber Fast!
done.examProgress    (pct) => `${pct}% beszéd-mastery — vizsga 80%-nál`  (+ en/es/de)
```

---

## 8. Commit terv (sorrend) + elfogadás

1. `feat: split word cards into recognition+production (schema + seed + migration)` — 4a,4b,4e
2. `feat: three-stage unlock chain (recognition→production→sentence)` — 4c,4d + 5 unlock
3. `feat: rebuild learning loop on per-skill cards` — 5 (loop/grade/topic-unlock)
4. `feat: exam gate on production mastery (80%)` — 6a (index + DoneScreen)
5. `feat: level-scaled exam, weighted selection, instant retry` — 6d (ExamMode) [EXAM_SPEC 3/4/7]
6. `fix: A0 exam = cued production + comprehension (no cold hu→es typing)` — 6c content
7. `feat: exam analytics + per-skill mastery metrics` — 7 analytics
8. `feat: i18n for exam retry/fail/progress` — 7 i18n

### Elfogadási kritérium (v1.3)
- [ ] Minden szó 3 kártya (recognition/production/sentence); production+sentence buryolva indul.
- [ ] Migráció: meglévő `type='word'` → recognition; production friss; guardolt, idempotens.
- [ ] Unlock-lánc: recognition érik → production nyílik → sentence nyílik.
- [ ] Kapu = production-mastery ≥80% (NEM recognition, NEM reviewed-count).
- [ ] A0 vizsga: gap (cued produkció) + es→hu, NINCS hideg hu→es gépelés; 25 kérdés, 20/25 pass; FAIL→Újra.
- [ ] A1 vizsga: gap + hu→es szabad produkció; 25 kérdés, 20/25 pass; pass → B1 szint.
- [ ] `exam_attempts`+`exam_sessions` íródik (native+web); súlyozott válogatás visszahozza a bukottakat.
- [ ] analytics: vizsga-mezők + (ajánlott) recognition vs production mastery.
- [ ] i18n 4 nyelv; Title Case gombok.
- [ ] A1 content (507 szó/38 topic) sértetlen.
- [ ] `tsc --noEmit` tiszta (kivéve pre-existing `ExternalLink.tsx`).
- [ ] Web (`database.web.ts`) konzisztens a native-tel (kártya-típus, unlock, production-mastery).

---

## 9. Szabályok
- Commitolj feladatonként külön (8. szekció üzenetei).
- Adat: JSON fájlt szerkeszd, NE `.ts` wrappert.
- Spanyol főnév → MINDIG névelő. `sentence_hu` = idiomatikus magyar.
- NE nyúlj v1.3-on kívüli scope-hoz (más szint vizsga, LLM/STT/NPC/backend/auth).
- A1 content KÉSZ — ne bővítsd.
- Bizonytalanság / EXAM_SPEC-ütközés (kivéve a mastery-felülírást) → állj meg, kérdezz.

## 10. Mi a working tree-ben már KÉSZ (ne írd újra)
- `exam_attempts` + `exam_sessions` tábla + `recordExamAttempt`/`getExamLastResults`/
  `recordExamSession`/`getExamSummary` (native+web).
- `examSize`/`passThreshold` (`data/exams.ts`), `normalizeAnswer` (`lib/levenshtein.ts`),
  ExamCard normalizeAnswer.
- `getMasteredWordCount` LÉTEZIK, de `type='word'` → **át kell írni `type='production'`-re** (4b).
