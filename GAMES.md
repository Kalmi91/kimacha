# GAMES.md, Kimacha „Game" fül, keret + megvalósítási terv

> **Mi ez:** a Kimacha új, ötödik/hatodik fülének (**„Game"**) teljes tervrajza.
> Nem a napi SRS-tanulás, hanem **játék a már megtanult szókészlettel**.
> Ezt a fájlt olvassa a `/kimacha-extra-games` skill, és ebből dolgozik a kódoló agent.
>
> **Kapcsolódó fájlok:** `AGENTS.md` (fő feedback/bug-queue + házi konvenciók),
> `BUILD.md` (token-burn queue), `ITER3.md` (lezárt iter3 spec).
> Ez a fájl **nem** helyettesíti őket, hanem egy külön munkaterület: a Game fül
> minden itemje ITT él, amíg el nem készül.
>
> **Verzió:** v1.1 (2026-08-26), státusz: **MINDEN KÉRDÉS ELDŐLT, a Mondat-Tetris kivételével minden item SPEC-KÉSZ, kódolható**.
> A 29 K-kérdés mind eldőlt (2026-08-26), a döntések a 7. szekcióban vannak. A kódolás indulhat az F-1 fázissal.

---

## 0. A megrendelő eredeti kritériuma (változatlanul idézve)

> „azokból a szavakból kifejezésekből álljon amit már addig a pontig a játékban
> tanultam, vagy ami új szó az legyen oda írva a jelentése vagy mondjuk kattintani
> lehessen rá és akkor kiírja"

Ez **kőbe vésett szabály minden játékra**. A keret ezt nem játékonként oldja meg,
hanem központilag, két modulban:

1. `lib/games/vocabPool.ts`, a játékok CSAK innen kaphatnak szót.
2. `components/games/GlossText.tsx`, minden nem-tanult token automatikusan
   pöttyözött aláhúzást kap és koppintásra kiírja a jelentést.

Ha egy játék bárhonnan máshonnan szerez szót, az **acceptance-bukás**.

---

## 1. Mi kerül a fülre (a user által jóváhagyott lista)

| # | Játék | id | Típus | Státusz |
|---|---|---|---|---|
| 1 | Szó-eső | `word-rain` | arcade | 🟨 SPEC-KÉSZ |
| 2 | Buborék-pukkasztó (kategória) | `bubble-pop` | arcade + kategória | 🟨 SPEC-KÉSZ |
| 3 | Memóriapárosító | `memory-pairs` | rejtvény | 🟨 SPEC-KÉSZ |
| 4 | Szókereső rács | `word-search` | rejtvény | 🟨 SPEC-KÉSZ |
| 5 | Sztori-mód | `story` | tartalom | 🟨 SPEC-KÉSZ |
| 6 | Tanácsadó beszélgetés | `chat` | tartalom + döntés + valódi tudás | SPEC, **újratervezve (K24)** |
| 7 | Ragozás-slot | `conjugation-slot` | nyelvtan-dril | 🟨 SPEC-KÉSZ (csak ES) |
| 8 | Kakukktojás | `odd-one-out` | logika + jelentésmező | 🟨 SPEC-KÉSZ |
| 9 | Mondat-Tetris | `sentence-tetris` | arcade + szórend | ⏸ ELHALASZTVA |
| 10 | CCAT-felkészítő (könnyített) | `ccat` | teszt-prep, térbeli nélkül | 🟨 SPEC-KÉSZ |
| 11 | „Melyik a helyes?" nyelvtan + magyarázat | `grammar-choice` | nyelvtan + tanítás | 🟨 SPEC-KÉSZ, teljes ES-lefedettség cél |
| 12 | Hasonló szavak megkülönböztetése | `confusables` | tanítás + dril | 🟨 SPEC-KÉSZ |
| 13 | Igaz vagy kamu | `myth` | tartalom, tény-alapú | 🟨 SPEC-KÉSZ |

**Parkolópálya (a user nem kérte, ne épüljön meg engedély nélkül):**
Tinder-swipe „tudom / nem tudom", keresztrejtvény, akasztófa.
Ha később kell, a keret mindhármat 1-1 registry-bejegyzéssel elbírja.

---

## 2. A fül maga

### 2.1 Elhelyezés

Új route: `app/(tabs)/games.tsx`. A `app/(tabs)/_layout.tsx`-be új `Tabs.Screen`:

```tsx
<Tabs.Screen
  name="games"
  options={{
    title: s.tabs.games,
    headerShown: false,          // a hub saját fejlécet rajzol, mint az index
    tabBarIcon: ({ color }) => (
      <SymbolView
        name={{ ios: 'gamecontroller.fill', android: 'sports_esports', web: 'sports_esports' }}
        tintColor={color}
        size={28}
      />
    ),
  }}
/>
```

**Sorrend (K1 eldöntve, 2026-08-26):**
`index (Learn) → **games** → active → tree → stats → settings`.
Tehát a Game a Learn után, közvetlenül a második helyen, hogy szem előtt legyen.
6 fül lesz, semmi nem olvad össze. A `tabBarLabelStyle`-ban `fontSize: 10` kell,
hogy 360 dp széles kijelzőn ne törjön a felirat.

### 2.2 A hub képernyő (`games.tsx`)

Felül, a user kifejezett kérése („legyen a tetején, hogy az eddigi szavakkal
gyakorlás, valami szépen megfogalmazva"):

```
┌────────────────────────────────────────────┐
│  Játék                                     │   ← nagy cím
│  Amit eddig megtanultál, most játszani      │   ← alcím, „szépen megfogalmazva"
│  jött. 1 248 szó vár rád.                   │      + élő szószám
└────────────────────────────────────────────┘
```

i18n-kulcsok (mind a 4 nyelvre, `lib/i18n/{hu,en,es,de}.ts`):

```ts
games: {
  title: 'Játék',
  subtitle: 'Amit eddig megtanultál, most játszani jött.',
  poolLine: (n: number) => `${n} szó vár rád.`,
  poolLineThin: (n: number) => `${n} szó van meg eddig, a többit menet közben tanulod.`,
  locked: (n: number) => `Még ${n} szó kell hozzá`,
  best: 'Legjobb',
  play: 'Indul',
  settings: 'Beállítások',
  newWordHint: 'A pöttyözött szavak újak. Koppints rájuk a jelentésért.',
}
```

Alatta **2 oszlopos kártyarács**, egy kártya = egy játék:

- ikon (SymbolView), játék neve, egysoros „mit gyakorolsz vele"
- jobb felül fogaskerék, ha a játéknak van beállítása (K-kérdésekben tisztázva)
- alul: `Legjobb: 4 200` vagy `Még 12 szó kell hozzá` (zárolt állapot, halvány)
- koppintás → `router.push('/games/word-rain')`

A hub **a registryből rajzol**, nem kézzel felsorolva. Új játék hozzáadása
= 1 registry-bejegyzés + 1 képernyőfájl, semmi más.

---

## 3. A KERET (ez a lényeg, ezt kell először megépíteni)

Az egész Game fül **egyetlen közös motorra** ül. Ha ez jól sikerül, a 12 játék
mindegyike 150-400 sor képernyő-kód, nem külön kis alkalmazás.

```
lib/games/
  registry.ts       ← minden játék metaadata, EGY forrás
  vocabPool.ts      ← „amit eddig megtanultam" lekérdezés + feltöltés újakkal
  gloss.ts          ← jelentés-feloldás bármely tokenre
  distract.ts       ← elosztó-generálás (a meglévő lib/distractors.ts-re épül)
  session.ts        ← közös játék-munkamenet: pont, élet, idő, találat-napló
  scoring.ts        ← pontszámítás + rekord kezelés
  content.ts        ← authored JSON tartalom betöltése (story/chat/grammar/confusables/ccat)
components/games/
  GameShell.tsx     ← közös keret: fejléc, pont, élet, idő, szünet, kilépés-megerősítés
  GlossText.tsx     ← koppintható szöveg, új szó = pöttyözött, tap → jelentés-buborék
  GameOverCard.tsx  ← eredmény, rekord, „Újra" / „Vissza"
  CountdownStart.tsx← 3-2-1 indítás az időzített játékokhoz
  GameSettingsSheet.tsx ← séma-vezérelt beállítás-lap
app/games/
  <id>.tsx          ← játékonként egy képernyő, a tabs-on kívül (mint app/spelling.tsx)
```

### 3.1 `vocabPool.ts`, a kritérium motorja

```ts
export type PoolStrictness = 'seen' | 'practiced' | 'mastered';

export interface PoolEntry {
  wordId: number;
  learned: string;        // a tanult nyelven, pl. 'perro'
  native: string;         // a forrásnyelven, pl. 'kutya'
  level: Level;
  topicId?: string;
  sentenceLearned?: string;
  sentenceNative?: string;
  phase: 0 | 1 | 2;       // lib/wordPhase.ts
  isNew: boolean;         // TRUE = feltöltésből jött, kötelező gloss
}

export async function getLearnedPool(opts: {
  pair: string;
  learnedLang: string;
  level: Level;
  strictness?: PoolStrictness;   // default: 'practiced'
  minSize?: number;              // a játék minimum igénye
  topicId?: string | null;       // ha a játék témára szűkít
}): Promise<PoolEntry[]>;
```

**Működés:**

1. Lekérdezi a `cards` táblát: `type='word' AND pair=? AND buried=0`.
   Ehhez **új DB-metódus kell**: `getAllWordCards(pair): Promise<{word_id, reps, lapses, state}[]>`
   (`lib/database.ts` + `lib/database.web.ts` + `IDatabase`, a házi hármas szabály).
2. Szűr `strictness` szerint, `wordPhase(card)` alapján:
   - `seen`: létezik kártyasor (phase >= 0)
   - `practiced` (**default**): phase >= 1, tehát legalább egyszer sikeresen felidézte
   - `mastered`: phase 2, tehát már le is tudta írni helyesen
3. Feloldja `findWordById(word_id, learnedLang)`-gal, `isNew: false`-szal.
4. **Ha a pool kisebb, mint `minSize`:** feltölti az aktuális szint még nem látott
   szavaiból (`getWordsForLevel(level, learnedLang)` mínusz a meglévők),
   ezeket `isNew: true`-val jelöli. Ezek a képernyőn kötelezően gloss-oltak.
5. Determinisztikus keverés a `lib/shuffle.ts`-ből (tesztelhetőség).

**Ez a függvény a rendszer szíve.** Egyetlen jest-teszt garantálja a user
kritériumát: „minden visszaadott entry vagy `isNew === false`, vagy van hozzá
feloldható gloss". Ha ez a teszt piros, a Game fül nem szállítható.

### 3.2 `GlossText.tsx`, a „kattints rá és kiírja"

A meglévő `components/TappableSentence.tsx` általánosítása (azt NEM írjuk át,
az a helyesírás-listához tartozik, FB150).

- bemenet: szöveg + `Map<token, GlossInfo>`
- egy `isNew` token: **pöttyözött aláhúzás** + halványabb szín, hogy látszódjon
  „ez most jött"
- koppintás bármely tokenre → alul felcsúszó kis buborék:
  - a szó a tanult nyelven, nagyban
  - jelentés a forrásnyelven
  - 🔊 gomb (`speak()` a `lib/speech.ts`-ből, `speechLang(learnedLang)`)
  - „Helyesírás-listára" gomb (a meglévő `spelling_list` táblába ír, FB39)
- a buborék NEM állítja meg az időzített játékokat magától. **K2.**

### 3.3 `session.ts` + `card_attempts`

Minden játékbeli válasz beírja a MEGLÉVŐ `card_attempts` táblát:
`type = 'game:word-rain'` formában. Így a Stats fül és a `getTop5Failed()`
ingyen látja a játékbeli hibákat is, nulla új infrastruktúrával.

### 3.4 ~~`srsBridge.ts`~~, ELVETVE (K3, 2026-08-26)

> **Ez a modul nem épül meg.** A felhasználó döntése: a játék teljesen külön marad az
> SRS-től, a `cards` táblát a játékok csak olvassák. Az alábbi terv referenciaként marad
> itt, ha valaha mégis kellene.

<details>
<summary>Eredeti terv (nem implementálandó)</summary>


A játékbeli hiba **NEM** hívja az FSRS `Again`-t. Az elrontaná az ütemezést
(egy arcade-elvétés nem ugyanaz, mint egy tudás-hiány).
Helyette:

```ts
export async function nudgeWrong(pair: string, wordId: number): Promise<void>;
// ha a kártya due-ja > holnap, előrehozza HOLNAPRA. Ha már közelebb van, nem nyúl hozzá.
```

Így amit a játékban elrontasz, hamarabb visszajön a rendes tanulásban, de a
FSRS-stabilitás sértetlen.

</details>

### 3.5 Új DB-táblák

```sql
CREATE TABLE IF NOT EXISTS game_scores (
  pair TEXT NOT NULL,
  game_id TEXT NOT NULL,
  best_score INTEGER NOT NULL DEFAULT 0,
  best_at TEXT,
  plays INTEGER NOT NULL DEFAULT 0,
  last_played TEXT,
  PRIMARY KEY (pair, game_id)
);
CREATE TABLE IF NOT EXISTS game_settings (
  pair TEXT NOT NULL,
  game_id TEXT NOT NULL,
  settings_json TEXT NOT NULL,
  PRIMARY KEY (pair, game_id)
);
CREATE TABLE IF NOT EXISTS game_progress (   -- csak a sztori/chat haladáshoz
  pair TEXT NOT NULL,
  game_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  state TEXT NOT NULL,        -- 'unlocked' | 'done'
  data_json TEXT,             -- pl. melyik ágakat járta be a chatben
  PRIMARY KEY (pair, game_id, item_id)
);
```

**Kötelező mindhárom helyen:** `lib/database.ts`, `lib/database.web.ts`, `IDatabase`
interfész, ÉS a `exportAll()` / `importAll()` backup-payloadba (különben a
Backup gomb csendben elveszti a játék-haladást).

### 3.6 Tartalom-audit (a kritérium gépi őre)

Új script: `scripts/audit-games.mjs`, a meglévő `audit-corpus.mjs` mintájára.
Ellenőrzi a `data/games/**.json` fájlokat:

- **P1:** olyan tartalom-szó, ami nincs benne az adott szint kumulált
  szókészletében ÉS nincs hozzá `gloss` mező → hiba
- **P1:** hiányzó fordítás bármely aktív nyelvre
- **P2:** túl hosszú mondat a szinthez (A1 fölött ne legyen 12 szónál hosszabb)
- **P2:** duplikált item-id

`npx jest` + `npx tsc --noEmit` + `node scripts/audit-games.mjs` (0 P1) = a
szállítási kapu minden játék-itemre.

> **MEGVALÓSÍTÁSI JEGYZET (F0, 2026-08-26):**
> - **A `scripts/audit-games.mjs` (3.6) NEM készült el F0-ban, szándékosan.**
>   `data/games/**.json` egyetlen fájlja sem létezik még (a tartalom-írás F3/F4-
>   ben kezdődik), egy most megírt audit-script a formátumot csak találgatná.
>   A script F3/F4 ELSŐ tartalom-batch-ével együtt készül, a valódi JSON ellen
>   tesztelve. Addig a "kapu" a `lib/games/content.ts`-ben élő TypeScript
>   típusokkal él (StoryData/ChatData/GrammarTopicData/ConfusablesSet/MythItem),
>   azok már most kikényszerítik a GAMES.md 4.5/4.6/4.11/4.12/4.13 sémáit.
> - **`IDatabase` névkorrekció.** A CLAUDE.md és a skill „IDatabase interfész"-t
>   említ, a kódban ez ténylegesen `export interface DB` (`lib/database.ts` /
>   `lib/database.web.ts`). Ugyanaz a hármas-szabály vonatkozik rá, csak a neve
>   más, a jövőbeni fázisok ezt a nevet keressék.
> - **`getAllWordCards(pair)` explicit `pair` parammal** készült, PONTOSAN a
>   3.1 szekció aláírása szerint, ez eltér a `DB` interfész többi metódusától
>   (azok `this.activePair`-t használnak implicit módon, paraméter nélkül).
>   Szándékos, a spec szövegét követi. A három ÚJ tábla (`game_scores`,
>   `game_settings`, `game_progress`) metódusai viszont a házi konvenciót
>   követik (`this.activePair`, nincs `pair` paraméter), mert ott a spec nem
>   írt elő explicit paramot, és ez illeszkedik a `getSpellingList()`-féle
>   meglévő mintához.
> - **A játék neve/blurbja (`lib/games/registry.ts`) a TARTALOM nyelvén jelenik
>   meg** (a nyelvpár forrás/anyanyelve, `direction[0]`, ugyanaz a minta, mint
>   a `data/topics.ts` `TopicDef.name_*` mezőié és a `tree.tsx` `uiLang`
>   változóé), NEM az app-keret `lib/i18n` nyelvén. A hub SAJÁT feliratai
>   (cím, alcím, gomb-szövegek) viszont a keret-nyelven (`t()`), mint minden
>   más fül. Ez a GAMES.md 2.2-ben nem volt kimondva, a meglévő `tree.tsx`
>   precedenst követtem.
> - **`hasSettings` játékonként** a 4.x szekciók „Beállítás:" alpontja alapján
>   dőlt el: NINCS ilyen alpontja a `chat`, `grammar-choice`, `confusables`
>   játéknak, ezért ott `hasSettings: false`.
> - **`minPoolSize` játékonként** csak ott van explicit spec-szám (word-rain:
>   20), a többinél a 4.x szekció rácsméret/kérdésszám-mintáiból származtatott,
>   dokumentált becslés (`lib/games/registry.ts` kommentje); a tartalom-vezérelt
>   játékoknál (story/chat/grammar-choice/confusables/myth) szándékosan
>   `undefined`, mert azokat nem szókészlet-méret, hanem tartalom-megléte zárja.
> - **A `games.tsx` hub kapott egy `FeedbackButton`-t**, bár ezt a GAMES.md
>   szövege nem mondja ki explicit, az AGENTS.md feedback-előzménye szerint
>   (FB23/FB40) EZ minden fülön ott van, kihagyása inkonzisztens lenne.
> - **`lib/shuffle.ts`** kapott egy exportált `shuffleArray<T>(items, seed)`
>   segédfüggvényt (a már meglévő, most exportált `mulberry32`-re épül), mert
>   a `vocabPool.ts` determinisztikus keverést igényel, ez általános, minden
>   jövőbeli játék használhatja, nem csak a pool.
> - **Tesztek (mind zöld):** `lib/__tests__/vocabPool.test.ts` (a 3.1-ben
>   előírt KÖTELEZŐ őrző-teszt, a `getLearnedPool` core-garanciájára),
>   `gameDb.test.ts` (3 új tábla + `getAllWordCards`, export/import round-trip),
>   `gamesRegistry.test.ts`, `gameScoring.test.ts`, `gloss.test.ts`,
>   `distract.test.ts`, `gameSession.test.ts`.

> **MEGVALÓSÍTÁSI JEGYZET (F1/F2, 2026-08-26):**
> - **`GlossText.tsx` új props: `disableTap` / `forceOpen` / `onForceClose`.**
>   Egy elkapható/kipukkasztható csempe saját koppintása MÁR foglalt (catch/pop),
>   ezért nem nyithatja UGYANAZ a koppintás a gloss-buborékot is (a token-szintű
>   `onPress` versenyezne a játék saját `Pressable`-jével). A `word-rain` (4.1) új
>   szó esetén AUTOMATIKUSAN nyitja meg a buborékot (nem koppintásra), a
>   `memory-pairs` (4.3) az első felfordításkor szintén automatikusan, 2
>   másodpercre; ez a mechanizmus mindkettőt kiszolgálja anélkül, hogy
>   párhuzamos gloss-UI-t kellene írni. `disableTap=true` esetén a tokenek nem
>   kapnak saját `onPress`-t, a buborék láthatóságát a szülő vezérli
>   (`forceOpen: GlossInfo | null`, `undefined` = a régi, belső-állapotú
>   viselkedés, tehát a meglévő hívók, semmi F0-ban nem volt még élő hívó, 
>   érintetlenek). `onForceClose` hívódik a belső `close()` helyett, ha a
>   buborék kontrollált.
> - **`lib/games/distract.ts` `pickDistractors` új `field?: 'learned' | 'native'`
>   opció** (alap `'learned'`, minden meglévő hívó változatlan). A `word-rain`
>   „irány: tanult→forrás" beállítása (4.1) esér a forrásnyelvi szót ejti, az
>   elosztóknak is a pool `native` mezőjéből kell jönniük, a korábbi kód
>   hardkódoltan csak `p.learned`-et nézte.
> - **`lib/games/wordSearch.ts` új modul** (4.4 szekció szerint): tiszta
>   `buildGrid(words, size, dirs, rng, lang?)` függvény, gyors véletlen
>   próbálkozás + determinisztikus backtracking-fallback (garantáltan elhelyez
>   minden szót, ami geometriailag elfér), jest-tesztekkel
>   (`lib/games/__tests__/wordSearch.test.ts`, 8 teszt, köztük a 4.4 acceptance
>   200-futásos próbája).
> - **`app/games/_layout.tsx`** (új, a `app/(tabs)/_layout.tsx` mintájára): egy
>   beágyazott Stack `headerShown:false`-szal az egész `games/` csoportra, hogy
>   ne kelljen képernyőnként Stack.Screen-opciót írni a root layoutba; a root
>   `app/_layout.tsx` Stack-je egyetlen `<Stack.Screen name="games" .../>`
>   bejegyzést kapott (a `spelling` minta szerint).
> - **DB-hármas NEM kellett F1/F2-höz.** A `getGameSettings`/`setGameSettings`/
>   `getGameScore`/`recordGameScore` (F0-ban már kész, generikus
>   `Record<string, unknown>` payloaddal) minden F1/F2 játék beállítás- és
>   rekord-igényét lefedi, új tábla vagy DB-metódus nem kellett.
> - **`bubble-pop` (4.2) a `pos`/`gender` metaadatot NEM a `vocabPool`
>   `PoolEntry`-ből kapja** (azt szándékosan nem bővítettük ki, hogy a pool
>   maradjon a "szó ↔ jelentés" minimál-kontraktus), hanem a `wordId`-n keresztül
>   közvetlenül `findWordById`-dal olvassa ki a `WordEntry.pos`/`.gender` mezőt
>   (ugyanaz a forrás, amit a `vocabPool.ts` is használ belül). Ez NEM új
>   szóforrás (a 0. szekció szent szabálya sértetlen): a szó maga továbbra is
>   KIZÁRÓLAG a poolból jön, csak a már meglévő kártya extra mezőit olvassuk le.
> - **`categorySet: 'tense'` (igeidő) NEM épült meg a bubble-pop-ban.** A 4.2
>   szekció szövege négy kategória-készletet sorol fel (téma / szófaj /
>   nyelvtani nem / igeidő), de az F-1 metaadat-bővítés (K6) csak `pos`-t és
>   `gender`-t adott a szavakhoz, igeidő-címke NINCS a korpuszban. Ez adathiány,
>   nem eldöntendő kérdés, ezért a beállítás három opcióra szűkült (téma / szófaj
>   / nyelvtani nem); a negyedik akkor építhető, ha egy jövőbeli F-1-szerű
>   metaadat-menet igeidő-címkét ad a kártyákhoz.
> - **`lib/games/wordRain.ts` új modul**, a 4.1 acceptance kritériuma ("jest:
>   wordRain.test.ts, a generátor mindig pontosan 1 helyes választ ad") csak
>   akkor tesztelhető unit-szinten, ha a kör-generálás NEM a képernyő-
>   komponensbe van égetve. `buildFallingRound(entry, pool, opts)` tiszta
>   függvény, `app/games/word-rain.tsx` ezt hívja, 6 jest teszttel
>   (`lib/games/__tests__/wordRain.test.ts`): pontosan 1 `isTarget`, minden
>   eső szó a poolból jön, irány szerint helyes prompt/cél-nyelv, nincs
>   duplikált szöveg egy körön belül.
> - **`card_attempts` naplózás (K3, `type='game:<id>'`)** mind a négy F1/F2
>   játékban be van kötve: `getDb().recordAttempt(wordId, 'game:<id>', correct,
>   responseTimeMs)` minden érdemi válasznál (memory-pairs: pár-felfordítás;
>   word-search: megtalált szó; word-rain: elkapás/elvétés/leesés; bubble-pop:
>   pukkasztás). Ez csak statisztika, a `cards` táblát egyik játék sem írja.
> - **`lib/games/bubblePop.ts` új modul**, ugyanabból az okból, mint a
>   `wordRain.ts`: a 4.2 acceptance ("kategóriánként mindig van legalább 3 jó
>   és 3 rossz buborék, különben a kör nem indul el") csak akkor
>   tesztelhető unit-szinten, ha a kategória-választás + kör-összeállítás
>   NEM a képernyő-komponensbe van égetve. `buildBubbleRound(pool,
>   categorySet, count, seed, excludeCategoryValue?)` tiszta függvény, null-t
>   ad vissza, ha egyetlen kategória sem elégíti ki a 3+3 küszöböt (a hívó
>   ilyenkor másik kategória-készletre esik vissza, vagy véget ér a menet), 7
>   jest teszttel (`lib/games/__tests__/bubblePop.test.ts`).
> - **Óvatosság `useRef(...).current`-tel épített `PanResponder`-eknél és
>   `reanimated` `runOnJS` callback-eknél**: ezek a closure-ök csak EGYSZER
>   jönnek létre (mountkor), tehát a bennük hivatkozott plain state/const
>   BEFAGY az első render értékére. A word-search drag-select ezért `useRef`
>   tükrökön (`placementsRef`/`foundRef`/`sizeRef`) keresztül olvassa a
>   friss `placements`/`found`/`size` értéket, nem közvetlenül a state-ből; a
>   `useGameSession` metódusai (`addScore`, `pause`, ...) ellenben BIZTONSÁGOSAK
>   ilyen frozen closure-ökből hívva, mert `useCallback([])`-pal stabil
>   referenciák, és belül functional `setState`-et használnak, tehát mindig a
>   legfrissebb állapotot olvassák be, hívás-időben. Jövőbeli PanResponder-t
>   vagy reanimated `runOnJS`-t használó játék (pl. `sentence-tetris`, F6)
>   ugyanezt a mintát kövesse.

> **MEGVALÓSÍTÁSI JEGYZET (F3, grammar-choice, 2026-08-27):**
> - **`lib/games/content.ts` `GrammarItem` szerkezete eltér a 4.11 illusztratív
>   JSON-tól.** A `why` ott hu-only string + egy `wrong` alobjektum volt; a K21
>   döntés és a top-level i18n×4 szabály miatt mindkettő nyelv-kulcsolt lett:
>   `why[lang]`, `wrong[optionText][lang]`. A topic kapott egy `level: Level`
>   mezőt is (az illusztratív JSON-ban nem volt), mert az audit-script P1
>   ellenőrzése ehhez méri a mondat szókincsét (kumulált A0..level). Egy
>   opcionális `glossary` mező (a `story` `newWords` mintája) fedi az adott
>   szinten még nem tanított, de a mondatban muszáj szót.
> - **`lib/games/grammarChoice.ts` (`buildGrammarRound`)**: tiszta függvény,
>   a `lib/shuffle.ts` már meglévő `shuffleArray`/`shuffleOptions`/`hashString`
>   segédjeire épül (nem új kód), az item-sorrendet ÉS az egyes item opció-
>   sorrendjét is seedelt véletlennel kevri (FB2-mintájú pozíció-torzítás
>   ellen), 4 jest teszttel.
> - **„Mentsd a szabályt" (4.11 szövege) helyett fejléc-gomb.** A user-kérés
>   lényege a „visszanézhető szabály-lista"; ahelyett hogy per-item bookmark-
>   állapotot vezetnénk be (új DB-mező, extra UI), a topic `rule`+`more`
>   blokkja egy `📋 Szabály` fejléc-gombbal BÁRMIKOR elérhető a kör közben, 
>   ugyanaz a felhasználói érték, kevesebb új felület.
> - **`card_attempts` naplózás NEM fut grammar-choice-nál.** A tábla
>   `word_id INTEGER NOT NULL`-t ír elő, a grammar-item opciói (pl. `soy`/
>   `estoy`) viszont nem feloldható szótári szavak, nincs természetes
>   `wordId`. A kör eredménye a meglévő `game_scores`/`game_progress`
>   táblákba megy (`recordGameResult('grammar-choice', ...)`,
>   `setGameProgress('grammar-choice', topic.topic, 'done', {correct,
>   total})`), új DB-metódus nem kellett.

> **MEGVALÓSÍTÁSI JEGYZET (F3, confusables, 2026-08-27):**
> - **`ConfusablesDrill` kapott egy `type: 'gap' | 'reverse' | 'listening'`
>   mezőt** (a 4.12 illusztratív JSON csak a gap-alakot mutatta). A `reverse`
>   dril NEM tárol saját prompt-szöveget: a képernyő futásidőben építi a
>   „Melyik szó jelenti ezt: …" kérdést a helyes tag `gloss[nativeLang]`
>   mezőjéből, hogy a jelentés sose duplikálódjon a JSON-ban.
> - **A hallás-dril (K23) eszköz-tudatos.** A képernyő induláskor
>   `loadVoices()` + `hasVoiceFor(speechLang(learnedLang))`-tal dönti el, fut-e
>   TTS a nyelvre (FB144 őr), és `buildDrillRound(set, {allowListening}, seed)`
>   ez alapján szűri ki a `'listening'` tételeket, hangtalan eszközön a kör
>   csendben gap/reverse-re esik vissza, nem akad el.
> - **`card_attempts` naplózás itt sem fut**, ugyanazon okból, mint a
>   grammar-choice-nál (a hasonló-szó tagok jó része szándékosan ÚJ,
>   korpuszon kívüli szó, pl. güey, ahorita, , nincs `wordId`-ja). Rekord
>   `game_scores`/`game_progress` táblákba megy, ugyanúgy mint fent.
> - **`lib/games/gloss.ts` `overrides` paramétere lett a hordozó mindkét
>   tartalomtípushoz.** A grammar-choice topic `glossary`-ja és a confusables
>   set `members[].gloss` + `glossary`-ja is ezen keresztül válik
>   `GlossText`-ben koppintható jelentéssé; a `lib/games/content.ts` új
>   `cumulativeCorpusWordIds(level, lang)` segédje adja a `knownWordIds`
>   halmazt, hogy egy korpuszban MÁR tanított szó ne kapjon "új" pöttyözést
>   csak azért, mert ez a két játék nem a `vocabPool`-ból húz (lásd alább).
> - **Miért nem `vocabPool.ts`-ből jön a szókincs.** A 0. szekció szent
>   szabálya („minden szó a poolból, ami új, az gloss-olt") itt a
>   `scripts/audit-games.mjs` mechanikus kapuján keresztül érvényesül: minden
>   tartalom-szó vagy a szint kumulált korpuszában van, vagy explicit
>   `gloss`/`glossary` mezővel rendelkezik. Ez a `registry.ts` `minPoolSize:
>   undefined` kommentjében már F0 óta rögzített terv (content-driven játékok
>   tartalom-megléte, nem szószám-küszöb dönt), az F3 ezt implementálta.
> - **`scripts/audit-games.mjs` (3.6) most készült el**, a valódi F3 tartalom
>   ellen tesztelve. Spanyol matcher a `scripts/audit-corpus.mjs` mintáját
>   követi (glue-lista, plural/gender-variáns, ige-tő), DE szándékosan
>   EGYSZERŰSÍTVE: nincs kézzel karbantartott rendhagyó-paradigma-map, mert a
>   tartalom-szerzők a `glossary` mezőt használják bármi igazán rendhagyóra
>   (ez sokkal karbantarthatóbb, mint egy második paradigma-map szinkronban
>   tartása). Az ige-tő egyezés küszöbe (3 karakter, nem a corpus-audit 4-e),
>   mert a rövid `-er` igék (`coser`, `pasar`) 3 betűs tövei így is
>   egyértelműek maradnak F3 tartalmán belül, és jóval kevesebb hamis P1-et ad.

---

## 4. Játék-specifikációk

Minden szekció: **Cél / Loop / Adat / Beállítás / Pontozás / Új szó / Acceptance / Kérdések**.

---

### 4.1 `word-rain`, Szó-eső

**Cél:** gyors felismerés forrásnyelv → tanult nyelv, hasonló alakok szétválasztásával.

**Loop (A-variáns, a beszélgetésben ez volt a favorit):**
1. Alul fix sávban egy prompt a **forrásnyelven** (nem „magyar", hanem a pár
   `source` nyelve, `getOnboarding().source`), pl. `kutya`.
2. Fentről 4-6 szó esik a **tanult nyelven**, vízszintesen szétszórva,
   különböző sebességgel: `perro, gato, pero, pared, puerta`.
3. Bármikor koppintható, amíg esik. Jó találat → pukkan, pont, új prompt.
4. Rossz koppintás VAGY a helyes szó átlépi az alsó vonalat → élet -1.
5. 3 élet elfogy → vége. Eredmény-kártya, rekord.

**C-variáns (kosaras):** alul balra-jobbra húzható kosár, a helyes szót el kell
kapni, a többit kikerülni. Több ügyesség, kevesebb tempó. **K4** dönt.

**Adat:** `getLearnedPool({minSize: 20})`. Elosztók: `pickDistractors(target, pool,
{mode: 'nearMiss'})`, a meglévő `nearMissDistractors()`-ra épül, tehát
`pero` / `perro`, `puerta` / `puerto` típusú párok jönnek, nem random szemét.

**Beállítás:** irány (forrás→tanult / tanult→forrás), kezdősebesség (lassú/normál/gyors),
egyszerre eső szavak száma (3/4/5/6), elosztó-nehézség (random / hasonló alakú).

**Pontozás:** találat = 100 pont × kombó-szorzó (1.0 / 1.25 / 1.5 / 2.0, 5 hibátlanonként lép).
Gyors találat (< 1.5 s) +50 bónusz. Vége: rekord-mentés `game_scores`-ba.

**Nehézség-skálázás menet közben:** minden 10 találat után esési idő -8 %,
padló 2.2 s. 20 találat után az elosztók átváltanak „csak hasonló alakú"-ra.

**Új szó:** ha `isNew`, a szó **halványan pöttyözött**, és az első leesésekor
nem vesz el életet, hanem megáll és kiírja a jelentését („Ez új: `puerta` = ajtó"),
majd folytatódik. Egy szó ezt egyszer kapja meg futamonként.

**Tech:** `react-native-reanimated` 4.3.1 (megvan), `withTiming` + `runOnJS`.
Nincs új natív függőség.

**Acceptance:**
- 60 mp-es futam alatt nincs képkocka-dobás Nokia X30-on
- soha nem esik olyan szó, ami nincs a poolban
- a kombó és az élet a `GameShell` fejlécében látszik
- jest: `wordRain.test.ts`, a generátor mindig pontosan 1 helyes választ ad

**Kérdések:** nincs nyitott kérdés.

---

### 4.2 `bubble-pop`, Buborék-pukkasztó kategória szerint

**Cél:** jelentésmezők, szófajok, nyelvtani nemek gyors felismerése.

**Loop:**
1. Felül a feladat: „Pukkaszd ki az **ételeket**" / „Pukkaszd ki a **nőnemű** szavakat"
   / „Pukkaszd ki az **igéket**" / „Pukkaszd ki a **múlt idejű** alakokat".
2. 12-16 buborék lebeg lassan, mindegyikben egy tanult szó.
3. Jó buborék pukkasztása = pont. Rossz = élet -1 és a buborék pirosan villan.
4. Ha minden jót kipukkasztottál, új kör új kategóriával, 5 kör után vége.

**Adat, és itt van a fő nehézség:** a kategóriák metaadatot igényelnek, ami MA
nincs a szómodellben (`WordEntry`-ben nincs `pos`, `gender`, `tense`).
Két út:

- **(a) Származtatás:** a témafa (`data/topics/*.json`) már csoportosít
  (étel, család, közlekedés), ez ingyen van. Nem + szófaj heurisztikával:
  spanyol `-o` → hím, `-a` → nő (kivétel-lista: `el día`, `la mano`, `el problema`,
  `el mapa`, `la foto`), ige = a szótári alak `-ar/-er/-ir`-re végződik.
  Olcsó, kb. 90 %-os, a kivételeket kézzel karban kell tartani.
- **(b) Adatbővítés:** a `WordEntry`-be új opcionális mezők (`pos`, `gender`),
  feltöltés scripttel + kézi ellenőrzés. Drága, de utána MINDEN játék pontosabb
  (a `conjugation-slot` és a `grammar-choice` is ebből él).

**K6** dönt. A javaslatom: (b), mert 3 másik játék is erre épül, és a hibás
nyelvtani nem tanítás-szinten káros.

**Beállítás:** buborékok száma (8/12/16), lebegés sebessége, kategória-készlet
(téma / szófaj / nyelvtani nem / igeidő), időlimit kör (nincs / 30 mp / 20 mp).

**Új szó:** új szót a buborék pöttyözve mutat, koppintás **hosszan** (long press)
= gloss, rövid koppintás = pukkasztás. Így nem ütközik a két gesztus.

**Acceptance:** kategóriánként mindig van legalább 3 jó és 3 rossz buborék,
különben a kör nem indul el.

**Kérdések:** nincs nyitott kérdés.

---

### 4.3 `memory-pairs`, Memóriapárosító

**Cél:** passzív felidézés, nulla gépelés, nulla időnyomás.

**Loop:** klasszikus. Rács lefordított lapokkal, koppintás felfordít kettőt,
`perro` ↔ `kutya` pár = marad felfordítva, különben visszafordul.
Minden párosításkor a tanult nyelvű oldal felolvasásra kerül (TTS), így hallod is.

**Beállítás:** rácsméret (4×3 = 6 pár / 4×4 = 8 pár / 5×4 = 10 pár / 6×5 = 15 pár),
párosítás típusa (szó ↔ jelentés / szó ↔ mondat-hézag / szó ↔ hang), TTS ki/be.

**Pontozás:** alap 1000, minden fölösleges lapfordítás -10, idő-bónusz.
Rekord = legkevesebb lépés adott rácsméreten.

**Új szó:** a memóriajátékban az új szó **elsőre tanít**: az első felfordításkor
2 másodpercig kiírja alá a jelentést, utána már nem.

**Acceptance:** a rács kifér 360 dp széles kijelzőn görgetés nélkül 5×4-ig.

**Kérdések:** nincs nyitott kérdés.

---

### 4.4 `word-search`, Szókereső rács

**Cél:** helyesírás-kép, betűsor-felismerés, nulla agyi terhelés.

**Loop:**
1. Rács betűkkel, oldalt a keresendő szavak listája a **forrásnyelven**
   (tehát `kutya`-t látsz, de `perro`-t kell megtalálnod, ettől lesz tanulás).
2. Ujjal végighúzol a betűkön (`PanResponder`, nincs új natív függőség).
3. Találat → a szó áthúzva a listán, a betűk kiszíneződnek.
4. Minden szó meglett → vége, idő-alapú pont.

**Beállítás (a user kifejezetten ezt kérte, „lehessen változtatni hányszor hányasat"):**
- rácsméret: 6×6 / 8×8 / 10×10 / 12×12
- szavak száma: 4 / 6 / 8 / 10
- irányok: csak vízszintes+függőleges / átlós is / visszafelé is
- lista nyelve: forrásnyelv (nehezebb) vagy tanult nyelv (könnyebb, csak keresés)

**Generátor:** `lib/games/wordSearch.ts`, tiszta függvény, jól tesztelhető:
`buildGrid(words, size, dirs, rng) → {grid, placements}`. Backtracking elhelyezés,
ha egy szó nem fér el, kisebbre cserél a poolból. Kitöltés a tanult nyelv
betűgyakorisága szerint (spanyolnál `ñ`, `á`, `é` is bekerül, hogy ne legyen árulkodó).

**Új szó:** a lista mellett az új szónál pötty, koppintásra gloss.

**Acceptance:** 12×12 rács 10 szóval < 50 ms alatt generálódik, 200 futásból
0 sikertelen elhelyezés.

**Kérdések:** nincs nyitott kérdés.

---

### 4.5 `story`, Sztori-mód

**Cél:** olvasás-élmény, nem dril. A user kiemelte: „ezzel többet is akarok
foglalkozni, és sztorit is akarok hozzá írni."

**Loop:**
1. Sztori-választó: kártyák (borító-emoji, cím, szint, hossz, ✓ ha kész).
2. Megnyitás → a sztori **jelenetenként** halad, jelenetenként 3-6 mondat.
3. Minden szó koppintható (`GlossText`), új szó pöttyözött.
4. Jelenet végén 1 könnyű megértés-kérdés (2-3 válasz), a válasz nem büntet,
   csak visszajelez. Rossz válasznál újraolvasható a jelenet.
5. Sztori végén: „ebben a sztoriban ezeket tanultad" lista + gomb: az új szavak
   bekerülnek a rendes SRS-be (`cards` insert) és/vagy a helyesírás-listába.

**Adatformátum** (`data/games/stories/<lang>/<id>.json`):

```json
{
  "id": "el-mercado",
  "level": "A1",
  "title": { "es": "El mercado", "hu": "A piac", "en": "The market", "de": "Der Markt" },
  "cover": "🍅",
  "estMinutes": 3,
  "scenes": [
    {
      "id": "s1",
      "text": { "es": "María va al mercado. Compra tomates y pan." },
      "translation": { "hu": "Mária a piacra megy. Paradicsomot és kenyeret vesz." },
      "newWords": [
        { "word": "mercado", "gloss": { "hu": "piac", "en": "market", "de": "Markt" } }
      ],
      "question": {
        "prompt": { "hu": "Mit vesz María?" },
        "options": [
          { "es": "tomates y pan", "correct": true },
          { "es": "leche y café" },
          { "es": "un coche" }
        ]
      }
    }
  ]
}
```

**A user saját sztorijai:** ez külön alrendszer, és fontos. Három lehetséges út:

- **(a) Fájl-alapú:** a user (vagy Claude a user diktálása alapján) ír egy
  markdownt/JSON-t a repóba, a build beleforgatja. Nulla app-munka, de
  telefonon nem szerkeszthető, és app-frissítés kell hozzá.
- **(b) App-beli szerkesztő:** új képernyő, cím + jelenetek + fordítás,
  `game_progress`/új tábla, tehát telefonon írható. Sok UI-munka.
- **(c) Import:** a user bárhol megírja, JSON-fájlként megosztja az appnak
  (`expo-document-picker`, ami MÁR függőség a Restore miatt), az app importálja
  és a saját sztorijai közé teszi. Középút, kevés kód, telefonról is megy.

**K10** dönt. Javaslatom: **(c) most, (b) később**, mert (c) kb. egy nap munka
és azonnal használható, plusz a Claude-dal írt sztorik így egy paranccsal
átjönnek a telefonra.

**Beállítás:** betűméret, fordítás megjelenítése (soha / koppintásra / mindig),
felolvasás jelenetenként (ki/be).

**Acceptance:** `audit-games.mjs` 0 P1 minden sztorira, azaz minden szó vagy
kumulált szinten tanult, vagy van `gloss`-a.

**Kérdések:** nincs nyitott kérdés.

---

### 4.6 `chat`, Tanácsadó beszélgetés (ÚJRATERVEZVE, K24)

**Cél:** a user irányváltása után ez már nem nyelvvizsga-szerepjáték, hanem
**valódi tudást átadó beszélgetés**: olyan helyzetek, ahol létezik egy nagyjából
mindenki által elfogadott 6-8 pontos lista, amit tudni érdemes, és a beszélgetés
ezt adja át, spanyolul, elágazásokkal.

**A lényeg egy mondatban:** a végén nem azt tanultad meg, hogyan mondj
valamit spanyolul, hanem azt, **mit kell kérdezned az életben**, és mellékesen
spanyolul tanultad meg.

**Loop:**
1. Téma-választó kártyák: „Használt autót veszek", „Lakást bérelek", „Egészségesebben
   akarok enni", „Karrier-váltáson gondolkodom", „Valaki gyanúsan ír WhatsAppon".
2. **Beállító kérdés** (1-2 db), ami állapotot ad a beszélgetésnek: mennyi a kereted,
   mi a célod, mennyi időd van. A user szava: „más kimenetele legyen ha mást mondasz.
   mondjuk ha kevés pénzed van vagy ha sok".
3. A partner (eladó, bérbeadó, tanácsadó, csaló) ír spanyolul, chat-buborékban, TTS-sel.
4. Te 3 lehetőség közül választasz, és **az egyik mindig a szakmailag helyes kérdés**.
   A rossz választás nem büntet, csak más kimenetel felé visz, és a végén látszik,
   mit hagytál ki.
5. A végén **checklist-kártya**: a 6-8 kanonikus kérdés vagy szabály az adott
   helyzetre, spanyolul és magyarul, **forrásokkal**. Ez a kártya elmenthető és
   bármikor visszanézhető a témalistából.

**Példa, „Használt autót veszek" checklist (a beszélgetésben szétosztva):**
szervizkönyv és tulajdonosok száma, valós futott kilométer és annak nyoma,
karambol-előzmény és festékréteg-vastagság, rozsda a küszöbnél és a kerékjáratnál,
hideg indítás és füstszín, tesztút országúton is, papírok és terhelés-mentesség,
független szakértői átvizsgálás ára és megéri-e. Kevés kerettel más ág fut
(megbízhatóság és fenntartási költség), sok kerettel más (garancia, állapot,
utólagos értékvesztés).

**Kemény szabály a tartalomra, a `myth` játékkal közösen:** a checklist minden pontja
**ellenőrizhető forrásra** épül (szakportál, hatóság, fogyasztóvédelem, tudományos
összefoglaló), és a forrás megjelenik a kártyán. Kitalált „jó tanács" nem szállítható.
Ahol nincs valódi szakmai konszenzus, ott a kártya kimondja, hogy vitatott.

**Adatformátum** (`data/games/chats/<lang>/<id>.json`): irányított gráf +
állapot-változók + checklist:

```json
{
  "id": "coche-usado",
  "level": "A2",
  "title": { "hu": "Használt autót veszek", "es": "Compro un coche usado" },
  "setup": [
    { "id": "budget", "prompt": { "hu": "Mekkora a kereted?" },
      "options": [ { "value": "low", "label": { "es": "Poco dinero." } },
                   { "value": "high", "label": { "es": "Tengo suficiente." } } ] }
  ],
  "nodes": [
    { "id": "n1", "npc": { "es": "Es un buen coche, muy poco usado." },
      "options": [
        { "es": "¿Tiene libro de servicio?", "next": "n2", "good": true, "checklist": "service-book" },
        { "es": "Me gusta el color.", "next": "n2b" }
      ] }
  ],
  "checklist": [
    { "id": "service-book", "es": "¿Tiene libro de servicio y cuántos dueños ha tenido?",
      "hu": "Van szervizkönyv, és hány tulajdonosa volt?",
      "why": { "hu": "A hiányzó szervizkönyv a leggyakoribb figyelmeztető jel..." },
      "source": { "label": "...", "url": "..." } }
  ],
  "endings": [ { "id": "good-deal", "if": "checklist>=6", "title": { "hu": "Jó vásár" } } ]
}
```

**Induló készlet (5 téma):**

| Téma | Miért ez | Állapot-változó |
|---|---|---|
| Használt autó vásárlása | a user saját példája | keret (kevés / sok) |
| Lakásbérlés CDMX-ben | közelgő élethelyzet | keret, városrész |
| Egészségesebb étkezés | a user kcal-követése miatt releváns | cél (fogyás / izom / energia) |
| Karrier-tanácsadás | a user aktív álláskeresése | tapasztalat, kockázattűrés |
| Gyanús WhatsApp-üzenet | a user választása, Mexikóban tömeges | nincs, egyenes ág |

**Újrajátszhatóság:** a `game_progress.data_json` tárolja, melyik befejezéseket és hány
checklist-pontot értél el („6 / 8 kérdést tettél fel"). Ez adja a visszatérés-okot.

**Nyelvi szint:** A1-en a fordulatok max 6 szó, a checklist magyarul is ott van teljes
egészében. B1-től a checklist is spanyolul kerül elő először, magyar a koppintás mögött.

**Kérdések:** nincs nyitott kérdés.

### 4.7 `conjugation-slot`, Ragozás-slot

**Cél:** igeragozás automatizmus, 2 másodperc/kérdés tempóban.

**Loop:** `yo ___ (comer)` és 3 gomb: `como / comes / come`.
Koppintás, azonnali zöld/piros, következő. 20 kérdés = egy futam.
Rossz válasz után **1 soros** magyarázat villan („`yo` alakja `-o`-ra végződik").

**Adat:** ragozási táblák generálva, nem kézzel. `lib/games/conjugate.ts`:
szabályos `-ar/-er/-ir` végződések + rendhagyó lista (`ser, estar, ir, tener,
hacer, poder, decir, ver, dar, saber, querer, venir, poner, salir`).
Csak olyan igét kérdez, ami a poolban van.

**Beállítás:** igeidők (jelen / múlt indefinido / imperfecto / jövő / feltételes /
kötőmód jelen), csak szabályos vagy rendhagyó is, kérdésszám (10/20/30),
időlimit kérdésenként (nincs / 5 mp / 3 mp).

**Nyelvfüggőség:** ez a játék nyelvspecifikus motort igényel. Spanyolra teljes,
angolra jóval kisebb (`-s`, `-ed`, rendhagyó múlt), németre nagy meló.
Javaslat: **spanyol először**, a többi nyelven a játék kártyája „hamarosan"
állapotban, nem zárolva-de-hibás. **K15.**

---

### 4.8 `odd-one-out`, Kakukktojás

**Cél:** jelentésmezők, kategória-gondolkodás, és egyben CCAT-alapozás.

**Loop:** 4 szó, koppintsd ki, ami kilóg. Válasz után **mindig** kiírja, mi volt
a közös szál („a többi mind gyümölcs"), tehát tanít, nem csak tesztel.

**Adat:** téma-metaadatból generálva (3 szó azonos `topicId`, 1 másikból).
Nehezebb szint: szófaj / nyelvtani nem / igeidő szerinti kilógás,
tehát ugyanaz a metaadat-kérdés, mint a `bubble-pop`-nál (K6).

**Beállítás:** kérdésszám, nehézség (téma / szófaj / vegyes), időlimit.

**Kérdések:** nincs nyitott kérdés (a metaadat K6-ban eldőlt).

---

### 4.9 `sentence-tetris`, Mondat-Tetris

**Cél:** szórend, elöljárók, névelők, esés közbeni döntés.

**Loop:**
1. Felül a mondat a forrásnyelven: „A kutya a kertben van."
2. Fentről szó-blokkok esnek egyesével: `en / el / perro / jardín / está`.
3. Balra-jobbra tolod az esőt, és az alsó sorba **a helyes pozícióba** ejted.
4. Ha jó helyre esik, beragad, zölden. Ha rosszra, a sor megemelkedik (mint a
   Tetris szemétsora), 4 hibás blokk = vége.
5. Kész mondat = sor eltűnik, pont, jön a következő mondat.

**Adat:** a `cards` mondat-oldala, tehát a `sentence_<lang>` mezők,
csak olyan mondat, aminek MINDEN szava a poolban van (ezt a `sentenceMix.ts`
és az `audit-corpus` logikája már ismeri).

**Beállítás:** esési sebesség, kaphat-e csali-blokkot (a `nearMissDistractors`-ból),
mondat-hossz plafon.

**Megjegyzés a kockázatról:** ez a legdrágább játék (fizika + gesztus + ütközés).
Javaslat: **utolsóként** épüljön, miután a keret bevált. **K16.**

---

### 4.10 `ccat`, CCAT-felkészítő (könnyített)

**Cél:** a user új igénye: „azt akarom, hogy a CCAT tesztre is készítsen fel az
app, ahhoz hasonló dolgok is legyenek benne, csak nyilván sokkal könnyebben,
meg egyszerűbben."

**Mi a CCAT:** Criteria Cognitive Aptitude Test, 50 kérdés 15 perc alatt,
három terület keverve: verbális, matek/logika, térbeli. Nincs számológép.
A tipikus buktató nem a nehézség, hanem a **tempó** és a **típusváltás**.

**A könnyített app-verzió („CCAT-lite"):** 15 kérdés, 5 perc, kevert típusok,
minden szöveges item a **tanult nyelven**, gloss-szal. Tehát egyszerre készít fel
a tesztre ÉS gyakoroltatja a szókincset. Ez a kettősség a lényeg.

**Item-típusok és honnan jönnek:**

| Típus | Példa | Forrás | Nyelvi haszon |
|---|---|---|---|
| Analógia | `perro : cachorro :: gato : ___` | authored párok + pool | nagy |
| Ellentét | „Mi a `caliente` ellentéte?" | `antonym` metaadat | nagy |
| Szinonima | „Melyik jelent ugyanazt: `rápido`?" | `synonym` metaadat | nagy |
| Kakukktojás | 4 szó, 1 kilóg | a `odd-one-out` motorja | nagy |
| Mondat-kiegészítés | `Ella ___ al trabajo en coche.` | a `grammar-choice` motorja | nagy |
| Betűkeverék | `rrepo` → `perro` | pool, generált | közepes |
| Számsor szóval | `dos, cuatro, seis, ___` | számnevek a tanult nyelven | közepes |
| Szöveges feladat | „María tiene 3 manzanas, compra 5 más..." | authored sablonok | közepes |
| Utasítás-követés | „Koppints arra, ami étel ÉS nőnemű" | metaadat | közepes |

**Térbeli itemek: kimaradnak (K17, 2026-08-26).** A user döntése szerint az
alakzat-forgatós rész nem épül meg, tehát nincs szükség `react-native-svg`-re, és a
játék minden itemje a szókincsre vagy a logikára épül.

**Loop:** „Indul" → 3-2-1 → kérdések egyesével, felül fogyó idősáv és `7 / 15`.
Nincs visszalépés (mint az igazi CCAT). Végén: pontszám, típusonkénti bontás
(„verbális 5/6, logika 3/5, térbeli 2/4"), és a hibás itemek átnézhetők
magyarázattal.

**Beállítás:** kérdésszám (10/15/25/50), idő (arányos vagy „nincs idő" gyakorló-mód),
típus-mix (mindet / csak verbális / csak logika), nyelv (tanult nyelven / forrásnyelven).

**Kérdések:** nincs nyitott kérdés.

---

### 4.11 `grammar-choice`, „Melyik a helyes?" plusz magyarázat

**Cél:** a user új igénye: „ilyen nyelvtani gyakorlós feladat is legyen benne,
hogy melyik helyes meg legyen úgy, hogy magyarázza is el a nyelvtant."

**Loop:**
1. Mondat hézaggal: `Yo ___ estudiante.`
2. 2-4 opció: `soy / estoy / es`
3. Koppintás → azonnal zöld/piros
4. **Mindig** (jó válasznál is) megjelenik a magyarázat-kártya:
   - egy mondatos szabály: „`ser` = állandó tulajdonság, `estar` = állapot/hely."
   - miért rossz a többi: „`estoy estudiante` azért nem jó, mert a foglalkozás
     állandó tulajdonság."
   - 2 további példa
   - „Értem" gomb, illetve „Mentsd a szabályt" (visszanézhető szabály-lista)
5. 10-15 item = egy futam, témakörre szűrhető.

**Teljes spanyol nyelvtani lefedettség (K20, „csinálj meg mindent").** Az alábbi 59
téma a cél-készlet. Egy téma = egy JSON-fájl + egy szabály-kártya + 10-15 item.
A batch-ek token-égetéssel haladnak, a sorrend a tanulási sorrend.

**SCOPE-DÖNTÉS (2026-08-26).** User: „a nyelvtanos részt csinálj meg 2-3 témakört és
tedd késznek a többit majd token égetésnek bele tesszük."
Tehát az F3 fázis akkor **KÉSZ**, ha a motor teljes és **három** témakör tartalma megvan.
A maradék 56 téma nem vész el: átkerül a 10. szekció token-burn queue-jába, és külön
menetekben töltődik fel. A motor és az adatformátum már mind az 59 témát elbírja, tehát
új témát hozzáadni = egy JSON-fájl, nulla kód.

**Most megépülő három téma:**

| # | téma-id | Mi ez | Miért ez |
|---|---|---|---|
| 1 | `ser-estar` | állandó tulajdonság vs állapot és hely | a legtöbbet hibázott pár, és az appban MÁR van hozzá ellenőrzött magyarázat (FB85), tehát a tartalom fele készen áll |
| 2 | `articulos-genero` | el/la/los/las, un/una, nyelvtani nem | A1-en minden mondatban ott van, és a `pos`+`gender` metaadat (F-1) most készült el hozzá |
| 3 | `por-para` | ok vs cél | a user külön nevesítette, és nincs magyar megfelelője, tehát csak sok példával ül le |

A negyedik választott téma (`indefinido-imperfecto`) a token-burn queue **első** itemje
lesz, mert a user még A1-en van, a múlt idők pedig A2-től esedékesek.

**A teljes cél-készlet (59 téma), a token-burn menetek sorrendjében:**

**Q1 (A1-es alapok):** `sustantivo-numero`, `adjetivo-concordancia`, `presente-regular`,
`presente-irregular`, `verbos-diptongo` (e→ie, o→ue, e→i), `hay-estar`, `posesivos`,
`demostrativos`, `interrogativos`, `negacion`, `gustar`, `ir-a-infinitivo`,
`muy-mucho`, `numeros-hora-fecha`, `preposiciones-basicas`.

**Q2 (A2):** `indefinido-imperfecto` (ELSŐ), `verbos-reflexivos`, `pronombres-od`,
`pronombres-oi`, `combinacion-pronombres`, `indefinido-regular`, `indefinido-irregular`,
`imperfecto`, `perfecto`, `estar-gerundio`, `imperativo-afirmativo`,
`imperativo-negativo`, `comparativos-superlativos`, `saber-conocer`, `pedir-preguntar`,
`llevar-traer-ir-venir`, `futuro-simple`, `indefinidos`.

**Q3 (B1):** `subjuntivo-presente-forma`, `subjuntivo-disparadores`, `ojala-quizas`,
`condicional-simple`, `condicionales-tipo1`, `relativos`, `se-impersonal-pasiva`,
`perifrasis`, `por-para-avanzado`, `pluscuamperfecto`, `temporales-subjuntivo`.

**Q4 (B2):** `subjuntivo-imperfecto`, `condicionales-tipo2-3`, `estilo-indirecto`,
`pasiva-ser-participio`, `concesivas`, `finales-causales`, `subjuntivo-perfecto`,
`lo-neutro`, `gerundio-participio-construcciones`.

**Q5 (C1):** `futuro-condicional-perfecto`, `probabilidad-con-tiempos`,
`relativos-complejos`, `leismo-laismo`, `marcadores-discursivos`.

**Nyelvi kiterjeszthetőség:** a motor és a formátum nyelvfüggetlen, a fájlok
`data/games/grammar/<lang>/<topic>.json` alatt vannak. Az angol és a német ág
később ugyanide kerül (angolra pl. `articles`, `some-any`, `much-many`,
`present-perfect-vs-past`, `do-does`, `will-going-to`, `prepositions-in-on-at`),
de MOST csak a spanyol tartalom készül el.

**Adatformátum** (`data/games/grammar/<lang>/<topic>.json`):

```json
{
  "topic": "ser-estar",
  "title": { "hu": "ser vagy estar?", "en": "ser or estar?" },
  "rule": { "hu": "A ser állandó tulajdonságot..., az estar állapotot vagy helyet jelöl." },
  "items": [
    {
      "id": "se-01",
      "sentence": "Yo ___ estudiante.",
      "options": ["soy", "estoy", "es"],
      "correct": 0,
      "why": {
        "hu": "A foglalkozás állandó tulajdonság, ezért ser: yo soy.",
        "wrong": { "estoy": "Az estar állapot vagy hely, a foglalkozás nem az." }
      },
      "examples": ["Ella es médica.", "Nosotros somos amigos."]
    }
  ]
}
```

**Fontos design-döntés:** a magyarázat **a forrásnyelven** van (magyarul), mert
nyelvtant a kezdő nem tud célnyelven megérteni. A példák a tanult nyelven.

**Kérdések:** nincs nyitott kérdés.

---

### 4.12 `confusables`, Hasonló szavak megkülönböztetése

**Cél:** a user új igénye: „olyan feladat is legyen, ami hasonló szavakat magyaráz
el és segít megkülönböztetni őket, mint az angolban a which / witch / with, vagy
a spanyolban a sueldo / suelo / suelto."

A user példája pontosan jó, spanyolul a hármas: **sueldo** (fizetés) /
**suelo** (padló, illetve „szoktam") / **suelto** (laza, aprópénz).

**Loop, két fázisban (ez a különbség a sima kvízhez képest):**

**A) Tanító-kártya** (először, egyszer per készlet):
```
┌──────────────────────────────────────────┐
│  sueldo  /  suelo  /  suelto             │
│                                          │
│  sueldo   = fizetés (a pénz, amit kapsz) │
│             „Mi sueldo es bueno."        │
│  suelo    = padló, illetve „szoktam"     │
│             „El suelo está frío."        │
│             „Suelo comer a las dos."     │
│  suelto   = laza, aprópénz               │
│             „¿Tienes suelto?"            │
│                                          │
│  🧠 Fogódzó: sueldo → SUELDO = SOLDO,    │
│     a katona zsoldja. Padló = suelo,     │
│     ott a talpad (SUELa = talp).         │
└──────────────────────────────────────────┘
```

**B) Dril** (utána, keverve):
- mondat-hézag: `¿Tienes ___ para el taxi?` → `sueldo / suelo / suelto`
- fordított: „Melyik jelenti azt, hogy padló?"
- hallás után (TTS): melyiket mondtam? (itt tényleg csak a hangzás dönt)
- rossz válasznál a tanító-kártya érintett sora újra felvillan

**Adatformátum** (`data/games/confusables/<lang>/<id>.json`):

```json
{
  "id": "sueldo-suelo-suelto",
  "level": "A2",
  "members": [
    { "word": "sueldo", "gloss": { "hu": "fizetés" }, "hint": { "hu": "zsold, a pénz amit kapsz" },
      "examples": ["Mi sueldo es bueno.", "Cobro el sueldo el día 15."] }
  ],
  "mnemonic": { "hu": "sueldo = zsold, suelo = talp alatt a padló, suelto = laza aprópénz." },
  "drills": [ { "sentence": "¿Tienes ___ para el taxi?", "correct": "suelto" } ]
}
```

**Spanyol induló készlet (K22 szerint, három osztály).** A kimaradt csoportok a
formátumban bármikor pótolhatók, csak most nem épülnek meg.

**(1) Alaki csapdák, egy betű dönt:**

| Csoport | Miért téveszthető |
|---|---|
| sueldo / suelo / suelto | a user saját példája: fizetés / padló (és „szoktam") / laza, aprópénz |
| pero / perro | egy `r`, „de" vs „kutya" |
| caro / carro | egy `r`, „drága" vs „autó" (Mexikóban carro, nem coche) |
| casa / caza | seseóval azonos hangzás, „ház" vs „vadászat" |
| cocer / coser | „főzni" vs „varrni", azonos hangzás |
| ves / vez | „látod" vs „alkalom" |
| echo / hecho | néma `h`, „dobok" vs „megtett, tény" |
| pimienta / pimiento | „bors" vs „paprika", az appban már van hozzá jegyzet (FB151) |

**(2) Kétféle „ugyanaz", magyarul egy szó, spanyolul kettő:**

| Csoport | A különbség |
|---|---|
| saber / conocer | tudni egy tényt vs ismerni személyt, helyet |
| pedir / preguntar | kérni valamit vs kérdezni valamit |
| llevar / traer | odavinni vs idehozni, a beszélő nézőpontja dönt |
| ir / venir | menni vs jönni, ugyanaz a nézőpont-logika |
| ser / estar | átfed a `grammar-choice` játékkal, itt a szópár-oldala |
| hay / está | létezés vs konkrét dolog helye |
| vaso / copa / taza | pohár / talpas pohár / csésze |
| mirar / ver | nézni (szándék) vs látni (érzékelés) |
| quedar / quedarse | találkozni, maradni valahol, illeni |

**(3) Mexikói csapdák, ahol a spanyolországi tudás félrevisz:**

| Szó | Mit kell tudni |
|---|---|
| coger | Spanyolországban „fogni, venni", Mexikóban vulgáris. Helyette `agarrar`, `tomar` |
| ahorita | nem „azonnal": jelenthet öt percet, három órát, vagy soha |
| mande | Mexikóban ez a „tessék?", nem a `¿qué?`, ami ott nyersnek hat |
| güey / wey | mindennapos megszólítás barátok közt, idegennel kerülendő |
| chingar-kör | rendkívül gyakori, sok jelentésű, és erősen vulgáris. Felismerni kell, használni nem |
| platicar / hablar | Mexikóban `platicar` a beszélgetni, Spanyolországban `charlar` |
| carro / coche, celular / móvil, computadora / ordenador, jugo / zumo | ugyanaz a dolog, más szó a két parton |

Angol készlet (hu→en ág): `which/witch`, `their/there/they're`, `its/it's`,
`then/than`, `lose/loose`, `affect/effect`, `weather/whether`, `to/too/two`,
`your/you're`, `desert/dessert`.

Német: `das/dass`, `seit/seid`, `wieder/wider`, `Sie/sie/sie`, `wenn/wann`.

**Kérdések:** nincs nyitott kérdés.

---

### 4.13 `myth`, Igaz vagy kamu (ÚJ, a K13 irányváltásból)

**Cél:** a user kifejezett kérése, hogy legyen valami, aminek nincs tanulás-szaga:
„olyan dolgok amit álltalában az emberek rosszul tudnak, ezek nagyon jókat mennek
tiktokon". Tartalom-fogyasztás érdekes tényekből, ahol a nyelv csak a hordozó.

**Név:** hu „Igaz vagy kamu?", en „True or myth?", es „¿Mito o realidad?",
de „Wahr oder Mythos?".

**Loop:**
1. Egy állítás a **tanult nyelven**, nagy betűvel, 1-2 mondat. Minden szó koppintható
   (`GlossText`), az új szavak pöttyözve.
2. Két nagy gomb: **IGAZ** / **KAMU**. Nincs időlimit, nincs élet.
3. Koppintás után a kártya megfordul: a verdikt, 2-3 mondatos magyarázat a **forrás-
   nyelven** (mert a poén az információ, nem a nyelvi teljesítmény), és alul egy halvány
   **forrás-sor**.
4. „Következő" gomb. Egy futam 10 állítás, a végén: „7/10, és ezt a hármat tudtad rosszul".
5. Sorozat-számláló: hány igaz tippet toltál el egymás után. Ez a visszatérés-motor.

**Tartalom-sávok** (`data/games/myths/<lang>/<id>.json`):

| Sáv | Példa | Miért ide |
|---|---|---|
| Közhiedelem | „A Nagy Fal nem látszik a Holdról szabad szemmel." | a klasszikus TikTok-anyag |
| Test és étel | „A cukor nem teszi hiperaktívvá a gyerekeket." | mindenki érintett |
| Mexikó / CDMX | „A csípős nem árt a gyomornak, de a reflux ellen sem véd." | közvetlenül hasznos neked |
| Maga a nyelv | „Az `ñ` nem díszítés: középkori másolók rövidítették vele a kettős `nn`-t." | nyelvtanulás, de sztoriként |

**Adatformátum:**

```json
{
  "id": "muralla-china",
  "level": "A1",
  "claim": { "es": "La Muralla China se ve desde la Luna." },
  "verdict": "myth",
  "explanation": {
    "hu": "Nem látszik. Szabad szemmel a Holdról egyetlen emberi építmény sem látható, a fal ugyan hosszú, de csak pár méter széles.",
    "en": "..."
  },
  "source": { "label": "NASA Earth Observatory (2005)", "url": "https://earthobservatory.nasa.gov/images/5385" },
  "gloss": [ { "word": "muralla", "hu": "fal, várfal" } ]
}
```

**Kemény szabály a tartalomra:** minden item kap **ellenőrizhető forrást**, és
kitalált, meg nem erősített állítás nem szállítható. Ez ugyanaz a szabvány, amit a
`sentence-facts` skill már bevezetett a mondat-tényekre (FB154-157). Ha egy állítás
forrása bizonytalan, kimarad, nem „nagyjából igaz" jelöléssel megy be.

**Nyelvi kapcsolat:** az állítás mondata a tanult nyelven van, a szint kumulált
szókincséből, a kilógó szavak `gloss` mezővel. Tehát miközben tényeket olvasol,
a szókincsedet is pörgeted, de a képernyőn nem az látszik, hogy tanulsz.

**Kapcsolat a sztori-móddal:** 5 összefüggő tény egy témából = egy „ismeretterjesztő"
sztori a sztori-módban. A két játék ugyanabból a tartalom-készletből is táplálkozhat,
ha egy tény-csomag elég összefüggő.

**Beállítás:** sávok ki-be (közhiedelem / test-étel / Mexikó / nyelv), futam hossza
(10 / 20 / végtelen), magyarázat nyelve (forrásnyelv / tanult nyelv).

**Acceptance:** minden item forrásolt; az `audit-games.mjs` a claim minden szavát
ellenőrzi a szint szókincse ellen; a verdikt-gombok egy kézzel elérhetők
(hüvelykujj-zóna, alsó harmad).

**Kérdések:** nincs nyitott kérdés.

---

## 5. Építési sorrend (javaslat)

| Fázis | Tartalom | Miért itt |
|---|---|---|
| **F-1** | Szó-metaadat: `pos` + `gender` mező minden kártyára (K6) | 4 játék épül rá, és a hibás nyelvtani nem tanítás-szinten káros |
| **F0** | Keret: registry, vocabPool, GlossText, GameShell, DB-táblák, hub, i18n, tesztek | enélkül minden játék egyedi hegesztés |
| **F1** | `memory-pairs` + `word-search` | a legkevesebb kockázat, a keret próbája, azonnal játszható |
| **F2** | `word-rain` + `bubble-pop` | arcade, animáció bejáratása |
| **F3** | `grammar-choice` + `confusables` | tartalom-vezérelt, itt derül ki az authoring-folyamat |
| **F4** | `myth` + `story` + `chat` | a legnagyobb tartalom-igény; a `myth` megy elsőnek, mert a legolcsóbb és ez a „ne legyen tanulás-szaga" válasz |
| **F5** | `odd-one-out` + `conjugation-slot` + `ccat` | metaadat-függő, F3 után olcsó |
| **F6** | `sentence-tetris` | a legdrágább, a végére |

Minden fázis végén: `npx jest` zöld, `npx tsc --noEmit` nem romlik,
`node scripts/audit-games.mjs` 0 P1, commit fázisonként, ennek a fájlnak a
státusz-táblája ugyanabban a commitban frissül.

---

## 6. Ami NEM változhat (regressziós határ)

- a meglévő tanuló-fül (`index.tsx`) viselkedése, queue-ja, kadenciája
- az FSRS-ütemezés, a `cards` tábla jelentése (a játék csak `nudgeWrong`-gal nyúlhat hozzá)
- a `spelling_list` szemantikája
- a Backup/Restore, tehát az új táblák MENNEK a payloadba
- a `database.web.ts` párhuzamos implementációja (web nem perzisztál, ez ismert és OK)

---

## 7. Nyitott kérdések (K-lista)

Ezeket a `/kimacha-extra-games` skill kérdezi végig, blokkonként.
A megválaszolt kérdés ide, a kérdés alá kerül **DÖNTÉS** címkével, dátummal.

### Keret
- **K1.** Fül-sorrend és fül-szám: belefér a 6. fül, vagy valamit összevonjunk?
  **DÖNTÉS (2026-08-26):** 6. fülként, közvetlenül a Learn után. Végleges sorrend:
  `index (Learn) → games → active → tree → stats → settings`. Semmi nem olvad össze.
- **K2.** Időzített játékban a gloss-buborék megállítsa az órát, vagy fusson tovább?
  **DÖNTÉS (2026-08-26):** megállítja az órát, amíg a buborék nyitva van. A tanulás nem
  büntetendő. A `GameShell` óra-hookja `pause()` / `resume()` párost kap, a gloss-buborék
  nyitása/zárása hívja.
- **K3.** A játékbeli hiba hasson vissza az SRS-re (`nudgeWrong`), vagy a játék maradjon teljesen külön?
  **DÖNTÉS (2026-08-26):** a játék teljesen külön marad, **`srsBridge.ts` NEM épül meg**.
  A `cards` táblához a játékok nem nyúlnak, csak olvassák. A `card_attempts` naplózás
  megmarad (`type='game:<id>'`), mert az csak statisztika, az ütemezést nem érinti.
  A 3.4 szekció ezzel tárgytalan.
- **K3b.** Melyik legyen a pool alapértelmezett szigorúsága: `seen`, `practiced` vagy `mastered`?
  **DÖNTÉS (2026-08-26):** `practiced` (phase >= 1, legalább egyszer sikeres felidézés),
  fixen, játékonkénti csúszka nélkül. A `PoolStrictness` típus megmarad a kódban a későbbi
  bővítésre, de a UI nem teszi állíthatóvá.

### word-rain
- **K4.** A-variáns (koppintós, egy prompt) vagy C-variáns (kosaras, ügyességi)?
  **DÖNTÉS (2026-08-26):** **A-variáns**, egyetlen mechanika. A kosaras (C) elvetve,
  nem épül meg, mert a mozgás-ügyesség nem a szótudást méri.
- **K5.** Legyen-e „napi 60 másodperces sprint" streak-kel, vagy csak szabad játék?
  **DÖNTÉS (2026-08-26):** **nincs napi sprint és nincs külön streak.** A szó-eső szabad
  játék marad, csak rekord-pontszámmal. Indok: a tanulási 🔥 streak már ad napi
  kötelezettség-érzetet, egy második számláló ugyanezt duplázná.

### bubble-pop / odd-one-out
- **K6.** Kategória-metaadat: olcsó heurisztika (a) vagy rendes adatbővítés `pos` + `gender` mezőkkel (b)?
  **DÖNTÉS (2026-08-26):** **(b) rendes adatbővítés.** Új opcionális mezők a
  `WordEntry`-ben: `pos` (`noun` / `verb` / `adj` / `adv` / `pron` / `prep` / `num` /
  `phrase`) és `gender` (`m` / `f` / `mf` / `-`, csak főnévnél). Feltöltés scripttel
  (`scripts/annotate-pos.mjs`), mintavételes kézi ellenőrzéssel, és őrző teszttel
  (minden főnévnek van gendere, minden kártyának van pos-a). Ez a Game fül F0-ja
  ELŐTT fut (új F-1 fázis), mert 4 játék épül rá. A heurisztika csak a script
  BELSEJÉBEN él (kiindulásnak), a JSON-ba kész, ellenőrzött érték kerül.

  > **MEGVALÓSÍTÁSI JEGYZET (F-1, 2026-08-26):** `scripts/annotate-pos.mjs`
  > kizárólag az `es` mezőből következtet (minden ág, `en`/`hu` is, mert a
  > `data/words.ts` szerint a szótöveket mind az `es` mező hordozza, és a
  > `gender` fogalma spanyol-nyelvtani kérdés). 11 fájlt érint: a megosztott
  > `a0..c1` + `en/a0..a2` + `hu/a0..a1`; `c2.json` szándékosan kihagyva (fagyott).
  > Prioritásos szabálylánc: mondat-központozás → phrase; zárójeles ragozás-
  > jegyzet → a zárójel ELŐTTI alapszó rekurzív újraosztályozása (NEM
  > automatikusan `verb`, mert a zárójel néha melléknév/névmás/határozó
  > egyértelműsítő jegyzet, pl. `allí (dirección)` = határozó); `/`-jelölt
  > pár → melléknévi nem-pár, hacsak valamelyik fél ragozott igealaknak
  > NÉZ KI (ékezetes véghangzó); többszavas kifejezés élén névelő/alanyi
  > névmás → noun/verb, egyébként `phrase`; egyszavas token sorban:
  > számnév-lista, névmás-lista, elöljárószó-lista, kézi kivétel-térkép,
  > `-mente` határozó-végződés, határozó-lista, `-ar/-er/-ir` (és `-ír`,
  > `-arse/-erse/-irse`) igevégződés, hónap/nap-lista, **ékezetes véghangzó**
  > (á/é/í/ó/ú → szinte mindig ragozott igealak spanyolul), végül az angol
  > gloss `"I "` kezdete (subjekt-elhagyós ragozott igealak jele, pl.
  > `limpio` = „I clean the flat"). Ha semmi nem talál, az alapértelmezés
  > `adj`, mert névelő NÉLKÜLI egyszavas fejszó ebben a korpuszban túlnyomó
  > többségben melléknév (a főnevek szinte mind névelővel szerepelnek, lásd
  > a script kommentje). A `gender` mező kizárólag a névelőből (`el/la/los/
  > las/un/una/unos/unas`) származik, ez a leggegyűjthetőbb jel, és emiatt
  > a néhány „el + hangsúlyos a-val kezdődő nőnemű szó" kivétel (el agua, el
  > aula, el arma…) `m`-et kap, nem `f`-et (a kártyán ténylegesen használt
  > névelőt tükrözi, nem az elvont nyelvtani nemet, ismert, dokumentált
  > pontatlanság, ha egy játék valaha melléknév-egyeztetést épít erre, ott
  > kell egy külön kivétel-lista). Kézi mintaellenőrzés: 400+ kártya (jóval a
  > kért 40 fölött), teljes átnézés a `pron`/`prep`/`num`/`adv` vödrökön
  > (mind kicsi, végigjárható) és az összes zárójeles bejegyzésen, plusz több
  > kör véletlen minta a `noun`/`verb`/`adj`/`phrase` vödrökből. A talált
  > hibaosztályok (pl. `hola`/`gracias` köszönés-szavak, `trabajó`-jellegű
  > ragozott múlt idő, `bajo`/`solo` kettős jelentés) mind a script kivétel-
  > listáiba kerültek, EGYETLEN JSON-bejegyzést sem javítottam kézzel.
  > Végeredmény (11 fájl összesen): `noun` 4070, `verb` 1066, `adj` 876,
  > `phrase` 831, `adv` 193, `pron` 78, `num` 83, `prep` 17; `gender`
  > (csak noun): `m` 2247, `f` 1823. Őrző teszt: `lib/__tests__/wordPos.test.ts`.

- **K7.** Legyen-e időlimit a köröknél, vagy nyugodt tempó?
  **DÖNTÉS (2026-08-26):** nincs kemény időlimit. Lágy nyomás: a buborékok lassan
  emelkednek és a tetején kipukkannak; egy így elvesztett jó buborék kihagyott találat,
  nem élet-vesztés. Időlimit a beállításokban felkapcsolható.

### memory-pairs
- **K8.** Alapértelmezett rácsméret, és legyen-e „szó ↔ hang" párosítás (TTS-alapú)?
  **DÖNTÉS (2026-08-26):** alap párosítás **szó ↔ jelentés**, és párosításkor a tanult
  nyelvű oldal elhangzik (TTS, `speechLang(learnedLang)`, az FB144 hang-ellenőrzésen át,
  tehát hiányzó hangnál néma). Alap rácsméret **4×4 (8 pár)**, a többi méret a
  beállításokban. A hang-párosítás és a mondat-hézag párosítás most nem épül meg.

### word-search
- **K9.** Az oldalsó lista a forrásnyelven legyen (nehezebb, tanít) vagy a tanult nyelven (könnyebb, csak keresés)?
  **DÖNTÉS (2026-08-26):** **forrásnyelven** (látod `kutya`, keresed `perro`), fixen,
  kapcsoló nélkül. Így a rejtvény tanít, nem csak betűt keres.

### story
- **K10.** A saját sztoriírás módja: repo-fájl (a), app-beli szerkesztő (b), vagy JSON-import (c)?
  **DÖNTÉS (2026-08-26):** **(a) repo-fájl.** User: „nem fogja sok helyet foglalni, ha
  jsonba az app mellé rakjuk, és amúgy is hetente van új buld szal nem lenne gond ha
  repoba lenne." A sztorik `data/games/stories/<lang>/<id>.json`-ban élnek, a build
  beleforgatja, és a `scripts/audit-games.mjs` őrzi a szókincs-szabályt. Az app-beli
  szerkesztő és a JSON-import egyelőre NEM épül meg; ha valaha telefonon akarsz írni,
  az import ugyanezt a formátumot fogja olvasni, tehát a tartalom nem vész el.
- **K11.** Mennyi sztori kell az induláshoz, és milyen témák érdekelnek? (hétköznapi CDMX-helyzetek, humor, krimi, sci-fi, önéletrajzi?)
  **DÖNTÉS (2026-08-26):** három sáv, **CDMX-hétköznapok**, **krimi / rejtély**,
  **sci-fi / kaland**. Humor és önéletrajzi kimarad. Induló adag: sávonként 2 sztori,
  A1 szinten, 6-8 jelenet egyenként. A krimi és a sci-fi folytatásos (jelenet végén nyitva
  hagyott szál), a CDMX-sáv önálló epizódokból áll.
- **K12.** Legyen-e jelenet-végi megértés-kérdés, vagy tiszta olvasás megszakítás nélkül?
  **DÖNTÉS (2026-08-26):** **igen, jelenetenként egy könnyű kérdés**, 2-3 válasszal, ami
  nem büntet. Rossz válasznál a jelenet újraolvasható, nincs pont-levonás, nincs élet.

### chat
- **K13.** Melyik 5 helyzet legyen elsőre? (taxi, pincér, piac, lakáskeresés, orvos, munka-bemutatkozás, bank, szomszéd)
  **DÖNTÉS (2026-08-26), és egyben IRÁNYVÁLTÁS.** A user szava:
  „az a baj, hogy ezeket a nyelvvizsgás cuccokat már nagyon utálom, valami kreativ új
  kellene, vegül is itt az a lényeg, hogy ne legyan tanulás szaga. Lehet, valami
  ismertető érdekesség vagy olyan dolgok amit álltalában az emberek rosszul tudnak ezek
  nagyon jókat mennek tiktokon, lehetne ilyen trenddi sztori belőle"
  Ebből két következmény:
  1. A klasszikus nyelvvizsga-helyzetek (pincér, taxi, orvos, bank, munka-bemutatkozás)
     **kikerülnek** a chat induló készletéből. Egyedül a **lakáskeresés (CDMX)** marad,
     mert az valódi, közelgő élethelyzet.
  2. Új játék születik a „ne legyen tanulás-szaga" igényre: **`myth`, Igaz vagy kamu**
     (4.13 szekció). Ez lesz a tartalom-gerinc, és a sztori-mód is táplálkozhat belőle.
  A chat maradék helyzeteinek listája **K24**-ben dől el.
- **K14.** Legyen-e „rossz válasz" következménnyel, vagy minden ág legyen barátságos?
  **DÖNTÉS (2026-08-26):** legyen következmény, de sose büntetés. A rossz választás más
  kimenetel felé visz (drágábban veszed meg az autót, nem kapod meg a lakást, a csaló
  majdnem átver), és a végén látszik, hol csúszott el. Élet, pont-levonás és „hibás"
  jelölés nincs.
- **K28.** A checklist a beszélgetés VÉGÉN jelenjen meg egyben, vagy menet közben töltődjön (látod, ahogy gyűlik)?
  **DÖNTÉS (2026-08-26):** **menet közben töltődik.** Fent egy `4 / 8` sáv, minden jó
  kérdésnél bepipálódik egy pont (rövid animációval). A beszélgetés végén ott a teljes
  lista, a kihagyott pontok kiemelve, forrásokkal.

### chat (folytatás)
- **K24.** A lakáskeresés mellé milyen chat-helyzetek jöjjenek, ha a nyelvvizsga-klasszikusok kiestek?
  **DÖNTÉS (2026-08-26), a chat teljes újratervezése.** A user szava:
  „inkább olyan, hogy uhh ez egy nagyon nagy ötlet. pl kocsit akarok venni és miket
  kérdezzek meg. LEhet egy ilyen példa is. Meg akkor lehetne interaktiv is, mármint más
  kimenetele legyen ha mást mondasz. mondjuk ha kevés pénzed van vagy ha sok, és lehetne
  ilyen real kérdések amiket ajánlanak, hogy kérdezz meg. Vagy mondjuk legyen ilyen
  karier tanácsadás beszélgetés, meg mondjuk egészségesebben akarok élni mit egyek és
  lehetene ilyen real internetről össze szedett javaslatok mert biztos vagyok benne hogy
  mindenki egyetért 6-8 dologban amit meg kell kérdezni egy vásárlásnál, vagy hogy mit
  egyek ami biztosan jó lehet ilyen álltalános tanácsokat adni és akkor itt lehetne több
  téma is"
  Ebből a chat NEM szerepjáték lesz, hanem **tanácsadó beszélgetés valódi tudással**,
  lásd az újraírt 4.6 szekciót. Induló készlet: átverés-elhárítás (a user választása),
  autóvásárlás, lakásbérlés, egészséges étkezés, karrier-tanácsadás.
- **K27.** A chat maradjon-e egyáltalán, vagy a `myth` és a sztori vegye át a helyét?
  **DÖNTÉS (2026-08-26):** **marad, de átalakul.** A mechanika (döntés, elágazás) jó volt,
  a tartalom volt tankönyv-szagú. Lásd K24.

### myth
- **K25.** A magyarázat a forrásnyelven legyen (a poén az információ) vagy a tanult nyelven (több nyelvi expozíció)?
  **DÖNTÉS (2026-08-26):** **forrásnyelven** (magyarul). Az állítás marad a tanult
  nyelven, ott van a nyelvi munka; a magyarázat magyarul, mert a poén maga az információ.
- **K26.** Melyik tény-sávok érdekelnek, és legyen-e köztük olyan, ami kifejezetten Mexikóra készít fel?
  **DÖNTÉS (2026-08-26):** **mind a négy sáv** kell: közhiedelem, test-étel-egészség,
  Mexikó és CDMX, valamint maga a spanyol nyelv. Induló adag sávonként 15 item.

### conjugation-slot
- **K15.** Csak spanyolra épüljön meg most, a többi nyelven „hamarosan" kártya?
  **DÖNTÉS (2026-08-26):** **igen, csak spanyol.** Teljes spanyol ragozás-motor
  (szabályos -ar/-er/-ir + a 15 fő rendhagyó: ser, estar, ir, tener, hacer, poder, decir,
  ver, dar, saber, querer, venir, poner, salir, haber), a többi nyelven a hub-kártya
  „hamarosan" állapotú, nem zárolt-de-hibás. Konzisztens a `grammar-choice` döntésével.

### sentence-tetris
- **K16.** Megéri egyáltalán a költségét, vagy inkább maradjon ötletnek?
  **DÖNTÉS (2026-08-26):** **marad a legvégén, döntés később.** A spec bent marad, de az
  F6 fázis nem indul el, amíg a többi játék készen nincs. Akkor újra elő kell venni ezt
  a kérdést.

### ccat
- **K17.** Térbeli itemek: `View`+`transform` házilag, vagy `react-native-svg` telepítése (új natív dep, új APK-build)?
  **DÖNTÉS (2026-08-26):** **a térbeli (alakzatos) itemek teljesen kimaradnak**, tehát a
  rajzolás kérdése tárgytalan, és nem kell `react-native-svg`. A CCAT-mód csak nyelvi és
  logikai itemeket tartalmaz: analógia, ellentét, szinonima, kakukktojás,
  mondat-kiegészítés, betűkeverék, számsor, szöveges feladat, utasítás-követés.
  Így a játék 100 százalékban a szókincsre és a logikára épül, ami a Game fül
  alap-szabályával is egybevág.
- **K18.** A CCAT-mód szövege a tanult nyelven legyen (nyelvtanulás + teszt), a forrásnyelven (tiszta teszt-prep), vagy kapcsolható?
  **DÖNTÉS (2026-08-26):** **kapcsolható, alapértelmezés a tanult nyelv.** A beállításban
  átváltható angolra (a valódi CCAT nyelve) és a forrásnyelvre. A térbeli és a számsoros
  itemek nyelvfüggetlenek, azok minden módban ugyanazok.
- **K19.** Legyen-e „éles szimuláció" mód (50 kérdés / 15 perc, mint az igazi), vagy csak a rövid gyakorló?
  **DÖNTÉS (2026-08-26):** **nem kell éles szimuláció.** Csak a rövid gyakorló mód épül
  meg (10-25 kérdés), az 50 kérdés / 15 perc változat kimarad.

### grammar-choice
- **K20.** Melyik 5 nyelvtani témával induljunk? (ser/estar, por/para, névelők, múlt idők, subjuntivo, gustar, hay/está)
  **DÖNTÉS (2026-08-26):** mind a négy felkínált téma kell (ser/estar, por/para,
  múlt idők, névelők és nem), DE a user ennél többet kért:
  „pontosan ilyenek és majd lehessen bőviteni más nyelvekre is de most 1. spanyollal
  foglalkozz meg még ami fontos szóval az összes nyelvtani rész. csinálj meg mindent,
  úgy hogy majd tovább lehessen tokenégetéssel fejleszteni"
  Tehát: **a teljes spanyol nyelvtani lefedettség a cél** (A1-től C1-ig, lásd a 4.11
  szekció témalistáját), a négy fenti téma az ELSŐ batch. Az adatformátum és a motor
  nyelvfüggetlen, hogy az angol és a német ág később ugyanabba a keretbe kerüljön,
  de most csak spanyol tartalom készül.
- **K21.** A magyarázat rövid egysoros legyen, vagy hosszabb, példákkal és kivételekkel?
  **DÖNTÉS (2026-08-26):** **szabály + 2 példa + miért rossz a többi opció.** Nem
  egysoros, de nem is nyelvtankönyv-oldal. A kivételek és a határesetek egy külön,
  összecsukott „Több" blokkba mennek, hogy csak az kérje, aki akarja.

### confusables
- **K22.** A fenti 20 spanyol csoport jó kiindulásnak, vagy van olyan, ami téged konkrétan zavar?
  **DÖNTÉS (2026-08-26):** három csoport-osztály az induló készlet:
  **(1) alaki csapdák** (sueldo/suelo/suelto, pero/perro, caro/carro),
  **(2) kétféle „ugyanaz"** (saber/conocer, pedir/preguntar, llevar/traer, ir/venir),
  **(3) mexikói csapdák** (coger, ahorita, a chingar-kör, mande, güey).
  A csak-ékezetes csoport (tu/tú, el/él, si/sí, mas/más) NEM került be az induló
  készletbe, mert a user nem választotta; a formátum elbírja, ha később kell.
- **K23.** Kell-e a hallás utáni megkülönböztetés (TTS kimondja, te választod), vagy elég az írott?
  **DÖNTÉS (2026-08-26):** **kell, külön dril-típusként.** A telefon kimondja az egyik
  tagot, te választasz. Kötelező azoknál a csoportoknál, ahol írásban látszik a különbség,
  hallásban nem (casa/caza, cocer/coser, ves/vez, echo/hecho); a többinél opcionális.
  A TTS az FB144 hang-ellenőrzésén megy át, tehát hiányzó hangnál a dril-típus kimarad.

---

## 8. Státusz-tábla (a kódoló agent ezt frissíti)

| Fázis | Item | Státusz | Commit |
|---|---|---|---|
| F-1 | szó-metaadat `pos` + `gender` (annotate script + őrző teszt) | ✅ KÉSZ | `cafc0b7` |
| F0 | keret (registry, pool, gloss, shell, DB, hub) | ✅ KÉSZ | `07fe4e0` |
| F1 | `memory-pairs` | ✅ KÉSZ | `b5f8c16` |
| F1 | `word-search` | ✅ KÉSZ | `62c9801` |
| F2 | `word-rain` | ✅ KÉSZ | `4c5bac6` |
| F2 | `bubble-pop` | ✅ KÉSZ | `aab85f5` |
| F3 | `grammar-choice` | ✅ KÉSZ (motor + 3 téma: ser-estar, articulos-genero, por-para; a többi 56 = Q1-Q5, token-burn) | `7b613b2` (motor) / `cbe7a59` (tartalom) |
| F3 | `confusables` | ✅ KÉSZ (24 csoport: 8 alaki + 9 kétféle „ugyanaz" + 7 mexikói) | `63bdfaf` |
| F4 | `myth` | ✅ KÉSZ (4 sáv × 15 item = 60, mind forrásolt label-lel, url nélkül ahol nem lekért) | `7380f2a` |
| F4 | `story` | 🟨 SPEC-KÉSZ | |
| F4 | `chat` | 🟨 SPEC-KÉSZ | |
| F5 | `odd-one-out` | 🟨 SPEC-KÉSZ | |
| F5 | `conjugation-slot` | 🟨 SPEC-KÉSZ (csak ES) | |
| F5 | `ccat` | 🟨 SPEC-KÉSZ (térbeli nélkül) | |
| F6 | `sentence-tetris` | ⏸ ELHALASZTVA (K16) | |

Jelölés: ⬜ TERV → 🟨 SPEC-KÉSZ (kérdések megválaszolva) → 🟦 KÓDOLÁS → 🟧 TESZT → ✅ KÉSZ.

---

## 9. Munkamenet-szabály

1. **Kérdés-kör.** A `/kimacha-extra-games` skill végigkérdezi a K-listát
   blokkonként, maximum 4 kérdés egyszerre. A válaszok ide íródnak vissza
   **DÖNTÉS (dátum)** formában, a kérdés alá.
2. **Spec-zárás.** Ha egy fázis minden K-ja megvan, az itemjei 🟨 SPEC-KÉSZ-re
   váltanak, és onnantól kódolhatók.
3. **Kódolás.** Opus tervez és a gráfból kutat, Sonnet sub-agentek írják a kódot,
   fájlonként sebészi diffel (házi szabály, `CLAUDE.md`).
4. **Kapu.** `npx jest` zöld + `npx tsc --noEmit` nem romlik +
   `node scripts/audit-games.mjs` 0 P1. Enélkül nincs „kész".
5. **Commit** itemenként, a 8. szekció táblájának frissítésével ugyanabban a commitban.

---

## 10. Token-burn queue (a fázisok UTÁN, külön menetekben)

Ide kerül minden olyan tartalom, ami nem kell a „kész" státuszhoz, de a fül értékét
sokszorozza. Ezek a `feedback_build_manifest_convention` szerinti égetős itemek:
a menet elején nem kell tervezni, csak sorban haladni.

| # | Item | Mennyiség | Előfeltétel |
|---|---|---|---|
| Q1 | `grammar-choice` A1-es témák | 15 téma × 10-15 item × 4 nyelvű magyarázat | F3 kész |
| Q2 | `grammar-choice` A2-es témák (élén `indefinido-imperfecto`) | 18 téma | Q1 |
| Q3 | `grammar-choice` B1-es témák | 11 téma | Q2 |
| Q4 | `grammar-choice` B2-es témák | 9 téma | Q3 |
| Q5 | `grammar-choice` C1-es témák | 5 téma | Q4 |
| Q6 | `myth` tény-bővítés | sávonként +15 item, forrásolva | F4 kész |
| Q7 | `story` további sztorik | sávonként +2 | F4 kész |
| Q8 | `chat` további tanácsadó-témák | +5 téma, forrásolt checklisttel | F4 kész |
| Q9 | `confusables` további csoportok (köztük az ékezetes osztály) | +15 csoport | F3 kész |
| Q10 | `grammar-choice` angol és német ág | a spanyol formátum újrahasználásával | Q1 |

**Minden égetős itemre ugyanaz a kapu érvényes:** `npx tsc --noEmit` nem romlik,
`npx jest` zöld, `node scripts/audit-games.mjs` 0 P1, és a tény-alapú tartalom
(myth, chat-checklist) forrás nélkül nem szállítható.
