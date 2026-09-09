# Kimacha, Play Store teendők (Kálmánnak)

Állapot: 2026-09-09. A gépi rész kész, minden anyag a `store/` mappában.
Részletes leírás, szövegek, űrlap-válaszok: **`store/PLAYSTORE.md`**.

---

## 0. MOST, mielőtt bármi más (5 perc, ne halaszd)

- [ ] **Mentsd el a kiadói kulcsot.** Két fájl, egyik sincs gitben, és ha elvész,
      az app frissítése is elvész vele:
      `android/app/kimacha-upload.jks` és `android/keystore.properties`
      (ebben van a jelszó). Tedd jelszókezelőbe vagy titkosított Drive-mappába.

---

## 1. Play Console fiók (1-3 nap, mert a Google verifikál)

- [ ] https://play.google.com/console → Get started → **Personal account**
- [ ] 25 USD egyszeri díj (Revolut kártya jó)
- [ ] Személyazonosság-igazolás: útlevél + cím
      (a fejlesztői név és cím nyilvános lesz a Play-listán, ez a Google szabálya)
- [ ] Várd meg a verifikációt, addig nem lehet appot létrehozni

## 2. Adatvédelmi nyilatkozat URL (10 perc)

A szöveg kész: `store/privacy-policy.html`. Csak nyilvános linkre van szükség.

- [ ] Döntsd el, hova menjen: GitHub Pages (ehhez publikus repó kell a nevedben),
      Firebase Hosting (a repóban már van `firebase.json`), vagy Google Sites
- [ ] Ha GitHub Pages: **szólj a Claude-nak, egy paranccsal megcsinálja**
      (azért nem csinálta meg magától, mert publikus repót hoz létre a nevedben)
- [ ] Az elkészült URL-t írd be ide: `______________________________`

## 3. App létrehozása a Console-ban (20 perc)

- [ ] Create app → név `Kimacha`, típus **App** (nem Game), **Free**
- [ ] ⚠️ Csomagnév: `com.kimachaapp.kimacha`. A feltöltés pillanatában VÉGLEGES.
      Ha komolyabb nevet akarsz (pl. `hu.feketekalman.kimacha`), MOST szólj,
      utána már nem lehet
- [ ] **App content** szekció végig, a válaszok készen vannak a `PLAYSTORE.md`
      7. és 8. pontjában:
  - [ ] Privacy policy URL (2. pont)
  - [ ] Ads: nincs hirdetés
  - [ ] App access: nincs belépés, minden funkció szabad
  - [ ] Content rating kérdőív (PLAYSTORE.md 8. pont, minden érzékeny kérdésre Nem)
  - [ ] Target audience: **13+** (13 alatt = Families szabályzat, felesleges teher)
  - [ ] Data safety (PLAYSTORE.md 7. pont, 3 adattípus: App interactions,
        Device or other IDs, visszajelzés-szöveg)
  - [ ] Government / Financial / Health kérdések: mind nem

## 4. Store listing (15 perc, minden anyag kész)

- [ ] Rövid leírás: `PLAYSTORE.md` 6. pont (EN vagy HU, amelyik az alap nyelved)
- [ ] Teljes leírás: `PLAYSTORE.md` 6. pont
- [ ] App ikon: `store/play-icon-512.png`
- [ ] Feature graphic: `store/play-feature-1024x500.png`
- [ ] Telefon-képernyőképek: `store/screenshots/` mind a 6
- [ ] Kategória: Education, kapcsolattartási e-mail: edenysza01@gmail.com

## 5. Az AAB feltöltése (10 perc)

- [ ] Testing → **Closed testing** → Create new release
- [ ] Fájl: `android/app/build/outputs/bundle/release/app-release.aab`
      (3.1.15, versionCode 49)
- [ ] **Play App Signing: fogadd el** (új appnál kötelező, és ez véd, ha
      elveszne az upload kulcsod)
- [ ] Release notes: pár sor, mi ez a verzió

Ha közben új buildet kell csinálni (mert változott a kód):

```bash
cd /home/kalmi/ai/kimacha/android
JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64 \
ANDROID_HOME=/home/kalmi/Android/Sdk ANDROID_SDK_ROOT=/home/kalmi/Android/Sdk \
./gradlew :app:bundleRelease -PplayStore=true --console=plain
```

⚠️ A `-PplayStore=true` nélkül a régi debug-kulcsot használja (az a Drive-os APK
útja, azt szándékosan nem bántottuk). Feltöltés előtt ellenőrzés:

```bash
keytool -printcert -jarfile android/app/build/outputs/bundle/release/app-release.aab | grep SHA256
# 2F:EC:66:… kell, NEM fac61745…
```

## 6. 12 tesztelő × 14 nap (ez a leghosszabb, ezt kezdd korán)

Ez kötelező minden új személyes fejlesztői fióknak, enélkül a „Production" gomb
nem nyílik ki.

- [ ] Gyűjts **15-16 embert** (12 a minimum, de aki kilép, kiesik a számlálóból)
- [ ] Mindenkitől a **Gmail-cím kell, amivel a telefonján a Play-be be van lépve**
- [ ] Console → Closed testing → Testers: e-mail-lista vagy Google Groups csoport
- [ ] Küldd ki az opt-in linket (a kész kiküldhető szöveg magyarul és angolul:
      `PLAYSTORE.md` 10. pont)
- [ ] A 14 nap alatt maradjanak bent és nyissák meg néha az appot
- [ ] 14 nap után: **Apply for production**, majd Google-felülvizsgálat (pár nap)

## 7. Amit érdemes tudni, mielőtt telepíted a Play-es verziót

A Play-ből telepített Kimacha MÁS kulccsal van aláírva, mint a telefonodon lévő
Drive-os példány, ezért a kettő nem tud egymásra települni. Ha átállsz:

1. Beállítások → **Mentés** (backup fájl)
2. Régi app eltávolítása
3. Telepítés a Play-ből
4. Beállítások → **Visszaállítás**

---

## Ami már kész és nem kell vele foglalkozni

| Tétel | Hol |
|---|---|
| Upload keystore + gradle aláírás | `android/app/kimacha-upload.jks`, `build.gradle` |
| Aláírt AAB (3.1.15 / 49) | `android/app/build/outputs/bundle/release/app-release.aab` |
| 512×512 ikon | `store/play-icon-512.png` |
| 1024×500 feature graphic | `store/play-feature-1024x500.png` |
| 6 db 1080×1920 képernyőkép | `store/screenshots/` (gitignore-olt, csak ezen a gépen van; a `PLAYSTORE.md` 13. pontja leírja, hogyan generálható újra) |
| Adatvédelmi nyilatkozat (EN + HU) | `store/privacy-policy.html` |
| Listing-szövegek, Data safety, content rating, tesztelő-levél | `store/PLAYSTORE.md` |
