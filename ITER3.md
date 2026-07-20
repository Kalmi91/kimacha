# ITER3 — Kimacha (en→es fókusz: A0 + A1 szavak + vizsgák)

> **Doc-driven handoff.** Ezt a specet az Opus agent írta a Kálmánnal folytatott
> tervezés alapján. Te (a kódoló agent) ebből implementálsz. A spec a forrás —
> ha a kód és a spec ütközik, a spec nyer, és jelezd. Olvasd el az érintett
> fájlokat kódolás előtt (pontos sorhivatkozások lent). Minden szekció végén
> Acceptance — addig nem kész, amíg nem zöld + `npx tsc --noEmit` hibátlan +
> web-konzisztencia (`lib/database.ts` ÉS `lib/database.web.ts` egyszerre).
> Commitolj feladatonként (9. szekció).

---

## 1. Scope és fókusz

- **Csak en→es nyelvpár.** Minden iter3 tartalom + teszt angol→spanyol irányra.
  A kód többnyelvpár-képes marad (ne törd el), de új tartalmat csak en→es-re hozunk.
- **Csak A0 és A1 szint.** B1–C2 érintetlen.
- Két szállítmány:
  1. Jó A0 + A1 szókészlet (A0 kurálás, A1 bővítés 507→800).
  2. Valódi, nehéz, **élet-alapú** vizsga az A0 és A1 végén, ami ténylegesen
     felajánlódik, amikor a szavak **80%-a mastered** (jelenleg ez törött).
- Kiadás: **v3.0.0** (versionCode 3).

---

## 2. Jelenlegi baseline (mi van most — ne építsd újra, csak tudd)

**Architektúra (v2.0.0, shipped):**
- Expo/React Native v56, TypeScript, ts-fsrs (SRS), expo-sqlite, expo-speech (TTS).
- Tanulás: `app/(tabs)/index.tsx` — flashcard + typing + easy sentence (tap-to-order).
- DB: `lib/database.ts` (natív) + `lib/database.web.ts` (web) — **mindkettőt frissítsd**.
  `cards` tábla oszlopok: `word_id, type, pair, due, stability, difficulty,
  elapsed_days, scheduled_days, learning_steps, reps, lapses, state, last_review, buried`.
  UNIQUE kulcs: `(word_id, type, pair)`. `pair` = forrás-cél (pl. `en-es`).
  `type` ∈ {`word`, `sentence`}. (A v1.3-ban tervezett recognition/production split
  NEM került be — a v2.0.0 a placement-exam irányt vitte. Ne számolj vele.)
- Szókészlet: `data/words/a0.json … c2.json` (szintenként). A1 topic-alapú
  (`topic` + `topicOrder` mező, `data/topics/a1.json` 38 topic).
- Vizsga (jelenlegi): `components/ExamMode.tsx` — `getExamQuestionsFor(targetLang, level)`
  húz 10 random `gap` (feleletválasztós) kérdést a `data/exams/<lang>/<level>.json`-ból,
  pass = 90% (9/10), pass → szintlépés. `components/ExamCard.tsx` rendereli (gap + a
  kiszűrt translate típus). Élet nincs, fix összetétel nincs.

**A jelenlegi vizsga két baja, amit iter3 javít:**
1. **Nem ugrik be / nem ajánlja fel.** `app/(tabs)/index.tsx:478`:
   `examAvailable = getExamQuestionsFor(...).length > 0 && masteredPct >= 70`.
   De a `masteredPct` valójában **reviewed%** (`index.tsx:179-181`:
   `getReviewedWordCount(level) / totalWords`), nem valódi mastery. A küszöb 70%,
   és a gomb CSAK a done-screenen jelenik meg. → Iter3: valódi mastery, 80%, prominens
   felajánlás.
2. **A vizsga nem A0/A1-szintű, nem élet-alapú.** Random 10 gap MC. → Iter3:
   fix összetételű, élet-alapú, a tanult szókincsből generált vizsga.

**Szókészlet most:** A0=101, A1=507 (38 topic). Cél: A0 kurálva, A1=800.

---

## 3. Gate fix — vizsga felajánlás 80% mastery-nél (en→es)

**Mastery definíció (Kálmán választása):** egy szó *mastered*, ha a `word` típusú
kártyája elérte az FSRS **Review** állapotot (`state >= 2`), VAGY a felhasználó
„Ezt Már Tudom" (bury) gombbal eltemette (`buried = 1`). A `stability > 10` feltételt
NEM használjuk (az a régi szigorúbb def volt).

### 3a. DB metódus — level-scoped mastery számláló

`lib/database.ts` ÉS `lib/database.web.ts`:

A meglévő `getMasteredWordCount()` (paraméter nélküli, `state>=2 AND stability>10`)
**írd át** level-scoped változatra, a `getReviewedWordCount(level)` mintájára
(`database.ts:372`). Interface-t is frissítsd mindkét fájlban.

```ts
async getMasteredWordCount(level: string) {
  const db = await this.open();
  const { getWordsForLevel } = require('@/data/words');
  const levelWords = getWordsForLevel(level);
  const wordIds = levelWords.map((w: any) => w.id);
  if (wordIds.length === 0) return 0;
  const placeholders = wordIds.map(() => '?').join(',');
  const row = await db.getFirstAsync<any>(
    `SELECT COUNT(*) as cnt FROM cards
       WHERE word_id IN (${placeholders}) AND type = 'word' AND pair = ?
         AND (state >= 2 OR buried = 1)`,
    [...wordIds, this.activePair]
  );
  return row?.cnt ?? 0;
}
```

Web verzió: ugyanez a `database.web.ts` tárolási modelljéhez igazítva (ugyanaz a
feltétel: `type==='word' && (state>=2 || buried===1)` és `pair===activePair`,
csak a level word_id-jaira szűrve). Ellenőrizd a `getMasteredWordCount()` régi,
paraméter nélküli hívásait és igazítsd (`getMasteredCount()` paraméter nélküli
metódus maradhat, ha máshol kell — ne töröld feleslegesen).

### 3b. index.tsx — gate logika

`app/(tabs)/index.tsx` `loadCards` (kb. 178-183):
- Tartsd meg a `reviewed`/`knownWords` számítást a ProgressMeter-hez (az reviewed+buried).
- Adj hozzá külön mastery számítást a kapuhoz:
  ```ts
  const masteredWords = await db.getMasteredWordCount(currentLevel);
  const mPct = totalWords > 0 ? Math.round((masteredWords / totalWords) * 100) : 0;
  setMasteredPct(mPct);   // ezentúl VALÓDI mastery%, nem reviewed%
  ```
- `index.tsx:478`: küszöb 70 → **80**:
  ```ts
  const examAvailable =
    getExamQuestionsFor(direction[1], level).length > 0 && masteredPct >= 80;
  ```
  (Megj.: az új vizsga-motor az A0/A1-et a szókincsből generálja, lásd 4-5. szekció;
  a `getExamQuestionsFor(...).length > 0` ellenőrzést tartsd meg a magasabb szintekre,
  de A0/A1-nél a generált vizsga mindig elérhető, ha `masteredPct >= 80`.)

### 3c. Felajánlás prominenssé tétele

Jelenleg csak a done-screen kínálja. Iter3:
- A tanuló-képernyőn (index.tsx render), amikor `masteredPct >= 80` és a szint még
  nincs „letéve" (nem volt sikeres vizsga ezen a szinten ezzel a pair-rel), jelenjen
  meg egy jól látható **„Vizsga feloldva — próbáld ki!"** banner/CTA a kártya fölött
  vagy egy fix sávban. Megnyomásra `setExamMode(true)`.
- A done-screen gomb maradjon (DoneScreen `examAvailable` prop).
- i18n: új kulcsok 4 nyelven (`exam.unlocked`, `exam.unlockedCta`).

**Acceptance 3:**
- 80% A0 szó state≥2 (vagy buried) → banner megjelenik a tanuló-képernyőn ÉS a
  done-screenen, en→es párnál.
- 79%-nál nincs banner. `tsc` zöld. database.ts és .web.ts konzisztens (azonos
  visszaadott szám azonos állapotnál).

---

## 4. Új vizsga-motor — élet-alapú, fix összetétel

Írd át `components/ExamMode.tsx`-et (vagy új `components/ExamRunner.tsx`, és az
ExamMode csak wrapper). A random-10 logika megszűnik; helyette **fix összetételű,
a szókincsből generált** vizsga.

### 4a. Élet-mechanika (KIZÁRÓLAG a vizsgában)

- Az élet-rendszer **csak a vizsga közben** él. A normál tanulásban (flashcard /
  typing / sentence) **nincs élet** — ott minden változatlan marad.
- **5 élet** (`livesLeft`, kezdő 5). HUD: `❤️ × livesLeft` + `index+1 / total`.
- Minden rossz válasz → `livesLeft--`. Az **5. hibánál** `livesLeft === 0` → **vége a
  vizsgának**: **FAIL** képernyő (📚 „Elfogytak az életek"), gombok: **Újra** (friss
  vizsga újragenerálása) + **Kilépés**. (Max 4 hiba tolerálható, az 5. fatal.)
- Jó/rossz után tovább a következő tételre. Ha az utolsó tétel után `livesLeft >= 1`
  → **PASS** (🏆 `level ↑`): `db.updateLevel(nextLevel, 0, 0, 0)` + `onLevelUp`; az aktív
  (forrás-cél) pair user_level-je lép.
- **Nincs külön %-küszöb** — az 5 élet AZ a küszöb.

### 4b. Vizsga felépítése — builder

Új modul: `lib/examBuilder.ts`.

```ts
export type ExamDir = ['es','en'] | ['en','es'];

export type ExamItem =
  | { kind: 'word_type';   dir: ExamDir; prompt: string; answer: string }
  | { kind: 'sent_order';  dir: ExamDir; prompt: string; answerTokens: string[]; distractors: string[] }
  | { kind: 'sent_type';   dir: ExamDir; prompt: string; answer: string }
  | { kind: 'gap_mc';      sentence: string; options: string[]; correctIndex: number }
  | { kind: 'match';       pairs: { left: string; right: string }[] }   // left=es, right=en
  | { kind: 'reading_mc';  text: string; question: string; options: string[]; correctIndex: number };

export function buildExam(level: 'A0' | 'A1', pair: string): ExamItem[];
```

- `buildExam` a szint **fix összetétele** szerint állít össze tételeket (5-6. szekció).
- **A0:** kizárólag `data/words/a0.json`-ból generálva (szó + `sentence_es`/`sentence_en`).
  Nincs külön authored exam fájl A0-hoz.
- **A1:** generált drillek (`data/words/a1.json`) + authored grammar/olvasás/párosítás
  tételek (`data/exams/a1_tasks.json`, lásd 7. szekció).
- Determinisztikus, de keverős kiválasztás: minden futáskor másik mintát húzzon, de
  a típus-összetétel (db szám típusonként) FIX. Egy szó/mondat egy vizsgán belül ne
  ismétlődjön.
- `sent_order` distractor tile-ok: 2-3 plauzibilis extra szó a cél nyelv aktuális
  szintű szókészletéből (NEM a megoldásból).

### 4c. Válaszellenőrzés (gépelős/összerakós típusok)

Reuse a meglévő megengedő ellenőrzést (`lib/levenshtein.ts` + a `normalizeAnswer`
logika, amit az index.tsx/EasySentenceCard használ): kis/nagybetű-érzéketlen, záró
írásjel elhagyható, **Levenshtein-távolság ≤ 2 = helyes**. A `sent_order`-nél a
helyes sorrend = `answerTokens` pontos sorozata (vagy elfogadható szinonim-sorrend,
ha a builder több helyes sorrendet ad — alap: pontos sorrend).

**Acceptance 4:**
- 5 élet HUD látszik, rossz válasz csökkenti, 0 → FAIL + Újra.
- Végigér ≥1 élettel → PASS + szintlépés (a megfelelő pair-en).
- A builder a megadott fix összetételt adja vissza, ismétlés nélkül.
- `tsc` zöld.

---

## 5. A0 vizsga spec (17 tétel, en→es, csak A0 szókincs)

Csak `data/words/a0.json` szavai és mondatai. Összetétel (összesen **17**):

| # | `kind` | `dir` | db | Mit csinál a tanuló |
|---|--------|-------|----|---------------------|
| A | `word_type` | es→en | 3 | ES szó látszik, beírja az EN jelentést |
| B | `word_type` | en→es | 2 | EN szó látszik, beírja az ES megfelelőt |
| C | `sent_order` | es→en | 5 | ES mondat látszik, EN fordítást rak össze csempékből |
| D | `sent_order` | en→es | 3 | EN mondat látszik, ES fordítást rak össze csempékből |
| E | `sent_type` | en→es | 2 | EN mondat → ES fordítást **begépel** |
| E | `sent_type` | es→en | 2 | ES mondat → EN fordítást **begépel** |

3 + 2 + 5 + 3 + 2 + 2 = **17**.

- A `sent_order`/`sent_type` forrása a szavak `sentence_es` / `sentence_en` mezője.
  Csak olyan A0 szót válassz, aminek van mindkét mondatmezője.
- Tile-készlet (`sent_order`): a helyes fordítás szavai + 2-3 distractor A0 szókincsből.
- Egy vizsga = 17 különböző szó/mondat.

**Acceptance 5:**
- `buildExam('A0','en-es')` pontosan 17 tételt ad a fenti típus-eloszlással, mind A0
  tartalomból, ismétlés nélkül.
- Végigjátszható natív + web buildben, élet-mechanikával.

---

## 6. Kérdéstípusok + komponensek

Iter3-ban használt típusok (**nincs hallás, nincs igaz/hamis**).
„Generált" = a szókincsből futásidőben; „Authored" = `data/exams/a1_tasks.json`.

| `kind` / altípus | Forrás | Renderelő komponens |
|------------------|--------|---------------------|
| `word_type` es→en | generált | `ExamWordCard` (új) |
| `word_type` en→es | generált | `ExamWordCard` |
| `word_type` ragozott ES ige→en (hablamos→we speak) | generált (A1 grammar) | `ExamWordCard` |
| `word_type` EN személyes ige→ragozott ES (they eat→comen) | generált (A1 grammar) | `ExamWordCard` |
| `sent_order` es→en / en→es | generált | `EasySentenceCard` reuse |
| `sent_type` es→en / en→es | generált | `ExamSentTypeCard` (új, typing) |
| `gap_mc` (grammar: ser/estar, ragozás, névelő…) | authored | `ExamCard` (gap) reuse |
| `match` ES felirat/tábla ↔ EN jelentés | authored | `ExamMatchCard` (új) |
| `reading_mc` rövid ES szöveg → EN kérdés | authored | `ExamReadingCard` (új) |

**Új komponensek:** `ExamWordCard`, `ExamSentTypeCard`, `ExamMatchCard`, `ExamReadingCard`.
**Reuse:** `EasySentenceCard` (tap-to-order) → `sent_order`; `ExamCard` gap → `gap_mc`.
Mind `onResult(correct: boolean)`-ot hív, hogy az élet-motor egységesen kezelje.

- **A0** csak: `word_type` + `sent_order` + `sent_type` (5. szekció).
- **A1** ezek + `gap_mc` + `match` + `reading_mc` (7. szekció).

**Acceptance 6:** minden `kind` a saját komponensével rendereldődik, `onResult`
egységes; permissive ellenőrzés (Levenshtein ≤ 2) a gépelős/összerakós típusoknál;
`tsc` zöld; web build nem tör el.

---

## 7. A1 vizsga spec (pontosan 35 tétel, en→es, A1 tartalom)

> **Frissítve 2026-06-06 (Kálmán kérése, exam-realistic):** az eredeti 20-as terv
> helyett **35 tétel** = 20 generált drill + 15 authored DELE-stílusú tétel.
> A kód (`lib/examBuilder.ts` `buildA1Exam`) és a jest tesztek ezt tükrözik.

A1 vizsga = **20 generált drill** (A0-tükör szerkezet A1 tartalommal) + **15 authored**
valódi-vizsga tétel = összesen **pontosan 35**. 5 élet, ugyanaz a motor. Minden
tartalom A1-szintű.

**A1 összetétel (35):**

| `kind` | `dir` | db | Megj. |
|--------|-------|----|-------|
| `word_type` | es→en | 4 | A1 szavak (nehezebb, ritkább) |
| `word_type` | en→es | 2 | A1 szavak |
| `sent_order` | es→en | 6 | A1 mondatok |
| `sent_order` | en→es | 4 | A1 mondatok |
| `sent_type` | en→es | 2 | A1 mondatok, gépelés |
| `sent_type` | es→en | 2 | A1 mondatok, gépelés |
| `gap_mc` | — | 6 | **authored**: A1 grammar (ser/estar, ragozás, névelő…) |
| `match` | — | 3 | **authored**: ES felirat/tábla ↔ EN jelentés (DELE A1 Tarea 2/3) |
| `reading_mc` | — | 6 | **authored**: rövid ES szöveg → EN kérdés (DELE A1 Tarea 1/4) |
| | | **35** | |

20 generált + 15 authored (`gap_mc`, `match`, `reading_mc`). Az authored tételek a
valódi A1 vizsga-érzetet adják (DELE A1 alapú, lásd 12. függelék), a
`data/exams/a1_tasks.json`-ból (pool: gap 18 / match 12 / reading 15).
**Nincs hallás** a vizsgában (némán teljesíthető).

### 7a. Authored A1 tételek — `data/exams/a1_tasks.json`

A `gap_mc`, `match`, `reading_mc` tételeket authoroljuk (en→es), valódi A1
nehézséggel (lásd 12. függelék DELE A1). Séma:

```json
[
  { "id": 3001, "kind": "gap_mc", "topic": "ser_estar",
    "sentence": "Mi hermana ____ médica.",
    "options": ["es", "está", "tiene", "hay"], "correctIndex": 0 },

  { "id": 3070, "kind": "match",
    "pairs": [
      { "left": "Abierto de 9 a 14", "right": "Open 9 to 14" },
      { "left": "Prohibido fumar",  "right": "No smoking" },
      { "left": "Salida",           "right": "Exit" },
      { "left": "Rebajas",          "right": "Sales" }
    ] },

  { "id": 3090, "kind": "reading_mc",
    "text": "Ana vive en Madrid. Trabaja en un hospital y le gusta el café.",
    "question": "Where does Ana work?",
    "options": ["In a hospital", "In a café", "In a school", "At home"],
    "correctIndex": 0 }
]
```

- ID-k: A1 authored tételek **3001-től**.
- `gap_mc` distractorok legyenek **hihetők** (ugyanabból a paradigmából: ser/estar/
  tener/hay; el/la/los/las; stb.), ne nyilvánvalóan rosszak.
- `reading_mc` szöveg 2-4 mondat, csak A1 szókincs; kérdés EN, opciók EN.
- `match` 4 pár (bal=es felirat/tábla, jobb=en jelentés).
- Cél: **elég authored tétel, hogy a builder válogasson** (pl. legalább 8-10 `gap_mc`
  a különböző grammar-témákból, 4-6 `match`, 6-8 `reading_mc`). A vizsga csak 1-1-et húz
  típusonként, de a pool adjon változatosságot. A pontos darabszám a token-burn feladaté
  (8. szekció), de a séma + builder most kész legyen.

**Acceptance 7:**
- `buildExam('A1','en-es')` **pontosan 35** tételt ad a fenti eloszlással (20 generált
  + 15 authored), A1 tartalomból, ismétlés nélkül.
- `data/exams/a1_tasks.json` séma-helyes, parse-olható, a builder beolvassa.
- Végigjátszható natív + web.

---

## 8. A1 szóbővítés 507 → 800 (token-burn skill)

**Cél:** A1 szókészlet 507 → **800** szó. **Topic-struktúra marad** (38 meglévő topic
megőrizve), a +293 szó **új vagy bővített vocab-topicokba** kerül (Kálmán döntése:
„meglévő szavak bővítése és témakörök maradnak").

### 8a. Skill

Hozz létre (vagy élesítsd újra) egy token-burn skillt — pl. `kimacha-a1-words` —
ami batch-ben tölti A1-et 800-ig. Kövesd a projekt batch-extraction mintáját
(kvóta-check → becslés → 1-elemes smoke → resumable state → bulk).

### 8b. Szabályok (TASK.md A1 szabályaiból, kötelező)

- Minden kártya: `id, level:"A1", es, hu, en, de, topic, topicOrder, sentence_es,
  sentence_hu, sentence_en, sentence_de` (mind a 4 nyelv kötelező — en→es a fókusz,
  de a séma teljes marad).
- Főneveknél **mindig névelő** (el/la/los/las).
- Igék infinitívben (a grammar-topic ragozott formái kivételek, ahogy eddig).
- `sentence_hu`/`sentence_en` **idiomatikus**, NEM tükörfordítás.
- Mondatok A1 szint: jelen idő + `ir a + inf` közeljövő; max ~8-10 szó.
- **Dedup MINDEN szinttel szemben** (A0…C2), nem csak A1-en belül.
- Proper name-ek kiszűrve.
- ID-k folyamatosak az A1 tartományban; `topicOrder` topic-on belül folyamatos.

### 8c. Forrás + topic-terv

- A 38 meglévő topic megmarad változatlanul.
- A +293 szó **valódi A1 szókincsből** jöjjön — **keress a neten sztenderd/hivatalos
  A1 listát** (pl. Instituto Cervantes PCIC A1 inventory, DELE A1 vokabulár, vagy A1
  frekvencia-lista), ne kitalált egzotikus szavak. **Semmi extra** — sztenderd A1 témák.
- A hiányzó témákra standard A1 vocab-topicok (pl. háztartás, munka/iroda, egészség/
  orvos, vásárlás/pénz, szabadidő, utazás, érzések, napi rutin igéi). A `data/topics/a1.json`-t
  bővítsd az új vocab-topicokkal (helyes `order`, `type:"vocab"`, 4 nyelvű `name_*`).
- A forrás-lista kiválasztását a token-burn futás elején rögzítjük.

**Acceptance 8:**
- A1 = 800 szó, mind séma-helyes, dedup tiszta, topic-ok konzisztensek
  (`data/topics/a1.json` minden topic-ot tartalmaz).
- Az app betölti, a tanulóloop és a vizsga-builder hibátlanul kezeli a 800 szót.
- (A tényleges generálás külön token-burn futás; ez a szekció a skillt + szabályt
  rögzíti, a kódoló agent a skillt és a builder-kompatibilitást készíti el.)

---

## 9. Commit-terv (sorrend)

1. `feat(db): level-scoped getMasteredWordCount (state>=2 OR buried)` — 3a, +web.
2. `feat(exam): 80% mastery gate + prominens vizsga-felajánlás banner` — 3b, 3c, i18n.
3. `feat(exam): élet-alapú vizsga-motor (5 élet, fix összetétel, fail/retry)` — 4.
4. `feat(exam): examBuilder + ExamItem típusok` — 4b.
5. `feat(exam): A0 vizsga (17 tétel, szókincsből generált)` — 5 + új word/sent komponensek.
6. `feat(exam): új kérdéstípus-komponensek (word, sent-type, match, reading)` — 6.
7. `feat(exam): A1 vizsga (20 tétel) + data/exams/a1_tasks.json séma` — 7.
8. `feat(content): A1 token-burn skill + topic-bővítés állvány` — 8 (skill + builder-kompat;
   a tényleges 800 szó külön burn-commit(ek)ben).
9. `chore: v3.0.0 / versionCode 3` — verzióemelés a kiadáshoz.

Minden commit után `npx tsc --noEmit` + a releváns jest teszt (ha van) zöld.

---

## 10. Összesített Acceptance (definition of done)

- en→es: A0 tanulásnál 80% mastery (state≥2 vagy buried) → vizsga **felajánlódik**
  (banner + done-screen).
- A0 vizsga: 17 tétel, 5 élet, csak A0 tartalom, az 5. szekció eloszlásával; 0 élet =
  fail+retry; végigér ≥1 élettel = pass + szintlépés A1-re.
- A1 vizsga: **pontosan 35** tétel (20 generált drill A1-tartalommal + 15 authored:
  `gap_mc` / `match` / `reading_mc`), 5 élet, ugyanaz a motor.
- Minden új `kind` rendereldődik és `onResult`-ot hív; permissive válaszellenőrzés
  (Levenshtein ≤ 2) a gépelős/összerakós típusoknál.
- A1 szókészlet 800 (vagy a skill + builder kész hozzá, ha a burn külön fut).
- `npx tsc --noEmit` hibátlan; `lib/database.ts` és `lib/database.web.ts` konzisztens;
  web build nem tör el; jest zöld.
- v3.0.0 / versionCode 3.

---

## 11. Érintett fájlok (gyors térkép)

- `lib/database.ts`, `lib/database.web.ts` — mastery számláló (3a).
- `app/(tabs)/index.tsx` — gate (3b), banner (3c), `setExamMode`.
- `components/ExamMode.tsx` (átírás) v. új `components/ExamRunner.tsx` — élet-motor (4).
- `lib/examBuilder.ts` (új) — ExamItem + buildExam (4b, 5, 7).
- `components/ExamWordCard.tsx`, `ExamSentTypeCard.tsx`, `ExamMatchCard.tsx`,
  `ExamReadingCard.tsx` (újak, 6).
- `components/EasySentenceCard.tsx`, `components/ExamCard.tsx` — reuse/adapt (6).
- `components/DoneScreen.tsx` — examAvailable CTA marad.
- `data/exams/a1_tasks.json` (új) — A1 authored tételek (7a).
- `data/words/a1.json`, `data/topics/a1.json` — A1 bővítés 800-ra (8).
- `lib/i18n/*` — új vizsga-kulcsok (4 nyelv).

---

## 12. Függelék — valós A1 vizsga referencia (DELE A1, Instituto Cervantes)

A `match`, `reading_mc` és `gap_mc` tételek ezen alapulnak, hogy a vizsga
„valódi A1" legyen, ne önkényes.

**DELE A1 — Comprensión de lectura (25 tétel, 45 perc, 4 tarea):**
- Tarea 1 (5): rövid email/levelezőlap (150-175 szó) → feleletválasztós, 3 opció.
- Tarea 2 (6): 9 rövid szöveg (táblák, jelzések, hirdetések) → 6 párosítás állítással.
- Tarea 3 (6): 4 személy érdeklődése → megfelelő kurzus/opció hozzárendelése (párosítás).
- Tarea 4 (8): táblázatos info → feleletválasztós / név-szó-kifejezés felismerés.

**DELE A1 — Expresión e interacción escritas (25 perc, 2 tarea):**
- Tarea 1: űrlap kitöltése személyes adatokkal.
- Tarea 2: rövid szöveg (képeslap/email) 15-65 szó.

**App-adaptáció:** kép-alapú DELE feladat kihagyva (nincs képbank); hallás + beszéd +
írásértékelés iter2+ (STT). Iter3 auto-javítható, átvett formátumok: gap-MC (Tarea 1/4),
párosítás (Tarea 2/3 → `match`), olvasásértés-MC (`reading_mc`), plusz a tanult
szókincsből generált szó/mondat drillek (typing + tap-order).

**A1 grammatikai fókusz (DELE A1 / CEFR A1):** presente (ar/er/ir), ser/estar, hay/
está, tener, ir, hacer, gustar, névelő + género/número, birtokos névmások, elöljárók,
kérdőszavak, tagadás, `ir a + inf` közeljövő. (Egybeesik a meglévő 38 A1 topickal.)

**Források:**
- https://examenes.cervantes.es/es/dele/examenes/a1
- https://examenes.cervantes.es/sites/default/files/Especificaciones_DELE_A1_2020.pdf
- https://eleinternacional.com/blog/dele-a1-ejercicios-comprension-lectora-tarea-3-y-4/
