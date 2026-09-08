# Kimacha, Play Store kiadási csomag

Készült: 2026-09-08. Ez a fájl az egyetlen igazságforrás a Play-feltöltéshez.
Minden, ami gépi munka volt, elkészült és le van írva alább; ami Google-fiókot,
bankkártyát vagy emberi eszközt kér, az a „Neked marad" szekcióban van.

---

## 0. Állapot

| # | Tétel | Állapot | Hol |
|---|---|---|---|
| 1 | Saját release (upload) keystore | ✅ kész | `android/app/kimacha-upload.jks` |
| 2 | Gradle aláírás átdrótozva | ✅ kész | `android/app/build.gradle`, `-PplayStore=true` |
| 3 | Aláírt AAB (Play-formátum) | ✅ kész | `android/app/build/outputs/bundle/release/app-release.aab` |
| 4 | Adatvédelmi nyilatkozat szövege | ✅ kész | `store/privacy-policy.html` |
| 5 | Adatvédelmi nyilatkozat **URL-je** | ⏳ publikálni kell | lásd 5. pont |
| 6 | 512×512 ikon | ✅ kész | `store/play-icon-512.png` |
| 7 | 1024×500 feature graphic | ✅ kész | `store/play-feature-1024x500.png` |
| 8 | Telefon-képernyőképek (min 2, max 8) | ✅ kész | `store/screenshots/` |
| 9 | Store-listing szövegek (EN + HU) | ✅ kész | lent, 6. pont |
| 10 | Data safety válaszok | ✅ előkészítve | lent, 7. pont |
| 11 | Content rating válaszok | ✅ előkészítve | lent, 8. pont |
| 12 | $25 Play Console fiók | ❌ neked | lent, 9. pont |
| 13 | 12 tesztelő × 14 nap zárt teszt | ❌ neked | lent, 10. pont |

---

## 1. Az upload keystore

```
Fájl:     android/app/kimacha-upload.jks   (PKCS12, RSA 4096, lejár 2054-01-24)
Alias:    kimacha-upload
Jelszó:   android/keystore.properties fájlban (store + key jelszó azonos), chmod 600
Ujjlenyomat (SHA-256):
  2F:EC:66:CD:E6:C1:BE:7E:DE:7E:25:EC:40:DB:41:40:AE:5E:1D:75:AE:DB:2D:4F:53:12:31:D5:43:F0:AE:8D
```

⚠️ **Ez a két fájl nincs és nem is lesz gitben** (`android/` a `.gitignore`-ban,
`*.jks` szintén). Ha a laptop meghal és nincs másolat, az upload kulcs elvész.
Play App Signing mellett a Google-tól kérhető upload-kulcs-csere, de az napokat
visz. Tedd el mindkét fájlt egy jelszókezelőbe vagy titkosított mentésbe, MA.

⚠️ **Ez NEM ugyanaz a kulcs, mint amivel a telefonodon lévő Kimacha aláírva van.**
A Drive-os APK a repo `debug.keystore`-jával megy (`fac61745…033b9c`). Ezért:
* a `/build-apk` és a `/build_kimacha` folyamat változatlan marad (debug-kulcs,
  a telefonod továbbra is felül tudja telepíteni), mert az új kulcs csak akkor
  aktiválódik, ha a buildet `-PplayStore=true`-val hívod;
* a Play-ből telepített Kimacha viszont **külön alkalmazásnak számít** a mostani
  oldalról telepített példány mellett: a régit előbb el kell távolítani
  (Beállítások → Mentés, uninstall, install a Play-ből, Visszaállítás), különben
  „package conflicts with an existing package" hibát kapsz.

Play-AAB build parancsa (ez futott le, ez ismételhető):

```bash
cd /home/kalmi/ai/kimacha/android
JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64 \
ANDROID_HOME=/home/kalmi/Android/Sdk ANDROID_SDK_ROOT=/home/kalmi/Android/Sdk \
./gradlew :app:bundleRelease -PplayStore=true --console=plain
```

Ellenőrzés feltöltés előtt:

```bash
keytool -printcert -jarfile android/app/build/outputs/bundle/release/app-release.aab | grep SHA256
# 2F:EC:66:… kell legyen, nem fac61745…
```

## 2. A feltöltendő csomag

```
android/app/build/outputs/bundle/release/app-release.aab
versionName 3.1.15   versionCode 49   applicationId com.kimachaapp.kimacha
minSdk 24 (Expo 56 alapértelmezés)   targetSdk 36   méret 71 MB
```

A versionCode nyugodtan maradhat 49: a Play csak azt nézi, hogy a KÖVETKEZŐ
feltöltés száma nagyobb legyen az előzőnél, a 49 pedig szabad kezdőérték.

## 3. Play App Signing

A feltöltéskor a Console felajánlja a Play App Signing-ot, **fogadd el** (új appnál
kötelező is). Ilyenkor a Google generál egy külön terjesztési kulcsot, a te
`kimacha-upload.jks`-ed pedig „upload key" marad. Ez a jó eset: ha egyszer elveszik,
kérhetsz cserét.

## 4. Csomag-név, ami már nem visszavonható

`com.kimachaapp.kimacha` a feltöltés pillanatában véglegessé válik: ezen a néven
soha többé nem tölthetsz fel más appot, és a nevet sem lehet átírni. Ha valaha
kifelé is látszó, komolyabb nevet akarsz (pl. `hu.feketekalman.kimacha`),
MOST kell átírni, mielőtt bármit feltöltesz.

## 5. Adatvédelmi nyilatkozat URL, az egyetlen technikai lépés, ami hátra van

A Play nyilvánosan elérhető linket kér. A szöveg kész (`store/privacy-policy.html`),
csak ki kell tenni valahová. Három út, sorrendben ajánlva:

1. **GitHub Pages** (0 Ft, 3 lépés): publikus repó (akár `kimacha-privacy` néven),
   a fájl `index.html` néven a gyökérbe, Settings → Pages → Branch: `main` / root.
   URL: `https://kalmi91.github.io/<repo>/`. Ez a jelenlegi GitHub-fiókoddal megy
   (`gh auth status` → Kalmi91), de PUBLIKUS repót hoz létre a nevedben és az
   e-mail-címeddel, ezért nem csináltam meg magamtól: szólj, és egy paranccsal kész.
2. **Firebase Hosting**: a repóban már van `firebase.json`, `firebase deploy --only
   hosting` után `https://<projekt>.web.app/privacy-policy.html`.
3. **Google Sites / Notion publikus oldal**: bemásolod a szöveget, kapsz linket.

## 6. Store-listing szövegek

### Alkalmazás neve (max 30 karakter)
```
Kimacha
```

### Rövid leírás (max 80 karakter)

EN:
```
Learn Spanish word by word: spaced repetition, grammar and 12 word games.
```
HU:
```
Tanulj spanyolul szóról szóra: ismétlés, nyelvtan és 12 szójáték.
```

### Teljes leírás (max 4000 karakter)

EN:
```
Kimacha teaches a language the way it actually sticks: one word at a time, and
only sentences you can already read.

WHAT MAKES IT DIFFERENT
Most apps show you a sentence full of words you have never met. Kimacha never
does. A sentence only appears once every word in it has been taught, so you are
never guessing. Grammar is unlocked the same way: a pattern shows up when you
know the words it needs, not when you hit an arbitrary score.

HOW YOU LEARN
- Spaced repetition (FSRS): every card comes back exactly when you are about to
  forget it, not sooner, not later.
- Three steps per word: recognise it, recall it, then type it. A word only counts
  as learned once you can spell it.
- Tap-to-order sentences and typed sentences, kept to one sentence per four
  words, because this is a vocabulary app first.
- A daily new-word budget you control, with a brake that stops new words piling
  up while half-learned ones are still open.
- Tap any word in a sentence to add it to the spelling trainer.
- An "i" button on the cards that explains the actual grammar rule behind what
  you are seeing, in your own language.

TOPICS, NOT A TREADMILL
A tech-tree of topics per level, from A0 to C1: numbers, food, clothing, the
house, the body, work, travel, and the grammar patterns that go with them. Pick
what you need. Skip what you do not. Progress is per topic, and the exam for a
level unlocks when you have mastered enough of it.

12 GAMES, PLAYED WITH YOUR OWN WORDS
Word rain, bubble pop, word search, memory match, conjugation slots, odd one
out, similar-word drills, story mode and more. Every game draws from the words
you have actually studied, and weights the ones you keep getting wrong.

LANGUAGES
Learn Spanish or English. Interface and explanations in Hungarian, English,
Spanish or German.

OFFLINE AND PRIVATE
The whole course is on your phone. No account, no sign-up, no ads. Your progress
never leaves the device, and you can back it up to a file yourself.
```

HU:
```
A Kimacha úgy tanít nyelvet, ahogy tényleg megmarad: szóról szóra, és csak olyan
mondattal, amit már el tudsz olvasni.

MIBEN MÁS
A legtöbb app olyan mondatot mutat, amiben ismeretlen szavak vannak. A Kimacha
soha. Egy mondat csak akkor jön elő, ha minden szavát tanultad már, tehát nem
kell találgatnod. A nyelvtan is így nyílik: egy szerkezet akkor kerül elő, ha
megvannak hozzá a szavak, nem akkor, ha elértél egy pontszámot.

HOGYAN TANULSZ
- Térközös ismétlés (FSRS): minden kártya pont akkor jön vissza, amikor
  elfelejtenéd.
- Szavanként három lépcső: felismerés, előhívás, majd leírás. Egy szó csak akkor
  számít megtanultnak, ha le is tudod írni.
- Összerakós és gépelős mondatok, négy szóra egy mondat arányban, mert ez
  elsősorban szótanuló app.
- Napi új-szó keret, amit te állítasz, plusz egy fék, ami nem enged új szavakat
  rád tolni, amíg a félbehagyottak nyitva vannak.
- A mondat bármelyik szavára koppintva beteheted a helyesírás-gyakorlóba.
- „i" gomb a kártyán, ami a mögötte lévő valódi nyelvtani szabályt elmagyarázza,
  a saját nyelveden.

TÉMÁK, NEM FUTÓSZALAG
Szintenként témakör-fa A0-tól C1-ig: számok, étel, ruha, ház, test, munka,
utazás, és a hozzájuk tartozó nyelvtan. Azt tanulod, amire szükséged van. A
haladás témánként számít, a szintvizsga pedig akkor nyílik, ha eleget tudsz.

12 JÁTÉK, A SAJÁT SZAVAIDDAL
Szó-eső, buborék, szókereső, memória, ragozás-slot, kakukktojás, hasonló szavak,
sztori-mód és több. Minden játék abból dolgozik, amit tényleg tanultál, és azt
hozza fel gyakrabban, amivel szenvedsz.

NYELVEK
Spanyolt vagy angolt tanulhatsz. A felület és a magyarázatok magyarul, angolul,
spanyolul vagy németül.

OFFLINE ÉS PRIVÁT
A teljes tananyag a telefonodon van. Nincs fiók, nincs regisztráció, nincs
hirdetés. A haladásod nem hagyja el a készüléket, és fájlba magad is mentheted.
```

### Kategória és címkék
* App kategória: **Education** (alternatíva: Educational games, ha a Játék fül
  miatt inkább játéknak akarod pozicionálni; Education a pontosabb).
* Címkék: Language learning, Education, Vocabulary, Flashcards, Spanish.
* Kapcsolattartási e-mail: `edenysza01@gmail.com`.
* Weboldal: nem kötelező, üresen hagyható.

## 7. Data safety űrlap, kitöltendő válaszok

Az app tényleges viselkedése alapján (kód: `lib/analytics.ts`,
`components/FeedbackModal.tsx`), tehát ezek nem tippek:

| Kérdés | Válasz |
|---|---|
| Gyűjt vagy megoszt az app felhasználói adatot? | **Igen, gyűjt** (megosztás: nem) |
| Titkosított továbbítás? | **Igen** (HTTPS) |
| Kérhető-e adattörlés? | **Igen**, e-mailben (`edenysza01@gmail.com`) |
| Megfelel a Families szabályzatnak? | nem releváns, ha a célközönség 13+ |

Adattípusok, amiket be kell jelölni:

1. **App activity → App interactions**
   * Gyűjtve: igen. Megosztva: nem.
   * Kötelező vagy opcionális: **kötelező** (automatikus, nincs kikapcsolója).
   * Cél: **Analytics** és **App functionality**.
   * A felhasználó személyéhez kötve: **nem** (nincs fiók, nincs név, nincs e-mail).
2. **Device or other IDs**
   * Gyűjtve: igen (a telepítéskor generált véletlen UUID). Megosztva: nem.
   * Kötelező. Cél: **Analytics**.
   * Személyhez kötve: **nem**.
   * (Ez nem az Android reklám-azonosító és nem eszközazonosító, de a Play ebbe a
     kategóriába sorolja a perzisztens, appon belüli azonosítót is.)
3. **Messages → Other in-app messages** *(vagy „Other user-generated content", a
   Console aktuális szóhasználata szerint)*
   * Gyűjtve: igen, a beküldött visszajelzés szövege. Megosztva: nem.
   * **Opcionális** (csak ha a felhasználó megnyomja a Küldés gombot).
   * Cél: **App functionality**, **Developer communications**.
   * Személyhez kötve: nem.

Amit **NEM** szabad bejelölni, mert nincs: helyadat, névjegyek, fotó/videó,
hangfelvétel, fájlok, pénzügyi adat, egészségügyi adat, e-mail-cím, név,
telefonszám, hirdetési azonosító, crash-log, harmadik féllel megosztás, hirdetés.

Ha a Play kéri az „Ads" nyilatkozatot: **az app nem tartalmaz hirdetést**.

## 8. Content rating kérdőív (IARC), várható válaszok

Kategória: **Reference, News, or Educational**.

| Kérdés | Válasz |
|---|---|
| Erőszak (bármilyen formában) | Nem |
| Szexualitás, meztelenség | Nem |
| Trágár nyelvezet | Nem |
| Drog, alkohol, dohány | Nem (a szókincsben szerepel „la cerveza", „el vino" mint hétköznapi szó, ez nem drog-ábrázolás) |
| Szerencsejáték, szimulált szerencsejáték | Nem |
| Ijesztő tartalom | Nem |
| Felhasználók közti interakció, chat | **Nem** (a visszajelzés csak a fejlesztőhöz megy, más felhasználó nem látja) |
| Helymegosztás | Nem |
| Személyes adat megosztása felhasználók közt | Nem |
| Digitális vásárlás / in-app purchase | Nem |
| Felhasználói tartalom megosztása | Nem |

Várható besorolás: PEGI 3 / ESRB Everyone / USK 0.

**Célközönség és tartalom** űrlap: célcsoport **13 év és felette**. Ha 13 alattit
is bejelölsz, életbe lép a Families szabályzat (szigorúbb reklám- és
adatszabályok, plusz felülvizsgálat), nincs rá szükség.

## 9. Neked marad, Play Console fiók

1. https://play.google.com/console → „Get started" → **Personal account**.
2. Egyszeri **25 USD** regisztrációs díj, bankkártyával (a Revolut megy).
3. Személyazonosság-igazolás: fényképes okmány (útlevél jó) + cím megadása.
   A cím és a fejlesztői név **nyilvános lesz** a Play-listán, ez a Google
   szabálya minden fejlesztőnél. Ha nem akarod a lakcímet kiadni, a Google
   elfogadja a „Developer" típusú kapcsolattartási címet is, de valamilyen címet
   meg kell adni.
4. A verifikáció 1-3 nap.
5. Ezután: „Create app" → név `Kimacha`, alapértelmezett nyelv, „App" (nem
   „Game"), „Free", és a nyilatkozatok kipipálása.

## 10. Neked marad, 12 tesztelő × 14 nap

2023 novembere óta minden ÚJ személyes fejlesztői fióknak kötelező zárt tesztet
futtatnia, mielőtt élesbe teheti az appot. A szabály:

* **legalább 12 tesztelő**, akik **opt-inelnek**, és **folyamatosan bent maradnak
  14 egymást követő napig** (aki kilép, kiesik a számlálóból, ezért inkább 15-16
  embert hívj meg);
* a tesztelőknek **ténylegesen telepíteniük kell** és használniuk az appot (a
  Google „jelentős" használatot vár, nem elég feltelepíteni és törölni);
* csak utána nyílik meg a „Apply for production" gomb.

Amit ehhez oda kell adni a tesztelőknek:

1. Készíts egy **Google Groups** csoportot (pl. `kimacha-testers@googlegroups.com`),
   és a Console → Testing → Closed testing → Testers fülre a csoport címét add meg
   (egyszerűbb, mint 12 e-mail-cím kézzel karbantartani).
2. Mindenki **Google-fiókkal** (Gmail-cím) csatlakozik, azzal, amelyikkel a
   telefonján be van jelentkezve a Play áruházba.
3. Küldd ki nekik az opt-in linket, amit a Console generál.

Kiküldhető szöveg (magyar):

```
Szia! Kiadás előtt áll a Kimacha nyelvtanuló appom, és a Google 12 tesztelőt kér
14 napra, mielőtt engedi kirakni. Segítenél?

Amit kérek:
1. Küldd el a Gmail-címed, amivel a telefonodon a Play áruházba be vagy
   jelentkezve (más címmel nem működik).
2. Kapsz egy linket, ott „Become a tester", majd a Play-ből telepítés.
3. Hagyd fent 14 napig, és nyisd meg néhányszor. Tanulni is lehet vele,
   spanyolt és angolt tud, magyar felülettel.
4. Ha valami hibás, az appon belül van visszajelzés gomb, egyből hozzám jut.

Köszi, enélkül nem tudom kirakni.
```

Angol változat, ha kell:

```
Hi! My language-learning app Kimacha is ready for release, but Google requires
12 testers to stay opted in for 14 days before it can go public. Would you help?

1. Send me the Gmail address your phone uses in the Play Store.
2. You will get a link, tap "Become a tester", then install from Play.
3. Keep it installed for 14 days and open it a few times.
4. There is a feedback button inside the app if anything is broken.

Thanks, I cannot publish without this.
```

## 11. A feltöltés sorrendje a Console-ban

1. Create app.
2. **App content**: Privacy policy URL (5. pont), Ads → nincs, App access → nincs
   belépés, Content rating (8. pont), Target audience → 13+, Data safety (7. pont),
   Government apps → nem, Financial features → nincs, Health → nincs.
3. **Store listing**: név, rövid + teljes leírás (6. pont), ikon
   (`store/play-icon-512.png`), feature graphic (`store/play-feature-1024x500.png`),
   telefon-képernyőképek (`store/screenshots/`).
4. **Testing → Closed testing → Create new release**: AAB feltöltése, Play App
   Signing elfogadása, release notes, tesztelők hozzáadása (10. pont).
5. 14 nap + 12 tesztelő után: **Apply for production**, majd a végleges
   felülvizsgálat (pár nap).

## 12. Amit érdemes még megnézni feltöltés előtt

* A 71 MB-os AAB négy CPU-architektúrát tartalmaz; a Play felhasználónként csak a
  szükséges szeletet tölti le, tehát a tényleges letöltés jóval kisebb. Nem kell
  vele csinálni semmit.
* A `README.md` és a repó publikus volta nem érinti a Play-t.
* Az app „Kimacha Feedback" Google Sheetje a te privát táblázatod marad; a
  nyilatkozat pontosan ezt írja le.

---

## 13. A képernyőképek, hogyan készültek (megismételhető)

Emulátor nélkül, a repó web-targetjéből (`react-native-web` + `database.web.ts`),
az FB162-ben leírt módszerrel:

```bash
npx expo export --platform web --output-dir /tmp/webexport
cd /tmp/webexport && python3 -m http.server 8099 &
agent-browser batch "open http://localhost:8099/" "set device 'Pixel 9'" \
  "find text English click" "find text Español click" "screenshot shot.png"
```

A nyers felvétel 1082x2423 (Pixel 9, 2.75x pixelarány), ez 2.24:1, amit a Play
elutasít (max 2:1). Ezért mindegyik kép egy 1080x1920-as (pontosan 9:16) sötét
háttérre került, felül egy rövid felirattal:

```bash
convert -size 1080x1920 gradient:'#0F172A-#134E5E' \
  \( shot.png -resize x1660 \) -gravity south -geometry +0+40 -composite \
  -gravity north -font DejaVu-Sans-Bold -pointsize 46 -fill white \
  -annotate +0+62 'Felirat' -alpha remove PNG24:out.png
```

Kész fájlok (`store/screenshots/`, mind 1080x1920 PNG):

| Fájl | Mit mutat | Felirat |
|---|---|---|
| `01-learn.png` | szó-kártya felfedve, hang + „Type It" | Learn a word, hear it, type it |
| `02-topics.png` | témakör-fa A0.1-A0.3 + Grammar course belépő | Choose your topic, skip what you do not need |
| `03-grammar.png` | nyelvtani tanterv-képernyő | Every grammar rule from A1 to C1 |
| `04-games.png` | 12 játék a Game fülön | 12 games, played with the words you know |
| `05-stats.png` | statisztika + ütemezés | See what is scheduled and when |
| `06-settings.png` | beállítások (napi új szó, heti cél, nehézség) | You set the pace, not the app |

Megjegyzés: a `04-games.png` friss profilon készült, ezért a játékok többségénél
„N more words needed" felirat látszik. Ha feloldott állapotban akarod mutatni,
ahhoz kb. 20 megtanult szó kell a munkamenetben; ezt kézzel gyorsabb végigvinni,
mint bottal (a gépelős kártyát a bot nem tudja megválaszolni).
