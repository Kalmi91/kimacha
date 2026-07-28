# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v56.0.0/ before writing any code.

---

# 🇬🇧 English-target track (hu→en course), IN PROGRESS (A1 batch 1 KÉSZ)

A `kimacha` egy spanyol-központú app: a szókártyák egyetlen megosztott készlet
(`data/words/a0.json`…`c2.json`), `es/hu/en/de` mezőkkel, és az A1 topic-fa
**spanyol nyelvtanra** épül (`presente_ar`, `ser_vs_estar`, `genero_numero`…).
A `direction = [native, learned]` (cél = `direction[1]`), és minden tanult nyelv
saját SRS-haladást kap (`pair = "<source>-<target>"`, pl. `hu-en`).

Az **ang-magyar ág** = a **hu→en kurzus** (magyar tanul angolt). Mivel a spanyol
A1 nyelvtani topicjai értelmetlenek angolon, az angolnak **saját A1 tartalom-track**
van (a placement-examok `data/exams/en/` precedensét követve):

- `data/words/en/a1.json`, angol A1 szókártyák (id-k **5001-től**, hogy ne ütközzenek
  a megosztott készlettel; max megosztott id = 3007). Mind 4 nyelv + 4 mondat kötelező.
- `data/topics/en/a1.json`, angol A1 topic-fa (angol nyelvtan: `to_be`,
  `present_simple`, `articles`, `plurals` + voci: `numbers`, `colors`, `family`,
  `food_drink`…). Ugyanaz a `TopicDef` séma (icon, subLevel, type, name_*).
- `data/sublevels/en/a1.json`, angol A1 al-szintek.

**Direction-aware wiring (default `lang='es'` → a spanyol viselkedés bájtra változatlan;
csak `lang==='en'` + létező angol tartalom tér el):**
- `data/words.ts`: `getWordsForLevel(level, lang)`, `getWordsForTopic(level, topicId, lang)`.
- `data/topics.ts`: `getTopicsForLevel/hasTopics/getSubLevelsForLevel/getTopicsForSubLevel/getSubLevelForTopic` mind kap `lang` paramot.
- `lib/database.ts` + `database.web.ts`: a 3 szint-szintű metódus (`getDueCardsForLevel`,
  `getMasteredWordCount`, `getReviewedWordCount`) a célnyelvet `this.activePair.split('-')[1]`-ből veszi.
- `app/(tabs)/index.tsx`, `tree.tsx`, `settings.tsx`, `components/DoneScreen.tsx`: minden
  accessor-hívás `direction[1]`-et (ill. `onboarding.target`) ad át.
- `components/ExamMode.tsx`: a gazdag `examBuilder` exam (es↔en-be drótozva) **csak `direction[1]==='es'`**-nél fut;
  más célnyelv a per-nyelv gap-kérdés path-ot kapja (`getExamQuestionsFor(target, level)` → `data/exams/en/*`).

**KÉSZ (batch 1):** A1.1 (to_be, numbers, articles, colors) + A1.2 (present_simple,
family, plurals, food_drink) = **8 topic, 62 szó**. tsc 0, jest 43/43, spanyol audit P1=0
(érintetlen), megosztott a1.json = 882 (érintetlen).

**Hátra (jövő batch-ek):** több A1 topic+szó (this/that, possessives, there_is/are,
have_got, can, question_words, prepositions, body, house, clothes, jobs, animals,
days/months, weather, daily_routine…); `scripts/audit-corpus.mjs` **angol-aware** kiterjesztése
(most csak a spanyol a0/a1-et őrzi); angol A0/A2+ track ha kell; `examBuilder` en↔hu drótozása
(most az angol exam a gap-kérdésekre esik vissza); telefon-verify hu→en kurzuson.

---

# 🎯 Szókincs-cél MINDEN nyelvre: XLex-sávok, plafon C1 (Kálmán döntése, 2026-07-28)

A kurzus célja szintenként az alábbi **kumulált** (A0-tól összeadott) szókészlet,
nyelvtől függetlenül. A számok a Meara & Milton XLex-sávjai (receptív lemmák,
Cambridge-vizsgákhoz kötve, lásd EuroSLA-monográfia); a korábbi „szóbővítés
plafon B2" szabályt ez FELÜLÍRJA: a plafon **C1**, C2-t nem építünk.

| Szint | Kumulált cél | Sáv (XLex) |
| ----- | ------------ | ---------- |
| A1 | ~1 200 | < 1 500 |
| A2 | ~2 000 | 1 500–2 500 |
| B1 | ~3 000 | 2 750–3 250 |
| B2 | ~3 500 | 3 250–3 750 |
| C1 | ~4 000 | 3 750–4 500 |
| C2 |, | nem építjük |

**Escape-klauzula (Kálmán szava):** ha egy nyelven a sáv nem reális (nincs annyi
hasznos szó, a frekvencia-farok már használhatatlanul ritka vagy szakszó lenne),
akkor NEM kell feltölteni a sávig. Ilyenkor állj meg a sáv alatt, és írd ide le
egy sorban, melyik szinten és miért.

**Állapot (2026-07-28):**
- Megosztott (spanyol-központú) készlet: A0 100, A1 882, A2 900, B1 927, B2 494,
  C1 83 → kumulált C1 = **3 386**, a ~4 000-es célig ≈ **610 szó** hiányzik
  (a szintek nagyjából sávon belül vannak, a hiány zöme B2/C1).
- **Forrás-megjegyzés a bővítéshez:** a SUBTLEX-ESP frekvencia-farok B2 fölött
  kimerült (a maradék jelöltek tulajdonnevek, vulgarizmusok, ragozott alakok),
  ezért B2/C1-en a bővítés DELE-sávos szemantikai doménekből megy, a D6-szabály
  szerint. Részletek: `BUILD.md` Q2.
- Angol ág (`data/words/en/`): A0 100, A1 384, A2 390 → kumulált **874**, csak
  A2-ig épül; a B1–C1 sávok még nincsenek megnyitva.
- A szint = KURRIKULUM-POZÍCIÓ, nem a szó objektív tulajdonsága (a jelentések, nem
  a szavak kapnak szintet, és a határok ±1 sáv pontossággal fuzzy-k). A besorolás
  keveréke: frekvencia-rang (SUBTLEX-ESP) + témakör-szükséglet + alaki nehézség.

---

# ✅ P0 BUG — Soft billentyűzet villog (Android IME relayout-hurok) — KÉSZ, eszköz-verify OK

> ✅ Fix commit `2854d77`: KAV `behavior=undefined` Androidon (iOS marad `padding`)
> + `app.json` `android.softwareKeyboardLayoutMode: "pan"`. `tsc` tiszta.
> ✅ User telefonon ellenőrizte 2026-06-11: stabil, nincs villogás.

## Tünet
Gépeléskor a képernyő-billentyűzet (Gboard) **felugrik, majd eltűnik / újraméretez,
ciklikusan villog**. Kimacha appban **folyamatos** (typing kártyán), más appban
(pl. Messenger) néha. A Kimacha-rész kód-bug; az alkalmankénti más-app villanás
RAM-nyomás (külön, eszköz-szintű ügy, NEM itt javítandó).

## Eszköz-bizonyíték (élő logcat — Nokia X30 / Android 14 / Gboard 17.3.12, es-ES)
- `BaseKeyboardSizeHelper.calculateMaxKeyboardBodyHeight()` **ugyanazt a magasságot
  (1812) számolja újra tucatszor ~3 mp alatt**, miközben `com.kimachaapp.kimacha/
  .MainActivity` az előtér (`imeInputTarget` = Kimacha ablak). = klasszikus
  app↔IME inset-visszacsatolási hurok.
- **Két `com.google.android.inputmethod.latin` process** futott egyszerre (az IME
  újraindul a hurok alatt) → ettől „tűnik el, majd jön vissza".

## Gyökérok (kódban azonosítva)
`app/(tabs)/index.tsx:603-605` — a typing nézet `KeyboardAvoidingView`-ja:
```tsx
<KeyboardAvoidingView
  style={[styles.container, { backgroundColor: colors.background }]}
  behavior={Platform.OS === 'ios' ? 'padding' : 'height'}   // ← Androidon 'height'
>
```
Androidon a `behavior='height'` **maga méretezi a nézetet**, MIKÖZBEN az Expo
default `android.softwareKeyboardLayoutMode: "resize"` (adjustResize) az ablakot is
átméretezi, ÉS az Expo 56 **edge-to-edge** (alapból ON) inset-jei is beleszólnak.
Három fél méretezi ugyanazt → végtelen relayout → Gboard-villogás.
(`app.json`-ban nincs `softwareKeyboardLayoutMode` → érvényben a default `resize`.)

## Javítás (sorrendben próbáld, dev buildben ellenőrizve)
1. **KAV behavior Androidon ne `height` legyen.** Próbáld:
   `behavior={Platform.OS === 'ios' ? 'padding' : undefined}` (az adjustResize kezeli).
   Ha így a beviteli mező takarásban marad, lépj a 2. pontra.
2. **`app.json` → `android.softwareKeyboardLayoutMode: "pan"`** (az ablak nem méretez,
   a KAV/scroll tolja fel a mezőt). Pan + KAV `undefined` a legstabilabb edge-to-edge
   mellett.
3. Ha 1–2 nem elég: térj át **`react-native-keyboard-controller`** `KeyboardAvoidingView`-
   jára (edge-to-edge-barát), vagy tedd a typing inputot `ScrollView`-ba
   `keyboardShouldPersistTaps="handled"`-dal.
4. Ellenőrizd a generált `AndroidManifest.xml` `android:windowSoftInputMode` értékét
   (`npx expo prebuild` után), egyezzen a választott móddal.

## Elfogadási kritérium
- Billentyűzet **egyszer** nyílik, **stabil marad**, nincs villogás a typing kártyán.
- `adb logcat | grep calculateMaxKeyboardBodyHeight` **nem ontja** sorozatban ugyanazt
  a magasságot a mezőre kattintáskor (max pár sor, nem tucat/mp).
- **Egyetlen** `inputmethod.latin` process (`adb shell ps -A | grep latin`).
- `npx tsc --noEmit` hibátlan; iOS viselkedés nem romlik (iOS marad `padding`).
- Web nem érintett (KAV weben no-op).

## Repró
1. Dev build telefonon → Kimacha → typing kártya (reps>0 szó vagy nehéz mondat).
2. Koppints a beviteli mezőbe → jelenlegi kódon villog.
3. Fix után: stabil, egyszer nyíló billentyűzet.

---

# 📋 Feedback-alapú teendők (Kimacha Feedback sheet, user visszajelzések)

Forrás: `Kimacha Feedback` Google Sheet (a `FeedbackModal.tsx` küldi). Tesztsorok
és junk kiszűrve. Idézetek a user eredeti megfogalmazásában.

## ✅ FB1 [P1] — Easy-mondat (tap-to-order) distractorok hihetőbbek legyenek — KÉSZ (`e91c410`)
**Legtöbbször kért (4 visszajelzés).** A rossz szó-opciók most túl random / triviálisan
kizárhatók. Legyenek **near-miss distractorok**, hogy a tanuló a formákat/végződéseket
gyakorolja, ne véletlenszerű zajt:
- ugyanazon ige **más ragozásai** (pl. `llega` mellé `llego`, `llegas`, `llegan`),
- **névelő-variánsok** (`el`/`la`/`los`/`las`),
- **más személy/szám** alakjai (yo/tú/él/ellos), hogy „mire végződnek a szavak" érződjön.

Idézetek:
- „itt nagyon random szavak berakva olyanok amik biztos nem jó, tegyél be olyanokat amik majdnem azok"
- „itt lehetne los las lehetőség" (At eighteen I am an adult.)
- „itt a llega-nak lehetnének különböző alakjai" (The bus arrives at fifteen.)
- „a helytelen szavak között lenne olyan ami nem az hogy ők hanem hogy te … hogy gyakorolni lehessen hogy mire végződnek a szavak"

Fájl: `components/EasySentenceCard.tsx` (distractor-generálás). Acceptance: a distractorok
azonos szófaj/közeli alak, nem random; tsc tiszta.

## ✅ FB2 [P1] — Vizsga: helyes válasz pozíció-randomizálás — KÉSZ (`2e4b62a`)
A helyes opció **mindig az A** → pozíció-bias, kitalálható. Keverd az opciók sorrendjét
(seeded shuffle), a helyes index ne legyen mindig 0.
Idézet: „mindig az A opció helyes" (B2 hu→en, exam:3).
Fájl: `components/ExamMode.tsx` / `components/ExamCard.tsx`. Acceptance: a helyes válasz
egyenletesen oszlik a pozíciók közt.

## ✅ FB3 [P2] — Szókincs ne jelenjen meg a tanítása ELŐTT — KÉSZ a jelzett esetre (`e185be1`)
> A konkrét "choir" eset javítva (A1 "ellas cantan" → "Ellas cantan bien."). A teljes
> korpusz-szintű audit → **11. feladat** (lent, teljes spec).
„choir" szó egy mondatban szerepelt, mielőtt tanult szó lett volna. A mondat-tartalom
csak már bevezetett (vagy az aktuális) szókincsből építkezzen.
Idézet: „itt még nem volt az a szó hogy choir és úgy tette bele a mondatban" (A1, They sing in the choir.)
Fájl: mondat-curation `data/words/*` + sentence-építő logika.

## ✅ FB4 [P2] — Megkérdőjelezett fordítások QA-ja — KÉSZ (`e185be1`)
Konkrét, user által kétségbe vont mondatok — nézd át és javítsd a JSON-okban:
- A0 en→es `easy:"It's the same."` — „ez biztos így van?"
- A0 en→es `sentence:"Voy a ir mañana."` — „ez biztos jó így?" (redundáns „voy a ir"? → `voy mañana` / `iré mañana`)
- C2 hu→de `word:felszólítani / fenyegetni` — „a magyar nyelvtan nem helyes mindig" (HU forrásszöveg minőség)
Fájl: érintett `data/words/*.json` / `data/exams/*`.

## ✅ FB5 [P1] — Check gomb elérhetetlen nyitott billentyűzetnél — KÉSZ (`be7d969`)
Telefonon a képernyő-billentyűzet eltakarja a Check gombot a typing kártyán
(a `pan` mód csak a fókuszált inputot tartja láthatóan, az alatta lévő gombot nem).
Idézet: „amikor fenn van a képernyő klaviatúra telefonon, akkor nem tudok rá nyomni a Check gombra"
Fix: az input sor saját ✓/→ gombot kapott (mindig látható, a billentyűzet Enter is működik).
Fájl: `app/(tabs)/index.tsx`. ⏳ Eszköz-verify telefonon nyitva.

## ✅ FB6 [P1] — Szigorú gépelés-értékelés (1 betű is számít) — KÉSZ (`be7d969`)
A mondat-szintű Levenshtein ≤2 elfogadta a „she speak"-et a „She speaks."-re.
Idézet: „ha az a mondad hogy She speaks és én azt írom, hogy she speak akkor az hibás erre figyeljen és az összes ilyen mondatban ezen minta alapján ne fogadja el jónak ezt a hibát, mert igaz, hogy 1 betű a különbség de ez fontos betű"
Fix: `lib/answerMatch.ts` — szavanként pontos egyezés kell; csak kis/nagybetű,
írásjel és hiányzó ékezet megbocsátott. Typing kártya + practice + exam sent_type.

## ✅ FB7 [P1] — Distractor minőség v2 (easy kártya + vizsga) — KÉSZ (`11d203d`)
Három visszajelzés egy tőről:
- „miért van külön és egyben a yo hablo ez teljesen felesleges inkább legyen benne tu vagy hablas vagy valami ilyesmi eltérés"
- „mil cien ez is hülyeség, azt akarom, hogy dolgozd át a szavakat amik kamu szavak, hogy olyanok legyenek amivel össze lehetne keverni"
- „itt is lehetne más alternatíva szavak, mert ezek nagyon nem hasonlóak" (A0 exam:15)
Fix `lib/distractors.ts` + `lib/examBuilder.ts`:
- többszavas grammar-kártyák („yo hablo") szavakra bontva kerülnek a bankba → ragozási alakok lesznek a near-missek
- szigorúbb hasonlóság-szűrő (közös tő vagy 1–2 betű eltérés) — „mil" nem ajánlott „muy" mellé
- üres slotok a legközelebbi alakokkal töltődnek, soha nem random szóval
- vizsga sent_order tile-ok is a near-miss generátoron mennek át
- vizsga feedback tag mostantól kind+prompt (a puszta `exam:15` pozíció visszakereshetetlen volt) — `ExamMode.tsx`

## ✅ FB8 [info] — „Hay ocho personas aquí." ellenőrizve — HELYES, nincs teendő
Idézet: „there are eight peropel here? ez csak nekem furcsa, vagy ez egy teljesen normális mondat és csak én nem használom, ha ez okés akkor maradjon"
Adat (a1.json id 1008): „Hay ocho personas aquí." / „There are eight people here." —
mindkettő természetes, helyes mondat. Maradt.

## 📌 FB9 [backlog] — Skill-tree / elágazó témakör-fa ötlet — NEM implementált
Idézet: „van egy olAn taskod hogy vedd szét a leckéket, legyen olyan a szét vevés mint a wod of tanks russian tek tree igazából, most még nem tudom, hogy lehetne ezt szépen megoldani, de pl a számokat nem igazán akarom megtanulni, lehet hogy ez pl egy külön dolog lehetne. lehet azt kellene hogy a tek theen minden irányba el lehet menni és ilyen repülő témakörök lennének pl az biutos hogy a számokra ráépülhetne egy ilyen matekoa témakör, és akkor ott matekoa szavak ha valakit az érsekelne. mert pl engem nem, nekem pont az lenne a taskom hogy gyorsan megtanuljak úgy spanyolul, hogy az utcán tudjak helyesenbeszélni és megértsek másokat."
Lényeg: WoT-tech-tree-szerű, elágazó topic-térkép; opcionális ágak (pl. számok
kihagyhatók, matek-ág ráépülhet); cél a gyors utcai beszédkészség.
A 9. feladat (al-szintek) lineáris csoportosítása ettől még mehet — a fa egy
következő iteráció UX-döntése (user maga is bizonytalan a megoldásban).

## ✅ FB10 [P1] — Mester mód: közvetlen szintváltás + vizsgaindítók — KÉSZ (`eedad74`)
Idézet: „nagyon unom megcsinálni az a0 szint lévő vizsgáját, hogy amikor a master
modra megyek akkor ott legyenek a vizsgák is és legyenek a szintek is hogy könnyen
tudjak váltani"
Fix: Master modal két szekció — **Szintváltás** (azonnali, vizsga-kapu nélkül,
`updateLevel`) + **Vizsgák** (bármely szint vizsgája közvetlenül indítható).
Újrakezdés saját gombra költözött (eddig az A0 csempe mögött volt).
Fájlok: `app/(tabs)/settings.tsx`, `lib/pendingAction.ts` (`setLevel` action),
`app/(tabs)/index.tsx` (consume ág), i18n ×4.

---

# 📋 Feedback — 2026-06-12 forduló (v3.0.0 telefon-teszt)

Új visszajelzések a `Kimacha Feedback` sheetből (a 06-10-es sort FB1–FB10 már fedi).

## ✅ FB11 [P0 BUG] — Szó-kártya Good/Again gomb „nem kattintható / lassú" — KÉSZ (kód), ⏳ eszköz-verify
Három visszajelzés egymás után, mind `word:` kártyán (the shirt, I speak, we speak):
- „nem tudok se a goodra se az againre kattintani"
- „here has a bug too, i cant tap on good"
- „here too I can't pick good or it is slow"
Gyökérok: `advance()` (`app/(tabs)/index.tsx`) a következő kártya megjelenítése ELŐTT
~8 await-elt DB-írást futtatott (updateCard, recordAttempt, updateStreak,
getReviewedWordCount, checkLevelChange=2, getStreak) a JS-szálon → a gomb „holtnak"
/ lassúnak tűnt; nem volt dupla-koppintás védelem sem.
Fix: optimista UI — mid-queue értékelésnél a következő kártya AZONNAL megjelenik, a
SRS-perzisztálás utána fut a háttérben; `advancingRef` őr a dupla-fire ellen.
Queue-vég (batch-újraépítés) marad await-elt + őrzött. tsc 130 baseline, jest 43/43.
⏳ Telefonon ellenőrizni: Good/Again azonnal vált, nincs „nem kattan" érzet.

## ✅ FB12 [P1 BUG] — „ellos)" idétlen tile az easy-mondatban — KÉSZ
Idézet: „ellos) I have a word like this chang it. its a bug" (`easy:They speak in class.`).
Gyökérok: `data/words/a1.json` id 1162 `es: "su casa (de ellos)"` — a posesivos-kártya
zárójeles glosszáját a `nearMissDistractors` (`lib/distractors.ts`) szavakra bontotta
→ `(de` / `ellos)` tile-ok szivárogtak a bankba.
Fix: a tokenizálás a split ELŐTT eltávolítja a teljes `(...)` glosszát, és a paren
karaktereket is a strip-osztályba vette. A kártya-front gloss marad (tanulási segéd).
distractors teszt zöld, jest 43/43.

## 📌 FB13 [P1 feature] — „Csak szavak" mód + fordított gépelés (EN→ES) — DÖNTÉSRE VÁR
Idézet: „Akarok egy módot, ami legyen benne egy olyan rész amikor csak a szint szavait
dobálja fel, a mondat össze rakás kevesebb legyen egy olyan gomb hogy csak szavak és ot
legyen olyan hogy az a1 es szintű szavakat és legyen olyan amikor angol szót spanyolul
kell leírni"
Lényeg: (a) „csak szavak" gyakorló-mód (mondat-kártyák nélkül, csak az adott szint
szavai); (b) fordított-gépelés variáns: anyanyelvi szót a tanult nyelven kell beírni.
Megjegyzés: a fordított gépelés infrastruktúra MÁR létezik (`typingDirection:
'native-to-learned'`, `getFrontBack` index.tsx). A mód belépési pontja (gomb/kapcsoló
helye) + a queue-szűrés UX-döntés → egyeztetés Kálmánnal a megvalósítás előtt.

## 📌 FB14 [P1 feature] — Kártyatípus-arány: 10 szó : 2 mondat-összerakós : 1 gépelős — DÖNTÉSRE VÁR
Idézet: „csökkenteni kell a mondatok arányát a szavakéhoz képest legyen 10 szó 2 mondat
össze rakós 1 mondat gépelős és megint 10 szó  2 1 ez ismétlődjön"
Lényeg: túl sok a mondat-kártya a szavakhoz képest; kívánt kadencia 10:2:1, ismétlődő.
Tradeoff: a jelenlegi queue FSRS-esedékesség szerint kever szó/mondat típust
(`getDueCardsForWordIds(..,10)`). Fix kadencia = a típus-mix felülírása → SRS-időzítés
sérülhet, és kezelni kell, ha kevesebb mondat esedékes. Megvalósítás előtt egyeztetés.

---

# 📋 Feedback, 2026-06-16/17 forduló (v3.0.1)

Új sorok a `Kimacha Feedback` sheetből (mind A1, en→es). FB15–19 KÉSZ (commit
`842404e`), FB20 = backlog (design-first, user-döntés 2026-06-21). Verify: tsc tiszta,
jest 43/43, korpusz-audit P1=0. ⏳ eszköz-verify a 3.0.1 buildben.

## ✅ FB15 [P0 regresszió], „ellos)" tile MÉG MINDIG látszik, KÉSZ (`842404e`)
Két visszajelzés (06-16 + 06-17, user frusztrált: „még mindig benne van", „figyelj erre
nagyon"). FB12 (`ac63531`) **már javította a kódot**: a `lib/distractors.ts` KÉTSZER
szedi ki a zárójelet (sor 64: teljes `(...)` glossza eltávolítva a split ELŐTT; sor 66:
maradék `()` karakter tokenenként). Az `ellos)` **a jelenlegi kóddal nem tud átjutni**
az easy-kártya bankjába (egyetlen distractor-út = `nearMissDistractors`, `index.tsx:692`).
Gyökérok: a user által tesztelt **build elavult** volt (a 06-16 19:14-es APK nem
tartalmazta `ac63531`-et). Valódi fix = új build (3.0.1). Belt-and-suspenders adat-fix:
`data/words/a1.json` id 1162 `"su casa (de ellos)"` → `"su casa"` (nincs ütközés másik
`su casa`-val; audit P1=0 maradt), így az `ellos)` adat-szinten is lehetetlen.
A „nézd meg más szónál is" kérésre: a többi `(...)` az `es` mezőkben mind **A2+**
(verb-glosszák, pl. `ver (veremos)`), amit a user A1-en nem ér el, és a kód-strip védi.
A2 adat-sweep = külön task, ha kell.

## ✅ FB16 [P1], Easy-mondat: első szó ne nagybetűs legyen, KÉSZ (`842404e`)
Idézet (06-16): „ne kezdődjön nagybetűvel az a szó ami a mondat eleje. túl sokat segít".
A mondat-kezdő nagybetű elárulta, melyik csempe az első. Fix: `app/(tabs)/index.tsx` az
easy-kártya `targetWordList` építésénél az ELSŐ szó kezdőbetűje kisbetűsítve (a grading
amúgy is kis/nagybetű-érzéketlen). A forrás-mondat (prompt) változatlan marad.

## ✅ FB17 [P2] + FB18 [P2], Gomb press-visszajelzés (zöld villanás), KÉSZ (`842404e`)
- FB17 (06-16): „I know this gombnak legyen animációja, ha megnyomom zölden villanjon fel".
- FB18 (06-16): „a feedback send gombnak is legyen effektje ... a kék háttere váltson zöldre".
Fix: `pressed`-állapotú zöld (#22C55E) a 3 „I know this" gombon (`index.tsx` ×2 +
`EasySentenceCard.tsx`) és a FeedbackModal Send gombján (press VAGY sending alatt zöld).
A press-in (ujj le) azonnal mutatja a zöldet, MIELŐTT a kártya tovább vált (lásd FB19),
így a villanás látszik a gyors tap ellenére is.

## ✅ FB19 [P1 BUG], „I know this" gomb lassú, KÉSZ (`842404e`)
Idézet (06-17): „i know this button works slow. find it why". Gyökérok (mint FB11): a
gomb `db.buryCard(...).then(() => advance(...))`, a DB-írást MEGVÁRTA a kártyaváltás
előtt → lassú/holt érzet. Fix: optimista, `buryCard` fire-and-forget (`.catch(()=>{})`),
`advance(Rating.Good)` AZONNAL fut. Mind a 3 „I know this" handler (`index.tsx`).

## 📌 FB20 [feature, backlog], „PRO mód" adaptív nehézség, DESIGN-FIRST (user-döntés 2026-06-21)
Idézet (06-17): „PRO mod on Legyen egy ilyen gomb amiben az összes szó egyben benne van.
és az a lényege, hogy megtalálja a játékhoz illő szintet. progresszívan ha sok jó t nyom
vagy i know thist akkor nehezebb szavakat dobjon be és így ugráljon az egyre jobb felé".
Lényeg: egyetlen összevont szó-pool (minden szint), adaptív nehézség ami felfelé lép, ha
sok Good / „I know this" jön (és vissza hibázásnál), placement/IRT-szerű ráhangolás.
User 2026-06-21: backlog, ELŐBB design-egyeztetés (mint FB13/FB14), ne build vakon.
Nyitott design-kérdések: (a) nehézség-metrika (szint A0→C2? SUBTLEX-gyakoriság rang?
FSRS-stabilitás?); (b) lépés-szabály (streak-alapú? helyes-arány csúszóablak?); (c) belépés
(külön gomb a Settings/Master modalban?); (d) külön SRS-állapot vagy a meglévőt használja.

---

# 📋 Feedback, 2026-06-23/25 forduló (v3.0.1 telefon-teszt, mind en→es)

Új sorok a `Kimacha Feedback` sheetből (FB20 utániak). Triage 2026-06-27 (Opus).
Döntések AskUserQuestion-nel pinnelve (lent jelölve). Idézetek a user eredeti
megfogalmazásában, ne tömörítsd.

## ✅ FB21 [P1 feature], A0 szint kapjon topicokat, KÉSZ (`4d97224`)
> 100 A0 szó → 10 topic / 3 al-szint (`data/topics/a0.json` + `data/sublevels/a0.json`),
> tree.tsx bármely topic-os szintre rajzol, A0 szabad-választás, topic-váltás toast (FB21 UX).
> Döntés 2026-06-28: 10-csoport IGEN, verbos_a0 egyben. Terv: `docs/TOPICS-A0-A2.md`.
Idézet (06-23, A0, word:no): „topics résznél A0 szinten is legyenekek topicoc. Nézd meg,
hogy milyen szavak vannak itt és tedd be topicocba. Ha valaki egy topicot szeretne tanulni,
tudja azzal folytatni. Fontos Valahogy jelezzük a jatékosnak, hogy a topic váltás az a
jövőbeni szavak fajtáját, módosítja, nem pedig a múlt béli szavakat"
Lényeg: az A0 100 szava kerüljön topicokba (mint A1), legyen választható; + UX-jelzés,
hogy a topic-váltás a JÖVŐBENI kártyákra hat, nem a múltbeli haladásra.
**Döntés (2026-06-27):** DOC-FIRST, előbb A0 topic-csoportok terve (`docs/TOPICS-A0-A2.md`),
user-jóváhagyás, CSAK utána build. A0/A2 közös strukturális minta (lásd FB22/29).

## ✅ FB22+FB29 [P1 feature, NAGY], A2 szint kapjon topicokat, KÉSZ (`b1e6d87`)
> A2 témák = **Origó (ITK, ELTE) alapfok szóbeli témalista** (hivatalos PDF, 15 téma / 5 al-szint).
> 900 A2 szó besorolva a 15 témába (Sonnet kurátor-pass, 6 batch, mind pontosan 1 témába).
> `data/topics/a2.json` + `data/sublevels/a2.json` + words-patch + topics.ts wiring; tree szabad-
> választás A0/A1/A2-re. tsc 0, jest 49, audit P1=0. Eloszlás egyenetlen (trabajo_dia 190,
> yo_familia 125), később finomítható. Mapping: `docs/TOPICS-A0-A2.md` 2. szekció.
Idézet (06-23, active-tab): „A2 nél nincsenek tipicoc. Legyenek csináld meg, a Nyelvvizsga
szóbeli tételei alapján."
Idézet (06-25, active-tab): „Topics A2 nél, nincs feedback és nincsen topics választás, ezt
is csináld meg"
Lényeg: A2-nek (jelenleg ~900 szó, nincs topic-struktúra) legyen topic-fája a **nyelvvizsga
szóbeli tételei** (temario) alapján, + feedback gomb + topic-választó (mint A1).
**Döntés (2026-06-27):** DOC-FIRST, előbb A2 szóbeli-temario topic-lista (`docs/TOPICS-A0-A2.md`),
user-jóváhagyás, CSAK utána build (900 szó kategorizálása nagy task). Feedback-gomb a Témák
tabon = FB23 (külön, már most).

## ✅ FB23 [P2 UI], Feedback gomb a Témák (tree) tabra, KÉSZ (`5064ea1`)
Idézet (06-23, active-tab): „topics részlél nincsen feedback gomb. Tegyél be ide is"
Fix: `<FeedbackButton level={...} pair={...} card="active-tab" />` a `app/(tabs)/tree.tsx`-be
(a komponens minden más tabon ott van, csak innen hiányzik). Acceptance: gomb látszik a fán, tsc tiszta.

## ✅ FB24+FB26+FB27 [P1 feature], Words-only mód újratervezés, TELJES modell, KÉSZ (`d389b52`)
- FB24 (06-23): „rá nyomok a words only és az első dolog ami feljön egy mondat csinálás.
  csináld meg úgy, hogy ilyenkor egy szó legyen és utána csak szavak"
- FB26 (06-23): „words only nál, legyenek szó kártyák is ne csak gépelés. 2 ilyen 2 olyan.
  legyen belle pici random de az arány legyen meg és ne legyen egymás után 5 ugyan olyan típusú"
- FB27 (06-23, A2, word:traffic light): „legyen úgy hogy a nem tudom milyen mód az ahol vagyok,
  csak szavak legyen úgy, hogy itt csak akkor dobálja fel a leírni a szavakat, hogyha már good
  ra nyomtam a szó kártyáján a szavaknak angol spanyolra és spanyolról angolra is, és utána"
**Döntés (2026-06-27, AskUserQuestion): TELJES modell.** Words-only mód:
- Flashcard MINDKÉT irány (learned→native ÉS native→learned) jön előbb.
- Egy szó GÉPELŐS kártyája CSAK akkor jelenik meg, ha a szó már Good-ot kapott a flashcardján
  (mindkét irányban, reps≥2 a meglévő phase-modellben).
- Kevert típus, max 4 azonos egymás után (pici random az arányon belül).
- Első kártya MINDIG szó (sose mondat-rakós, a wordsOnly amúgy is csak word-típust enged).
- Mondat-kártya továbbra is KIZÁRVA words-only alatt.

## ✅ FB25 [P2 feature], Gépelésnél rossz betűk vizuális jelzése, KÉSZ (`804669b`)
Idézet (06-23, A2, word:wind): „gondom: amikor egy két betűt, gépelek el, akkor nem látom mit.
Ezt valahogy meg kell oldani lehet a te ötleted is. De szerintem ha a betűk hátteret
beszineznénk pirosra ami nem jó, és a betűt megváltoztatnánk fehérre az működne. Ezt lehet
inkább AB tesztelni kellene"
Fix: gépelős kártya ellenőrzés után (wrong/almost) a beírt válasz per-karakter render, a
helyes alaktól ELTÉRŐ pozíciók piros háttér + fehér betű. A jó karakterek normál szín.
Fájl: `app/(tabs)/index.tsx` (typing result blokk ~736-794). Acceptance: rossz betűk pirosan
kiemelve, tsc tiszta.

## ✅ FB28 [P1 feature], Könnyítés ha kevés szó jön össze, Recognition-fallback + helyesírás, KÉSZ (`ad21b1a`)
Idézet (06-25, A2, word:meat): „Valamit kellene csinálni, ha nem jön össze sok szó, mert az
emberi viselkedés ilyenkor felbaszódik, és abba hadja a játékot. Az kellene hogy valahogy
könnyebben meg lehessen csinálni a szavakat. Erre nem találtam ki semmit. Mondj ötleteket,
és választók közülük"
**Döntés (2026-06-27, AskUserQuestion): Recognition-fallback HELYESÍRÁS-fókusszal.**
User pontosítás: „a kattintós a 2 es jó, de legyenek úgy hogy a helyesirsát nézze mármint
mondjuk quier qero qiero hogy legyenek olyan szavak amik lehet, hogy nem léteznek, de hogy a
helyes szó irásában segitsenek"
Lényeg: ha a tanuló egy gépelős kártyán többször hibázik (N hiba), a kártya átvált
feleletválasztóssá: a HELYES alak + helyesírási-variáns disztraktorok (pl. célszó `quiero` →
`quier`/`qero`/`qiero`/`quiero`), amik nem feltétlen létező szavak, csak a helyes leírásra
tanítanak. Koppintás a helyesen írt alakra → tovább. Recall→recognition fal-csökkentés.

## ✅ FB30 [P2 UI], „I know this" zöld villanásnál fehér betű, KÉSZ (`83bff68`)
Idézet (06-25, A2, word:ticket): „amikor rá nyomok az \"I know this\" akkor fel villan zoldel,
ez jó de legyen ilyenkor a betű fehér"
Fix: a 3 „I know this" gomb (`index.tsx` ×2, `EasySentenceCard.tsx` ×1) pressed-állapotában a
`buryText` színe fehér (#FFFFFF) a zöld háttéren. Acceptance: press alatt fehér betű, tsc tiszta.

---

# 📋 Feedback, 2026-06-30/07-01 forduló (v3.0.1 telefon-teszt, mind A1 en→es)

Új sorok a `Kimacha Feedback` sheetből (FB30 utániak). Triage 2026-07-02 (Fable).
User-utasítás: „csináld meg a google driveon lévő visszajelzéseket" → mind a 6 item
egyértelmű spec, döntés-blokk nincs (nem FB20-jellegű vak-feature). Idézetek a user
eredeti megfogalmazásában, ne tömörítsd.
**MIND KÉSZ 2026-07-02** (Fable tervezett, Sonnet írt): tsc 0 hiba, jest 51/51,
adat-JSON érintetlen. ⏳ Eszköz-verify a következő buildben.

## ✅ FB31 [P1], Sok (hasonló) mondat egymás után, queue-limit, KÉSZ (`a728901`)
Idézet (06-30, easy:It is seven o'clock.): „most egynás után nagyon sok ilyen mondat jön
ezt nem szeretem valahogy limitáld, hogy egymás után ne byi lehet nert ez unalmas"
Gyökérok: `applyCadence` (index.tsx ~182) 10:2:1 egysége 3 mondatot tesz EGYMÁS UTÁN
(2 easy + 1 typing), és a szavak elfogyta után a maradék mondatokat ömlesztve fűzi a
végére (~211-212. sor) → hosszú mondat-sorozatok. Fix az FB36-tal közös kadencia-átírásban:
sose legyen 2 mondat szomszédos (kivéve ha szó már nincs, ott easy/typing váltakozva).

## ✅ FB32 [P1], Recog-kártya: TTS ne mondja ki a választ + opciók négyzet-rácsba, KÉSZ (`6fad3e5`)
Idézet (06-30, recog:he goes up): „ilyenkor ha tobb lehetőség van ne mondja ki. plusz
rendezd át az UI ba ezeket a lehetőségeket névyzetbe"
Gyökérok (TTS): `handleCheck` (index.tsx ~666) minden ellenőrzésnél kimondja a helyes
választ (`Speech.speak(back,…)`); a RECOGNITION_AT-adik hibánál ugyanez a render már a
recog-opciókat mutatja → a megoldás hangosan elhangzik, miközben a választék látszik.
Fix: ha szó-kártyán a mostani hibával a fail-számláló eléri a RECOGNITION_AT-ot, a speak
maradjon el. UI: `styles.recogOptions` 2×2 rács (flexWrap, opció ~48% szélesség, középre
igazított szöveg), nem függőleges lista.

## ✅ FB33 [P1] + FB35, Nehéz mondat túl korán, egyszerű előre, komplex a végére, KÉSZ (`a728901`)
Idézetek:
- (06-30, easy:We have been friends since childhood.): „ez túl nehéz mondat, olyan mondat
  szerkezet van amit ezen a szinten még nem tanultam. ennél konyebbeket csinálj erre a
  szintre azokból a szavakból amit eddig már tanuktunk"
- (07-01, easy:There are one hundred people in the room.): „ez is túl nehéz, mondat ennél
  egyszerűbb mondatok IS legyenek. ez a mondat jöhet, a végén"
- (07-01, easy:We do exercise.): „ez jó mindat az elejére"
- (07-01, easy:We make plans for the weekend.): „ez is konolex és hosszú mindat, idozitsd
  a mondatokat későbbre"
Lényeg: a user nem törölni akarja a nehéz mondatot, hanem KÉSŐBBRE időzíteni („jöhet a
végén"). Fix: az easy-mondat vödör (reps=0, új kártyák → SRS-sorrendjük szabadon
átrendezhető) nehézség szerint rendezve: tanult-nyelvi mondat szószáma növekvő, azonos
szószámnál karakterhossz. A typing-mondatok (reps>0, esedékes ISMÉTLÉSEK) sorrendjéhez
NEM nyúlunk (FSRS-integritás).

## ✅ FB34 [P1 BUG], Felesleges szóköz ne legyen hiba gépelésnél, KÉSZ (`55683ca`)
Idézet (07-01, sentence:Yo trabajo en una oficina.): „most tettem egy felesleges szoközt
és ez nem lett jó, ez ne legyen hiba a jövőben"
Gyökérok: `lib/answerMatch.ts` szavanként hasonlít; szavak KÖZTI dupla szóközt a
`split(/\s+/)` már megbocsátja, de a szó BELSEJÉBE tett szóköz („ofi cina") eltérő
token-számot ad → bukik. Fix: fallback-ág, ha a szavankénti match bukik, hasonlítsd
össze a whitespace-mentes teljes betűsort (ugyanazzal a case/írásjel/ékezet-normalizálással);
egyezésnél elfogadott. FB6 szigora él: „she speak" → „shespeak" ≠ „shespeaks", továbbra
is hibás. Teszt: `lib/__tests__/answerMatch.test.ts` bővítés (szó-belseji szóköz átmegy,
she speak továbbra is bukik).

## ✅ FB36 [P1], Kártya-arány 80% szó / 20% mondat, KÉSZ (`a728901`)
Idézet (07-01, sentence:Tú eres muy amable.): „nagyon sok mondat egymás után inkább a
szavak a fontosak és a mondatok kevésbé olyan 80% szaval 20% mondat"
Fix (FB31-gyel együtt, `applyCadence` átírás): a 10w+2e+1t egység helyett ismétlődő
15 kártyás egység: **4 szó + 1 easy, 4 szó + 1 easy, 4 szó + 1 typing** = 12 szó : 3
mondat = pontosan 80/20, easy:typing 2:1 arány megmarad, és sosincs két mondat egymás
mellett. Ha a szó-vödör kifogy, a maradék mondatok easy/typing váltakozva jönnek (FB31).
A wordsOnly ág (FB24/26/27) változatlan. Ez a user 06-12-es FB14 10:2:1 döntésének
07-01-es felülírása (frissebb user-szó nyer).

## ✅ FB37 [P1 feature], Random topic-választás kapcsoló (A1-en belül), KÉSZ (`8b6a75a`)
Idézet (07-01, word:sixteen): „ha választok egy másik topicot akkor mindig vissza dob a
sorba kezdésnek. lehessen egy olyan opció, amit ha be pipálok akkor az A1 en belül random
választ témákat"
Lényeg: ma ha a kiválasztott topic elkészül (vagy nincs választás), az aktív topic a
sorrend szerinti ELSŐ nem-kész topicra esik vissza (`computeUnlockedTopics` ~259-264), 
„vissza dob a sorba kezdésnek". Kapcsolóval: véletlen nem-kész topic legyen helyette.
Megvalósítás:
- `learn_settings` új oszlop `random_topics INTEGER`: `ALTER TABLE ... ADD COLUMN`
  try/catch-ben (meglévő installok migrációja). ⚠️ A meglévő setterek `INSERT OR REPLACE`-e
  a másik oszlopot NULL-ra törölné → MINDKÉT setter álljon át UPSERT-re
  (`INSERT ... ON CONFLICT(pair) DO UPDATE SET <oszlop>=...`). `getRandomTopics`/
  `setRandomTopics` az IDatabase-ben + `lib/database.ts` + `lib/database.web.ts` (web:
  memória-map, mint a wordsOnly).
- `index.tsx` `loadCards`: ha `randomTopics` ON és a mentett topic hiányzik/kész →
  véletlen nem-komplett topic választása, ÉS `db.setSelectedTopic`-kal perzisztálva
  (reload/appindítás nem ugrál topicot tanulás közben; új random csak topic-készültekor).
- Settings UI: Switch sor a wordsOnly alatt, ugyanaz a minta (toggle → `setRandomTopics`
  → `setPendingAction({type:'selectTopic'})` → `router.push('/')`).
- i18n ×4: hu „Random témák" / en „Random topics" / es „Temas aleatorios" / de „Zufällige Themen".

## Elfogadási kritérium (FB31-FB37 forduló)
- `npx tsc --noEmit` app-kód 0 hiba; `npx jest` zöld (flaky examBuilder-szabály él:
  ha csak az bukik, újrafuttat, NEM javít).
- Adat-JSON nem változik (audit-futtatás nem szükséges).
- Commitok külön: (1) `fix(typing): forgive stray spaces in answers (FB34)` +
  recog TTS/grid mehet vele vagy külön `fix(recog): no answer TTS + grid options (FB32)`;
  (2) `feat(learn): 80/20 word-sentence cadence, easy sentences easiest-first (FB31/FB33/FB35/FB36)`;
  (3) `feat(learn): random topic picker toggle (FB37)`.
- E szekció FB-címeit jelöld ✅ KÉSZ-re commit hash-sel.

---

# 📋 Feedback, 2026-07-03/07 forduló (v3.0.4 telefon-teszt, mind A1 en→es)

Új sorok a `Kimacha Feedback` sheetből (FB37 utániak, 13 sor). Triage 2026-07-08
(Fable). Döntések AskUserQuestion-nel pinnelve: **recog opciók = HIBRID 2+1**
(2 valódi szó + 1 gondos misspelling); **FB39 = build most** (nem design-first).
Idézetek a user eredeti megfogalmazásában, ne tömörítsd.
**MIND KÉSZ 2026-07-08** (Fable tervezett, Sonnet írt, 4 commit): tsc 0 hiba,
jest 54/54 (52+2 új teszt), adat-JSON érintetlen. ⏳ Eszköz-verify a következő
buildben (3.0.4 után).

## ✅ FB38 [P1 feature], „3 nap pihenés" gomb minden szó-kártyán, KÉSZ (`2ce5f53`)
Idézet (07-03, word:When do you eat?): „legyen 1 gomb ami elrakja a szot 3 napra,
addig nem dobja fel. Legyen a neve 3 nap pihenés minden szónál legyen és mindog
olyan nyelven amilyen nyelven beszélünk"
Lényeg: minden szó-kártyán (flashcard + gépelős + recog) legyen egy „3 nap pihenés"
gomb; megnyomásra a szó 3 napig nem jön fel; felirat az UI nyelvén (i18n ×4).
Megvalósítás:
- `lib/database.ts` + `lib/database.web.ts` + IDatabase: `snoozeCard(wordId, type,
  days)`, a kártya `due`-ját NOW+days-re tolja, reps/stability érintetlen (a
  `buryCard` mintájára, de nem végleges). Web: memória-map.
- `index.tsx`: gomb az „I know this" (buryBtn) mellé/alá mindhárom szó-nézetben.
  Megnyomás: `db.snoozeCard(...)` fire-and-forget + tovább a következő kártyára
  SRS-értékelés NÉLKÜL (új `advanceNoRating()`, a queue-léptetés az `advance`
  optimista ágából, db-írás nélkül; `advancingRef` őr marad).
- i18n: hu „3 nap pihenés" / en „Rest 3 days" / es „Descanso 3 días" / de „3 Tage Pause".

## ✅ FB39 [P1 feature NAGY], Helyesírás-gyakorló lista + külön felület, KÉSZ (`1a52504`)
Idézetek (07-04):
- (word:the gloves): „legyen egy olyan gomb, hogy \"helyesírás\" És ez azt csinálja
  hogy beteszi a szót aminéleg lett mondva egy listába, és ennek a listának a szavait
  lehet gyakorolni egy másik felületen. a masik feluleten, az lesz hogy feljonnek a
  szavak és le kell írni őket helyesen. És itt csak a 100% egyezés számít (minden betű
  kisbetű) és itt is olyan módszerben ismétlődnek a szavak mint rendesen 1 nap múlva
  3 nap múlva 4 8 16 32 és így tovább"
- (active-tab): „és a helyesírás gomb a settingsbol lesz elérhető"
Lényeg + döntés (build most, 2026-07-08):
- **Gomb a szó-kártyán**: „Helyesírás", a szót felveszi a helyesírás-listába
  (dedup; visszajelzés: gomb ✓-ra vált). Mindhárom szó-nézeten (mint FB38).
- **DB**: új tábla `spelling_list (pair TEXT, word_id INTEGER, step INTEGER,
  due TEXT, PRIMARY KEY (pair, word_id))` (due = ISO string, a cards.due
  konvenciója szerint) + metódusok: `addToSpellingList`,
  `removeFromSpellingList`, `getSpellingList()` (aktív pair), `getSpellingDueCount()`,
  `updateSpellingStep(wordId, step, due)`. MINDKÉT db-fájl + interfész.
- **Belépés a Settingsből**: sor/gomb „Helyesírás-gyakorló (N esedékes)" → új screen.
- **Új screen** `app/spelling.tsx` (root Stack route, expo-router): esedékes
  (due<=now) lista-szavak sorban; kártya: anyanyelvi oldal (front, a tanulási irány
  szerint) + input; **CSAK 100% egyezés** számít jónak, kisbetűsítve hasonlítunk
  (`input.trim().toLowerCase() === target.toLowerCase()`), ékezet SZÁMÍT (helyesírást
  gyakorlunk), írásjel-elhagyás NEM megbocsátott. Rossz válasznál a helyes alak
  mutatása per-karakter piros kiemeléssel (FB25 minta), a szó a session végére
  visszakerül és `step` nullázódik. Jó válasz: `step+1`, `due = now + lépcső[step]`.
- **Ismétlés-lépcső** (a user számai szerint, utána duplázódik): 1, 3, 4, 8, 16, 32,
  64, 128… nap.
- FeedbackButton a screenen (`card="spelling-screen"`).
- i18n ×4: gomb hu „Helyesírás" / en „Spelling" / es „Ortografía" / de „Rechtschreibung";
  settings-sor, screen-címek, üres-állapot szöveg.

## ✅ FB40 [P2 UI], Feedback gomb a Settings tabra, KÉSZ (`1a52504`)
Idézet (07-04, word:the gloves): „settingsen legyen visszajelzés adás gomb"
Fix: `<FeedbackButton level={...} languagePair={...} currentCard="settings-tab" />`
a `app/(tabs)/settings.tsx`-be (FB23/tree minta).

## ✅ FB41 [P2 UI], Tree-tab feedback gomb húzható, oldalt marad, KÉSZ (`30636bf`)
Idézet (07-04, tree-tab): „topic résznél lévő visszajelzés gomb legyen mozdítható ha
elkezded húzni akkor át lehessen tenni a másik oldalra és ott maradjon"
Lényeg: a Témák (tree) tabon a feedback gomb drag-gel átvihető a bal oldalra (és
vissza); az oldal-választás PERZISZTENS.
Megvalósítás: FeedbackButton opcionális `draggable` prop (csak tree használja);
PanResponder, elengedéskor a képernyő-fél szerint bal/jobb oldalra snappel.
Persist: `learn_settings` új oszlop `feedback_btn_side TEXT` (ALTER try/catch,
setter UPSERT, NE INSERT OR REPLACE, ld. FB37 figyelmeztetés), getter/setter
mindkét db-fájl + interfész; web memória.

## ✅ FB42 [P2 UI], „In sentence" ↔ „Again" gombok cseréje, KÉSZ (`2ce5f53`)
Idézet (07-04, word:the belt): „in sentence and again gombokat caeréld fel. máshol
legyenek a gombok"
Fix: a szó-flashcard gombsor sorrendje ma Again | Good | In sentence → legyen
**In sentence | Good | Again** (`index.tsx` buttons blokk, csak sorrend-csere).

## ✅ FB43 [P1 UX], Üres gépelt válasz → szó vissza a sor végére, ne hiba, KÉSZ (`2ce5f53`)
Idézet (07-05, word:the socks): „ha nem irok be semmit akkor tegye vissza a szót a
kártyák közé. valamit ki kell találni ahoz, ami túl nehéz szó vagy most nincsen meg
a jelentése"
Fix: `handleCheck` (index.tsx), ha az input üres (trim után), NE értékeljen
(se wrong, se fails-növelés): a kártya kerüljön a queue VÉGÉRE (requeue helper),
és jöjjön a következő kártya. (A hosszabb távú „túl nehéz" eszköz az FB38 snooze.)

## ✅ FB44+FB48 [P1], Recog opciók: HIBRID 2+1, KÉSZ (`83acbe0`)
Idézetek:
- (07-05, recog:Where are you?): „most itt 3 ugyan olyan van és egy különböző, ez
  hiba legyen 1 helyes válasz és 3 reljesen más"
- (07-07, recog:whose): „ide írj masik szavakat, ezek nagyon egyértelműek melyikek
  a rosszak"
Gyökérok (repró 2026-07-08): `spellingVariants('¿Dónde estás?')` →
`["¿Dónde esás?","¿Dónde astás?","¿Dónde está?s"]`, mind „¿Dónde est…"-tel indul,
a szűk 2×2 rács-cellában ránézésre azonosak; írásjel-roncsolt variáns („está?s",
„d quién") kamunak látszik.
**Döntés (AskUserQuestion): HIBRID 2+1**, a recog kártya 4 opciója:
1 helyes + **2 valódi szó** (a szint szókincséből, előnyben azonos topic;
fold-szinten különbözzenek a helyestől és egymástól) + **1 gondos misspelling**.
Misspelling-szabályok (`lib/spellingVariants.ts`): edit CSAK betű-pozíción
(írásjel/¿?¡! és szóköz sosem törlődik/cserélődik/duplázódik); többszavas kifejezésnél
a leghosszabb szóban legyen az edit. Determinisztikus marad (seed).
Teszt: `lib/__tests__/`, variáns sosem tartalmaz írásjel-edittelt alakot; opciók
mind fold-különbözőek.

## ✅ FB45 [P1 UX], Recog interakció: zöld jelölés + második tap léptet, KÉSZ (`83acbe0`)
Idézetek (07-05):
- (word:the swimsuit): „ha feldobsz 4 lehetőséges választ akkor legyen az hogy amikor
  jó akkor jelolje ko zoldel és amikor még egyszer kattintok akkor lépjen tovább"
- (easy:I wear a white t-shirt.): „meg amikor 4 ez feldob és nem találom el akkor
  zoldítse el a helyeset"
Fix (index.tsx recog blokk):
- Helyes opcióra tap → az opció ZÖLD (nem lép azonnal tovább); a KÖVETKEZŐ tap
  (bármely opción / a zöldön) léptet `Rating.Good`-dal (fails törlődik, mint ma).
- Rossz opcióra tap → a rossz PIROS **és a helyes egyből ZÖLDDEL kiemelve**;
  a következő tap léptet `Rating.Again`-nel (fails marad, a kártya recog-ban jön
  vissza legközelebb).

## ✅ FB46 [P1 UX], Skip gomb az easy-mondat kártyára, KÉSZ (`2ce5f53`)
Idézet (07-05, easy:The coat is made of wool.): „kell egy skip button mert most már
nehéz és cak a következőt akarom"
Fix: `components/EasySentenceCard.tsx`, „Kihagyás" gomb (i18n ×4: hu „Kihagyás" /
en „Skip" / es „Saltar" / de „Überspringen"), `onSkip` prop → index.tsx a kártyát a
queue VÉGÉRE teszi értékelés nélkül (ugyanaz a requeue helper, mint FB43).

## ✅ FB47 [info], „El jefe" vs „My boss", adat HELYES, nincs teendő
Idézet (07-06, easy:My boss wears a blue tie.): „itt nen hibás a My boss, mármint,
hogy itt nem annak kellene lennie hogy Mi jefe? mert itt az van hogy El jefe
szerintem ez különbözőt jelent"
Vizsgálat (2026-07-08): az adat (a1.json id 1679, la corbata) HELYES:
`sentence_es: "Mi jefe lleva una corbata azul."` ↔ `sentence_en: "My boss wears a
blue tie."`, konzisztens. Az „el" csempe a distractor-bankból jött (FB1
névelő-variánsok), a helyes megoldás mindig „mi jefe…". FB8-minta: nincs teendő.
(Az id 1599 `El jefe va a firmar la carta.` ↔ `The boss…` szintén konzisztens.)

## Elfogadási kritérium (FB38-FB48 forduló)
- `npx tsc --noEmit` app-kód 0 hiba; `npx jest` zöld (flaky examBuilder-szabály él).
- Adat-JSON nem változik.
- Commitok külön: (1) `fix(recog): hybrid 2+1 options + green-confirm interaction
  (FB44/FB45/FB48)`; (2) `feat(learn): 3-day snooze, empty-answer requeue, easy skip,
  button order (FB38/FB42/FB43/FB46)`; (3) `feat(spelling): spelling practice list +
  trainer screen (FB39/FB40)`; (4) `feat(ui): draggable feedback button on tree
  (FB41)`.
- E szekció FB-címeit jelöld ✅ KÉSZ-re commit hash-sel.

---

# 📋 Feedback, 2026-07-08 forduló (v3.0.4 telefon-teszt, mind A1 en→es)

Új sorok a `Kimacha Feedback` sheetből (FB48 utáni 3 sor, 07-08 16:47–16:49).
Triage 2026-07-08 este (Fable). Kontextus: a telefonon még a 3.0.4 APK fut,
amiben a FB38–48 fixek NINCSENEK benne, FB49/FB51 részben a már megjavított
recog-ra érkezett. Gate: tsc 0, jest 56/56 (2 új teszt), adat-JSON érintetlen.
⏳ Eszköz-verify a következő buildben (FB38–51 együtt).

## ✅ FB49 [P1], Recog opciók megint rosszak (the kiosk), LEFEDVE (`83acbe0`)
Idézet (07-08, recog:the kiosk): „ez is birzalmas opciók"
A 3.0.4 buildben a 4 opció = helyes + 3 spellingVariant (mind „quiosco"-szerű).
A FB44/48 HIBRID 2+1 (`83acbe0`) pont ezt cseréli: 1 helyes + 2 valódi szintbeli
szó + 1 gondos misspelling. Új kód nem kellett. ⏳ Eszköz-verify következő build.

## ✅ FB50 [P1], ellos↔ellas ne legyen egymás distractora, KÉSZ (`989d262`)
Idézet (07-08, easy:They decide together.): „miért van ellos and ellas igazából,
angolba nincs különbség, szerintem itt mind a kettő jó, felesleges a lehetségesek
közé betenni"
Lényeg: az angol „They" nem hordoz nemet, ellos ÉS ellas is helyes fordítás; a
párját trapként feldobni fair-telen. Ugyanígy: nosotros↔nosotras,
vosotros↔vosotras (forrásnyelvtől függetlenül blokkolva, a hu oldal se
különböztet nemet).
Fix: `lib/distractors.ts` AMBIGUOUS_PRONOUN_PAIRS (es); ha a mondat a pár egyik
tagját használja, a másik SOSEM kerül a bankba. Teszt: distractors.test.ts.

## ✅ FB51 [P1], Dupla-magánhangzós kamu variánsok („aacera"), KÉSZ (`a823cd0`)
Idézet (07-08, recog:the sidewalk): „ilyen aacuba meg ilyen dupla a ilyen ne
legyen ez bár lehet ez már javítva van"
Részben tényleg javítva volt (hibrid 2+1: már csak 1 misspelling / kártya), DE a
betű-duplázó edit (#3) BÁRMELY betűt duplázhatta („aacera"), és a transpose /
magánhangzó-csere is tudott dupla magánhangzót gyártani („quiosco"→„quoosco").
Fix (`lib/spellingVariants.ts`): (1) duplázó edit csak l/r/c/n betűn (amit a
spanyol tényleg duplaz); (2) add()-guard: variáns nem vezethet be olyan dupla
magánhangzót, ami a helyes alakban nincs. Teszt: variáns sosem matchel
/([aeiou])\1/-re.

## Elfogadási kritérium (FB49–FB51 forduló)
- `npx tsc --noEmit` 0 hiba ✅; `npx jest` zöld 56/56 ✅ (2026-07-08).
- Adat-JSON nem változik ✅.
- ⏳ Eszköz-verify: kiosk/sidewalk recog opciók + They-mondat tile-bank az új buildben.

---

# 📋 Feedback, 2026-07-16/21 forduló (v3.0.5 telefon-teszt, mind A1 en→es)

Új sorok a `Kimacha Feedback` sheetből (FB51 utáni 11 sor, 07-16 → 07-21). Triage
2026-07-22 (Opus). Nagyrészt tartalmi/QA (mondat-adat), 1 info, 1 feature-döntés.
Idézetek a user eredeti megfogalmazásában, ne tömörítsd. Gate: es-audit P1=0, tsc 0,
jest 76/76, `data/words/a1.json` 7 kártya mondat-mezői módosultak. ⏳ Eszköz-verify.

## ✅ FB52 [P2 adat], EN/ES szám-eltérés „trousers" ↔ „pantalón", KÉSZ (`data`)
Idézet (07-16, easy:The trousers are dark green.): „itt trousers van és spanyolul meg
nincs többes szám."
Kártya id 1251 (`oscuro`, colores). EN „trousers" (pluralia tantum) ↔ es egyes
„El pantalón". A tile-összerakós kártyán a szám-eltérés zavaró. **Döntés
(2026-07-22, AskUserQuestion): ES marad egyes (natív), a szótári kártyához
(`el pantalón` egyes) igazodva; az EN oldal természetesen többes (trousers), ez
nem hiba.** A rövid ideig alkalmazott többes átírás visszaállítva egyesre:
`El pantalón es verde oscuro.` (hu „A nadrág sötétzöld.", de „Die Hose ist
dunkelgrün."). Csak a 4 sentence-mező mozgott, szó-mező érintetlen.

## ✅ FB53 [P2 adat], EN/ES szám-eltérés „fresh fruit" ↔ „frutas frescas", KÉSZ (`data`)
Idézet (07-19, sentence:Ellos venden frutas frescas.): „frutas az többes szám,
eltérés van a fenti és a lenti között."
Kártya id 1452 (`ellos venden`, presente_er). es többes „frutas frescas" ↔ en
megszámlálhatatlan „fresh fruit". Fix: es egyesre → `Ellos venden fruta fresca.`
(en/hu/de már egyezik). Szó-mező érintetlen.

## ✅ FB54 [P2 adat], EN/ES szám-eltérés „Vegetables" ↔ „la verdura", KÉSZ (`data`)
Idézet (07-21, easy:Vegetables are healthy.): „vegetables akkor többes szám és akkor
las versuras nem?"
Kártya id 1061 (`la verdura`, comida). en többes „Vegetables" ↔ es kollektív egyes
„La verdura". **Döntés (2026-07-22): ES marad egyes (natív), a szótári kártyához
(`la verdura` egyes) igazodva**, a rövid ideig alkalmazott többes visszaállítva:
`La verdura es sana.` (hu „A zöldség egészséges."). Az en oldal marad természetes
többes. (FB53 `fruta fresca` már egyes = e policyval konzisztens, marad.)

## ✅ FB55 [P2 adat], „Mi edad es veinte años" nem természetes, KÉSZ (`data`)
Idézetek (2×):
- (07-16, easy:My age is twenty years.): „ezt így mondják?? ellenőrizd le! Szerintem
  Tengo x años a helyes, vagy mind a kettőt használják?"
- (07-21, sentence:Mi edad es veinte años.): „ketelyem van hogy ez igy helyes, nem
  tudom hogy használják e az angolok így, vagy ez csak spanyol át fordítás?"
Kártya id 1038 (`la edad`, presentacion). A user-nek igaza: a natív az életkort
`Tengo X años`-szal mondja, nem `Mi edad es X años` (utóbbi értelmes, de idegen).
A hu/de mezők MÁR természetesek voltak („Húsz éves vagyok." / „Ich bin zwanzig Jahre
alt."). Fix: es → `Tengo veinte años.`, en → `I am twenty years old.` (mind a 4 nyelv
így konzisztens + natív). Audit-tiszta (tengo/veinte/años tanított).

## ✅ FB56 [P1 adat], „Estoy casado desde hace dos años" túl nehéz A1-re, KÉSZ (`data`)
Idézetek (2×, easy:I have been married for two years.):
- (07-19): „ez sokkal nehezebb mondat mint aminek itt fel kellene jonni"
- (07-19): „ez túl nehéz még erre a szintre"
Kártya id 1256 (`casado/casada`, presentacion). A `desde hace + present perfect`
szerkezet A1 fölött van (mint FB33). Fix: leegyszerűsítve → es `Estoy casado.`,
en `I am married.`, hu `Házas vagyok.`, de `Ich bin verheiratet.`

## ✅ FB57 [P2 adat], „Delighted" ismeretlen/kitalálhatatlan EN szó, KÉSZ (`data`)
Idézet (07-21, sentence:Encantado de hablar contigo.): „dilaghted? vagy mi az a szó?
ilyen fordítása is van? az a baj, ez még nem jött elő és ezt soha nem találnám ki hogy
ez kell."
Kártya id 1045 (`encantado`, en-mező „pleased to meet you"). Az es helyes
(`Encantado de hablar contigo.`), csak az en fordítás obskúrus. Fix: en →
`Nice to talk with you.` (es/hu/de érintetlen).

## ✅ FB58 [P2 adat], „La fruta es naranja" kétértelmű (szín↔gyümölcs), KÉSZ (`data`)
Idézet (07-20, sentence:La fruta es naranja.): „ez forditva van nem?? ellenőrizd hogy
biztos jó."
Kártya id 1026 (`naranja` = narancssárga SZÍN, colores). A `naranja` szín is +
gyümölcs is → „La fruta es naranja" félreérthető (a gyümölcs narancssárga VS a
gyümölcs egy narancs). Fix: nem-gyümölcs alany → es `La casa es naranja.`
(en „The house is orange.", hu „A ház narancssárga.", de „Das Haus ist orange.").

## 📌 FB59 [info], „¿Dónde vives tú?", kell a „tú"?, NINCS TEENDŐ
Idézet (07-16, easy:Where do you live?): „ez így biztos jó? kell oda a tú?"
Kártya id 1032 (`tú vives`, presente_ir). A mondat SZÁNDÉKOSAN tartalmazza a „tú"-t,
mert a kártya épp a `tú vives` alakot tanítja (a névmás nyomatékosít, nyelvtanilag
helyes). FB8/FB47-minta: az adat helyes, nincs teendő.

## ✅ FB60 [P2 feature], Gépelős kártya: helyes szó kiírás + requeue, KÉSZ (`index.tsx`)
Idézet (07-19, word:to introduce): „ennél a típusnál, amikor le kell irni a szót, és
úgy küldi be a szót, a játékos, akkor írja ki a helyes szót, és tegye be a szot a szó
kártyák, közé újra."
**Döntés (2026-07-22, user „menjen"): csak ROSSZ válasznál, session-sor végére
requeue, Again-értékeléssel (nincs dupla-büntetés).** A „helyes szó kiírás" MÁR
megvolt: a revealed typing-blokk (`index.tsx` ~1187) rossznál is kiírja a teljes
`back` helyes alakot + FB25 per-karakter diff. Az egyetlen hiányzó rész a requeue
volt: rossz gépelt SZÓ-nál eddig `advance(Rating.Again)` = értékel + továbblép,
a szó csak SRS-due-n jött vissza, nem a session-pakliba.
Fix: új `gradeAgainBackground(item, startTime)` helper (advance SRS-írásai
optimista háttérben, index-léptetés NÉLKÜL, FB11/FB19-minta), és `handleTypingNext`
a rossz + `type==='word'` ágon `gradeAgainBackground(current, cardStartTime)` +
`requeueCurrent()` (a meglévő FB43/FB46 helper, a kártyát a sor végére teszi). A
mondat-gépelés (`type==='sentence'`) marad a sima `advance(Rating.Again)`. Egy
Again-írás / kör, nincs dupla-büntetés a retry-ért. tsc 0, jest 76/76.

## Elfogadási kritérium (FB52–FB60 forduló)
- `npx tsc --noEmit` 0 hiba ✅; `npx jest` zöld 76/76 ✅ (2026-07-22).
- `node scripts/audit-corpus.mjs` → P1=0 ✅ (az átírt mondatok tanított szókincs).
- `data/words/a1.json` parseable ✅; csak sentence-mezők változtak, id/es/topic érintetlen.
- ⏳ Eszköz-verify: a javított mondatok + FB60 feature-döntés.

## Korpusz-sweep (sentence-qa linter, 2026-07-22)
A 7 fix mintáiból új linter: `scripts/sentence-qa.mjs` + `/sentence-qa` skill
(5 osztály: NUM/COLL szám, HARD szint-feletti nyelvtan, AGE „edad es", OBSCURE
ritka EN, AMBIG szín↔tárgy). a0/a1/a2 söprés eredménye:
- **HARD/AGE/OBSCURE/AMBIG = 0**, a valódi bug-osztályok (FB55/56/57/58) sehol
  máshol nem ismétlődnek.
- NUM/COLL = 3 találat (#1077, #1490 `pantalón`; #702 `verdura`), **mind
  vocab-konzisztens egyes** → a fenti egyes-policyval helyesek, nincs teendő.
- A természetesen szám-eltérő ES főnevek (ropa, vacaciones, noticias, deberes,
  gente) a linterben `natural: true` = kiszűrve, sose flag.

---

# 📋 Feedback, 2026-07-24/27 forduló (v3.0.6 telefon-teszt, A1 en→es + stats-tab)

## ✅ FB61 [P1], „el arrroz", hármas betű a kamu variánsban, KÉSZ (`spellingVariants.ts`)
Idézet (07-24, recog:rice): „el arrroz ilyen szó nem létezik ilyet ne rakj bele sose
3 betű egymás mellett sosincs semmilyen nyelvbe"
Gyökérok: az `el arroz` már tartalmaz `rr`-t, és két él is triplázhat, a DOUBLABLE
'r' duplázása és az `r`→`rr` CONFUSIONS-csere. Fix: az `add()` szűrő eldob minden
variánst, amiben (fold után) 3 azonos betű áll egymás mellett, az FB51 dupla-
magánhangzó guard mintájára. Teszt: `el arroz`, `el perro`, `la calle`, `la acción`.
Megjegyzés: az FB64 után úgyis nincs futó fogyasztója, a guard a modul jövőbeni
újrahasznosítására marad bent.

## 📌 FB62 [info], „Desayuno un yogur natural.", adat HELYES, nincs teendő
Idézet (07-26, easy:I have a plain yogurt for breakfast.): „és hol van a Tengo meg
az egész ez kicsit furcsa mondat, vagy így használják a spanyolok?"
Kártya id 1750 (`el yogur`, comida). Igen, így használják: a `desayunar` maga jelenti
a „reggelire eszik" jelentést (nincs külön „tengo"), és a szó TANÍTOTT
(`data/words/a1.json`, `desayunar`), így az FB3-korpuszszabályt sem sérti,
`audit-corpus.mjs` P1=0. FB47/FB59-minta: az adat helyes, nincs teendő.

## ✅ FB63 [P2 feature], Mérföldkő-gratuláció a tanult nyelven, KÉSZ (`usageTimer.ts` + `UsageToast.tsx`)
Idézet (07-26, easy:I drink tea with honey.): „legyen már egy olyan szöveg hogy ha 30
perce használom az appot akkor egy waooooo 30 perce használod nagyon ügyes vagy vagy
valami hasonló menő szöveg olyan nyelven amilyen nyelven tanulok"
**Döntés (AskUserQuestion): mindkettő, több lépcső.** `usageTimer` új
`onUsageMilestone()` eseménye: `session` = 30 aktív perc EBBEN az app-futásban
(újraindítás nulláz), `daily` = 30 és 60 perc a mai összesenből. A napi lépcső a
perzisztált napösszeg pontos elérésére tüzel (az előző érték eggyel kisebb volt),
így naponta pontosan egyszer szól, app-újraindítás után is. Ehhez az
`addUsageMinute()` mostantól a nap új összegét adja vissza (`Promise<number>`,
SQLite + web impl is). A meglévő „+1 perc" pill viszi a szöveget: mérföldkőnél
zöld, szélesebb, 4 mp-ig áll, és a szöveg a TANULT nyelven megy
(`stringsFor(target)` az i18n-ben, nem a UI-nyelv). i18n ×4: `usage.milestoneSession`
/ `usage.milestoneDaily` `{min}` helyőrzővel.

## ✅ FB64 [P1 UX], A 4-opciós recog kártya KIVÉVE, KÉSZ (`index.tsx`)
Idézet (07-26, recog:the pepper): „az a baj, Itt hogy igazából csak kis elgépeléseim
vannak. Azt akarom, hogy ez a 4 es ne legyen benne, ezt írd ki. vedd ki ez egy
felesleges funkció valójában nem segít"
**Döntés (AskUserQuestion): teljes kivétel** (nem küszöb-emelés, nem near-miss
szűrés). Törölve `app/(tabs)/index.tsx`-ből: `RECOGNITION_AT`, `failsRef`,
`recogWrongPicks`, `recogResolved`, a `pickRecogRealWords` + `rng32` + `foldStr`
helyerek, a teljes recog render-blokk és a `recog*` stílusok. Rossz gépelésnél
mostantól marad a gépelős kártya + FB60 requeue, és az FB32 néma-felolvasás guard
is megszűnt (a válasz mindig felolvasásra kerül, nincs mit eltakarnia).
Nyugdíjazva, de a fájlok bent maradnak: `lib/spellingVariants.ts` (+ tesztjei) és a
`card.pickSpelling` i18n kulcsok, ha a mód valaha visszatér. Ezzel az FB44/45/48–51
recog-munka kikerül a futó kódútból.

## ✅ FB65 [P2 feature], Heti tanulási cél a statisztikában, KÉSZ (`stats.tsx` + `settings.tsx`)
Idézet (07-27, stats-tab): „legyen a statisztikába egy last 7day rész ami az összes
appban töltött időt mutatja, és legyen úgy hogy be kelljen állítani hogy hány órát
akarok spanyol tanulással tölteni. és legyen úgy hogy az elmúlt 7 napot nézze, azt
akarom, hogy mutassa ha lemegy ki írt cél. mert be akarom állítani 7 órára, és elérni
és túlszárnyalni"
A 7 napos összeg + napi bontás MÁR megvolt (`usage.thisWeek` + a last7Days chart),
az új rész a CÉL. Settings: „Heti tanulási cél" sor −/+ lépcsőzővel, 1 óra/lépés,
1–35 óra/hét, alap 7 óra (`DEFAULT_WEEKLY_GOAL_MINUTES = 420`). Tárolás:
`learn_settings.weekly_goal_minutes` (ALTER-migráció a régi DB-knek) + web-impl
tükör. Stats: új „Heti Cél" kártya, `4.2 / 7 óra` + progress bar +
állapotsor (`⚠️ Még X óra a célig` sárgával, `🏆 Heti cél teljesítve!` zölddel).
Tiszta logika: `weeklyGoalProgress()` a `lib/usageStats.ts`-ben (pct clamp, behind,
remaining), tesztelve. i18n ×4: `stats.weeklyGoal/goalProgress/goalBehind/goalReached`
+ `settings.weeklyGoal/weeklyGoalHours`.

## Elfogadási kritérium (FB61–FB65 forduló)
- `npx tsc --noEmit` 0 hiba ✅; `npx jest` zöld 82/82 ✅ (2026-07-28, 76→82: +1
  spellingVariants triple-guard, +2 usageTimer mérföldkő, +3 weeklyGoalProgress).
- `npx expo lint`: 18 probléma (8 error, 10 warning), a HEAD-alapvonal 18 (9 error,
  9 warning) volt, azaz nincs ÚJ hibaosztály (mind a régi `react-hooks/refs`
  animált-ref minta).
- `node scripts/audit-corpus.mjs` → P1=0 ✅ (adat nem változott ebben a fordulóban).
- ⏳ Eszköz-verify: recog eltűnése rossz gépelés után, mérföldkő-toast 30 percnél
  (spanyolul), heti cél állítás + a stats kártya lemaradás-jelzése.

---

# Aktuális feladatok (iter1.2)

Kimacha nyelvtanuló app (Expo/React Native).

**FONTOS — Adat struktúra:**
- Szókészlet: `data/words/a0.json` ... `data/words/c2.json` (szintenként külön JSON)
- Vizsga kérdések: `data/exams/a0.json` ... `data/exams/c2.json` (szintenként külön JSON)
- `data/words.ts` / `data/exams.ts` = csak type + import wrapper. NE IDE ÍRJ adatot, JSON-okat szerkeszd!
- Exam UI: `components/ExamMode.tsx` (külön komponens, NEM index.tsx-ben)
- Done screen: `components/DoneScreen.tsx` (külön komponens)

## ~~1. Szókészlet bővítés (#19)~~ — KÉSZ

402→615 szó. A0:100, A1:80, A2:80, B1:94, B2:84, C1:83, C2:92. Commit: `cda2b3d`

## ~~2. Vizsga kérdések A1-C2~~ — KÉSZ

A1: 30 kérdés, C2: 30 kérdés hozzáadva. Összes szint lefedve: A0(40), A1(30), A2(40), B1(40), B2(40), C1(40), C2(30). Commit: `3f20fd1`

## ~~3. Bugfixek (4 db)~~ — KÉSZ

3a TTS gomb, 3b await, 3c i18n exam.tag (4 nyelv), 3d Levenshtein dist≤2. Commit: `a31107c`

## ~~4. Magyar mondatok természetesítése~~ — KÉSZ

214 sentence_hu javítva (A0:16, A1:16, A2:22, B1:29, B2:48, C1:46, C2:37). Commit: `ea4cbe0`

## ~~5. Vizsga gate logika (#11)~~ — KÉSZ (már implementálva volt)

70% gate, 10 kérdés, 9/10 pass, getReviewedWordCount, DoneScreen progresszió — mind megvolt.

## ~~6. Könnyű mondat kártya típus (#16) — tap-to-order~~ — KÉSZ

`components/EasySentenceCard.tsx` + index.tsx integráció. Sentence reps=0 → easy (tap-to-order), reps>0 → hard (typing). Commit: `09dba29`

## ~~7. Nehéz mondat kártya típus (#16)~~ — KÉSZ

Typing branch kiterjesztve sentence típusra (reps>0). Levenshtein check (dist≤2). Commit: `cc8e1ab`

## 8. A1 Grammar Topic Content (FELADAT 0 — LEGMAGASABB PRIORITÁS)

**Token égetés elsőként EZT csinálja.** Meglévő A1 szavak törlendők, teljes újraírás.

### Mi a feladat

Generáld le az A1 szókészletet topic-ok szerint. 30 topic (~246 kártya): 16 grammar + 14 szókincs, keverve.
Grammar kártya = ragozott forma / nyelvtani elem + kontextus mondat.
Vocab kártya = szó (névelővel ha főnév) + kontextus mondat.

### Topic lista (VÉGLEGES sorrend — keverve)

**📗 Grammar topic-ok:**

| # | topic ID | Kártyák |
|---|----------|---------|
| 1 | presente_ar | yo hablo, tú hablas, él/ella habla, nosotros hablamos, ellos/ellas hablan |
| 3 | presente_er | yo como, tú comes, él come, nosotros comemos, ellos comen |
| 5 | presente_ir | yo vivo, tú vives, él vive, nosotros vivimos, ellos viven |
| 7 | ser | yo soy, tú eres, él es, nosotros somos, ellos son |
| 8 | estar | yo estoy, tú estás, él está, nosotros estamos, ellos están |
| 10 | tener | yo tengo, tú tienes, él tiene, nosotros tenemos, ellos tienen |
| 12 | ir_verb | yo voy, tú vas, él va, nosotros vamos, ellos van |
| 13 | hacer | yo hago, tú haces, él hace, nosotros hacemos, ellos hacen |
| 15 | ser_vs_estar | 8 mondatpár: "Soy alto"/"Estoy cansado", stb. — `es` = mondat, `hu` = fordítás |
| 17 | hay_vs_esta | 5 pár: "Hay un gato en la calle"/"El gato está en la mesa" |
| 19 | genero_numero | 8 db: el libro/los libros, la casa/las casas, el niño/la niña, stb. |
| 21 | posesivos | 6 db: mi, tu, su, nuestro, vuestro, su (plural) — mondatban |
| 23 | preposiciones | 8 db: en, de, a, con, por, para, entre, sin — mindegyik mondatban |
| 25 | interrogativos | 7 db: qué, quién, dónde, cuándo, cómo, cuánto, por qué |
| 27 | negacion | 4 db: no hablo, no tengo, no hay, no es — mondatban |
| 29 | gustar | 5 db: me gusta, te gusta, le gusta, nos gusta, me gustan |

**📘 Vocab topic-ok:**

| # | topic ID | db | Tartalom |
|---|----------|----|----------|
| 2 | numeros | 12 | seis, siete, ocho, nueve, diez, veinte, treinta, cuarenta, cincuenta, sesenta, cien, mil |
| 4 | colores | 8 | negro, blanco, amarillo, naranja, rosa, morado, gris, marrón |
| 6 | presentacion | 10 | bemutatkozás: el nombre, el apellido, la edad, la nacionalidad, el país, la dirección, el correo, llamarse, presentar, encantado |
| 9 | comida | 15 | el arroz, el pollo, la carne, el pescado, la fruta, la verdura, el pan, la sopa, el queso, el huevo, la cerveza, el vino, el zumo, la sal, el azúcar |
| 11 | ropa | 10 | la camisa, el pantalón, los zapatos, la falda, el vestido, la chaqueta, el abrigo, el sombrero, las gafas, el cinturón |
| 14 | casa | 10 | el salón, el dormitorio, el jardín, la escalera, el techo, el suelo, la pared, el armario, la nevera, la lavadora |
| 16 | cuerpo | 10 | la pierna, el brazo, la espalda, el dedo, la rodilla, el hombro, el cuello, la nariz, la boca, la oreja |
| 18 | restaurante | 10 | el menú, la cuenta, el camarero, pedir, reservar, el plato, el tenedor, el cuchillo, la cuchara, la propina |
| 20 | profesiones | 10 | el profesor, el estudiante, el policía, el bombero, el abogado, el ingeniero, la enfermera, el cocinero, el conductor, el vendedor |
| 22 | transporte | 10 | el tren, el avión, la estación, el billete, la parada, el metro, la bicicleta, el taxi, el aeropuerto, el puerto |
| 24 | clima | 8 | nublado, el viento, la tormenta, la nieve, hace calor, hace frío, llover, nevar |
| 26 | dias_meses | 19 | lunes→domingo (7) + enero→diciembre (12) |
| 28 | ciudad | 10 | la plaza, el museo, la farmacia, el supermercado, la iglesia, el parque, el puente, la biblioteca, el banco, correos |
| 30 | tiempo | 8 | el reloj, el minuto, la hora, el mediodía, la medianoche, temprano, tarde (adv), puntual |

### JSON formátum (SZIGORÚAN kövesd)

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

### ID szabály
- A1 ID-k: 1001-től indulnak (A0 = 1-100, A1 = 1001+)
- topicOrder: 1-től sorszám a topic-on belül

### Topic definíciók fájl

Generáld: `data/topics/a1.json` — MIND A 30 TOPIC, a fenti sorrendben (order = topic #).

```json
[
  {"id": "presente_ar", "order": 1, "type": "grammar", "name_hu": "Jelen Idő: -ar Igék", "name_en": "Present Tense: -ar Verbs", "name_es": "Presente: Verbos -ar", "name_de": "Präsens: -ar Verben"},
  {"id": "numeros", "order": 2, "type": "vocab", "name_hu": "Számok", "name_en": "Numbers", "name_es": "Números", "name_de": "Zahlen"},
  {"id": "presente_er", "order": 3, "type": "grammar", "name_hu": "Jelen Idő: -er Igék", "name_en": "Present Tense: -er Verbs", "name_es": "Presente: Verbos -er", "name_de": "Präsens: -er Verben"},
  {"id": "colores", "order": 4, "type": "vocab", "name_hu": "Színek", "name_en": "Colors", "name_es": "Colores", "name_de": "Farben"},
  {"id": "presente_ir", "order": 5, "type": "grammar", "name_hu": "Jelen Idő: -ir Igék", "name_en": "Present Tense: -ir Verbs", "name_es": "Presente: Verbos -ir", "name_de": "Präsens: -ir Verben"},
  {"id": "presentacion", "order": 6, "type": "vocab", "name_hu": "Bemutatkozás", "name_en": "Introductions", "name_es": "Presentación", "name_de": "Vorstellung"},
  {"id": "ser", "order": 7, "type": "grammar", "name_hu": "Ser (Létige: Identitás)", "name_en": "Ser (To Be: Identity)", "name_es": "Ser (Identidad)", "name_de": "Ser (Sein: Identität)"},
  {"id": "estar", "order": 8, "type": "grammar", "name_hu": "Estar (Létige: Állapot)", "name_en": "Estar (To Be: State)", "name_es": "Estar (Estado)", "name_de": "Estar (Sein: Zustand)"},
  {"id": "comida", "order": 9, "type": "vocab", "name_hu": "Étel és Ital", "name_en": "Food & Drinks", "name_es": "Comida y Bebida", "name_de": "Essen und Trinken"},
  {"id": "tener", "order": 10, "type": "grammar", "name_hu": "Tener (Birtokolni)", "name_en": "Tener (To Have)", "name_es": "Tener", "name_de": "Tener (Haben)"},
  {"id": "ropa", "order": 11, "type": "vocab", "name_hu": "Ruházat", "name_en": "Clothing", "name_es": "Ropa", "name_de": "Kleidung"},
  {"id": "ir_verb", "order": 12, "type": "grammar", "name_hu": "Ir (Menni)", "name_en": "Ir (To Go)", "name_es": "Ir", "name_de": "Ir (Gehen)"},
  {"id": "hacer", "order": 13, "type": "grammar", "name_hu": "Hacer (Csinálni)", "name_en": "Hacer (To Do/Make)", "name_es": "Hacer", "name_de": "Hacer (Machen)"},
  {"id": "casa", "order": 14, "type": "vocab", "name_hu": "Ház és Lakás", "name_en": "House & Home", "name_es": "Casa y Hogar", "name_de": "Haus und Wohnung"},
  {"id": "ser_vs_estar", "order": 15, "type": "grammar", "name_hu": "Ser vs Estar", "name_en": "Ser vs Estar", "name_es": "Ser vs Estar", "name_de": "Ser vs Estar"},
  {"id": "cuerpo", "order": 16, "type": "vocab", "name_hu": "Testrészek", "name_en": "Body Parts", "name_es": "Partes del Cuerpo", "name_de": "Körperteile"},
  {"id": "hay_vs_esta", "order": 17, "type": "grammar", "name_hu": "Hay vs Está", "name_en": "Hay vs Está", "name_es": "Hay vs Está", "name_de": "Hay vs Está"},
  {"id": "restaurante", "order": 18, "type": "vocab", "name_hu": "Étterem", "name_en": "Restaurant", "name_es": "Restaurante", "name_de": "Restaurant"},
  {"id": "genero_numero", "order": 19, "type": "grammar", "name_hu": "Nem és Szám", "name_en": "Gender & Number", "name_es": "Género y Número", "name_de": "Genus und Numerus"},
  {"id": "profesiones", "order": 20, "type": "vocab", "name_hu": "Foglalkozások", "name_en": "Professions", "name_es": "Profesiones", "name_de": "Berufe"},
  {"id": "posesivos", "order": 21, "type": "grammar", "name_hu": "Birtokos Névmások", "name_en": "Possessive Adjectives", "name_es": "Adjetivos Posesivos", "name_de": "Possessivpronomen"},
  {"id": "transporte", "order": 22, "type": "vocab", "name_hu": "Közlekedés", "name_en": "Transport", "name_es": "Transporte", "name_de": "Verkehr"},
  {"id": "preposiciones", "order": 23, "type": "grammar", "name_hu": "Elöljárók", "name_en": "Prepositions", "name_es": "Preposiciones", "name_de": "Präpositionen"},
  {"id": "clima", "order": 24, "type": "vocab", "name_hu": "Időjárás", "name_en": "Weather", "name_es": "Clima", "name_de": "Wetter"},
  {"id": "interrogativos", "order": 25, "type": "grammar", "name_hu": "Kérdőszavak", "name_en": "Question Words", "name_es": "Interrogativos", "name_de": "Fragewörter"},
  {"id": "dias_meses", "order": 26, "type": "vocab", "name_hu": "Napok és Hónapok", "name_en": "Days & Months", "name_es": "Días y Meses", "name_de": "Tage und Monate"},
  {"id": "negacion", "order": 27, "type": "grammar", "name_hu": "Tagadás", "name_en": "Negation", "name_es": "Negación", "name_de": "Verneinung"},
  {"id": "ciudad", "order": 28, "type": "vocab", "name_hu": "Város és Irányok", "name_en": "City & Directions", "name_es": "Ciudad y Direcciones", "name_de": "Stadt und Richtungen"},
  {"id": "gustar", "order": 29, "type": "grammar", "name_hu": "Gustar Szerkezet", "name_en": "Gustar Structure", "name_es": "Estructura Gustar", "name_de": "Gustar-Struktur"},
  {"id": "tiempo", "order": 30, "type": "vocab", "name_hu": "Idő és Óra", "name_en": "Time & Clock", "name_es": "Tiempo y Reloj", "name_de": "Zeit und Uhr"}
]
```

### Content szabályok
- `sentence_hu` = idiomatikus magyar, NEM tükörfordítás
- Mondatok CSAK jelen idő (A1 szint)
- Mondatok egyszerűek (max 8 szó), A0 szókincsből amennyire lehet
- ser_vs_estar és hay_vs_esta topic-oknál: `es` mező = teljes mondat (nem szó), `hu` = fordítás
- NE legyen duplikátum A0 szavakkal

### Fájl műveletek
1. Töröld meglévő `data/words/a1.json` tartalmát
2. Írd bele az új ~96 grammar kártyát
3. Hozd létre `data/topics/a1.json`-t (mkdir `data/topics/` ha nem létezik)
4. Commitolj: `feat: restructure A1 as grammar topics (16 topics, ~96 cards)`

### Elfogadási kritérium
- ✅ 30 topic (16 grammar + 14 vocab), mindegyikben az elvárt számú kártya
- ✅ Minden kártya: id, level, es, hu, en, de, topic, topicOrder, sentence_* (mind 4 nyelv)
- ✅ ID-k: 1001-től, folyamatosak
- ✅ topicOrder: 1-től, topic-on belül folyamatos
- ✅ Nincs A0 duplikátum
- ✅ Vocab topic-ok: főneveknél MINDIG névelő (el/la/los/las)
- ✅ `data/topics/a1.json` létezik, 30 entry, helyes order, `type` mező (grammar/vocab)
- ✅ JSON szintaktikailag helyes (parseable)
- ✅ ~246 kártya összesen

---

## ~~9. A1 Al-szintek — témakörök szintekre osztása~~ — KÉSZ (`abbe455`)

46 topic → 7 al-szint (A1.1–A1.7), subLevel mező + `data/sublevels/a1.json` +
4 helper a `topics.ts`-ben, header/DoneScreen progressz, al-szint-lezárás üzenet
4 nyelven. Unlock-logika változatlan. tsc tiszta (app-kód), jest 43/43.

**Cél:** Az A1 szint ma **46 témakör** lapos, egyetlen sorban (sequential unlock,
`computeUnlockedTopics` a `app/(tabs)/index.tsx:106`-ban). 46 egymás utáni topic
**áttekinthetetlen** és nincs benne mérföldkő-érzet. Csoportosítsuk a 46 topicot
**7 al-szintbe (A1.1 … A1.7)**, hogy a tanuló kis, lezárható egységekben haladjon,
és vizuálisan elkülönüljenek a témakörök.

**Mi NEM változik:** a topic-sorrend (`order` 1–46) és a szekvenciális unlock-logika
marad. Az al-szint csak **csoportosító + vizuális réteg** a meglévő topicok fölött.
A topicok unlock-ja továbbra is `order` szerint folytonos (A1.2 első topicja akkor
nyílik, amikor A1.1 utolsó topicja kész) — al-szint-határon nincs külön kapu, csak
**al-szint-lezárás ünneplés** (mint a topic-complete üzenet).

### Al-szint felosztás (VÉGLEGES — order szerint, ne csoportosítsd át)

| Al-szint | Topic order | Topicok | name_hu | name_en | name_es | name_de |
|----------|-------------|---------|---------|---------|---------|---------|
| **A1.1** | 1–6 | presente_ar, numeros, presente_er, colores, presente_ir, presentacion | Első Szavak | First Words | Primeras Palabras | Erste Wörter |
| **A1.2** | 7–13 | ser, estar, comida, tener, ropa, ir_verb, hacer | Létigék és Birtoklás | To Be & To Have | Ser, Estar y Tener | Sein und Haben |
| **A1.3** | 14–19 | casa, ser_vs_estar, cuerpo, hay_vs_esta, restaurante, genero_numero | Otthon és Test | Home & Body | Casa y Cuerpo | Haus und Körper |
| **A1.4** | 20–26 | profesiones, posesivos, transporte, preposiciones, clima, interrogativos, dias_meses | Emberek és Helyek | People & Places | Personas y Lugares | Menschen und Orte |
| **A1.5** | 27–33 | negacion, ciudad, gustar, tiempo, familia, emociones, verbos_reflexivos | Mindennapi Élet | Daily Life | Vida Cotidiana | Alltag |
| **A1.6** | 34–40 | animales, compras, verbos_cotidianos, adjetivos_basicos, hogar_actividades, salud, dinero_banco | Tevékenységek | Activities | Actividades | Aktivitäten |
| **A1.7** | 41–46 | ocio, viajes, oficina_trabajo, rutina_diaria, ir_a_inf, comparativos | Világ és Jövő | World & Future | Mundo y Futuro | Welt und Zukunft |

Összeg: 6+7+6+7+7+7+6 = **46 topic**, hézag nélkül lefedve.

### Adat-változás

**1. `data/topics/a1.json`** — minden topic-entry kap egy új `subLevel` mezőt
(string, pl. `"A1.1"`). A fenti tábla szerint. A `subLevel` az egyetlen új mező,
minden más (`id`, `order`, `type`, `name_*`) változatlan.

```json
{"id": "presente_ar", "order": 1, "subLevel": "A1.1", "type": "grammar", "name_hu": "Jelen Idő: -ar Igék", ...}
```

**2. Új fájl: `data/sublevels/a1.json`** — a 7 al-szint definíciója, sorrendben:

```json
[
  {"id": "A1.1", "order": 1, "name_hu": "Első Szavak", "name_en": "First Words", "name_es": "Primeras Palabras", "name_de": "Erste Wörter"},
  {"id": "A1.2", "order": 2, "name_hu": "Létigék és Birtoklás", "name_en": "To Be & To Have", "name_es": "Ser, Estar y Tener", "name_de": "Sein und Haben"},
  {"id": "A1.3", "order": 3, "name_hu": "Otthon és Test", "name_en": "Home & Body", "name_es": "Casa y Cuerpo", "name_de": "Haus und Körper"},
  {"id": "A1.4", "order": 4, "name_hu": "Emberek és Helyek", "name_en": "People & Places", "name_es": "Personas y Lugares", "name_de": "Menschen und Orte"},
  {"id": "A1.5", "order": 5, "name_hu": "Mindennapi Élet", "name_en": "Daily Life", "name_es": "Vida Cotidiana", "name_de": "Alltag"},
  {"id": "A1.6", "order": 6, "name_hu": "Tevékenységek", "name_en": "Activities", "name_es": "Actividades", "name_de": "Aktivitäten"},
  {"id": "A1.7", "order": 7, "name_hu": "Világ és Jövő", "name_en": "World & Future", "name_es": "Mundo y Futuro", "name_de": "Welt und Zukunft"}
]
```

### Kód-változás

**3. `data/topics.ts`:**
- `TopicDef` interfész: `subLevel: string` mező hozzáadva.
- Új `SubLevelDef` interfész: `{ id, order, name_hu, name_en, name_es, name_de }`.
- Import `data/sublevels/a1.json`, `subLevelsByLevel` map.
- Új helperek (a meglévő `getTopicsForLevel`/`getTopicName` mintájára):
  - `getSubLevelsForLevel(level): SubLevelDef[]`
  - `getTopicsForSubLevel(level, subLevelId): TopicDef[]` — order szerint
  - `getSubLevelName(sub, lang): string`
  - `getSubLevelForTopic(level, topicId): SubLevelDef | null`

**4. `app/(tabs)/index.tsx`** — fejléc + progressz (a `currentTopic` köré, ~519. sor):
- A `currentTopic` mellé számold ki az **aktuális al-szintet** (`getSubLevelForTopic`).
- Header mutassa: **al-szint név + topic-pozíció az al-szinten belül**, pl.
  „A1.2 · Létigék és Birtoklás — 3/7". (Eddig csak topic-név volt.)
- Al-szint-progressz: hány topic kész az al-szinten belül / összes az al-szinten.
- Amikor egy al-szint utolsó topicja elkészül → **al-szint-lezárás üzenet**
  (a meglévő `setTopicCompleteMsg` / topic-complete mintát kövesd, külön i18n kulccsal,
  pl. `subLevel.complete`). Ez plusz a topic-complete-hez, nem helyette.

**5. `components/DoneScreen.tsx`** — a topic-progressz (~50. sor) mellé/fölé az
al-szint-progressz is jelenjen meg (al-szint név + „X/Y topic kész ebben az al-szintben").

**6. i18n** — minden új string 4 nyelven (hu/en/es/de) a meglévő i18n fájlban
(keresd: `s.topic.complete`, `s.topic.progress` mintát — al-szint párjuk:
`s.subLevel.complete`, `s.subLevel.progress`).

### Elfogadási kritérium
- ✅ `data/topics/a1.json`: mind a 46 topic `subLevel` mezővel, a tábla szerint pontosan.
- ✅ `data/sublevels/a1.json`: 7 entry, helyes `order` 1–7, 4 nyelvű nevek.
- ✅ `data/topics.ts`: `SubLevelDef` + 4 új helper, `TopicDef.subLevel` mező.
- ✅ Unlock-logika (`computeUnlockedTopics`) **változatlan** — topic-szekvencia ugyanaz.
- ✅ Header az aktív al-szintet + topic-pozíciót mutatja (4 nyelven).
- ✅ DoneScreen al-szint-progresszt mutat.
- ✅ Al-szint-lezárás üzenet az al-szint utolsó topicja után (4 nyelven).
- ✅ `npx tsc --noEmit` hibátlan; JSON-ok parseable-ek.
- ✅ Web + Android nem törik (csak UI-réteg + adat-mező bővül).
- ✅ Commit: `feat: group A1 topics into 7 sub-levels (A1.1–A1.7)`

### Megjegyzés a jövőre
A2 (510 szó, folyamatban) és feljebb még **nincs** topic-struktúra. Ha A2 is
topic-osított lesz, ugyanez az al-szint-minta (`data/sublevels/a2.json` + `subLevel`
mező) újrahasználható — a `topics.ts` helperek már szint-paraméteresek.

---

## ~~10. A1 Topic Tech-Tree választó~~ — KÉSZ (`81e2fb5` + `337f521`)

> Sonnet agent implementálta a lenti spec szerint. Minden A1 topic szabadon
> választható az új Témák tab tech-tree képernyőjéről (7 tier, 46 egyedi emoji,
> gerinc+ág vonalak, állapot-keretek); választás perzisztens (db, web+native);
> header topic-sor + DoneScreen CTA → fa. `337f521`: al-szint-ünneplés a
> ténylegesen befejezett topic al-szintjét nézi. tsc app-kód 0 hiba, jest 43/43.
> ⏳ Vizuális eszköz-verify (web/telefon) nyitva.

**User-igény (FB9-ből éles):** „azt akarom, hogy témaköröket tudjak választani A1-en
belül hogy mit akarok tanulni … minden topic legyen választható de ne így listából
hanem valami izgalmas egyedi UI-al, nem akarom, hogy olyan legyen mint a Duolingo,
legyen valami egyedi ikonja minden listának és kicsit ilyen World of Tanks-os
tech-tree formátum legyen."

### Lényeg
1. A1-en belül **minden topic szabadon választható** (zár nincs) — a számok topic
   kihagyható, bármi tanulható bármilyen sorrendben.
2. Új **tech-tree képernyő**: 7 al-szint tier fentről le, topicok node-okként,
   összekötő vonalakkal — WoT tech-tree hangulat, NEM sima lista.
3. **Minden topicnak egyedi emoji ikonja** (lent a végleges 46-os map).

### Adat-változás

**1. `data/topics/a1.json`** — minden topic új `icon` mező (emoji string).
VÉGLEGES map (mind a 46, egyedi, ne térj el tőle):

| topic | icon | topic | icon |
|---|---|---|---|
| presente_ar | 🗣️ | negacion | 🚫 |
| numeros | 🔢 | ciudad | 🏙️ |
| presente_er | 😋 | gustar | ❤️ |
| colores | 🎨 | tiempo | ⏰ |
| presente_ir | 🌱 | familia | 👨‍👩‍👧 |
| presentacion | 🤝 | emociones | 😊 |
| ser | 🪪 | verbos_reflexivos | 🪞 |
| estar | 📍 | animales | 🐶 |
| comida | 🥘 | compras | 🛒 |
| tener | 🎒 | verbos_cotidianos | 🔁 |
| ropa | 👕 | adjetivos_basicos | ✨ |
| ir_verb | 🚶 | hogar_actividades | 🧹 |
| hacer | 🔨 | salud | 🩺 |
| casa | 🏠 | dinero_banco | 💰 |
| ser_vs_estar | ⚖️ | ocio | 🎮 |
| cuerpo | 💪 | viajes | ✈️ |
| hay_vs_esta | 🔎 | oficina_trabajo | 💼 |
| restaurante | 🍽️ | rutina_diaria | 🌅 |
| genero_numero | 🔠 | ir_a_inf | 🔮 |
| profesiones | 👮 | comparativos | 📊 |
| posesivos | 🔑 | | |
| transporte | 🚆 | | |
| preposiciones | 🧭 | | |
| clima | ⛅ | | |
| interrogativos | ❓ | | |
| dias_meses | 📅 | | |

**2. `data/topics.ts`** — `TopicDef.icon: string` mező.

### Unlock-változás (szabad választás)

**3. `app/(tabs)/index.tsx`** — `computeUnlockedTopics` A1-re: `unlocked` = MINDEN
topic (zár nincs). A függvény szignatúra/fallback más szintekre maradjon.
**4. Kiválasztott topic state + persist:** új `selectedTopic` (topic id), úgy
perzisztálva, ahogy a level (nézd meg a `db.getLevel`/`setLevel` mintát —
`lib/database.ts` ÉS `lib/database.web.ts` MINDKETTŐ!). Aktív topic =
`selectedTopic` ha van és nem kész; különben első nem-kész topic order szerint
(mai default viselkedés).
**5. Topic kész → user válasszon újat:** DoneScreen-en és topic-complete után CTA
a fa-képernyőre („Válassz új témát"). A queue a kiválasztott topic szavaiból épül
(a meglévő logika aktív-topic-ra már ezt csinálja).
**6. Al-szint-lezárás üzenet javítás:** szabad sorrendnél a „closesSubLevel” nem
lehet „az al-szint utolsó topicja” — helyette: az al-szint MINDEN topicja kész-e
a most befejezettel együtt (repsMap alapján).

### Tech-tree képernyő

**7. Új tab: `app/(tabs)/tree.tsx`** (tab-cím i18n: hu „Témák” / en „Topics” /
es „Temas” / de „Themen”, tab-ikon a meglévő tab-bar mintájára):
- Függőleges ScrollView, 7 al-szint tier fentről lefelé, sorrendben.
- Tier-fejléc: al-szint id + név (4 nyelven, `getSubLevelName`) + al-szint
  progressz (kész topicok / összes).
- Topicok 2-3 oszlopos node-rácsban a tier alatt; tier-ek közt központi
  függőleges „gerinc” vonal + node-okhoz ág-csonkok — sima `View` border-ekkel
  rajzolva, NE vegyél fel svg dependenciát.
- **Node:** nagy emoji ikon (a fenti map) + topic-név (4 nyelvű, `getTopicName`)
  + szó-progressz (tanult/összes a repsMap-ből). Állapot-stílusok:
  - kész (minden szó reps>0): arany/zöld keret + ✓
  - folyamatban: kék keret
  - el nem kezdett: szürke, halvány
  - aktuálisan kiválasztott: kiemelt (vastag accent keret)
- Grammar topic = zöld accent (#22C55E), vocab = kék (#38BDF8) — meglévő színkód.
- **Tap node** → topic kiválasztás (persist) + átnavigál a Learn tabra, queue újraépül.
**8. `app/(tabs)/index.tsx` header:** a topic-név sor tap-elhető → tree tab.
**9. i18n:** minden új string 4 nyelven (tab cím, „Válassz új témát", progressz).

### Elfogadási kritérium
- Minden A1 topic szabadon választható a fáról; számok kihagyhatók.
- 46 egyedi emoji ikon a fán és a fejlécben.
- Al-szint tier-ek látszanak, vonalak kötik össze — tech-tree, nem lista.
- Választás perzisztens (app-újraindítás után megmarad), web + android egyaránt.
- Topic kész → felajánlja az új választást; al-szint-üzenet szabad sorrendnél is jó.
- `npx tsc --noEmit`: app-kódban 0 új hiba; `npx jest` zöld; web + android fut.
- Commit: `feat: A1 topic tech-tree picker (free topic choice)`

### Szabályok
- NE nyúlj más feature-höz; smallest diff; meglévő stílus.
- A0 (nem topic-os szint) viselkedése változatlan.

---

## 11. Korpusz-audit — mondat csak tanított szóból (FB3 teljes audit) — ⚠️ STOP: P1=373 > 150, audit script KÉSZ (eee968e), javítás: ember dönt

**User-igény (FB3):** szó ne szerepeljen mondatban, mielőtt kártyaként tanítva lett
volna („choir" eset). Cél: minden A0+A1 `sentence_es` CSAK olyan tartalmas szót
használjon, ami valamelyik kártya `es` mezőjében tanítva van.

### 11a. Audit script

Új fájl: `scripts/audit-corpus.mjs` — Node, **zero dependency**, futtatás:
`node scripts/audit-corpus.mjs`. Logika:

1. Betölt: `data/words/a0.json`, `data/words/a1.json`, `data/topics/a1.json`.
2. **Tanított ES tokenkészlet**: minden kártya `es` mezője tokenizálva (lowercase,
   írásjel le, ékezet MARAD), többszavas entry („yo hablo", „la casa") szavanként.
   Minden tokenhez jegyezd fel, melyik szinten + topic-orderben lett bevezetve
   (legkorábbi előfordulás).
3. **Glue-whitelist**: csak valódi funkciószavak, amik NINCSENEK a szókincsben
   (a script elején konstans tömb, kommenttel). Származtasd: először futtasd
   whitelist nélkül, és ami funkciószó (névelő, névmás, elöljáró, kötőszó,
   segédige-alak) kibukik, azt vedd fel. Tartalmas szó (főnév/ige/melléknév/
   határozó) NEM kerülhet whitelistre.
4. **Ragozás-tolerancia (konzervatív):** token elfogadott, ha (a) pontos egyezés;
   (b) plural/gender variáns (+s/+es; szóvégi o↔a); (c) ige-alak: ha van tanított
   token ugyanazzal a ≥4 betűs tővel és mindkettő ismert ES igevégződésű
   (-o/-as/-a/-amos/-an/-es/-e/-emos/-en/-imos stb.). Kétes eset = NEM match
   (inkább false positive a reportban, mint csendben átengedett hiba).
5. **Ellenőrzés kártyánként:**
   - A0 kártya: `sentence_es` tokenjei ⊆ (A0 tanított készlet ∪ whitelist).
   - A1 kártya: ⊆ (A0 ∪ A1 tanított ∪ whitelist), és osztályozz:
     - **P1** = token SEHOL nincs tanítva (A0+A1 egészében sem) → javítandó.
     - **P2** = token tanítva van, de KÉSŐBBI topic-orderben, mint a kártya
       topicja → csak report (Task 10 óta a topic-sorrend szabad, ezért P2
       nem hiba, csak statisztika).
6. **Report**: `scripts/audit-report.md` — összesítő tábla (topic szerint:
   P1/P2 darab), majd P1 lista soronként: kártya id, topic, `sentence_es`,
   hiányzó token(ek). P2-ből csak top-20 leggyakoribb token.

### 11b. P1 javítások

- **Ha P1-es mondat ≤ 150 db:** írd át őket. Szabályok:
  - CSAK a `sentence_es`/`sentence_hu`/`sentence_en`/`sentence_de` mező változik
    (mind a 4 EGYÜTT, jelentés-konzisztensen); `es`/`hu`/`en`/`de` szó-mezőkhöz,
    id-hez, topic-hoz NE nyúlj.
  - Az új mondat tartalmazza a kártya saját szavát (a mondat azt illusztrálja!),
    max 8 szó, csak jelen idő, csak tanított szókincsből (audit-script ellenőrzi).
  - `sentence_hu` idiomatikus magyar, nem tükörfordítás.
- **Ha P1 > 150 db:** STOP a report után, NE írj át tömegesen — jelezd a
  zárójelentésben, ember dönt.

### 11c. Elfogadási kritérium

- `node scripts/audit-corpus.mjs` lefut, reportot ír; javítás után **0 db P1**.
- JSON-ok parseable-ek, mezősorrend megmarad, semmi más mező nem változik.
- `npx jest` zöld (43 teszt). ⚠️ Ismert flaky: `examBuilder.test.ts` „never repeats
  a prompt" ~1/6 arányban bukik (pre-existing, user-döntés: NEM javítjuk) — ha
  csak ez bukik, futtasd újra, és NE nyúlj hozzá.
- `npx tsc --noEmit` hibaszám nem nő (baseline 87, mind pre-existing teszt-glob hiba).
- Commit kettőben: `chore(audit): corpus audit script + report` és
  `fix(content): rewrite sentences using untaught vocab (FB3 audit)`.
- AGENTS.md-ben ezt a szekciót jelöld KÉSZ-re (cím elé ✅ + commit hash).

### Szabályok (11. feladat)

- Smallest diff; máshoz NE nyúlj (se examBuilder, se distractors, se UI).
- A flaky jest teszt és a 109 pre-existing cross-level dup NEM a te dolgod.

---

## 12. ✅ KÉSZ Tech-tree választás érvényesítése (Task 10 follow-up bugfix) — cc6a033

**Web-verify 2026-06-11 (Playwright, en→es, A1) találata:** a fa-képernyőn topic-ra
koppintás után a Learn tab VÁLTOZATLAN marad (header: első topic, kártya: `yo hablo`).
A választás db-be íródik, de soha nem érvényesül. Három hiba:

### 12a [P1] — Learn nem tölt újra topic-választás után

Gyökérok: `app/(tabs)/index.tsx` — `loadCards()` csak mountkor fut (`useEffect [] `,
~234. sor); a `useFocusEffect` (~240. sor) csak `consumePendingAction()`-t kezel,
és topic-választásra nincs pendingAction. A tabok mountolva maradnak (expo-router),
így fókusz-visszatéréskor semmi nem olvassa újra a `selectedTopic`-ot — natívon is!

**Fix a meglévő idiómával (FB10 `setLevel` mintája):**
- `lib/pendingAction.ts`: új action `{ type: 'selectTopic' }` (payload nem kell,
  a topic id már a db-ben van).
- `app/(tabs)/tree.tsx` `handleSelectTopic`: a `db.setSelectedTopic(...)` után
  állítsa be ezt a pendingAction-t, csak utána `router.push('/')`.
- `index.tsx` `useFocusEffect`: új ág — `selectTopic` esetén `await loadCards()`
  (exam state-hez ne nyúljon).
- `components/DoneScreen.tsx` CTA-útvonal is ugyanígy érvényesüljön (a fa-képernyőn
  át megy, tehát a fenti lefedi — ellenőrizd).

### 12b [P1] — Queue nem a választott topicból építkezik

Gyökérok: `index.tsx` ~190. sor — `activeWords = unlocked.flatMap(...)` = A1-en mind
a 800 szó; a `db.getDueCardsForWordIds(activeWordIds, 10)` az új (sosem látott)
kártyákat id-sorrendben adja → mindig az 1. topic (`presente_ar`) szavai jönnek,
bárhova koppint a user.

**Elvárt viselkedés** (`activeTopic` = a `computeUnlockedTopics` által visszaadott):
- ÚJ (reps=0, sosem reviewolt) kártya CSAK az `activeTopic` szavaiból kerüljön a
  queue-ba, amíg az activeTopic nem komplett.
- Esedékes ISMÉTLÉSEK (reps>0) továbbra is BÁRMELY unlocked topicból jöjjenek
  (FSRS-integritás — review sose vesszen el azért, mert más topic van kiválasztva).

**Javasolt minimál-implementáció** (~190. sor, useTopics ágban):
```ts
activeWords = activeTopic
  ? [
      ...getWordsForTopic(currentLevel, activeTopic.id),
      ...unlocked
        .filter(t => t.id !== activeTopic.id)
        .flatMap(t => getWordsForTopic(currentLevel, t.id))
        .filter(w => (repsMap.get(w.id) ?? 0) > 0),
    ]
  : unlocked.flatMap(t => getWordsForTopic(currentLevel, t.id));
```
Ha a `getDueCardsForWordIds` rendezése miatt az új kártyák mégsem az activeTopic-ból
jönnének először, nézd meg a db-implementációkat (`lib/database.ts` ÉS
`lib/database.web.ts` — mindkettő!), és ott biztosítsd, hogy új kártyáknál a
bemeneti id-lista sorrendje (vagy topic-tagság) érvényesüljön. A `ensureCard` ciklus
(~197. sor) maradjon a teljes `activeWords`-ön.

### 12c [P2] — Hardcoded „szó" a Master modalban

`app/(tabs)/settings.tsx:107`: `` `${wordCount} szó` `` — magyar string minden UI-nyelven.
Fix: i18n kulcs a meglévő `s.*` minta szerint (pl. `s.master.wordCount(n)`),
4 nyelven: hu `${n} szó` / en `${n} words` / es `${n} palabras` / de `${n} Wörter`.

### Scope-megjegyzés

A web MemoryDB-ben SEMMI nem éli túl az oldal-újratöltést (level se) — ez
pre-existing web-limitáció, NEM ennek a feladatnak a része. A „persist" webnél
session-en belüli; telefonon (SQLite) teljes.

### Elfogadási kritérium (12)

- Weben (expo web): fa → tetszőleges topic (pl. Días y Meses) koppintás → Learn
  headerben AZ a topic + al-szintje látszik, és az első új kártya abból a topicból
  jön (pl. `lunes`), NEM `yo hablo`.
- Másik topic választása útközben: új kártyák onnan folytatódnak; korábban
  megkezdett szavak review-i továbbra is megjelennek.
- A0 (nem topic-os) viselkedés változatlan; exam-flow változatlan.
- `npx tsc --noEmit` hibaszám nem nő (baseline 130, mind pre-existing); `npx jest`
  zöld (43) — ismert flaky `examBuilder` „never repeats a prompt": ha csak az bukik,
  újrafuttat, NEM javít.
- Commit: `fix(tree): apply selected topic to learn queue + reload on focus`
  (12c mehet ugyanebbe vagy külön `fix(i18n): master modal word count` commitba).
- E szekció címét jelöld ✅ KÉSZ-re commit hash-sel.

---

## ✅ 13. Korpusz-audit v2 — tolerancia-finomítás + akcióterv (FB3 hibrid, fázis 1) — KÉSZ

> **Állapot 2026-06-12:** KÉSZ. P1: 373→286 (A0:0, A1:286). Draft hibák javítva
> (`dar`→`['dam']`, `ver`→`['vem']`, `despiiert`→`despert`). Három rule (proper
> noun, apocope, irregular paradigm) bekötve. `scripts/audit-plan.md` generálva
> (ADD_CARD:94, REWRITE:102 token). 12 A0 mondat átírva. Jest 43/43 ✅, tsc ≤130.
> Commitok: `62be1c8` (audit v2 + plan) · `6f32f76` (A0 rewrites)

**Döntés (Kálmán, 2026-06-11): hibrid stratégia** a 11. feladat 373 P1-jére:
artefaktok kiszűrése → valódi hiányzó szavak ÚJ KÁRTYÁNAK (A1) → maradék mondat
átírva. Ez a feladat a fázis 1 (script + terv + A0 átírások); az új A1 kártyák
legenerálása KÜLÖN feladat lesz (Opus írja a tartalmat, ne kezdd el!).

### 13a. Audit-tolerancia finomítás (`scripts/audit-corpus.mjs`)

A 11-es audit ~100+ ál-P1-et ad. Bővítsd a match-logikát (KONZERVATÍVAN, minden
új szabály kommenttel):
1. **Tulajdonnevek**: nagybetűs token mondat belsejében (nem mondatkezdő) VAGY
   ismert hely/név lista (Madrid, España, Ana, Juan, stb. — gyűjtsd ki a reportból)
   → elfogadott. Mondatkezdő pozícióban óvatosan: csak ha a listán van.
2. **Apocope-párok**: buen↔bueno, gran↔grande, mal↔malo, primer↔primero,
   tercer↔tercero, algún↔alguno, ningún↔ninguno — elfogadott, HA a teljes alak
   tanított.
3. **Tanított igék rendhagyó alakjai**: ha egy ige BÁRMELY alakja/infinitívusza
   tanított (pl. `poder` v. `puede` kártya létezik), akkor a paradigma többi
   gyakori jelen idejű alakja (puedo, puedes, pueden…) elfogadott. Implementáció:
   kis kézi map a reportban felbukkanó rendhagyó párokra (poder→pued-, venir→ven/vien-,
   tener→tien-, querer→quier-, empezar→empiez-, dormir→duerm-, sonar→suen- stb.),
   CSAK tanított lemmákra.
4. **Rövid tövek**: -ar/-er/-ir tanított ige ≥3 betűs tővel (pasar→pasa, ver→ven NEM
   — ven az venir!) — tő+ismert végződés match már 3 betűs tőre is, DE csak ha a
   tő pontosan egyezik és a tanított szó igealak/infinitívusz.
5. Számnevek: ha `dos`/`tres`/`cuatro`/`cinco` stb. tényleg NINCS kártyaként sehol
   (A0-ban se), azok NEM artefaktok — maradjanak P1-ben (kártya kell majd).

### 13b. Akcióterv-generálás

Audit újrafuttatás után a script (vagy külön `scripts/audit-plan.mjs`) írjon
`scripts/audit-plan.md`-t: a megmaradt P1 tokenek EGYEDI listája, tokenenként:
- előfordulás-szám + érintett kártya-id-k,
- szint (A0 mondatban / A1 mondatban fordul elő),
- javasolt akció: **ADD_CARD** (A1, célzott topic-javaslattal: coche→transporte,
  verano/invierno→clima, años→presentacion v. tiempo, rico→comida, dos→numeros stb.)
  VAGY **REWRITE** (ha a szó ritka/nem A1-szintű, v. csak 1-2 mondatban szerepel).
- A terv VÉGÉN összesítő: hány ADD_CARD jelölt, hány REWRITE-mondat, A0/A1 bontásban.

### 13c. A0 mondat-átírások

Az A0 szint 100 szava FIX (nem bővítjük!). Az A0 kártyák P1-es mondatait írd át a
11b szabályai szerint (4 nyelv együtt, kártya saját szava benne marad, max 8 szó,
jelen idő, csak tanított A0 szókincs + whitelist). Várhatóan kevés (~10-30 mondat).
A1 mondathoz NE nyúlj ebben a feladatban!

### Elfogadási kritérium (13)

- Audit v2 fut; P1 szám jelentősen csökken (cél: az artefaktok eltűnnek; a riport
  immár csak valódi hiányokat listáz). `scripts/audit-report.md` frissül.
- `scripts/audit-plan.md` létezik, minden megmaradt P1 tokenre akció + indoklás.
- A0: 0 P1 (átírások után), a0.json továbbra is pontosan 100 kártya.
- JSON-ok parseable-ek; `npx jest` zöld (43; flaky examBuilder-szabály érvényes);
  `npx tsc --noEmit` ≤ 130 hiba.
- Commitok: `chore(audit): refine tolerance + action plan (FB3 v2)` és
  `fix(content): rewrite A0 sentences to taught vocab (FB3)`.
- E szekció címét jelöld ✅ KÉSZ-re commit hash-ekkel.

---

## ✅ 14. Hiányzó A1 kártyák generálása (FB3 hibrid, fázis 2) — KÉSZ (`1e8e3f7`, Opus)

> 82 kártya (id 1811–1892, 22 topic), 0 új P1 a kártya-mondatokból; paradigma-map
> +8 lemma; vegyes szám/nem-variáns szabály (rojo→rojas). P1 286→118. jest 43/43,
> tsc 130 baseline, a1.json 882 kártya.

A 13-as `scripts/audit-plan.md` 94 ADD_CARD tokenjéből lemma-dedupe után **82 új
kártya** (id 1811–1892), 22 meglévő topicba elosztva, topicOrder a topic végére
fűzve. Kiesett a kártya-listából: `rojas` (rojo tanított — tolerancia-ügy),
`llueve` (llover tanított — paradigma-entry), `bus` (→ REWRITE, Task 15-ben
autobús-ra írandó); igealakok lemmára vonva (llevo+lleva→llevar stb.); ritka
tokenek multi-word kártyában tanítva (fin→`el fin de semana`, veces→`a veces`,
patatas+fritas→`las patatas fritas`, oliva→`el aceite de oliva`).
Audit-infra kiegészítés: IRREGULAR_PARADIGM_MAP += llover/doler/volar/encender/
encontrar/empezar/sonar + `dar`-hoz `da` alak.
Acceptance: audit P1 jelentősen csökken, új kártya-mondatok 0 új P1-et hoznak;
jest zöld; a1.json parseable, 882 kártya.

---

## ✅ 15. Maradék P1 mondatok átírása (FB3 hibrid, fázis 3) — KÉSZ (`da01fe9`)

> **Állapot 2026-06-12:** KÉSZ. 118 mondat átírva, P1: 118→0, P2: 0. Jest 43/43 ✅, tsc 130 baseline.

A 14-es után **118 P1 kártya-issue** maradt (futtasd: `node scripts/audit-corpus.mjs`,
lista a `scripts/audit-report.md`-ben) — ezek a REWRITE-osztály: a mondat ritka /
nem-A1 szót használ, amit NEM veszünk fel kártyának.

### Feladat

Írd át az ÖSSZES maradék P1-es A1 mondatot a 11b szabályai szerint:
- CSAK a 4 `sentence_*` mező változik (es/hu/en/de EGYÜTT, jelentés-konzisztens);
  `es`/`hu`/`en`/`de` szó-mezők, id, topic, topicOrder érintetlen.
- Az új mondat tartalmazza a kártya saját szavát; max 8 szó; jelen idő;
  csak tanított szókincs (audit-script a bíró); `sentence_hu` idiomatikus.
- `bus` token: a mondatban `el autobús`-ra cseréld (autobús tanított).
- Számjegyes tokenek (`5`, `123`, `678`): írd át betűvel tanított számra, vagy
  hagyd el a mondatból (telefonszám-jellegű mondatnál egyszerűsíts).
- Ha egy mondat több P1 tokent tartalmaz, egyben írd át.

### Elfogadási kritérium (15)

- `node scripts/audit-corpus.mjs` → **0 P1** (és 0 P2).
- a1.json parseable, 882 kártya, mezősorrend megmarad.
- `npx jest` zöld (43; flaky examBuilder-szabály érvényes); `npx tsc --noEmit` ≤130.
- Commit: `fix(content): rewrite remaining A1 sentences to taught vocab (FB3 final)`.
- E szekció címét jelöld ✅ KÉSZ-re commit hash-sel.

---

## 16. Kártyatípus-kadencia 10:2:1 + „Csak szavak" mód (FB13 + FB14) — ✅ KÉSZ (`ba5e8c0`, `1093c3c`)

**Döntések (Kálmán, 2026-06-14, AskUserQuestion):**
- FB14 kadencia → **az ALAP queue-t módosítjuk** (nem külön mód): mindenki a 10:2:1
  arányt kapja.
- Kadencia → **pontos, fix 10:2:1 sorrend**: 10 szó-kártya, 2 mondat-összerakós
  (easy/tap-to-order), 1 mondat-gépelős (typing), majd ismétlődik.
- FB13 → **„Csak szavak" kapcsoló** + **EN→ES gépelés** (anyanyelvi szó → tanult
  nyelven beírni) ebben a módban, MOST.

### Adat-/perzisztencia réteg (mindkét DB fájl + interfész!)

A `selected_topic` mintát másold (per-pair tárolás):
1. `lib/database.ts` — séma: új tábla
   `CREATE TABLE IF NOT EXISTS learn_settings (pair TEXT PRIMARY KEY, words_only INTEGER);`
   (a `selected_topic` CREATE mellé, ~107. sor). Metódusok a `getSelectedTopic`/
   `setSelectedTopic` (411–420) mintájára:
   `async getWordsOnly(): Promise<boolean>` (row?.words_only === 1, default false),
   `async setWordsOnly(v: boolean): Promise<void>` (INSERT OR REPLACE, v?1:0).
2. `lib/database.web.ts` — ugyanez a két metódus a web-MemoryDB mintájára
   (memóriabeli mező, mint a selectedTopic web-megfelelője). **Web nem perzisztál
   reload után — ez ismert limitáció, OK.**
3. `IDatabase` interfész (database.ts ÉS database.web.ts is): `getWordsOnly`/
   `setWordsOnly` aláírás hozzáadva.

### Queue: 10:2:1 kadencia (`app/(tabs)/index.tsx`)

**`buildQueue` (75–108):** változatlan marad a típus-tagelés (word / sentence;
`isEasySentence = sentence && reps===0`, sentence `isTyping = reps>0`).

**Új helper `applyCadence(items: DueItem[], wordsOnly: boolean): DueItem[]`:**
- Ha `wordsOnly`: csak a `type==='word'` itemek; mindegyiken **kényszerítsd**
  `isTyping=true`, `typingDirection='native-to-learned'` (EN→ES gépelés). Sorrend
  marad. Return.
- Egyébként particionálj 3 vödörbe a beépített sorrendet megőrizve:
  - `words` = `type==='word'`
  - `easy` = `type==='sentence' && isEasySentence` (reps0, összerakós)
  - `typing` = `type==='sentence' && isTyping` (reps>0, gépelős)
  Majd ismétlődő egységekben fűzd össze: minden egységben a vödrök elejéről
  `words` max 10, `easy` max 2, `typing` max 1 (amennyi van). Ismételd, amíg
  mindhárom ki nem ürül. Ha a `words` kifogy, a maradék `easy`+`typing` a végére
  fűzve (ne vesszen el due ismétlés).

**Pool méret:** a `getDueCardsForWordIds(..., 10)` / `getDueCardsForLevel(..., 10)`
limitet emeld **40-re** (egy konstans, pl. `const QUEUE_POOL = 40;`), hogy elférjen
pár teljes 13-as egység. Két hely: `loadCards` (223–225) ÉS `advance` queue-vég
rebuild (a `getDueCardsForWordIds(activeWordIds, 10)` / `getDueCardsForLevel`
sorok).

**Alkalmazás:** ahol ma `const items = buildQueue(rows)` (loadCards ~226) és
`const newItems = buildQueue(newRows)` (advance rebuild), oda:
`applyCadence(buildQueue(rows), wordsOnly)`. A `wordsOnly`-t a loadCards elején és a
rebuildben is olvasd ki (`await db.getWordsOnly()`).

### „Csak szavak" kapcsoló UI (`app/(tabs)/settings.tsx`)

Az FB10 szint-/mester-szekció mintájára egy **kapcsoló sor** (RN `Switch` vagy a
meglévő gomb-stílus): label = i18n `s.settings.wordsOnly` (lásd lent). Bekapcsolás:
`await db.setWordsOnly(v)` → `setPendingAction({ type: 'selectTopic' })` (a meglévő
reload-akciót újrahasználjuk, ami `loadCards()`-t hív, index.tsx 272–277) →
`router.push('/')` (vissza a Learn-re). Helyezd a Master/Szint blokk közelébe.

### index.tsx state

Új `wordsOnly` state nem feltétlen kell a renderhez (a queue már szűrt). De a
kadencia/typing a queue-ban dől el, ezért elég a `loadCards`/rebuild-beli olvasás.
Ha a fejléchez kell jelzés („Csak szavak" badge), az opcionális — NE bővítsd, ha nem
muszáj (smallest diff).

### i18n (mind a 4 nyelv: hu/en/es/de)

Új kulcs(ok) a `settings` blokkba (vagy ahol a master-stringek vannak):
- `wordsOnly`: hu „Csak szavak" / en „Words only" / es „Solo palabras" / de „Nur Wörter".
- opcionális rövid leírás kulcs, ha a UI igényli.

### Elfogadási kritérium (16)

- Alap tanulásban a kártyák sorrendje 10 szó → 2 összerakós → 1 gépelős → ismétlődik
  (amennyire a due-készlet engedi); ha kevés a mondat, a szavak dominálnak, due
  ismétlés nem vész el.
- „Csak szavak" BE → kizárólag szó-kártyák, mind EN→ES gépelős (anyanyelv elöl,
  tanult nyelvet kell beírni); a `handleCheck` a tanult alakra ellenőriz (már így
  működik, `getFrontBack` + `back.split(' / ')[0]`).
- A kapcsoló perzisztens telefonon (SQLite); weben session-szintű (ismert limit).
- A0 (nem-topic szint) is kapja a kadenciát (a queue-réteg szint-független).
- `npx tsc --noEmit` ≤ 130 (baseline, ne nőjön); `npx jest` zöld (43; flaky
  examBuilder szabály: ha csak az bukik, újrafuttat, NEM javít).
- Commit(ok): `feat(learn): 10:2:1 card cadence` és `feat(learn): words-only mode
  (EN→ES typing)` (vagy egyben), külön a DB-réteg ha tisztább.
- E szekció címét jelöld ✅ KÉSZ-re commit hash(ek)kel.

### Szabályok (16)
- Smallest diff; a meglévő SRS-perzisztálást (advance optimista ág, FB11) NE törd.
- `database.ts` ÉS `database.web.ts` MINDKETTŐ frissül (interfész-szinkron).
- Ne nyúlj a distractor/exam logikához.

---

## Szabályok
- Commitolj minden feladat után külön
- i18n: minden szöveg 4 nyelven (hu, en, es, de)
- Title Case gomb labeleken
- NE nyúlj más feature-höz, CSAK ami itt le van írva
