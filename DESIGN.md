# DESIGN.md, a Kimacha vizuális rendszere

Státusz: v1, 2026-09-16, leltár-alapú. Forrás-igazság a kódban: `constants/Colors.ts` (szín) és `constants/Theme.ts` (skálák). Ez a fájl a szabályokat és az okokat rögzíti; ha a kettő eltér, a kód a hibás, nem a doksi, és a kódot kell javítani.

Cél: minden új képernyő és komponens ugyanabból a hat-hat lépcsős skálából épül, hogy az app egy kéz munkájának tűnjön, és hogy egy agent instrukció nélkül is jó értéket válasszon. Sebesség és játékosság a hang: nyelvtanuló app, sok rövid kör, gyors visszajelzés, nem dashboard.

## 1. Leltár (2026-09-16, `app/` + `components/`, 79 tsx fájl)

Ez a kiindulás, nem a cél. A számok a `grep`-ből jönnek, ez a baseline a migrációhoz.

| Terület | Tény | Ítélet |
|---|---|---|
| Színtoken | `Colors.ts`: 8 token × 2 téma; 52 fájl használja `const colors = Colors[theme]` mintával | jó alap, de hiányoznak a szemantikus színek |
| Inline hex | 16 különböző hex a komponensekben; top: `#22C55E` 68×, `#FFFFFF` 50×, `#EF4444` 46×, `#38BDF8` 14×, `#F59E0B` 9×, `#EAB308` 8× | siker/hiba/figyelmeztetés/info nincs tokenben, ezért mindenki beégeti |
| Token-használat | `text` 296, `tabIconDefault` 258, `tint` 239, `card` 122, `background` 94, `accent` 19, `secondary` 0, `tabIconSelected` 0 | `tabIconDefault` valójában a halvány szöveg tokenje, rossz néven; `secondary` és `tabIconSelected` halott |
| fontSize | 12 különböző érték; 14 (78×), 13 (65×), 16 (58×), 15 (58×), 12 (46×), 18 (45×), 20 (33×), 22 (32×), 17 (28×), 28 (17×), 26 (16×), 11 (13×) | 13/15/17 = "egy kicsit kisebb" ízlés-döntések, nem skála |
| fontWeight | '700' 162×, '600' 106×, '800' 59×, '500' 11×, 'bold' 1× | 800 és 700 egymás mellett nem különbözik, egyik felesleges |
| fontFamily | csak rendszer-font, 1× `monospace` | rendben, marad rendszer-font |
| Spacing (padding/margin/gap) | 8 (120×), 12 (114×), 16 (111×), 10 (86×), 14 (76×), 4 (71×), 24 (58×), 20 (52×), 6 (42×), 32 (21×) | 6/10/14/20 a köztes tippek, kiesnek |
| borderRadius | 12 (42×), 16 (33×), 14 (33×), 24 (16×), 20 (15×), 8 (14×), 10 (13×), 3 (4×) | 8 érték, 4-5 elég |
| lineHeight | 20 (12×), 18, 17, 22, 21, 28, összesen ~37 hely | ritkán van megadva, ahol van, ad hoc |
| Árnyék | `elevation: 4` 9×, `shadowOpacity: 0.1` 7×, `0.2` 4×, `elevation: 8` 2× | két szint elég: kártya és modal |
| Overlay | `rgba(0,0,0,0.5)` 8×, `rgba(255,255,255,0.7)` 4×, 0.35/0.4/0.3 1-2× | egy overlay-token elég |
| Ikon | nincs ikon-könyvtár; emoji glyph 25 fájlban; tab-ikon a `app/(tabs)/_layout.tsx`-ben | emoji = platform-függő megjelenés, de ez tudatos döntés, marad (lásd 6.) |
| Animáció | RN `Animated.` 21 hely; `react-native-reanimated` csak `app/games/bubble-pop.tsx` + tesztek | kétféle motor, reanimated csak a játékokban indokolt |
| A11y | `hitSlop` 57×, `accessibilityLabel` 3×, `accessible=` 1×, `reduceMotion`/`AccessibilityInfo` 0× | tap-cél jó irány, címke és reduced-motion gyakorlatilag nincs |
| Tap-méret | `minHeight: 44` 2×, `height: 48` 2×, `height: 44` 1×, `height: 40` 1× | nincs kimondott minimum |

### Kontraszt-mérés (WCAG relatív luminancia, saját számítás 2026-09-16)

| Pár | Arány | AA (4.5 szöveg / 3.0 nagy szöveg és UI) |
|---|---|---|
| light `text` #1E293B / `background` #F8FAFC | 13.98 | ✓ |
| light `tabIconDefault` #94A3B8 / #F8FAFC | 2.45 | ✗ szövegként bukik, ikonként is bukik |
| light `tint` #2563EB / #F8FAFC | 4.94 | ✓ |
| fehér / `tint` #2563EB (gomb) | 5.17 | ✓ |
| dark `text` #F1F5F9 / #0F172A | 16.30 | ✓ |
| dark `tabIconDefault` #64748B / #0F172A | 3.75 | ✓ csak nagy szövegre, kis szövegre bukik |
| dark `tint` #2563EB / `background` #0F172A | 3.45 | ✓ csak UI-elemre, szövegre bukik |
| dark `tint` #2563EB / `card` #1E293B | 2.83 | ✗ |
| `#22C55E` siker / light bg | 2.18 | ✗ |
| `#22C55E` siker / dark bg | 7.83 | ✓ |
| fehér / `#22C55E` (siker-gomb) | 2.28 | ✗ |
| `#EF4444` hiba / light bg | 3.60 | ✓ csak nagy szövegre |
| `#F59E0B` figyelmeztetés / light bg | 2.05 | ✗ |

Következmény: a világos téma a gyengébb, a siker-zöld és a halvány szürke szövegként nem olvasható rajta. A javítás a 2. pontban, tokenszinten, nem képernyőnként.

## 2. Szín

### 2.1 Tokenek (`constants/Colors.ts`)

Jelenlegi 8 marad, kompatibilitás miatt; jön 7 új szemantikus token. Az új nevek a `Theme.ts`-en keresztül is elérhetők.

| Token | Light | Dark | Mire |
|---|---|---|---|
| `background` | #F8FAFC | #0F172A | képernyő alap |
| `card` | #FFFFFF | #1E293B | felület a háttéren: kártya, lista-sor, modal-test |
| `text` | #1E293B | #F1F5F9 | elsődleges szöveg |
| `textMuted` (új, = `tabIconDefault` szerepe) | #64748B (volt #94A3B8, 2.45 → 4.55) | #94A3B8 (volt #64748B, 3.75 → 6.96) | másodlagos szöveg, meta, placeholder, inaktív tab-ikon |
| `tint` | #2563EB | #3B82F6 (volt #2563EB, kártyán 2.83 → 3.98) | elsődleges akció, aktív állapot, link |
| `accent` | #EC4899 | #EC4899 | egy hangsúly képernyőnként: streak, XP, kiemelt jelvény |
| `success` (új) | #15803D szövegként, #22C55E kitöltésként | #22C55E | helyes válasz, kész, sorozat él |
| `danger` (új) | #DC2626 | #EF4444 | rossz válasz, törlés, hiba |
| `warning` (új) | #B45309 szövegként, #F59E0B kitöltésként | #F59E0B | lejáró snooze, gyenge szó, figyelmeztetés |
| `info` (új) | #0369A1 | #38BDF8 | semleges kiemelés, tipp, magyarázat |
| `border` (új) | #E2E8F0 | #334155 | 1px elválasztó, input-keret |
| `overlay` (új) | rgba(15,23,42,0.5) | rgba(0,0,0,0.6) | modal mögötti sötétítés |
| `onTint` (új) | #FFFFFF | #FFFFFF | szöveg tint/danger/success kitöltésen |

Öröklött, kivezetendő: `tabIconDefault` (→ `textMuted`), `tabIconSelected` (→ `tint`), `secondary` (0 használat, törölhető, a cián a dark `info` lett).

⚠ A `success`/`warning` kettős értéke (szöveg vs kitöltés) világosban azért kell, mert a #22C55E fehér háttéren 2.18, olvashatatlan, de kitöltésként sötét szöveggel (navy / #22C55E = 7.83) jó. Szabály: világos témában siker-zöld és figyelmeztető-sárga csak kitöltés sötét szöveggel, vagy a sötétebb árnyalat szövegként. Fehér szöveg siker-zöldön tilos mindkét témában (2.28).

### 2.2 Szabályok

- Színt csak tokenből. Inline hex a komponensben hiba, kivéve a `Colors.ts`.
- Egy képernyőn egy `accent`. Ha kettő kell, az egyik `tint`.
- Állapot-szín (`success`/`danger`/`warning`) soha nem az egyetlen jel: mellé ikon, szöveg vagy alak (színvak felhasználó, és a játékok gyors visszajelzése hangra/alakra is épít).
- Fehér szöveg csak `tint`, `danger`, dark-`success` kitöltésen. Light-`success` és `warning` kitöltésen `text` (navy).
- Az árnyalatok (`#1D4ED8`, `#1E40AF`, `#7C3AED`, `#C62828`, `#2E7D32`, `#3B82F6`, `#F472B6`) a kódban most tippek; új kódban egyik sem, a régi helyek migrációnál a legközelebbi tokenre mennek.

## 3. Tipográfia

Rendszer-font marad (iOS SF, Android Roboto), letöltött font nincs: az APK kicsi, a betöltés nulla, és a nyelvtanuláshoz a rendszer-font ékezet- és ñ-lefedettsége biztos.

### 3.1 Méret-skála (`Theme.fontSize`), 6 lépcső

| Név | px | lineHeight | Mire | Migráció (régi → új) |
|---|---|---|---|---|
| `xs` | 12 | 16 | jelvény, számláló, apró meta | 11 → 12 |
| `sm` | 14 | 20 | másodlagos szöveg, lista-meta, gomb-felirat kicsi | 13 → 14 |
| `md` | 16 | 22 | törzsszöveg, input, gomb-felirat, ez az alap | 15 → 16, 17 → 16 |
| `lg` | 18 | 25 | kártya-cím, lista-elem címe | 17 → 18 ha cím |
| `xl` | 22 | 28 | képernyő-cím, kvíz-kérdés | 20 → 22, 26 → 22 vagy 28 |
| `xxl` | 28 | 34 | tanulandó szó a kártyán, eredmény-szám | 26 → 28 |

lineHeight mindig a táblából, sose kézzel. Kvíz-kérdés és tanult szó: `xl`/`xxl` + `bold`, ez a legfontosabb szöveg az appban, ne legyen kisebb, mint a chrome.

### 3.2 Súly (`Theme.fontWeight`), 3 lépcső

| Név | Érték | Mire | Migráció |
|---|---|---|---|
| `regular` | '400' | törzs, meta | '500' → '400' |
| `semibold` | '600' | gomb-felirat, kártya-cím, aktív tab | marad |
| `bold` | '700' | képernyő-cím, tanulandó szó, szám-kiemelés | '800' → '700', 'bold' → '700' |

'800' kiesik: 700 mellett nem látszik a különbség, csak zaj.

### 3.3 Szabályok

- Egy komponensben max 3 méret. Ha több kell, a komponens két komponens.
- Csupa nagybetű (`textTransform: 'uppercase'`) csak `xs` jelvényen, spanyol szövegen soha (ékezet-olvashatóság).
- Számok (XP, streak, pontszám): `fontVariant: ['tabular-nums']`, hogy ne ugráljon a szélesség.
- Spanyol tanulandó szöveg és magyar UI-szöveg ugyanabból a skálából; a nyelvet a szín és a pozíció különbözteti meg, nem a font.

## 4. Térköz és forma

### 4.1 Spacing (`Theme.spacing`), 6 lépcső, 4-es rács

| Név | px | Mire | Migráció |
|---|---|---|---|
| `xs` | 4 | ikon és felirat közt, jelvény belső | 6 → 4 vagy 8 |
| `sm` | 8 | elemek közti kis rés, chip belső | 6, 10 → 8 |
| `md` | 12 | kártya belső padding (kompakt), lista-sor | 10, 14 → 12 |
| `lg` | 16 | képernyő oldalsó margó, kártya belső (normál), szekció-rés | 14 → 16 |
| `xl` | 24 | szekciók közt, modal padding | 20 → 24 |
| `xxl` | 32 | képernyő teteje/alja, nagy üres-állapot | marad |

Képernyő oldalmargó mindig `lg` (16). Gombok közti rés `sm` vagy `md`. Nincs 6/10/14/20 új kódban.

### 4.2 Radius (`Theme.radius`), 5 lépcső

| Név | px | Mire | Migráció |
|---|---|---|---|
| `xs` | 4 | progress-sáv, apró jelölő | 3 → 4 |
| `sm` | 8 | input, chip, kis gomb | 10 → 8 |
| `md` | 12 | gomb, lista-sor, kisebb kártya | 10, 14 → 12 |
| `lg` | 16 | kártya, modal, játék-panel | 14, 20 → 16 |
| `full` | 999 | pill, avatar, kerek gomb, tab-jelölő | 24 → full ha pill, különben lg |

Szabály: a belső elem sugara ≤ a külsőé. Kártya `lg`-ben gomb `md`, nem fordítva.

### 4.3 Árnyék (`Theme.shadow`), 2 szint

| Név | iOS | Android | Mire |
|---|---|---|---|
| `card` | shadowOpacity 0.1, radius 8, offset 0/2 | elevation 4 | kártya, kiemelt lista-sor |
| `modal` | shadowOpacity 0.2, radius 16, offset 0/8 | elevation 8 | modal, bottom sheet, lebegő gomb |

Dark témában az árnyék alig látszik, ott a `border` token (1px) adja a kártya szélét. Mindkettőt a `Theme.shadow` adja, nem kézzel.

## 5. Komponens-szabályok

Nem komponens-könyvtár, hanem szabály arra, ami már van. Új közös komponens csak akkor, ha harmadszor írnád ugyanazt.

**Gomb.** Magasság min 44, `radius.md`, felirat `md`/`semibold`. Három szint: elsődleges = `tint` kitöltés + `onTint` szöveg; másodlagos = `card` kitöltés + `border` + `text`; veszélyes = `danger` kitöltés + fehér. Képernyőnként egy elsődleges. Letiltott: opacity 0.4, nem szürke szín (a téma megmarad).

**Kártya.** `card` háttér, `radius.lg`, padding `lg`, `shadow.card` (light) / `border` (dark). Cím `lg`/`semibold`, törzs `md`/`regular`, meta `sm`/`textMuted`.

**Lista-sor.** Min magasság 48, padding függőleges `md`, vízszintes `lg`, elválasztó `border` 1px vagy `sm` rés, sose mindkettő.

**Input.** Magasság 48, `radius.sm`, `border` 1px, fókuszban `tint` 2px, szöveg `md`, placeholder `textMuted`. Spanyol beviteli mező: `autoCapitalize="none"`, `autoCorrect={false}`, különben a rendszer átírja az ékezetet.

**Kvíz-válasz gomb.** Alap = másodlagos gomb; helyes = `success` kitöltés (light: navy szöveg, dark: fehér szöveg nem, `text` szöveg); rossz = `danger` kitöltés + fehér; a többi opció a visszajelzés alatt opacity 0.5. A visszajelzés színén kívül alak is: ✓ / ✗ glyph vagy a szöveg elé kerülő jel.

**Progress-sáv.** Magasság 8, `radius.xs`, háttér `border`, kitöltés `tint` (haladás) vagy `success` (kész). Streak és XP számok `tabular-nums`.

**Tab-sáv.** Aktív `tint`, inaktív `textMuted`, felirat `xs`. Emoji tab-ikon marad, de `accessibilityLabel` a nevével.

**Modal / bottom sheet.** `overlay` alatta, `card` teste, `radius.lg` felül, padding `xl`, `shadow.modal`. Bezárás mindig elérhető gombbal is, nem csak overlay-tap-pal.

**Üres állapot és betöltés.** Minden lista-képernyőn három állapot kötelező: betölt (skeleton vagy `ActivityIndicator` `tint` színnel, min 300 ms után jelenik meg, hogy ne villogjon), üres (egy mondat + egy elsődleges gomb), hiba (egy mondat `danger` + "Újra" másodlagos gomb). "Nincs adat" felirat gomb nélkül nem elég.

## 6. Ikon és illusztráció

Döntés: emoji marad ikonként. Ok: nulla dependency, nulla asset, a nyelvtanuló app hangjához illik, és az agentek instrukció nélkül is konzisztensen használják. Ára: Android és iOS másképp rajzolja, és a színt nem lehet tokenből vezérelni.

Szabályok:
- Emoji csak `Text`-ben, méret a `fontSize` skálából (`md` inline, `xl` gombon, `xxl` üres-állapotban).
- Emoji-only gomb: `accessibilityLabel` kötelező, mert a képernyőolvasó az emoji nevét mondja, nem a funkciót.
- Egy fogalom = egy emoji az egész appban (pl. streak mindig ugyanaz). A választás a `docs/UI-NEVEK.md`-be kerül, hogy ne legyen két "kész" jel.
- Ha valaha ikon-könyvtár jön, egyben jön, nem vegyesen; addig tilos `@expo/vector-icons`-t vegyíteni.

## 7. Mozgás

Két motor van, ez marad, de szabállyal:
- `react-native-reanimated` csak a játékokban (`app/games/`), ahol 60 fps-en sok elem mozog.
- Minden más: RN `Animated` vagy `LayoutAnimation`, `useNativeDriver: true`.

Időzítés: mikro-visszajelzés (gomb-nyomás, chip-váltás) 120-150 ms; képernyő-elem be/ki 200-250 ms; kvíz helyes/rossz visszajelzés 300 ms, aztán 600 ms várakozás a következő kérdés előtt. 400 ms felett semmi, ami a felhasználót várakoztatja.

Reduced motion: `AccessibilityInfo.isReduceMotionEnabled()` egyszer a `ThemeProvider`-ben (új `reduceMotion` mező a contextben), és ha igaz: áttűnés marad, mozgás/ugrálás/konfetti kimarad, a játékokban a lassítás megengedett, de a játékmenet nem változik. Most 0 helyen van ellenőrizve, ez a legnagyobb a11y-lyuk a mozgás oldalon.

Haptika: siker/hiba visszajelzésnél `expo-haptics` (ha telepítve, ellenőrizendő), sose folyamatos.

## 8. Hozzáférhetőség

- Tap-cél min 44×44 pt (`Theme.tapTarget = 44`), ha a vizuális kisebb, `hitSlop` pótolja (ez már 57 helyen jó gyakorlat).
- Kontraszt: szöveg 4.5:1, nagy szöveg (≥ `xl` vagy `lg`+`bold`) és UI-elem 3:1. Az 1. pont táblája a mérés, a 2.1 tokenek a javítás.
- `accessibilityLabel` minden emoji-only és ikon-only gombon; `accessibilityRole="button"` minden `Pressable`-en, ami gombként viselkedik.
- Szín sose egyetlen jel (2.2).
- Dinamikus betűméret: `allowFontScaling` alapból bekapcsolva marad, a layoutok `minHeight`-tel készülnek, nem fix `height`-tel, hogy 130%-os rendszer-betű se vágja le a szöveget. Kivétel: játék-panelek, ahol a `maxFontSizeMultiplier={1.3}` a plafon.
- Reduced motion: 7. pont.

## 9. Tiltások (röviden, agentnek)

1. Inline hex, rgba a komponensben.
2. fontSize/spacing/radius szám, ami nincs a skálában.
3. fontWeight '500' és '800'.
4. Fehér szöveg siker-zöldön.
5. Fix `height` szövegtartalmú elemen (helyette `minHeight`).
6. `@expo/vector-icons` vagy más ikon-lib emoji mellé.
7. Reanimated a játékokon kívül.
8. Animáció 400 ms felett, ami blokkol.
9. "Nincs adat" felirat gomb nélkül.
10. Új közös komponens második használat előtt.

## 10. Migráció

Nincs egyszerre-átírás: 79 fájl, több ezer érték, egy nagy PR csak konfliktust és regressziót hoz.

Szabály: **új kód csak `Theme.ts`-ből; régi érték csak akkor cserélődik, ha a fájlhoz amúgy is hozzányúlsz** (boy-scout), és akkor az egész fájl megy át, nem fele. Bug-fix ágon nincs design-migráció, külön commit, ha mégis.

Baseline és mérés (a repo gyökeréből, `app/` + `components/`):

```
grep -rhoE "#[0-9A-Fa-f]{6}\b" app components | wc -l        # inline hex, baseline 2026-09-16: 231
grep -rhoE "fontSize: *(11|13|15|17|20|26)\b" app components | wc -l   # skálán kívüli méret, baseline: 213
grep -rhoE "fontWeight: *'(500|800)'" app components | wc -l  # kivezetendő súly, baseline: 70
grep -rhoE "(padding|margin|gap)[A-Za-z]*: *(6|10|14|20)\b" app components | wc -l  # rácson kívüli spacing, baseline: 256
```

Ezek a számok csak lefelé mehetnek. Ha egy PR-ben nőnek, a PR nem mehet be. Egy `scripts/audit-design.sh` ezt később kapuvá teheti, amikor a baseline már nulla közelében jár, addig csak jelentés.

Sorrend, ha külön design-ág indul: 1. `Colors.ts` új tokenek + `Theme.ts` (ez a PR), 2. a legtöbbet látott képernyők (tabs index, kvíz, szó-kártya), 3. beállítások és statisztika, 4. játékok utoljára (saját színviláguk lehet, de tokenből).
