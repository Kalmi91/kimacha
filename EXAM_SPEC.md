# Vizsga rendszer spec (Exam System)

Önálló, implementálható specifikáció. Trigger: "build app" → ha ez a legmagasabb
prioritású kód feladat. Opus kódol közvetlenül (architekturális + debug).

Státusz: SPEC KÉSZ — implementálásra vár. C2 content hiány blokkolja a C2 vizsgát
(lásd 8. szekció), de a kód az összes szintre megírható.

---

## Döntések összefoglaló (user, 2026-05-28)

| Téma | Döntés |
|------|--------|
| Kapu (mi nyit vizsgát) | FSRS mastery: szint szavainak **80%-a mastered**, mastered = `state≥2 ÉS stability>10 nap` |
| Pass küszöb | **80%** a vizsga kérdéseiből |
| Kérdésszám / vizsga | Lépcsős: **A=25, B=30, C=35** |
| Bukás | **Azonnali újrapróba** (nincs cooldown) |
| Kérdésválasztás | **Súlyozott a gyenge pontokra** — adatforrás: vizsga-kérdés előzmény (`exam_attempts`) |
| Szintlépés irány | Csak fel (le-lépés = manuális Mester mód) |

---

## 1. Kapu feltétel (vizsga megnyitása)

Per `level` + `lang_pair` (a már bevezetett pár-scope-pal konzisztens).

- **Feltétel:** az aktuális szint szavainak ≥ **80%-a mastered**.
- **"mastered" definíció** (1 szó kártyája): `cards` sor ahol
  `type='word' AND lang_pair=<aktív> AND state >= 2 AND stability > 10`,
  és a `word_id` a szinthez tartozik.
- `masteredPct = masteredWordCount(level) / totalLevelWords(level) * 100`
- `examAvailable = masteredPct >= 80`

**Kód változás:** a jelenlegi gate `masteredPct >= 70` ahol `masteredPct` a
`getReviewedWordCount` (reps>0 = "egyszer látott"). EZT LE KELL CSERÉLNI az új
mastery-alapú számításra `index.tsx` `done` ágban és `DoneScreen`-ben.

**Megjelenítés (motiváció):** "A1: 73% mastered — vizsga 80%-nál" típusú progress
a DoneScreen-en. Ha `examAvailable`, akkor a "Vizsga" gomb aktív.

---

## 2. Vizsga méret + pass küszöb (szintenként)

```
examSize(level):
  A0, A1, A2 → 25
  B1, B2     → 30
  C1, C2     → 35

passThreshold(level) = ceil(examSize(level) * 0.8)
  A → 20 / 25
  B → 24 / 30
  C → 28 / 35
```

Ha a szint kérdés-poolja < examSize → használd az ÖSSZESET (és build-időben
flag-eld a hiányt, lásd 8.). C2 jelenleg 30 < 35 → ott a vizsga NEM indulhat amíg
nincs meg a 35 kérdés.

---

## 3. Kérdésválasztás — súlyozott a gyenge pontokra

Adatforrás: **`exam_attempts`** tábla (lásd 6.), aktuális `lang_pair`-re szűrve.

**Súly számítás kérdésenként** (a szint teljes pooljából):
- Soha nem próbálta → `weight = 2` (base)
- Utolsó próbálkozás **hibás** volt → `weight = 3` (gyenge pont, előrébb)
- Utolsó próbálkozás **helyes** volt → `weight = 1` (tudja, ritkábban)

**Algoritmus** (N = examSize):
1. Töltsd be a szint összes kérdését (pool).
2. Számold ki minden kérdés `weight`-jét az `exam_attempts` előzményből.
3. **Súlyozott véletlen mintavétel** N DISTINCT kérdés (egy vizsgán belül nincs
   ismétlés). (Implementáció: weighted shuffle — minden kérdéshez
   `key = random()^(1/weight)`, rendezés key szerint csökkenő, első N.)
4. A kiválasztott N kérdést keverd meg (megjelenítési sorrend random).
5. Ha pool ≤ N → mind, sima shuffle.

Ez biztosítja: a korábban bukott kérdések nagyobb eséllyel jönnek vissza, de a
randomizálás miatt nem determinisztikus (nem memorizálható a fix sorrend).

---

## 4. Pass / Fail flow

Minden megválaszolt kérdés után → `recordExamAttempt(questionId, level, correct, ms)`.

**Vizsga vége** (mind az N kérdés megvolt):
- `correct >= passThreshold(level)` → **PASS**:
  - `level up`: `LEVELS[idx+1]` ha van feljebb. `db.updateLevel(newLevel, 0,0,0)`.
  - `onLevelUp(newLevel)` → szülő frissít.
  - Done képernyő: 🏆 + "`<level>` ↑" + `correct/size`.
- `correct < passThreshold` → **FAIL**:
  - Reframing: "Még nem, de közel vagy!" + `correct/size`.
  - **Azonnali újrapróba engedélyezett** — gomb: "Újra" (új súlyozott válogatás,
    a most bukott kérdések előrébb) + gomb: "Vissza a tanuláshoz" (`onExit`).
  - NINCS cooldown, NINCS deck-drill (későbbi iteráció lehet).

Maximum szint (C2) elérve és pass → nincs feljebb lépés, csak gratuláció.

---

## 5. Válasz-ellenőrzés (translate kérdések)

Igazítsd a tanulási logikához (`normalizeAnswer` már létezik `lib/levenshtein.ts`):
- `answer = normalizeAnswer(text)`, `target = normalizeAnswer(question.target)`
- `dist = levenshtein(answer, target)`
- `dist === 0` → correct
- `dist <= 2` → "almost" → **vizsgán is helyesnek számít** (konzisztens a
  tanulással; írásjel/kis-nagybetű már normalizálva, tehát az "almost" csak valódi
  elgépelés 1-2 karakter)
- különben → wrong

**Kód:** `ExamCard.tsx` `TranslateCard.handleCheck` jelenleg raw
`toLowerCase().replace(/[¡¿]/g,'')` + `dist<=2`. Cseréld `normalizeAnswer`-re.

Gap kérdések (multiple choice): nincs változás, `correctIndex` exact match.

---

## 6. DB változások

### Új tábla: `exam_attempts`
```sql
CREATE TABLE IF NOT EXISTS exam_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lang_pair TEXT NOT NULL,
  question_id INTEGER NOT NULL,
  level TEXT NOT NULL,
  correct INTEGER NOT NULL,
  response_time_ms INTEGER NOT NULL,
  timestamp TEXT NOT NULL
);
```
Hozd létre az `open()` base `execAsync` blokkban (mind native + web MemoryDB).

### Új DB metódusok (interface bővítés `database.ts` + `database.web.ts`)
```ts
// Szint mastered szó-száma az aktív lang_pair-re (state>=2 && stability>10).
getMasteredWordCount(level: string): Promise<number>;

// Egy vizsga-előzmény rögzítése.
recordExamAttempt(questionId: number, level: string, correct: boolean, responseTimeMs: number): Promise<void>;

// Súlyozáshoz: question_id → utolsó eredmény (true=helyes, false=hibás) az aktív párra.
// Ami nincs a map-ben = soha nem próbálta.
getExamLastResults(level: string): Promise<Map<number, boolean>>;
```

**Megjegyzés:** a meglévő `getMasteredCount()` (globális, nem szint-szűrt) marad az
analytics számára. Az új `getMasteredWordCount(level)` szint+pár-szűrt, a kapuhoz.

Native implementáció `getMasteredWordCount`:
```sql
SELECT COUNT(*) FROM cards
WHERE word_id IN (<level word ids>) AND type='word'
  AND lang_pair=? AND state>=2 AND stability>10
```

`getExamLastResults`: a `exam_attempts`-ból az adott level+lang_pair sorokat
question_id szerint, timestamp DESC, és minden question_id-hez az első (legutóbbi)
`correct` érték.

---

## 7. UI / komponens változások

### `components/ExamMode.tsx`
- `examSize = examSize(level)`, `pass = passThreshold(level)` — NE hardcode 10/9.
- Kérdés betöltés: `getExamQuestionsForLevel(level)` + `getExamLastResults(level)`
  → súlyozott válogatás (3. szekció) → `slice(0, examSize)`.
- Counter: `{index+1}/{examSize}`.
- `handleResult`: `index+1 >= examSize` → done; `recordExamAttempt(...)` minden
  kérdésnél; `newCorrect >= pass` → level up.
- Done ág: PASS/FAIL ágak (4. szekció). FAIL-nél "Újra" gomb → újraindít
  (új súlyozott válogatás, state reset: index=0, correct=0, done=false, új
  `questions`). PASS-nél marad a jelenlegi 🏆 flow.
- `recordExamAttempt`-hez kell a `questionId` — `ExamQuestion`-nek van `id`-ja.

### `app/(tabs)/index.tsx` (done ág) + `components/DoneScreen.tsx`
- `examAvailable = getExamQuestionsForLevel(level).length >= passThreshold(level)
  && masteredPct >= 80` ahol `masteredPct` az ÚJ mastery számításból
  (`getMasteredWordCount(level) / totalLevelWords`).
- A `masteredPct` state-et az új forrásból töltsd (`loadCards` + `advance` végén).
- DoneScreen progress szöveg: "X% mastered — vizsga 80%-nál".

### `components/ExamCard.tsx`
- `TranslateCard`: `normalizeAnswer` (5. szekció).

### Helper hol legyen
- `examSize` / `passThreshold` → `data/exams.ts`-be export (a típusok mellé), hogy
  ExamMode + index közösen használja. Vagy `lib/examConfig.ts`.

### i18n (4 nyelv: hu, en, es, de) — Title Case gombok
- `exam.retry` ("Újra" / "Retry" / "Reintentar" / "Nochmal")
- `exam.backToLearning` ("Vissza A Tanuláshoz" / "Back To Learning" / ...)
- `exam.notYet` ("Még Nem, De Közel Vagy!" — már lehet hardcode, i18n-be át)
- `done.examProgress` sablon: "{pct}% mastered — vizsga 80%-nál"

---

## 8. Tartalmi követelmény (token-égetés feladat — KÜLÖN)

A pool legyen ≥ ~2× a vizsga mérete (variancia + anti-memorizálás retry-nál).

| Szint | Van | Vizsga | Minimum | Ajánlott (~2×) | Teendő |
|-------|-----|--------|---------|----------------|--------|
| A0 | 40 | 25 | 25 ✅ | 50 | +10 ajánlott |
| A1 | 30 | 25 | 25 ✅ szűk | 50 | +20 ajánlott |
| A2 | 40 | 25 | 25 ✅ | 50 | +10 ajánlott |
| B1 | 40 | 30 | 30 ✅ szűk | 60 | +20 ajánlott |
| B2 | 40 | 30 | 30 ✅ szűk | 60 | +20 ajánlott |
| C1 | 40 | 35 | 35 ✅ szűk | 70 | +30 ajánlott |
| **C2** | **30** | **35** | **❌ −5 HIÁNY** | 70 | **+5 KÖTELEZŐ, +40 ajánlott** |

- **C2 blokkoló:** min. +5 kérdés (összesen 35), különben a C2 vizsga nem indul.
- Formátum: `data/exams/<level>.json`, meglévő `gap` / `translate` schema.
- DELE/ECL minta alapú, szint nyelvtanhoz illesztve (lásd doc nyelvtan-táblák).
- Ez SONNET token-égetés feladat (content), külön menet, Opus tervezi a batch-et.

---

## 9. Elfogadási kritérium

- [ ] `exam_attempts` tábla létrejön (native + web), migrációval meglévő DB-n is.
- [ ] Kapu: vizsga CSAK akkor elérhető ha szint szavainak ≥80%-a `state≥2 && stability>10`.
- [ ] Vizsga méret szintfüggő: A=25, B=30, C=35; pass = 80% (20/24/28).
- [ ] Kérdésválasztás súlyozott: bukott kérdések nagyobb eséllyel; nincs ismétlés egy vizsgán belül; sorrend random.
- [ ] Minden vizsga-kérdés eredménye `exam_attempts`-be kerül.
- [ ] Bukás → "Újra" gomb azonnal újraindít (új súlyozott válogatás) + "Vissza" gomb.
- [ ] Pass → szintlépés, `updateLevel` per-pair.
- [ ] `translate` kérdés `normalizeAnswer`-rel ellenőriz (írásjel/kis-nagybetű = correct).
- [ ] i18n 4 nyelven, Title Case gombok.
- [ ] `exam_sessions` tábla + `recordExamSession` (PASS és FAIL ágon is) + analytics 4 új mező (`examsTaken`, `examsPassed`, `examPassRate`, `lastExamLevel`).
- [ ] `tsc --noEmit` tiszta (az ExternalLink.tsx pre-existing hibán kívül).
- [ ] C2 vizsga: kód kész, de content +5 kérdésig nem indul (graceful: pool<size → flag).

---

## 10. Lezárt döntések (2026-05-28)

- **"almost" vizsgán = helyes** (`dist<=2` pass), konzisztens a tanulással.
  Írásjel/kis-nagybetű már normalizálva → "almost" csak valódi 1-2 karakteres
  elgépelés. NEM szigorúbb mint a tanulás.
- **Analytics Sheet: igen** — vizsga-mezők hozzáadva (lásd 11. szekció).
- Bukott kérdések SRS-drillje (külön deck) — KIHAGYVA (azonnali újra). Iter2 lehet.

---

## 11. Analytics — vizsga mezők

A meglévő napi anonim küldéshez (`lib/analytics.ts`, GET az analytics
endpointra) add hozzá. Cél: a dev lássa eljutnak-e a vizsgáig, pass rate, hol
akadnak el — a 80% kapu + 80% pass tuningjához (most tippelt számok).

Új mezők a `URLSearchParams`-hez:
- `examsTaken` — összes vizsga próbálkozás (aktív lang_pair, `exam_attempts`-ből
  vizsga-szinten aggregálva — lásd lent)
- `examsPassed` — sikeres (pass) vizsgák száma
- `examPassRate` — `examsPassed / examsTaken * 100` (0 ha nincs)
- `lastExamLevel` — utolsó vizsgázott szint (vagy "-" ha nincs)

**Probléma:** `exam_attempts` per-KÉRDÉS sorokat tárol, nem per-vizsga. A
vizsga-szintű aggregáláshoz vagy (a) külön `exam_sessions` tábla (sitting-enként
1 sor: level, total, correct, passed, timestamp), vagy (b) az `analytics.ts`
számolja az utolsó kérdés-blokkokból. **Ajánlott (a): `exam_sessions` tábla** —
tisztább, a pass rate triviálisan jön.

### Új tábla (az `exam_attempts` mellé): `exam_sessions`
```sql
CREATE TABLE IF NOT EXISTS exam_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lang_pair TEXT NOT NULL,
  level TEXT NOT NULL,
  total INTEGER NOT NULL,
  correct INTEGER NOT NULL,
  passed INTEGER NOT NULL,
  timestamp TEXT NOT NULL
);
```
Vizsga végén (PASS és FAIL ágon is) → `recordExamSession(level, total, correct, passed)`.

### Új DB metódusok (a 6. szekció listájához)
```ts
recordExamSession(level: string, total: number, correct: number, passed: boolean): Promise<void>;
getExamSummary(): Promise<{ examsTaken: number; examsPassed: number; lastExamLevel: string | null }>;
```
`getExamSummary` az aktív `lang_pair` `exam_sessions` soraiból aggregál.
`analytics.ts` ezt hívja + számolja a `examPassRate`-et.

> Megj: a `exam_attempts` (per-kérdés) marad a súlyozott válogatáshoz (3. szekció).
> A `exam_sessions` (per-vizsga) az analytics + pass rate-hez. Két külön cél.
