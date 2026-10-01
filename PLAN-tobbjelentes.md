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
- 12:47 5. lépés, 1. adag (R11, 195 kettős kérdés → 0): módosítva 114, hozzáadva 1, törölve 50 kártya; spanyol kérdés átírva 11.
  - Új kártya:
    - #10798 (A1 house) la caja → box, hint_es "Guardo mis libros en una *caja*."
  - Törölt id (→ a megtartott id, ahová az alak átkerült; az `en` mezőben ` / ` alternatíva vagy a másik kártya azonos tartalmú):
    5807 adiós → bye (→ 5806); 5055 la manzana → apple (→ 5019); 5057 el huevo → egg (→ 5217); 5072 el brazo → arm (→ 5218); 5105 la casa → house (→ 5220); 5113 la mesa → table (→ 5221); 5123 el perro → dog (→ 5018); 5146 el ingeniero → engineer (→ 5219); 7721 la hora → hour (→ 5216); 7744 la flor → flower (→ 7910); 7810 encima de → on top of (→ 5122); 7902 está bien → it is fine (→ 5819); 7911 un amigo → a friend (→ 5839); 7933 está durmiendo → is sleeping now (→ 5374); 7959 la habitación → room (hotel) (→ 5107); 8001 el pescado → fish (food) (→ 5059); 8002 el pollo → chicken meat (→ 5262); 8004 el cuchillo → knife (→ 8152); 8012 el cerdo → pig (animal) (→ 5325); 8048 el trabajo → work (→ 5837); 8148 ¿de dónde eres? → where are you from (→ 5360); 8150 ¿por qué no? → why not now (→ 5362); 8357 ¿cómo estás? → how are you today (→ 5821); 8424 está trabajando → is working now (→ 5375); 8427 está leyendo → is reading now (→ 5191); 8526 la cabeza → head (part) (→ 5071); 8650 la farmacia → drugstore (→ 5896); 5430 el viaje → journey (→ 8230); 5489 enfermo → sick (→ 8046); 5653 la caja → checkout (→ 8222); 5684 el descanso → rest (→ 5563); 5714 más difícil (adjetivo largo) → more difficult (→ 5713); 5727 el más difícil (adjetivo largo) → most difficult (→ 5726); 8826 el horario → schedule (transport) (→ 5564); 8867 el título → diploma (→ 5539); 8904 la carpeta → folder (digital) (→ 5764); 8908 la impresora → printer (device) (→ 5762); 8923 el informe → report (document) (→ 5560); 9022 el vuelo → flight (trip) (→ 5427); 9027 el país → country (nation) (→ 5832); 9244 el descanso → break (rest) (→ 5563); 9331 el azúcar → sugar (health) (→ 5062); 10137 la enfermedad → disease (→ 8047); 10206 preocupado → concerned (→ 5498); 10330 el objetivo → aim (→ 9119); 10385 seguramente → surely (→ 5645); 10466 la mayoría → majority (→ 9017); 10472 por supuesto → naturally (→ 5817); 10679 avergonzado → ashamed (→ 5506); 10787 la garantía → warranty (→ 8835).
  - Átírt spanyol kérdés:
    - #5100: "hay (plural)" → "hay"
    - #5101: "no hay (plural)" → "no hay"
    - #5102: "¿hay...? (plural)" → "¿hay...?"
    - #5300: "¿no hay...? (plural)" → "¿no hay...?"
    - #8053: "el frío" → "el clima frío"
    - #8344: "caliente" → "tibio"
    - #5708: "más alto (no persona)" → "más alto"
    - #5709: "más bajo (no persona)" → "más bajo"
    - #5722: "el más alto (no persona)" → "el más alto"
    - #5723: "el más bajo (no persona)" → "el más bajo"
    - #8832: "la cola" → "la fila"
  - Minta, 20 véletlen módosítás (előtte → utána):
    - #5028 hint_es: (nincs) → "Mis zapatos son de color *café*."
    - #5299 hint_es: (nincs) → "¿*No hay* una farmacia aquí?"
    - #5506 en: "embarrassed" → "embarrassed / ashamed"
    - #5514 hint_es: (nincs) → "Los hoteles son *más caros* en verano."
    - #5515 hint_es: (nincs) → "El tren es *más barato* que el avión."
    - #5517 hint_es: (nincs) → "Ella es *más baja* que su hermana."
    - #5518 hint_es: (nincs) → "Hoy el viento está *más fuerte* que ayer."
    - #5521 hint_es: (nincs) → "Es el *mejor* día de mi vida."
    - #5522 hint_es: (nincs) → "Fue el *peor* día de mi semana."
    - #5526 hint_es: (nincs) → "Es el cuarto *más pequeño* de la casa."
    - #5563 en: "break" → "break / rest"
    - #5564 en: "schedule" → "schedule / timetable"
    - #5718 hint_es: (nincs) → "Hoy está *más frío* que ayer."
    - #5729 hint_es: (nincs) → "Es el que *menos* come de todos."
    - #5819 en: "okay" → "okay / it is fine"
    - #5837 en: "job" → "job / work"
    - #5846 hint_es: (nincs) → "Quiero *decir* hola a todos."
    - #5896 en: "pharmacy" → "pharmacy / drugstore"
    - #8007 hint_es: (nincs) → "Hago tres *comidas* al día."
    - #8230 en: "trip" → "trip / journey"
  - Döntések (R11): azonos jelentés = összevonás (S6): a megtartott kártya `en` mezője ` / ` alakot kap, a másik id törlődik (a megtartott az alacsonyabb szintű / a korábbi). Névelős pár (`un perro` + `el perro`, a névelőt a kapu leveszi): a nyelvtani `articles` kártya marad ("a dog"), a szótémás duplikátum törölve (kivétel `amigo`: az A0 `el amigo` marad, az A1 `un amigo` törölve). Valódi többjelentés (S2): külön kártya + hint_es (decir say/tell, comida food/meal, mañana, café, sol, vino, departamento, desde, recuerdo, turismo, personal, humor, nuestro our/ours, eso es it/that, hay/no hay mondat+kérdés+egyes+többes, középfok/felsőfok párok, más alto/bajo 4-4 kártya). Pontatlan kérdés: `caliente`→`tibio` (warm), `el frío`→`el clima frío` (cold weather), `la cola`→`la fila` (line, mexikói norma). Zárójeles pár (`(plural)`, `(no persona)`) → puszta szó + hint_es.
  - Kód (a data miatt kellett): lib/grammar/tableDeck.ts `enWordIndex` és `wordCellsForEnglishLesson` a perjeles `en` fő alakját (az első) használja, különben a szó-pakli elvesztette volna a perjeles kártyákat és a kártya a teljes "a / b" szöveget kérte volna.
  - Kapu: validate-en-track R11-R14 = ok (0), id-blokk hiba 1132 → 1105, cross-level dup 11 → 8 (a kártyák száma 2804 → 2755); typecheck:ci, lint (0 hiba), test:ci (136 suite) zöld.
  - [?] marad, nem nyúltam hozzá: a `desde` (7816 "from") mondata `de`-t használ, nem `desde`-t (a kártya valószínűleg `de` lett volna); `la caja` új "box" kártya A1 `house`, id 10798 az A1 blokkon kívül van (+1 régi típusú id-blokk hiba, a törlések így is csökkentették a számot).
- 12:54 5. lépés, 2. adag (zárójeles párok, azonos jelentésű alakok, hiányzó jelentések): módosítva 118, hozzáadva 4, törölve 29 kártya; spanyol kérdés átírva 71.
  - Új kártya:
    - #10799 (A1 weather) la rosa → rose, hint_es "Le regalé una *rosa* a mi mamá."
    - #10800 (A1 prepositions) solo → only, hint_es "Tengo *solo* diez pesos."
    - #10801 (A2 travel) seguro → safe, hint_es "Esta zona es muy *segura*."
    - #10802 (A2 feelings) seguro → sure, hint_es "Estoy *seguro* de mi respuesta."
  - Törölt id (→ a megtartott id, ahová az alak átkerült; az `en` mezőben ` / ` alternatíva vagy a másik kártya azonos tartalmú):
    5801 hola (informal) → hi (→ 5800); 5811 gracias (formal) → thank you (→ 5812); 8533 rosa (nombre del color) → pink color (→ 5029); 8534 naranja (no la fruta) → orange color (→ 5027); 5479 nunca (perf) → never (→ 8771); 5537 la clase (lección) → lesson (→ 8137); 5567 la oficina (lugar) → office (→ 8049); 5632 esta noche (temprano) → this evening (→ 5443); 5766 el cliente (empresa) → client (→ 5465); 8831 el probador (uso EE.UU.) → fitting room (→ 5469); 8922 el compañero de trabajo (colega) → work colleague (→ 5557); 9023 la llegada (hora) → arrival time (→ 5435); 9024 la salida (hora) → departure time (→ 5609); 9125 el error (técnico) → error (→ 5742); 9161 la aplicación (formal) → application (→ 5573); 9259 más lejos (distancia física) → farther (→ 5717); 10048 el barco (grande) → ship (→ 8228); 10115 cerrar (de golpe) → to shut (→ 8101); 10167 mostrar (en pantalla) → to display (→ 8514); 10381 normal (común) → ordinary (→ 8855); 10467 recordar (traer a la memoria) → to recall (→ 9103); 10502 la tarea (trabajo asignado) → assignment (→ 5565); 10572 el examen (oficial) → examination (→ 5534); 10586 gritar (de miedo) → to scream (→ 10658); 10601 la cantidad (número de unidades) → quantity (→ 10072); 10608 la frase (expresión) → phrase (→ 9055); 10611 rápido (veloz) → rapid (→ 8761); 10749 impresionante (deslumbrante) → stunning (→ 10508); 10779 tonto (imprudente) → foolish (→ 10125).
  - Átírt spanyol kérdés:
    - #5804: "buenas noches (saludo)" → "buenas noches"
    - #5805: "buenas noches (despedida)" → "buenas noches"
    - #5827: "salud (brindis)" → "salud"
    - #5828: "salud (estornudo)" → "salud"
    - #5886: "la noche (atardecer)" → "la noche"
    - #5029: "rosa (color)" → "rosa"
    - #5093: "el sombrero (general)" → "el sombrero"
    - #5104: "había (plural)" → "había"
    - #5140: "el profesor (en general)" → "el profesor"
    - #5199: "hacer los deberes" → "hacer la tarea"
    - #5314: "dentro de (movimiento)" → "dentro de"
    - #5357: "cuántos años (edad)" → "cuántos años"
    - #5363: "el tiempo (clima)" → "el clima"
    - #7829: "cuántos años (duración)" → "cuántos años"
    - #8342: "el sombrero (para el sol)" → "el sombrero para el sol"
    - #8616: "tranquilo (lugar)" → "tranquilo"
    - #8708: "fresco (alimento)" → "fresco"
    - #8758: "tarde (időben)" → "tarde"
    - #5400: "trabajó (en general)" → "trabajó"
    - #5416: "bebió (en general)" → "bebió"
    - #5435: "la llegada (evento)" → "la llegada"
    - #5469: "el probador (general)" → "el probador"
    - #5482: "durante (tiempo)" → "durante"
    - #5490: "malo (salud)" → "malo"
    - #5507: "seguro (de sí)" → "seguro"
    - #5533: "los deberes (sust.)" → "la tarea"
    - #5544: "deber (obligación)" → "deber"
    - #5557: "el compañero de trabajo (general)" → "el compañero de trabajo"
    - #5565: "la tarea (laboral)" → "la tarea"
    - #5573: "la aplicación (coloquial)" → "la aplicación"
    - #5609: "la salida (evento)" → "la salida"
    - #5697: "solo (sentimiento)" → "solo"
    - #5717: "más lejos (figurado)" → "más lejos"
    - #5738: "el horario (escolar)" → "el horario escolar"
    - #5742: "el error (cotidiano)" → "el error"
    - #5785: "subir (archivo)" → "subir"
    - #8804: "trabajó (duro)" → "trabajó duro"
    - #8812: "bebió (té)" → "bebió té"
    - #9120: "claro (érthető)" → "claro"
    - #9137: "alto (ár)" → "alto"
    - #9138: "bajo (ár)" → "bajo"
    - #10017: "la política (reglas de una empresa)" → "la política"
    - #10063: "el equipo (aparatos)" → "el equipo"
    - #10068: "el consejo (municipal)" → "el consejo"
    - #10078: "la carrera (profesional)" → "la carrera"
    - #10086: "la estación (del año)" → "la estación"
    - #10092: "la carrera (competencia)" → "la carrera"
    - #10125: "tonto (poco inteligente)" → "tonto"
    - #10157: "seguro (protegido)" → "seguro"
    - #10184: "antiguo (que ya no es)" → "antiguo"
    - #10185: "la política (asuntos del gobierno)" → "la política"
    - #10303: "la bomba (explosivo)" → "la bomba"
    - #10323: "la confianza (en uno mismo)" → "la confianza"
    - #10361: "fuerte (sonido)" → "fuerte"
    - #10383: "la sombra (proyectada)" → "la sombra"
    - #10432: "anunciar (publicidad)" → "anunciar"
    - #10449: "deber (dinero)" → "deber"
    - #10476: "la bomba (de agua)" → "la bomba"
    - #10493: "el clima (a largo plazo)" → "el clima"
    - #10500: "fuerte (grave)" → "fuerte"
    - #10511: "arriba (en el piso de arriba)" → "arriba"
    - #10564: "arreglar (organizar)" → "arreglar"
    - #10583: "anunciar (dar a conocer)" → "anunciar"
    - #10616: "calcular (estimar)" → "calcular"
    - #10624: "antiguo (de época)" → "antiguo"
    - #10658: "gritar (fuerte)" → "gritar"
    - #10681: "el collar (de mascota)" → "el collar"
    - #10694: "abajo (en el piso de abajo)" → "abajo"
    - #10745: "la emoción (entusiasmo)" → "la emoción"
    - #10765: "la emoción (sentimiento)" → "la emoción"
    - #10773: "helado (muy frío)" → "helado"
  - Minta, 20 véletlen módosítás (előtte → utána):
    - #5093 es: "el sombrero (general)" → "el sombrero"
    - #5416 es: "bebió (en general)" → "bebió"
    - #5465 en: "customer" → "customer / client"
    - #5507 es: "seguro (de sí)" → "seguro"; hint_es: (nincs) → "Ella es muy *segura* de sí misma."
    - #5533 es: "los deberes (sust.)" → "la tarea"; hint_es: (nincs) → "Hago mi *tarea* después de la escuela."
    - #5534 en: "exam" → "exam / examination"
    - #5609 en: "departure" → "departure / departure time"; es: "la salida (evento)" → "la salida"; hint_es: (nincs) → "La *salida* del tren es a las nueve."
    - #5738 es: "el horario (escolar)" → "el horario escolar"
    - #5742 en: "mistake" → "mistake / error"; es: "el error (cotidiano)" → "el error"
    - #5771 hint_es: (nincs) → "Mi *equipo* juega el sábado."
    - #5805 es: "buenas noches (despedida)" → "buenas noches"; hint_es: (nincs) → "Me voy a dormir, *buenas noches*."
    - #5812 en: "thanks" → "thank you / thanks"
    - #5828 es: "salud (estornudo)" → "salud"; hint_es: (nincs) → "Estornudo y mi amigo dice *salud*."
    - #5887 hint_es: (nincs) → "Por la *noche* duermo ocho horas."
    - #5892 hint_es: (nincs) → "El tren llega a la *estación*."
    - #8228 en: "boat" → "boat / ship"
    - #8812 es: "bebió (té)" → "bebió té"
    - #9126 hint_es: (nincs) → "Voy a *arreglar* mi bicicleta."
    - #10072 en: "amount" → "amount / quantity"
    - #10361 es: "fuerte (sonido)" → "fuerte"; hint_es: (nincs) → "La música está muy *fuerte*."
  - Döntések (zárójeles párok): a zárójeles pontosítás, amelynek van testvérkártyája és más válaszszót választ el, puszta szó + hint_es lett (buenas noches, salud, la noche, la tarde, el clima, la estación, la salida, rosa, el profesor, dentro de, cuántos años, claro, arriba, abajo, helado, alto, bajo, fuerte, la sombra, fresco, malo, tranquilo, solo, durante, subir, el equipo, la confianza, el consejo, la carrera, arreglar, la política, antiguo, la bomba, anunciar, el collar, calcular, la emoción, seguro, deber, la tarea, había). Ahol a két alak azonos jelentésű (hola/hi, gracias, cerrar, mostrar, clase, barco, rápido, esta noche, cliente, probador, examen, compañero de trabajo, tarea task/assignment, aplicación, más lejos, error, normal, frase, recordar, cantidad, tonto, impresionante, gritar, llegada/salida hora), összevonás (S6). Magyar zárójeles szöveg volt a spanyol kérdésben: `tarde (időben)`, `claro (érthető)`, `alto (ár)`, `bajo (ár)`, ezek is puszta szó + hint lettek. S4: `hacer los deberes` → `hacer la tarea`, `los deberes (sust.)` → `la tarea`, `el tiempo (clima)` → `el clima` (mexikói norma). Pontatlan kérdés zárójel nélkül: `trabajó (duro)` → `trabajó duro`, `bebió (té)` → `bebió té`, `el sombrero (para el sol)` → `el sombrero para el sol`, `el horario (escolar)` → `el horario escolar`.
  - Hiányzó jelentés pótolva (S2+S7, mindkét/mindhárom kártya hint_es-sel): rose (rosa), only (solo), safe és sure (seguro).
  - Kapu: validate-en-track R11-R14 = ok (0), id-blokk hiba 1105 → 1100, cross-level dup 8 → 5 (kártyák: 2755 → 2730); typecheck:ci, lint (0 hiba), test:ci (136 suite) zöld.
  - [?] marad, nem nyúltam hozzá (a zárójel pontosabb, mint egy mondat, vagy nyelvtani alakot jelöl): `necesitar (+inf)`, `los niños (en general)` / `(concretos)` és `el profesor (concreto)` (névelő-lecke), `su (de él/ella/ellos/eso)`, `suyo (de ella/ellos)`, `vas a / va a / vamos a (+inf)` és a `¿…?` párjaik, `no hay (contracción)`, `no hace falta (contracción)`, `no puede (contracción)`, `no debes (contracción)`. A "contracción" kártyák (there isn't, can't...) külön kártyák maradtak; a "there is not / there isn't" típusú összevonás általános megoldása a bíráló lenne (összehúzott alak elfogadása), nem kártyánként.
- 12:58 5. lépés, 3. adag (átnézés 1-700. sor): módosítva 31, hozzáadva 6, törölve 0 kártya; spanyol kérdés átírva 5.
  - Új kártya:
    - #10803 (A2 travel) la banca → bench
    - #10804 (A1 prepositions) sobre → about, hint_es "Es un libro *sobre* animales."
    - #10805 (A1 present_simple) llevar → to take / to carry, hint_es "Voy a *llevar* a mi hijo al doctor."
    - #10806 (A1 present_simple) tomar → to drink, hint_es "Quiero *tomar* un vaso de agua."
    - #10807 (B1 actions) tocar → to touch, hint_es "Puedes *tocar* la pantalla con el dedo."
    - #10808 (B1 actions) tocar → to play (an instrument), hint_es "Mi hermano sabe *tocar* la guitarra."
  - Törölt id: nincs.
  - Átírt spanyol kérdés:
    - #5148: "el camarero" → "el mesero"
    - #5181: "la hierba" → "el pasto"
    - #7641: "el salón" → "la sala"
    - #8729: "la mesa del salón" → "la mesa de la sala"
    - #10376: "tocar (a la puerta)" → "tocar"
  - Minta, 20 véletlen módosítás (előtte → utána):
    - #5030 en: "gray" → "gray / grey"
    - #5089 en: "pants" → "pants / trousers"
    - #5116 hint_es: (nincs) → "El libro está *sobre* la mesa."
    - #5144 en: "cook" → "cook / chef"
    - #5147 en: "police officer" → "police officer / policeman"
    - #5148 es: "el camarero" → "el mesero"
    - #5181 es: "la hierba" → "el pasto"
    - #5382 en: "watch tv" → "watch tv / watch television"
    - #5818 en: "pardon" → "pardon / sorry"
    - #5829 en: "no worries" → "no worries / don't worry"
    - #5852 en: "big" → "big / large"
    - #5853 en: "small" → "small / little"
    - #5873 en: "near" → "near / close"
    - #5894 en: "store" → "store / shop"
    - #7641 es: "el salón" → "la sala"
    - #7722 en: "midday" → "midday / noon"
    - #7742 en: "fall" → "fall / autumn"
    - #7761 en: "child" → "child / kid"
    - #8763 hint_es: (nincs) → "Ella *lleva* un vestido rojo."
    - #10376 es: "tocar (a la puerta)" → "tocar"; hint_es: (nincs) → "Alguien *toca* a la puerta."
  - Átnézés: az 1. sortól a ~700. sorig (A0 + az A1 eleje). Mit kerestem: S1 szinonima (big/large, small/little, near/close, store/shop, pants/trousers, gray/grey, bathroom/restroom, at home, cook/chef, police officer/policeman, kid, bicycle, autumn, noon, eat/have breakfast-lunch-dinner, take a shower, watch television, sorry/pardon, don't worry, plate/dish, goldfish/fish), S4 mexikói norma a kérdésben (a mondat már mexikói volt: `el salón` → `la sala`, `la mesa del salón` → `la mesa de la sala`, `el camarero` → `el mesero`, `la hierba` → `el pasto`), hiányzó jelentés (sobre on/about, llevar wear/take-carry, tomar take/drink, tocar touch/play/knock, banca bench: a `la banca` mexikói szó, ezért nincs kettős kérdés és hint sem).
  - Kapu: validate-en-track R11-R14 = ok (0), id-blokk hiba 1100 → 1104 (a 4 új A1/A2 kártya miatt, a 1132 alap alatt), cross-level dup 5 → 4 (kártyák: 2730 → 2736); typecheck:ci, lint (0 hiba), test:ci (136 suite) zöld.
  - [?] marad, nem nyúltam hozzá: `la ducha` (mexikói: la regadera), `el marido` (mexikói: el esposo), `el dormitorio` (mexikói: la recámara), `el bolso pequeño`; a `7640 el cuarto de baño → bathroom` az A0 `el baño → bathroom` angol duplikátuma (más kérdés, ezért nem R11); az összehúzott alakok (I'm, there isn't) elfogadása a bírálóban volna általános megoldás.
- 13:03 5. lépés, 4. adag (átnézés ~701-1400. sor): módosítva 50, hozzáadva 5, törölve 1 kártya; spanyol kérdés átírva 9.
  - Új kártya:
    - #10809 (A1 present_simple) hacer → to do, hint_es "Voy a *hacer* la tarea."
    - #10810 (A2 feelings) querer → to love (someone), hint_es "Te *quiero* mucho, mamá."
    - #10811 (A2 feelings) esperar → to hope, hint_es "*Espero* que estés bien."
    - #10812 (A2 feelings) aburrido → boring, hint_es "La película es muy *aburrida*."
    - #10813 (A2 past_simple_irregular) fue → was, hint_es "*Fue* un buen día."
  - Törölt id (→ a megtartott id, ahová az alak átkerült; az `en` mezőben ` / ` alternatíva vagy a másik kártya azonos tartalmú):
    8925 el horario de trabajo → work schedule.
  - Átírt spanyol kérdés:
    - #8235: "el mediodía de trabajo" → "el horario de trabajo"
    - #8349: "el tiempo bueno" → "el buen tiempo"
    - #8350: "el tiempo malo" → "el mal tiempo"
    - #8353: "el camarero joven" → "el mesero joven"
    - #5412: "fue (ir)" → "fue"
    - #5535: "la nota" → "la calificación"
    - #5543: "el estudiante universitario" → "el préstamo estudiantil"
    - #5595: "corría" → "corrió"
    - #5618: "el visado" → "la visa"
  - Minta, 20 véletlen módosítás (előtte → utána):
    - #5499 hint_es: (nincs) → "Estoy *aburrido* en la clase."
    - #5618 es: "el visado" → "la visa"
    - #5619 en: "currency" → "currency / coin"
    - #5844 hint_es: (nincs) → "*Quiero* un café, por favor."
    - #7958 en: "country (rural)" → "countryside / country"
    - #8036 en: "trash" → "trash / garbage"
    - #8105 en: "to speak" → "to speak / to talk"
    - #8115 hint_es: (nincs) → "Voy a *esperar* el camión aquí."
    - #8117 en: "to leave" → "to leave / to go out"
    - #8204 en: "movie theater" → "movie theater / cinema"
    - #8206 en: "square" → "square / plaza"
    - #8215 en: "stone" → "stone / rock"
    - #8231 en: "pleased" → "pleased / glad / happy"
    - #8232 en: "kind" → "kind / nice"
    - #8235 es: "el mediodía de trabajo" → "el horario de trabajo"; en: "working hours" → "working hours / work schedule"
    - #8244 en: "nobody" → "nobody / no one"
    - #8246 en: "somebody" → "somebody / someone"
    - #8353 es: "el camarero joven" → "el mesero joven"
    - #8520 en: "movie" → "movie / film"
    - #8641 en: "at half past seven" → "at half past seven / at seven thirty"
  - Átnézés: a ~701. sortól az ~1400. sorig (A1 közepe-vége, az A2 eleje a `travel` témáig). S1 alakok: countryside, trash/garbage, pay/salary, speak/talk, leave/go out, return/come back, how much does it cost, he is sick, cinema, plaza, rock, beautiful, metro, glad/happy, nice, no one, someone, lime (mexikói `limón`), straight ahead, look at/watch, show (`enseñar`), reply, film, gift, picture, coffee with milk, town, too, at seven thirty, baggage, holiday, mad, afraid, prohibited, cell phone/mobile phone, booking, coin. Hibás kérdés/válasz-pár javítva: `5543` (kérdés és mondat a diákhitelről szólt, a hu "hallgató" volt: kérdés `el préstamo estudiantil`, hu `diákhitel`), `5595` (`corría` → `corrió`, a mondat "Corrí"), `8235` (`el mediodía de trabajo` → `el horario de trabajo`, azonos az A2 `8925`-tel, összevonva: "working hours / work schedule"), `el visado` → `la visa`, `la nota` → `la calificación` (a mondat már így volt), `el camarero joven` → `el mesero joven`, `el tiempo bueno/malo` → `el buen/mal tiempo`. Hiányzó jelentés (új kártya, mindkét kártya hint_es-sel): hacer make/do, querer want/love, esperar wait/hope, aburrido bored/boring, fue went/was.
  - Kapu: validate-en-track R11-R14 = ok (0), id-blokk hiba 1104 → 1108 (5 új A1/A2 kártya, 1 törölt), cross-level dup 4 → 3 (kártyák: 2736 → 2740); typecheck:ci, lint (0 hiba), test:ci (136 suite) zöld. A corpusIntegrity prompt-policy teszt a hu-promptra is figyel: az új `hacer → to do` kártya hu-ja ezért `elvégez` (a `csinál` az A1 `make` kártyáé).
  - [?] marad: `conocer` (9207 "to know (a place)", a "to meet" jelentés hiányzik, a zárójeles en miatt nem összevontam); `la caja`/`el reloj` más jelentése (faucet, clock) összetett kérdésekkel már megvan (`el agua de la llave`, `el reloj de pared`).
- 13:06 5. lépés, 5. adag (átnézés ~1401-2100. sor): módosítva 44, hozzáadva 5, törölve 1 kártya; spanyol kérdés átírva 11.
  - Új kártya:
    - #10814 (A2 shopping) la receta → recipe, hint_es "Busco una *receta* de pastel."
    - #10815 (A2 feelings) el sueño → dream, hint_es "Anoche tuve un *sueño* muy raro."
    - #10816 (A2 shopping) el peso → peso, hint_es "Un café cuesta treinta *pesos*."
    - #10817 (A2 education) la historia → story, hint_es "Mi abuelo cuenta una *historia* divertida."
    - #10818 (A2 office_work) buscar → to look for, hint_es "Voy a *buscar* mis llaves."
  - Törölt id (→ a megtartott id, ahová az alak átkerült; az `en` mezőben ` / ` alternatíva vagy a másik kártya azonos tartalmú):
    8839 la lista de la compra → shopping note (→ 5662).
  - Átírt spanyol kérdés:
    - #8824: "el alquiler de carros" → "la renta de carros"
    - #8830: "el escaparate de la tienda" → "el aparador de la tienda"
    - #8862: "la nota alta" → "la calificación alta"
    - #8910: "el altavoz dla computadora" → "la bocina de la computadora"
    - #9003: "echar de menos" → "extrañar"
    - #9061: "suspender" → "reprobar"
    - #9064: "la nota final" → "la calificación final"
    - #9115: "el ascensor" → "el elevador"
    - #9166: "el vídeo corto" → "el video corto"
    - #9308: "el ratón dla computadora" → "el ratón de la computadora"
    - #10000: "buscar (revisar un lugar)" → "buscar"
  - Minta, 20 véletlen módosítás (előtte → utána):
    - #5648 en: "eventually" → "finally / eventually"
    - #5651 en: "exchange" → "exchange / change"
    - #5660 en: "order" → "order / ask for"
    - #5690 hint_es: (nincs) → "Necesito una *receta* del médico."
    - #8830 es: "el escaparate de la tienda" → "el aparador de la tienda"; sentence_es: "Vi una chamarra bonita en el escaparate." → "Vi una chamarra bonita en el aparador."
    - #8845 hint_es: (nincs) → "Mi *peso* es de setenta kilos."
    - #8910 es: "el altavoz dla computadora" → "la bocina de la computadora"
    - #9003 es: "echar de menos" → "extrañar"
    - #9010 en: "habit" → "habit / custom"
    - #9061 es: "suspender" → "reprobar"
    - #9062 en: "to revise" → "to revise / to review"
    - #9064 es: "la nota final" → "la calificación final"
    - #9222 en: "takeaway food" → "takeaway food / takeout food"
    - #9225 en: "mall" → "mall / shopping mall"
    - #9319 hint_es: (nincs) → "Me gusta la *historia* de México."
    - #10010 en: "security" → "security / safety"
    - #10055 en: "huge" → "huge / enormous"
    - #10062 en: "engine" → "engine / motor"
    - #10099 en: "male" → "male / masculine"
    - #10109 en: "district" → "district / neighborhood"
  - Átnézés: az ~1401. sortól a ~2100. sorig (A2 `going_to`-tól a B1 `10141`-ig). S1 alakok: finally, change, ask for, shopping cart, carry-on, round trip, car rental, raise, custom, same, zone, review, takeout, shopping mall, everyone, permit, hallway, safety, capable, choose, enormous, application, motor, additional, defeat, masculine, take care of, incredible, neighborhood (mexikói `colonia`), answer. S4 / elírás: `la renta de carros` (a mondat már így volt), `el aparador` (mondat is), `la bocina`, `el ratón de la computadora` és `la bocina de la computadora` (a "dla" elírás javítva), `extrañar` (nem `echar de menos`), `reprobar` (nem `suspender`), `la calificación alta/final`, `el elevador`, `el video`. Duplikátum törölve: `8839 la lista de la compra` (Spanyol szó, hibás "shopping note", azonos a `5662`-vel). Hiányzó jelentés (új kártya, mindkét kártya hint_es-sel): receta recipe, sueño dream, peso (pénznem), historia story, buscar look for (a `10000` zárójeles kérdése puszta szó lett).
  - Kapu: validate-en-track R11-R14 = ok (0), id-blokk hiba 1108 → 1112 (5 új A2 kártya, 1 törölt), cross-level dup 3 → 3 (kártyák: 2740 → 2744); typecheck:ci, lint (0 hiba), test:ci (136 suite) zöld.
  - [?] marad: `el cajero` (cashier mellett ATM), `quedar` (csak "to fit" van), `el paquete` (parcel); a B1 vége (10142-től) a 6. adagban.
