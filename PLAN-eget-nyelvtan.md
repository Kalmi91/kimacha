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
- [x] 4. `numeros-hora-fecha` (A1 core) új lecke → KÉSZ 2026-09-19, commit 28ffd34, audit 0/0, jest 1131/1131, tsc 0, lint 0 error; 32 item (12 choice, 1 match, 12 form, 7 why), glossza 9
  minta: «Tengo ___ hermano mayor.» = un | «___ la una de la tarde.» = Es | «El café ___ treinta pesos.» = cuesta; a form itemek `verb` mezője „palabra" (nem ige-tábla, a lessonSchema-teszt header-egyezést kér)
  kártya-kérés A1 (az `/eget-szavak` veszi fel): cuatro, uno, veintiuno/veintiún, ochenta, noventa, ciento, diecinueve, hora, cuarto, media, primero, peso, costar
- [x] 5. `preposiciones-basicas` (A1 core) új lecke → KÉSZ 2026-09-19, commit ab18836, audit 0/0, jest 1142/1142, tsc 0, lint 0 error; 32 item (12 choice, 1 match, 12 form, 7 why), glossza: madera
  minta: «Voy ___ la escuela.» = a | «La mesa es ___ madera.» = de | «Voy ___ cine con mi amigo.» = al
  ⚠ SCOPE-ELTÉRÉS (Kálmán vétózhat): `lib/games/ccat.ts` 182-195, 10 sor kód: `buildSentenceFillItem` a shuffle-elt téma-listán végigpróbál, ha az első téma csak transform-itemes (indefinido-10-verbos) és 0 hosszú kört ad; a témalista bővülése egy tesztelt seednél épp ezt húzta be, a jest piros lett. Látens hiba, nem a lecke okozta; enélkül minden további lecke kapuja piros maradna, ezért itt javítva, nem a /kimacha_nyelvtan-ban.
- [x] 6. `comparativos-superlativos` (A2 core) új lecke → KÉSZ 2026-09-19, commit 70e8954, audit 0/0, jest 1153/1153, tsc 0, lint 0 error; 32 item (12 choice, 1 match, 12 form, 7 why), glossza: riquísimo
  minta: «Este coche es más caro ___ el otro.» = que | «Mi hermano ___ tiene treinta años.» = mayor | «Este pastel está ___, no hay otro tan bueno.» = riquísimo
- [x] 7. `imperativo-afirmativo` (A2 core) új lecke → KÉSZ 2026-09-19, commit 070b633, audit 0/0, jest 1164/1164, tsc 0, lint 0 error; 32 item (12 choice, 1 match, 12 form, 7 why), glossza nincs
  minta: «Ana, ___ la verdad, por favor.» = di | «Doctor, ___ más despacio, por favor.» = hable | «Niños, ___ silencio, por favor.» = hagan
  TenseId-bővítés kell: imperativo (transform-drill presente → imperativo), /kimacha_nyelvtan
- [x] 8. `condicionales-tipo1` (B1 core) új lecke → KÉSZ 2026-09-19, commit 46f397e, audit 0/0, jest 1175/1175, tsc 0, lint 0 error; 32 item (12 choice, 1 match, 12 form, 7 why), glossza: cerrar, ventana
  minta: «Si ___ frío, cierra la ventana.» = tienes | «Si llueve, no ___.» = salimos | «Si necesita ayuda, ___ ahora.» = llame; a `tipo1` tábla 12 soros lett (az auditFormItem minden form-hármast egy tábla-cellához köt), a ct-form-09 `accept` mezője inert (a FormItem típus nem ismeri, a UI nem olvassa)
- [x] 9. `condicionales-tipo2-3` (B2 core) új lecke → KÉSZ 2026-09-19, commit 91abbf0, audit 0/0, jest 1186/1186, tsc 0, lint 0 error; 32 item (12 choice, 1 match, 12 form, 7 why), glossza 9 ragozott alak (tendría, hubiera, habría, supiera…)
  minta: «Si ___ dinero, viajaría por el mundo.» = tuviera | «Si hubieras estudiado más, ___ el examen.» = habrías aprobado | «Si hubiera estudiado medicina, ahora ___ médico.» = sería
- [~] 10. `estilo-indirecto` (B2 core) új lecke → kész, ha: ugyanaz
- [ ] 11. `finales-causales` (B2 core) új lecke → kész, ha: ugyanaz
- [ ] 12. `marcadores-discursivos` (C1 core) új lecke → kész, ha: ugyanaz
- [ ] 13. `subjuntivo-disparadores` (B1 core, SUBJ) új lecke → kész, ha: ugyanaz
- [ ] 14. `subjuntivo-presente-forma` (B1 core, SUBJ) új lecke, 50 transform presente → subjuntivo-presente → kész, ha: ugyanaz
- [ ] 15. `temporales-subjuntivo` (B1 core, SUBJ) új lecke → kész, ha: ugyanaz
- [ ] 16. `subjuntivo-imperfecto` (B2 core, SUBJ) új lecke, transform nélkül (TenseId-bővítés kell) → kész, ha: ugyanaz
- …és a probe szerinti folytatás: C-sor 11 V1 átírás, D exam 17, E full 5.

Adag = 3 lecke; adag után push a `nyelvtan` ágra, első adag után PR.
3. adag (7-9) pusholva 2026-09-19, PR #25 frissül.
2. adag (4-6) pusholva 2026-09-19, PR #25 frissül.
1. adag (1-3) pusholva 2026-09-19, PR #25: https://github.com/Kalmi91/kimacha/pull/25 (mainbe csak Kálmán szavára).

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

---

## BRIEF numeros-hora-fecha (4. lépés, B-sor, A1 core, ÚJ lecke)

Worktree gyökér: `/home/kalmi/ai/kimacha-wt-eget-nyelvtan`. Minden `node` / `npx` innen fut.
Ág: `nyelvtan` (már ki van checkolva, ne válts ágat).

### Olvasd el ELŐBB (ebben a sorrendben, csak a releváns szeletet)
1. `/home/kalmi/ai/ai-workspace/kimacha/LECKE-SEMA.md` teljes (a lecke törzse: blokkok, `form`/`match`/`why` feladat-fajták, a választós `wrong` mező stílusa „miért ez az alak, és mi lenne, ha a másik", `speak` a spanyol szakaszokkal «...» közt).
2. `lib/grammar/lessonTypes.ts` teljes (V2 séma: `body` blokkok, `Lang4`, `ExamplePair`, `table`, item-fajták).
3. `lib/grammar/syllabus.ts` 303-309. sor (a téma: id `numeros-hora-fecha`, level A1, unit `a1-cantidad`, title ×4, blurb: «Son las tres, el 5 de mayo, a las ocho y media.»).
4. `scripts/audit-games.mjs` fejléc-kommentje (P1/P2 szabályok; a szint-szabály: a lecke mondataiban csak A0..A1 szó, különben glossza).
5. Minta V2 lecke: `data/games/grammar/es/ser-estar.json` teljes (formátum-minta: body, speak, 12 választós + 1 match + 12 form + 7 why).
6. Regisztráció mintája: `lib/games/content/es.ts` 34. sor (import) és 124. sor (lista-elem) a `ser-estar`-ra.

### Feladat: új lecke, `data/games/grammar/es/numeros-hora-fecha.json`
Nem igeidős téma: NINCS transform, NINCS `tense`.
A. **Fej:** `schema: 2`, `topic: "numeros-hora-fecha"`, `level: "A1"`, `title` a syllabus 4 nyelvén 1:1.
B. **`body`:**
   - `text` (1 bekezdés): mire jó: időpont, dátum, ár, életkor kimondása és megértése; ez az első, amit egy turista/ügyfél használ.
   - `list` vagy `usage` a szabálypontok mind példával (`ExamplePair`: `es` + `tr` ×4), legalább ezek: (1) 1-100 szabályai: 16-29 egybe (dieciséis, veintiuno), 31-99 y-nal (treinta y dos); uno → un + hímnemű főnév (un libro, veintiún años), una + nőnemű; (2) 100 = cien önállóan, ciento + szám (ciento cinco); 200-900 nemben egyezik (doscientas personas); (3) óra: ¿Qué hora es? Es la una / Son las dos; y cuarto, y media, menos cuarto; de la mañana / de la tarde / de la noche; „-kor" = a las (a las ocho y media); (4) dátum: el + szám + de + hónap (el 5 de mayo), elseje = el primero de (Mexikóban) / el uno de; ¿Qué día es hoy? Hoy es lunes; hónap és napnév kisbetű; (5) életkor és ár: tener + szám + años; cuesta + szám + pesos/euros.
   - `table` id-val: `numeros` (0-15 egyedi, 16-19, 20-29 minta, tízesek 30-100), a `form` itemek erre hivatkoznak (számjegy → szó).
   - `contrast`: es la una vs son las dos (egyes vs többes), és a las vs son las (mikor? vs hány óra?).
   - `tip` (1): a percek 31-től „menos"-szal (las tres menos veinte), Mexikóban gyakran „veinte para las tres" is él.
   Minden `Lang4` mind a 4 nyelven (hu/en/es/de), üres string tilos (P1).
C. **`speak` ×4**, a spanyol szakaszok «...» közt (LECKE-SEMA §3).
D. **`glossary`:** csak akkor, ha egy tartalmas szó A1-ig nincs tanítva és nem cserélhető tanítottra (audit P1). Hónap- és napnevek, számnevek: ellenőrizd a kártyákat (`node ~/ai/.claude/skills/eget-nyelvtan/probe.cjs --cards A1 /tmp/claude-1000/cards-A1.tsv`, formátum `id<TAB>es<TAB>szint`); ami nincs, glosszába.
E. **Itemek:** 12 választós (`sentence` `___`-nal, `correct`, minden rossz opción `wrong` ×4 a LECKE-SEMA stílusban: miért nem az, mi lenne, ha), vegyesen szám / óra / dátum / életkor; 1 `match` (5-6 pár: számjegy ↔ szó, vagy óra-kifejezés ↔ digitális idő); 12 `form` a `numeros` table id-ra (számjegy → szó, pl. `21 años` → `veintiún años`, `100` → `cien`, `3:30` → `las tres y media`); 6-8 `why` (3 szabály-név, pl. „un + hímnemű", „es la / son las", „el + de + hónap", a rossz opciókon `wrong` ×4).
F. **Mondat-szabályok:** legfeljebb 12 szó (P2); természetes, ahogy egy anyanyelvű mondja; csak A0-A1 szavak vagy glossza; csak spanyol forrásmondat (K1); Mexikó-spanyol, ahol eltérés van (pesos, nem euros, a példákban).
G. **Regisztráció:** `lib/games/content/es.ts`: import sor a többi grammar-import mintájára (`grammarEsNumerosHoraFecha`) és lista-elem a többi mellé (a lista sorrendje: a syllabus sorrendjében, az `ir-a-infinitivo` / `preposiciones` környékén, ha van ilyen rend; ha nincs, a lista végére). Semmi más kód.
H. Ha valamelyik teszt fix darabszámot állít (`grep -rn "written\|planned\|toHaveLength" lib/__tests__/grammarSyllabus.test.ts lib/grammar/__tests__/syllabus.test.ts`), frissítsd a számot, semmi mást.

### Kapu (sorban, mind a worktree gyökeréből)
```
node scripts/audit-games.mjs 2>&1 | tail -15     # 0 P1, cél 0 P2
npx jest 2>&1 | tail -8                           # zöld
npx tsc --noEmit 2>&1 | tail -3                   # 0 hiba
npx expo lint 2>&1 | tail -5                      # 0 error
```
Piros → javítasz és újra, legfeljebb 3-szor, aztán piros állapottal jelentesz (NEM commitolsz pirosat).

### Commit (csak zöld kapuval)
`git add data/games/grammar/es/numeros-hora-fecha.json lib/games/content/es.ts` (+ a teszt, ha nyúltál hozzá), majd:
```
feat(grammar): numeros-hora-fecha lesson (nyelvtan)

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```
Nem pusholsz.

### Jelentés (max 10 sor)
- fájl + item-számok fajtánként (choice/match/form/why)
- a 4 kapu utolsó sora
- commit hash
- 3 minta választós `sentence` (+ `correct`)
- glossza-szavak listája egy sorban; kártya-kérés sorok, ha voltak; elakadás egy mondatban, ha volt
Nincs diff, nincs fájltartalom, nincs narratíva.

---

## BRIEF preposiciones-basicas (5. lépés, B-sor, A1 core, ÚJ lecke)

Worktree gyökér: `/home/kalmi/ai/kimacha-wt-eget-nyelvtan`. Minden `node` / `npx` innen fut.
Ág: `nyelvtan` (már ki van checkolva, ne válts ágat).

### Olvasd el ELŐBB (ebben a sorrendben, csak a releváns szeletet)
1. `/home/kalmi/ai/ai-workspace/kimacha/LECKE-SEMA.md` teljes (blokkok, `form`/`match`/`why`, a választós `wrong` stílusa „miért ez az alak, és mi lenne, ha a másik", `speak` «...»).
2. `lib/grammar/lessonTypes.ts` teljes (V2 séma).
3. `lib/grammar/syllabus.ts` 310-316. sor (id `preposiciones-basicas`, level A1, unit `a1-cantidad`, title ×4: „Alap elöljárók: a, de, en, con, por", blurb: az a + el = al és de + el = del összevonás is).
4. `scripts/audit-games.mjs` fejléc-kommentje (P1/P2; szint-szabály: csak A0..A1 szó vagy glossza).
5. Minta V2 lecke: `data/games/grammar/es/numeros-hora-fecha.json` (az előző lépésben készült, ugyanez a fajta nem-igeidős lecke) VAGY ha az még nem létezik, `data/games/grammar/es/ser-estar.json`. Egyet olvass, teljesen.
6. Regisztráció mintája: `lib/games/content/es.ts`, a `grammarEsSerEstar` import + lista-elem.

### Feladat: új lecke, `data/games/grammar/es/preposiciones-basicas.json`
Nem igeidős téma: NINCS transform, NINCS `tense`.
A. **Fej:** `schema: 2`, `topic: "preposiciones-basicas"`, `level: "A1"`, `title` a syllabus 4 nyelvén 1:1.
B. **`body`:**
   - `text` (1 bekezdés): mire jó: az öt elöljáró nélkül nincs hely, irány, birtok, eszköz, idő; a legtöbb A1 mondatban legalább egy van.
   - `list` vagy `usage` a szabálypontok mind példával (`ExamplePair`: `es` + `tr` ×4), legalább: (1) **a**: irány (voy a la escuela), időpont (a las ocho), személyes tárgy (veo a mi madre), ir a + infinitivo; (2) **de**: birtok (el libro de Ana), anyag/eredet (soy de Hungría, una mesa de madera), „-ról/-ről" (hablamos de la comida), napszak (de la mañana); (3) **en**: hol (estoy en casa, en la mesa), hónap/év (en mayo, en 2026), közlekedési eszköz (en metro, en coche); (4) **con**: kivel/mivel (con mi amigo, café con leche), conmigo / contigo; (5) **por**: A1-szinten csak: ok (gracias por la ayuda), hozzávetőleges hely (por aquí), napszak (por la mañana), „-n keresztül" (por la calle); por/para részletes a `por-para` leckében, itt csak ennyi; (6) összevonás: a + el = al, de + el = del, csak `el`-lel (a la, de la, a los marad).
   - `table` id-val: `contracciones` (a/de × el/la/los/las → al, a la, a los, a las, del, de la, de los, de las), a `form` itemek erre hivatkoznak.
   - `contrast`: en vs a (hol vagyok vs hova megyek: estoy en casa / voy a casa), és de vs en (de Madrid = madridi / en Madrid = Madridban).
   - `tip` (1): a személyes tárgy „a"-ja (veo a Juan, de veo la tele): ember → a, dolog → nincs.
   Minden `Lang4` mind a 4 nyelven (hu/en/es/de), üres string tilos (P1).
C. **`speak` ×4**, a spanyol szakaszok «...» közt.
D. **`glossary`:** csak akkor, ha egy tartalmas szó A1-ig nincs tanítva és nem cserélhető (audit P1). Kártyák: `node ~/ai/.claude/skills/eget-nyelvtan/probe.cjs --cards A1 /tmp/claude-1000/cards-A1.tsv` („id<TAB>es<TAB>szint"); a példamondatok szavait ebből választod.
E. **Itemek:** 12 választós (`sentence` `___`-nal, opciók az öt elöljáró + al/del közül, `correct`, minden rossz opción `wrong` ×4 LECKE-SEMA stílusban); 1 `match` (5-6 pár: elöljáró ↔ jelentés-kategória vagy mondatrész); 12 `form` a `contracciones` table id-ra (pl. `voy ___ (a + el) cine` → `al`, `la casa ___ (de + el) profesor` → `del`, `vamos ___ (a + la) playa` → `a la`); 6-8 `why` (3 szabály-név, pl. „hol = en", „hova = a", „birtok = de", „személyes tárgy a", a rossz opciókon `wrong` ×4).
F. **Mondat-szabályok:** legfeljebb 12 szó (P2); természetes, anyanyelvű így mondja; csak A0-A1 szavak vagy glossza; csak spanyol forrásmondat (K1); Mexikó-spanyol, ahol eltérés van (en el metro / en camión, nem autobús kizárólag).
G. **Regisztráció:** `lib/games/content/es.ts`: import (`grammarEsPreposicionesBasicas`) + lista-elem, a `numeros-hora-fecha` mellé. Semmi más kód.
H. Ha valamelyik teszt fix darabszámot állít, frissítsd a számot, semmi mást.

### Kapu (sorban, mind a worktree gyökeréből)
```
node scripts/audit-games.mjs 2>&1 | tail -15     # 0 P1, cél 0 P2
npx jest 2>&1 | tail -8                           # zöld
npx tsc --noEmit 2>&1 | tail -3                   # 0 hiba
npx expo lint 2>&1 | tail -5                      # 0 error
```
Piros → javítasz és újra, legfeljebb 3-szor, aztán piros állapottal jelentesz (NEM commitolsz pirosat).

### Commit (csak zöld kapuval)
`git add data/games/grammar/es/preposiciones-basicas.json lib/games/content/es.ts` (+ a teszt, ha nyúltál hozzá), majd:
```
feat(grammar): preposiciones-basicas lesson (nyelvtan)

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```
Nem pusholsz.

### Jelentés (max 10 sor)
- fájl + item-számok fajtánként (choice/match/form/why)
- a 4 kapu utolsó sora
- commit hash
- 3 minta választós `sentence` (+ `correct`)
- glossza-szavak egy sorban; kártya-kérés sorok, ha voltak; elakadás egy mondatban, ha volt
Nincs diff, nincs fájltartalom, nincs narratíva.

---

## BRIEF comparativos-superlativos (6. lépés, B-sor, A2 core, ÚJ lecke)

Worktree gyökér: `/home/kalmi/ai/kimacha-wt-eget-nyelvtan`. Minden `node` / `npx` innen fut.
Ág: `nyelvtan` (már ki van checkolva, ne válts ágat).

### Olvasd el ELŐBB (ebben a sorrendben, csak a releváns szeletet)
1. `/home/kalmi/ai/ai-workspace/kimacha/LECKE-SEMA.md` teljes (blokkok, `form`/`match`/`why`, a választós `wrong` stílusa „miért ez az alak, és mi lenne, ha a másik", `speak` «...»).
2. `lib/grammar/lessonTypes.ts` teljes (V2 séma).
3. `lib/grammar/syllabus.ts` 402-408. sor (id `comparativos-superlativos`, level A2, unit `a2-comparar`, title ×4 „Összehasonlítás és felsőfok", blurb: más que, menos que, tan como, el más, -ísimo).
4. `scripts/audit-games.mjs` fejléc-kommentje (P1/P2; szint-szabály: csak A0..A2 szó vagy glossza).
5. Minta V2 lecke: `data/games/grammar/es/preposiciones-basicas.json` (előző lépés, nem-igeidős lecke); ha nem létezik, `data/games/grammar/es/ser-estar.json`. Egyet olvass, teljesen.
6. Regisztráció mintája: `lib/games/content/es.ts`, a `grammarEsPreposicionesBasicas` (vagy `grammarEsSerEstar`) import + lista-elem.

### Feladat: új lecke, `data/games/grammar/es/comparativos-superlativos.json`
Nem igeidős téma: NINCS transform, NINCS `tense`.
A. **Fej:** `schema: 2`, `topic: "comparativos-superlativos"`, `level: "A2"`, `title` a syllabus 4 nyelvén 1:1.
B. **`body`:**
   - `text` (1 bekezdés): mire jó: választás, vélemény, ár- és méret-összevetés; bolt, étterem, lakáskeresés mondatai.
   - `list` vagy `usage` a szabálypontok mind példával (`ExamplePair`: `es` + `tr` ×4), legalább: (1) **más … que / menos … que** melléknévvel, határozóval, főnévvel (más caro que, menos rápido que, más gente que); (2) **tan … como** (melléknév/határozó) és **tanto/a/os/as … como** (főnév, egyeztetve: tanto dinero como, tantas cosas como); (3) rendhagyók: bueno → **mejor**, malo → **peor**, grande → **mayor** (kor), pequeño → **menor** (kor); grande/pequeño méretre marad más grande / más pequeño; (4) számmal: **más de / menos de** + szám (más de diez pesos), NEM que; (5) felsőfok: **el/la/los/las + (főnév) + más/menos + melléknév + de** (el restaurante más caro de la ciudad, la mejor de la clase); (6) abszolút felsőfok: **-ísimo/-a** (carísimo, buenísimo, facilísimo; helyesírás: rico → riquísimo, largo → larguísimo) és **muy** + melléknév ugyanazt mondja.
   - `table` id-val: `irregulares` (bueno/mejor/el mejor, malo/peor/el peor, grande/mayor/el mayor, pequeño/menor/el menor, plusz 3-4 -ísimo alak), a `form` itemek erre hivatkoznak.
   - `contrast`: más que vs más de (személy/dolog vs szám), és tan como vs tanto como (melléknév vs főnév).
   - `tip` (1): „mayor/menor" korra, „más grande/más pequeño" méretre: mi hermano mayor, de una casa más grande.
   Minden `Lang4` mind a 4 nyelven (hu/en/es/de), üres string tilos (P1).
C. **`speak` ×4**, a spanyol szakaszok «...» közt.
D. **`glossary`:** csak akkor, ha egy tartalmas szó A2-ig nincs tanítva és nem cserélhető (audit P1). Kártyák: `node ~/ai/.claude/skills/eget-nyelvtan/probe.cjs --cards A2 /tmp/claude-1000/cards-A2.tsv` („id<TAB>es<TAB>szint"); a példamondatok szavait ebből választod.
E. **Itemek:** 12 választós (`sentence` `___`-nal, opciók pl. más que / más de / tan como / tanto como / mejor / más bueno, `correct`, minden rossz opción `wrong` ×4 LECKE-SEMA stílusban); 1 `match` (5-6 pár: alapfok ↔ rendhagyó középfok, vagy szerkezet ↔ mikor); 12 `form` az `irregulares` table id-ra (pl. `Este café es ___ (bueno, középfok) que el otro` → `mejor`, `Es un libro ___ (interesante, -ísimo)` → `interesantísimo`, `Mi hermana ___ (grande, kor) tiene 30 años` → `mayor`); 6-8 `why` (3 szabály-név, pl. „szám → de", „főnév → tanto/a", „rendhagyó mejor/peor", a rossz opciókon `wrong` ×4).
F. **Mondat-szabályok:** legfeljebb 12 szó (P2); természetes, anyanyelvű így mondja; csak A0-A2 szavak vagy glossza; csak spanyol forrásmondat (K1); Mexikó-spanyol, ahol eltérés van (pesos, camión, carro).
G. **Regisztráció:** `lib/games/content/es.ts`: import (`grammarEsComparativosSuperlativos`) + lista-elem az A2 leckék mellé. Semmi más kód.
H. Ha valamelyik teszt fix darabszámot állít, frissítsd a számot, semmi mást.

### Kapu (sorban, mind a worktree gyökeréből)
```
node scripts/audit-games.mjs 2>&1 | tail -15     # 0 P1, cél 0 P2
npx jest 2>&1 | tail -8                           # zöld
npx tsc --noEmit 2>&1 | tail -3                   # 0 hiba
npx expo lint 2>&1 | tail -5                      # 0 error
```
Piros → javítasz és újra, legfeljebb 3-szor, aztán piros állapottal jelentesz (NEM commitolsz pirosat).

### Commit (csak zöld kapuval)
`git add data/games/grammar/es/comparativos-superlativos.json lib/games/content/es.ts` (+ a teszt, ha nyúltál hozzá), majd:
```
feat(grammar): comparativos-superlativos lesson (nyelvtan)

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```
Nem pusholsz.

### Jelentés (max 10 sor)
- fájl + item-számok fajtánként (choice/match/form/why)
- a 4 kapu utolsó sora
- commit hash
- 3 minta választós `sentence` (+ `correct`)
- glossza-szavak egy sorban; kártya-kérés sorok, ha voltak; elakadás egy mondatban, ha volt
Nincs diff, nincs fájltartalom, nincs narratíva.

---

## BRIEF imperativo-afirmativo (7. lépés, B-sor, A2 core, ÚJ lecke)

Worktree gyökér: `/home/kalmi/ai/kimacha-wt-eget-nyelvtan`. Minden `node` / `npx` innen fut.
Ág: `nyelvtan` (már ki van checkolva, ne válts ágat).

### Olvasd el ELŐBB (ebben a sorrendben, csak a releváns szeletet)
1. `/home/kalmi/ai/ai-workspace/kimacha/LECKE-SEMA.md` teljes (blokkok, `form`/`match`/`why`, a választós `wrong` stílusa „miért ez az alak, és mi lenne, ha a másik", `speak` «...»).
2. `lib/grammar/lessonTypes.ts` teljes (V2 séma).
3. `lib/grammar/syllabus.ts` 374-380. sor (id `imperativo-afirmativo`, level A2, unit `a2-futuro`, title ×4 „Felszólítás: állító alak", blurb: habla, come, ven, haz: kérés és utasítás).
4. `scripts/audit-games.mjs` fejléc-kommentje (P1/P2; szint-szabály: csak A0..A2 szó vagy glossza).
5. Minta V2 ige-lecke: `data/games/grammar/es/presente-irregular.json` (A1, ige-tábla + 12 form a táblára). Teljesen olvasd, ez a formátum-minta ige-témához.
6. Regisztráció mintája: `lib/games/content/es.ts`, a `grammarEsComparativosSuperlativos` (vagy bármelyik grammar) import + lista-elem.

### Feladat: új lecke, `data/games/grammar/es/imperativo-afirmativo.json`
Az imperativo NINCS a `TENSE_IDS`-ben, ezért NINCS transform és NINCS `tense` (a PLAN-ba külön sor megy: „TenseId-bővítés kell: imperativo, /kimacha_nyelvtan"; te nem bővíted).
A. **Fej:** `schema: 2`, `topic: "imperativo-afirmativo"`, `level: "A2"`, `title` a syllabus 4 nyelvén 1:1.
B. **`body`:**
   - `text` (1 bekezdés): mire jó: kérés, utasítás, útbaigazítás, recept, tanács; a hétköznapi „gyere, nézd, mondd" alakja.
   - `list` vagy `usage` a szabálypontok mind példával (`ExamplePair`: `es` + `tr` ×4), legalább: (1) **tú** szabályos = a presente 3. személy (habla, come, escribe); (2) **tú** rendhagyó 8: di, haz, ve, pon, sal, sé, ten, ven; (3) **usted / ustedes** = subjuntivo-alak (hable, coma, escriba; hablen, coman; rendhagyó: diga, haga, vaya, ponga, salga, sea, tenga, venga), Mexikóban az ustedes a többes alak vosotros helyett; (4) **nosotros** = subjuntivo (hablemos, comamos, vamos), „csináljuk"; (5) **vosotros** = infinitivo -r → -d (hablad, comed, venid), csak Spanyolországban; (6) **névmások az ige VÉGÉN** egybeírva, ékezet, ha kell: dímelo, siéntate, cómelo, levántate; visszaható tú-alak -te, nosotros -nos (sentémonos, s nélkül).
   - `table` id-val: `imperativo` (sorok: hablar, comer, escribir + a 8 rendhagyó tú-alak, oszlopok: tú, usted, ustedes; a `form` itemek erre hivatkoznak).
   - `contrast`: tú vs usted (habla / hable: kinek mondod), és imperativo vs presente 3. személy (¡Come! / Ella come: alak azonos, funkció más).
   - `tip` (1): a rendhagyó tú-alakok egy szótagúak, memória-sor: „di, haz, ve, pon, sal, sé, ten, ven".
   Minden `Lang4` mind a 4 nyelven (hu/en/es/de), üres string tilos (P1).
C. **`speak` ×4**, a spanyol szakaszok «...» közt.
D. **`glossary`:** csak akkor, ha egy tartalmas szó A2-ig nincs tanítva és nem cserélhető (audit P1). Kártyák: `node ~/ai/.claude/skills/eget-nyelvtan/probe.cjs --cards A2 /tmp/claude-1000/cards-A2.tsv` („id<TAB>es<TAB>szint"); a példamondatok igéit és szavait ebből választod.
E. **Itemek:** 12 választós (`sentence` `___`-nal, opciók tú/usted/ustedes alakok + presente-alak csali, `correct`, minden rossz opción `wrong` ×4 LECKE-SEMA stílusban); 1 `match` (5-6 pár: infinitivo ↔ rendhagyó tú-alak); 12 `form` az `imperativo` table id-ra (a `verb` mező = az infinitivo, a table headerének megfelelően, mint a `presente-irregular.json`-ban; pl. `(venir, tú) ___ aquí` → `ven`, `(hacer, usted) ___ la tarea` → `haga`, `(comer, ustedes) ___ despacio` → `coman`); 6-8 `why` (3 szabály-név, pl. „tú = presente 3. személy", „usted = subjuntivo", „névmás a végén", a rossz opciókon `wrong` ×4).
F. **Mondat-szabályok:** legfeljebb 12 szó (P2); természetes, anyanyelvű így mondja; csak A0-A2 szavak vagy glossza; csak spanyol forrásmondat (K1); Mexikó-spanyol: az ustedes a többes, a vosotros csak a body-ban említve.
G. **Regisztráció:** `lib/games/content/es.ts`: import (`grammarEsImperativoAfirmativo`) + lista-elem az A2 leckék mellé. Semmi más kód.
H. Ha valamelyik teszt fix darabszámot állít, frissítsd a számot, semmi mást.

### Kapu (sorban, mind a worktree gyökeréből)
```
node scripts/audit-games.mjs 2>&1 | tail -15     # 0 P1, cél 0 P2
npx jest 2>&1 | tail -8                           # zöld
npx tsc --noEmit 2>&1 | tail -3                   # 0 hiba
npx expo lint 2>&1 | tail -5                      # 0 error
```
Piros → javítasz és újra, legfeljebb 3-szor, aztán piros állapottal jelentesz (NEM commitolsz pirosat).

### Commit (csak zöld kapuval)
`git add data/games/grammar/es/imperativo-afirmativo.json lib/games/content/es.ts` (+ a teszt, ha nyúltál hozzá), majd:
```
feat(grammar): imperativo-afirmativo lesson (nyelvtan)

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```
Nem pusholsz.

### Jelentés (max 10 sor)
- fájl + item-számok fajtánként (choice/match/form/why)
- a 4 kapu utolsó sora
- commit hash
- 3 minta választós `sentence` (+ `correct`)
- glossza-szavak egy sorban; kártya-kérés sorok, ha voltak; elakadás egy mondatban, ha volt
Nincs diff, nincs fájltartalom, nincs narratíva.

---

## BRIEF condicionales-tipo1 (8. lépés, B-sor, B1 core, ÚJ lecke)

Worktree gyökér: `/home/kalmi/ai/kimacha-wt-eget-nyelvtan`. Minden `node` / `npx` innen fut.
Ág: `nyelvtan` (már ki van checkolva, ne válts ágat).

### Olvasd el ELŐBB (ebben a sorrendben, csak a releváns szeletet)
1. `/home/kalmi/ai/ai-workspace/kimacha/LECKE-SEMA.md` teljes (blokkok, `form`/`match`/`why`, a választós `wrong` stílusa „miért ez az alak, és mi lenne, ha a másik", `speak` «...»).
2. `lib/grammar/lessonTypes.ts` teljes (V2 séma).
3. `lib/grammar/syllabus.ts` 480-486. sor (id `condicionales-tipo1`, level B1, unit `b1-condicional`, title ×4 „Si + jelen: valós feltétel", blurb: si tengo tiempo, voy: ami tényleg megtörténhet).
4. `scripts/audit-games.mjs` fejléc-kommentje (P1/P2; szint-szabály: csak A0..B1 szó vagy glossza).
5. Minta V2 B1 lecke: `data/games/grammar/es/condicional-simple.json` (B1, body: text/list/table/usage/contrast/tip, 12 form a táblára). Csak a `body`-t és 2-2 itemet olvass fajtánként, nem az egészet.
6. Regisztráció mintája: `lib/games/content/es.ts`, a `grammarEsCondicionalSimple` import + lista-elem.

### Feladat: új lecke, `data/games/grammar/es/condicionales-tipo1.json`
Nem egy igeidő a tárgya (szerkezet-téma): NINCS transform, NINCS `tense`.
A. **Fej:** `schema: 2`, `topic: "condicionales-tipo1"`, `level: "B1"`, `title` a syllabus 4 nyelvén 1:1.
B. **`body`:**
   - `text` (1 bekezdés): mire jó: terv, ígéret, figyelmeztetés, alku („ha…, akkor…"), ami tényleg megtörténhet; a leggyakoribb feltételes mondat a beszédben.
   - `list` vagy `usage` a szabálypontok mind példával (`ExamplePair`: `es` + `tr` ×4), legalább: (1) **si + presente, presente** (általános igazság, szokás: si llueve, no salimos); (2) **si + presente, futuro simple** (jövőbeli következmény: si estudias, aprobarás); (3) **si + presente, imperativo** (utasítás: si tienes frío, cierra la ventana); (4) **si + presente, ir a + infinitivo** (beszélt jövő: si llegas tarde, vamos a empezar sin ti); (5) a si-tagmondat SOHA nem futuro és nem condicional (si tendré ✗, si tendría ✗); (6) sorrend: a si-tag elöl vesszővel, hátul vessző nélkül (Si puedo, te llamo. / Te llamo si puedo.); (7) si vs cuando: si = bizonytalan, cuando = biztos, csak az idő kérdés (cuando + subjuntivo a `temporales-subjuntivo` leckében, itt csak említve).
   - `table` id-val: `tipo1` (sorok: a 4 főtag-fajta: presente / futuro / imperativo / ir a + inf., oszlopok: si-tag, főtag, példa), a `form` itemek erre hivatkoznak (a `verb` mező = a table header 2. oszlopának `es` értéke, mint a `preposiciones-basicas.json`-ban; nézd meg ott).
   - `contrast`: si + presente vs si + futuro (helyes / helytelen), és si vs cuando.
   - `tip` (1): a si-tagot mindig jelenbe: „ha a magyarban jövő is van (ha majd…), a spanyol si után akkor is presente".
   Minden `Lang4` mind a 4 nyelven (hu/en/es/de), üres string tilos (P1).
C. **`speak` ×4**, a spanyol szakaszok «...» közt.
D. **`glossary`:** csak akkor, ha egy tartalmas szó B1-ig nincs tanítva és nem cserélhető (audit P1). Kártyák: `node ~/ai/.claude/skills/eget-nyelvtan/probe.cjs --cards B1 /tmp/claude-1000/cards-B1.tsv` („id<TAB>es<TAB>szint"); a példamondatok szavait ebből választod.
E. **Itemek:** 12 választós (`sentence` `___`-nal: hol a si-tag igéje, hol a főtagé; opciók presente / futuro / condicional / imperativo alakok, `correct`, minden rossz opción `wrong` ×4 LECKE-SEMA stílusban); 1 `match` (5-6 pár: si-tag ↔ illő főtag); 12 `form` a `tipo1` table id-ra (infinitivo + személy + tag-fajta → alak, pl. `Si (tener, tú) ___ tiempo, ven.` → `tienes`, `Si llueve, (quedarse, nosotros) ___ en casa.` → `nos quedamos` / `nos quedaremos`, ahol két jó alak van, `accept`-be a másik); 6-8 `why` (3 szabály-név, pl. „si + presente", „főtag futuro", „si ≠ futuro", a rossz opciókon `wrong` ×4).
F. **Mondat-szabályok:** legfeljebb 12 szó (P2); természetes, anyanyelvű így mondja; csak A0-B1 szavak vagy glossza; csak spanyol forrásmondat (K1); Mexikó-spanyol (ustedes, nem vosotros, a példákban).
G. **Regisztráció:** `lib/games/content/es.ts`: import (`grammarEsCondicionalesTipo1`) + lista-elem a B1 leckék mellé. Semmi más kód.
H. Ha valamelyik teszt fix darabszámot állít, frissítsd a számot, semmi mást. Ha egy jest-teszt olyan fájlban piros, ami nem a te leckéd (pl. `lib/games/*.ts`), NEM javítod a kódot: piros állapottal jelentesz, melyik teszt és miért.

### Kapu (sorban, mind a worktree gyökeréből)
```
node scripts/audit-games.mjs 2>&1 | tail -15     # 0 P1, cél 0 P2
npx jest 2>&1 | tail -8                           # zöld
npx tsc --noEmit 2>&1 | tail -3                   # 0 hiba
npx expo lint 2>&1 | tail -5                      # 0 error
```
Piros → javítasz és újra, legfeljebb 3-szor, aztán piros állapottal jelentesz (NEM commitolsz pirosat).

### Commit (csak zöld kapuval)
`git add data/games/grammar/es/condicionales-tipo1.json lib/games/content/es.ts` (+ a teszt, ha nyúltál hozzá), majd:
```
feat(grammar): condicionales-tipo1 lesson (nyelvtan)

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```
Nem pusholsz.

### Jelentés (max 10 sor)
- fájl + item-számok fajtánként (choice/match/form/why)
- a 4 kapu utolsó sora
- commit hash
- 3 minta választós `sentence` (+ `correct`)
- glossza-szavak egy sorban; kártya-kérés sorok, ha voltak; elakadás egy mondatban, ha volt
Nincs diff, nincs fájltartalom, nincs narratíva.

---

## BRIEF condicionales-tipo2-3 (9. lépés, B-sor, B2 core, ÚJ lecke)

Worktree gyökér: `/home/kalmi/ai/kimacha-wt-eget-nyelvtan`. Minden `node` / `npx` innen fut.
Ág: `nyelvtan` (már ki van checkolva, ne válts ágat).

### Olvasd el ELŐBB (ebben a sorrendben, csak a releváns szeletet)
1. `/home/kalmi/ai/ai-workspace/kimacha/LECKE-SEMA.md` teljes (blokkok, `form`/`match`/`why`, a választós `wrong` stílusa „miért ez az alak, és mi lenne, ha a másik", `speak` «...»).
2. `lib/grammar/lessonTypes.ts` teljes (V2 séma).
3. `lib/grammar/syllabus.ts` 537-543. sor (id `condicionales-tipo2-3`, level B2, unit `b2-subjuntivo`, title ×4 „Irreális feltétel: si tuviera, si hubiera", blurb: ami nem igaz, és ami már nem lehet igaz).
4. `scripts/audit-games.mjs` fejléc-kommentje (P1/P2; szint-szabály: csak A0..B2 szó vagy glossza).
5. Minta V2 lecke: `data/games/grammar/es/condicionales-tipo1.json` (előző lépés, ugyanaz a téma-család, B1). Teljesen olvasd, ez a formátum-minta; a tipo2-3 erre épül, a body `text`-je hivatkozzon rá egy mondatban („a tipo1 valós feltétel után…").
6. Regisztráció mintája: `lib/games/content/es.ts`, a `grammarEsCondicionalesTipo1` import + lista-elem.

### Feladat: új lecke, `data/games/grammar/es/condicionales-tipo2-3.json`
Szerkezet-téma, a benne szereplő subjuntivo-imperfecto / pluscuamperfecto NINCS a `TENSE_IDS`-ben: NINCS transform, NINCS `tense`.
A. **Fej:** `schema: 2`, `topic: "condicionales-tipo2-3"`, `level: "B2"`, `title` a syllabus 4 nyelvén 1:1.
B. **`body`:**
   - `text` (1 bekezdés): mire jó: „ha lenne / ha lett volna": kívánság, sajnálkozás, tanács (yo que tú…), udvarias feltételezés; a tipo1 után ez a két irreális fok.
   - `list` vagy `usage` a szabálypontok mind példával (`ExamplePair`: `es` + `tr` ×4), legalább: (1) **tipo 2, jelen/jövő irreális: si + imperfecto de subjuntivo, condicional simple** (si tuviera dinero, viajaría; si fueras más amable, te ayudarían); (2) az imperfecto de subjuntivo képzése röviden: indefinido 3. személy többes (tuvieron → tuviera; fueron → fuera; hicieron → hiciera), -ra és -se alak egyenértékű, a -ra a gyakoribb; (3) **tipo 3, múlt irreális: si + pluscuamperfecto de subjuntivo, condicional compuesto** (si hubiera sabido, habría venido; si hubieras estudiado, habrías aprobado); (4) vegyes: múlt feltétel, jelen következmény (si hubiera estudiado medicina, ahora sería médico); (5) beszélt nyelvben a főtag „hubiera" is lehet a „habría" helyett (si lo hubiera sabido, hubiera venido), Mexikóban gyakori; (6) a si után SOHA nincs condicional (si tendría ✗) és soha nincs presente de subjuntivo (si tenga ✗); (7) ojalá / como si + imperfecto de subjuntivo ugyanezt az irrealitást hordozza (ojalá tuviera, habla como si supiera), csak említve.
   - `table` id-val: `irreal` (sorok: tener, ser, hacer, poder, saber; oszlopok: imperfecto de subjuntivo (yo/tú/él), pluscuamperfecto de subjuntivo (yo), condicional simple (yo), condicional compuesto (yo)); a `form` itemek erre hivatkoznak (a `verb` mező = az infinitivo, a table header szerint; ige-tábla, mint a `presente-irregular.json`). Tanulság a 8. lépésből: az `auditFormItem` minden form-item person/verb/answer hármasát egy konkrét tábla-cellához köti, ezért a táblának legalább 12 különböző, a form itemekkel egyező cellát kell adnia; ha kell, bővítsd a sorokat (több ige), ne a form itemeket ismételd. `accept` mezőt form itemre NE tegyél (a FormItem típus nem ismeri, inert); ha két jó alak van, a tábla-cella egyik alakját kérd, a másikat a `body`-ban említsd.
   - `contrast`: tipo1 vs tipo2 (si tengo tiempo, voy / si tuviera tiempo, iría: lehetséges vs nem valószínű), és tipo2 vs tipo3 (si tuviera / si hubiera tenido: még lehet vs már nem).
   - `tip` (1): képezd az imperfecto de subjuntivót mindig az indefinido ellos-alakjából, így a rendhagyók ingyen jönnek (dijeron → dijera, pudieron → pudiera).
   Minden `Lang4` mind a 4 nyelven (hu/en/es/de), üres string tilos (P1).
C. **`speak` ×4**, a spanyol szakaszok «...» közt.
D. **`glossary`:** csak akkor, ha egy tartalmas szó B2-ig nincs tanítva és nem cserélhető (audit P1). Kártyák: `node ~/ai/.claude/skills/eget-nyelvtan/probe.cjs --cards B2 /tmp/claude-1000/cards-B2.tsv` („id<TAB>es<TAB>szint"); a példamondatok szavait ebből választod.
E. **Itemek:** 12 választós (`sentence` `___`-nal, hol a si-tag, hol a főtag igéje; opciók: imperfecto de subjuntivo / condicional / presente / indefinido / pluscuamperfecto alakok, `correct`, minden rossz opción `wrong` ×4 LECKE-SEMA stílusban), 6 tipo2 + 4 tipo3 + 2 vegyes; 1 `match` (5-6 pár: si-tag ↔ illő főtag, tipo2 és tipo3 vegyesen); 12 `form` az `irreal` table id-ra (infinitivo + személy + alak-fajta → alak, pl. `Si (tener, yo) ___ tiempo, iría.` → `tuviera` (`accept`: tuviese), `Si hubiera sabido, (venir, yo) ___.` → `habría venido` (`accept`: hubiera venido)); 6-8 `why` (3 szabály-név, pl. „si + imperfecto subj.", „főtag condicional", „múlt = hubiera + participio", a rossz opciókon `wrong` ×4).
F. **Mondat-szabályok:** legfeljebb 12 szó (P2); természetes, anyanyelvű így mondja; csak A0-B2 szavak vagy glossza; csak spanyol forrásmondat (K1); Mexikó-spanyol (ustedes).
G. **Regisztráció:** `lib/games/content/es.ts`: import (`grammarEsCondicionalesTipo23`) + lista-elem a B2 leckék mellé (a `condicionales-tipo1` után). Semmi más kód.
H. Ha valamelyik teszt fix darabszámot állít, frissítsd a számot, semmi mást. Ha egy jest-teszt olyan fájlban piros, ami nem a te leckéd (pl. `lib/games/*.ts`), NEM javítod a kódot: piros állapottal jelentesz, melyik teszt és miért.

### Kapu (sorban, mind a worktree gyökeréből)
```
node scripts/audit-games.mjs 2>&1 | tail -15     # 0 P1, cél 0 P2
npx jest 2>&1 | tail -8                           # zöld
npx tsc --noEmit 2>&1 | tail -3                   # 0 hiba
npx expo lint 2>&1 | tail -5                      # 0 error
```
Piros → javítasz és újra, legfeljebb 3-szor, aztán piros állapottal jelentesz (NEM commitolsz pirosat).

### Commit (csak zöld kapuval)
`git add data/games/grammar/es/condicionales-tipo2-3.json lib/games/content/es.ts` (+ a teszt, ha nyúltál hozzá), majd:
```
feat(grammar): condicionales-tipo2-3 lesson (nyelvtan)

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```
Nem pusholsz.

### Jelentés (max 10 sor)
- fájl + item-számok fajtánként (choice/match/form/why)
- a 4 kapu utolsó sora
- commit hash
- 3 minta választós `sentence` (+ `correct`)
- glossza-szavak egy sorban; kártya-kérés sorok, ha voltak; elakadás egy mondatban, ha volt
Nincs diff, nincs fájltartalom, nincs narratíva.

---

## BRIEF estilo-indirecto (10. lépés, B-sor, B2 core, ÚJ lecke)

Worktree gyökér: `/home/kalmi/ai/kimacha-wt-eget-nyelvtan`. Minden `node` / `npx` innen fut.
Ág: `nyelvtan` (már ki van checkolva, ne válts ágat).

### Olvasd el ELŐBB (ebben a sorrendben, csak a releváns szeletet)
1. `/home/kalmi/ai/ai-workspace/kimacha/LECKE-SEMA.md` teljes (blokkok, `form`/`match`/`why`, a választós `wrong` stílusa „miért ez az alak, és mi lenne, ha a másik", `speak` «...»).
2. `lib/grammar/lessonTypes.ts` teljes (V2 séma).
3. `lib/grammar/syllabus.ts` 544-550. sor (id `estilo-indirecto`, level B2, unit `b2-oraciones`, title ×4 „Függő beszéd", blurb: dijo que venía: az igeidő-eltolás szabálya).
4. `scripts/audit-games.mjs` fejléc-kommentje (P1/P2; szint-szabály: csak A0..B2 szó vagy glossza).
5. Minta V2 lecke: `data/games/grammar/es/condicionales-tipo2-3.json` (előző lépés, B2, szerkezet-téma táblával); ha nem létezik, `condicionales-tipo1.json`. Egyet olvass, teljesen.
6. Regisztráció mintája: `lib/games/content/es.ts`, a `grammarEsCondicionalesTipo23` (vagy `Tipo1`) import + lista-elem.

### Feladat: új lecke, `data/games/grammar/es/estilo-indirecto.json`
Szerkezet-téma: NINCS transform, NINCS `tense` (az eltolás több igeidőt érint, egy `from/to` pár nem írja le).
A. **Fej:** `schema: 2`, `topic: "estilo-indirecto"`, `level: "B2"`, `title` a syllabus 4 nyelvén 1:1.
B. **`body`:**
   - `text` (1 bekezdés): mire jó: elmondani, mit mondott / kérdezett / kért valaki; üzenet átadása, pletyka, beszámoló; a bevezető ige múltjával minden eltolódik.
   - `list` vagy `usage` a szabálypontok mind példával (`ExamplePair`: `es` + `tr` ×4), legalább: (1) **bevezető ige jelenben: nincs eltolás** (dice que viene; pregunta si tienes tiempo); (2) **bevezető ige múltban (dijo, preguntó, contó): eltolás**: presente → imperfecto (dijo que venía), indefinido / perfecto → pluscuamperfecto (dijo que había comido), futuro → condicional (dijo que vendría), imperativo → imperfecto de subjuntivo (dijo que viniera), presente de subjuntivo → imperfecto de subjuntivo; imperfecto és condicional marad; (3) **kérdések**: eldöntendő → si (preguntó si…), kérdőszavas → a kérdőszó marad ékezettel (preguntó dónde vivía); (4) **személy, hely, idő váltása**: yo → él, aquí → allí, hoy → ese día / aquel día, mañana → al día siguiente, ayer → el día anterior, este → ese, mi → su; (5) **kérés, parancs**: pedir / decir + que + subjuntivo (me pidió que la llamara); (6) nincs eltolás, ha az állítás ma is igaz (dijo que la tierra es redonda / el médico dijo que fumar es malo), beszédben gyakori.
   - `table` id-val: `cambio` (sorok: az igeidő-eltolás párjai: presente → imperfecto, indefinido → pluscuamperfecto, perfecto → pluscuamperfecto, futuro → condicional, imperativo → imperfecto de subjuntivo, presente de subj. → imperfecto de subj.; oszlopok: directo, indirecto, példa); a `form` itemek erre hivatkoznak (a `verb` mező = a table header 2. oszlopának `es` értéke, nem-ige tábla, mint a `preposiciones-basicas.json`-ban). Tanulság a 8. lépésből: az `auditFormItem` minden form-item person/verb/answer hármasát egy konkrét tábla-cellához köti, ezért a táblának legalább 12 különböző, a form itemekkel egyező cellát kell adnia (6 eltolás-pár × 2 példa-ige, vagy 12 sor); ha kell, bővítsd a sorokat, ne a form itemeket ismételd. `accept` mezőt form itemre NE tegyél (a FormItem típus nem ismeri, inert); ha két jó alak van (-ra/-se), a tábla-cella -ra alakját kérd, a -se-t a `body`-ban említsd.
   - `contrast`: dice que viene vs dijo que venía (jelen vs múlt bevezető), és preguntó si vs preguntó qué (eldöntendő vs kérdőszavas).
   - `tip` (1): ha bizonytalan az eltolás, kérdezd meg: „amikor mondta, az akkor jelen volt, múlt vagy jövő?", és told egy lépéssel hátra.
   Minden `Lang4` mind a 4 nyelven (hu/en/es/de), üres string tilos (P1).
C. **`speak` ×4**, a spanyol szakaszok «...» közt.
D. **`glossary`:** csak akkor, ha egy tartalmas szó B2-ig nincs tanítva és nem cserélhető (audit P1). Kártyák: `node ~/ai/.claude/skills/eget-nyelvtan/probe.cjs --cards B2 /tmp/claude-1000/cards-B2.tsv` („id<TAB>es<TAB>szint"); a példamondatok szavait ebből választod.
E. **Itemek:** 12 választós (`sentence` `___`-nal: a függő mondat igéje, néha a si/que/kérdőszó vagy a hely-idő szó; opciók: az eltolt alak + az eltolatlan + egy másik idő, `correct`, minden rossz opción `wrong` ×4 LECKE-SEMA stílusban); 1 `match` (5-6 pár: egyenes beszéd ↔ függő alak); 12 `form` a `cambio` table id-ra (egyenes idézet → függő mondat igéje, pl. `«Tengo hambre.» Dijo que ___ hambre.` → `tenía`, `«Vendré mañana.» Dijo que ___ al día siguiente.` → `vendría`, `«¡Cierra la puerta!» Me pidió que ___ la puerta.` → `cerrara`); 6-8 `why` (3 szabály-név, pl. „múlt bevezető → eltolás", „kérdés → si", „parancs → subjuntivo", a rossz opciókon `wrong` ×4).
F. **Mondat-szabályok:** legfeljebb 12 szó (P2); természetes, anyanyelvű így mondja; csak A0-B2 szavak vagy glossza; csak spanyol forrásmondat (K1); Mexikó-spanyol (ustedes).
G. **Regisztráció:** `lib/games/content/es.ts`: import (`grammarEsEstiloIndirecto`) + lista-elem a B2 leckék mellé. Semmi más kód.
H. Ha valamelyik teszt fix darabszámot állít, frissítsd a számot, semmi mást. Ha egy jest-teszt olyan fájlban piros, ami nem a te leckéd (pl. `lib/games/*.ts`), NEM javítod a kódot: piros állapottal jelentesz, melyik teszt és miért.

### Kapu (sorban, mind a worktree gyökeréből)
```
node scripts/audit-games.mjs 2>&1 | tail -15     # 0 P1, cél 0 P2
npx jest 2>&1 | tail -8                           # zöld
npx tsc --noEmit 2>&1 | tail -3                   # 0 hiba
npx expo lint 2>&1 | tail -5                      # 0 error
```
Piros → javítasz és újra, legfeljebb 3-szor, aztán piros állapottal jelentesz (NEM commitolsz pirosat).

### Commit (csak zöld kapuval)
`git add data/games/grammar/es/estilo-indirecto.json lib/games/content/es.ts` (+ a teszt, ha nyúltál hozzá), majd:
```
feat(grammar): estilo-indirecto lesson (nyelvtan)

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```
Nem pusholsz.

### Jelentés (max 10 sor)
- fájl + item-számok fajtánként (choice/match/form/why)
- a 4 kapu utolsó sora
- commit hash
- 3 minta választós `sentence` (+ `correct`)
- glossza-szavak egy sorban; kártya-kérés sorok, ha voltak; elakadás egy mondatban, ha volt
Nincs diff, nincs fájltartalom, nincs narratíva.
