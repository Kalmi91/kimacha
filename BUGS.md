# Kimacha, BUG queue

> Hibajegy-lista. Egy jegy = egy jól körülírt hiba.
> Forrás-igazság a viselkedésre: `AGENTS.md` + `ITER3.md`. A kód-állapot: `BUILD.md`.
> Első feltöltés: 2026-09-07, felderítő (exploratory) teszt-menet a v3.1.11 web-buildjén
> (`expo export -p web` + CDP-vezérelt Chrome) plusz korpusz-szintű kód-audit.

## Hogyan írj jegyet

```
## BUG-XXX: rövid cím
- Státusz: OPEN | FIXED
- Súly: kritikus | nagy | kicsi
- Hol: képernyő / fájl / flow
- Mi történik: a rossz viselkedés
- Mi kéne: az elvárt viselkedés
- Ismétlés: 1. ... 2. ... 3. ...
- Bizonyíték: teszt / mérés / képernyőkép
```

---

## BUG-001: a zárójeles magyarázatot is be kell gépelni a válaszba
- Státusz: FIXED (2026-09-07)
- Súly: nagy
- Hol: `lib/answerMatch.ts` (`strictAnswerMatch`), gépelős kártya (`app/(tabs)/index.tsx` `handleCheck`, `checkPractice`), helyesírás-gyakorló (`app/spelling.tsx`)
- Mi történik: ha a megoldásban zárójeles pontosítás van (`van (ő)`, `óra (idő)`, `ver (veremos)`),
  a normalizálás a zárójelet szóközre cseréli, így a zárójel tartalma KÖTELEZŐ szóvá válik.
  A "van" beírása a `van (ő)` kártyára **Hibás**. A helyesírás-gyakorlóban még szigorúbb:
  ott bájtra egyezés kell, tehát a zárójeleket is be kell írni (`ver (veremos)`).
- Mi kéne: a zárójeles rész magyarázat, nem válasz. Fogadja el a zárójel nélküli alakot is
  (és maradjon jó a teljes, zárójeles beírás is).
- Ismétlés: 1. `es` kártya (fordítás `van (ő)`) → ✏️ Begépelem 2. írd be: `van` 3. ✓ Ellenőrzés → Hibás.
- Bizonyíték: `strictAnswerMatch('van','van (ő)') === false`, `('óra','óra (idő)') === false`,
  `('én vagyok','én vagyok (állapot)') === false`.
- Érintett kártyák a korpuszban: **hu 197, es 108, en 212** szó tartalmaz zárójelet
  (4096 szóból), tehát mindkét irányban sok kártya gépelése megoldhatatlan a magyarázat nélkül.
- Fix: `strictAnswerMatch` a teljes ÉS a zárójel nélküli alakot is elfogadja
  (`withoutGloss`), a helyesírás-tréner pedig a `spellingTargets` két alakja ellen
  hasonlít. A kártya a teljes alakot mutatja tovább, a "van ő" beírás is jó marad.
  Teszt: `answerMatch.test.ts` +4 eset (a zárójel tartalma önmagában NEM válasz, és
  az FB6 szigor a csupasz alakon belül él). UI-verify: `es` kártya + "van" → Helyes!.

## BUG-002: a ragozás-játék 5 igére rossz alakot tanít
- Státusz: FIXED (2026-09-07)
- Súly: nagy (tényállítás, hibás nyelvtant tanít)
- Hol: `lib/games/conjugate.ts` (`EXCLUDE_INFINITIVES` hiányos), conjugation-slot játék
- Mi történik: a `conjugate()` szabály-alapú ága tőhangváltós / helyesírás-váltós igékre is lefut,
  mert nincsenek a kizárólistán. A generált alakok:
  | ige | szint | generált (hibás) | helyes |
  | --- | --- | --- | --- |
  | almorzar | a1 | almorzo / almorce | almuerzo / almuerce |
  | nevar | a1 | neva / neve | nieva / nieve (+ csak személytelen, minden más alak értelmetlen) |
  | ofrecer | b1 | ofreco / ofreca | ofrezco / ofrezca |
  | vencer | b2 | venco / venca | venzo / venza |
  | subyacer | c1 | subyaco / subyaca | subyazco / subyazca |
- Mi kéne: a GAMES.md saját szabálya szerint ("ha egy alakban bizonytalan vagy, inkább hagyd ki")
  ezek essenek ki, vagy kerüljenek kézzel ellenőrzött táblába.
- Ismétlés: `conjugate('almorzar','presente')` → `almorzo/almorzas/almorza/almorzamos/almorzan`.
- Bizonyíték: korpusz-szintű audit: 745 ige, ebből 409-et fogad el a `conjugate()`,
  ezek közül 5 ismert rendhagyó (a `poder`/`salir`/`leer`/`creer` helyesen kezelt).
- Fix: `nevar` + `almorzar` a kizárólistára, az `ofrecer`/`vencer`/`subyacer` pedig
  ALAK szerint esik ki: új `RISKY_ENDINGS` őr (`-cer`, `-cir`, `-ger`, `-gir`, `-uir`,
  benne a `-guir`), mert ezek a családok kivétel nélkül tőváltozást kérnek. Így egy
  később felvett `mecer`/`coger`/`incluir` is magától védve van. A táblázott `hacer`
  és `decir` ezt megelőzve a kézi táblából felel.
  Korpusz-újramérés: 745 igéből elfogadott 409 → 404, a hibás 5 mind kiesett, a
  maradék `-cer/-cir` végű elfogadott kettő a kézzel ellenőrzött hacer/decir.
  Teszt: `conjugate.test.ts` +11 eset (a meglévő 54 érintetlen).

## BUG-003: üres válasz a helyesírás-gyakorlóban nullázza a szó létráját
- Státusz: FIXED (2026-09-07)
- Súly: nagy (adatvesztés)
- Hol: `app/spelling.tsx` `handleCheck`
- Mi történik: az "Ellenőrzés" üres mezővel is lefut, `wrong` lesz belőle, és
  `updateSpellingStep(wordId, 0, most)` fut → a szó helyesírás-létrája visszaesik 0-ra.
  Egy véletlen koppintás egy 5. lépcsőn álló szó teljes haladását törli.
- Mi kéne: üres mező = nincs válasz (ne értékeljen, ne írjon DB-t), ahogy a gépelős kártyán
  az FB43/FB73 döntés kimondja ("an empty answer isn't a wrong answer").
- Ismétlés: 1. Beállítások → Helyesírás-gyakorló 2. koppints az Ellenőrzésre üres mezővel
  3. "Hibás" + a lépés 0-ra áll.
- Bizonyíték: `app/spelling.tsx:80-91` (nincs üres-ellenőrzés a `handleCheck`-ben).
- Fix: `handleCheck` üres mezőnél azonnal visszatér (nincs ítélet, nincs DB-írás).
  UI-verify: üres Ellenőrzés a trénerben nem ír ki semmit, a helyes válasz ugyanúgy
  "Helyes!"-t ad.

## BUG-004: üres válasz a kártyán belüli gyakorló mezőben "Hibás"
- Státusz: FIXED (2026-09-07)
- Súly: kicsi
- Hol: `app/(tabs)/index.tsx` `checkPractice`
- Mi történik: a felfedett kártya ✏️ Begépelem mezőjében az üres ✓ Ellenőrzés piros "Hibás"-t ad.
- Mi kéne: üres mezőnél ne történjen semmi (vagy "kihagyva"), az FB43/FB73 döntéssel egyezően.
  Itt nincs SRS-írás, tehát csak visszajelzés-inkonzisztencia, nem adatvesztés.
- Bizonyíték: `app/(tabs)/index.tsx:1190-1194`, nincs `practiceText.trim()` őr.
- Fix: `checkPractice` üres mezőnél visszatér. UI-verify: Begépelem → üres
  ✓ Ellenőrzés → nincs "Hibás".

## BUG-005: a web-build befagyott a töltő-pörgőn (JAVÍTVA)
- Státusz: FIXED (2026-09-07)
- Súly: nagy (web), a natív APK-t nem érinti
- Hol: `lib/database.web.ts`
- Mi történik: hiányzott a `countDueReviewWords` és a `countDueReviewWordsForLevel`,
  amit a `Db` interfész előír és a Tanulás fül hív → `TypeError: e.countDueReviewWords is not a function`,
  a képernyő örökre pörgőn maradt.
- Fix: a két metódus pótolva a natív (SQL) szemantikával (10 perces lookahead, `reps > 0`,
  nem elrakott, aktív pár, DISTINCT word_id). `tsc --noEmit` tiszta, `jest` 465/465 zöld.

## BUG-006: az "Aktív" fül szövege elavult verziót ígér
- Státusz: OPEN
- Súly: kicsi
- Hol: `app/(tabs)/active.tsx`
- Mi történik: "Hamarosan... Iter2-ben érkezik.", az app v3.1.11, az ITER5 már kész.
- Mi kéne: iteráció-szám nélküli szöveg (a belső ütemterv nem való a felhasználó elé).

## BUG-007: nincs képernyőn látható vissza-gomb a helyesírás- és játék-képernyőn
- Státusz: OPEN
- Súly: kicsi
- Hol: `app/_layout.tsx` (`headerShown: false` a `spelling` és `games` Stack.Screen-en)
- Mi történik: a helyesírás-gyakorlón nincs se fejléc-nyíl, se X, se tab-sáv. Csak az Android
  rendszer-vissza visz ki.
- Mi kéne: egy vissza/X a fejlécben (vagy a kártya fölött), hogy gesztus-navigáció nélkül is legyen kiút.

## BUG-008: a 💬 visszajelzés-gomb rövid képernyőn eltakarja a "Napi új szó +" gombot
- Státusz: OPEN
- Súly: kicsi (csak alacsony viewport, web)
- Hol: Beállítások képernyő + `FeedbackButton`
- Mi történik: 500x777-es ablakban a FAB (x424-476, y653-705) rálóg a "+" gomb tapintható
  felületére (x411-445, y654-688), és a koppintás a visszajelzés-ablakot nyitja meg a növelés helyett.
- Mérés: 390x844 és 360x640 telefon-méreten NEM reprodukálható (a FAB alatt nincs vezérlő),
  tehát a shippelt Android-méretekben valószínűleg nem jelentkezik.
- Mi kéne: a Beállítások ScrollView alján ugyanaz a FAB-magasságú padding, mint az FB173-nál a kártyán.

---

## Kapu a BUG-001..004 javítás után (2026-09-07)
- `npx tsc --noEmit` 0 hiba ✅; `npx jest` zöld **480/480** ✅ (465 → 480: +4 answerMatch,
  +11 conjugate).
- `npx expo lint`: 70 probléma (46 error, 24 warning) = változatlan alapvonal ✅.
- `node scripts/audit-corpus.mjs` → P1=0, P2=0 ✅ (adat-JSON nem változott).
- Web-verify (`expo export -p web` + CDP-vezérelt Chrome): "van" elfogadva a `van (ő)`
  kártyán, üres Ellenőrzés se a kártya gyakorló mezőjében, se a helyesírás-trénerben
  nem ad ítéletet.
- ⏳ Eszköz-verify a következő APK-n: zárójeles kártya gépelése telefonon, és hogy a
  ragozás-játékban nem jön elő almorzar/nevar/ofrecer/vencer/subyacer.
