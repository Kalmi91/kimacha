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

# 📋 Feedback, 2026-07-28/30 forduló (v3.0.6 telefon-teszt, A1 en→es + stats/settings)

Új sorok a `Kimacha Feedback` sheetből (FB65 utáni 15 sor, 07-28 09:51 → 07-30 18:19).
Triage 2026-07-30 (Opus). Döntések AskUserQuestion-nel pinnelve: **info-gomb =
HIBRID** (auto-szabály + kézi note, és ahol valódi nyelvtani szabály van, ott az
ellenőrzött szabály szövege); **nehéz téma = napi új-szó limit**, állítható, plusz
„+5 új szó" gomb. Idézetek a user eredeti megfogalmazásában, ne tömörítsd.
**MIND KÉSZ 2026-07-30**: tsc 0, jest 92/92 (86→92: +4 capNewWords, +6 cardNotes),
audit-corpus P1=0.

## 🚫 FB66 [P2 feature], Weekly goal állítása a stats-kártyáról, VISSZAVONVA (user)
Idézet (07-28 09:51, stats-tab): „csináld neg úgy a Weekly goalt hogy lehessen
állítani.ha rá kattontok, akkor jöjjön fel egy ablak ahol lehessen állítani"
Idézet (07-28 12:28, settings-tab): „most látom, hogy a settingsbe lehet beállítani,
hogy mennyi a heti limit akkor nem kell ez a funkció, egy másik feesback feleslegessé vált"
A user maga vonta vissza (a Settings-beli stepper, FB65, már megoldja). Nincs teendő.

## ✅ FB67 [P2 adat], „I am hungry, let us eat." nem természetes angol, KÉSZ (`data`)
Idézet (07-28 21:00, easy:I am hungry, let us eat.): „let us eat?? ez biztos jó fordítás?"
Kártya id 1464 (`tengo hambre`, tener). Az `es` helyes („Tengo hambre, vamos a comer."),
csak az en volt könyves: `let us eat` → **`let's eat`**. Többi nyelv érintetlen.

## ✅ FB68 [P1 adat], „Somos amigos desde niños." túl nehéz A1-re, KÉSZ (`data`)
Idézet (07-29 15:31, sentence:Somos amigos desde niños.): „ez A1 es mondat?"
Kártya id 1458 (`somos amigos`, ser). Ugyanaz az osztály, mint FB33/FB56 (a
`desde + gyerekkor` szerkezet és a `We have been friends since childhood.`
present perfect A1 fölött van). Fix: es `Somos amigos de la escuela.`,
en `We are friends from school.`, hu `Iskolai barátok vagyunk.`, de `Wir sind
Freunde aus der Schule.` Audit-tiszta.

## ✅ FB69 [P2 adat], „I make my bed every morning." ↔ „Hago la cama", KÉSZ (`data`)
Idézet (07-29 21:00, easy:I make my bed every morning.): „my bed az mi came olyan meg
nem volt ez hibás nem?"
Kártya id 1470 (`hago la cama`, hacer). Igaza van: a spanyol oldal `la cama`
(határozott névelő), az angol `my bed` birtokost sugallt, ami a kártyán nem tanított
alak. Fix: en → `I make the bed every morning.` (es/hu/de érintetlen).

## ✅ FB70 [P1 adat], „No encuentro mi llave." ismeretlen ige + „cannot", KÉSZ (`data`)
Idézetek (07-30, easy:I cannot find my key.), 2×:
- (08:45): „cannot az no puedo és ilyen nincs ez itt valami rossz"
- (08:47): „encontro vagycs csak nem tudom mit jelent"
Kártya id 1279 (`la llave`, casa). Az `encontrar` az auditban tanítottnak számít
(paradigma-map), de kártyaként a user tényleg nem találkozott vele, és az angol
`cannot find` a tagadó szerkezetet is új elemként hozta. Fix: a mondat a kártya saját
szavára egyszerűsítve → es `Mi llave está en la mesa.`, en `My key is on the table.`,
hu `A kulcsom az asztalon van.`, de `Mein Schlüssel liegt auf dem Tisch.`

## ✅ FB71 [P2 adat], „I wash in the shower." rossz angol, KÉSZ (`data`)
Idézet (07-30 18:14, easy:I wash in the shower.): „ez mi ez az angol mondat??? ez faszság xD"
Kártya id 1666 (`la ducha`, casa). A `Me lavo en la ducha.` visszaható, az angol
`I wash` tárgy nélkül tényleg hibás. Fix: en → `I wash myself in the shower.`

## ✅ FB72 [P2 UI], Stats: mai perc kiírása, KÉSZ (`stats.tsx`)
Idézet (07-28 10:08, stats-tab): „legyen egy olyan kiírás itt ami azt mutatja, hogy ma
mennyit hány percet használtam az appot"
A „Ma" csempe MÁR megvolt, de csupasz számot mutatott (mértékegység nélkül), ezért nem
volt egyértelmű, hogy perc. Fix: a csempe értéke `s.stats.minutes(usage.today)` →
„23 perc". Új adat/DB nem kellett.

## ✅ FB73 [P2 UX], Üres gépelt válasznál is írja ki a helyes szót, KÉSZ (`index.tsx`)
Idézet (07-29 21:16, word:the floor): „csináld meg, hogy ha nem írok be semmit akkor is
kiirja mi lett volna a helyes szó"
Az FB43 óta az üres válasz némán a sor végére tette a kártyát. Fix: új `skipped`
typing-eredmény, a kártya FELFEDI a helyes alakot (értékelés nélkül, TTS nélkül,
fails-számláló érintetlen), és a → gomb teszi a sor végére (`requeueCurrent`, FB43
szemantika megmarad). i18n ×4: `card.skipped`.

## ✅ FB74 [P1 UI BUG], Eredmény megjelenésekor összecsúszik a UI, KÉSZ (`index.tsx`)
Idézet (07-29 15:31:59, sentence:Somos amigos desde niños.): „hogy ha kijön az eredmény
a ui feljebb kerül, és így már osszecsuszik"
Gyökérok: a gépelős képernyő `container`-e `justifyContent: 'center'` + nem görgethető,
a fejléc viszont `position: absolute`, a felfedéskor megnőtt kártya kitolta a tartalom
tetejét a fejléc alá. Fix: a kártya + gombok `ScrollView`-ba
(`keyboardShouldPersistTaps="handled"`, `flexGrow:1` + középre igazítás + 56 px felső
padding a fejléc alatt), a FeedbackButton a görgetőn kívül marad.

## ✅ FB75 + FB78 + FB79 [P2 feature], „i" info-gomb a kártyán, KÉSZ (`lib/cardNotes.ts`)
Idézetek:
- FB75 (07-28 20:55, easy:The trousers are black.): „it nem többes szám van vagy angolul
  többes számba mondják ha spanyolul nem(ha igen akkor írd bele a kártyába. mármint legyen
  egy infó kis jel amire ennél a szónál rá kattintok és akkor ki irja ezt az eltérést"
- FB78 (07-28 21:06, easy:I wear old jeans.): „ide miért kell az unis? olyan kis i nézőben
  írd bele információ ba legyen egy ilyen funkció is"
- FB79 (07-29 21:32, word:the curtains): „mitől függ hogy valami las cortinas? hogy többes
  szám? vagy ez csak random, hogy néhány szó így van néhány meg úgy?"
**Döntés (AskUserQuestion, 2026-07-30): HIBRID**, „3 kell és ahol tényleg nyelvtani
szábály van amit leelenőriz az AI egy weboldalon egy nyelvtan könyvből ott azt irja be".
Megvalósítás:
- `lib/cardNotes.ts`: (1) a kártya kézi `note_hu/en/es/de` mezője MINDIG nyer;
  (2) különben explicit listás szabály fut, hogy egyetlen kártya se kapjon kitalált
  magyarázatot. `pairNoun` = RAE-szabály (a két szimmetrikus részből álló tárgyak neve
  többes számban is EGY darabot jelölhet: `pantalón(es)`, `gafa(s)`, `tijera(s)`,
  Nueva gramática § 3.8r-t / § 2.5), az angol párja plural-only („a pair of trousers").
  `someIndef` = a mondatbeli `unos/unas` a határozatlan névelő többes alakja.
- UI: „ℹ️" gomb a szó mellett a flashcard ÉS a gépelős kártyán, tap = a note ki/be,
  a tanuló SAJÁT nyelvén (`direction[0]`). Kártyaváltáskor becsukódik.
- Kézi note (4 nyelven) egyelőre: id 1658 `las cortinas` (megszámlálható, van egyes
  száma, a két szárny miatt szokás többesben), id 1061 `la verdura` (gyűjtőnév, ezért
  angolul többes; `las verduras` is helyes).
- i18n ×4: `note.title/pairNoun/someIndef`. Teszt: `lib/__tests__/cardNotes.test.ts`.

## ✅ FB76 [P2 feature], Napi első indításkor üdvözlő szöveg, KÉSZ (`UsageToast.tsx`)
Idézet (07-29 10:39, word:the sneakers): „legyen egy üdvözlő szöveg amikor a nap elsőnek
megnyitja az ember az appot az a baj, nem tudom, hogyan lehet eldönteni mikor van a nap
1. megy itása. erre találj ki valamit és csináld meg úgy"
Megoldás a „mikor a nap 1. megnyitása" kérdésre: `user_meta.last_open_date` (helyi
naptári nap, `localDateString`). Új DB-metódus `claimDailyGreeting()`: ha a tárolt dátum
nem a mai, beírja a mait és `true`-t ad, egyetlen írás, tehát naponta pontosan egyszer
tüzel, app-újraindítás után is. A meglévő usage-pill viszi a szöveget (mérföldkő-stílus,
4 mp), és a TANULT nyelven szól (FB63 minta). i18n ×4: `usage.dailyGreeting`.
MINDKÉT db-fájl (SQLite + web memória-tükör).

## ✅ FB77 [P1 feature], Nehéz téma → napi új-szó limit + „+5 új szó", KÉSZ (`lib/newWordBudget.ts`)
Idézet (07-30 08:38, word:the ceiling/roof): „ha van egy téma ami nehéz, mert sok az új
szó akkor, azt hogy tudom megtanulni? erre kellene valamit kutalálni még én sem tudom"
**Döntés (AskUserQuestion, 2026-07-30):** „1 igen legyen az, hogy be lehessen állitani,
hogy napi hány új szót akarunk és rá lehessen nyomni hogy még 5 új szót és még újat, hogy
lehessen növelni".
Megvalósítás:
- `lib/newWordBudget.ts` `capNewWords(items, remaining)`: a queue-ból csak `remaining`
  darab ÚJ (reps=0) SZÓ-kártya marad; az ismétlések és a mondat-kártyák sosem esnek ki,
  a sorrend nem változik. A cadence ELŐTT fut, mindkét queue-építésnél (loadCards +
  queue-vég rebuild).
- DB (mindkét impl + interfész): `learn_settings.daily_new_limit` (alap 10, 5–100,
  5-ös lépés), `new_bonus` + `new_bonus_date` a „+5" kattintásokhoz (a bónusz a
  naptári nappal lejár), `getNewWordsToday()` = azon szavak száma, amiknek az ELSŐ
  próbálkozása ma volt (`card_attempts`, pair-független, ez a napi terhelés mérőszáma).
- UI: Settings stepper („Napi új szó", −/+ 5), és ha a keret elfogyott, a Done-képernyőn
  „+5 új szó" gomb → bónusz + azonnali queue-újraépítés.
- i18n ×4: `settings.dailyNewLimit`, `settings.dailyNewLimitWords`, `done.moreNewWords`.
- Teszt: `lib/__tests__/capNewWords.test.ts` (4 eset).

## 📌 FB80 [info], „El baño está al final del pasillo.", adat HELYES, nincs teendő
Idézet (07-30 18:19, easy:The bathroom is at the end of the hallway.): „szerintem innen
hiányzik rgy en, nem?"
Kártya id 1664 (`el pasillo`, casa). Az `al final del pasillo` (a + el = al) a natív
szerkezet, `en` nem kell bele; az angol `at the end of the hallway` is helyes.
FB8/FB47/FB59-minta: nincs teendő.

## 📌 FB81 [info], „hacemos ejercicio" angol oldala, adat HELYES, nincs teendő
Idézet (07-29 15:43, word:hacemos ejercicio): „itt az angol furcsa ellenőrizd hogy jó e"
Kártya id 1472 (`hacemos ejercicio` = „we exercise", hacer), mondat
`Hacemos ejercicio por la mañana.` ↔ `We exercise in the morning.`, mindkettő
természetes angol. (A szomszédos id 1094 `We do exercise.` mondatát a user maga
minősítette jónak a 07-01-es fordulóban, ezért az sem változott.)

## Elfogadási kritérium (FB66–FB81 forduló)
- `npx tsc --noEmit` 0 hiba ✅; `npx jest` zöld 92/92 ✅ (2026-07-30).
- `node scripts/audit-corpus.mjs` → P1=0, P2=0 ✅ (5 mondat + 2 note-mező változott).
- `data/words/a1.json` parseable ✅; csak sentence- és új note-mezők mozdultak,
  id/es/topic érintetlen.
- ⏳ Eszköz-verify: üres gépelt válasz felfedése, gépelős képernyő görgetése,
  „i" gomb szövege (trousers / unos vaqueros / las cortinas), napi üdvözlés,
  napi új-szó limit + „+5 új szó" gomb.

---

# 📋 Feedback, 2026-07-31/08-03 forduló (v3.0.8 telefon-teszt, A1 en→es + settings)

Új sorok a `Kimacha Feedback` sheetből (FB81 utáni 8 sor, 07-31 10:18 → 08-03 13:45).
Triage 2026-08-03 (Opus). Döntések AskUserQuestion-nel pinnelve: **FB86 = emoji-ikon
+ ℹ️ jegyzet**; **FB83 = csak a státuszsáv-csík** (nem globális akcent-téma).
Idézetek a user eredeti megfogalmazásában, ne tömörítsd.
**MIND KÉSZ 2026-08-03**: tsc 0, jest 102/102 (92→102: +6 charDiff, +1 cardNotes,
+3 statusBarTints), audit-corpus P1=0/P2=0, lint 18 probléma (a HEAD-alapvonallal
azonos, nincs új hibaosztály).

## ✅ FB82 [P2 UI], Verziószám a Settingsben, KÉSZ (`settings.tsx`)
Idézet (07-31 10:18, settings-tab): „legyen a settingsbe egy szürke kis kiirása, hogy
mi a verzió száma az appnak hogy lássam"
Fix: a backup/restore sorok alatt szürke, kicsi sor `v3.0.8 (8)` formában. Az érték
`Constants.expoConfig` (app.json `version` + `android.versionCode`), így nem tud
elcsúszni egy külön karbantartott konstanstól. i18n nem kell (csak szám).

## ✅ FB83 [P2 UI], Kékes csík az app tetején, 5 árnyalat körbe, KÉSZ (`StatusBarStrip.tsx`)
Idézet (07-31 10:19, word:the shelf): „az app tetejére szeretnék egy kékes csíkot hogy
az óra a töltöttség látható legyen. és legyen a kék úgy hogy ha rá kattintok akkor
váltson a kékek között legyen 5 különböző változat. és így körbe menjen"
**Döntés (AskUserQuestion, 2026-08-03): csak a státuszsáv-csík**, a fejléc/tab-bar és
a globális akcent NEM változik (legkisebb diff, nincs téma-átírás).
Megvalósítás:
- `lib/statusBarTints.ts`: 5 kék (`#1D4ED8`, `#0EA5E9`, `#0F4C81`, `#38BDF8`,
  `#312E81`) + `nextTintIndex` (körbe fordul, tartomány-hibás tárolt indexet is túlél)
  + `tintColor`. Tiszta logika, tesztelve.
- `components/StatusBarStrip.tsx`: a navigátor FÖLÖTT ülő sáv, magassága a
  státuszsáv-inset (`StatusBar.currentHeight` Androidon, iOS 47, weben 0 = nincs sáv),
  `expo-status-bar` `style="light"` a fehér óra/akku-ikonokhoz. Tap = következő kék.
- Perzisztálás: `user_meta.status_bar_tint INTEGER` (ALTER-migráció a régi DB-knek) +
  `getStatusBarTint`/`setStatusBarTint` MINDKÉT db-implementációban + interfészben
  (web: memória-tükör). App-szintű beállítás, ezért `user_meta`, nem `learn_settings`.

## ✅ FB84 [P1 UX], A hiányzó betűt is jelölje a gépelés-diff, KÉSZ (`lib/charDiff.ts`)
Idézet (08-02 22:33, word:we have): „valahogy a hiányzó betűt is jelölni kellene hogy
lássam mi a baj"
Gyökérok: az LCS-diff a kimaradt betűt CSENDBEN átugrotta (`j++`), így a „we hav" a
„we have" mellett hibátlannak látszott, és a szó végi hiány sem jelent meg (a ciklus
`i < m`-ig futott). Fix: a hiányzó karakter is bekerül a kimenetbe `missing: true`
jelöléssel (a ciklus `i < m || j < n`), a UI borostyán háttér + aláhúzás
(`diffMissing`) a piros „ezt elgépelted" jelöléstől elkülönítve.
A `charDiff` mostantól **közös modul** (`lib/charDiff.ts`, `fold` kapcsolóval): a
tanulókártya folddal hívja (kis/nagybetű + ékezet megbocsátva, FB25), a
helyesírás-tréner `fold=false`-szal (betűhű értékelés). Eddig két kézzel másolt
példány élt (`index.tsx` + `spelling.tsx`), ezért kellett volna a fixet kétszer
megírni. Teszt: `lib/__tests__/charDiff.test.ts` (6 eset).

## ✅ FB85 [P2 feature], Ser/estar magyarázat + példamondatok, KÉSZ (`lib/cardNotes.ts`)
Idézetek (08-02):
- (22:41, word:they are (state)): „itt a ser estar nál kellene valami rövid szöveg hogy
  mi a különbség a ser és az estar között és két példa mondat"
- (22:42, word:Soy profesor.): „meg a ser és az estar nál ilyen tipik példa mondatok
  több is lehet, ami kifejezi a különbséget és bizonyítja is a különbséget"
Fix: új `serEstar` szabály az FB75 ℹ️-motorban, a `ser` / `estar` / `ser_vs_estar`
topic MINDEN kártyájára (csak `targetLang==='es'`). A szöveg a tanuló saját nyelvén
(i18n ×4): rövid szabály + KÉT kontraszt-pár, ami bizonyítja a különbséget
(`Soy profesor.` VS `Estoy en clase.`, `El café es caliente.` VS `El café está frío.`).
Nyelvtani forrás: RAE, Nueva gramática § 37.6 (ser = azonosság/besorolás,
estar = állapot, hely, változás eredménye). Teszt: `cardNotes.test.ts` bővítés.

## ✅ FB86 [P2 feature], liszt↔virág (flour/flower) megkülönböztető ikon, KÉSZ (`lib/cardIcons.ts`)
Idézet (08-02 22:55, word:the flour): „itt mindig keverem a lisztet és a virágot mert
angolul ugyan az a szó vagy nem ugyan az csak a dyszlexiam miatt annak látom? Csinálj
erre a szóra valami kártyát ikont hogy meg tudjam különböztetni őket"
**Döntés (AskUserQuestion, 2026-08-03): emoji-ikon + ℹ️ jegyzet.**
- `lib/cardIcons.ts`: kézzel karbantartott lemma→emoji map (`harina` 🌾, `flor`/`flores`
  🌸), csak `es` célnyelvre. Szándékosan rövid lista: ikon csak ott, ahol valódi
  keveredést old fel, sose generált.
- UI: az ikon a kártya-front szövege ELŐTT (flashcard + gépelős nézet), mindkét
  irányban, mert a jelentéshez tartozik, nem az egyik nyelvhez.
- Kézi jegyzet 4 nyelven az a1 1268 (`la harina`) és 1836 (`la flor`) kártyán: az angol
  flour/flower majdnem azonos, a spanyol harina/flor semmiben sem hasonlít.

## ✅ FB87 [P1 UI BUG], Easy-mondat kártya is összecsúszik, KÉSZ (`index.tsx`)
Idézet (08-03 12:14, easy:He is an intelligent and kind person.): „most itt is egybe
lóg a minden fenn össze csúszik"
Ugyanaz az osztály, mint FB74, csak a másik kártyatípuson: a hosszú mondat sok
csempéje kinőtte a középre igazított, nem görgethető oszlopot, és a kártya teteje az
abszolút pozíciójú fejléc alá csúszott. Fix: az easy-ág is `ScrollView`-ba
(`typingScroll` + `typingScrollContent` stílusok újrahasználva,
`keyboardShouldPersistTaps="handled"`), a FeedbackButton a görgetőn kívül marad.

## ✅ FB88 [P2 adat], Miért kell a „lo" a mondatba, KÉSZ (`data`)
Idézet (08-03 13:45, easy:The coffee is cold, I don't want it.): „ide be lehetne írni
hogy miért kel a lo bele"
Kártya a1 1113 (`El café está frío.`, ser_vs_estar). Kézi ℹ️ jegyzet 4 nyelven: a `lo`
tárgyeseti névmás, hímnemű dolgot helyettesít (`el café` → `no LO quiero`), nőnemben
`la`, többesben `los/las`, és az ige ELÉ kerül. Mivel a kézi jegyzet felülírja a
szabályt (FB75 hibrid modell), a jegyzet a ser/estar különbséget is tartalmazza, hogy
ezen a kártyán se vesszen el az FB85 magyarázat.

## Elfogadási kritérium (FB82–FB88 forduló)
- `npx tsc --noEmit` 0 hiba ✅; `npx jest` zöld 102/102 ✅ (2026-08-03).
- `node scripts/audit-corpus.mjs` → P1=0, P2=0 ✅ (csak note-mezők változtak).
- `npx expo lint`: 18 probléma (8 error, 10 warning) = a HEAD-alapvonal, nincs új
  hibaosztály ✅.
- `data/words/a1.json` parseable, 882 kártya ✅; csak note-mezők mozdultak
  (id 1113, 1268, 1836), mondat/szó/topic érintetlen.
- ⏳ Eszköz-verify: kék csík + 5 árnyalat körbe, verziószám a Settingsben, hiányzó
  betű jelölése gépeléskor, ser/estar és „lo" ℹ️ szöveg, 🌾/🌸 ikon, hosszú
  easy-mondat görgetése.

---

# 📋 Feedback, 2026-08-04/07 forduló (v3.0.9 telefon-teszt, A1 en→es)

Új sorok a `Kimacha Feedback` sheetből (FB88 utáni 12 sor, 08-04 10:44 → 08-07 21:20).
Triage 2026-08-07 (Opus). Idézetek a user eredeti megfogalmazásában, ne tömörítsd.
**Pinnelt döntés (AskUserQuestion, 2026-08-07), a mondatok szerepe:** „A mondatoknak
a célja egyetlen egy dolog, hogy a szavakat segitsék megtanulni. SEMMI MÁS azokból a
szavakból legyenek mondatok amiket sokat hibázok." Ez felülírja a korábbi „cap vagy
catch-up" opciókat: a mondat sosem cél, csak szó-megerősítés.

## ✅ FB89 [P1 BUG], Mondat-áradat, a queue csupa mondat lett, KÉSZ (`lib/sentenceMix.ts`)
Idézetek (mind 08-07, A1 en→es):
- 20:45 `sentence:Llevo el bañador a la piscina.`: „túl sok a mondat kevés a szó, miért?"
- 20:46 `sentence:¿Tú vas al mercado?`: „most vagy 60 mondat van benne miért?"
- 20:48 `sentence:Soy de España, de Madrid.`: „ja hát itt érdekes, dolog történt most
  csak mondatok vannak és nem tudom miért"
- 21:20 `sentence:La casa es naranja.`: „megint túl sok mondat, mintha valami be
  buhosodott volna"

Gyökérok: `getDueCardsForWordIds` a mondat-slotokat a pool MARADÉKÁBÓL töltötte
(`sentenceSlots = Math.max(3, limit - newCards - reviewWords)`). Amelyik napon kevés
szó esedékes (mind későbbre ütemezve), ott a 40-es poolból 35+ mondat lett, és az
`applyCadence` 4:1 ritmusa nem tudott mihez keverni, így a végén hosszú mondat-blokk
maradt. Nem regresszió, a hiba a kezdetektől benne volt, csak most futott bele a user
elég érett FSRS-ütemezésbe.

Fix, `lib/sentenceMix.ts` (tiszta logika, tesztelve):
- `sentenceSlotCount(wordCardCount) = floor(wordCardCount / 4)`, azaz a mondat-szám a
  4 szó : 1 mondat cadence-hez (FB31/FB36) igazodik, nem a szabad helyhez. 4 esedékes
  szó alatt 0 mondat: nincs mit megerősíteni, a session véget ér és a Done screen
  kínálja az új szavakat.
- `rankSentencesByWordWeakness(cards, weakness)`: a megmaradt slotok a leggyengébb
  szavakhoz mennek, sorrend `lapses` DESC → FSRS `difficulty` DESC → `due` ASC →
  bemeneti sorrend (stabil).
Bekötve MINDKÉT db-implementációba (`database.ts` SQL + `database.web.ts` memória),
a mondat-lekérdezés innentől LIMIT nélkül hozza a due sorokat, és a rangsor vág.

## ✅ FB90 [P2 UX], Magyarázat magától jöjjön, ha elrontottam, KÉSZ (`index.tsx`, `EasySentenceCard.tsx`)
Idézet (08-04 10:45, `easy:My arm is broken.`): „inkább ide valami magyarázat kellene
de csak akkor ha elrontottam"
Fix: a kártya ℹ️ jegyzete (FB75 hibrid modell) magától kinyílik hibás válasz után.
Gépelős kártya: `handleCheck` rossz találatnál `setNoteOpen(true)` (helyes válasznál
nem, marad csendben). Easy mondat-kártya: új `mistakeNote` prop, a helyes mondat alatt
jelenik meg, csak `result === 'wrong'` esetén.

## ✅ FB91 [adat + info], Testrészek névelővel, nem birtokossal, KÉSZ (`data`, id 1115 + 1119)
Idézet (08-04 10:44, `easy:My arm is broken.`): „ez mi pierna not? megint mintha
hiányozna valami de nem vagyok biztos az AI ban. és ha ezt a feedback megkapod akkor
itd meg hogy igazam volt e vagy nem"
Idézet (08-04 20:21, `easy:I have pain in my shoulder.`): „ide nem kellene a mi váll?
mármint, hogy az enyém mint az angolban"
**Válasz a kérdésre: nem volt igazad**, `el brazo` = kar, `la pierna` = láb, a kártya
adata helyes. A valós hiány a másik fele: a spanyol a testrész elé NÉVELŐT tesz, nem
birtokos névmást (`Tengo el brazo roto`, `Tengo dolor en el hombro`), ezért látszott
úgy, mintha hiányozna valami. Kézi ℹ️ jegyzet 4 nyelven mindkét kártyára (1115 brazo,
1119 hombro), a brazo-jegyzet a brazo↔pierna párt is kiírja.

## ✅ FB92 [adat], `la sala` és `el salón` is „the living room" volt, KÉSZ (`data`, id 1835)
Idézet (08-07 19:43, `word:the living room`): „it most nem értem a sala és a salón is
living room? ez zavaros bogozd ki és csak az egyiket tedd be"
Gyökérok: két kártya azonos angol oldallal (1096 `el salón`, 1835 `la sala`), így
native→learned gépelésnél eldönthetetlen volt, melyiket kéri. Fix: a nappali marad
`el salón`, az 1835 átkerül a valódi jelentésére (`a terem` / `the room (hall)` /
`der Saal`), mondata `La sala está llena de gente.`, plusz ℹ️ jegyzet a spanyolországi
vs. latin-amerikai használatról.
Maradt még két azonos angol oldal az A1-ben (`the menu` = 1129 `el menú` / 1290
`la carta`, `cold` = 1429 `frío` / 1519 `el resfriado`), ezek NEM ebben a fordulóban
kértek javítást, de ugyanez a zavar fenyeget.

## ✅ FB93 [adat], Buta mondat a gyűrű-kártyán, KÉSZ (`data`, id 1687)
Idézet (08-07 20:44, `sentence:Lleva un anillo en la mano.`): „ez egy buta mondat
veddd ki"
Fix: `El anillo es de mi madre.` / „A gyűrű anyámé." / `The ring is my mother's.` /
`Der Ring gehört meiner Mutter.` (az első próba `de oro` volt, de az `oro` a
audit-corpus szerint még tanítatlan token, ezért esett ki.)

## ✅ FB94 [adat], „minek van I betű" a pizsama-mondatban, KÉSZ (`data`, id 1685)
Idézet (08-07 20:45, `sentence:Me pongo el pijama por la noche.`): „itt minek va I
betű???"
Válasz jegyzetben: az angol `I`-nek nincs spanyol párja, a `pongo` `-o` végződése maga
jelenti, hogy én, ezért a `yo` elmarad; a `me` a visszaható rész. Mivel a kézi jegyzet
felülírja a szabály-alapút (FB75), a `pajamas` pair-noun magyarázat is belekerült, hogy
ne vesszen el.

## 📌 FB95 [info], „Hay un libro aquí.", adat HELYES, nincs teendő
Idézet (08-07 19:30, `word:Hay un libro aquí.`): „ez biztos jó?"
A `hay` (haber személytelen alakja) + határozatlan névelő a létezés kifejezése, a
mondat helyes, a kártya `hay_vs_esta` topichoz tartozik (id 1342).

## 📌 FB96 [stale], „még mindig nincs kék csík", NINCS teendő
Idézet (08-04 20:28, `word:we exercise`): „még mindig nincs a képernyő tetején egy kék
csík azért, hogy lássam az időt és a telefon toltottségét. ezt csináld meg"
FB83 08-03-án elkészült (`StatusBarStrip`, bekötve `app/_layout.tsx:84`), de a 3.0.9
APK a jelzés idején még nem volt telefonon. Kód-teendő nincs, telepítés kell.

## ✅ FB97 [P1 adat-integritás], Duplikált szavak + ütköző id-k, KÉSZ (`scripts/dedupe-words.mjs`)
Kérdés (2026-08-07, chat): „az el salón és a la sala az kérszer van benne ugyan olyan
néven nem?"
Az `el salón`/`la sala` valójában két külön szó volt (az angol oldaluk ütközött, ez az
FB92), de a kérdés nyomán a korpusz-átvizsgálás két valódi hibát talált:
1. **177 azonos jelentésű duplikátum** szintek között (`el brazo` A1+A2, `seis` A1+A2,
   `los zapatos` A1+A2, `encontrar` A0+A1 ...), azaz szintlépéskor nulláról tanultad
   újra, amit már tudtál.
2. **538 ütköző szó-id** a szintfájlok között (a1↔a2: 430, a1↔b1: 94, b1↔b2: 14). Az
   `id` a `cards.word_id` kulcsa ÉS a megjelenítés kulcsa (`words.find(...)` a lapos,
   minden szintet összefűző tömbön 3 helyen), így ütközésnél az első (alacsonyabb
   szintű) találat nyert: az A2-es kártya A1 tartalmat mutatott és KÖZÖS FSRS-sort
   használt vele. A0 tiszta volt, ezért A1-en ez még nem látszott.

**Döntés (AskUserQuestion, 2026-08-07): alacsonyabb szint nyer, törlés**, plusz az
id-javítás előre kerül (enélkül a törlés-térkép is találgatna).
- `scripts/dedupe-words.mjs` (dry-run alapból, `--write` ír): 1. fázis a törlés,
  2. fázis az újraszámozás CSAK a magasabb szintű fájlban, 3. fázis a `lib/wordMerges.ts`
  generálása. Jelentés-egyezés = az `en` vagy `hu` oldal normalizált jelentéshalmazának
  metszete nem üres, így a valódi többjelentésű párok MEGMARADNAK: `la carta` (A1 étlap
  / A2 levél), `tener` (A0 birtokolni / B1 feltételes), `tender` (A1 kiteregetni / B2
  hajlamos).
- Korpusz: 3478 → 3301 kártya. a0 100 (érintetlen), a1 882→881 (csak `encontrar` 1886,
  az A0-s 39 marad), a2 900→792, b1 927→869, b2 494→486, c1 83→81, c2 92 (érintetlen).
  **A0/A1 id-k nem mozdultak**, tehát a telefonon lévő haladás érvényes marad.
- `lib/wordMerges.ts` (generált): 92 egyértelmű `törölt id → megmaradt id` pár. A többi
  85 törlés kimarad, mert a törölt id-t egy másik szint még használja, ott a migráció
  nem találgat.
- DB-migráció mindkét implementációban: app-indításkor (natív, egy indexelt SELECT a
  szonda) és backup-visszatöltéskor (natív + web) átviszi a haladást. Ha MINDKÉT id-n
  van haladás, `lib/cardMerge.ts` `pickSurvivor` dönt (több `reps` → nagyobb
  `stability` → korábbi `due`), a gyengébb sor esik ki. `spelling_list` és
  `card_attempts` is követi. Csak `%-es` párokra, az en/hu szótrackek külön számoznak.
- Őrző teszt (`corpusIntegrity.test.ts`): globálisan egyedi id, nincs azonos jelentésű
  duplikátum, a merge-térkép csak eltűnt id-t képez le, csak élő id-re mutat, és nincs
  benne lánc.

## Elfogadási kritérium (FB89–FB97 forduló)
- `npx tsc --noEmit` 0 hiba ✅; `npx jest` zöld 117/117 ✅ (102→117: +7 sentenceMix,
  +8 corpusIntegrity).
- `node scripts/audit-corpus.mjs` → P1=0, P2=0 ✅ (a HEAD-alapvonallal azonos).
- `npx expo lint`: 18 probléma (8 error, 10 warning) = a HEAD-alapvonal, nincs új
  hibaosztály ✅.
- `node scripts/audit-corpus-en.mjs`, `-hu.mjs`, `validate-en-track.mjs` → mind OK ✅
  (az en/hu tracket a takarítás nem érintette).
- Minden szintfájl parseable ✅, 3301 kártya; A1 881 (csak `encontrar` 1886 esett ki),
  A1-es note/sentence módosítás id 1115, 1119, 1685, 1687, 1835.
- A2/B1 topic-lefedettség: nincs 5 szónál kisebb topic ✅ (A1 46, A2 15 topic).
- ⏳ Eszköz-verify: a session szó-mondat aránya (4:1, nincs mondat-blokk), a mondatok
  a legtöbbet hibázott szavakhoz tartoznak, hibás válasz után magától nyíló ℹ️ jegyzet
  (gépelős ÉS easy kártyán), sala/salón kártyák, gyűrű- és pizsama-mondat, valamint
  hogy a takarítás után a meglévő A1 haladás sértetlenül jön fel a telefonon.

---

# 📋 Feedback, 2026-08-08 (chat-kérés, v3.0.10 után)

## ✅ FB98 [P2 UX], A mondatvégi pont ne legyen hiba, KÉSZ (`lib/charDiff.ts`, `spelling.tsx`)
Kérés (2026-08-08, chat): „csináld meg azt hogy a mondatok végén a pont ne legyen hiba"
Állapot a kérés előtt: a PONTOZÁS már elfogadta pont nélkül is (`strictAnswerMatch`
minden írásjelet kiszed), a pont két MÁSIK helyen látszott hibának:
1. a gépelés-diff (FB84 óta) borostyánnal jelölte a kihagyott mondatvégi pontot, így
   egy apró elgépelés két hibának nézett ki;
2. a helyesírás-tréner (`spelling.tsx`) betűre pontosan hasonlított, ott a pont bukó volt.
Fix: `charDiff` a diff ELŐTT leszedi a nyitó (`¡¿"'(`) és záró (`.!?…,;:¡¿"')`)
írásjeleket mindkét oldalról; amit a tanuló maga írt, az semlegesként (nem hibaként)
kerül vissza a kimenetbe, amit kihagyott, az meg sem jelenik. A helyesírás-tréner az
új `stripTrailingPunct`-tal hasonlít, minden más ott betűre szigorú marad.
Gate: tsc 0, jest **123/123** (117→123: +5 charDiff, +2 stripTrailingPunct), lint 18 =
alapvonal.

---

# 📋 Feedback, 2026-08-08 forduló (v3.0.10 telefon-teszt, A1 en→es)

Új sorok a `Kimacha Feedback` sheetből (FB98 utáni 3 sor, 08-08 05:27 → 05:41). Triage
2026-08-08 (Opus). A telefonon a 08-08 00:06-os build (3.0.10, versionCode 10) futott,
tehát az FB89 mondat-fix MÁR benne volt, a torlódás mégis visszajött, lásd FB99.
Idézetek a user eredeti megfogalmazásában, ne tömörítsd.

## ✅ FB99 [P1 UX], Megint feltorlódtak a mondatok, max 5 legyen, KÉSZ (`lib/sentenceMix.ts`, `index.tsx`)
Idézet (08-08 05:39, `sentence:El cinturón va en la cintura.`): „megint feltorlódtak a
mondatok legyen egy szabály hogy 5 mondatnál több semmi keppen ne legyen. legyen úgy
hogy a mondatok ne számítsanak csal a szavak. Ez egy szótanulós app nem egy mondat
tanulós. egyszer kétszer jó, de amikor így feltorlódnak nagyon idegesítőek és nehezek"
Gyökérok (amit az FB89 még nyitva hagyott): a mondat-slotok száma a DB-ben dől el, a
LEKÉRT szavak alapján (`sentenceSlotCount(newCards + reviewWords)`), a queue-réteg
viszont UTÁNA dobja ki az aznapi új-szó kereten felüli új szavakat (`capNewWords`,
FB77). Amelyik napon a napi új-szó keret már elfogyott, ott a szavak eltűntek a sorból,
a hozzájuk mért mondatok viszont bent maradtak, így megint mondat-túlsúly lett.
Fix két rétegben:
- `sentenceSlotCount` plafonja `MAX_SENTENCES_PER_SESSION = 5` (a user kért kemény
  szabálya), a 4 szó : 1 mondat ütem ezen belül marad.
- új `capSentencesToCadence(items, isSentence)` a VÉGLEGES listára fut (`applyCadence`
  elején), tehát a capNewWords utáni valódi szószám dönt. A megmaradó mondatok a lista
  elejéről jönnek, azaz a leggyengébb szavakhoz tartozók (FB89 rangsor).
A „mondatok ne számítsanak" másik fele már az FB89 óta áll: a session `limit`-je csak
szavakra megy, a mondatok azon FELÜL jönnek.

## ✅ FB100 [P2 feature], Mennyi szó van hány napra elrakva, KÉSZ (`lib/schedulePreview.ts`, `stats.tsx`)
Idézet (08-08 05:27, `word:the sweater`): „valahol jeleznie kellene, hogy mennyi szó van
mennyi napra elrakva, meg higy mikor frissül. ezt akár egy külön fülön is lehetne
jeleznie"
Külön fül helyett a Stats tab kapott egy „Ütemezés" kártyát (a fülsor már 5 elemű, egy
hatodik szűkítené a többit; az adat statisztika-természetű). Tartalma: most esedékes
szavak, majd távolság-sávok (ma később / holnap / 2-3 nap / 4-7 nap / egy héten túl),
alul az összes elrakott szó + a következő frissülés ideje (közeli kártyánál óra:perc,
távolinál nap-szám). Adat: `getScheduledWordDueDates()` (mindkét db-implementációban)
= a forgásban lévő, nem eltemetett szó-kártyák `due` értékei; a csoportosítás tiszta
függvényben (`buildSchedulePreview`), 7 teszttel. Négy nyelven feliratozva.

## ✅ FB101 [P1 UI bug], A Settings lap nem görgethető, KÉSZ (`app/(tabs)/settings.tsx`)
Idézet (08-08 05:41, `settings-tab`): „a settings resznél nem lehet fel le tekerni az
oldalt"
A képernyő gyökere fix `View` volt, közben a lap az FB39/FB65/FB77/FB82 sorokkal
túlnőtt egy kijelzőn, így az alsó rész (köztük az FB82 verziószám, amit a user ma
keresett) elérhetetlen volt. Fix: a tartalom `ScrollView`-ba került
(`contentContainerStyle`, alul 96 px hely a lebegő feedback gombnak), a Modal és a
FeedbackButton a képernyőre rögzítve maradt kívül.

## Elfogadási kritérium (FB99–FB101 forduló)
- `npx tsc --noEmit` 0 hiba ✅; `npx jest` zöld **135/135** ✅ (123→135: +5 sentenceMix
  cap/capSentencesToCadence, +7 schedulePreview).
- `node scripts/audit-corpus.mjs` → P1=0, P2=0 ✅ (adat-JSON nem változott).
- `npx expo lint`: 18 probléma (8 error, 10 warning) = a HEAD-alapvonal ✅.
- ⏳ Eszköz-verify a következő buildben: session-enként max 5 mondat még kimerített napi
  új-szó keret mellett is, a Settings lap görgethető (és látszik a verziószám), a Stats
  tab „Ütemezés" kártyája a valós FSRS-ütemezést mutatja.

---

# 📋 Feedback, 2026-08-08 esti forduló (v3.0.11 telefon-teszt, A1 en→es)

Új sorok a `Kimacha Feedback` sheetből (FB101 utáni 7 sor, 08-08 21:11 → 22:00).
Triage 2026-08-09 (Opus). Idézetek a user eredeti megfogalmazásában, ne tömörítsd.
**MIND KÉSZ 2026-08-09**: tsc 0, jest 146/146 (135→146: +6 newWordAllowance,
+5 dayRollover), audit-corpus P1=0/P2=0, lint 18 = alapvonal.

## ✅ FB102 [P1 UI bug], Az ℹ️ jegyzet nyitásakor a fejléc rácsúszik, KÉSZ (`index.tsx`)
Idézet (08-08 21:11, `word:I am from Spain.`): „amikor kijön az I betű és legördül az
oldal akkor az A1 és a tűz jel a számmal megmarad és jön le és így egybe bugolódik.
ezt javitsd"
Ugyanaz az osztály, mint FB74 (gépelős) és FB87 (easy-mondat), csak a harmadik
nézeten: a szó-flashcard ága fix, középre igazított `View` volt, a fejléc viszont
`position: absolute`. A nyíló jegyzet megnöveli a kártyát, a tartalom teteje a fejléc
alá csúszik, így az A1 badge + 🔥 streak a szövegre ül. Fix: a kártya + gombok
`ScrollView`-ba (`typingScroll`/`typingScrollContent` újrahasználva,
`keyboardShouldPersistTaps="handled"`), a fejléc és a FeedbackButton a görgetőn kívül.

## ✅ FB103 [P1 UX], Nem látszik, mikor fogy el a napi új-szó keret, KÉSZ (`lib/newWordBudget.ts`, `index.tsx`, mindkét db)
Idézet (08-08 21:21, `word:to order`): „az új szavakkal kapcsolatban, az a baj, hogy nem
tudom mikor fogy el a napi 5 új szó. azt kellene hogy mindog 5 új szó legyen benne ha
nem találom mi őket akkor ne rakjon be 5 új szót, mert akkor torlódik. szt kellene
valahogy megoldani"
Két külön kérés, mindkettő megvan:
- **Láthatóság**: a fejléc kapott egy `🌱 N` badge-et a 🔥 streak mellé (mindhárom
  kártya-nézeten, közös `headerBadges`), N = a ma még felvehető új szavak száma. Eddig
  ez az adat csak a Done-képernyőn létezett (FB77 „+5 új szó" gomb).
- **Torlódás-gát**: az FB77 napi keret mellé egy MÁSODIK plafon, a félig tanult
  szavak száma. `newWordAllowance({limit, bonus, startedToday, unlearned})` a szűkebbet
  veszi: `limit+bonus-startedToday` ÉS `limit+bonus-unlearned`. Az `unlearned` =
  a FSRS learning (1) / relearning (3) állapotú, nem eltemetett szó-kártyák
  (`getUnlearnedWordCount`, mindkét db-implementációban + interfészben). Amit sokszor
  elrontasz, az tehát a HOLNAPI új szavakat tartja vissza, nem rakódik rájuk. A „+5 új
  szó" gomb mindkét plafont áttöri (a user explicit kérése). Teszt: 6 eset.

## ✅ FB104 [P2 adat], „vuestro" hirtelen jött, magyarázat kell, KÉSZ (`data`, id 1161)
Idézet (08-08 21:25, `word:your (plural) son`): „mi ez a vuestto vagy mi ez a spanyol
szó ez nagyon új kell ehez I betű"
Kézi ℹ️ jegyzet 4 nyelven (FB75 hibrid modell, a kézi note nyer): a `vuestro` a
`vosotros` birtokosa, CSAK Spanyolországban él (Latin-Amerika: `su` / `de ustedes`), és
nemben-számban egyeztetendő (vuestro hijo / vuestra hija / vuestros hijos / vuestras
hijas).

## ✅ FB105 [P1 BUG], „Again" után gépelős lett a szó, pedig ismételni akartam, KÉSZ (`index.tsx`)
Idézet (08-08 21:32, `word:the salary`): „az lehet hogy arra nyomtam, hogy again és
tovább ment. Marmint akkor lehet hogy magát a szó nem ment tovább, csak átugrott a
következő formátumba ami most a gépelés és nekem pedig még szó kártyán kellett volna
ismételgetni."
Gyökérok: a kártyatípus-fázis (`buildQueue`) a `reps`-ből jött, az FSRS viszont MINDEN
válaszra növeli a `reps`-et, az Again-re is. Két Again = reps 2 = gépelős kártya, holott
a szót a tanuló egyszer sem tudta. Fix két rétegben:
- a fázis mostantól a SIKERES ismétlésekből számol: `passed = reps - lapses` (0 =
  flashcard L→N, 1 = flashcard N→L, ≥2 = gépelés), tehát minden hiba visszaveszi az
  előléptetést;
- az Again a szó-flashcardon már nem lép ki a szóból: `handleWordAgain` az FB60
  mintáját követi (`gradeAgainBackground` + `requeueCurrent`), a szó a session sor
  VÉGÉRE kerül, egyetlen Again-írással, és ugyanabban a fázisban jön vissza.

## ✅ FB106 [P1 adat], „Cobro mi sueldo…", tanítatlan ige a mondatban, KÉSZ (`data`, id 1593)
Idézet (08-08 21:33, `easy:I get my salary at the end of the month.`): „i get ezt nem
tudom spanyolul és ez eddig nem is volt szóval ez a mondat előtt a get et meg kellett
volna tanítani"
Igaza van, bár az audit nem fogta meg: a `cobrar` (id 1552) formálisan tanított, de egy
MÁSIK topicban (`dinero_banco` 8), és az angol oldala „to charge", ami az „I get"-tel
nem köthető össze. FB70-minta: a mondat a kártya saját szavára egyszerűsítve →
es `Mi sueldo es bueno.`, en `My salary is good.`, hu `Jó a fizetésem.`,
de `Mein Gehalt ist gut.` (mi/es/bueno mind tanított, `bueno` A0 id 18).

## ✅ FB107 [info + adat], „imprimir" és „la impresora", NEM duplikátum, KÉSZ (`data`, id 1598 + 1603)
Idézet (08-08 21:57, `sentence:La impresora no funciona hoy.`): „most mi a printer mert
egyszer volt már inimar vagy valami hasonló most meg ez? nem lehet, hogy megint kettő
van?"
**Válasz: nincs duplikátum.** Az „inimar" = `imprimir` (id 1598, IGE, nyomtatni), ez itt
`la impresora` (id 1603, GÉP, a nyomtató); a gép neve az igéből képződik. Az FB97
dedupe-őr is tiszta (a jelentéshalmazuk nem metsz). A keveredés viszont valós, ezért
FB86-minta szerint kézi ℹ️ jegyzet 4 nyelven MINDKÉT kártyán, ami kimondja az ige↔gép
különbséget.

## ✅ FB108 [P2 feature], Éjfél-átfordulás: napi stat + kreatív gratuláció, KÉSZ (`lib/dayRollover.ts`, `usageTimer.ts`, `UsageToast.tsx`)
Idézet (08-08 22:00, `word:on top of / about`): „legyen olyan, hogy ha éjfélkor játszunk
a játékkal, és pont átfordul akkor a napi statot írja ki és gratuláljon, a játékosnak,
valami nagyon menő szöveggel, legyen nagyon kreatív, és irjaon valami nagyon szépet és
sok különböző szöveg legyen de legyen benne ismétlödes is."
Megvalósítás:
- `usageTimer`: a futó tick-hurok minden számolt másodpercnél összeveti a tárolt naptári
  napot a mostanival; váltásnál `onDayRollover({date, minutes, words})` szól a LEZÁRT
  napról (és a session-mérföldkő nullázódik). Az app-futás ELSŐ tickje csak felveszi a
  mai dátumot, tehát újraindítás sosem hazudik ünneplést.
- `getDayStats(date)` mindkét db-implementációban + interfészben: a nap percei
  (`usage_minutes`) + az aznap érintett EGYEDI szó-kártyák száma (`card_attempts`), tehát
  az ötször gyakorolt szó is egy szó.
- `lib/dayRollover.ts` `pickDayRolloverMessage(variants, totals, random)`: VÉLETLEN
  választás a szöveg-készletből (a user kért ismétlődés = ez, nem körbe-forgó lista),
  `{min}` és `{words}` behelyettesítéssel. Tiszta függvény, tesztelve.
- `UsageToast`: a meglévő pill viszi, mérföldkő-stílusban, 8 mp-ig (számokat kell
  elolvasni), és a TANULT nyelven (FB63/FB76 minta).
- i18n ×4: `usage.dayRollover`, nyelvenként 6 szöveg.

## Elfogadási kritérium (FB102–FB108 forduló)
- `npx tsc --noEmit` 0 hiba ✅; `npx jest` zöld **146/146** ✅ (135→146: +6
  newWordAllowance, +5 dayRollover).
- `node scripts/audit-corpus.mjs` → P1=0, P2=0 ✅; `audit-corpus-en.mjs`,
  `audit-corpus-hu.mjs`, `validate-en-track.mjs` mind OK ✅.
- `npx expo lint`: 18 probléma (8 error, 10 warning) = a HEAD-alapvonal ✅.
- `data/words/a1.json` parseable, 881 kártya ✅; csak note- és sentence-mezők mozdultak
  (id 1161, 1593, 1598, 1603).
- ⏳ Eszköz-verify a következő buildben: nyíló ℹ️ jegyzet nem csúszik a fejléc alá,
  `🌱 N` badge a fejlécben és fogyása, Again a szó-kártyán ugyanabban a formátumban
  hozza vissza a szót, sueldo-mondat, vuestro/impresora jegyzetek, és éjfélkor játszva
  a napi összefoglaló.

---

# 📋 Feedback, 2026-08-08/13 forduló (v3.0.11 telefon-teszt, A1 en→es)

Új sorok a `Kimacha Feedback` sheetből (FB108 utáni 8 sor, 08-08 23:11 → 08-13 07:39).
Triage 2026-08-13 (Opus). Idézetek a user eredeti megfogalmazásában, ne tömörítsd.
**MIND KÉSZ 2026-08-13**: tsc 0, jest 168/168 (154→168: +12 wordPhase, +7 budget),
audit-corpus P1=0/P2=0, lint 18 = alapvonal.

## ✅ FB109 [P1 bug], Eltűnt a gépelős szó-kártya, KÉSZ (`lib/wordPhase.ts`, `index.tsx`)
Idézet (08-08 23:11, `word:taller than`): „most nem volt a leírás rész ez véletlen? nem
volt a begepelos rész miért."
Ugyanaz a tő, mint FB114 („most a gépelésből csak mondat van"). Gyökérok: a fázis-létra
(0 = flashcard L→N, 1 = flashcard N→L, 2 = gépelés) a kártya `reps - lapses`-éből jön, de
az FSRS a második Good után NAPOKRA ütemezi a szót, tehát a 2. fázis (gépelés) csak egy
későbbi napon jött volna elő, addig a gépelős szlot mindig mondatoké volt.
Fix: a létrát a session BELÜL járjuk végig. `handleWordGood` (új) a szó-flashcard Good-ját
maga írja (`gradeBackground`, FB60-minta háttér-írás), és a szót a sor VÉGÉRE teszi a
KÖVETKEZŐ fázisában (`requeueAtPhase`), tehát: flashcard L→N ✓ → flashcard N→L ✓ →
gépelés. A szó csak akkor lép ki a sessionből, ha le is írta helyesen. A fázis-szabály
kiemelve tiszta modulba (`lib/wordPhase.ts`: `wordPhase` + `phaseShape`), amit a
`buildQueue` és a promóció is ugyanúgy használ. Teszt: 9 eset.

## ✅ FB110 [P2 UI bug], Az ℹ️ kilóg a kártya széléről, KÉSZ (`index.tsx` styles)
Idézet (08-09 09:15, `sentence:Vuestro hijo es muy inteligente.`): „itt az i betű az
informatcionak kicsit bele van logv a kép szélére old meg ezt"
A `frontRow` egy sorba tette az ikont, a 32 pt-os mondat-szöveget, a 🔊-t és az ℹ️-t, de a
szöveg nem zsugorodott, így hosszú mondatnál a két gomb kicsúszott a kártyából.
Fix: `frontText` `flexShrink: 1`, a `frontRow` pedig `flexWrap: 'wrap'` +
`justifyContent: 'center'` + `maxWidth: '100%'`, tehát a szöveg ad helyet, a gombok bent
maradnak (és nagyon hosszú mondatnál a gombok a következő sorba kerülnek).

## ✅ FB111 [kérdés + logika], „Egy szó akkor számít megtanultnak ha el tudjuk írni helyesen", KÉSZ (mindkét db)
Idézet (08-09 10:27, `word:wide / broad`): „Egy szó akkor számít megtanultnak ha el tudjuk
írni helyesen. esdig is így ment? vagy hogy van?"
**Válasz: eddig NEM így ment.** A „megtanult" (mastered %) eddig az FSRS `state >= 2`
(Review) volt, amit a két flashcard-lépés is elér, tehát a szó megtanultnak számított
azelőtt, hogy egyszer is le kellett volna írni. Most a mastery-hez a gépelős lépés is
kell: `state >= 2 ÉS reps - lapses >= 3` (flashcard + fordított flashcard + helyes
leírás), az „I know this" (buried) továbbra is önmagában elég. Emiatt a mastered % egyszer
visszaesik a régi haladáson, de mostantól azt mutatja, amit a user ért alatta. A vizsga-
kapu (80% mastered) ugyanezt a szigorúbb számot használja.

## ✅ FB112 [P1 bug], Beragadt / ugráló új-szó számláló, KÉSZ (`lib/newWordBudget.ts`, `index.tsx`)
Idézet (08-09 22:13, `word:the olive oil`): „mintha bugos lenne a számláló hogy mennyi új
szó van. Mintha 2 szó be lenne ragadva ezt nézd át a kódba, hogy . mert, és jó lenne az is
ha ezt le tesztelnéd, hogy az legyen aminek lennie kell"

## ✅ FB113 [P1 bug], „9 ből hirtelen 0 lett", KÉSZ (ugyanaz a fix)
Idézet (08-09 22:20, `word:empty`): „hát igen bugos a számláló 9 ből hirtelen 0 lett nem
igy egyesével fogyott. hanem csak úgy ugrott egyet"

## ✅ FB114 [P1 rework], „megint 5 ből egy lett", + eltűnt gépelős szavak, KÉSZ (ugyanaz a fix + FB109)
Idézet (08-09 22:27, `word:credit card`): „megint 5 ből egy lett. ezt át kell dolgozni. Ez
egy nagy lépés lesz mert nem úgy. ennek a dolgok ahogy akarom. ez a számolás se jó, meg
ahogy a szavak feljönnek, pl most elmaradtak a gépelős szavak nem ért miért. most a
gépelésből csak mondat van"
Gyökérok (FB112-114 egy hiba): az FB103 két plafont EGY számba vont
(`min(limit+bonus-startedToday, limit+bonus-unlearned)`), és ezt mutatta a `🌱` badge is.
Az `unlearned` (félig tanult szavak) viszont (a) nem naponta nullázódik, (b) egy sessionben
többel is nő, tehát a badge nem egyesével fogyott, hanem ugrott (9→0, 5→1), és a napi
keret sosem érte el a Settings-beli limitet.
Fix, a két szabály szétválasztva:
- `newWordsLeftToday({limit, bonus, startedToday})` = a LÁTHATÓ napi visszaszámláló, ez a
  `🌱` badge, monoton, és a `spendNewWordBadge` minden vadonatúj szó első válaszánál
  optimista `-1`-et lép (mint a streak), tehát tényleg egyesével fogy, nem a következő
  sor-újraépítésnél ugrik;
- `newWordIntake(...)` = mennyi új szót vesz fel a SOR: a napi maradék, kivéve ha a félig
  tanult készlet elérte a `2 × (limit + bonus)` WIP-plafont, akkor 0 (ez az FB103
  torlódás-gát, csak már nem hazudik a badge-en). Ha a gát fog, a badge `🌱⏸`-t mutat,
  hogy látszódjon: van napi keret, de először a félbehagyott szavakat kell lezárni.
A Done-képernyő „+5 új szó" gombja mostantól akkor is megjelenik, ha a gát fog (nem csak
elfogyott napi keretnél), különben a tanuló zsákutcába jutna: a bónusz a WIP-plafont is
emeli (`2 × (limit + bonus)`).
Teszt: 13 eset (`capNewWords.test.ts`).

## ✅ FB115 [P2 beállítás], „egyszerre mindig 5 szót ad be és kicsi kevés", KÉSZ (ugyanaz a fix)
Idézet (08-10 08:26, `settings-tab`): „egyszerre mindig 5 szót ad be és kicsi kevés azt
szeretném állitani"
Ez az FB112-114 hiba tünete volt: a beállítás LÉTEZIK (Settings → „Napi új szó", 5–100,
5-ös lépés, alap 10), csak az FB103 WIP-kivonás lenyomta a tényleges felvételt 5-re
attól függetlenül, mit állított be. A gát szétválasztása után az intake a beállított
limitet követi, tehát a csúszka mostantól tényleg hat.

## ✅ FB116 [P2 feature], Mondja ki a szót/mondatot mindkét nyelven, üres beküldésnél is, KÉSZ (`index.tsx`)
Idézet (08-13 07:39, `word:round`): „csináld meg úgy az appot hogy ha bejön egy szó akkor
kimondja angolul is. vagy ha sapnyolul jön akkor is komondja, meg a mondatokat is. Meg azt
is írd bele, hogy ha nem irok be semmit de nyomok a következőre akkor is mondja ki a szót
és a mondatot"
Eddig az auto-felolvasás csak akkor szólalt meg, ha a kártya eleje épp a TANULT nyelv volt
(`frontLang === learned`), és a reveal is csak a tanult nyelvű oldalt mondta ki.
Fix három ponton:
- auto-felolvasás: a kártya eleje mindig elhangzik, azon a nyelven amin látszik (angol
  oldal is), szóra és mondatra egyaránt;
- tap-to-order (easy) kártya: itt a tanult nyelvű mondat maga a MEGOLDÁS, ezért nem azt,
  hanem a natív nyelvű felszólító mondatot mondja ki (spoiler-mentes, de mondatot is
  hallgat);
- flashcard reveal: a hátlap is mindig elhangzik, nem csak ha tanult nyelvű;
- üres beküldés (skip): `speakSkippedAnswer` kimondja a helyes szót ÉS a hozzá tartozó
  mondatot a tanult nyelven. Ez az FB43 „a skip maradjon csendben" szabály szándékos
  visszavonása, a user explicit kérése.

## ✅ FB117 [P1 bug], A topic-szétválasztás elszállt a sor újratöltésénél, KÉSZ (`index.tsx`, v3.0.14)
Idézet (08-13 chat, v3.0.13 telefon-teszt): „de ezt feltettem, hmm érdekes, nem látom ezt a
topicoc alapján szét választott dolgot miért?"
A Témák (tree) tab jól működik (A1.1–A1.7 sávok, 49 csempe), a hiba a tanulós oldalon volt:
a `loadCards` a kártyákat helyesen szűkíti (aktív topic szavai + a többi feloldott topic
MÁR ELKEZDETT szavai = ismétlések), de a sor kifogyásakor futó `rebuildQueueAtEnd` az
ÖSSZES feloldott topic ÖSSZES szavából töltött újra. Tehát a topic-szeparáció csak az első
sorra élt, utána más topicok vadonatúj szavai is bejöttek, miközben a fejléc továbbra is
egy topicot mutatott.
Fix: a refill pontosan ugyanazt a szűkítést használja, mint a `loadCards` (`scopedWords`),
és a `ensureCard` is csak erre a körre fut.

## Elfogadási kritérium (FB109–FB116 forduló)
- `npx tsc --noEmit` 0 hiba ✅; `npx jest` zöld **168/168** ✅ (154→168: +12 wordPhase,
  +7 új-szó-keret).
- `node scripts/audit-corpus.mjs` → P1=0, P2=0 ✅.
- `npx expo lint`: 18 probléma (8 error, 10 warning) = a HEAD-alapvonal ✅.
- ⏳ Eszköz-verify a következő buildben: jön-e gépelős SZÓ-kártya ugyanabban a sessionben
  (2 Good után), `🌱` badge egyesével fogy és `⏸`-t mutat torlódásnál, a Settings-beli napi
  limit tényleg hat, hosszú mondatnál az ℹ️ bent van, minden kártya-eleje elhangzik
  (angol is), üres beküldésnél a szó + mondat elhangzik, és a mastered % a szigorúbb
  (leírás-alapú) szabály szerint áll.

---

# 📋 Feedback, 2026-08-14 forduló (v3.0.11 telefon-teszt, A1 en→es + ELSŐ es→hu teszt)

Új sorok a `Kimacha Feedback` sheetből (FB117 utáni 13 sor, 08-14 09:17 → 21:42). Triage
2026-08-15 (Opus). A forduló végén a user ELŐSZÖR váltott át a spanyol→magyar párra, és
ott azonnal falba futott (FB129/FB130), ezért az a két jegy ment elsőként.
Idézetek a user eredeti megfogalmazásában, ne tömörítsd.
**MIND KÉSZ 2026-08-15**, kivéve FB127 fele (lásd ott): tsc 0, jest 170/170 (168→170:
+2 pairBudget), audit-corpus P1=0/P2=0, audit-corpus-hu P1=0 + exam P1=0 (most már A1-re
is), audit-corpus-en + validate-en-track OK, lint 18 = alapvonal.

## ✅ FB129 + FB130 [P0 BUG], Az es→hu kurzust nem lehetett elkezdeni, KÉSZ (`b887c02`)
Idézetek (08-14, A0, es→hu, `done`):
- 21:42:12: „Nem tudom elkezdeni a szavakat tanulni spanyol rol magyarra"
- 21:42:43: „A0 resz bugos nem kezdi el"
Gyökérok: a `card_attempts` táblának NINCS pair oszlopa, ezért a `getNewWordsToday()`
minden nyelvpárt EGYBE számolt (ez korábban szándékos volt, „napi terhelés, nem pár
szerinti"). A user aznap végigtolta az en→es napi új-szó keretét, így az újonnan
megnyitott es→hu párnál `startedToday >= limit` → `newWordIntake = 0` → a `capNewWords`
az ÖSSZES új szót kidobta (friss páron minden kártya új), utána a `capSentencesToCadence`
a mondatokat is (0 szóhoz 0 mondat jár) → üres sor → azonnal a Done-képernyő.
Fix: `card_attempts.pair` oszlop (ALTER-migráció, a régi sorok a `cards` táblából kapják
a párjukat, kétes esetben az aktívat), a `recordAttempt` mostantól kiírja, és a
`getNewWordsToday` az aktív párra szűr. MINDKÉT db-implementáció + a web IDatabase
interfészéből hiányzó `getUnlearnedWordCount` is bekerült.
Teszt: `lib/__tests__/pairBudget.test.ts` (a pár-váltás után van keret, és a saját páron
számol).

## ✅ FB128 [P2 UI], Spanyol nyelven kilógnak a szavak a Settingsben, KÉSZ (`b887c02`)
Idézet (08-14 21:40, A0 es→hu, settings-tab): „Spanzol nzelven kilognak a szavak fix this"
A sorok `space-between` flex-sorok, a címke `Text`-je pedig RN-ben alapból NEM zsugorodik,
így a hosszú spanyol feliratok („Objetivo semanal de estudio") kitolták a kapcsolót /
steppert a kártyából. Fix: a címke `flex: 1` + jobb margó (tördel), a stepper
`flexShrink: 0` (méretét tartja).

## ✅ FB118 [P2 UX], Mondja ki a csempét, amit felteszek, KÉSZ (`08c3ba8`)
Idézet (08-14 09:17, `easy:The traffic light is red.`): „amikor itt rakattintok a szóra,
és amikor beteszi felulre akkor ki is entse azt a szót amit betettem, hogy a kiejtést
halljam"
Fix: `EasySentenceCard` új `speechLocale` propja (a tanult nyelv TTS-locale-ja), és a
csempe felhelyezésekor CSAK az az egy szó hangzik el (`Speech.stop()` + `speak`), tehát a
megoldás egésze nem szivárog ki.

## ✅ FB123 [P2 UI], A felső „Learn" sáv felesleges, KÉSZ (`08c3ba8`)
Idézet (08-14 21:10:57, `easy:The lorry carries many things.`): „meg a fent Learn rész az
felesleges azt vedd ki van ott egy centi ami nem kell oda."
Fix: `headerShown: false` a Learn (index) fülre a tab-navigátorban. A képernyő saját
fejléc-sort rajzol (szint-badge, 🌱, 🔥), a navigátor címe csak helyet vitt el. A többi
fül fejléce változatlan.

## ✅ FB122 [P2 akadálymentesség], Nagy rendszer-betűnél összelóg a felső sáv, KÉSZ (`08c3ba8`)
Idézet (08-14 21:10:10): „ha valaki sokkal nagyobb betűkkel használja a telefonját mint én
akkor neki össze lóg ez a felső progress bár. csináld meg hogy ne lógjon ossze"
A fejléc-badge-sor abszolút pozíciójú a kártya felett, a ProgressMeter felirat-sora pedig
két, nem zsugorodó szövegből áll. Fix: `maxFontSizeMultiplier` a badge-eken (1.3) és a
meter feliratain (1.4), `numberOfLines={1}` + `flexShrink` a feliratokon, tehát a sor
magassága korlátos marad, a szöveg pedig nem lóg a számláló alá.

## ✅ FB119 + FB125 [P2 adat + konvenció], „He/She" helyett EGY személy, KÉSZ (`072d778`)
Idézetek (08-14):
- 21:00 (`word:He/She is an intelligent person.`): „He/She ne legyen benne válasz egyet és
  az szerint fordítsd le nem kell ez a vagy. csak egyszer ilyen egyszer olyan az is jó"
- 21:17: „most ide kell egy konvenció hogy most kiirjuk a spanyolba az él vagy ne írjuk ki
  az elt vagy ha he/She van akkor ne írjuk ki?"
**Konvenció (ez a válasz a kérdésre):** (1) az ANGOL oldal mindig EGY személyt nevez meg,
sose `he/she`, és azt, amelyiket a kártya saját példamondata használ (így kártyánként
váltakozik, ahogy a user kérte); (2) a SPANYOL elhagyja az alanyi névmást, mert az
igevégződés már megmondja az alanyt (`Es una persona inteligente.`), és az `él/ella` csak
nyomatékosításnál vagy szembeállításnál kerül ki (`Él es alto, ella es baja`).
Fix: 16 kártya `en`/`sentence_en` mezője (a1 4 db, a2 12 db), plusz a konvenció kézi ℹ️
jegyzetként 4 nyelven az a1 1108 kártyán. A spanyol nyelvtani kártyák `es` oldala
(`él/ella habla`) SZÁNDÉKOSAN marad páros: ott az azonos alak maga a tananyag.

## ✅ FB126 [P2 adat], „There is a cat in the street", hímnem vagy nőnem?, KÉSZ (`072d778`)
Idézet (08-14 21:18): „legyen úgy, hogy ha ez a mondat akkor legyen oda írva hogy male
vagy female és akkor annak megfelelően legyen a spanyol mondat is"
Kártya a1 1124. Az angol `cat` nem árulja el a nemet, a spanyol `un gato` igen, ezért a
prompt mostantól kiírja: `There is a cat (male) in the street.` + kézi ℹ️ jegyzet 4
nyelven a gato/gata (perro/perra, niño/niña) párokról.

## ✅ FB120 [P2 adat], A camión egyszer lorry, egyszer truck, KÉSZ (`072d778`)
Idézet (08-14 21:07, `easy:The lorry carries many things.`): „camion egyszer lorry nak van
fordítva egyszer meg truck nak"
Kártya a1 1699: a szó-oldal `the truck`, a mondat viszont `The lorry…` volt. A mondat
igazodik a kártyához (`The truck carries many things.`), az a2 2237 amúgy is truck.

## ✅ FB121 [P2 feature], Üdvözlő szöveg az első indításnál, KÉSZ (`b818b1b`)
Idézet (08-14 21:09): „az appot ha 1. nek nyitod meg életedve akkor az az oldal jön fel
ahol ki tudod választani, hogy milyen nyelven beszélsz és itt legyen egy első üdvözlő
szöveg ami írja, hogy köszönöm, hogy használod az appot hálás vagyok érte, mindig olyan
nyelven mint amilyen nyelven van a telefon"
Fix: az onboarding ELSŐ lépése (anyanyelv-választó) kapott egy köszönő sort. A telefon
nyelvén megy: az `initI18n()` a `expo-localization` eszköz-locale-jából állítja be a UI
nyelvet, még az onboarding előtt. i18n ×4 (`onboarding.welcome`).

## ✅ FB124 [P2 feature], Kép a „tapa" szóhoz, KÉSZ (`9112eae`)
Idézet (08-14 21:12, `word:the tapa`): „erről a szóról legyen egy kép, szedhetsz a netről
is és bele tehetsz valami jó képet ami leírja, hogy ez mi"
Fix: `lib/cardImages.ts` (kézzel karbantartott lemma→kép map, az FB86 ikon-modul
mintájára) + `assets/words/tapa.jpg`, egy CC0 fotó valódi tapas-asztalról (forrás a modul
fejlécében). A kép a kártya-front szó-sora ALATT jelenik meg, mindkét nézetben és mindkét
irányban, mert a jelentéshez tartozik.

## 📌 FB127 [P2 feature], Kép a „tálca" (bandeja) szóhoz, RÉSZBEN, jegyzet KÉSZ, kép NINCS
Idézet (08-14 21:19, `word:the tray`): „ehez is legyen kép"
A mechanizmus kész (FB124), de a szabadon felhasználható (CC0 / közkincs) találatok között
nem volt olyan tálca-fotó, ami egyértelműen tanítaná a szót (régi műtárgy-tálcák, iskolai
menzafotók). Ezért az a1 1725 kártya egyelőre kézi ℹ️ jegyzetet kapott 4 nyelven arról,
mi a bandeja (és mi nem: plato, mesa). **Teendő:** ha lesz jó kép, elég bemásolni az
`assets/words/` mappába és felvenni a `cardImages.ts` mapbe, kódot nem kell írni.

## Elfogadási kritérium (FB118–FB130 forduló)
- `npx tsc --noEmit` 0 hiba ✅; `npx jest` zöld **170/170** ✅ (168→170: +2 pairBudget).
- `node scripts/audit-corpus.mjs` → P1=0, P2=0 ✅.
- `node scripts/audit-corpus-hu.mjs` → P1=0, exam P1=0 ✅ (A0 **és** A1).
- `node scripts/audit-corpus-en.mjs` + `validate-en-track.mjs` → OK ✅.
- `npx expo lint`: 18 probléma (8 error, 10 warning) = a HEAD-alapvonal ✅.
- ⏳ Eszköz-verify a következő buildben: es→hu pár indítása A0-n (jön-e kártya), spanyol
  Settings feliratok bent maradnak-e, csempe-koppintás kimondja-e a szót, eltűnt-e a
  „Learn" fejléc, tapa-kép, és hogy az en→es napi keret nem fogyasztja-e a másik párét.

---

# 📋 Feedback, 2026-08-15/16 forduló (v3.0.27, A1 en→es)

Új sorok a `Kimacha Feedback` sheetből (FB130 utáni 4 sor, 08-15 14:05 → 08-16 09:44,
a két Done-tabos sor egy jegy). Triage 2026-08-16 (Opus). Idézetek a user eredeti
megfogalmazásában, ne tömörítsd.
**MIND KÉSZ 2026-08-16**: tsc 0, jest 190/190 (181→190: +5 answerMatch, +4 charDiff),
audit-corpus P1=0/P2=0 (es, en, hu), lint 17 probléma (8 error, 9 warning), az
alapvonal 18 volt, új hibaosztály nincs.

## ✅ FB131 [P2 UX], Inline ✓ a flashcard gyakorló-mezőn, KÉSZ (`6a8ed03`)
Chat-kérés (v3.0.16 körül, az AGENTS.md-ből eddig kimaradt): a szó-flashcard
„✏️ Írd le" gyakorló mezőjén a nyitott billentyűzet eltakarta a kártya alatti
gombokat. Fix: az input saját ✓-t kapott a mező mellé (ugyanaz az inline sor, amit
a fő gépelős kártya az FB5-ben), és az Enter is ellenőriz (`checkPractice`).

## ✅ FB132 [P1 feature], Nehézségi kapcsolók, elsőként „az ékezetek számítanak", KÉSZ (`d0239d3`)
Idézet (08-15 14:05, `word:la semana`): „legyen az appba egy olyan lehetőség, hogy
nehézségi szint, minden nyelven legyen a maga neve ez egy bele mérhető fül legyen és
ott lehessen ki be kapcsolhatni a nehézségi szinteket. marmitn különböző dolgokat.
például én most spanyolba szeretném ha mostantól kezdve az ékezetek is hibák lennének,
pontosan akarom leírni és. ost már van kapacitásom az ékezetek pontos gépelésére, de
ezt egy ilyen ki be kapcsolható dolognak akarom. 1. kérdés ezt meg lehet e oldani
2. ha igen akkor csináld meg"
**Válasz az 1. kérdésre: igen**, az ékezet-megbocsátás egyetlen helyen dől el
(`lib/answerMatch.ts` NFD-normalizálás), ezért kapcsolhatóvá tehető.
Megvalósítás:
- `lib/answerMatch.ts`: `strictAnswerMatch(answer, correct, { strictAccents })`.
  Bekapcsolva a „como estas" MÁR NEM megy át a „¿Cómo estás?"-ra; a kis/nagybetű, az
  írásjel (FB98) és a szó-belseji szóköz (FB34) továbbra is megbocsátott, az FB6
  szigor („she speak" ≠ „she speaks") változatlan.
- `lib/charDiff.ts`: a `fold` mostantól `boolean | { case, accents }`, tehát a kis/nagybetű
  és az ékezet külön hajtogatható. Szigorú módban a kimaradt ékezet HIBÁNAK látszik a
  gépelés-diffben (eddig csendben elnyelte), a helyesírás-tréner `fold=false`-ja változatlan.
- DB: `learn_settings.strict_accents` (ALTER-migráció + UPSERT setter az FB37 figyelmeztetése
  szerint), `getStrictAccents`/`setStrictAccents` MINDKÉT implementációban + interfészben
  (web: memória-tükör). Pár szerint tárolva, mert a spanyolban számít az ékezet, az angolban alig.
- UI: Settings → új „Nehézség" szekció-fejléc + kapcsoló sor magyarázó alsorral. NEM külön
  fül lett (a tab-sor tele van, lásd FB100), de saját fejlécet kapott, hogy külön helynek
  látsszon; a szekció bővíthető további szigorításokkal.
- i18n ×4: `settings.difficulty`, `settings.strictAccents`, `settings.strictAccentsHint`.
- Teszt: 5 eset answerMatch (ékezet bukik / átmegy / kis-nagybetű marad megbocsátva /
  szó-belseji szóköz marad megbocsátva / FB6 szigor él) + 4 eset charDiff.
Hatókör: a tanulós gépelős kártya, a flashcard gyakorló mező és a diff. A vizsga
(`ExamSentTypeCard`) egyelőre a megbocsátó grader marad, oda nem vittük be a kapcsolót.

## ✅ FB133 [P2 UX], „+10 / +15 új szó" és teli gombok a Done-képernyőn, KÉSZ (`d0239d3`)
Idézetek:
- (08-15 14:21, `done`): „itt lehegyen olyan opció is hogy plusz 10 új szó, és legyenek
  teli gombok. ebből ahogy most nam nekem mem egyértelmű, hogy kattintható"
- (08-16 09:44, `done`): „legyen olyan hogy ne csak plusz 5 szót lehessen hozzá adni,
  hanem plusz 10 vagy 15 ot"
Fix: `DAILY_NEW_BONUS_STEPS = [5, 10, 15]` (`lib/usageStats.ts`), a Done-képernyő
mindhármat kínálja egy sorban, `onMoreNewWords(extra)` a kattintott lépéssel
(`addNewLimitBonus(extra)`, az FB77 bónusz-mechanika változatlan, a naptári nappal lejár).
A gombok TELI-re váltottak (accent háttér, fehér félkövér szöveg, press-halványítás), és
ugyanígy a „Válassz új témát" gomb is, mert a keretes változat nem látszott kattinthatónak.
i18n ×4: `done.moreNewWords` string helyett függvény (`(n) => "+N új szó"`).

## ✅ FB134 [P2 adat], A tapa-kártyához magyarázat is kell, nem csak kép, KÉSZ (`5a7a19b`)
Idézet (08-16 08:42, `word:the tapa`): „erről még mindig nem tudom mi. tegyél egy i t
ami angolul elmagyarazza"
Az FB124 képe önmagában nem tanította meg a szót. Kézi ℹ️ jegyzet 4 nyelven az a1 1727
(`la tapa`) kártyán: ital mellé adott kis adag étel (olívabogyó, sonka, sajt,
tortilla-szelet), nem főétel, több tapasból áll össze az étkezés. A jegyzet a tanuló
saját nyelvén jelenik meg (FB75 hibrid modell, a kézi note nyer), tehát az en→es
kurzuson angolul. Csak a note-mezők mozdultak, a szó/mondat/topic érintetlen.

## ✅ FB135 + FB136 [P1 UX], Üres téma → a Done-képernyő zsákutca volt, KÉSZ (`d2debe7`)
Idézetek (08-16, A1 en→es, `done`):
- 10:24: „va néhány topic amit nem tudok ki választani, mármint kivalasztom, és
  nincs benne szó de azt irja 8/9 mint a színek, ez miért van? fix it please."
- 10:25: „done for today nél vagyok és még több szót akarok, azt akarom, hogy adjon
  új szavakat, de ilyen opció nincs itt, csináld meg"
Egy tő, két tünet. A sor az aktív témára van szűkítve (FB117), és CSAK esedékes
kártyát hoz, tehát ha a téma maradék szavai későbbre vannak ütemezve, a sor üres:
a session azonnal a Done-ra ugrik, miközben a fán a téma jogosan 8/9 (nyolc szó
elsajátítva, a kilencedik nem esedékes; a téma nem „kiválaszthatatlan", csak nincs
mit adnia). A Done ilyenkor semmit nem kínált, mert az FB133 „+N új szó" gombjai
csak a NAPI KERET kimerülésekor jelennek meg, az pedig nem merült ki.
Fix:
- `lib/topicRotation.ts` (tiszta logika, 7 teszt): `countNewWords` + a
  `nextTopicWithNewWords`, ami a kurrikulum-sorrendben első olyan témát adja,
  amiben még van érintetlen szó (az aktívat kihagyva).
- `index.tsx`: mindkét sor-építés (induló `loadCards` + sor-végi újratöltés)
  feljegyzi, hány érintetlen szó maradt az AKTÍV témában és melyik a következő
  téma, ami tud adni; `handleNextTopicWords` átállítja a kiválasztott témát és
  újraépít.
- `DoneScreen`: ha az aktív témában 0 érintetlen szó van, kiírja MIÉRT ért véget a
  session, és teli gombbal kínálja a következő témát; a +5/+10/+15 gombok
  mostantól csak akkor jelennek meg, ha a keret emelése tényleg tud kártyát adni.
- i18n ×4: `done.nextTopicWords`, `done.topicEmpty`.
Megjegyzés: a „mikor lesz esedékes" pontos idő a Stats tab „Ütemezés" kártyáján
van (FB100), ide szándékosan nem duplikáltuk.

## Elfogadási kritérium (FB131–FB136 forduló)
- `npx tsc --noEmit` 0 hiba ✅; `npx jest` zöld **197/197** ✅ (190→197: +7 topicRotation).
- `node scripts/audit-corpus.mjs` → P1=0, P2=0 ✅ (csak note-mező változott, id 1727).
- `npx expo lint`: 17 probléma (8 error, 9 warning), az alapvonal 18 volt ✅.
- `data/words/a1.json` parseable, 931 kártya ✅ (a Q2 szóbővítés külön commitokban).
- ⏳ Eszköz-verify a következő buildben: Settings → Nehézség kapcsoló, bekapcsolva bukik-e
  az ékezet nélküli gépelés és pirosan látszik-e a hiányzó ékezet; a Done-képernyőn
  +5/+10/+15 teli gomb és tényleg annyival nő-e a napi keret; a tapa-kártya ℹ️ szövege;
  üres témánál a Done magyarázata + a „Új szavak másik témából" gomb.
- ⚠️ A 3.0.28 APK az FB135/FB136 ELŐTT készült, tehát ez a két fix csak a következő
  buildben lesz a telefonon.

---

# 📋 Feedback, 2026-08-18 forduló (v3.0.30, A1 en→es)

Új sorok a `Kimacha Feedback` sheetből (FB136 utáni 5 sor, 08-16 10:24 → 08-17 22:26).
A 08-16 10:24 és 10:25 sort az FB135/FB136 már lefedi (ugyanaz a tő, a triage után
érkeztek), tehát három ÚJ jegy maradt. Triage 2026-08-18 (Opus). Idézetek a user
eredeti megfogalmazásában, ne tömörítsd.
**MIND KÉSZ 2026-08-18**: tsc 0, jest 212/212 (197→212: +6 sentenceBuildMatch,
+5 borrowNewWords, +4 borrow-smoke), audit-corpus P1=0/P2=0 (es, en, hu),
lint 17 probléma (8 error, 9 warning), az alapvonal 18 volt, új hibaosztály nincs.

## ✅ FB137 [P1 BUG], A mondat-összerakós elfogadta a rossz csempét, KÉSZ (`f3a83ab`)
Idézet (08-16 15:14, `easy:The engine makes a lot of noise.`): „nem hace kellett
volna?? ide szerintem rosszat raktam be és elfogadta"
Az adat helyes (`El motor hace mucho ruido.`, a1 id 1705), a bíráló volt engedékeny:
az `EasySentenceCard` a GÉPELŐS kártyák Levenshtein ≤2 tűrését használta, pedig itt
nincs gépelés, csak koppintás, tehát a tűrés kizárólag egy valóban rossz csempét
tudott elfedni („hacen" a „hace" helyett = 1 karakter). Fix: `sentenceBuildMatch`
(`lib/answerMatch.ts`), csempéről csempére hasonlít, csak a kis/nagybetűt és a
szélső írásjelet nézi el (a bank a mondat saját nagybetűjét és pontját hordozza).
6 teszt, köztük a rossz sorrend és a hiányzó/plusz csempe.

## ✅ FB138 [P2 UX], Gyakorláskor eltűnik a megfejtés, és újra beírható, KÉSZ (`c6e79dc`)
Idézet (08-17 21:53, `word:the flashlight`): „ha le akarok írni egy szót akkor
tűnjön el a megfejtés ahogy le akarom írni, és lehessen beírni, majd ha jó vagy ha
rossz legyen ugyan az csak irjak ki hogy jó vagy rossz, és lehessen újra beírni a
szót"
A szó-flashcard „✏️ Írd le" mezője a LÁTHATÓ megfejtés alatt ült, tehát a gyakorlás
másolás volt, és az első hiba után a mező bezárult (a jegy csak „Hibás" maradt).
Fix (`app/(tabs)/index.tsx`): `practiceHidesAnswer = practiceTyping && practiceResult
!== 'correct'`, amíg a mező nyitva van, a megfejtés (és a 🔊 gombja) rejtve; a mezőbe
íráskor a hibás ítélet törlődik, tehát ugyanabban a mezőben újra próbálható; helyes
válasznál a megfejtés visszajön az ítélettel együtt.

## ✅ FB139 [P1 feature], Új szó kölcsön a szomszéd témákból, KÉSZ (`313d17b`)
Idézet (08-17 22:26, `word:identity card`): „ha 15 új szót kell beadni, mármint mert
pont ott járunk, és a témakörből, nincsen 15 szó akkor szedjen össze a körülötte lévő
topicokból egy egy csomagba adja be akkor a kártyákat, ha 15 szó kell akkor más
témakörből is lehessenek benne szavak, csak akkor amikor a másik témakör szava van
akkor jelezze, hogy melyik szó az."
Új szó eddig KIZÁRÓLAG az aktív témából jött (FB117), tehát a „+15 új szó" annyit
adott, amennyi érintetlen szó abban a témában maradt (a példában hármat).
Fix:
- `lib/topicRotation.ts`: `borrowNewWords(candidates, activeOrder, needed)`, 
  a hiányt a kurrikulum-sorrendben LEGKÖZELEBBI témákból tölti fel (holtverseny a
  korábbi témáé), és minden kölcsönzött szó visszahozza a saját `topicId`-ját.
- `index.tsx`: `withBorrowedNewWords(...)` mindkét sor-építésben (induló `loadCards`
  + sor-végi újratöltés); ehhez a napi keret olvasása FELJEBB került, a téma-szűrés
  elé, mert az `intake` dönti el, kell-e kölcsön. A kölcsönzött szavak a
  `borrowedTopics` state-be kerülnek (szó id → TopicDef).
- Kártya-jelzés: a `borrowedBanner` sor a fejléc alatt mind a három kártya-nézeten
  (szó, gépelős, összerakós), i18n ×4 `card.fromTopic(topic)` (hu „Másik témából: X").
- Ez tudatosan lazítja az FB117 szigorú téma-szűrését: ott az volt a panasz, hogy
  MÁS téma új szava JELÖLETLENÜL jött az aktív téma fejléce alatt. Most csak akkor
  jön, ha az aktív téma nem tudja kitölteni a keretet, és meg is van jelölve.
- 5 egység-teszt + 4 smoke-teszt (`borrowSmoke.test.ts`) az igazi A1 korpuszon:
  a kölcsönzött szó tényleg létezik, tényleg a megjelölt témában van, és végigmegy
  a valódi soron (ensureCard → due sorok → buildQueue → napi keret → kadencia).

## Elfogadási kritérium (FB137–FB139 forduló)
- `npx tsc --noEmit` 0 hiba ✅; `npx jest` zöld **212/212** ✅.
- `node scripts/audit-corpus.mjs` + `-hu` + `-en` → P1=0, P2=0 ✅ (adat nem mozdult).
- `npx expo lint`: 17 probléma (8 error, 9 warning), alapvonal 18 ✅.
- ⏳ Eszköz-verify a 3.0.30 APK-n: összerakós kártyán a majdnem-jó csempe MOST bukik;
  a szó-kártya „✏️ Írd le" mezőjénél eltűnik a megfejtés és hiba után újra beírható;
  „+15 új szó" a szűk témában is 15 kártyát ad, és a más témából jött kártyák fölött
  ott a „Másik témából: …" sor.

---

# 📋 Feedback, 2026-08-18/19 forduló (v3.0.30, A1 en→es + ELSŐ hu→en teszt)

Új sorok a `Kimacha Feedback` sheetből (FB139 utáni 9 sor, 08-18 09:50 → 08-19 18:34).
Triage 2026-08-20 (Opus). Idézetek a user eredeti megfogalmazásában, ne tömörítsd.
**MIND KÉSZ 2026-08-20**: tsc 0, jest 228/228 (225→228: +10 budget/pause, +6 speech,
−3 a régi intake-tesztek átfedése helyett smoke), audit-corpus P1=0/P2=0 (es, en, hu),
lint 17 probléma (8 error, 9 warning), az alapvonal 18 volt.

Ebben a fordulóban külön kérés is jött (nem sheet-sor, chat):
„állítsd be úgy hogy ha feedbackeket kapsz akkor lásd, hogy melyik kártyáról és
melyik verziójú kimachaból kapod" → lásd a forduló végén.

## ✅ FB140 [P0 BUG], A „+5 új szó" gomb néma maradt A0-n, KÉSZ
Idézet (08-18 20:51, `word:the face`): „5 új szóra kattintottak az A0 szinten és nem
dobott fel többet hanem újra feldobta, mintha ott valami hiba lenne"
Gyökérok: a WIP-szünet (FB112–FB115) `unlearned >= 2 × (limit + bonus)` küszöbe a
bónuszt is beleszámolta a PLAFONBA, tehát a „+5" tap egyszerre emelte a keretet és a
falat: 5-ös limitnél és 20 félkész szónál a plafon 10→20 lett, `20 >= 20`, az intake
maradt 0, és a sor változatlanul épült újra. Fix (`lib/newWordBudget.ts`): a szünet
csak az ÁLLÓ limitet tartja vissza, a kifejezett kérés (bonus) átmegy rajta,
`Math.min(leftToday, bonus)` erejéig; bonus nélkül a viselkedés változatlan.

## ✅ FB141 [P0 BUG], hu→en A0 és A1 „nem dobja ki a szavakat", KÉSZ
Idézet (08-19 18:27, `done`): „Magyarról angolra tanulok és A0 szinten lett és itt sem
dobja ki a szavakat mármint az a0 szint bugos." és (18:28, `done`): „A1 és szintnél is
ugyan ez a hiba"
Ugyanaz a tő, mint az FB140: friss kurzusban minden szó ÚJ, tehát ha az intake 0
(WIP-szünet), a `capNewWords` az egész sort kiüríti, és a tanuló azonnal a Done
képernyőn köt ki, ami „bugos szint"-nek látszik. Az adat és a feloldás rendben volt
(en A0 10 topic / 100 szó, en A1 24/384, id-terek diszjunktak, `hu→en A1` smoke
addig is zöld volt). Fix: az FB140 intake-javítás + a Done képernyő MEGMONDJA, miért
nincs új szó (lásd FB142), és a `hu→en A0` bekerült a `sessionSmoke` kurzuslistájába.

## ✅ FB142 [P1 BUG+feature], Csak ismétlés jön, új szó nem, és nem látszik miért, KÉSZ
Idézet (08-18 21:29, `word:mushroom`): „valahogy jelölje az app, hogy mennyi szó van és
mennyi ismétlődik, és ahogy ezek a körök mennek mert pl most nem tudom mi van az
appal, hogy már rég óta 0 új szót ír de mintha újra és újra régi szavakat bedobna
ismétlésre. ami am nem baj, de újakat nem tanulok ami viszont baj"
A WIP-szünet önfenntartó volt (a félkész halom csak akkor apad, ha azok a szavak
kinőnek), és semmi nem mondta ki. Fix:
- `newWordPauseReason()` (`lib/newWordBudget.ts`): `none` / `congested` / `daily-limit`.
- `applyQueueSupply()` (`index.tsx`) mindkét sor-építésnél feljegyzi, miből áll a sor
  (új szó vs. ismétlés) és mekkora a félkész halom.
- Done képernyő: „Ebben a körben: N új szó, M ismétlés." + torlódásnál sárga/accent
  sor: „Most nincs új szó: N félig tanult szó vár még. Ha mégis kérsz, nyomd meg a
  »+« gombot." (i18n ×4). A „+N új szó" gombok az FB140 után tényleg adnak is.

## ✅ FB143 [P1 BUG], A billentyűzet nem megy le félre-kattintásra, KÉSZ
Idézet (08-19 18:27, `done`): „Ja és nem megy le a billentyűzet ha félre kattintok"
A `keyboardShouldPersistTaps="handled"` csak a görgetőn belüli üres területre volt jó,
a kártya és a feedback-modal elnyelte a koppintást. Fix: a gépelős kártya és a
helyesírás-kártya kerete `Pressable` → `Keyboard.dismiss()`, a szó-kártyán a gyakorló
mező nyitva állapotában a kártyakoppintás is ezt teszi (nem fordít újra), a
feedback-modal sötét háttere szintén, és mind a három tanuló-görgető kapott
`keyboardDismissMode="on-drag"`-ot.

## ✅ FB144 [P1 BUG], hu→en „brother" kiejtése rossz, KÉSZ
Idézet (08-19 18:34, `word:brother`): „A fiú testvért nem ejti ki rendesen"
Az adat („fiútestvér") és a locale (`hu-HU`) is helyes volt: a telefonon nincs magyar
TTS-hang telepítve, ilyenkor az Android némán az alapértelmezett (angol) hanggal
olvassa fel a magyar szót. Rossz nyelvű felolvasás rossz kiejtést tanít, ezért:
- `lib/speech.ts`: egyszer betölti a `getAvailableVoicesAsync()` listát, és ha az adott
  nyelvhez nincs hang, INKÁBB NEM mond semmit (üres/hibázó lista = minden nyelv oké,
  vagyis a régi viselkedés); minden felolvasás ezen megy át (12 hívási hely).
- Beállítások: sárga sor nevesíti a hiányzó hangot („Nincs telepítve hang ehhez a
  nyelvhez: Magyar…"), mert ez telefon-beállítás, nem app-hiba. 6 teszt.

### ⚠️ FB144 MÁSODIK KÖR (2026-08-22), a fenti diagnózis HIÁNYOS volt
Kálmán visszakérdezett („a magyar szavakat is angolul ejtette ki, ez javítva lett?"),
és a valódi ok az `expo-speech` 56.0.3 Android-moduljában van
(`node_modules/expo-speech/android/.../SpeechModule.kt`, `speakOut`):

    textToSpeech.language = options.language?.let {
      val locale = Locale(it)                    // Locale("hu-HU"), NEM forLanguageTag!
      ... isLanguageAvailable(locale) ... else Locale.getDefault()

A `Locale("hu-HU")` nem BCP-47 elemzés: a NYELV maga a `"hu-hu"` string lesz, a
`getISO3Language()` erre `MissingResourceException`-t dob (JDK 17-en lemérve), az
Android ebből `LANG_NOT_SUPPORTED`-ot csinál, a modul pedig `Locale.getDefault()`-ra
esik vissza. **Vagyis az app által küldött MINDEN régiós tag (`hu-HU`, `es-ES`,
`en-US`) eldobódott Androidon, és a telefon alapértelmezett hangja olvasott fel
mindent.** iOS-t ez nem érinti: `AVSpeechSynthesisVoice(language:)` BCP-47-et vár.
Javítás (`0e48287`, `ff6e28e`, `2de521f`):
- `speechTag()`: Androidon csupasz nyelvkód (`hu`), iOS-en a teljes tag.
- `voiceIdFor()`: ha az eszköz megnevez konkrét hangot, annak az azonosítója is megy
  (`setVoice` a locale UTÁN fut, tehát felülírja a találgatást); a választás
  RÉGIÓ-tudatos (es-MX kérésre nem a kasztíliai hang), azon belül enhanced > default.
- `speechLang('es')`: **es-ES → es-MX** (user-döntés 2026-08-22, CDMX a cél; a korpusz
  amúgy is kevert: coche ÉS carro, móvil ÉS celular, ordenador ÉS computadora).
- Angol marad `en-US` (user-döntés), pedig az en-ág szókincse brit (colour ×8,
  trousers, lift, flat, chemist, queue, maths) — ha egyszer zavaró lesz, egy sor.
- Nyelv-audit a 12 felolvasási helyre: mindenhol a szöveg nyelve = az átadott locale
  (szó-kártya front/back, easy-mondat natív prompt, skip-felolvasás, gyakorló mező,
  helyesírás-képernyő, csempe-koppintás). Vizsga-képernyők egyáltalán nem beszélnek.
- Gate: tsc 0, jest **239/239** (+11), lint 17 (alapvonal 18).
- ⏳ Eszköz-verify: 3.0.32 APK kell hozzá, a Drive-on lévő 3.0.31 még a régi kódot viszi.

## ✅ FB145 [P2 UX], A telefon szó-javaslata elárulja a megfejtést, KÉSZ
Idézet (08-18 20:49, `sentence:Compro un billete de tren.`): „azt meg tudod csinálni,
hogy az applikációval kikapcsoltatod a telefonom auto complitjét? hogy itt felajálnja
a szavakat ez zavaro"
A mezőkön csak `autoCorrect={false}` volt, ami a javítást tiltja, a javaslat-sávot és
az autofillt nem. Fix: `lib/inputProps.ts` (`autoComplete: 'off'`, `spellCheck: false`,
`importantForAutofill: 'no'`, `textContentType: 'none'`) mind az 5 válasz-mezőn
(gépelős kártya, gyakorló mező, helyesírás, 2 vizsga-kártya + a mondat-gyakorlás).
A `keyboardType: 'visible-password'` minden Gboardon megölné a sávot, de elviszi az
ékezetes billentyűzetet is, ezért kimaradt.

## ✅ FB146 [P1 feature], A mondatot is le lehessen írni, KÉSZ
Idézet (08-18 09:50, `sentence:Como una galleta con leche.`): „most ezt is le akarnám
írni legyen egy ilyen opció a mondatok ál miután feljött"
Az FB138 gyakorlása (szó-kártya „✏️ Írd le") most az összerakós mondatkártyán is ott
van: az ellenőrzés UTÁN jelenik meg, nyitott mezőnél elrejti a megoldást (a csempesor
és a helyes-mondat sor is), hibázás után ugyanabban a mezőben újra próbálható, és a
`strictAnswerMatch` ugyanazzal az ékezet-szabállyal bírál, mint a gépelős kártyák.

## ✅ FB147 [P2 feature], Heti cél elérve = nagy gratuláció + zöld „kész", KÉSZ
Idézet (08-18 20:36, `settings-tab`): „legyen egy szöveg ami gratulál, hogy elértem a
heti limitet ami a cél, valami hatalmas nagy. és a célnál írja is ki hogy kész zölddel"
- Beállítások: a heti cél sor felett 🏆 + „Megvan a heti célod!" (26 pt, zöld) +
  „N óra tanulás ezen a héten, a célod M óra volt. Óriási!"; magán a cél-értéken
  zöld „✓ KÉSZ" címke.
- Statisztika: az eddigi apró zöld sor helyett 🏆 + 24 pt-os gratuláció. i18n ×4.

## ✅ FB148 [P2 BUG], Felugró üzenetek nyelve, KÉSZ
Idézet (08-18 21:07, `easy:I wash the dishes after eating.`): „nézd meg, hogy a felugró
üzenetek, mindog azon a nyelven vannak e amin a játékos tanul"
Átnézve: a percenkénti/mérföldkő/nap-váltó toast és a napi köszöntés már a TANULT
nyelven szól (FB63), a téma-váltó tájékoztató szándékosan a felület nyelvén marad.
Két tényleges hiba volt:
- a téma-kész / al-szint-kész ünneplő overlay a felület nyelvén jött → `stringsFor(learned)`,
- a Done képernyőn két BEÉGETETT magyar szöveg („🎓 Vizsga", „(vizsga: 80%)") minden
  felületi nyelven magyarul látszott → `s.exam.tag` és új `s.exam.threshold(80)` ×4.

## ✅ Feedback-sor: melyik kártya és melyik build (chat-kérés, 2026-08-20)
„állítsd be úgy hogy ha feedbackeket kapsz akkor lásd, hogy melyik kártyáról és melyik
verziójú kimachaból kapod". A kártya eddig is ment (`Current Card` oszlop), a build nem.
- `lib/appBuild.ts`: `appBuildTag()` = `v3.0.30 (30)` az `expoConfig`-ból (a Beállítások
  FB82-es verzió-sora is ezt használja már, egy forrás).
- `FeedbackModal`: a build kétszer megy ki. Külön `appVersion` mezőben (arra az esetre,
  ha az Apps Script kap egy hatodik oszlopot), ÉS a `currentCard` elé fűzve
  (`v3.0.30 (30) · word:brother`), mert a JELENLEGI sheet-script csak az öt meglévő
  oszlopot írja, és a triage-nek most kell a verzió.
- Az Apps Scriptet innen nem tudom szerkeszteni (az OAuth-tokenben nincs script-scope),
  ezért ha külön „App Version" oszlop kell, a scriptbe kézzel kerüljön be a
  `e.parameter.appVersion` kiírása.

## Elfogadási kritérium (FB140–FB148 forduló)
- `npx tsc --noEmit` 0 hiba ✅; `npx jest` zöld **228/228** ✅.
- `node scripts/audit-corpus.mjs` + `-hu` + `-en` → P1=0, P2=0 ✅ (adat nem mozdult).
- `npx expo lint`: 17 probléma (8 error, 9 warning), alapvonal 18 ✅.
- ⏳ Eszköz-verify a következő APK-n: a „+5 új szó" torlódás mellett IS ad 5 kártyát;
  a Done képernyő kiírja a kör összetételét és a torlódás okát; a billentyűzet lemegy
  félre-koppintásra (kártya, helyesírás, feedback-modal); nincs szó-javaslat a
  válasz-mezőkben; az összerakós mondat után van „✏️ Írd le"; heti cél elérve = 🏆
  gratuláció + zöld „✓ KÉSZ"; magyar hang nélküli telefonon a magyar szöveg NÉMA és a
  Beállítások megmondja, mit kell telepíteni; a feedback-sor `Current Card` oszlopa
  `v3.0.31 (31) · word:…` alakú.

## 🔎 Megjegyzés (nem hiba, de figyelni kell)
A `data/words.ts` kommentje szerint az ágak id-terei diszjunktak („shared Spanish set
<= 3007"), de az `es` C1 lista 6990-ig megy, tehát 266 id ÜTKÖZIK a `hu` ág (6001–7006)
id-jeivel. Élő hatása most nincs (a kártyák `pair`-re vannak szűrve, és a
`findWordById` előbb az ág-indexben keres), de ha valaha pair-független lookup kerül a
kódba, ez azonnal keresztbe tesz. Adatmozgatás nélkül csak a komment pontatlan.

---

# 📋 Feedback, 2026-08-20/26 forduló (v3.0.31 telefon-teszt)

Forrás: `Kimacha Feedback` sheet, a FB148 óta érkezett 9 sor.

## ✅ FB149 [P2 feature], 1 óra után negyedóránként gratuláció, KÉSZ
Idézet (08-20 16:55, `settings-tab`): „1 óra után 15 percenként gratuláljon az app és.
indig más szöveggel. legyen benne valami kreativitás"
- `lib/usageMilestones.ts` (új): `isDailyMilestone()` = a régi 30/60 + minden 15. perc
  60 fölött (75, 90, 105 …), `pickMilestoneLine()` = véletlen sor a listából (FB108
  mintája, tehát ismétlődik is), `{min}` és `{hours}` behelyettesítéssel (90 → „1.5").
- `usageTimer` a listás `DAILY_MILESTONES.includes()` helyett ezt hívja; a 60 maga
  marad sima napi mérföldkő, tehát nem ünnepel kétszer.
- `UsageToast`: 60 fölött a `usage.milestoneLong` poolból húz, nyelvenként 8 sor
  (hu/en/es/de), a TANULT nyelven, mint az FB63 óta minden mérföldkő.
- Teszt: `lib/__tests__/usageMilestones.test.ts`, 6 eset (határok, poolok, {hours}).

## ✅ FB150 [P1 feature], Mondat szavára koppintva helyesírás-gyakorlás, KÉSZ
Idézet (08-22 12:39, `sentence:El calabacín es una verdura verde.`): „ha rákattintok …
akár arra hogy calabacín akár arra hogy courset … bele tegye az olyan szavak közé, ahol
ezeknek a helyesírását tudom gyakorolni"
- `data/words.ts`: `findWordByText(token, field, lang)` + `normalizeWordToken()`. A
  helyesírás-lista (FB39) szó-id-t tárol, a koppintás viszont folyó szöveg egy tokenjét
  adja, ezért kell szöveg→kártya feloldás. Elnéző a kis/nagybetűre, a mondat-írásjelekre
  és a szótári névelőre (`el calabacín` ↔ `calabacín`), és megtalálja a többszavas
  szócikk utolsó szavát is (`hablas` → `tú hablas`). Az ÉKEZETET nem hagyja figyelmen
  kívül: pont az a gyakorlás tárgya. Ág-tudatos, mint a `findWordById`.
- `components/TappableSentence.tsx` (új): szóközönként darabolt, koppintható szöveg,
  a képernyő dönt és színez (zöld + aláhúzás = listába került, sárga = nincs kártyája).
- `app/(tabs)/index.tsx`: a gépelős kártya kérdése + megoldása, és a felfedős kártya
  megoldása + (felfedés UTÁN) a kérdése koppintható. A felfedés előtt szándékosan nem:
  ott egy koppintás a kártyán még a megoldást nyitja.
- i18n ×4: `card.spellingTapHint`, `spellingAddedWord`, `spellingNoCardWord`.
- Teszt: `lib/__tests__/wordLookup.test.ts` +7 eset.

## ✅ FB151 [P2 adat], „black pepper" = `la pimienta`?, KÉSZ
Idézet (08-23 17:11, `word:black pepper`): „ez nem la pimienta negra?"
Igaza van annyiban, hogy a két oldal nem fedte egymást: az angol oldal `black pepper`
volt, a spanyol viszont a sima `la pimienta`, tehát a „negra" hiányzott a megfejtésből.
A spanyol szó önmagában is a fekete borsot jelenti, a `pimienta negra` csak a fehér
borssal szembeállítva kell, ezért az angol oldal lett `pepper`, és a kártya kapott egy
ℹ️ jegyzetet (a `pimienta` / `pimiento` csapdával együtt), nem a spanyol szó változott.

## ✅ FB152 [P2 BUG], `¿Cuándo comes?` kiejtés, a záró „s" lemarad, KÉSZ (eszköz-verify hátra)
Idézet (08-23 17:16): „itt mint ha nem lenne jó a kiejtés, az s mintha lemaradna"
Az Android TTS az utolsó fonéma-határon állítja le a hangfolyamot, ezért a réshangra
végződő mondat („comes", „hablas", „tres") záró /s/-e lecsúszhat. A `lib/speech.ts`
mostantól Androidon egy szóközzel megtoldva küldi a szöveget, hogy legyen mire
befejeznie; iOS változatlan. Teszt: `speech.test.ts` +2 eset. Telefonon még hallgatni kell.

## ✅ FB153 [info], `Comemos en la terraza del restaurante.` birtokos, KÉSZ (jegyzet)
Idézet (08-24 06:15): „itt miért nincs birtokos szerkezet?"
Van, csak nem `'s` alakú: a spanyolban a birtokviszony mindig `de` + birtokos, és a
`de + el` mindig `del`. A `la terraza del restaurante` tehát pontosan „az étterem
teraszát" jelenti. A kártya ℹ️ jegyzetet kapott ×4 nyelven.

## ✅ FB156 [P2], `Jugamos al voleibol` — miért „al"?, KÉSZ (jegyzet)
Idézet (08-25 17:49, `easy:We play volleyball on the beach.`): „itt használja a l ittle
legyen egy i betűk hogy miért"
A `jugar` sportnál `a` elöljárót kap (jugar a + sport), és az `a + el` mindig `al`-lá
olvad. ℹ️ jegyzet ×4 nyelven, a `tocar la guitarra` szembeállítással.

## 🔁 FB154 + FB155 + FB157 [P1 adat, NAGY], Szó-specifikus és tényadatos mondatok, TESZT-BATCH KÉSZ, a többi jóváhagyásra vár
Idézetek: „szombaton nem dolgozunk ezzel az a baj hogy vasárnap sem, szóval nem
specifikus" (08-25, `word:Saturday`); „mennyi a protein 100 gramm csirkehúsban … keresd
ki az adatot és azzal csináld meg a mondatot és odaírhatod egy ilyen i betűbe hogy mi a
forrása" (08-25, `easy:Turkey is a white meat.`); „ez is egy eléggé rövid mondat és nem
specifikus" (08-26, `word:home cooking`).

Közös hiba: a példamondat IGAZ MARAD, ha a célszót testvérre cseréled, tehát nem tanít
semmit arról a szóról. Ez mérhető: vedd ki a célszót, és nézd meg, hány kártya osztozik
a maradék kereten.
- `scripts/sentence-specificity.mjs` (új): SHARED (közös keret), GENERIC (csak kategóriát
  mond), SHORT (5 szónál rövidebb), ABSENT (a mondat ki sem mondja a szót; igéket kihagy,
  mert a ragozás elviszi a tövet). A1: 464 kártya a sorban induláskor.
- `.claude/skills/sentence-facts/SKILL.md` (új): a mondat-szabvány (csere-teszt, kimondja
  a szót, hordoz információt, szint-tiszta, 4 nyelv egyezik) + hova kerül a tény. A tény a
  MONDATBA megy, ha a szint szókincse elbírja; ha nem (gramo, proteína), akkor a kártya
  `note_*` mezőjébe, forrással, és az app ℹ️ gombja mutatja.
- Teszt-batch (10 A1 kártya): `el pavo`, `sábado`, `la comida casera`, `el guisante`,
  `el calabacín`, `la lana`, és a „Me duele la #" keret négy kártyája (`la pierna`,
  `la espalda`, `la rodilla`, `la oreja`). Öt kártya forrásolt tény-jegyzetet is kapott
  (Britannica, RAE, USDA FoodData Central ×2, FAO FAOSTAT).
- Kapu a batch után: audit P1=0, P2=0 ✅; `sentence-qa` 0 találat ✅; specificity 464 → 452.
- Kálmán a batch-et jóváhagyta (2026-08-26, „ez igy jó"), de a queue többi részét
  KÉSŐBBRE kérte. A maradék ~452 A1 kártya áll, amíg nem kéri a következő szeletet.

## Elfogadási kritérium (FB149–FB157 forduló)
- `npx tsc --noEmit` 0 hiba ✅; `npx jest` zöld **254/254** ✅.
- `node scripts/audit-corpus.mjs` + `-hu` + `-en` → P1=0, P2=0 ✅.
- `npx expo lint`: 17 probléma (8 error, 9 warning), változatlan alapvonal ✅.
- ⏳ Eszköz-verify a következő APK-n: egy órán túl negyedóránként MÁS gratuláció jön;
  a mondat szavára koppintva zöld lesz a szó és a Beállítások helyesírás-számlálója nő;
  a `¿Cuándo comes?` végén hallatszik az „s"; a pimienta / terraza / voleibol kártyán
  ott az ℹ️; a 10 átírt kártya új mondata jelenik meg.

---

# 📋 Feedback, 2026-08-26/28 forduló (v3.0.32 + v3.1.0 telefon-teszt)

Forrás: `Kimacha Feedback` sheet, a FB157 óta érkezett 7 sor.

## ✅ FB158 + FB159 [P1 UX], Nem látszik, hogy új szót tanulok vagy régit ismétlek, KÉSZ (`46ff00c`)
Idézetek (08-26 12:43, `word:the volleyball`): „kellene valami különbség, hogy tudjam,
hogy most a régi szavakat ismételem, vagy az újakat tanulom"; majd (08-26 16:44,
`word:belly`, 3.0.32): „még mindig nem látom, hogy most ismétlek vagy új szavakat
tanulok. Ezt old meg".
A 🌱 fejléc-jelvény eddig is ott volt, de az a NAPI KERETET számolja, nem az adott
kártyáról szól. Most a kártya fölött álló, kitöltött pirula mondja meg:
- `app/(tabs)/index.tsx`: `newTodayIds` megjegyzi, melyik szó lépett `reps === 0`
  állapotban a sorba; a szó az egész munkamenetre „új" marad, különben a fázis-1 /
  fázis-2 requeue (ott már `reps > 0`) félúton átbillentené a címkét.
- Mindhárom kártyatípus fölött ott a pirula: 🌱 zöld „Új szó" / 🔁 kék „Ismétlés".
- i18n ×4: `card.newWordTag`, `card.reviewTag`.

## ✅ FB160 [P1 UX], Hosszú Check gomb, hüvelykkel elérhető nyitott billentyűzettel, KÉSZ (`7e5d55a`)
Idézet (08-26 18:27, `word:son-in-law`): „alakítsd át a check gombot … hogy pont ott
legyen … felnyílt billentyűzettel is meg lehessen nyomni meg ha egy kicsit jobbra
lenne, akkor jobban elérném a jobb kezem hüvelyk ujjammal … lehet meg kellene
csinálni, hogy hosszú legyen a gomb"
Az FB5 óta a mező MELLETT volt egy kis ✓ négyzet. Most a mező és a gomb egymás alatt
van: a gomb 82% széles, 54 pt magas, JOBBRA igazított sáv, felirata „✓ Ellenőrzés".
Mind a két válaszmező kapja (gépelős kártya, ✏️ gyakorló mező), és a helyesírás-képernyő
gombja is ugyanígy jobbra húzott hosszú sáv lett.

## ✅ FB161 [P2], „Megváltoztattad az angol hangot?", KÉSZ (`9526a1d`)
Idézet (08-26 18:31, `word:the grandson`): „megváltoztattad az angol hangot, mintha más
lenne? ha véletlenül igen  változtasd vissza"
Igen, mellékhatásként. Az FB144 második köre nyelvenként KONKRÉT hang-azonosítót
tűzött ki (`voiceIdFor`, enhanced > default), hogy a spanyol es-MX legyen és a magyar
ne angolul szóljon; az angol csak „vitette magát" ezzel, és lecserélődött a megszokott
rendszerhangra. A `voiceIdFor` mostantól angolra `undefined`-ot ad, tehát a motor a
saját alapértelmezett hangját használja. A locale-kezelés (FB144 lényege) változatlan.

## ✅ FB162 [P0/P1], „A játékok bugosak, teszteld le őket", 4 HIBA JAVÍTVA (`a3ab54f`, `f624cba`, `85f3614`, `4295ce1`)
Idézet (08-27 23:08, `word:to water`, v3.1.0): „waoo a jatekokeleggé bugosak wz elsőt
próbáltam ki. Azt meg tudod csinálni, hogy elinditod a jatekot és játszod, és mint egy
tesztelő megnézed mi a bug? yes or no"

**Teszt-módszer (ismételhető, nem kell hozzá telefon és emulátor sem):** a repó web
targete él (`react-native-web` + `database.web.ts`), ezért
`npx expo export --platform web --output-dir <dir>` → `python3 -m http.server` →
`agent-browser` (Playwright CLI) hajtja a UI-t. Az onboarding és a szótanulás
végigkattintható, a `getLearnedPool` gate-je (phase ≥ 1) miatt a játékokhoz ~20-36
gyakorolt szó kell, ezt a Beállítások „Napi új szó" felhúzása + egy nagy topic
(Gyakori Igék, Idő) végigtanulása adja. A web DB memóriában él, tehát MINDEN
böngésző-újratöltés nulláról indul: egy teszt = egy hosszú `agent-browser batch`.
Korlát: a `PanResponder`-es húzás (szókereső) csak VALÓDI beviteli eseménnyel megy
(`agent-browser drag`), a szintetikus touch-eseményeket a responder-rendszer eldobja.

**1. hiba, P0, minden élet elfogyása KIFAGYASZTOTTA a képernyőt.** Három rossz
koppintás a Szó-esőben → „Something went wrong — Cannot access 'X' before
initialization", játék-vége kártya helyett. Ok: a `useGameSession.loseLife()` a
`setLives` UPDATER FÜGGVÉNYÉN BELÜL hívta az `onLivesDepleted` visszahívást, a React
pedig a render fázisban futtatja az updatereket, így a word-rain `() => finishRun()`
closure-je egy még nem inicializált `const`-hoz nyúlt (TDZ). Az updater most tiszta, a
játék-vége mellékhatások (`setOver` + callback) render UTÁN, effektben futnak. A
bubble-pop ugyanezt a callback-alakot használja, azzal együtt javult.

**2. hiba, P1, a buborékok EGY sorban, egymáson lógtak.** A bubble-pop a word-rain
sáv-számolóját használta, ami a táblát `count` oszlopra osztja: 12-16 buboréknál ez
~25 px sáv egy 68 px-es buboréknak, tehát az egész kör egy sorba torlódott és a szavak
két betűre csonkolódtak („pe", „el a", „nece"). Új `bubbleSlot()` rácsra teszi őket
(annyi oszlop, amennyi tényleg elfér, 390 dp-n 5), a további sorok a tábla ALATT
indulnak és hullámokban úsznak fel, sor-arányos időtartammal (azonos sebesség).

**3. hiba, P1, az eső szavak kilógtak a tábláról.** A word-rain fix 40 px-es
fél-szélességgel pozicionált (`index * lane + lane / 2 - 40`), miközben a csempe olyan
széles, mint a szava: 5-6 eső szónál az első csempe a tábla BAL SZÉLÉN KÍVÜL indult, és
egy hosszú szó bármelyik beállításnál rálógott a szomszédjára. Most `fallingLane()`
adja a sáv x-ét és szélességét, a csempe pontosan egy sáv széles, a szöveg középre
zárt és egy sorra vágott.

**4. hiba, P2, értelmetlen ccat-utasítás.** A „koppints arra, ami X ÉS Y" kérdés a
bubble-pop TÖBBES SZÁMÚ nem-címkéjét („palabras femeninas") tette egyes számú keretbe:
„Toca el que es Tiempo Y palabras femeninas." / „Koppints arra, ami Idő ÉS nőnemű
szavak." Új `genderAdjF`/`genderAdjM` melléknevek ×4 nyelv és mondatnak is jó keret:
„Toca la palabra del tema „Tiempo" que además sea femenina."

**Végigjátszva, hibátlan:** Szó-eső (kör-lánc, kombó-pontozás, játék vége), Szókereső
rács (mind a 6 szó BENNE van a rácsban, a húzás pontoz: 300 pont / 1-6), Sztori-mód
(jelenet-lánc, kérdés-válasz), Tanácsadó beszélgetés (checklist-számláló indul),
Ragozás-slot, Kakukktojás (10/10 végigjátszva), „Melyik a helyes?", Hasonló szavak
(magyarázat → 4 kérdéses drill), Igaz vagy kamu? (állítás → forrásolt magyarázat),
CCAT-felkészítő (kategória- és szöveges-feladat kérdések). Mondat-Tetris szándékosan
„Hamarosan".

**Vizuális átfésülés (2026-08-29, „nekem elég sok össze csúszás volt amit láttam"):**
a `window.vcheck()` detektor minden LÁTHATÓ szöveg-levél dobozát összeveti (metsző párok
+ a nézeten kívülre lógó elemek), és csak azokat nézi, amik a saját középpontjukban
tényleg hit-testelhetők (az exportált SPA egyszerre tartja életben a tab-képernyőket,
enélkül a Tanulás és a Beállítások szövegei „egymáson" lennének). Végigfuttatva 390 és
320 px szélességen: Tanulás, Játék-hub, mind a 12 játék, Statisztika, Beállítások, Témák
→ **0 valódi átfedés**. Egyetlen találat maradt: a lebegő 💬 visszajelzés-gomb görgetés
közben ráül egy játék-csempe szövegére, ez sima FAB-viselkedés, nem nyúltam hozzá.
A nagy rendszer-betűméret (Android `font_scale`) böngészőben NEM szimulálható
(a `maxFontSizeMultiplier` natív-only), az emulátoron/telefonon ellenőrizendő.

**Nem sikerült végigvinni:** a Memóriapárosítót a bot nem tudta kipörgetni (a lapozás,
a felfedés és a vissza-fordítás bizonyítottan jó, de a „minden pár megvan" záró
képernyőt nem láttam) — ez maradt a telefonos ellenőrzésre.

**Egy megfigyelés MEGOLDVA, egy DÖNTÉSRE VÁR:**
- ✅ **„Ezt Már Tudom" szavai nem számítottak a játék-poolba** — KÉSZ (`97d599d`).
  A `buryCard` `buried = 1`-et ír, a `getAllWordCards` pedig kiszűrte a buried lapokat,
  tehát a fejléc „Ismert Szavak: 20"-at mutatott, a Játék fül meg ugyanakkor „1 szó van
  meg eddig, még 19 kell". Kálmán döntése (2026-08-28): „kerüljön be de ne azokat
  priorizálja. Nem baj ha benne van vagy ismert, de pont az lenne a lényege a
  játékoknak hogy amivel aktuálisan szenvedsz sző azokat hozza fel és azokat
  gyakorold." Megvalósítás:
  - `getAllWordCards` visszaadja a buried lapokat is, `buried` jelzővel (natív ÉS web).
  - `vocabPool`: minden entry kap `known`-t és egy `struggle` súlyt
    (`struggleWeight`: egy lapse duplán számít, a befejezetlen fázis-létra egyszer,
    a buried szó 0.25, a még nem látott top-up szó 0.5).
  - A pool SÚLYOZOTT véletlen sorrendben jön vissza (`weightedShuffle`,
    Efraimidis-Spirakis), tehát amelyik játék a lista elejéből vesz, az azt gyakoroltatja,
    amivel a tanuló épp szenved; a word-rain a kör célszavát `pickStruggler`-rel húzza
    (súly-arányos), nem egyenletesen.
  - MEGJEGYZÉS a számláláshoz: a fejléc „Ismert Szavak" egy `COUNT(*)` a kártya-sorokon
    (`(state >= 2 AND reps - lapses >= 3) OR buried = 1`), tehát a másodszori „Ezt Már
    Tudom" NEM növeli újra ugyanazt a szót, és a buried kártya a due-lekérdezésből is ki
    van zárva (`buried = 0` szűrő), tehát ismétlésre sem jön vissza.
- ✅ **A Ragozás-slot igeidő-alapértelmezése** — ELDÖNTVE, MIND A HAT MEGY.
  A felvetés az volt, hogy A0/A1-en a `quise / quisiste / quisieron` olyan igeidő, amit
  a kurzus még nem tanított, tehát szűküljön-e az alapértelmezés jelen időre. Kálmán
  döntése (2026-08-29): „menjen minden idő", tehát `presente`, `indefinido`,
  `imperfecto`, `futuro`, `condicional` és `subjuntivo_presente` mind BE alapból, a ⚙️
  lapon lehet szűkíteni. A motor (`lib/games/conjugate.ts`) mind a hatot tudja
  (szabályos végződések + rendhagyó táblák), a web-playtest futuro és imperfecto
  kérdéseket is adott, a magyarázat megnevezi az igeidőt.

## ✅ FB163 [P1 feature], Ismétlés közben egyesével csorogjanak be az új szavak, KÉSZ (`377e0a9`)
Idézet (08-28 11:48, `word:the garden`, v3.1.0): „legyen úgy, hogy ha ismétlem a
szavakat akkor is tegyen bele egy új szót azt nyomja végig a 3 típusát, és kozben
menjen a régi szavak ismétlése majd közben, tegyen bele új szókat miközben ismételek
de egyesével"
- `lib/sessionQueue.ts`: `dripNewWords()` egyenletesen szórja szét az ÚJ szavakat az
  ismétlések között (eddig a due-lekérdezés sorrendje döntött, ezért vagy a session
  elején tömbösödtek, vagy minden ismétlés mögé kerültek). A kadencia ELŐTT fut, tehát
  a 4:1 szó/mondat ritmus érintetlen.
- `app/(tabs)/index.tsx`: a fázis-létra requeue-ja a sor VÉGE helyett 3 kártyával
  később ejti vissza a szót, így EGY új szó járja végig a 3 típusát (kártya → fordított
  kártya → gépelés), közben ismétlések jönnek, nem öt szó lépked párhuzamosan.
- 5 teszt (`dripNewWords.test.ts`): egyenletes rés, nincs két új szó egymás után,
  semmi nem vész el, üres esetek.

## ✅ FB164 [info], „A `humid`-ról nem hiányzik a névelő?", KÉSZ (jegyzet, `7f1ba4b`)
Idézet (08-28 12:16, `word:humid`): „ennek nem hiányzik a nevelője?"
Nem hiányzik: a `húmedo` MELLÉKNÉV, szótári névelőt csak a főnevek kapnak. A kártya
ℹ️ jegyzetet kapott ×4 nyelven az egyeztetéssel (`el aire húmedo`, `la ropa húmeda`,
`los días húmedos`) és a hozzá tartozó főnévvel (`la humedad`).

## Elfogadási kritérium (FB158–FB164 forduló)
- `npx tsc --noEmit` 0 hiba ✅; `npx jest` zöld **457/457** ✅ (429 → 457: +5 drip,
  +1 game-session TDZ, +4 buborék-rács, +9 word-rain sáv, +9 struggle-súlyozás).
- `node scripts/audit-corpus.mjs` → P1=0, P2=0 ✅ (a `humid` jegyzet nem mozdít adatot).
- `npx expo lint`: 70 probléma (46 error, 24 warning) ✅ — ez a 3.1.0 játék-kiadás óta az
  ALAPVONAL (a régi „18" a Game tab előtti állapot), a forduló javításai 0-t tettek hozzá
  (`ad626d9`-en lemérve, ugyanaz a 70).
- Web-playtest újrafuttatva a javítások után: a Szó-eső élet-vesztésre a játék-vége
  kártyát mutatja, a buborékok 5 oszlopos rácsban olvashatók, a Szó-eső csempéi a
  táblán belül maradnak.
- ⏳ Eszköz-verify a következő APK-n: a kártya fölött ott a 🌱/🔁 pirula; a Check gomb
  hosszú és jobbra húzott, nyitott billentyűzettel is elérhető; az angol hang a régi;
  ismétlős körben EGYESÉVEL jön az új szó és végigmegy a 3 típusán; a Memóriapárosító
  kipörgethető a végéig.

---

# 📋 Feedback, 2026-08-29 forduló (v3.1.1 telefon-teszt)

Forrás: `Kimacha Feedback` sheet, a FB164 óta érkezett 4 sor (mind v3.1.1 (35)).

## ✅ FB165 [P2 UX], „exam unlocked túl nagy, legyen itt egy kis jel", KÉSZ (`40d3444`)
Idézet (08-29 10:29, `word:the engine`): „exem unlocked túl nagy legyen itt egy kis jel"
A 80% mesterszint fölött megjelenő narancs, teljes szélességű sáv („Vizsga feloldva! /
Vizsga Megkezdése →") a kártya fölött ült, és lejjebb tolta a tanulnivalót. Most a
fejléc jobb oldalán egy kis narancs 🎓 pirula (`headerBadges`), koppintásra ugyanúgy
indul a vizsga (`setExamMode(true)`); a `examBanner` blokk és a három render-helye,
valamint a hozzá tartozó három stílus törölve. Kálmán választása volt a fejléces
elhelyezés (2026-08-29).

## ✅ FB166 [P2 UX], A 🔥 sorozat-jelvény ráült a kártya képére, KÉSZ (`40d3444`)
Idézet (08-29 10:30, `word:the engine`): „strike meg ami mellette van rá ragad, a képre
feleslegesen. ezt vedd ki. nem mell"
A tanuló-fejléc `position: absolute`, tehát görgetés közben a jelvények a kártya
fotója fölé kerülnek (FB124 óta van fotó a kártyákon). A 🔥 sorozat-jelvény kikerült a
fejlécből; a 🌱 napi új-szó számláló marad (FB103), a sorozatot a Done-képernyő
továbbra is mutatja (`streak` state megmarad, csak a fejléc-jelvény tűnt el).

## ✅ FB167 [P2 UX], A Check gomb egyenetlen, KÉSZ (`40d3444`)
Idézet (08-29 10:32, `word:the engine`): „az új check gomb nagyon egyenletlen így,
legyen szűkebb és szélesebb"
Az FB160-as sáv 82% széles és JOBBRA igazított volt, ezért a bal és a jobb margó
eltérő („egyenetlen"). Kálmán választása (2026-08-29): **alacsonyabb + teljes
szélesség**, egyenlő margókkal. `inlineCheckBtn` (gépelős kártya + ✏️ gyakorló mező) és
`app/spelling.tsx` `checkBtn`: `alignSelf: 'stretch'`, `width: '100%'`, `minHeight` 54 →
44, `paddingVertical` 16 → 12. A felirat („✓ Ellenőrzés") és a viselkedés változatlan.

## ✅ FB168 [P1 feature], Visszajelző gomb MINDEN játékban, KÉSZ (`394a638`)
Idézet (08-29 19:51, `word:el puente`): „fejlessz a játékokba momdegyikre egyénileg tedd
bele a visszajelző rendszert, hogy kozbe tudjak visszajelzést adni. mindegyik játékról,
és így ki tudod majd javítani"
- `components/GameFeedback.tsx` (új): kiolvassa a szintet (`getLevel`) és a nyelvpárt
  (`getOnboarding`), a játék azonosítóját pedig az útvonalból (`usePathname`), így a
  sheet sora `game:word-rain`, `game:ccat`, … címkével érkezik, nem a hub nevével.
- `app/games/_layout.tsx`: a Stack köré egy `View flex:1`, alatta a gomb — EGY helyen
  mountolva mind a 12 játék-képernyő megkapja, és egy jövőbeli 13. játék is örökli
  (12 fájl módosítása helyett).
- `draggable` (FB41-viselkedés): a játéktábla kitölti a képernyőt, ezért a gombot át
  lehet húzni a másik oldalra, és ott is marad (`learn_settings.feedback_btn_side`).

## Elfogadási kritérium (FB165–FB168 forduló)
- `npx tsc --noEmit` 0 hiba ✅; `npx jest` zöld **457/457** ✅ (nincs új teszt: a forduló
  UI-elhelyezés és egy layout-mount, logikai ág nem változott).
- `npx expo lint`: 70 probléma (46 error, 24 warning) ✅ — VÁLTOZATLAN alapvonal, az új
  `GameFeedback.tsx` 0 hibát tett hozzá.
- `npx expo export --platform web` lefut, mind a 12 játék-útvonal exportálódik, és a
  `GameFeedback` benne van a web-bundle-ben ✅.
- ⚠️ Web-playtest NEM futott végig: a statikus szerver az ékezet nélküli útvonalakat
  404-eli (`/games/word-rain.html` betölt, de onboarding-adat híján az onboardingra
  irányít), az `agent-browser` munkamenete pedig az első kattintás után üres lapra
  esett. A FB162-es módszer (egy hosszú `agent-browser batch` egy munkamenetben)
  legközelebb megismételhető, ez a forduló nem kapott böngészős bizonyítékot.
- ⏳ Eszköz-verify a következő APK-n: a fejlécben kis 🎓 jel jelenik meg 80% fölött és
  indítja a vizsgát; nincs több 🔥 jelvény a kártya fotóján; a Check gomb teljes
  szélességű, egyenlő margóval, alacsonyabb; mind a 12 játékban ott a 💬 gomb, húzható,
  és a beküldött sor a játék nevével érkezik a sheetbe.

---

# 📋 Feedback, 2026-09-05 forduló (v3.1.3 telefon-teszt)

Forrás: `Kimacha Feedback` sheet, a FB168 óta érkezett 1 sor (v3.1.3 (37)).

## ✅ FB169 [P2 UX], Rózsaszín review-szelet a fejléc-csíkban, KÉSZ
Idézet (09-05 17:39, `word:to wash the dishes`): „fenn most van egy kek csik ami
mutatja, hogy mennyi szónál járok, azt akarom, hogy a keknek egy resze legyen
rozsaszín ami az alapján legyen meghatározva, hogy mekkora a rozsaszin, hogy mennyi
szot kell review ni. es ahogy egyrw kevesebb lesz legyen egyrw kisebb a rozsaszin rész."
- Kálmán választása (2026-09-05): a rózsaszín **a kékből vesz el**, nem a sáv jobb
  végén ül külön szakaszként. Így a csík teljes hossza továbbra is a mesterszintet
  (`known/total`) jelenti: tömör kék = megtanult és nem esedékes, rózsaszín farok =
  megtanult, de ebben a munkamenetben ismétlésre vár.
- `components/LearnChrome.tsx`: új `reviewLeft` prop, `reviewShare = reviewLeft/known
  * pct`, és egy második `progressFill` View (`testID="reviewFill"`,
  `REVIEW_COLOR = '#F472B6'`) a kék fill jobb szélén (`left: pct - reviewPct`).
  `MIN_REVIEW_PCT = 3`, különben egy 400 szavas paklinál az utolsó 1-2 esedékes szó
  hajszálvékonyra kerekedne; a szelet soha nem lóg túl a kék fillen (`Math.min(pct, …)`).
- `app/(tabs)/index.tsx`: `reviewLeft` = a `currentIndex`-től hátralévő sor-elemek
  KÜLÖNBÖZŐ `wordId`-jai, amik nincsenek a `newTodayIds`-ben (FB158 új-szó szabály,
  egy szónak három kártyája van, ezért distinct). Minden megválaszolt kártyával
  csökken, a Done-képernyőnél nulla.

## Elfogadási kritérium (FB169 forduló)
- `npx tsc --noEmit` 0 hiba ✅; `npx jest` zöld **461/461** ✅ (+4 új teszt,
  `components/__tests__/LearnChrome.test.tsx`: nincs szelet 0 review-nál, arány-méret,
  hajszál-minimum, és hogy nem lóg túl a kéken).
- `npx expo lint`: 70 probléma (46 error, 24 warning) ✅ — VÁLTOZATLAN alapvonal.
- ⏳ Eszköz-verify a következő APK-n: a fejléc-csík kék részének jobb végén rózsaszín
  szakasz látszik, ha van esedékes ismétlés, és minden megválaszolt szó után rövidül.

---

# 🛠️ Emulátor + release-csapdák (2026-08-15)

**Android emulátor UI-ellenőrzéshez.** AVD `kimacha_test` (Pixel 6, Android 35).
A `/dev/kvm` az ügynök sandboxából NEM látszik (bwrap saját `/dev`-et ad), ezért az
emulátort a USER termináljából kell indítani:
`/home/kalmi/Android/Sdk/emulator/emulator -avd kimacha_test -no-window -no-audio -no-boot-anim -gpu swiftshader_indirect &`
(egyszer egy gépindulás után: `sudo modprobe kvm_intel && sudo chmod 666 /dev/kvm`).
Az `adb` viszont működik innen: minden Bash-hívás SAJÁT adb-szervert indít, ezért
egy parancson belül kell `adb start-server` + `get-state` várakozó ciklus, különben
a friss szerver `offline` eszközt lát. Nagy betűméret teszt:
`adb shell settings put system font_scale 1.5`.

**⚠️ Csapda 1, `npx expo run:android` csatlakoztatott eszköz nélkül.** Azonnal kilép
(„No Android connected device found"), Gradle EL SEM INDUL, viszont a régi APK ott
marad a kimeneti mappában, tehát sikeres buildnek látszik. Helyette:
`cd android && ./gradlew assembleRelease`.

**⚠️ Csapda 2, elavult JS bundle csak-adat változásnál.** A Gradle
`createBundleReleaseJsAndAssets` taskja NEM fut újra, ha csak `data/**.json`
változott, így a release a MEGELŐZŐ build szavait viszi. Így ment ki a 3.0.21 és a
3.0.22 is: az app 148 magyar A1 szót mutatott, miközben a repóban 340 volt. Minden
build előtt:
`rm -rf android/app/build/generated/assets/react android/app/build/intermediates/assets`
Ellenőrzés a build után: `output-metadata.json` versionName + a Mester-modal
szószámai az emulátoron. A `/build-apk` parancsfájl már ezt a sorrendet írja le.

**⚠️ Csapda 3, `android/` gitignore-olt.** A `versionCode`/`versionName` a
`app/build.gradle`-ben él, prebuild nélkül nem követi az `app.json`-t, kézzel kell
együtt léptetni a kettőt.

**⚠️ Csapda 4, `JAVA_HOME` a 11-es JDK-ra mutat (2026-08-18).** A gépen a `java` a
PATH-on 17-es, de a `JAVA_HOME=/usr/lib/jvm/default-java` → `java-11-openjdk-amd64`,
és a Gradle a `JAVA_HOME`-ot nézi: „Gradle requires JVM 17 or later to run. Your build
is currently configured to use JVM 11." A build EL SEM INDUL, a kimeneti mappában
viszont ott marad a MEGELŐZŐ verzió APK-ja, tehát siker látszatát kelti (mint a
Csapda 1-nél).

**⚠️ Csapda 5, nincs `ANDROID_HOME` és üres az `android/local.properties`.** Ugyanaz a
tünet, más ok: „SDK location not found... ANDROID_HOME environment variable or ...
sdk.dir". Az SDK a `/home/kalmi/Android/Sdk` alatt van, az ügynök shelljébe viszont
nincs beexportálva.

Ezért a release-build parancs mindig teljes környezettel:
```
cd android && ANDROID_HOME=/home/kalmi/Android/Sdk ANDROID_SDK_ROOT=/home/kalmi/Android/Sdk \
  JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64 ./gradlew assembleRelease
```
Ellenőrzés utána KÖTELEZŐ: `output-metadata.json` versionName + az APK időbélyege.

---

# 🇭🇺 Hungarian-target track (es→hu kurzus), A1 KÉSZ (2026-08-15)

A magyar mint CÉLNYELV ág (`data/words/hu/`, `data/topics/hu/`, `data/sublevels/hu/`,
`data/exams/hu/`) eddig csak A0-t tudott (100 turista-kártya, 10 topic), az A1 pedig egy
6 kártyás csonk volt (`letige`, id 6001-6006, „NE bántsd"), tehát a kurzust a turista
szint után nem lehetett folytatni. Az A1 most **148 kártya / 15 topic / 3 al-szint**
(a csonk + 142 új kártya, id **6200-6341**; az A0 a 6100-6199 sávot használja).

| Al-szint | Topicok |
| --- | --- |
| A1.1 Első Lépések | letige, nevmasok, csalad, tobbes_szam, igeragozas, etel_ital |
| A1.2 Mindennapok | targyeset, lakas, varos, helyhatarozok, iranyok, napi_rutin, szamok_ido |
| A1.3 Emberek és Tulajdonságok | melleknevek, munka_iskola |

A nyelvtani topicok MAGYAR nyelvtant tanítanak (nem a spanyol fát másolják): többes szám
`-k`, tárgyeset `-t`, jelen idő, hol-eset (`-ban/-ben`, `-on/-en/-ön`), hova-eset
(`-ba/-be`, `-ra/-re`, `-hoz/-hez/-höz`).

**Korpusz-őr:** `scripts/audit-corpus-hu.mjs` mostantól A0 **és** A1 (`LEVELS`), P1=0.
Két javítás kellett hozzá:
- a stemmer 2 betűs tövet is elfogad EGY betűs rag után (`jó`→`jók`, `nő`→`nők`), eddig a
  3 betűs padló miatt a rövid, magánhangzóra végződő címszavak sosem redukálódtak;
- a vizsga-kérdéseket a KITÖLTÖTT mondaton nézi (`az asztal____` + `on` → `az asztalon`),
  mert egy toldalék-kérdés két töredékként értelmezhetetlen.
Glue-lista: `sokat`, `keveset` (a már bent lévő `sok`/`kevés` tárgyesete).
9 A1 vizsga-kérdés át lett írva a tanított szókincsre (a régiek `mérnök`, `utaznak`,
`kulcsomat`, `macskám`, `almát` stb. sosem tanított szavakat kértek).

**Hátra:** A1 bővítés az XLex-sávig (~1200 kumulált; most 248 = A0 100 + A1 148),
A2+ hu tartalom, hu topic-ikonok finomítása, és eszköz-verify a kurzuson.

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
