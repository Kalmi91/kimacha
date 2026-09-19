# PLAN-eget-nyelvtan, nyelvtani tartalom égető menet

Indult: 2026-09-18. Ág: `nyelvtan`, worktree: `/home/kalmi/ai/kimacha-wt-eget-nyelvtan`.
Állás induláskor (probe): 65 téma: 18 V2, 12 V1, 35 hiányzik; NY nyitott: NY6, NY7.
Becslés: 1 lecke ≈ 150-300K Sonnet-token (50 transform-os a felső sáv); ez a menet arg
nélkül megy, amíg a queue vagy a limit tart, ≈ 8-12 lecke / 5 órás blokk, 2-3 M token.
Döntés (alapértelmezés, Kálmán nincs a gépnél): NY6 a NY10 szerinti 50 transform-mal megy,
nem a NY6 régi szövegében álló 12-vel (Kálmán FB316: „50 különböző mondat"); a
`futuro-simple` V1→V2 átírása (C-sor) a NY6-tal EGY lépésben készül, hogy a fájl egyszer
mozogjon.

Státusz-jelek: `[ ]` nyitott, `[~]` fut, `[x]` kész, `[!]` elakadt.

- [x] 1. NY6a `ir-a-infinitivo`: 50 transform (presente → ir-a) + `tense` minden itemen → KÉSZ 2026-09-18, commit 598fb96, audit 0/0, jest 1110/1110, tsc 0, lint 0 error; 76 item (12 choice, 1 match, 6 form, 7 why, 50 transform)
  minta: «Como aquí.» → «Voy a comer aquí.» | «No comes nada.» → «No vas a comer nada.» | «Van juntos.» → «Van a ir juntos.» | «Trabaja lento.» → «Va a trabajar lento.» | «¿Leen fuera?» → «¿Van a leer fuera?»; salir helyett leer (salir A1-en csak fix-frázis)
- [x] 2. NY6b `futuro-simple`: V1→V2 + 50 transform (presente → futuro-simple) + `tense` → KÉSZ 2026-09-19, commit 8c65f2e, audit 0/0, jest 1120/1120, tsc 0, lint 0 error; 82 item (12 choice, 1 match, 12 form, 7 why, 50 transform)
  minta: «Hablo con mi jefe.» → «Hablaré con mi jefe.» | «No tenemos dinero.» → «No tendremos dinero.» | «Puedes venir a la fiesta.» → «Podrás venir a la fiesta.» | «¿Hacen la comida?» → «¿Harán la comida?» | «¿Dicen la verdad?» → «¿Dirán la verdad?»
- [x] 3. NY7 `tense` jelvény 6 leckén (indefinido-regular, indefinido-irregular, imperfecto, indefinido-imperfecto, perfecto, condicional-simple) → KÉSZ 2026-09-19, commit 9915471, audit 0/0, jest 1120/1120, tsc 0; 5×32 + 12 item kapott tense-t, indefinido-imperfecto = imperfecto→indefinido kontraszt-pár
- [ ] 4. `numeros-hora-fecha` (A1 core) új lecke → kész, ha: audit 0/0 + jest + tsc + lint zöld, commit <hash>
- [ ] 5. `preposiciones-basicas` (A1 core) új lecke → kész, ha: ugyanaz
- [ ] 6. `comparativos-superlativos` (A2 core) új lecke → kész, ha: ugyanaz
- [ ] 7. `imperativo-afirmativo` (A2 core) új lecke → kész, ha: ugyanaz
- [ ] 8. `condicionales-tipo1` (B1 core) új lecke → kész, ha: ugyanaz
- [ ] 9. `condicionales-tipo2-3` (B2 core) új lecke → kész, ha: ugyanaz
- [ ] 10. `estilo-indirecto` (B2 core) új lecke → kész, ha: ugyanaz
- …és a probe szerinti folytatás: finales-causales, marcadores-discursivos, subjuntivo ×4 (B2-sor), C-sor 11 V1 átírás, D exam 17, E full 5.

Adag = 3 lecke; adag után push a `nyelvtan` ágra, első adag után PR.

---

## BRIEF ir-a-infinitivo (1. lépés, NY6a)

Worktree gyökér: `/home/kalmi/ai/kimacha-wt-eget-nyelvtan`. Minden `node` / `npx` innen fut.
Ág: `nyelvtan` (már ki van checkolva, ne válts ágat).

### Olvasd el ELŐBB (ebben a sorrendben, csak a releváns szeletet)
1. `/home/kalmi/ai/ai-workspace/kimacha/NYELVTAN.md` NY1-NY4 + NY6 + NY10 szakasz (transform item adatformátum 1:1, `wordIds` szabály, ÉSZAK-CSILLAG).
2. `/home/kalmi/ai/ai-workspace/kimacha/LECKE-SEMA.md` §3 (speak) és a `wrong` mező stílusa.
3. `lib/grammar/lessonTypes.ts`: a `TransformItem` típus, a `tense` mező (`{ from: TenseId; to: TenseId }`), `TENSE_IDS`.
4. `scripts/audit-games.mjs` fejléc-kommentje (P1/P2 szabályok) + `auditTenseField` (576. sor körül).
5. Minta: `data/games/grammar/es/indefinido-10-verbos.json` (50 transform item, ez a formátum-minta: `prompt`, `answer`, `accept`, `wordIds`, `tense`). Csak az első 5-6 itemet olvasd, nem az egészet.
6. A célfájl: `data/games/grammar/es/ir-a-infinitivo.json` (schema 2, A1, 26 item: 12 choice, 1 match, 6 form, 7 why; `body`, `speak`, `glossary` megvan).

### Feladat
A. **`tense` minden meglévő itemre** (choice, match, form, why): `"tense": { "from": "presente", "to": "ir-a" }`. Ha a `match` itemen az audit nem engedi, ott hagyd ki, és írd a jelentésbe.
B. **50 új `transform` item** az `items` tömb végére. Irány: presente → ir-a + infinitivo.
   - `prompt.es` = presente mondat, `answer` = ugyanaz a mondat ir-a alakban; csak az ige változik, a mondat többi része (tárgy, hely, időhatározó) változatlan. Példa: «Como en casa.» → «Voy a comer en casa.» Ha a prompt időhatározója a jövőt zárná ki (hoy, ahora), ne használd; «mañana», «esta noche», «el domingo» mindkét alakban jó.
   - `prompt.es ≠ answer` minden itemen.
   - Vegyes személyek (yo/tú/él-ella/nosotros/vosotros/ellos), vegyes mondatfajta: kb. 30 kijelentő, 10 tagadó («No como…» → «No voy a comer…»), 10 kérdő («¿Comes…?» → «¿Vas a comer…?»).
   - 10 ige × 5 mondat. Az igék: a lecke `form`/`table` igéiből + gyakori A0-A1 igék, amiknek VAN kártyája (comer, ir, hacer, ver, estudiar, trabajar, comprar, hablar, vivir, salir, ha kártyás; ellenőrizd). Ha valamelyik nem kártyás, cseréld kártyásra.
   - `accept`: a kitett-névmásos / névmás-nélküli változat («Yo voy a comer en casa.» ha az answer névmás nélküli, és fordítva). Írásjel/ékezet változat NEM kell, azt a matcher kezeli.
   - `tense`: `{ "from": "presente", "to": "ir-a" }` minden transform itemen.
   - `wordIds`: a mondat MINDEN tartalmas szava (ige, főnév, melléknév, határozó) kártya-id STRINGKÉNT; funkciószó (a, en, no, el, la, mi) csak ha van kártyája. Ragozott alakkal egyező kártya, ha van; különben a szótári alak (infinitivo) kártyája. **Csak A0 + A1** kártya (a lecke `level` A1).
   - Megengedett kártyák: futtasd `node ~/ai/.claude/skills/eget-nyelvtan/probe.cjs --cards A1 /tmp/claude-1000/cards-A1.tsv`, formátum `id<TAB>es<TAB>szint`. Ebből választasz, és **írás előtt node-dal ellenőrzöd** (egy kis script: minden transform item minden wordId-je benne van-e a tsv-ben, és a mondat minden tartalmas szava le van-e fedve). Nem fejből.
   - Mondat-szabályok: legfeljebb 12 szó; természetes, ahogy egy anyanyelvű mondja, nem szabály-illusztráció; **ismétlés-plafon**: egy tartalmas szó (az igén kívül) legfeljebb 3-szor az 50 itemben, egy mondatszerkezet legfeljebb 2-szer; csak spanyol forrásmondat (K1: nincs angol/magyar prompt).
   - Ha egy kulcsszónak nincs kártyája: másik szót választasz. Ha a téma enélkül nem tanítható: a jelentésbe „kártya-kérés: <szó> A1".
C. **`speak`, `body` nem változik**, kivéve ha a `body`-ban nincs egy mondat arról, hogy az ir-a a jövő beszélt alakja, akkor sem: hagyd, ez a NY6 nem body-átírás.
D. Ha valami tesztet fix darabszám fixál (`grep -rn "ir-a-infinitivo" lib __tests__ scripts` mutatja), frissítsd a számot, semmi mást.

### Kapu (sorban, mind a worktree gyökeréből)
```
node scripts/audit-games.mjs 2>&1 | tail -15     # 0 P1, cél 0 P2
npx jest 2>&1 | tail -8                           # zöld
npx tsc --noEmit 2>&1 | tail -3                   # 0 hiba
npx expo lint 2>&1 | tail -5                      # 0 error
```
Piros → javítasz és újra, legfeljebb 3-szor, aztán piros állapottal jelentesz (NEM commitolsz pirosat).

### Commit (csak zöld kapuval)
`git add data/games/grammar/es/ir-a-infinitivo.json` (+ a teszt, ha nyúltál hozzá), majd:
```
feat(grammar): NY6 ir-a-infinitivo 50 transform + tense (nyelvtan)

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```
Nem pusholsz.

### Jelentés (max 10 sor)
- fájl + item-számok fajtánként (choice/match/form/why/transform)
- a 4 kapu utolsó sora
- commit hash
- 5 minta `prompt.es → answer`
- kártya-kérés sorok, ha voltak; elakadás egy mondatban, ha volt
Nincs diff, nincs fájltartalom, nincs narratíva.

---

## BRIEF futuro-simple (2. lépés, NY6b + C-sor V1→V2)

Worktree gyökér: `/home/kalmi/ai/kimacha-wt-eget-nyelvtan`. Minden `node` / `npx` innen fut.
Ág: `nyelvtan` (már ki van checkolva, ne válts ágat).

### Olvasd el ELŐBB (ebben a sorrendben, csak a releváns szeletet)
1. `/home/kalmi/ai/ai-workspace/kimacha/NYELVTAN.md` NY1-NY4 + NY6 + NY10 szakasz (transform item adatformátum 1:1, `wordIds` szabály, ÉSZAK-CSILLAG).
2. `/home/kalmi/ai/ai-workspace/kimacha/LECKE-SEMA.md` teljes (a lecke törzse: blokkok, `form`/`match`/`why` feladat-fajták, a választós `wrong` mező stílusa „miért ez az alak, és mi lenne, ha a másik", `speak` a spanyol szakaszokkal «...» közt, §7 V1→V2 átírás).
3. `lib/grammar/lessonTypes.ts` teljes (a V2 séma: `body` blokkok, `Lang4`, `ExamplePair`, item-fajták, `TransformItem`, `tense`, `TENSE_IDS`).
4. `scripts/audit-games.mjs` fejléc-kommentje (P1/P2 szabályok) + `auditTenseField` (576. sor körül).
5. Minta V2 lecke: `data/games/grammar/es/ser-estar.json` (LECKE-SEMA pilot: body, speak, 12 választós + 1 match + 12 form + 7 why). Ezt teljesen olvasd, ez a formátum-minta.
6. Minta transform: `data/games/grammar/es/ir-a-infinitivo.json` utolsó 6 iteme (az 1. lépésben készült 50 transform, `prompt`, `answer`, `accept`, `wordIds`, `tense`).
7. A célfájl: `data/games/grammar/es/futuro-simple.json` (V1: `topic`, `level` A2, `title`, `rule`, `more`, `glossary`, 12 választós item). Teljesen olvasd, minden szövege átmegy a V2-be.

### Feladat: V1 → V2 átírás + 50 transform + tense, egy fájlban
A. **Séma:** `schema: 2`, a `topic` id (`futuro-simple`) NEM változik (a `game_progress` kulcsa), `level` és `title` a `lib/grammar/syllabus.ts` szerint (grep `futuro-simple` ott).
B. **`body`:** a V1 `rule` + `more` szövege blokkokba megy, semmi nem vész el: `text` (1 bekezdés, mire jó a futuro simple: jövő, ígéret, jóslat, valószínűség a jelenben «Serán las tres»), `list` vagy `usage` a szabálypontok mind példával (`ExamplePair`: `es` + `tr` ×4), `table` id-val (a szabályos ragozás: infinitivo + -é/-ás/-á/-emos/-éis/-án, plusz a rendhagyó tövek: tendr-, podr-, sabr-, habr-, har-, dir-, pondr-, saldr-, vendr-, querr-; a `form` itemek erre hivatkoznak), `contrast` (futuro simple vs ir-a: tervezett/közeli vs távolabbi/jóslat, ha a V1 szövege ezt említi, ha nem, egy rövid kontraszt akkor is jó), `tip` (1). Minden `Lang4` mind a 4 nyelven (hu/en/es/de), üres string tilos (P1).
C. **`speak` ×4**, a spanyol szakaszok «...» közt (LECKE-SEMA §3).
D. **`glossary`:** a V1 glossary marad, csak akkor bővül, ha egy tartalmas szó A2-ig nincs tanítva és nem cserélhető. Transform itemben glossza NEM helyettesíti a `wordIds`-t.
E. **Itemek:**
   - a meglévő **12 választós** marad (a `sentence` és `correct` változatlan; a `wrong` minden rossz opción átírva a LECKE-SEMA stílusra, ×4 nyelven),
   - **1 `match`** (5-6 pár: személy → alak, vagy infinitivo → rendhagyó tő),
   - **12 `form`** a `table` id-ra (vegyes: szabályos és rendhagyó igék, vegyes személyek),
   - **6-8 `why`** (3 szabály-név, a rossz opciókon `wrong` ×4),
   - **50 `transform`**: irány presente → futuro simple. `prompt.es` = presente mondat, `answer` = ugyanaz futuro simple-ben; csak az ige változik, a mondat többi része változatlan; a prompt időhatározója ne zárja ki a jövőt (hoy/ahora tilos; mañana, la semana que viene, el año que viene, esta noche mindkét alakban jó). `prompt.es ≠ answer`. Vegyes személyek (yo/tú/él-ella/nosotros/vosotros/ellos), kb. 30 kijelentő, 10 tagadó, 10 kérdő. 10 ige × 5 mondat: 6 szabályos + 4 rendhagyó (tener, poder, hacer, salir vagy venir, decir, ha kártyás), mind kártyával. `accept`: a kitett-névmásos / névmás-nélküli változat. 
   - **`tense`** minden itemen (choice, match, form, why, transform): `{ "from": "presente", "to": "futuro-simple" }`. Ha a `match` itemen az audit nem engedi, ott hagyd ki, és írd a jelentésbe.
F. **`wordIds`** (transform itemeken kötelező): a mondat MINDEN tartalmas szava (ige, főnév, melléknév, határozó) kártya-id STRINGKÉNT; funkciószó csak ha van kártyája. Ragozott alakkal egyező kártya, ha van; különben a szótári alak kártyája. **Csak A0 + A1 + A2** kártya (a lecke `level` A2). Megengedett kártyák: `node ~/ai/.claude/skills/eget-nyelvtan/probe.cjs --cards A2 /tmp/claude-1000/cards-A2.tsv`, formátum `id<TAB>es<TAB>szint`. Ebből választasz, és **írás előtt node-dal ellenőrzöd** (minden transform item minden wordId-je benne van-e a tsv-ben, és a mondat minden tartalmas szava le van-e fedve). Nem fejből.
G. **Mondat-szabályok:** legfeljebb 12 szó; természetes, ahogy egy anyanyelvű mondja, nem szabály-illusztráció; **ismétlés-plafon**: egy tartalmas szó (az igén kívül) legfeljebb 3-szor az 50 transform itemben, egy mondatszerkezet legfeljebb 2-szer; csak spanyol forrásmondat (K1). Ha egy kulcsszónak nincs kártyája: másik szót választasz; ha a téma enélkül nem tanítható: a jelentésbe „kártya-kérés: <szó> A2".
H. Regisztráció: a `lib/games/content/es.ts` már importálja (60. sor körül), nem kell új sor. Ha valamelyik teszt fix darabszámot állít (`grep -rn "futuro-simple\|schema: 2\|V1\|v1Count\|written" lib __tests__ scripts` mutatja, pl. `grammarSyllabus.test.ts` V1/V2 számláló), frissítsd a számot, semmi mást.

### Kapu (sorban, mind a worktree gyökeréből)
```
node scripts/audit-games.mjs 2>&1 | tail -15     # 0 P1, cél 0 P2
npx jest 2>&1 | tail -8                           # zöld
npx tsc --noEmit 2>&1 | tail -3                   # 0 hiba
npx expo lint 2>&1 | tail -5                      # 0 error
```
Piros → javítasz és újra, legfeljebb 3-szor, aztán piros állapottal jelentesz (NEM commitolsz pirosat).

### Commit (csak zöld kapuval)
`git add data/games/grammar/es/futuro-simple.json` (+ a teszt, ha nyúltál hozzá), majd:
```
refactor(grammar): NY6 futuro-simple V2 séma + 50 transform + tense (nyelvtan)

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```
Nem pusholsz.

### Jelentés (max 10 sor)
- fájl + item-számok fajtánként (choice/match/form/why/transform)
- a 4 kapu utolsó sora
- commit hash
- 5 minta `prompt.es → answer`
- kártya-kérés sorok, ha voltak; elakadás egy mondatban, ha volt
Nincs diff, nincs fájltartalom, nincs narratíva.

---

## BRIEF NY7 tense-jelvény 6 leckén (3. lépés)

Worktree gyökér: `/home/kalmi/ai/kimacha-wt-eget-nyelvtan`. Minden `node` / `npx` innen fut.
Ág: `nyelvtan` (már ki van checkolva, ne válts ágat).

### Olvasd el ELŐBB
1. `/home/kalmi/ai/ai-workspace/kimacha/NYELVTAN.md` NY7 szakasz (268. sor körül).
2. `lib/grammar/lessonTypes.ts`: a `tense` mező (`{ from: TenseId; to: TenseId }`) és a `TENSE_IDS` lista (30. sor körül).
3. `scripts/audit-games.mjs` `auditTenseField` (576. sor körül) + a 655. sor körüli komment (a `tense` choice/form/why itemen is megjelenhet).
4. Minta: `data/games/grammar/es/ir-a-infinitivo.json` első 3 iteme (az 1. lépésben kapott `tense` mezőt).

### Feladat: `tense` mező a meglévő itemekre, 6 fájlban, semmi más nem változik
Tartalom-szerkesztés, nem kód. Fájlonként a `tense` érték (from → to):
- `data/games/grammar/es/indefinido-regular.json`: `{ "from": "presente", "to": "indefinido" }`
- `data/games/grammar/es/indefinido-irregular.json`: `{ "from": "presente", "to": "indefinido" }`
- `data/games/grammar/es/imperfecto.json`: `{ "from": "presente", "to": "imperfecto" }`
- `data/games/grammar/es/indefinido-imperfecto.json`: `{ "from": "imperfecto", "to": "indefinido" }` (kontraszt-lecke; ha az audit vagy a séma ezt nem engedi, `{ "from": "presente", "to": "indefinido" }`, és írd a jelentésbe)
- `data/games/grammar/es/perfecto.json`: `{ "from": "presente", "to": "perfecto" }` (V1 lecke, `schema` nélkül; a `tense` mezőt az itemekre akkor is tedd rá, ha az audit V1-en engedi; ha nem engedi, hagyd ki és írd a jelentésbe)
- `data/games/grammar/es/condicional-simple.json`: `{ "from": "presente", "to": "condicional" }`

Minden itemre (choice, match, form, why), az item objektum végére, a többi mező érintetlen. A legkisebb diff: egy kis node-script, ami beolvassa a JSON-t, minden itemre ráteszi a `tense`-t, és ugyanazzal a behúzással (2 szóköz) írja vissza, `JSON.stringify(obj, null, 2) + '\n'`. Írás előtt `git diff --stat`-tal nézd meg, hogy csak a `tense` sorok jöttek be (ha a formázás elmozdul, mert az eredeti nem 2 szóközös volt, igazítsd a scriptet az eredeti formázáshoz, ne a fájlt a scripthez).

### Kapu (sorban, mind a worktree gyökeréből)
```
node scripts/audit-games.mjs 2>&1 | tail -15     # 0 P1, cél 0 P2
npx jest 2>&1 | tail -8                           # zöld
npx tsc --noEmit 2>&1 | tail -3                   # 0 hiba
```
Piros → javítasz és újra, legfeljebb 3-szor, aztán piros állapottal jelentesz (NEM commitolsz pirosat).

### Commit (csak zöld kapuval)
`git add data/games/grammar/es/{indefinido-regular,indefinido-irregular,imperfecto,indefinido-imperfecto,perfecto,condicional-simple}.json`, majd:
```
feat(grammar): NY7 tense badge on 6 tense lessons (nyelvtan)

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```
Nem pusholsz.

### Jelentés (max 10 sor)
- 6 fájl, hány item kapott `tense`-t fájlonként
- a 3 kapu utolsó sora
- commit hash
- kihagyott item-fajta / fájl, ha volt, egy sorban az okkal
Nincs diff, nincs fájltartalom, nincs narratíva.
