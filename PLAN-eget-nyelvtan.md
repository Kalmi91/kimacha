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
- [x] 10. `estilo-indirecto` (B2 core) új lecke → KÉSZ 2026-09-19, commit a758e68, audit 0/0, jest 1197/1197, tsc 0, lint 0 error; 32 item (12 choice, 1 match, 12 form, 7 why), glossza: dice
  minta: «Dice que ___ tarde.» = llega | «Dijo que ___ mucho.» = trabajaba | «Me pidió que ___ a mi hermano.» = llamara
- [x] 11. `finales-causales` (B2 core) új lecke → KÉSZ 2026-09-19, commit 7308213, audit 0/0, jest 1208/1208, tsc 0, lint 0 error; 32 item (12 choice, 1 match, 12 form, 7 why), glossza nincs
  minta: «Estudio ___ aprobar el examen.» = para | «Te llamo para que me ___ tú.» = ayudes | «___ no tengo tiempo, no puedo ayudarte.» = Como
- [x] 12. `marcadores-discursivos` (C1 core) új lecke → KÉSZ 2026-09-19, commit 8fd5561, audit 0/0, jest 1219/1219, tsc 0, lint 0 error; 32 item (12 choice, 1 match, 12 form, 7 why), glossza: obstante, aun, consiguiente, sea
  minta: «Estudió mucho; ___, no aprobó el examen.» = sin embargo | «No estudió nada; ___, no aprobó el examen.» = por lo tanto
  ⚠ gyenge pont: a 12 form item itt „kötőelem → funkció/regiszter" felismerés, nem mondat-gyártás (az auditFormItem person = tábla row[0], answer = col≥1 cella; a brief táblája ezt nem vette figyelembe). A választós és why itemek mondatosak. A 14. lépéstől a nem-ige táblák úgy épülnek, hogy row[0] = a helyzet/kiváltó, az oszlopok = igék, a cella = a gyártandó alak.
- [x] 13. `subjuntivo-presente-forma` (B1 core, SUBJ) új lecke, 50 transform → KÉSZ 2026-09-19, commit d140255, audit 0/0, jest 1230/1230, tsc 0, lint 0 error; 83 item (12 choice, 1 match, 12 form, 8 why, 50 transform), glossza nincs (a syllabus-sorrend szerint a disparadores ELŐTT)
  minta: «Creo que hablo con mi amigo hoy.» → «No creo que hable con mi amigo hoy.» | «Sé que no tiene tiempo.» → «Dudo que no tenga tiempo.» | «¿Piensas que tienen un perro?» → «¿No piensas que tengan un perro?» | «Dice que sabemos la razón.» → «Quiere que sepamos la razón.» | «Es seguro que pido un libro.» → «Es posible que pida un libro.»
  ⚠ gyenge pont: az 5 mintából 2 nem természetes («Dudo que no tenga tiempo», «Es seguro que pido un libro»): a kiváltó-csere recept a kártya-kényszerrel együtt szabály-illusztrációt szül; Kálmán telefonon nézze át, ha sok az ilyen, NY-tétel: a 50 transform átfésülése
- [x] 14. `subjuntivo-disparadores` (B1 core, SUBJ) új lecke → KÉSZ 2026-09-19, commit cbf7333, audit 0/0, jest 1241/1241, tsc 0, lint 0 error; 32 item (12 choice, 1 match, 12 form, 7 why), tábla 12 kiváltó × 3 ige, glossza nincs
  minta: «Quiero que ___ (tú) conmigo.» = trabajes | «Dudo que ___ (él) razón.» = tenga | «Ojalá ___ (yo) suerte.» = tenga
  megjegyzés: az audit rendhagyó-ige térképe (IRREGULAR_FORMS) a venir/decir/llover kötőmód-alakjait nem ismeri, 4 választós item szabályos igére cserélve; ha a kötőmód-leckék rendhagyó alakjai kellenek a választósokba, az audit-térkép bővítése kód (/kimacha_nyelvtan)
- [x] 15. `temporales-subjuntivo` (B1 core, SUBJ) új lecke → KÉSZ 2026-09-19, commit 11d1eba, audit 0/0, jest 1252/1252, tsc 0, lint 0 error; 31 item (12 choice, 1 match, 12 form, 6 why), glossza nincs
  minta: «Cuando ___ (tú) la tarea, te llamo.» = termines | «Antes de que ___ (ustedes) con el amigo, esperamos aquí.» = hablen | «Después de ___, vamos al cine.» = comer
- [x] 16. `subjuntivo-imperfecto` (B2 core, SUBJ) új lecke, transform nélkül → KÉSZ 2026-09-19, commit 7b8564a, audit 0/0, jest 1263/1263, tsc 0, lint 0 error; 31 item (12 choice, 1 match, 12 form, 6 why)
  minta: «Quería que ___ (tú) a la fiesta.» = vinieras | «Habla como si ___ (él) todo.» = supiera | «Si ___ (yo) tiempo, iría.» = tuviera
  TenseId-bővítés kell: subjuntivo-imperfecto (transform-drill), /kimacha_nyelvtan
  ⚠ minta-hiba (kód-igény, /kimacha_nyelvtan): a glossary 14 ragozott alakot tart (vinieras, supiera, tuviera, iría…), mert az audit IRREGULAR_FORMS térképe a kötőmód-alakokat nem ismeri; ugyanez a 9. lépésben (9 alak). A glossza nem erre való. Kell: IRREGULAR_FORMS bővítése subj. presente + imperfecto + condicional alakokkal, utána a két lecke glossary-ja üríthető.
- B-SOR (core) KÉSZ: 16/16. C-sor (V1→V2 átírás, 11 lecke):
- [x] 17. `quien-a-quien` (A1 core-plus) V1→V2 → KÉSZ 2026-09-19, commit b1b0b00, audit 0/0, jest 1273/1273, tsc 0, lint 0 error; 31 item (12 choice, 1 match, 12 form, 6 why), glossza 29→35 (ragozott alakok: amamos, aman…, ugyanaz a minta-hiba, mint a 16. lépésnél)
  minta: «A ti ___ amo.» = te | «Yo te ___ un libro.» = doy | «A él ___ escribo un mensaje.» = le | form: él/ella/usted × objeto indirecto → le
- [x] 18. `sustantivo-numero` (A1 core) V1→V2 → KÉSZ 2026-09-19, commit 9438b55, audit 0/0, jest 1283/1283, tsc 0, lint 0 error; 32 item (12 choice, 1 match, 12 form, 7 why), glossza 17→15
  minta: «___ día es muy largo.» = El | «Escucho ___ canciones en español.» = las | form: el lápiz → los lápices
- [x] 19. `adjetivo-concordancia` (A1 exam) V1→V2 → KÉSZ 2026-09-19, commit 5911f88, audit 0/0, jest 1293/1293, tsc 0, lint 0 error; 32 item (12 choice, 1 match, 12 form, 7 why), glossza 15 változatlan
  minta: «La casa es muy ___.» = bonita | «Ella es ___ y trabaja en un hospital.» = española | form: rojo → rojas (nő többes)
- [x] 20. `articulos-genero` (A1 exam) V1→V2 → KÉSZ 2026-09-19, commit faa39ee, audit 0/0, jest 1303/1303, tsc 0, lint 0 error; 32 item (12 choice, 1 match, 12 form, 7 why), glossza 3 változatlan
  minta: «___ perro es grande.» = El | «___ día es muy largo.» = El | form: el libro → los libros
- [x] 21. `clases-de-palabras` (A1 exam, 16 item) V1→V2 → KÉSZ 2026-09-19, commit 9390cc9, audit 0/0, jest 1313/1313, tsc 0, lint 0 error; 36 item (12 choice, 4 mark, 1 match, 12 form, 7 why), glossza: necesito/limpia ki, rápidamente be
  minta: «El ___ es grande.» = perro | «Ella canta ___.» = bien | form: rápido → rápidamente
- [x] 22. `demostrativos` (A1 full) V1→V2 → KÉSZ 2026-09-19, commit 56b2d96, audit 0/0, jest 1323/1323, tsc 0, lint 0 error; 32 item (12 choice, 1 match, 12 form, 7 why), glossza üres; a semleges esto/eso/aquello a body-ban, nem a táblában
  minta: «___ libro es mío, lo tengo aquí.» = Este | «___ montañas están muy lejos.» = Aquellas | form: ese × nő egyes → esa
- [~] 23. `interrogativos` (A1 full) V1→V2 → kész, ha: ugyanaz
- [ ] 24. `negacion` (A1 full) V1→V2 → kész, ha: ugyanaz
- [ ] 25. `posesivos` (A1 full) V1→V2 → kész, ha: ugyanaz
- [ ] 26. `por-para` (A2 core) V1→V2 → kész, ha: ugyanaz
- [ ] 27. `perfecto` (A2 full, igeidős) V1→V2 + 50 transform presente → perfecto → kész, ha: ugyanaz
- …és a probe szerinti folytatás: D exam 17, E full 5.

Adag = 3 lecke; adag után push a `nyelvtan` ágra, első adag után PR.
7. adag (20-22) pusholva 2026-09-19, PR #25 frissül.
6. adag (16-19) pusholva 2026-09-19, PR #25 frissül.
5. adag (13-15) pusholva 2026-09-19, PR #25 frissül.
4. adag (10-12) pusholva 2026-09-19, PR #25 frissül.
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

---

## BRIEF finales-causales (11. lépés, B-sor, B2 core, ÚJ lecke)

Worktree gyökér: `/home/kalmi/ai/kimacha-wt-eget-nyelvtan`. Minden `node` / `npx` innen fut.
Ág: `nyelvtan` (már ki van checkolva, ne válts ágat).

### Olvasd el ELŐBB (ebben a sorrendben, csak a releváns szeletet)
1. `/home/kalmi/ai/ai-workspace/kimacha/LECKE-SEMA.md` teljes (blokkok, `form`/`match`/`why`, a választós `wrong` stílusa „miért ez az alak, és mi lenne, ha a másik", `speak` «...»).
2. `lib/grammar/lessonTypes.ts` teljes (V2 séma).
3. `lib/grammar/syllabus.ts` 565-571. sor (id `finales-causales`, level B2, unit `b2-oraciones`, title ×4 „Cél és ok: para que, porque, ya que", blurb: para que + kötőmód, porque + kijelentő).
4. `scripts/audit-games.mjs` fejléc-kommentje (P1/P2; szint-szabály: csak A0..B2 szó vagy glossza).
5. Minta V2 lecke: `data/games/grammar/es/estilo-indirecto.json` (előző lépés, B2, szerkezet-téma nem-ige táblával); ha nem létezik, `condicionales-tipo2-3.json`. Egyet olvass, teljesen.
6. Regisztráció mintája: `lib/games/content/es.ts`, a `grammarEsEstiloIndirecto` (vagy `CondicionalesTipo23`) import + lista-elem.

### Feladat: új lecke, `data/games/grammar/es/finales-causales.json`
Szerkezet-téma: NINCS transform, NINCS `tense`.
A. **Fej:** `schema: 2`, `topic: "finales-causales"`, `level: "B2"`, `title` a syllabus 4 nyelvén 1:1.
B. **`body`:**
   - `text` (1 bekezdés): mire jó: indokolni és célt mondani; „miért?" és „mi végett?" a beszédben és írásban; a kötőszó dönti el, kijelentő vagy kötőmód jön.
   - `list` vagy `usage` a szabálypontok mind példával (`ExamplePair`: `es` + `tr` ×4), legalább: (1) **cél, azonos alany: para + infinitivo** (estudio para aprobar); (2) **cél, más alany: para que + subjuntivo** (te lo digo para que lo sepas; presente de subj. jelen/jövő főmondat után, imperfecto de subj. múlt után: se lo dije para que lo supiera); (3) további cél-kötők: a fin de que (formális), a que (mozgás-igék után: vengo a que me ayudes), csak említve; (4) **ok, kijelentő: porque, ya que, puesto que, como (mondat elején), es que (beszélt)** (no salgo porque llueve; como llueve, no salgo; es que no tengo tiempo); (5) **por + főnév / infinitivo** (por el tráfico, por no estudiar); (6) **tagadott ok: no porque + subjuntivo** (no lo hago porque quiera, sino porque debo); (7) **por qué / porque / porqué / por que** helyesírás: kérdés, ok, főnév (el porqué), ritka.
   - `table` id-val: `nexos` (sorok: para que, a fin de que, porque, ya que, puesto que, como, es que, por, no porque, para + inf.; oszlopok: kötőszó, mód (subjuntivo / indicativo / infinitivo), példa); a `form` itemek erre hivatkoznak (a `verb` mező = a table header 2. oszlopának `es` értéke, nem-ige tábla, mint a `preposiciones-basicas.json`-ban). Tanulság a 8. lépésből: az `auditFormItem` minden form-item person/verb/answer hármasát egy konkrét tábla-cellához köti, ezért a táblának legalább 12 különböző, a form itemekkel egyező cellát kell adnia; ha kell, bővítsd a sorokat, ne a form itemeket ismételd. `accept` mezőt form itemre NE tegyél (inert).
   - `contrast`: para + infinitivo vs para que + subjuntivo (azonos vs más alany), és porque + indicativo vs para que + subjuntivo (ok vs cél).
   - `tip` (1): „ok = már megtörtént vagy tény → kijelentő; cél = még nem történt meg → kötőmód", ez a két kötő 90%-át eldönti.
   Minden `Lang4` mind a 4 nyelven (hu/en/es/de), üres string tilos (P1).
C. **`speak` ×4**, a spanyol szakaszok «...» közt.
D. **`glossary`:** csak akkor, ha egy tartalmas szó B2-ig nincs tanítva és nem cserélhető (audit P1). Kártyák: `node ~/ai/.claude/skills/eget-nyelvtan/probe.cjs --cards B2 /tmp/claude-1000/cards-B2.tsv` („id<TAB>es<TAB>szint"); a példamondatok szavait ebből választod.
E. **Itemek:** 12 választós (`sentence` `___`-nal: hol a kötőszó, hol a kötőszó utáni ige módja; opciók pl. para que / porque / para, vagy sepa / sabe / saber, `correct`, minden rossz opción `wrong` ×4 LECKE-SEMA stílusban); 1 `match` (5-6 pár: kötőszó ↔ mód vagy funkció); 12 `form` a `nexos` table id-ra (mondat + (ige) → helyes módú alak a kötőszó szerint, pl. `Te llamo para que (saber, tú) ___ la hora.` → `sepas`, `No salgo porque (llover) ___.` → `llueve`, `Vine para (ver, yo) ___ a mi madre.` → `ver`); 6-8 `why` (3 szabály-név, pl. „cél = subjuntivo", „ok = indicativo", „azonos alany = infinitivo", a rossz opciókon `wrong` ×4).
F. **Mondat-szabályok:** legfeljebb 12 szó (P2); természetes, anyanyelvű így mondja; csak A0-B2 szavak vagy glossza; csak spanyol forrásmondat (K1); Mexikó-spanyol (ustedes).
G. **Regisztráció:** `lib/games/content/es.ts`: import (`grammarEsFinalesCausales`) + lista-elem a B2 leckék mellé. Semmi más kód.
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
`git add data/games/grammar/es/finales-causales.json lib/games/content/es.ts` (+ a teszt, ha nyúltál hozzá), majd:
```
feat(grammar): finales-causales lesson (nyelvtan)

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

## BRIEF marcadores-discursivos (12. lépés, B-sor, C1 core, ÚJ lecke)

Worktree gyökér: `/home/kalmi/ai/kimacha-wt-eget-nyelvtan`. Minden `node` / `npx` innen fut.
Ág: `nyelvtan` (már ki van checkolva, ne válts ágat).

### Olvasd el ELŐBB (ebben a sorrendben, csak a releváns szeletet)
1. `/home/kalmi/ai/ai-workspace/kimacha/LECKE-SEMA.md` teljes (blokkok, `form`/`match`/`why`, a választós `wrong` stílusa „miért ez az alak, és mi lenne, ha a másik", `speak` «...»).
2. `lib/grammar/lessonTypes.ts` teljes (V2 séma).
3. `lib/grammar/syllabus.ts` 615-621. sor (id `marcadores-discursivos`, level C1, unit `c1-matices`, title ×4 „Szövegkötő elemek", blurb: sin embargo, por lo tanto, en cuanto a).
4. `scripts/audit-games.mjs` fejléc-kommentje (P1/P2; szint-szabály: csak A0..C1 szó vagy glossza).
5. Minta V2 lecke: `data/games/grammar/es/finales-causales.json` (előző lépés, B2, kötőszó-téma nem-ige táblával); ha nem létezik, `estilo-indirecto.json`. Egyet olvass, teljesen.
6. Regisztráció mintája: `lib/games/content/es.ts`, a `grammarEsFinalesCausales` (vagy `EstiloIndirecto`) import + lista-elem.

### Feladat: új lecke, `data/games/grammar/es/marcadores-discursivos.json`
Szerkezet-téma: NINCS transform, NINCS `tense`. Ez az első C1 lecke, ugyanaz a séma, csak a szókincs-plafon C1.
A. **Fej:** `schema: 2`, `topic: "marcadores-discursivos"`, `level: "C1"`, `title` a syllabus 4 nyelvén 1:1.
B. **`body`:**
   - `text` (1 bekezdés): mire jó: hosszabb beszéd és írás összefűzése (érvelés, e-mail, vizsga-fogalmazás, prezentáció); a kötőelem mondja meg, hogy a következő mondat ellentmond, következik, példáz vagy témát vált.
   - `list` vagy `usage` a szabálypontok mind példával (`ExamplePair`: `es` + `tr` ×4), csoportonként 2-4 elem, legalább: (1) **ellentét**: sin embargo, no obstante, en cambio, aun así, ahora bien; (2) **következmény**: por lo tanto, por consiguiente, así que (beszélt), de ahí que + subjuntivo; (3) **hozzáadás / erősítés**: además, asimismo, es más, incluso; (4) **rendezés**: en primer lugar, por un lado / por otro (lado), por último, en resumen, en definitiva; (5) **téma-váltás / vonatkozás**: en cuanto a, respecto a, por lo que se refiere a; (6) **magyarázat / példa**: es decir, o sea (beszélt), por ejemplo, en concreto; (7) írásjel és hely: a legtöbb mondat elején vesszővel, egyesek mondat belsejében is (sin embargo, además); a beszélt regiszter (o sea, así que, bueno, pues) és az írott (no obstante, por consiguiente, asimismo) különbsége.
   - `table` id-val: `marcadores` (sorok: legalább 12 kötőelem; oszlopok: kötőelem, funkció (ellentét / következmény / hozzáadás / rendezés / vonatkozás / magyarázat), regiszter (írott / beszélt / mindkettő), példa); a `form` itemek erre hivatkoznak (a `verb` mező = a table header 2. oszlopának `es` értéke, nem-ige tábla, mint a `preposiciones-basicas.json`-ban). Tanulság: az `auditFormItem` minden form-item person/verb/answer hármasát egy konkrét tábla-cellához köti, ezért a táblának legalább 12 különböző, a form itemekkel egyező cellát kell adnia; ha kell, bővítsd a sorokat, ne a form itemeket ismételd. `accept` mezőt form itemre NE tegyél (inert).
   - `contrast`: sin embargo vs en cambio (megszorítás vs szembeállítás), és es decir vs o sea (írott vs beszélt, azonos jelentés).
   - `tip` (1): egy bekezdésben egy funkcióból egy kötőelem; a „además, además, además" a magyar „és, és, és" megfelelője.
   Minden `Lang4` mind a 4 nyelven (hu/en/es/de), üres string tilos (P1).
C. **`speak` ×4**, a spanyol szakaszok «...» közt.
D. **`glossary`:** csak akkor, ha egy tartalmas szó C1-ig nincs tanítva és nem cserélhető (audit P1). Kártyák: `node ~/ai/.claude/skills/eget-nyelvtan/probe.cjs --cards C1 /tmp/claude-1000/cards-C1.tsv` („id<TAB>es<TAB>szint"); a példamondatok szavait ebből választod; a kötőelemek maguk, ha nincs kártyájuk, glosszába.
E. **Itemek:** 12 választós (`sentence` `___`-nal: a kötőelem helye, két rövid tagmondat között; opciók 3-4 kötőelem különböző funkcióból, `correct` az egyetlen, ami a viszonyt (ellentét / következmény / stb.) helyesen adja, minden rossz opción `wrong` ×4 LECKE-SEMA stílusban: milyen viszonyt mondana az a kötőelem); 1 `match` (5-6 pár: kötőelem ↔ funkció); 12 `form` a `marcadores` table id-ra (mondat + (funkció, regiszter) → kötőelem, pl. `Llovía mucho; ___ (ellentét, írott), salimos.` → `sin embargo`, `No estudió; ___ (következmény, beszélt) no aprobó.` → `así que`); 6-8 `why` (3 szabály-név, pl. „ellentét = sin embargo", „következmény = por lo tanto", „téma-váltás = en cuanto a", a rossz opciókon `wrong` ×4).
F. **Mondat-szabályok:** legfeljebb 12 szó (P2); természetes, anyanyelvű így mondja; csak A0-C1 szavak vagy glossza; csak spanyol forrásmondat (K1); Mexikó-spanyol (ustedes).
G. **Regisztráció:** `lib/games/content/es.ts`: import (`grammarEsMarcadoresDiscursivos`) + lista-elem a lista végére (első C1 lecke). Semmi más kód.
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
`git add data/games/grammar/es/marcadores-discursivos.json lib/games/content/es.ts` (+ a teszt, ha nyúltál hozzá), majd:
```
feat(grammar): marcadores-discursivos lesson (nyelvtan)

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

## BRIEF subjuntivo-presente-forma (13. lépés, B2-sor subjuntivo, B1 core, ÚJ lecke, 50 transform)

Worktree gyökér: `/home/kalmi/ai/kimacha-wt-eget-nyelvtan`. Minden `node` / `npx` innen fut.
Ág: `nyelvtan` (már ki van checkolva, ne válts ágat).

### Olvasd el ELŐBB (ebben a sorrendben, csak a releváns szeletet)
1. `/home/kalmi/ai/ai-workspace/kimacha/NYELVTAN.md` NY1-NY4 + NY10 szakasz (transform item adatformátum 1:1, `wordIds` szabály, ÉSZAK-CSILLAG).
2. `/home/kalmi/ai/ai-workspace/kimacha/LECKE-SEMA.md` teljes (blokkok, `form`/`match`/`why`, a választós `wrong` stílusa, `speak` «...»).
3. `lib/grammar/lessonTypes.ts` teljes (V2 séma, `TransformItem`, `tense`, `TENSE_IDS`: a `subjuntivo-presente` benne van).
4. `lib/grammar/syllabus.ts` 445-451. sor (id `subjuntivo-presente-forma`, level B1, unit `b1-subjuntivo`, title ×4 „Kötőmód jelen: az alakok", blurb: hable, coma, viva: a fordított végződések).
5. `scripts/audit-games.mjs` fejléc-kommentje (P1/P2; szint-szabály: csak A0..B1 szó vagy glossza) + `auditTenseField` (576. sor körül).
6. Minta ige-lecke transformmal: `data/games/grammar/es/futuro-simple.json` (V2, body + 12 choice + 1 match + 12 form + 7 why + 50 transform + tense). A body-t, 2-2 itemet fajtánként és az utolsó 6 transform itemet olvasd, nem az egészet.
7. Regisztráció mintája: `lib/games/content/es.ts`, a `grammarEsFuturoSimple` import + lista-elem.

### Feladat: új lecke, `data/games/grammar/es/subjuntivo-presente-forma.json`
Igeidős téma (`subjuntivo-presente` a `TENSE_IDS`-ben): 50 transform + `tense` minden itemen.
A. **Fej:** `schema: 2`, `topic: "subjuntivo-presente-forma"`, `level: "B1"`, `title` a syllabus 4 nyelvén 1:1.
B. **`body`:**
   - `text` (1 bekezdés): mire jó: a kötőmód alakja nélkül nincs kérés, kívánság, kétely, „hogy…"-mondat; ez a lecke csak az alakokat tanítja, a kiváltó szerkezeteket a `subjuntivo-disparadores` lecke.
   - `list` vagy `usage` a szabálypontok mind példával (`ExamplePair`: `es` + `tr` ×4), legalább: (1) képzés: presente yo-alak, -o le, „fordított" végződés: -ar → -e/-es/-e/-emos/-éis/-en, -er/-ir → -a/-as/-a/-amos/-áis/-an; (2) a yo-alakból örökölt rendhagyó tő: tengo → tenga, vengo → venga, pongo → ponga, hago → haga, digo → diga, salgo → salga, conozco → conozca, veo → vea; (3) tőhangváltó: e→ie, o→ue a presente mintájára (quiera, pueda), az -ir igéknél nosotros/vosotros is vált (durmamos, sintamos, pidamos); (4) hat teljesen rendhagyó: ser (sea), estar (esté), ir (vaya), haber (haya), saber (sepa), dar (dé), memória-sor; (5) helyesírás: -car/-gar/-zar → -que/-gue/-ce (busque, llegue, empiece); (6) alak és a mai használat: parancs usted/ustedes, tagadó parancs tú (no hables), Ojalá + subjuntivo, que + subjuntivo („hadd…", que pase).
   - `table` id-val: `subjuntivo` (sorok: hablar, comer, vivir, tener, hacer, ser, ir, saber, poder, pedir; oszlopok: yo, tú, él/ella, nosotros, ustedes); a `form` itemek erre hivatkoznak (a `verb` mező = infinitivo, ige-tábla mint a `futuro-simple.json`-ban; az `auditFormItem` minden form-hármast egy tábla-cellához köt, ezért a 12 form item 12 különböző cellát kér).
   - `contrast`: hablas vs hables (kijelentő vs kötőmód, ugyanaz a személy), és come vs coma (tú-parancs kijelentő alak vs usted-parancs kötőmód).
   - `tip` (1): „ha a yo-alak rendhagyó, a kötőmód is az; ha a yo-alak szabályos, a kötőmód is".
   Minden `Lang4` mind a 4 nyelven (hu/en/es/de), üres string tilos (P1).
C. **`speak` ×4**, a spanyol szakaszok «...» közt.
D. **`glossary`:** csak akkor, ha egy tartalmas szó B1-ig nincs tanítva és nem cserélhető (audit P1). Transform itemben glossza NEM helyettesíti a `wordIds`-t.
E. **Itemek:** 12 választós (`sentence` `___`-nal, opciók kötőmód / kijelentő / rossz tő, `correct`, minden rossz opción `wrong` ×4); 1 `match` (5-6 pár: infinitivo ↔ rendhagyó kötőmód-alak); 12 `form` a `subjuntivo` table id-ra; 6-8 `why` (3 szabály-név, pl. „yo-alak tő", „fordított végződés", „hat rendhagyó", a rossz opciókon `wrong` ×4); **50 `transform`** (lent); **`tense`** minden itemen (choice, match, form, why, transform): `{ "from": "presente", "to": "subjuntivo-presente" }`.
F. **A 50 transform item recept:** irány presente (kijelentő mellékmondat) → subjuntivo-presente (kötőmódú mellékmondat). A mellékmondat szavai változatlanok, csak (a) a főmondati kiváltó cserélődik és (b) a mellékmondat igéje megy kötőmódba. Kiváltó-párok (a prompt bal fele → az answer bal fele), egyenletesen forgatva, egy pár legfeljebb 8 itemben: «Creo que» → «No creo que»; «Es verdad que» → «No es verdad que»; «Sé que» → «Dudo que»; «Está claro que» → «No está claro que»; «Es seguro que» → «Es posible que»; «Veo que» → «Espero que»; «Dice que» → «Quiere que»; «Pienso que» → «No pienso que». Példa: «Creo que viene mañana.» → «No creo que venga mañana.»; «Sé que tienes tiempo.» → «Dudo que tengas tiempo.»; «Es verdad que comen aquí.» → «No es verdad que coman aquí.»
   - 10 ige × 5 mondat, a `subjuntivo` tábla 10 igéje (hablar, comer, vivir, tener, hacer, ser, ir, saber, poder, pedir), vegyes személyek a mellékmondatban (yo/tú/él-ella/nosotros/ustedes), kb. 30 kijelentő, 10 tagadó mellékmondat («Creo que no viene.» → «No creo que no venga.» kerülendő, inkább: «Sé que no tienes tiempo.» → «Dudo que no tengas tiempo.» csak ha természetes; ha nem, kijelentő mellékmondat + tagadó kiváltó), 10 kérdő («¿Crees que viene mañana?» → «¿No crees que venga mañana?»).
   - `prompt.es ≠ answer` minden itemen. `accept`: a kitett-névmásos / névmás-nélküli mellékmondat-változat.
   - `wordIds`: a prompt ÉS az answer MINDEN tartalmas szava (a kiváltó igéje/mellékneve is: creer, verdad, saber, dudar, claro, seguro, posible, ver, esperar, decir, querer, pensar) kártya-id STRINGKÉNT; funkciószó csak ha van kártyája. Ragozott alakkal egyező kártya, ha van; különben a szótári alak kártyája. **Csak A0 + A1 + A2 + B1** kártya (a lecke `level` B1). Megengedett kártyák: `node ~/ai/.claude/skills/eget-nyelvtan/probe.cjs --cards B1 /tmp/claude-1000/cards-B1.tsv` („id<TAB>es<TAB>szint"). Ebből választasz és **írás előtt node-dal ellenőrzöd** (minden transform item minden wordId-je benne van-e a tsv-ben, és a prompt + answer minden tartalmas szava le van-e fedve). Nem fejből. Ha egy kiváltónak nincs kártyája: másik kiváltó-párt használsz a listából; ha 5-nél kevesebb pár marad, a jelentésbe „kártya-kérés: <szó> B1".
   - Mondat-szabályok: legfeljebb 12 szó (P2); természetes, anyanyelvű így mondja; **ismétlés-plafon:** egy tartalmas szó (a 10 ige és a kiváltók kivételével) legfeljebb 3-szor az 50 itemben; egy kiváltó-pár legfeljebb 8-szor; csak spanyol forrásmondat (K1).
G. **Regisztráció:** `lib/games/content/es.ts`: import (`grammarEsSubjuntivoPresenteForma`) + lista-elem a B1 leckék mellé. Semmi más kód.
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
`git add data/games/grammar/es/subjuntivo-presente-forma.json lib/games/content/es.ts` (+ a teszt, ha nyúltál hozzá), majd:
```
feat(grammar): subjuntivo-presente-forma lesson, 50 transform (nyelvtan)

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```
Nem pusholsz.

### Jelentés (max 10 sor)
- fájl + item-számok fajtánként (choice/match/form/why/transform)
- a 4 kapu utolsó sora
- commit hash
- 5 minta `prompt.es → answer`
- glossza-szavak egy sorban; kártya-kérés sorok, ha voltak; elakadás egy mondatban, ha volt
Nincs diff, nincs fájltartalom, nincs narratíva.

---

## BRIEF subjuntivo-disparadores (14. lépés, B2-sor subjuntivo, B1 core, ÚJ lecke)

Worktree gyökér: `/home/kalmi/ai/kimacha-wt-eget-nyelvtan`. Minden `node` / `npx` innen fut.
Ág: `nyelvtan` (már ki van checkolva, ne válts ágat).

### Olvasd el ELŐBB (ebben a sorrendben, csak a releváns szeletet)
1. `/home/kalmi/ai/ai-workspace/kimacha/LECKE-SEMA.md` teljes (blokkok, `form`/`match`/`why`, a választós `wrong` stílusa, `speak` «...»).
2. `lib/grammar/lessonTypes.ts` teljes (V2 séma, `tense`).
3. `lib/grammar/syllabus.ts` 452-458. sor (id `subjuntivo-disparadores`, level B1, unit `b1-subjuntivo`, title ×4 „Mi hívja elő a kötőmódot", blurb: akarat, érzelem, kétely, tagadott vélemény).
4. `scripts/audit-games.mjs` fejléc-kommentje (P1/P2; szint-szabály: csak A0..B1 szó vagy glossza) + `auditTenseField` (576. sor körül).
5. Minta V2 lecke: `data/games/grammar/es/subjuntivo-presente-forma.json` (előző lépés, ugyanez a téma-család; a body-t és 2-2 itemet olvass fajtánként, a transform itemeket nem). Ha nem létezik, `finales-causales.json`.
6. Regisztráció mintája: `lib/games/content/es.ts`, a `grammarEsSubjuntivoPresenteForma` import + lista-elem.

### Feladat: új lecke, `data/games/grammar/es/subjuntivo-disparadores.json`
Szerkezet-téma a kötőmódról: NINCS transform (az alak-drill az előző leckében van), de `tense` minden itemen: `{ "from": "presente", "to": "subjuntivo-presente" }` (a jelvény miatt).
A. **Fej:** `schema: 2`, `topic: "subjuntivo-disparadores"`, `level: "B1"`, `title` a syllabus 4 nyelvén 1:1.
B. **`body`:**
   - `text` (1 bekezdés): mire jó: tudni, mikor kell a kötőmód; a főmondat igéje vagy kifejezése „hívja elő" a mellékmondatban; az alakokat a `subjuntivo-presente-forma` lecke adja, itt a mikor a tárgy.
   - `list` vagy `usage` a szabálypontok mind példával (`ExamplePair`: `es` + `tr` ×4), csoportonként, legalább: (1) **akarat, kérés, tanács + que**: querer, pedir, necesitar, preferir, recomendar, es necesario/importante que (quiero que vengas); (2) **érzelem, értékelés + que**: me alegro de que, me gusta que, es una pena que, es bueno/malo/mejor que, tener miedo de que (me alegro de que estés aquí); (3) **kétely, tagadott vélemény**: dudar que, no creer que, no pensar que, no es verdad que, es posible / probable que, quizás / tal vez (+ subj. vagy ind.), (no creo que sea tarde); DE creer que, pensar que, es verdad que, está claro que + kijelentő; (4) **ojalá (que) + subjuntivo**, mindig (ojalá llueva); (5) **azonos alany → infinitivo, nem que**: quiero comer (nem: quiero que yo coma), me alegro de estar aquí; (6) **személytelen kifejezések**: es + melléknév + que: kijelentő, ha bizonyosság (es verdad / evidente / seguro que + ind.), kötőmód, ha értékelés vagy bizonytalanság (es posible / normal / raro / importante que + subj.).
   - `table` id-val: `disparadores`, ÚGY ÉPÍTVE, hogy a form itemek mondat-gyártók legyenek (tanulság a 12. lépésből: az `auditFormItem` a form item `person`-jét a tábla row[0]-jához, a `verb`-jét a header egy col≥1 oszlopához, az `answer`-t a cellához köti). Ezért: **row[0] = kiváltó + személy** (pl. «Quiero que (tú)», «Creo que (ella)», «Es posible que (nosotros)», «Dudo que (ustedes)», «Me alegro de que (tú)», «Es verdad que (él)», «Ojalá (yo)», «No creo que (ellos)», «Prefiero que (usted)», «Está claro que (tú)», «Es importante que (nosotros)», «Sé que (ella)»: 12 sor, a 4 csoport és mindkét mód vegyesen), **oszlopok = 3 ige infinitivóban** (pl. venir, tener, hacer), **cella = a helyes alak** (kötőmód vagy kijelentő a kiváltó szerint: vengas / viene / hagamos…). Így 36 cella, a 12 form item 12 különbözőt kér, minden form `verb` = az oszlop infinitivója, `person` = a row[0] szövege 1:1. `accept` mezőt form itemre NE tegyél (inert).
   - `contrast`: creo que viene vs no creo que venga (állított vs tagadott vélemény), és quiero comer vs quiero que comas (azonos vs más alany).
   - `tip` (1): a „que" után akkor kötőmód, ha a főmondat NEM tényként közli a mellékmondatot (akar, érez, kételkedik); ha tényként (tud, lát, mond, hisz), kijelentő.
   Minden `Lang4` mind a 4 nyelven (hu/en/es/de), üres string tilos (P1).
C. **`speak` ×4**, a spanyol szakaszok «...» közt.
D. **`glossary`:** csak akkor, ha egy tartalmas szó B1-ig nincs tanítva és nem cserélhető (audit P1). Kártyák: `node ~/ai/.claude/skills/eget-nyelvtan/probe.cjs --cards B1 /tmp/claude-1000/cards-B1.tsv` („id<TAB>es<TAB>szint"); a példamondatok szavait ebből választod.
E. **Itemek:** 12 választós (`sentence` `___`-nal: a mellékmondat igéje, opciók kötőmód / kijelentő / infinitivo, `correct`, minden rossz opción `wrong` ×4 LECKE-SEMA stílusban: melyik kiváltó-csoport, és mi lenne, ha a másik), a 4 csoportból 3-3, plusz 2 azonos-alany csali (infinitivo a helyes) és 1-2 „creo que + ind." csali; 1 `match` (5-6 pár: kiváltó ↔ csoport vagy mód); 12 `form` a `disparadores` table id-ra (a `person` = egy row[0] kiváltó, a `verb` = egy oszlop-ige, a prompt-mondat a kiváltóval és egy lyukkal, pl. person «Quiero que (tú)», verb venir → `vengas`; person «Creo que (ella)», verb tener → `tiene`; person «Es posible que (nosotros)», verb hacer → `hagamos`); 6-8 `why` (3 szabály-név, pl. „akarat = subjuntivo", „tagadott vélemény = subjuntivo", „bizonyosság = indicativo", „azonos alany = infinitivo", a rossz opciókon `wrong` ×4). `tense` minden itemen.
F. **Mondat-szabályok:** legfeljebb 12 szó (P2); természetes, anyanyelvű így mondja; csak A0-B1 szavak vagy glossza; csak spanyol forrásmondat (K1); Mexikó-spanyol (ustedes).
G. **Regisztráció:** `lib/games/content/es.ts`: import (`grammarEsSubjuntivoDisparadores`) + lista-elem a `subjuntivo-presente-forma` után. Semmi más kód.
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
`git add data/games/grammar/es/subjuntivo-disparadores.json lib/games/content/es.ts` (+ a teszt, ha nyúltál hozzá), majd:
```
feat(grammar): subjuntivo-disparadores lesson (nyelvtan)

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

## BRIEF temporales-subjuntivo (15. lépés, B2-sor subjuntivo, B1 core, ÚJ lecke)

Worktree gyökér: `/home/kalmi/ai/kimacha-wt-eget-nyelvtan`. Minden `node` / `npx` innen fut.
Ág: `nyelvtan` (már ki van checkolva, ne válts ágat).

### Olvasd el ELŐBB (ebben a sorrendben, csak a releváns szeletet)
1. `/home/kalmi/ai/ai-workspace/kimacha/LECKE-SEMA.md` teljes (blokkok, `form`/`match`/`why`, a választós `wrong` stílusa, `speak` «...»).
2. `lib/grammar/lessonTypes.ts` teljes (V2 séma, `tense`).
3. `lib/grammar/syllabus.ts` 466-472. sor (id `temporales-subjuntivo`, level B1, unit `b1-subjuntivo`, title ×4 „Cuando + kötőmód", blurb: jövőbeli időhatározó: cuando llegues, no llegas).
4. `scripts/audit-games.mjs` fejléc-kommentje (P1/P2; szint-szabály: csak A0..B1 szó vagy glossza) + `auditTenseField` (576. sor körül).
5. Minta V2 lecke: `data/games/grammar/es/subjuntivo-disparadores.json` (előző lépés, ugyanez a téma-család, kiváltó-sor × ige-oszlop tábla). Teljesen olvasd, a tábla-felépítést ez mutatja.
6. Regisztráció mintája: `lib/games/content/es.ts`, a `grammarEsSubjuntivoDisparadores` import + lista-elem.

### Feladat: új lecke, `data/games/grammar/es/temporales-subjuntivo.json`
Szerkezet-téma a kötőmódról: NINCS transform, de `tense` minden itemen: `{ "from": "presente", "to": "subjuntivo-presente" }`.
A. **Fej:** `schema: 2`, `topic: "temporales-subjuntivo"`, `level: "B1"`, `title` a syllabus 4 nyelvén 1:1.
B. **`body`:**
   - `text` (1 bekezdés): mire jó: „amikor majd…", „amint…", „mielőtt…" jövőre nézve; terv, ígéret, feltétel időben; a magyar jövő idő helyén a spanyol kötőmód áll az időhatározói mellékmondatban.
   - `list` vagy `usage` a szabálypontok mind példával (`ExamplePair`: `es` + `tr` ×4), legalább: (1) **cuando + presente (indicativo)** = szokás, általános vagy múlt (cuando llego a casa, ceno; cuando era niño…); (2) **cuando + presente de subjuntivo** = jövő (cuando llegue a casa, te llamo / te llamaré), a főmondat futuro, ir a + inf., imperativo vagy presente; (3) ugyanígy jövőre kötőmód: **en cuanto, tan pronto como, hasta que, después de que, mientras (jövő)**, példa mindegyikre; (4) **antes de que + subjuntivo mindig** (jövőre és múltra is: antes de que llegues / antes de que llegara), csak említve a múlt; (5) **azonos alany → infinitivo**: antes de salir, después de comer, hasta terminar (nem: antes de que yo salga); (6) **kérdésben a cuándo + indicativo** (¿cuándo llegas?), mert nem időhatározói mellékmondat; (7) desde que + indicativo mindig (desde que vivo aquí).
   - `table` id-val: `temporales`, a 14. lépés mintájára: **row[0] = időkötő + személy + jelentés-jelölés** (pl. «Cuando (tú, jövő)», «Cuando (yo, szokás)», «En cuanto (ella, jövő)», «Hasta que (nosotros, jövő)», «Antes de que (ustedes)», «Después de que (él, jövő)», «Tan pronto como (tú, jövő)», «Mientras (yo, szokás)», «Cuando (ellos, jövő)», «Desde que (yo)», «Mientras (nosotros, jövő)», «Cuando (ella, szokás)»: 12 sor, kötőmód és kijelentő vegyesen), **oszlopok = 3 ige infinitivóban** (pl. llegar, tener, salir), **cella = a helyes alak** (llegues / llego / tenga / tenemos…). 36 cella, a 12 form item 12 különbözőt kér, `verb` = az oszlop infinitivója, `person` = a row[0] szövege 1:1. `accept` mezőt form itemre NE tegyél (inert).
   - `contrast`: cuando llego (szokás, indicativo) vs cuando llegue (jövő, subjuntivo), és antes de salir (azonos alany) vs antes de que salgas (más alany).
   - `tip` (1): ha a magyar mondatban a „majd" odaillik („amikor majd hazaérek"), a spanyolban kötőmód.
   Minden `Lang4` mind a 4 nyelven (hu/en/es/de), üres string tilos (P1).
C. **`speak` ×4**, a spanyol szakaszok «...» közt.
D. **`glossary`:** csak akkor, ha egy tartalmas szó B1-ig nincs tanítva és nem cserélhető (audit P1). Kártyák: `node ~/ai/.claude/skills/eget-nyelvtan/probe.cjs --cards B1 /tmp/claude-1000/cards-B1.tsv` („id<TAB>es<TAB>szint"); a példamondatok szavait ebből választod.
E. **Itemek:** 12 választós (`sentence` `___`-nal: az időhatározói mellékmondat igéje, opciók kötőmód / kijelentő / futuro (csali: cuando llegaré ✗), `correct`, minden rossz opción `wrong` ×4 LECKE-SEMA stílusban), kb. 7 jövő (subj.) + 3 szokás/múlt (ind.) + 2 azonos-alany infinitivo; 1 `match` (5-6 pár: kötő + kontextus ↔ mód); 12 `form` a `temporales` table id-ra (person = row[0], verb = oszlop-ige, mondat a kötővel és lyukkal, pl. person «Cuando (tú, jövő)», verb llegar → `llegues`; person «Cuando (yo, szokás)», verb llegar → `llego`; person «Antes de que (ustedes)», verb salir → `salgan`); 6-8 `why` (3 szabály-név, pl. „jövő → subjuntivo", „szokás → indicativo", „antes de que mindig subjuntivo", „azonos alany → infinitivo", a rossz opciókon `wrong` ×4). `tense` minden itemen.
F. **Mondat-szabályok:** legfeljebb 12 szó (P2); természetes, anyanyelvű így mondja; csak A0-B1 szavak vagy glossza; csak spanyol forrásmondat (K1); Mexikó-spanyol (ustedes).
G. **Regisztráció:** `lib/games/content/es.ts`: import (`grammarEsTemporalesSubjuntivo`) + lista-elem a `subjuntivo-disparadores` után. Semmi más kód.
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
`git add data/games/grammar/es/temporales-subjuntivo.json lib/games/content/es.ts` (+ a teszt, ha nyúltál hozzá), majd:
```
feat(grammar): temporales-subjuntivo lesson (nyelvtan)

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

## BRIEF subjuntivo-imperfecto (16. lépés, B2-sor subjuntivo, B2 core, ÚJ lecke)

Worktree gyökér: `/home/kalmi/ai/kimacha-wt-eget-nyelvtan`. Minden `node` / `npx` innen fut.
Ág: `nyelvtan` (már ki van checkolva, ne válts ágat).

### Olvasd el ELŐBB (ebben a sorrendben, csak a releváns szeletet)
1. `/home/kalmi/ai/ai-workspace/kimacha/LECKE-SEMA.md` teljes (blokkok, `form`/`match`/`why`, a választós `wrong` stílusa, `speak` «...»).
2. `lib/grammar/lessonTypes.ts` teljes (V2 séma, `TENSE_IDS`: a subjuntivo-imperfecto NINCS benne).
3. `lib/grammar/syllabus.ts` 523-529. sor (id `subjuntivo-imperfecto`, level B2, unit `b2-subjuntivo`, title ×4 „Kötőmód múlt (imperfecto de subjuntivo)", blurb: hablara / hablase: múltbeli akarat és feltétel).
4. `scripts/audit-games.mjs` fejléc-kommentje (P1/P2; szint-szabály: csak A0..B2 szó vagy glossza).
5. Minta V2 ige-lecke: `data/games/grammar/es/subjuntivo-presente-forma.json` (B1, ige-tábla ige-sorokkal és személy-oszlopokkal, 12 form; a body-t és 2-2 itemet olvass fajtánként, a transform itemeket NEM, ebben a leckében nincs transform).
6. Regisztráció mintája: `lib/games/content/es.ts`, a `grammarEsCondicionalesTipo23` import + lista-elem (B2).

### Feladat: új lecke, `data/games/grammar/es/subjuntivo-imperfecto.json`
Az imperfecto de subjuntivo NINCS a `TENSE_IDS`-ben: NINCS transform, NINCS `tense` (a PLAN-ban külön sor: „TenseId-bővítés kell: subjuntivo-imperfecto, /kimacha_nyelvtan"; te nem bővíted).
A. **Fej:** `schema: 2`, `topic: "subjuntivo-imperfecto"`, `level: "B2"`, `title` a syllabus 4 nyelvén 1:1.
B. **`body`:**
   - `text` (1 bekezdés): mire jó: a kötőmód múltja; ugyanazok a kiváltók (akarat, érzelem, kétely, cél, idő), csak a főmondat múltban vagy feltételesben áll; plusz az irreális feltétel (si tuviera) és az udvarias kérés (quisiera).
   - `list` vagy `usage` a szabálypontok mind példával (`ExamplePair`: `es` + `tr` ×4), legalább: (1) **képzés**: indefinido ellos-alak, -ron le, + -ra/-ras/-ra/-ramos/-rais/-ran (hablaron → hablara; comieron → comiera); a nosotros-alakon ékezet (habláramos); (2) **a -se alak** (hablase, comiese) egyenértékű, írott és spanyolországi; a -ra a beszélt, Mexikóban gyakorlatilag csak -ra; (3) **rendhagyók az indefinidóból ingyen**: tuvieron → tuviera, fueron → fuera (ser és ir), hicieron → hiciera, dijeron → dijera, pudieron → pudiera, supieron → supiera, quisieron → quisiera, pusieron → pusiera, vinieron → viniera, estuvieron → estuviera, hubo → hubiera; (4) **igeidő-egyeztetés**: múlt vagy feltételes főmondat + que → imperfecto de subj. (quería que vinieras; me gustaría que vinieras; le pedí que me ayudara); (5) **irreális feltétel**: si + imperfecto de subj., condicional (si tuviera tiempo, iría), csak említve, részletesen a `condicionales-tipo2-3` leckében; (6) **como si + imperfecto de subj.** mindig (habla como si supiera todo); (7) **udvarias kérés / kívánság**: quisiera un café; ojalá pudiera ir.
   - `table` id-val: `imperfecto-subj` (sorok: hablar, comer, vivir, tener, ser/ir, hacer, poder, saber, querer, decir; oszlopok: yo, tú, él/ella, nosotros, ustedes; a -ra alak), a `form` itemek erre hivatkoznak (`verb` = infinitivo, ige-tábla mint a `subjuntivo-presente-forma.json`-ban; az `auditFormItem` minden form-hármast egy tábla-cellához köt, a 12 form item 12 különböző cellát kér). `accept` mezőt form itemre NE tegyél (inert); a -se alakot a body említi, a form a -ra alakot kéri.
   - `contrast`: quiero que vengas vs quería que vinieras (jelen vs múlt főmondat), és si tengo, voy vs si tuviera, iría (valós vs irreális feltétel).
   - `tip` (1): „ellos indefinido, -ron le, -ra rá": dijeron → dije- → dijera; ha az indefinidót tudod, ez ingyen van.
   Minden `Lang4` mind a 4 nyelven (hu/en/es/de), üres string tilos (P1).
C. **`speak` ×4**, a spanyol szakaszok «...» közt.
D. **`glossary`:** csak akkor, ha egy tartalmas szó B2-ig nincs tanítva és nem cserélhető (audit P1). Kártyák: `node ~/ai/.claude/skills/eget-nyelvtan/probe.cjs --cards B2 /tmp/claude-1000/cards-B2.tsv` („id<TAB>es<TAB>szint"); a példamondatok szavait ebből választod.
E. **Itemek:** 12 választós (`sentence` `___`-nal: a mellékmondat igéje, opciók imperfecto de subj. / presente de subj. / imperfecto de ind. / indefinido, `correct`, minden rossz opción `wrong` ×4 LECKE-SEMA stílusban), kb. 6 igeidő-egyeztetés + 3 como si / ojalá / quisiera + 3 si-feltétel; 1 `match` (5-6 pár: indefinido ellos-alak ↔ imperfecto de subj. yo-alak); 12 `form` az `imperfecto-subj` table id-ra (person = személy, verb = infinitivo, mondat a kiváltóval és lyukkal, pl. `Quería que (venir, tú) ___ a la fiesta.` → `vinieras`, `Habla como si (saber, él) ___ todo.` → `supiera`, `Si (poder, nosotros) ___, iríamos.` → `pudiéramos`); 6-8 `why` (3 szabály-név, pl. „múlt főmondat → imperfecto subj.", „como si mindig", „ellos-alakból képzés", a rossz opciókon `wrong` ×4).
F. **Mondat-szabályok:** legfeljebb 12 szó (P2); természetes, anyanyelvű így mondja; csak A0-B2 szavak vagy glossza; csak spanyol forrásmondat (K1); Mexikó-spanyol (ustedes, -ra alak).
G. **Regisztráció:** `lib/games/content/es.ts`: import (`grammarEsSubjuntivoImperfecto`) + lista-elem a B2 leckék elejére (a `condicionales-tipo2-3` elé, syllabus-sorrend). Semmi más kód.
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
`git add data/games/grammar/es/subjuntivo-imperfecto.json lib/games/content/es.ts` (+ a teszt, ha nyúltál hozzá), majd:
```
feat(grammar): subjuntivo-imperfecto lesson (nyelvtan)

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

## BRIEF quien-a-quien V1→V2 (17. lépés, C-sor, A1 core-plus, ÁTÍRÁS)

Worktree gyökér: `/home/kalmi/ai/kimacha-wt-eget-nyelvtan`. Minden `node` / `npx` innen fut.
Ág: `nyelvtan` (már ki van checkolva, ne válts ágat).

### Olvasd el ELŐBB (ebben a sorrendben, csak a releváns szeletet)
1. `/home/kalmi/ai/ai-workspace/kimacha/LECKE-SEMA.md` teljes, különösen a §7 (V1→V2 átírás: mi marad, mi hova megy), a blokkok, `form`/`match`/`why`, a választós `wrong` stílusa „miért ez az alak, és mi lenne, ha a másik", `speak` «...».
2. `lib/grammar/lessonTypes.ts` teljes (V2 séma).
3. `lib/grammar/syllabus.ts` 262-268. sor (id `quien-a-quien`, level A1, title ×4 „Ki kinek: te amo, me das", blurb: a végződés mondja meg, ki cselekszik, a névmás azt, kivel).
4. `scripts/audit-games.mjs` fejléc-kommentje (P1/P2; szint-szabály: csak A0..A1 szó vagy glossza).
5. Minta V2 A1 lecke: `data/games/grammar/es/pronombres-od.json` (A1, névmás-téma, body + 12 choice + 2 match + 8 form + 7 why). Teljesen olvasd, ez a formátum-minta.
6. A célfájl: `data/games/grammar/es/quien-a-quien.json` (V1: `topic`, `level` A1, `title`, `rule` ~1.5K, `more` ~1.9K, `glossary` 31 szó, 12 választós item). Teljesen olvasd, minden szövege átmegy a V2-be.
7. Regisztráció: `lib/games/content/es.ts` már importálja, nem kell új sor.

### Feladat: V1 → V2 átírás, ugyanabban a fájlban
Nem igeidős téma: NINCS transform, NINCS `tense`.
A. **Fej:** `schema: 2`, a `topic` id (`quien-a-quien`) NEM változik (a `game_progress` kulcsa), `level` és `title` a syllabus szerint (a V1 `title` marad, ha egyezik).
B. **`body`:** a V1 `rule` + `more` szövege blokkokba megy, SEMMI nem vész el (1:1 tartalom, átrendezve): `text` (1 bekezdés, mire jó: az ige végződése = ki csinálja, a névmás = kivel/kinek; a magyar „szeretlek" két spanyol szó), `list` vagy `usage` a szabálypontok mind példával (`ExamplePair`: `es` + `tr` ×4; a V1 szövegében lévő minden szabály és példa ide), `table` id-val (`quien`: sorok = a 6 személy, oszlopok = alany-végződés (-o/-as/-a/-amos/-an, „yo/tú/él…"), tárgy-névmás (me/te/lo-la/nos/los-las), részes-névmás (me/te/le/nos/les); a `form` itemek erre hivatkoznak: `verb` = a header 2. oszlopának `es` értéke, nem-ige tábla, mint a `preposiciones-basicas.json`-ban; az `auditFormItem` minden form-hármast egy tábla-cellához köt, ezért a 12 form item 12 különböző cellát kér), `contrast` (te amo vs me amas: ki szeret kit; le doy vs lo veo: részes vs tárgy), `tip` (1, a V1 `more`-ból, ha van ilyen; ha nincs: „a névmás az ige ELŐTT áll, a végződés az ige VÉGÉN: két helyen két információ"). Minden `Lang4` mind a 4 nyelven (hu/en/es/de), üres string tilos (P1).
C. **`speak` ×4**, a spanyol szakaszok «...» közt (LECKE-SEMA §3).
D. **`glossary`:** a V1 glossary marad; csak akkor szűkül, ha egy szó A1-ig már tanított (audit P2 szólhat), csak akkor bővül, ha új példamondat kéri. Kártyák: `node ~/ai/.claude/skills/eget-nyelvtan/probe.cjs --cards A1 /tmp/claude-1000/cards-A1.tsv`.
E. **Itemek:** a meglévő **12 választós marad** (a `sentence` és `correct` változatlan; a `wrong` minden rossz opción átírva a LECKE-SEMA stílusra ×4 nyelven: miért nem az, mi lenne, ha; a V1 item egyéb mezői, ha vannak (`rule`, `hint`), a `wrong`-ba vagy a `why` itemekbe mennek, nem vesznek el); **1-2 `match`** (5-6 pár: alak ↔ ki-kinek); **12 `form`** a `quien` table id-ra (mondat + (személy, szerep) → alak, pl. `___ (tárgy, te) veo mañana.` → `te`, `Ana ___ (részes, nekem) da el libro.` → `me`); **6-8 `why`** (3 szabály-név, pl. „végződés = alany", „tárgy-névmás", „részes-névmás", a rossz opciókon `wrong` ×4).
F. **Mondat-szabályok:** legfeljebb 12 szó (P2); természetes, anyanyelvű így mondja; csak A0-A1 szavak vagy glossza; csak spanyol forrásmondat (K1); Mexikó-spanyol.
G. Ha valamelyik teszt fix darabszámot állít (V1/V2 számláló: `grep -rn "schema" lib/__tests__/*.test.ts lib/grammar/__tests__/*.test.ts`), frissítsd a számot, semmi mást. Ha egy jest-teszt olyan fájlban piros, ami nem a te leckéd (pl. `lib/games/*.ts`), NEM javítod a kódot: piros állapottal jelentesz, melyik teszt és miért.

### Kapu (sorban, mind a worktree gyökeréből)
```
node scripts/audit-games.mjs 2>&1 | tail -15     # 0 P1, cél 0 P2
npx jest 2>&1 | tail -8                           # zöld
npx tsc --noEmit 2>&1 | tail -3                   # 0 hiba
npx expo lint 2>&1 | tail -5                      # 0 error
```
Piros → javítasz és újra, legfeljebb 3-szor, aztán piros állapottal jelentesz (NEM commitolsz pirosat).

### Commit (csak zöld kapuval)
`git add data/games/grammar/es/quien-a-quien.json` (+ a teszt, ha nyúltál hozzá), majd:
```
refactor(grammar): quien-a-quien V2 séma (nyelvtan)

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```
Nem pusholsz.

### Jelentés (max 10 sor)
- fájl + item-számok fajtánként (choice/match/form/why)
- a 4 kapu utolsó sora
- commit hash
- 3 minta választós `sentence` (+ `correct`), ebből 1 új `form`
- glossza-változás egy sorban; elakadás egy mondatban, ha volt
Nincs diff, nincs fájltartalom, nincs narratíva.

---

## BRIEF sustantivo-numero V1→V2 (18. lépés, C-sor, A1 core, ÁTÍRÁS)

Worktree gyökér: `/home/kalmi/ai/kimacha-wt-eget-nyelvtan`. Minden `node` / `npx` innen fut.
Ág: `nyelvtan` (már ki van checkolva, ne válts ágat).

### Olvasd el ELŐBB (ebben a sorrendben, csak a releváns szeletet)
1. `/home/kalmi/ai/ai-workspace/kimacha/LECKE-SEMA.md` teljes, különösen a §7 (V1→V2 átírás), a blokkok, `form`/`match`/`why`, a választós `wrong` stílusa, `speak` «...».
2. `lib/grammar/lessonTypes.ts` teljes (V2 séma).
3. `lib/grammar/syllabus.ts` 170-176. sor (id `sustantivo-numero`, level A1, title ×4 „Főnév: nem és többes szám", blurb: -o hím, -a nő, és hogyan lesz belőle többes szám).
4. `scripts/audit-games.mjs` fejléc-kommentje (P1/P2; szint-szabály: csak A0..A1 szó vagy glossza).
5. Minta V2 átírt lecke: `data/games/grammar/es/quien-a-quien.json` (előző lépés, V1→V2 átírás, nem-ige táblával). Teljesen olvasd, ez a formátum-minta.
6. A célfájl: `data/games/grammar/es/sustantivo-numero.json` (V1: `topic`, `level` A1, `title`, `rule` ~1.4K, `more` ~1.5K, `glossary` 17 szó, 12 választós item). Teljesen olvasd, minden szövege átmegy a V2-be.
7. Regisztráció: `lib/games/content/es.ts` már importálja, nem kell új sor.

### Feladat: V1 → V2 átírás, ugyanabban a fájlban
Nem igeidős téma: NINCS transform, NINCS `tense`.
A. **Fej:** `schema: 2`, a `topic` id (`sustantivo-numero`) NEM változik, `level` és `title` a syllabus szerint.
B. **`body`:** a V1 `rule` + `more` szövege blokkokba megy, SEMMI nem vész el (1:1 tartalom, átrendezve): `text` (1 bekezdés, mire jó: a főnév neme és száma minden névelőt, melléknevet, névmást magával húz), `list` vagy `usage` a szabálypontok mind példával (`ExamplePair`: `es` + `tr` ×4; a V1 minden szabálya és példája ide: -o/-a, -ción/-sión/-dad/-tad nőnem, -ma görög hímnem (el problema, el día, la mano), -e és mássalhangzó vegyes; többes: magánhangzó + s, mássalhangzó + es, -z → -ces, hangsúly-változás (lección → lecciones), változatlan (el lunes / los lunes)), `table` id-val (`plural`: sorok = 10-12 főnév (libro, casa, ciudad, lápiz, lección, lunes, problema, mano, mes, examen…), oszlopok = névelő + egyes, névelő + többes; a `form` itemek erre hivatkoznak: `verb` = a header 2. oszlopának `es` értéke, nem-ige tábla; az `auditFormItem` minden form-hármast egy tábla-cellához köt, ezért a 12 form item 12 különböző cellát kér), `contrast` (el problema vs la casa: -a nem mindig nőnem; el lunes vs los lunes: alak azonos, névelő dönt), `tip` (1, a V1 `more`-ból, ha van; ha nincs: „a főnevet mindig a névelőjével tanuld: el mapa, la foto"). Minden `Lang4` mind a 4 nyelven, üres string tilos (P1).
C. **`speak` ×4**, a spanyol szakaszok «...» közt.
D. **`glossary`:** a V1 glossary marad; szűkül, ha egy szó A1-ig tanított, bővül, ha új példamondat kéri. Kártyák: `node ~/ai/.claude/skills/eget-nyelvtan/probe.cjs --cards A1 /tmp/claude-1000/cards-A1.tsv`.
E. **Itemek:** a meglévő **12 választós marad** (`sentence` és `correct` változatlan; a `wrong` minden rossz opción átírva LECKE-SEMA stílusra ×4; egyéb V1 item-mező a `wrong`-ba vagy `why`-ba, nem vész el); **1 `match`** (5-6 pár: egyes ↔ többes vagy főnév ↔ névelő); **12 `form`** a `plural` table id-ra (egyes → többes névelővel, pl. `la ciudad → ___` → `las ciudades`, `el lápiz → ___` → `los lápices`); **6-8 `why`** (3 szabály-név, pl. „-o hím / -a nő", „-dad nőnem", „mássalhangzó + es", „-z → -ces", a rossz opciókon `wrong` ×4).
F. **Mondat-szabályok:** legfeljebb 12 szó (P2); természetes; csak A0-A1 szavak vagy glossza; csak spanyol forrásmondat (K1); Mexikó-spanyol.
G. Ha valamelyik teszt fix darabszámot állít (V1/V2 számláló), frissítsd a számot, semmi mást. Ha egy jest-teszt olyan fájlban piros, ami nem a te leckéd, NEM javítod a kódot: piros állapottal jelentesz, melyik teszt és miért.

### Kapu (sorban, mind a worktree gyökeréből)
```
node scripts/audit-games.mjs 2>&1 | tail -15     # 0 P1, cél 0 P2
npx jest 2>&1 | tail -8                           # zöld
npx tsc --noEmit 2>&1 | tail -3                   # 0 hiba
npx expo lint 2>&1 | tail -5                      # 0 error
```
Piros → javítasz és újra, legfeljebb 3-szor, aztán piros állapottal jelentesz (NEM commitolsz pirosat).

### Commit (csak zöld kapuval)
`git add data/games/grammar/es/sustantivo-numero.json` (+ a teszt, ha nyúltál hozzá), majd:
```
refactor(grammar): sustantivo-numero V2 séma (nyelvtan)

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```
Nem pusholsz.

### Jelentés (max 10 sor)
- fájl + item-számok fajtánként (choice/match/form/why)
- a 4 kapu utolsó sora
- commit hash
- 3 minta (2 választós `sentence` + `correct`, 1 új `form`)
- glossza-változás egy sorban; elakadás egy mondatban, ha volt
Nincs diff, nincs fájltartalom, nincs narratíva.

---

## BRIEF adjetivo-concordancia V1→V2 (19. lépés, C-sor, A1 exam, ÁTÍRÁS)

Worktree gyökér: `/home/kalmi/ai/kimacha-wt-eget-nyelvtan`. Minden `node` / `npx` innen fut.
Ág: `nyelvtan` (már ki van checkolva, ne válts ágat).

### Olvasd el ELŐBB (ebben a sorrendben, csak a releváns szeletet)
1. `/home/kalmi/ai/ai-workspace/kimacha/LECKE-SEMA.md` teljes, különösen a §7 (V1→V2 átírás), a blokkok, `form`/`match`/`why`, a választós `wrong` stílusa, `speak` «...».
2. `lib/grammar/lessonTypes.ts` teljes (V2 séma).
3. `lib/grammar/syllabus.ts` 184-190. sor (id `adjetivo-concordancia`, level A1, title ×4 „Melléknév-egyeztetés", blurb: a melléknév a főnév nemét és számát veszi fel, és mögé kerül).
4. `scripts/audit-games.mjs` fejléc-kommentje (P1/P2; szint-szabály: csak A0..A1 szó vagy glossza).
5. Minta V2 átírt lecke: `data/games/grammar/es/sustantivo-numero.json` (előző lépés, V1→V2, nem-ige táblával); ha még V1, `quien-a-quien.json`. Egyet olvass, teljesen.
6. A célfájl: `data/games/grammar/es/adjetivo-concordancia.json` (V1: `rule` ~1.6K, `more` ~1.4K, `glossary` 10 szó, 12 választós item, itemenként `sentence`, `options`, `correct`, `wrong`, `why`, `examples`). Teljesen olvasd, minden szövege átmegy a V2-be.
7. Regisztráció: `lib/games/content/es.ts` már importálja, nem kell új sor.

### Feladat: V1 → V2 átírás, ugyanabban a fájlban
Nem igeidős téma: NINCS transform, NINCS `tense`.
A. **Fej:** `schema: 2`, a `topic` id NEM változik, `level` és `title` a syllabus szerint.
B. **`body`:** a V1 `rule` + `more` szövege blokkokba megy, SEMMI nem vész el (1:1 tartalom, átrendezve): `text` (1 bekezdés, mire jó), `list` vagy `usage` a szabálypontok mind példával (`ExamplePair`: `es` + `tr` ×4; a V1 minden szabálya és példája ide: -o/-a/-os/-as négy alak; -e és mássalhangzó két alak (grande/grandes, azul/azules); nemzetiség-melléknév mássalhangzóra 4 alak (español/española); helye a főnév után, kivéve bueno/malo/grande (buen, mal, gran a főnév előtt); mucho/poco egyeztet, muy nem), `table` id-val (`concordancia`: sorok = 8-12 melléknév (rojo, grande, azul, español, bueno, feliz, trabajador, joven, inteligente, mexicano…), oszlopok = hím egyes, nő egyes, hím többes, nő többes; a `form` itemek erre hivatkoznak: `verb` = a header 2. oszlopának `es` értéke, nem-ige tábla; az `auditFormItem` minden form-hármast egy tábla-cellához köt, ezért a 12 form item 12 különböző cellát kér), `contrast` (un coche rojo vs una casa roja: nem; un chico grande vs un gran chico: hely és jelentés), `tip` (1). Minden `Lang4` mind a 4 nyelven, üres string tilos (P1).
C. **`speak` ×4**, a spanyol szakaszok «...» közt.
D. **`glossary`:** a V1 glossary marad; szűkül, ha egy szó A1-ig tanított, bővül, ha új példamondat kéri. Kártyák: `node ~/ai/.claude/skills/eget-nyelvtan/probe.cjs --cards A1 /tmp/claude-1000/cards-A1.tsv`.
E. **Itemek:** a meglévő **12 választós marad** (`sentence`, `options`, `correct`, `examples` változatlan; a `wrong` minden rossz opción átírva LECKE-SEMA stílusra ×4; a V1 item `why` mezője a V2 sémában ha nem létezik választós itemen, a szövege a `wrong`-ba vagy a `why` itemekbe megy, nem vész el); **1 `match`** (5-6 pár: főnév ↔ egyeztetett melléknév); **12 `form`** a `concordancia` table id-ra (főnév + melléknév alapalak → egyeztetett alak, pl. `las casas (rojo) → ___` → `rojas`, `los chicos (feliz) → ___` → `felices`); **6-8 `why`** (3 szabály-név, pl. „-o/-a négy alak", „-e két alak", „főnév után", „buen/gran előtte", a rossz opciókon `wrong` ×4).
F. **Mondat-szabályok:** legfeljebb 12 szó (P2); természetes; csak A0-A1 szavak vagy glossza; csak spanyol forrásmondat (K1); Mexikó-spanyol (carro, nem coche, ha új mondatot írsz; a meglévő V1 mondatok maradnak).
G. Ha valamelyik teszt fix darabszámot állít, frissítsd a számot, semmi mást. Ha egy jest-teszt olyan fájlban piros, ami nem a te leckéd, NEM javítod a kódot: piros állapottal jelentesz, melyik teszt és miért.

### Kapu (sorban, mind a worktree gyökeréből)
```
node scripts/audit-games.mjs 2>&1 | tail -15     # 0 P1, cél 0 P2
npx jest 2>&1 | tail -8                           # zöld
npx tsc --noEmit 2>&1 | tail -3                   # 0 hiba
npx expo lint 2>&1 | tail -5                      # 0 error
```
Piros → javítasz és újra, legfeljebb 3-szor, aztán piros állapottal jelentesz (NEM commitolsz pirosat).

### Commit (csak zöld kapuval)
`git add data/games/grammar/es/adjetivo-concordancia.json` (+ a teszt, ha nyúltál hozzá), majd:
```
refactor(grammar): adjetivo-concordancia V2 séma (nyelvtan)

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```
Nem pusholsz.

### Jelentés (max 10 sor)
- fájl + item-számok fajtánként (choice/match/form/why)
- a 4 kapu utolsó sora
- commit hash
- 3 minta (2 választós `sentence` + `correct`, 1 új `form`)
- glossza-változás egy sorban; elakadás egy mondatban, ha volt
Nincs diff, nincs fájltartalom, nincs narratíva.

---

## BRIEF articulos-genero V1→V2 (20. lépés, C-sor, A1 exam, ÁTÍRÁS)

Worktree gyökér: `/home/kalmi/ai/kimacha-wt-eget-nyelvtan`. Minden `node` / `npx` innen fut.
Ág: `nyelvtan` (már ki van checkolva, ne válts ágat).

### Olvasd el ELŐBB (ebben a sorrendben, csak a releváns szeletet)
1. `/home/kalmi/ai/ai-workspace/kimacha/LECKE-SEMA.md` teljes, különösen a §7 (V1→V2 átírás), a blokkok, `form`/`match`/`why`, a választós `wrong` stílusa, `speak` «...».
2. `lib/grammar/lessonTypes.ts` teljes (V2 séma).
3. `lib/grammar/syllabus.ts` 177-183. sor (id `articulos-genero`, level A1, title ×4 „Névelők: el, la, un, una", blurb: határozott és határozatlan névelő, nemmel egyeztetve).
4. `scripts/audit-games.mjs` fejléc-kommentje (P1/P2; szint-szabály: csak A0..A1 szó vagy glossza).
5. Minta V2 átírt lecke: `data/games/grammar/es/adjetivo-concordancia.json` (előző lépés, V1→V2, nem-ige táblával); ha még V1, `sustantivo-numero.json`. Egyet olvass, teljesen.
6. A célfájl: `data/games/grammar/es/articulos-genero.json` (V1: `rule` ~1.1K, `more` ~1.7K, `glossary` 3 szó, 12 választós item, itemenként `sentence`, `options`, `correct`, `wrong`, `why`, `examples`). Teljesen olvasd, minden szövege átmegy a V2-be.
7. Regisztráció: `lib/games/content/es.ts` már importálja, nem kell új sor.

### Feladat: V1 → V2 átírás, ugyanabban a fájlban
Nem igeidős téma: NINCS transform, NINCS `tense`.
A. **Fej:** `schema: 2`, a `topic` id NEM változik, `level` és `title` a syllabus szerint.
B. **`body`:** a V1 `rule` + `more` szövege blokkokba megy, SEMMI nem vész el (1:1 tartalom, átrendezve): `text` (1 bekezdés, mire jó: a névelő a főnév nemét és határozottságát mondja, minden főnév előtt dönteni kell), `list` vagy `usage` a szabálypontok mind példával (`ExamplePair`: `es` + `tr` ×4; a V1 minden szabálya és példája ide: el/la/los/las és un/una/unos/unas; nem-szabályok (-o hím, -a nő, -ción/-dad nő, -ma hím, kivételek: el día, la mano, el mapa, la foto); el + hangsúlyos a- nőnem (el agua, el aula, de: las aguas); határozott vs határozatlan (ismert vs új); mikor nincs névelő (foglalkozás: soy médico; hay + határozatlan); a + el = al, de + el = del), `table` id-val (`articulos`: sorok = 10-12 főnév (libro, casa, día, mano, agua, problema, ciudad, mapa, foto, lección, lunes, clase), oszlopok = határozott egyes, határozott többes, határozatlan egyes; a `form` itemek erre hivatkoznak: `verb` = a header 2. oszlopának `es` értéke, nem-ige tábla; az `auditFormItem` minden form-hármast egy tábla-cellához köt, ezért a 12 form item 12 különböző cellát kér), `contrast` (el agua vs las aguas: hangsúlyos a-; un libro vs el libro: új vs ismert), `tip` (1). Minden `Lang4` mind a 4 nyelven, üres string tilos (P1).
C. **`speak` ×4**, a spanyol szakaszok «...» közt.
D. **`glossary`:** a V1 glossary marad; szűkül, ha egy szó A1-ig tanított, bővül, ha új példamondat kéri. Kártyák: `node ~/ai/.claude/skills/eget-nyelvtan/probe.cjs --cards A1 /tmp/claude-1000/cards-A1.tsv`.
E. **Itemek:** a meglévő **12 választós marad** (`sentence`, `options`, `correct`, `examples` változatlan; a `wrong` minden rossz opción átírva LECKE-SEMA stílusra ×4; a V1 item `why` mezőjének szövege a `wrong`-ba vagy a `why` itemekbe megy, nem vész el); **1 `match`** (5-6 pár: főnév ↔ névelő); **12 `form`** az `articulos` table id-ra (főnév → névelős alak, pl. `___ agua (határozott egyes)` → `el agua`, `___ ciudades (határozott többes)` → `las ciudades`, `___ problema (határozatlan)` → `un problema`); **6-8 `why`** (3 szabály-név, pl. „-o hím / -a nő", „hangsúlyos a- → el", „-ma hím", „ismert = el, új = un", a rossz opciókon `wrong` ×4).
F. **Mondat-szabályok:** legfeljebb 12 szó (P2); természetes; csak A0-A1 szavak vagy glossza; csak spanyol forrásmondat (K1); Mexikó-spanyol, ha új mondatot írsz; a meglévő V1 mondatok maradnak.
G. Ha valamelyik teszt fix darabszámot állít, frissítsd a számot, semmi mást. Ha egy jest-teszt olyan fájlban piros, ami nem a te leckéd, NEM javítod a kódot: piros állapottal jelentesz, melyik teszt és miért.

### Kapu (sorban, mind a worktree gyökeréből)
```
node scripts/audit-games.mjs 2>&1 | tail -15     # 0 P1, cél 0 P2
npx jest 2>&1 | tail -8                           # zöld
npx tsc --noEmit 2>&1 | tail -3                   # 0 hiba
npx expo lint 2>&1 | tail -5                      # 0 error
```
Piros → javítasz és újra, legfeljebb 3-szor, aztán piros állapottal jelentesz (NEM commitolsz pirosat).

### Commit (csak zöld kapuval)
`git add data/games/grammar/es/articulos-genero.json` (+ a teszt, ha nyúltál hozzá), majd:
```
refactor(grammar): articulos-genero V2 séma (nyelvtan)

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```
Nem pusholsz.

### Jelentés (max 10 sor)
- fájl + item-számok fajtánként (choice/match/form/why)
- a 4 kapu utolsó sora
- commit hash
- 3 minta (2 választós `sentence` + `correct`, 1 új `form`)
- glossza-változás egy sorban; elakadás egy mondatban, ha volt
Nincs diff, nincs fájltartalom, nincs narratíva.

---

## BRIEF clases-de-palabras V1→V2 (21. lépés, C-sor, A1 exam, ÁTÍRÁS, 16 item)

Worktree gyökér: `/home/kalmi/ai/kimacha-wt-eget-nyelvtan`. Minden `node` / `npx` innen fut.
Ág: `nyelvtan` (már ki van checkolva, ne válts ágat).

### Olvasd el ELŐBB (ebben a sorrendben, csak a releváns szeletet)
1. `/home/kalmi/ai/ai-workspace/kimacha/LECKE-SEMA.md` teljes, különösen a §7 (V1→V2 átírás), a blokkok, `form`/`match`/`why`, a választós `wrong` stílusa, `speak` «...».
2. `lib/grammar/lessonTypes.ts` teljes (V2 séma).
3. `lib/grammar/syllabus.ts` 163-169. sor (id `clases-de-palabras`, level A1, title ×4 „Szófajok: mi micsoda", blurb: főnév, ige, melléknév, határozószó: miről ismerni fel, és miért számít).
4. `scripts/audit-games.mjs` fejléc-kommentje (P1/P2; szint-szabály: csak A0..A1 szó vagy glossza).
5. Minta V2 átírt lecke: `data/games/grammar/es/articulos-genero.json` (előző lépés, V1→V2, nem-ige táblával); ha még V1, `adjetivo-concordancia.json`. Egyet olvass, teljesen.
6. A célfájl: `data/games/grammar/es/clases-de-palabras.json` (V1: `rule` ~2.5K, `more` ~1.9K, `glossary` 6 szó, 16 választós item, itemenként `sentence`, `options`, `correct`, `wrong`, `why`, `examples`). Teljesen olvasd, minden szövege átmegy a V2-be.
7. Regisztráció: `lib/games/content/es.ts` már importálja, nem kell új sor.

### Feladat: V1 → V2 átírás, ugyanabban a fájlban
Nem igeidős téma: NINCS transform, NINCS `tense`.
A. **Fej:** `schema: 2`, a `topic` id NEM változik, `level` és `title` a syllabus szerint.
B. **`body`:** a V1 `rule` + `more` szövege blokkokba megy, SEMMI nem vész el (1:1 tartalom, átrendezve): `text` (1 bekezdés, mire jó: a szófaj dönti el, mi egyeztet mivel, mi hova kerül a mondatban, és melyik szótári alakot keresd), `list` vagy `usage` a szabálypontok mind példával (`ExamplePair`: `es` + `tr` ×4; a V1 minden szabálya és példája ide: főnév (névelővel jár, neme és száma van), ige (személy és idő, -ar/-er/-ir szótári alak), melléknév (egyeztet a főnévvel, mögötte áll), határozószó (nem egyeztet, -mente képzés a nőnemű melléknévből: rápida → rápidamente), névmás, elöljáró, kötőszó röviden; a tipikus tévesztés: bueno (melléknév) vs bien (határozószó), mucho (melléknév/határozó) vs muy (csak határozó)), `table` id-val (`derivacion`: sorok = 12 tő (rápido, feliz, tranquilo, fácil, claro, lento, fuerte, triste, seguro, difícil, amable, libre), oszlopok = melléknév (nőnem), határozószó (-mente), főnév (-idad/-eza/-ura, ahol van; ha egy sorhoz nincs természetes főnév, a cella a melléknév hímneme); a `form` itemek erre hivatkoznak: `verb` = a header 2. oszlopának `es` értéke, nem-ige tábla; az `auditFormItem` minden form-hármast egy tábla-cellához köt, ezért a 12 form item 12 különböző cellát kér), `contrast` (bueno vs bien: melléknév vs határozószó; mucho vs muy: mit módosít), `tip` (1). Minden `Lang4` mind a 4 nyelven, üres string tilos (P1).
C. **`speak` ×4**, a spanyol szakaszok «...» közt.
D. **`glossary`:** a V1 glossary marad; szűkül, ha egy szó A1-ig tanított, bővül, ha új példamondat kéri. Kártyák: `node ~/ai/.claude/skills/eget-nyelvtan/probe.cjs --cards A1 /tmp/claude-1000/cards-A1.tsv`.
E. **Itemek:** a meglévő **16 választós marad** (`sentence`, `options`, `correct`, `examples` változatlan; a `wrong` minden rossz opción átírva LECKE-SEMA stílusra ×4; a V1 item `why` mezőjének szövege a `wrong`-ba vagy a `why` itemekbe megy, nem vész el); **1 `match`** (5-6 pár: szó ↔ szófaj); **12 `form`** a `derivacion` table id-ra (mondat + (tő, kért szófaj) → alak, pl. `Ella habla muy ___ (rápido, határozószó).` → `rápidamente`, `Es una chica ___ (feliz, melléknév nőnem).` → `feliz`, `La ___ (tranquilo, főnév) del pueblo me gusta.` → `tranquilidad`); **6-8 `why`** (3 szabály-név, pl. „főnév = névelő + nem", „határozószó nem egyeztet", „-mente a nőneműből", „bien ≠ bueno", a rossz opciókon `wrong` ×4).
F. **Mondat-szabályok:** legfeljebb 12 szó (P2); természetes; csak A0-A1 szavak vagy glossza; csak spanyol forrásmondat (K1); Mexikó-spanyol, ha új mondatot írsz; a meglévő V1 mondatok maradnak; a `derivacion` főnevei (tranquilidad, felicidad…) A1 fölöttiek, ha választós vagy why itemben szerepelnek, glosszába; a form itemeket az audit nem szó-ellenőrzi.
G. Ha valamelyik teszt fix darabszámot állít, frissítsd a számot, semmi mást. Ha egy jest-teszt olyan fájlban piros, ami nem a te leckéd, NEM javítod a kódot: piros állapottal jelentesz, melyik teszt és miért.

### Kapu (sorban, mind a worktree gyökeréből)
```
node scripts/audit-games.mjs 2>&1 | tail -15     # 0 P1, cél 0 P2
npx jest 2>&1 | tail -8                           # zöld
npx tsc --noEmit 2>&1 | tail -3                   # 0 hiba
npx expo lint 2>&1 | tail -5                      # 0 error
```
Piros → javítasz és újra, legfeljebb 3-szor, aztán piros állapottal jelentesz (NEM commitolsz pirosat).

### Commit (csak zöld kapuval)
`git add data/games/grammar/es/clases-de-palabras.json` (+ a teszt, ha nyúltál hozzá), majd:
```
refactor(grammar): clases-de-palabras V2 séma (nyelvtan)

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```
Nem pusholsz.

### Jelentés (max 10 sor)
- fájl + item-számok fajtánként (choice/match/form/why)
- a 4 kapu utolsó sora
- commit hash
- 3 minta (2 választós `sentence` + `correct`, 1 új `form`)
- glossza-változás egy sorban; elakadás egy mondatban, ha volt
Nincs diff, nincs fájltartalom, nincs narratíva.

---

## BRIEF demostrativos V1→V2 (22. lépés, C-sor, A1 full, ÁTÍRÁS)

Worktree gyökér: `/home/kalmi/ai/kimacha-wt-eget-nyelvtan`. Minden `node` / `npx` innen fut.
Ág: `nyelvtan` (már ki van checkolva, ne válts ágat).

### Olvasd el ELŐBB (ebben a sorrendben, csak a releváns szeletet)
1. `/home/kalmi/ai/ai-workspace/kimacha/LECKE-SEMA.md` teljes, különösen a §7 (V1→V2 átírás), a blokkok, `form`/`match`/`why`, a választós `wrong` stílusa, `speak` «...».
2. `lib/grammar/lessonTypes.ts` teljes (V2 séma).
3. `lib/grammar/syllabus.ts` 240-246. sor (id `demostrativos`, level A1, title ×4 „Mutató névmások: este, ese, aquel", blurb: három távolság: itt, ott, amott).
4. `scripts/audit-games.mjs` fejléc-kommentje (P1/P2; szint-szabály: csak A0..A1 szó vagy glossza).
5. Minta V2 átírt lecke: `data/games/grammar/es/clases-de-palabras.json` (előző lépés, V1→V2, nem-ige táblával); ha még V1, `articulos-genero.json`. Egyet olvass, teljesen.
6. A célfájl: `data/games/grammar/es/demostrativos.json` (V1: `rule` ~1.2K, `more` ~2.1K, `glossary` üres, 12 választós item, itemenként `sentence`, `options`, `correct`, `wrong`, `why`, `examples`). Teljesen olvasd, minden szövege átmegy a V2-be.
7. Regisztráció: `lib/games/content/es.ts` már importálja, nem kell új sor.

### Feladat: V1 → V2 átírás, ugyanabban a fájlban
Nem igeidős téma: NINCS transform, NINCS `tense`.
A. **Fej:** `schema: 2`, a `topic` id NEM változik, `level` és `title` a syllabus szerint.
B. **`body`:** a V1 `rule` + `more` szövege blokkokba megy, SEMMI nem vész el (1:1 tartalom, átrendezve): `text` (1 bekezdés, mire jó: rámutatni, melyikről beszélsz; bolt, étterem, „ezt kérem"), `list` vagy `usage` a szabálypontok mind példával (`ExamplePair`: `es` + `tr` ×4; a V1 minden szabálya és példája ide: este/esta/estos/estas (itt, nálam), ese/esa/esos/esas (ott, nálad), aquel/aquella/aquellos/aquellas (amott, távol); egyeztetés a főnévvel; névmásként önállóan (¿Cuál quieres? Este.), ékezet nélkül a mai helyesírásban; semleges esto/eso/aquello (ismeretlen vagy elvont dolog: ¿Qué es esto?); idő-jelentés: esta semana, ese día, aquellos años), `table` id-val (`demostrativos`: sorok = a 3 távolság + a semleges (este, ese, aquel, esto/eso/aquello), oszlopok = hím egyes, nő egyes, hím többes, nő többes; a `form` itemek erre hivatkoznak: `verb` = a header 2. oszlopának `es` értéke, nem-ige tábla; az `auditFormItem` minden form-hármast egy tábla-cellához köt, ezért a 12 form item 12 különböző cellát kér), `contrast` (este vs ese: nálam vs nálad; esto vs este: nem tudom, mi vs tudom, mi), `tip` (1). Minden `Lang4` mind a 4 nyelven, üres string tilos (P1).
C. **`speak` ×4**, a spanyol szakaszok «...» közt.
D. **`glossary`:** a V1 glossary marad; szűkül, ha egy szó A1-ig tanított, bővül, ha új példamondat kéri. Kártyák: `node ~/ai/.claude/skills/eget-nyelvtan/probe.cjs --cards A1 /tmp/claude-1000/cards-A1.tsv`.
E. **Itemek:** a meglévő **12 választós marad** (`sentence`, `options`, `correct`, `examples` változatlan; a `wrong` minden rossz opción átírva LECKE-SEMA stílusra ×4; a V1 item `why` mezőjének szövege a `wrong`-ba vagy a `why` itemekbe megy, nem vész el); **1 `match`** (5-6 pár: helyzet ↔ mutató); **12 `form`** a `demostrativos` table id-ra (mondat + (távolság, főnév) → alak, pl. `___ (itt) casa es grande.` → `Esta`, `Quiero ___ (ott, többes) zapatos.` → `esos`, `___ (amott, nő többes) montañas son altas.` → `Aquellas`); **6-8 `why`** (3 szabály-név, pl. „este = itt", „ese = nálad", „aquel = távol", „esto = ismeretlen", a rossz opciókon `wrong` ×4).
F. **Mondat-szabályok:** legfeljebb 12 szó (P2); természetes; csak A0-A1 szavak vagy glossza; csak spanyol forrásmondat (K1); Mexikó-spanyol, ha új mondatot írsz; a meglévő V1 mondatok maradnak.
G. Ha valamelyik teszt fix darabszámot állít, frissítsd a számot, semmi mást. Ha egy jest-teszt olyan fájlban piros, ami nem a te leckéd, NEM javítod a kódot: piros állapottal jelentesz, melyik teszt és miért.

### Kapu (sorban, mind a worktree gyökeréből)
```
node scripts/audit-games.mjs 2>&1 | tail -15     # 0 P1, cél 0 P2
npx jest 2>&1 | tail -8                           # zöld
npx tsc --noEmit 2>&1 | tail -3                   # 0 hiba
npx expo lint 2>&1 | tail -5                      # 0 error
```
Piros → javítasz és újra, legfeljebb 3-szor, aztán piros állapottal jelentesz (NEM commitolsz pirosat).

### Commit (csak zöld kapuval)
`git add data/games/grammar/es/demostrativos.json` (+ a teszt, ha nyúltál hozzá), majd:
```
refactor(grammar): demostrativos V2 séma (nyelvtan)

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```
Nem pusholsz.

### Jelentés (max 10 sor)
- fájl + item-számok fajtánként (choice/match/form/why)
- a 4 kapu utolsó sora
- commit hash
- 3 minta (2 választós `sentence` + `correct`, 1 új `form`)
- glossza-változás egy sorban; elakadás egy mondatban, ha volt
Nincs diff, nincs fájltartalom, nincs narratíva.

---

## BRIEF interrogativos V1→V2 (23. lépés, C-sor, A1 full, ÁTÍRÁS)

Worktree gyökér: `/home/kalmi/ai/kimacha-wt-eget-nyelvtan`. Minden `node` / `npx` innen fut.
Ág: `nyelvtan` (már ki van checkolva, ne válts ágat).

### Olvasd el ELŐBB (ebben a sorrendben, csak a releváns szeletet)
1. `/home/kalmi/ai/ai-workspace/kimacha/LECKE-SEMA.md` teljes, különösen a §7 (V1→V2 átírás), a blokkok, `form`/`match`/`why`, a választós `wrong` stílusa, `speak` «...».
2. `lib/grammar/lessonTypes.ts` teljes (V2 séma).
3. `lib/grammar/syllabus.ts` 268-274. sor (id `interrogativos`, level A1, title ×4 „Kérdőszavak", blurb: qué, quién, dónde, cuándo, cómo, cuánto, por qué).
4. `scripts/audit-games.mjs` fejléc-kommentje (P1/P2; szint-szabály: csak A0..A1 szó vagy glossza).
5. Minta V2 átírt lecke: `data/games/grammar/es/demostrativos.json` (előző lépés, V1→V2, nem-ige táblával); ha még V1, `clases-de-palabras.json`. Egyet olvass, teljesen.
6. A célfájl: `data/games/grammar/es/interrogativos.json` (V1: `rule` ~1.1K, `more` ~2K, `glossary` 2 szó, 12 választós item, itemenként `sentence`, `options`, `correct`, `wrong`, `why`, `examples`). Teljesen olvasd, minden szövege átmegy a V2-be.
7. Regisztráció: `lib/games/content/es.ts` már importálja, nem kell új sor.

### Feladat: V1 → V2 átírás, ugyanabban a fájlban
Nem igeidős téma: NINCS transform, NINCS `tense`.
A. **Fej:** `schema: 2`, a `topic` id NEM változik, `level` és `title` a syllabus szerint.
B. **`body`:** a V1 `rule` + `more` szövege blokkokba megy, SEMMI nem vész el (1:1 tartalom, átrendezve): `text` (1 bekezdés, mire jó: kérdezni tudni előbb jön, mint válaszolni; útbaigazítás, ár, idő, személy), `list` vagy `usage` a szabálypontok mind példával (`ExamplePair`: `es` + `tr` ×4; a V1 minden szabálya és példája ide: qué (mi), quién/quiénes (ki), dónde / adónde / de dónde (hol, hova, honnan), cuándo (mikor), cómo (hogyan, milyen), cuánto/a/os/as (mennyi, egyeztet), cuál/cuáles (melyik, választás), por qué (miért, két szó, válasz: porque); ékezet mindig a kérdőszón, kérdésben és közvetett kérdésben is (no sé dónde vive); ¿ ? két kérdőjel; elöljáró a kérdőszó ELÉ (¿Con quién vas? ¿De dónde eres?); qué vs cuál (qué + főnév / meghatározás, cuál + választás: ¿Qué hora es? ¿Cuál es tu nombre?)), `table` id-val (`interrogativos`: sorok = 8-12 kérdőszó (qué, quién, dónde, adónde, cuándo, cómo, cuánto, cuánta, cuántos, cuál, por qué, de dónde), oszlopok = jelentés (hu), példa-kérdés, tipikus válasz; a `form` itemek erre hivatkoznak: `verb` = a header 2. oszlopának `es` értéke, nem-ige tábla; az `auditFormItem` minden form-hármast egy tábla-cellához köt, ezért a 12 form item 12 különböző cellát kér), `contrast` (qué vs cuál: ¿Qué es? vs ¿Cuál prefieres?; por qué vs porque: kérdés vs válasz), `tip` (1). Minden `Lang4` mind a 4 nyelven, üres string tilos (P1).
C. **`speak` ×4**, a spanyol szakaszok «...» közt.
D. **`glossary`:** a V1 glossary marad; szűkül, ha egy szó A1-ig tanított, bővül, ha új példamondat kéri. Kártyák: `node ~/ai/.claude/skills/eget-nyelvtan/probe.cjs --cards A1 /tmp/claude-1000/cards-A1.tsv`.
E. **Itemek:** a meglévő **12 választós marad** (`sentence`, `options`, `correct`, `examples` változatlan; a `wrong` minden rossz opción átírva LECKE-SEMA stílusra ×4; a V1 item `why` mezőjének szövege a `wrong`-ba vagy a `why` itemekbe megy, nem vész el); **1 `match`** (5-6 pár: kérdőszó ↔ válasz-fajta); **12 `form`** az `interrogativos` table id-ra (válasz vagy kontextus → kérdőszó, pl. `¿___ vives? En Narvarte.` → `Dónde`, `¿___ cuesta? Veinte pesos.` → `Cuánto`, `¿___ es tu número? El 55…` → `Cuál`); **6-8 `why`** (3 szabály-név, pl. „hely = dónde", „választás = cuál", „mennyiség egyeztet", „elöljáró elöl", a rossz opciókon `wrong` ×4).
F. **Mondat-szabályok:** legfeljebb 12 szó (P2); természetes; csak A0-A1 szavak vagy glossza; csak spanyol forrásmondat (K1); Mexikó-spanyol, ha új mondatot írsz; a meglévő V1 mondatok maradnak.
G. Ha valamelyik teszt fix darabszámot állít, frissítsd a számot, semmi mást. Ha egy jest-teszt olyan fájlban piros, ami nem a te leckéd, NEM javítod a kódot: piros állapottal jelentesz, melyik teszt és miért.

### Kapu (sorban, mind a worktree gyökeréből)
```
node scripts/audit-games.mjs 2>&1 | tail -15     # 0 P1, cél 0 P2
npx jest 2>&1 | tail -8                           # zöld
npx tsc --noEmit 2>&1 | tail -3                   # 0 hiba
npx expo lint 2>&1 | tail -5                      # 0 error
```
Piros → javítasz és újra, legfeljebb 3-szor, aztán piros állapottal jelentesz (NEM commitolsz pirosat).

### Commit (csak zöld kapuval)
`git add data/games/grammar/es/interrogativos.json` (+ a teszt, ha nyúltál hozzá), majd:
```
refactor(grammar): interrogativos V2 séma (nyelvtan)

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```
Nem pusholsz.

### Jelentés (max 10 sor)
- fájl + item-számok fajtánként (choice/match/form/why)
- a 4 kapu utolsó sora
- commit hash
- 3 minta (2 választós `sentence` + `correct`, 1 új `form`)
- glossza-változás egy sorban; elakadás egy mondatban, ha volt
Nincs diff, nincs fájltartalom, nincs narratíva.
