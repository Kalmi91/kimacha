# Kimacha — Teljes Projekt Állapot és Feladatok

## Mi ez az app?

Kimacha = spanyol nyelvtanuló mobil app (Expo/React Native, TypeScript).
Passzív mód: SRS szótanulás + mondat-összerakás. Aktív mód: iter2 (LLM, NPC, STT).
Több nyelvpár (es/hu/en/de bármely irányban). UI nyelv: telefon rendszernyelve (HU/EN/ES/DE).

## Tech stack

- TypeScript + Expo (React Native) v56
- ts-fsrs (SRS algoritmus)
- expo-sqlite (on-device storage)
- expo-speech (TTS)
- Google Apps Script endpoints (analytics + feedback)

## Fájl struktúra

```
app/(tabs)/index.tsx     — fő tanulási képernyő (flashcard, typing, easy sentence)
app/(tabs)/settings.tsx  — beállítások, mester mód
app/(tabs)/active.tsx    — "coming soon" placeholder
app/onboarding.tsx       — nyelv kiválasztás
app/_layout.tsx          — root layout, analytics sync

components/DoneScreen.tsx       — "kész vagy mára" képernyő + vizsga gomb
components/ExamMode.tsx         — vizsga mód (10 kérdés, 9/10 pass)
components/ExamCard.tsx         — egyedi vizsga kártya (gap fill / translate)
components/EasySentenceCard.tsx — könnyű mondat (tap-to-order)
components/FeedbackModal.tsx    — visszajelzés FAB + modal + toast

lib/database.ts      — SQLite DB (cards, attempts, streak, level, user_meta)
lib/database.web.ts  — web fallback DB
lib/analytics.ts     — napi analytics → Google Sheet
lib/config.ts        — endpoint URL-ek
lib/i18n/            — 4 nyelv (hu, en, es, de)
lib/levenshtein.ts   — Levenshtein távolság
lib/ThemeContext.tsx  — sötét/világos téma

data/words/a0.json ... c2.json  — szókészlet szintenként (JSON)
data/exams/a0.json ... c2.json  — vizsga kérdések szintenként (JSON)
data/words.ts                   — type + import wrapper (NE IDE ÍRJ adatot!)
data/exams.ts                   — type + import wrapper (NE IDE ÍRJ adatot!)
```

## Adat formátum

### Szó entry (data/words/*.json)
```json
{
  "id": 1,
  "level": "A0",
  "es": "no",
  "hu": "nem",
  "en": "no",
  "de": "nein",
  "sentence_es": "No quiero ir.",
  "sentence_hu": "Nem akarok menni.",
  "sentence_en": "I don't want to go.",
  "sentence_de": "Ich will nicht gehen."
}
```

### Vizsga kérdés (data/exams/*.json)
Gap fill:
```json
{ "id": 1, "level": "A0", "type": "gap", "sentence": "La nieve es ____", "options": ["verde", "blanca", "amarilla", "roja"], "correctIndex": 1 }
```
Translate:
```json
{ "id": 21, "level": "A0", "type": "translate", "direction": "es_hu", "source": "Yo soy estudiante.", "target": "Én diák vagyok." }
```

## Jelenlegi szókészlet állapot

| Szint | Jelenleg | CEFR cél | Hiányzik |
|-------|----------|----------|----------|
| A0    | 100      | 100      | 0        |
| A1    | 507      | 500      | ✅ (cél elérve, 30+ topic) |
| A2    | 510      | 1000     | ~490     |
| B1    | 202      | 750      | ~550     |
| B2    | 84       | 1250     | ~1150    |
| C1    | 83       | 1500     | ~1400    |
| C2    | 92       | 1000     | ~900     |
| **Σ** | **1578** | **6100** | **~4500**|

## Vizsga kérdések állapot

| Szint | Kérdések | Elég? |
|-------|----------|-------|
| A0    | 40       | ✅     |
| A1    | 30       | ✅     |
| A2    | 40       | ✅     |
| B1    | 40       | ✅     |
| B2    | 40       | ✅     |
| C1    | 40       | ✅     |
| C2    | 30       | ✅     |

---

# FELADAT 0 (LEGMAGASABB PRIORITÁS): A1 Grammar Topic Átstrukturálás

## Összefoglaló

A1 szint jelenleg SUBTLEX-ESP freq szavak → értelmetlen mix (guerra, sangre, mierda, stb.).
Új koncepció: A0 = szókincs alap (flat, marad). A1 = grammar + szókincs topic-ok, kevert sorrendben, topic-alapú unlock.

## Két rész

### Part A: Content generálás (TOKEN ÉGETÉS — Sonnet)
- A1 szókészlet teljes újraírása: ~246 kártya, 30 topic-ba szervezve (16 grammar + 14 szókincs)
- Topic definíciók: `data/topics/a1.json`
- Formátum: lásd lent
- Meglévő A1 szavak törlendők (nem kell megtartani, user még nincs A1-en)
- A1 vizsga kérdések (`data/exams/a1.json`) is újraírandók grammar-fókuszúra

### Part B: Kód (OPUS KÓDOL — trigger: "build app")
Nem token égetés, nem Sonnet. Opus kódol mert topic unlock = architekturális változás.
User mondja **"build app"** → TASK.md-ből a legmagasabb prioritású kód feladatot csináld.

Érintett fájlok:
1. `data/words.ts` — WordEntry interface: `topic?: string`, `topicOrder?: number`
2. `data/topics.ts` — új fájl: TopicEntry type + import + `getTopicsForLevel()`
3. `data/topics/a1.json` — topic definíciók (30 topic, i18n nevekkel)
4. `lib/database.ts`:
   - `getTopicMasteryPct(level, topicId)` — topic kártyáinak hány %-a mastered (reps > 0)
   - `getUnlockedTopics(level)` — topic N unlock: topic N-1 mastery ≥ 80%. Topic 1 always open.
   - `getDueCardsForLevel(level, limit)` — szűrés: CSAK unlocked topic-ok kártyái
5. `app/(tabs)/index.tsx` — topic-aware card loading, loadCards() topic filter
6. `components/DoneScreen.tsx` — topic progress lista: `Presente -ar: 85% ✓` / `Presente -er: 🔒`
7. i18n (`lib/i18n/`) — topic UI strings (4 nyelv)

A0 és A2+ szinteken semmi nem változik (nincs topic, flat marad).

## A1 Topic lista (kevert sorrend: grammar ↔ szókincs váltakozva)

| # | Topic ID | Típus | Név (HU) | ~db |
|---|----------|-------|----------|-----|
| 1 | presente_ar | 📗 grammar | Jelen idő: -ar igék (hablar) | 5 |
| 2 | numeros | 📘 vocab | Számok (6-100) | 12 |
| 3 | presente_er | 📗 grammar | Jelen idő: -er igék (comer) | 5 |
| 4 | colores | 📘 vocab | Színek | 8 |
| 5 | presente_ir | 📗 grammar | Jelen idő: -ir igék (vivir) | 5 |
| 6 | presentacion | 📘 vocab | Bemutatkozás | 10 |
| 7 | ser | 📗 grammar | Ser (létige: identitás) | 5 |
| 8 | estar | 📗 grammar | Estar (létige: állapot) | 5 |
| 9 | comida | 📘 vocab | Étel/ital | 15 |
| 10 | tener | 📗 grammar | Tener (birtokolni) | 5 |
| 11 | ropa | 📘 vocab | Ruházat | 10 |
| 12 | ir_verb | 📗 grammar | Ir (menni) | 5 |
| 13 | hacer | 📗 grammar | Hacer (csinálni) | 5 |
| 14 | casa | 📘 vocab | Ház/lakás | 10 |
| 15 | ser_vs_estar | 📗 grammar | Ser vs estar | 8 |
| 16 | cuerpo | 📘 vocab | Testrészek | 10 |
| 17 | hay_vs_esta | 📗 grammar | Hay vs está | 5 |
| 18 | restaurante | 📘 vocab | Étterem | 10 |
| 19 | genero_numero | 📗 grammar | Nem és szám | 8 |
| 20 | profesiones | 📘 vocab | Foglalkozások | 10 |
| 21 | posesivos | 📗 grammar | Birtokos névmások | 6 |
| 22 | transporte | 📘 vocab | Közlekedés | 10 |
| 23 | preposiciones | 📗 grammar | Elöljárók | 8 |
| 24 | clima | 📘 vocab | Időjárás | 8 |
| 25 | interrogativos | 📗 grammar | Kérdőszavak | 7 |
| 26 | dias_meses | 📘 vocab | Napok + hónapok | 19 |
| 27 | negacion | 📗 grammar | Tagadás | 4 |
| 28 | ciudad | 📘 vocab | Város/irányok | 10 |
| 29 | gustar | 📗 grammar | Gustar szerkezet | 5 |
| 30 | tiempo | 📘 vocab | Idő (óra, dátum) | 8 |
| **Σ grammar** | | 📗 | 16 topic | **~96** |
| **Σ vocab** | | 📘 | 14 topic | **~150** |
| **Σ total** | | | **30 topic** | **~246** |

## Adat formátum

### Word entry (data/words/a1.json)
```json
{
  "id": 1001,
  "level": "A1",
  "es": "yo hablo",
  "hu": "én beszélek",
  "en": "I speak",
  "de": "ich spreche",
  "topic": "presente_ar",
  "topicOrder": 1,
  "sentence_es": "Yo hablo español con mis amigos.",
  "sentence_hu": "Spanyolul beszélek a barátaimmal.",
  "sentence_en": "I speak Spanish with my friends.",
  "sentence_de": "Ich spreche Spanisch mit meinen Freunden."
}
```

### Topic definition (data/topics/a1.json)
```json
[
  {"id": "presente_ar", "order": 1, "name_hu": "Jelen Idő: -ar Igék", "name_en": "Present Tense: -ar Verbs", "name_es": "Presente: Verbos -ar", "name_de": "Präsens: -ar Verben"},
  {"id": "presente_er", "order": 2, "name_hu": "Jelen Idő: -er Igék", "name_en": "Present Tense: -er Verbs", "name_es": "Presente: Verbos -er", "name_de": "Präsens: -er Verben"}
]
```

## Unlock logika (pszeudokód)

```typescript
function getUnlockedTopics(level: string): TopicEntry[] {
  const topics = getTopicsForLevel(level);
  if (topics.length === 0) return []; // A0, A2+ — nincs topic, flat
  const unlocked: TopicEntry[] = [topics[0]]; // topic 1 always open
  for (let i = 1; i < topics.length; i++) {
    const prevMastery = getTopicMasteryPct(level, topics[i-1].id);
    if (prevMastery >= 80) unlocked.push(topics[i]);
    else break; // sequential unlock, nincs skip
  }
  return unlocked;
}
```

## Sorrend

1. ELŐSZÖR Part A (content): A1 grammar topic szavak + mondatok generálása → `data/words/a1.json` + `data/topics/a1.json`
2. UTÁNA Part B (kód): topic unlock rendszer implementálása
3. UTÁNA Part A (content): A1 vizsga kérdések újraírása grammar-fókuszúra → `data/exams/a1.json`

## Állapot — LEZÁRVA (2026-05-28)
- ✅ Part A content: A1 szavak — 507 kártya, 38 topic (commit `89cea25`, `babac78`, `57eb976`)
- ✅ Part B kód: topic unlock — `computeUnlockedTopics` in `app/(tabs)/index.tsx`, `data/topics.ts`, `data/topics/a1.json` (commit `c3bf397`)
- ✅ Part A content: A1 vizsga — 30 grammar-focused gap-fill (ser/estar/tener/hay conj.) in `data/exams/a1.json`

---

# FELADAT 1: Token égetés — Szókészlet bővítés

## Trigger szavak
User mondja: "égesd a tokeneket" / "szavakat generálj" / "töltsd fel a szókészletet"

## Mi a cél?
SUBTLEX-ESP (OpenSubtitles spoken freq) top 6000 szóból CEFR szintekre bontva feltölteni a szókészletet. Jelenleg 1148 szó van, cél ~6100.

## Hogyan működik

### 1. Freq lista letöltés
```bash
curl -sL "https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/es/es_50k.txt" | head -6000 > /tmp/es_freq_6000.txt
```

### 2. Filter + CEFR split
```javascript
// Node script:
// - Betölti meglévő szavakat MINDEN JSON-ból → existing Set
// - Kiszűri: function words, meglévők, 2 betűnél rövidebb, számok
// - CEFR split freq rank alapján:
//   A1: rank 0-500
//   A2: rank 500-1500
//   B1: rank 1500-2500
//   B2: rank 2500-3500
//   C1: rank 3500-5000
//   C2: rank 5000-6000
// - Kiírja /tmp/freq_XX.txt fájlokba (comma separated)
```

### 3. Agent batch generálás
- **100 szó / agent** (300 túl sok, session limitet üt)
- Agent prompt: "Read /tmp/a2_batch_0.txt, generate JSON array"
- Formátum: `[{"id":X, "level":"A2", "es":"...", "hu":"...", "en":"...", "de":"...", "sentence_es":"...", "sentence_hu":"...", "sentence_en":"...", "sentence_de":"..."}]`
- **Max 3 parallel agent** (több session limitet üt)

### 4. Feldolgozás
```javascript
// Node script:
// - Extract JSON from agent JSONL output
// - Dedup vs existing words (es field lowercase)
// - Filter proper names (john, mary, etc.)
// - Renumber IDs (maxId + 1 + i)
// - Merge with existing level JSON
// - Write back
```

### 5. Commit szintenként
```
git add data/words/XX.json
git commit -m "feat: expand XX vocabulary from N to M words (SUBTLEX-ESP freq)"
```

## Állapot (hol tartunk)

- ✅ A1: FELADAT 0 lezárva (507 szó, 38 topic, grammar topic unlock kész). NE generálj freq-alapú A1 szavakat!
- ⚠️ A2: 430 szó hozzáadva (80→510). Még ~490 kell célhoz.
- ⚠️ B1: 108 szó hozzáadva (94→202). Még ~550 kell célhoz.
- ❌ B2: 0 hozzáadva. 84 van, ~1150 kell.
- ❌ C1: 0 hozzáadva. 83 van, ~1400 kell.
- ❌ C2: 0 hozzáadva. 92 van, ~900 kell.

## Szabályok
- Spanyol főneveknél MINDIG névelő: "el libro", "la casa"
- Igék infinitívben. Ragozott alak → alap ige, ragozás a fordításban jelölve.
- Mondatok: szintnek megfelelő igeidő (A0-A1: jelen, A2: közelmúlt, B1: múlt, B2: subjuntivo, C1-C2: irodalmi)
- Proper name-ek (john, mary, london, etc.) kiszűrése
- sentence_hu legyen idiomatikus magyar, NE tükörfordítás
- Dedup MINDEN szinttel szemben, nem csak az aktuális szinttel

## Következő lépés
A2 további bővítés (~490 szó kell célhoz), aztán B1 (~550), aztán B2/C1/C2.

---

# FELADAT 2: App fejlesztés — Iter1.2 feladatok — LEZÁRVA (2026-05-28)

## Ami KÉSZ (nem kell hozzányúlni)

| # | Feladat | Commit |
|---|---------|--------|
| 1 | Szókészlet 402→615 szó | `cda2b3d` |
| 2 | Vizsga kérdések A1+C2 | `3f20fd1` |
| 3 | 4 bugfix (TTS, await, i18n, Levenshtein) | `a31107c` |
| 4 | 214 magyar mondat természetesítve | `ea4cbe0` |
| 5 | Vizsga gate logika (70%, 10/9 pass) | már megvolt |
| 6 | Easy sentence card (tap-to-order) | `09dba29` |
| 7 | Hard sentence card (typing) | `cc8e1ab` |
| 8 | Szintlépés badge kisebb | `9a9a520` |
| 9 | Feedback toast (natív alert → app-tematikus) | `a78b948` |

## Ami implementálva van a kódban (iter1.1 + korábbi)

- ✅ FSRS SRS algoritmus (ts-fsrs)
- ✅ SQLite perzisztencia (cards, attempts, streak, level, user_meta)
- ✅ Napi analytics → Google Sheet
- ✅ Feedback → Google Sheet (FAB + modal + toast)
- ✅ Onboarding (nyelv kiválasztás)
- ✅ Streak counter
- ✅ Mester mód (manuális szintváltás)
- ✅ TTS (expo-speech, 🔊 gomb + auto-speak)
- ✅ Vizsga mód (ExamMode.tsx — 10 kérdés, gap fill + translate, 9/10 pass)
- ✅ Vizsga gate (70% reviewed → vizsga gomb megjelenik)
- ✅ Enter = továbblépés (web)
- ✅ Szavak→mondatok progresszió (getDueCardsForLevel logika)
- ✅ Könnyű mondat (EasySentenceCard — tap-to-order, reps=0)
- ✅ Nehéz mondat (typing, reps>0)
- ✅ Mondat begépelés reveal után (practiceTyping)
- ✅ i18n (4 nyelv: hu, en, es, de)
- ✅ App ikon (icon.png megvan, build kell)
- ✅ 3 fázisú progresszió (learned→native flashcard → native→learned typing → mondatok)

## Ami NEM implementálva (de kódolható lenne)

Jelenleg: **NINCS nyitott kódolási feladat.** Minden ELFOGADVA státuszú feladat implementálva van.

Egyetlen hátralevő: **APK build** (#8) — ez nem kód, hanem `eas build` parancs (vagy `expo run:android` lokálisan, native build), EAS login szükséges.

## Iter1.2 zárás verifikáció (2026-05-28)

Minden iter1.2 task kódolva. Ellenőrzött:
- #4 HU sentence nat. ✅ (commit `ea4cbe0`)
- #5 vizsga gate 70% + 10 kérdés + 9/10 pass ✅ (`index.tsx:446` `masteredPct >= 70`, ExamMode)
- #6 easy sentence tap-to-order ✅ (`components/EasySentenceCard.tsx`)
- #7 hard sentence typing + Levenshtein ✅ (`index.tsx` reps>0 branch)
- TTS ✅ (`expo-speech` Speech.speak több helyen)
- Topic unlock ✅ (`computeUnlockedTopics`)
- A1 grammar exam ✅ (30 gap-fill, ser/estar/tener)
- Dark mode toggle ✅ (commit `55300b6`)

## Iter1.3 — LEZÁRVA (2026-05-31) → v2.0.0

Branch: `feat/placement-exams-progress`. Kiadás: **v2.0.0** (versionCode 2).

**Mi ment ki:**
- Több-nyelvpáros placement vizsga: `data/exams/<lang>/<level>.json`, célnyelv szerint
  betöltve (`getExamQuestionsFor(targetLang, level)`). Tartalom: es (A0–C2), en/hu/de
  (A0–B2), feleletválasztós (gap) kérdések online CEFR minták alapján. Hiányzó szint
  (pl. C1/C2 en/hu/de) → célnyelven belüli fallback, soha nem spanyol.
- A vizsga a tanult CÉLNYELVEN megy (nem mindig spanyol) — `ExamMode` a `direction[1]`-et használja.
- Vizsga UX: ✕ kilépés (nem ragad bent), kérdésenként remount (`key={index}`), a kérdésszámhoz
  skálázott pass-küszöb, csak gap kérdés (a kevert es↔hu fordítás kivéve, ami magyart erőltetett).
- Egyedi haladásmérő (`ProgressMeter`, gyémánt-rács), az AKTUÁLIS SZINT szavait mutatja
  (pl. 0/100), élőben nő (reviewed + buried számít); a felső "X/N" számláló törölve.
- **Nyelvpáronkénti haladás**: `cards` + `user_level` a `pair` (forrás-cél) kulcsra szűrve
  (séma-migráció: `cards` UNIQUE(word_id,type,pair); user_level páronként). Nyelvváltás nem
  keveri/törli a haladást. „Újrakezdés" csak az aktív párt nullázza.
- Megengedő válaszellenőrzés MINDENHOL (kis/nagybetű + záró pont + ≤2 elütés = teljesen helyes):
  szó-gépelés, gyakorló gépelés (✏️), mondat-összerakó (`EasySentenceCard`), vizsga fordítás.
- „Ezt Már Tudom" (bury) beleszámít az Ismert Szavakba.
- TTS teljes BCP-47 locale-lal (`hu-HU`, `es-ES`, `en-US`, `de-DE` …) a helyes hang-választáshoz.

Commits: `d075edb`, `d995ecb`, `d926fb9`, `292f104`, `4868487`, `77bbb32`, `c7c42be`, `f2d9f96`.
APK: lokális release build → Drive „kimacha" mappa (megosztható link).

## NEM AKTÍV — TILOS hozzányúlni (iter2 scope)
- LLM integráció, STT, NPC, scenes
- Backend (Go/Python)
- Analytics (PostHog)
- Auth, subscription, push notif
- Kiejtés-pontozás, offline support
- Streak freeze

---

# Szabályok (mindkét feladatra)

## Kódolási szabályok
- Expo v56 docs: https://docs.expo.dev/versions/v56.0.0/
- Commitolj minden feladat után külön
- i18n: minden UI szöveg 4 nyelven (hu, en, es, de)
- Title Case gomb labeleken
- NE nyúlj más feature-höz, CSAK ami le van írva
- Adat: JSON fájlokat szerkeszd, NE a .ts wrapper-t

## Adat szabályok
- Spanyol főneveknél MINDIG névelő (el/la/los/las)
- sentence_hu = idiomatikus magyar, NE tükörfordítás
- Vizsga kérdések: DELE/ECL mintákon alapuljon
- Szintenként megfelelő igeidő fókusz

## Token égetés szabályok
- Max 100 szó / agent (300 session limitet üt)
- Max 3 parallel agent
- Mindig dedup vs ÖSSZES meglévő szó
- Proper name-ek szűrése
- Commit szintenként

## Canonical dokumentáció
- App design doc: `/home/kalmi/Desktop/LanguageAPP`
- AGENTS.md: `/home/kalmi/ai/kimacha/AGENTS.md`
- Ez a fájl: `/home/kalmi/ai/kimacha/TASK.md`
