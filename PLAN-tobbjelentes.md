# PLAN-tobbjelentes: több jelentésű szavak (SZ8) + a nem pénzzé tehető régi szavak kidobása

Ág: `feat/multi-meaning-words`, worktree: `C:\AI\kimacha-szavak-wt-multi-meaning` (node_modules = junction a fő klónra).
Indult: 2026-10-01 12:02, Kálmán „mehet, indulhat". Becslés: kb. 6 óra, 8/10.
Jóváhagyott minta: https://claude.ai/artifact/BW7QfMboUhRby7DyZNL6WQ (4. verzió). Szabály: `ai-workspace/kimacha/SZAVAK.md` SZ8.

## Lépések

- [x] 1. (12:02) Ág + worktree + ez a terv → kész, ha: a worktree áll, a PLAN megvan
- [x] 2. (12:09) Kapuk: `scripts/words-open-check.mjs` (R1/R2 lazítás, R11-R14) és `scripts/validate-en-track.mjs` (R11-R14) → kész, ha: mindkét kapu lefut és listázza a mostani sértéseket
- [x] 3. (12:19) App: kis mondat (hint) a nagy szó alatt + „also:” sor a Check után + tesztek → kész, ha: `npm run typecheck:ci`, `npm run lint`, `npm run test:ci` zöld
- [x] 4. (12:35) Átnézés A: a 600 words-open kártya (angol→spanyol) a Spec szerint → kész, ha: `node scripts/words-open-check.mjs` zöld
- [ ] 5. Átnézés B: a 2 804 tételes angol track (spanyol→angol), adagokban → kész, ha: a `validate-en-track` R11-R14 hibája 0, és a régi hibák (id-blokk 1132, cross-level dup 11) száma nem nő
- [ ] 6. Régi adat leltára (csak olvasás): ki használja a `data/words/{a0..c2}.json`, `data/words/hu/**` és `data/pcic/**` fájlokat → kész, ha: a lista megvan, az orkesztrátor döntött a törlési körről
- [ ] 7. Régi adat kidobása + a ráépülő kód kivétele → kész, ha: a 3. lépés kapuja zöld
- [ ] 8. Web-build képernyőkép mindkét irányban (néma felolvasással) → kész, ha: egyezik a mintával
- [ ] 9. Kapu + push + PR → kész, ha: PR nyitva; merge Kálmán szavára

## Kálmán döntései (szó szerint, 2026-10-01)

- „2 kell választani, mert van amikor egy szónak car esete több spanyol szó van rá de ugyan azt jelenti, és van amikor teljesen külön jelentés van. Ha a jelentés megegyezik akkor igen ott többet fogadjunk el. De ha más a jelentése akkor egy mondattal érzékeltetni kellene, hogy most melyik kell"
- „csak a több jelentésű szavakra"
- „ez a formátum tetszik jól néz ki és az összes már létező szó nál aminek két jelentése van meg kell csinálni és a többik amik létre lesznek hozva azokatnál is így kell"
- „a és b ami már megvan te most ezt javítsd ki" (a = words-open 600, b = a spanyol→angol pakli)
- „most a 600 szó a lényeg, a többi szavakat dobni kell, mert azok ha jól tudom nem monetizálhatóak" + „2804 az AI generált" → a 2 804 marad és javul, a régi spanyol (SUBTLEX-ESP) és a PCIC kiesik.

## Spec (a subagent ezt hajtja végre 1:1)

### Két pakli, két irány

- **Angol→spanyol** (angolul beszélő tanul spanyolt): `data/words-open/{a1,a2,b1,b2}.json`, kérdés = `en`, válasz = `es`. Kártyakulcsok (13, ebben a sorrendben): order, level, pos, lemma, es, hu, en, de, sentence_es, sentence_hu, sentence_en, sentence_de, sentence_lemmas. Új opcionális kulcs: `hint_en` (a `de` után, csak ha kell).
- **Spanyol→angol** (spanyolul beszélő tanul angolt): `data/words/en/{a0,a1,a2,b1}.json`, kérdés = `es`, válasz = `en`. Kulcsok: id, level, es, hu, en, de, topic, topicOrder, sentence_es, sentence_hu, sentence_en, sentence_de, pos. Új opcionális kulcs: `hint_es` (a `de` után, csak ha kell).

### Adatszabályok

- **S1 Azonos jelentés, több jó válasz.** A VÁLASZ-mezőben (words-open: `es`, angol track: `en`) az azonos jelentésű, az adott szinten szokásos alakok ` / `-lel elválasztva, az első a fő alak: `el carro / el coche / el auto`. Spanyolnál a fő alak a mexikói (S4). Ritka, regionális, szleng alak nem kerül be. Az app értékelője (`lib/pcicMatch.ts` `pcicAlternatives`) eredetileg csak a szóközmentes `a/b` alakot oldotta fel; a ` / ` bontását a 3. lépésben javítottuk (`pcicAlternatives`, `kindOfEs`), a szóközmentes `a/b` változatlan.
- **S2 Különböző jelentés = külön kártya + kis mondat.** Ha a KÉRDÉS szavának két (vagy több) gyakori, különböző jelentése van, amely más-más válaszszót kíván (to play → jugar / tocar; while → mientras / un rato; banco → bank / bench), akkor jelentésenként külön kártya van, és MINDEGYIK kap egy kis mondatot a kérdés nyelvén (words-open: `hint_en` angolul, angol track: `hint_es` spanyolul). A mondatban a kérdezett szó `*csillag*` között áll, pontosan egyszer (ragozott alak is jó: „I *play* soccer.”). A mondat legfeljebb 8 szó, hétköznapi, és egyértelműen csak azt az egy jelentést engedi. A hiányzó jelentés kártyáját létre kell hozni.
- **S3 Kis mondat csak ott.** `hint_*` csak olyan kártyán van, amelynek a kérdése (normalizálva: kisbetű, trim, névelő nélkül) a paklin belül legalább két kártyán szerepel. Máshol nincs.
- **S4 Mexikói norma** a spanyol oldalon (words-open `es` és mondatai, az angol track `es` kérdése és `sentence_es`-e): carro, celular, computadora, departamento, papa, boleto, jugo, manejar, rentar; a „hoy/ya” + indefinido. Spanyolországi alak legfeljebb második alternatívaként (S1), kérdésben soha.
- **S5 Stabil azonosítók.** Meglévő `order` / `id` nem változik (a tanulási haladás ezekhez kötött). Új words-open kártya: `order` 601-től folyamatosan, a jelentés szintjének fájljába, a tömbben közvetlenül a testvérkártyája után (ha más szintű, a fájl végére). Új angol track tétel: az adott szint fenntartott id-blokkjának következő szabad id-je (`validate-en-track.mjs` blokkszabálya szerint).
- **S6 Azonos jelentésű kettős kérdés** (pl. az angol trackben az `es` „el trabajo” két kártyán, job és work): összevonás egy kártyába S1 szerint, a másik kártya törlődik. A törölt id-k listája ennek a fájlnak a „Napló” részébe kerül.
- **S7 Teljes új kártya.** Az új kártya minden mezője ki van töltve a fájl sémája szerint (hu, de, négy mondat; words-open-ban `sentence_lemmas` is), és teljesíti a fájl meglévő szabályait (words-open R3-R10, angol track `validate-en-track`).

### Kapuk (2. lépés)

`scripts/words-open-check.mjs`:
- R1 lazítás: a `lemma`+`en` pár és az `es`+`en` pár egyedi (egy lemma több jelentéssel több kártyán lehet).
- R2 lazítás: szintenként legalább 150 kártya; `order` egyedi és hézagmentes 1..N; az order-sáv = szint szabály csak az 1-600-ra él, 600 fölött a `level` mező dönt. A 13 kulcs sorrendje marad, a `hint_en` opcionális 14. kulcs a `de` után.
- R3-R10: az „már tanult szó” halmaz egy 600 fölötti kártyánál azokból a kártyákból áll, amelyek szintje legfeljebb a kártya szintje (a meglévő logikát kell ehhez igazítani, a 600 alattiaknál a viselkedés nem változik).
- R11: ha egy normalizált `en` kérdés legalább két kártyán szerepel, mindegyiknek kötelező a `hint_en`.
- R12: a `hint_en`-ben pontosan egy `*…*` jelölés van, és a jelölt szó első 2 betűje (kisbetű, ékezet nélkül) egyezik a kérdés valamelyik szavának első 2 betűjével (play / plays / played, juego / jugar, llevo / llevar), legfeljebb 8 szó. (Lazítva 12:13, orkesztrátori döntés: a szó szerinti „kezdődik” a ragozott spanyol alakokat kizárta.)
- R13: `hint_en` csak R11 szerinti kártyán.
- R14: a perjeles `es`-ben minden alternatíva nem üres, nincs ismétlés, az elválasztó pontosan ` / `.

`scripts/validate-en-track.mjs`: ugyanez az R11-R14 a `es` kérdésre és a `hint_es`-re (R14 a perjeles `en`-re). A meglévő szabályok maradnak.

A kapu szabályonként kiírja a hibák számát és az első 5 példát, hibánál exit 1.

### App (3. lépés)

- `data/pcic.ts`: `PcicItem` új mezője `hint?: string`. `itemsFromOpen`: `hint: c.hint_en || undefined`. `itemsFromWords` (angol track, `e` előtag): `hint: w.hint_es || undefined`.
- `app/(tabs)/index.tsx`: a nagy kérdés-szó sora (FitText + 🔊) ALATT, a szófaj-chip FÖLÖTT, ha `currentItem.hint` van: egy `Text`, 14 px, `colors.tabIconDefault` színnel, középre; a `*…*` rész `colors.text` színű, félkövér, rózsaszín (#EC4899) aláhúzással; a csillagok nem látszanak. `testID="learn-hint"`. Gépeléskor és a Check után is látszik. Felolvasás nem változik.
- `components/learn/PcicRevealedAnswer.tsx`: ha a válasznak több alternatívája van (`pcicAlternatives`), a helyes alak alatt egy sor: `also: b · c` (en) / `también: b · c` (es), kisebb, szürke betűvel, a nem mutatott alternatívák félkövérrel; a felsorolásból kimarad a mutatott alak. `testID="learn-also"`. i18n kulcs `pcic.alsoLabel` mindkét nyelvi fájlban.
- Tesztek (jest): hint megjelenik és nincs benne csillag; hint nélküli kártyán nincs `learn-hint`; perjeles válasznál az `learn-also` a többi alakot mutatja; egy alakú válasznál nincs `learn-also`.

### Átnézés (4-5. lépés)

- Az agent a nagy JSON-t nem olvassa be a kontextusába: egy script tömör sorokat ír egy scratch-fájlba (`order|level|pos|es|en` vagy `id|level|pos|es|en|topic`), az agent abból dolgozik, a módosításokat egy patch-JSON-ba írja (`{edit: {<order|id>: {mező: érték}}, add: [teljes kártya], remove: [id]}`), és egy merge-script alkalmazza. A meglévő kártyák mezői közül csak a szükséges változik (S1, S2, S4, S6).
- Angol track adagokban: kb. 700 sor adagonként, adag után kapu.
- Minden adag után 20 véletlen módosításból álló minta a Naplóba (előtte → utána), az orkesztrátor ezt nézi át.

### 4-5. lépés kiegészítés (orkesztrátor, 12:25)

- **Mit kell megtalálni** (mindkét paklin):
  1. Kettős kérdés (R11): ugyanaz a normalizált kérdés több kártyán (words-open most: there×2, when×2).
  2. Zárójeles kérdés-pár: a kérdés zárójeles pontosítással különíti el a jelentéseket (pl. „to be (state, location)” = estar és „to be (…)” = ser; „to know (…)” = saber / conocer). Ezeket át kell írni a jóváhagyott formára: a kérdés a puszta szó („to be”, „to know”), a jelentést a `hint_*` mondat mutatja. Zárójeles pontosítás, amelynek nincs testvérkártyája és nem más-más válaszszót választ el, marad.
  3. Egyetlen kártyás többjelentésű kérdés, amelynek a másik, GYAKORI jelentése más válaszszót kíván, és az a jelentés legfeljebb B2 szintű (pl. to play → tocar is): a hiányzó kártya létrehozása S2 és S7 szerint, mindkét kártyára `hint_*`.
  4. S1 szinonimák (azonos jelentés, több jó válasz) és S4 mexikói norma (pl. a #114 „car” = „el coche” → „el carro / el coche / el auto”).
- **Pontatlan kérdés:** ha a kettős kérdés csak pontatlan angol (spanyol) kérdés miatt kettős, és a természetes kérdésforma egyértelmű (hay = „there is / there are”, nem „there”), akkor a kérdés javítása az első választás; S2 csak valódi többjelentésnél.
- **R12 angol rendhagyó igék:** a jelölt szó akkor is elfogadott, ha a kérdés igéjének rendhagyó alakja (be: am, is, are, was, were; have: has, had; do: does, did; go: goes, went). A hint mondat lehetőleg jelen időben áll.
- **Angol track új id (S5 pontosítása):** a meglévő id-blokkok már most túlcsordultak (1132 régi „id outside block” hiba), ezért új tétel id-je = az egész angol track legnagyobb id-je + 1, folyamatosan. A régi id-blokk hibákat ez a menet nem javítja.
- **Minta a Naplóba:** adagonként 20 véletlen módosítás előtte → utána, plusz MINDEN új kártya és MINDEN törölt id felsorolva.

## Napló

- 12:02 ág + worktree kész (`feat/multi-meaning-words` origin/main 149460a-ról).
- 12:09 2. lépés kész: words-open-check (R1/R2 lazítás, R4 szint-alapú „tanult" halmaz 600 fölött, R11-R14 a scripts/multi-meaning-rules.mjs-ben közösen) + validate-en-track R11-R14. Mostani adaton: words-open R11 4 hiba (there×2, when×2), R1-R10 ok; angol track R11 195 hiba, R12-R14 ok.
- 12:13 R12 lazítva a scripts/multi-meaning-rules.mjs-ben (első 2 betű, ékezet nélkül); a Spec R12 sora frissítve.
- 12:19 3. lépés kész: `pcicAlternatives` ( / ) javítva, `kindOfEs` alternatívánként számol, PcicItem.hint + learn-hint a nagy szó alatt, learn-also a Check után (pcic.alsoLabel en/es), jest tesztek (pcicMatch, articlePicker, pcicHint). typecheck:ci, lint (0 hiba), test:ci zöld; words-open-check csak R11 (4).
- 12:35 4. lépés kész: módosítva 37, hozzáadva 1, törölve 0 kártya; kérdés átírva 6. A gate zöld: words-open-check (601 kártya), typecheck:ci, test:ci (136 suite) zöld, lint 0 hiba; validate-en-track R12-R14 0 (R11 195 marad az 5. lépésre).
  - Új kártya: #601 (a2.json, #227 jugar után) to play → tocar, hint_en "She *plays* the piano very well.".
  - Törölt id: nincs (a words-open R2 hézagmentes order-t kér, és S5 szerint meglévő order nem változik; az allí/ahí és cuándo/cuando kettős kérdés S2 szerint külön kártya maradt, hint-tel).
  - Átírt kérdés (zárójeles → puszta szó + hint_en): #2 "to be (state, location)" → "to be", hint_en "I *am* at home now."; #11 "to be (identity, quality)" → "to be", hint_en "I *am* a student."; #74 "to know (a fact), to know how to" → "to know", hint_en "I *know* the answer."; #216 "to know (a person or place), to meet" → "to know", hint_en "I *know* your sister."; #281 "time (occasion)" → "time", hint_en "This is my first *time* here."; #447 "where (relative)" → "where", hint_en "This is the house *where* I live.".
  - Csak hint_en kapott (R11 kettős kérdés, a kérdés változatlan): #22 time "I need more *time* to finish."; #91 where "*Where* is the bathroom?"; #101 there "The park is *there*, far from here."; #161 when "*When* does the class start?"; #166 when "Call me *when* you arrive."; #179 there "Your keys are *there*, next to you."; #227 to play "I *play* soccer with my friends.".
  - S1 (perjeles es, fő alak első): #10 "feliz" → "feliz / contento"; #61 "pequeño" → "pequeño / chico"; #122 "el teléfono" → "el teléfono / el celular"; #134 "bonito" → "bonito / lindo"; #201 "volver" → "volver / regresar"; #225 "responder" → "responder / contestar"; #244 "el médico" → "el médico / el doctor"; #245 "el profesor" → "el profesor / el maestro"; #268 "la habitación" → "la habitación / el cuarto"; #307 "elegir" → "elegir / escoger"; #404 "el pelo" → "el pelo / el cabello"; #436 "quizá" → "quizá / quizás / tal vez"; #535 "el salario" → "el salario / el sueldo"; #114 "el coche" → "el carro / el coche / el auto", lemma coche → carro.
  - S4: a lemma-váltás miatt a "coche" → "carro" a mondatokban és a sentence_lemmas-ban is (#114, 188, 234, 238, 287, 325, 341, 549, 573); hoy/ya + indefinido: #177 (he comido → comí), #219 (he terminado → terminé), a sentence_en is igazítva.
  - Kód/teszt (a data miatt kellett): lib/grammar/tableDeck.ts pcicWordIndex a perjeles es fő alakját (az első) indexeli, különben a clases-de-palabras szó-pakli elvesztett egy kártyát (a bájtra-egyező teszt 26 → 25); data/__tests__/pcic.test.ts a darabszám 150-151-150-150 / 601.
  - [?] marad, nem nyúltam hozzá (a zárójel pontosabb, mint egy mondat, vagy nincs tiszta mondat): #4 "you (informal)" / #37 "you (formal)" (tú/usted), #58 "your (informal)" / #59 su, #100 "this" / #157 "this (thing)" és #156 "that" / #158 "that (thing)" (este/esto, ese/eso). Döntés kell: hint-re cseréljük-e őket.
  - Minta, 20 véletlen módosítás (előtte → utána):
    - #2 en: "to be (state, location)" → "to be"; hint_en: (nincs) → "I *am* at home now."
    - #10 es: "feliz" → "feliz / contento"
    - #11 en: "to be (identity, quality)" → "to be"; hint_en: (nincs) → "I *am* a student."
    - #22 hint_en: (nincs) → "I need more *time* to finish."
    - #74 en: "to know (a fact), to know how to" → "to know"; hint_en: (nincs) → "I *know* the answer."
    - #91 hint_en: (nincs) → "*Where* is the bathroom?"
    - #101 hint_en: (nincs) → "The park is *there*, far from here."
    - #114 es: "el coche" → "el carro / el coche / el auto"; lemma: "coche" → "carro"; sentence_es: "Mi padre tiene un coche nuevo." → "Mi padre tiene un carro nuevo."; sentence_lemmas: [mi,padre,tener,un,coche,nuevo] → [mi,padre,tener,un,carro,nuevo]
    - #134 es: "bonito" → "bonito / lindo"
    - #161 hint_en: (nincs) → "*When* does the class start?"
    - #179 hint_en: (nincs) → "Your keys are *there*, next to you."
    - #188 sentence_es: "Mi coche es peor que tu coche." → "Mi carro es peor que tu carro."; sentence_lemmas: [mi,coche,ser,peor,que,tu,coche] → [mi,carro,ser,peor,que,tu,carro]
    - #201 es: "volver" → "volver / regresar"
    - #227 hint_en: (nincs) → "I *play* soccer with my friends."
    - #238 sentence_es: "Mi padre vendió su coche." → "Mi padre vendió su carro."; sentence_lemmas: [mi,padre,vender,su,coche] → [mi,padre,vender,su,carro]
    - #287 sentence_es: "Mi coche es muy rápido." → "Mi carro es muy rápido."; sentence_lemmas: [mi,coche,ser,muy,rápido] → [mi,carro,ser,muy,rápido]
    - #307 es: "elegir" → "elegir / escoger"
    - #325 sentence_es: "¿Puedes mover tu coche?" → "¿Puedes mover tu carro?"; sentence_lemmas: [poder,mover,tu,coche] → [poder,mover,tu,carro]
    - #549 sentence_es: "Este modelo de coche es nuevo." → "Este modelo de carro es nuevo."; sentence_lemmas: [este,modelo,de,coche,ser,nuevo] → [este,modelo,de,carro,ser,nuevo]
    - #573 sentence_es: "No tengo suficiente dinero para comprar este coche." → "No tengo suficiente dinero para comprar este carro."; sentence_lemmas: [no,tener,suficiente,dinero,para,comprar,este,coche] → [no,tener,suficiente,dinero,para,comprar,este,carro]
