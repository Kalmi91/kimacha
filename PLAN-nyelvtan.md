# PLAN-nyelvtan.md, igeidő-drill első szelet (NY1-NY4), 2026-09-18

Igazságforrás: `/home/kalmi/ai/ai-workspace/kimacha/NYELVTAN.md` (ha eltér, az nyer).
Ág: `feat/grammar-igeidok`, worktree: `/home/kalmi/ai/kimacha-wt-nyelvtan`, alap: `main` @ 3017b06.
Orkesztrátor: Fable 5.1. Író: Sonnet `iro` subagent, egy tétel = egy agent, sorban.

Becslés: ~1,2-1,6 M token (a 2026-09-17-es tanulság szerint 5-7× a naiv becslés), 2-4 óra.

## Lépések

- [x] 0. Worktree + `npm install` → kész, ha: `git worktree list` mutatja, `node_modules` van (2026-09-18)
- [x] 1. NY1 séma + validátor (`transform`, `tense`, `wordIds`, `TENSE_NAMES`) → kész, ha: tsc 0, audit-games 0/0, lessonSchema.test zöld (kész 2026-09-18, caa4871)
- [x] 2. NY2 unlock (`lockState.ts` + leckelista jelvények + egyszeri sáv) → kész, ha: jest zöld + `lockState.test.ts` + leckelista-teszt (kész 2026-09-18, 407aa7f; sor-testID a meglévő `grammar-topic-` maradt)
- [x] 3. NY3 drill UI (`GrammarDrill` transform-ág + „Átírás (n)" gomb + i18n ×4) → kész, ha: jest zöld + `grammarDrillTransform.test.tsx` (kész 2026-09-18, 80ddf01; `check` = meglévő „Ellenőrzés", strictAccents csak transform-körben kérdezve)
- [x] 4. NY4 tartalom (`indefinido-10-verbos.json` A2 + syllabus + registry) → kész, ha: audit-games 0/0, jest zöld (kész 2026-09-18, 6026c92 + javítás 31f9799: természetes mondatok, transform-only teszt-guard)
- [~] 5. Menet vége: NYELVTAN.md `[x]`-ek + commit hash, PR `main` felé, önellenőrzés ide → kész, ha: PR URL van
- [!] 6. NY5: Kálmán buildel (`/build_kimacha`, ág: `feat/grammar-igeidok`) és végigkattintja telefonon. NY6+ csak „mehet" szóra.

## A 10 ige (NY4), a forrás döntése

Forrás: SUBTLEX-sorrendű alaklista, `ai-workspace/kimacha/word_batches/a1_batch0.txt` + `a2_batch0-7.txt`
(a `data/words/a0-a2.json`-ban nincs `freq` mező, ellenőrizve 2026-09-18). Lemma az első előfordulás
sorrendjében, csak olyan ige, aminek van A0-A2 kártyája (a `wordIds` miatt).

| # | ige | típus | kártya (szint:id:es) |
|---|---|---|---|
| 1 | estar | rendhagyó (estuve) | a1:1051 yo estoy, 1052 tú estás, 1053 él está, 1054 nosotros estamos, 1055 ellos están, a2:3743 estar |
| 2 | ir | rendhagyó (fui) | a0:31 ir, a1:1086 yo voy, 1087 tú vas, 1088 él va, 1089 nosotros vamos, 1090 ellos van |
| 3 | tener | rendhagyó (tuve) | a0:33 tener, a1:1071 yo tengo, 1072 tú tienes, 1073 él tiene, 1074 nosotros tenemos, 1075 ellos tienen |
| 4 | saber | rendhagyó (supe) | a0:28 saber |
| 5 | poder | rendhagyó (pude) | a0:29 poder |
| 6 | mirar | szabályos -ar | a1:1880 mirar |
| 7 | pasar | szabályos -ar | a1:1887 pasar |
| 8 | esperar | szabályos -ar | a0:80 esperar |
| 9 | necesitar | szabályos -ar | a0:85 necesitar |
| 10 | gustar | szabályos -ar (me gustó) | a0:84 gustar, a1:1229 me gusta |

Kihagyva és miért: ser (7. rendhagyó, indefinidója = ir, redundáns), querer/hacer/decir (sorrendben a 6-8.
rendhagyó, nem fér az 5-be), creer (8. lemma, de creyó: y-írásmód, nem tiszta szabályos), parecer (12.,
NINCS kártyája A0-A2-n), dejar/escuchar (nincs kártyájuk). Gyenge pont, kimondva: az 5 szabályos mind -ar,
szabályos -er/-ir nincs a lecke tábláiban (azokat a régi `indefinido-regular` hozza). Ha Kálmán mást akar,
NYELVTAN.md-be kerül, nem ide.

---

## Brief NY1 (Sonnet `iro`), séma + validátor

Worktree: `/home/kalmi/ai/kimacha-wt-nyelvtan`. Csak ezekhez nyúlj: `lib/grammar/lessonTypes.ts`,
`scripts/audit-games.mjs`, `lib/__tests__/lessonSchema.test.ts`, és CSAK ha a tsc kényszeríti:
`lib/games/content.ts`, `lib/games/grammarChoice.ts`. Smallest diff, a meglévő choice/match/form/why/mark
ágakhoz nem nyúlsz.

1. `lib/grammar/lessonTypes.ts`:
   - `export type TenseId = 'presente' | 'indefinido' | 'imperfecto' | 'perfecto' | 'futuro-simple' | 'ir-a' | 'condicional' | 'subjuntivo-presente';`
   - `export const TENSE_IDS: readonly TenseId[]` (a 8 érték, ebben a sorrendben).
   - `export const TENSE_NAMES: Record<TenseId, Lang4>`, az `es` a spanyol nyelvtani név (a jelvény ezt
     mutatja): presente → `Presente`, indefinido → `Pretérito indefinido`, imperfecto → `Pretérito imperfecto`,
     perfecto → `Pretérito perfecto`, futuro-simple → `Futuro simple`, ir-a → `Ir a + infinitivo`,
     condicional → `Condicional simple`, subjuntivo-presente → `Presente de subjuntivo`. A `hu`/`en`/`de`
     a hétköznapi név (hu: jelen idő, befejezett múlt, folyamatos múlt, közelmúlt, egyszerű jövő,
     „ir a" jövő, feltételes mód, kötőmód jelen; en/de ennek megfelelője).
   - `export interface TransformItem { kind: 'transform'; id: string; tense: { from: TenseId; to: TenseId }; prompt: Lang4; answer: string; accept?: string[]; wordIds: string[]; why: Lang4 }`
   - `tense?: { from: TenseId; to: TenseId }` opcionális mező a `GrammarGapItem`-en (a choice), a `FormItem`-en
     és a `WhyItem`-en.
   - `LessonV2.items` uniója bővül `TransformItem`-mel.
   - Ha ettől a tsc `lib/games/content.ts`-ben vagy `grammarChoice.ts`-ben pirosodik (kimerítő switch,
     `Record<GrammarKind, number>`): a legkisebb javítás: `GrammarKind` bővül `'transform'`-mal,
     `grammarKindCounts` számolja (`transform: 0` kezdőérték), a kör-építő (`buildGrammarRound`) a transform
     itemet EBBEN a tételben még kihagyja (NY3 teszi be). Semmi más.

2. `scripts/audit-games.mjs`: új `auditTransformItem(item, itemPath, topic)` és az item-ciklusban
   (`auditGrammarTopic`, a `why` ág után, a gap-ág ELŐTT) `if (item.kind === 'transform') { auditTransformItem(...); continue; }`.
   Szabályok, mind `p1` (blokkoló):
   - `tense` objektum, `tense.from` és `tense.to` a 8 TenseId egyike (a listát a scriptben tartsd, a
     lessonTypes.ts-t nem tudja importálni), `from !== to`.
   - `prompt` 4 nyelv (`hu`,`en`,`es`,`de`) nem üres string (a meglévő `checkLangs` jó rá).
   - `answer` nem üres string, `prompt.es !== answer`.
   - `accept` ha van: string-tömb, minden eleme `!== answer` és `!== prompt.es`.
   - `wordIds` nem üres string-tömb; minden eleme létező kártya-id a `data/words/{a0,a1,a2,b1,b2,c1}.json`
     valamelyikében (kártya `id` STRING, pl. `"1001"`), és a kártya `level`-je ≤ a lecke `level`-je
     (sorrend: A0 < A1 < A2 < B1 < B2 < C1). Építs egyszer egy `Map<id, level>`-et a 6 fájlból (ha a
     meglévő `loadLevelWords` ad id-t, használd azt).
   - `why` 4 nyelv nem üres.
   - Nem-transform itemen, ha van `tense`: ugyanaz a from/to ellenőrzés.
   Üres transform-készleten (most) is le kell futnia, 0/0-val.

3. `lib/__tests__/lessonSchema.test.ts`: két új teszt: (a) `TENSE_NAMES` mind a 8 id-ra 4 nem üres
   nyelvet ad; (b) minden `transform` item a korpuszban: `prompt.es !== answer`, `tense.from !== tense.to`,
   `wordIds.length > 0` (most üres halmazon fut, NY4 után élesben).

Kapu (a worktree-ben): `npx tsc --noEmit` (0 hiba), `npx expo lint` (0 error), `npx jest` (zöld; ha CSAK az
examBuilder flaky, egyszer újra), `node scripts/audit-games.mjs` (0/0).
Commit: `feat(grammar): transform item kind + tense badge schema (NY1)`, test és üzenet tömör. Jelentés max
10 sor: fájl:sor, a kapu utolsó sora, elakadás egy mondatban.

---

## Brief NY2 (Sonnet `iro`), unlock

Előfeltétel: NY1 a fán. Fájlok: új `lib/grammar/lockState.ts`, `app/grammar/index.tsx`, `lib/i18n/{hu,en,es,de}.ts`,
új `lib/__tests__/lockState.test.ts`, új leckelista-teszt (a `components/__tests__/doneScreenLevel.test.tsx`
mintájára, ahol app-képernyőt renderelnek). DB-séma NEM változik: a meglévő `getGameProgress`/`setGameProgress`
(mindkét implementációban megvan) viszi a kulcsot.

1. `lib/grammar/lockState.ts` (tiszta, React nélkül):
   - `export function transformWordIds(lesson: GrammarTopicData): string[]`: a `LessonV2` transform itemjeinek
     `wordIds` uniója (sorrend: első előfordulás); nem-V2 vagy transform nélkül: `[]`.
   - `export type LockState = { state: 'locked' | 'unlocked'; have: number; need: number }`
   - `export function lockState(lesson: GrammarTopicData, knownIds: Set<string>): LockState`: `need` = az unió
     mérete, `have` = ebből ismert; `need === 0` → `unlocked`; különben `have === need` → `unlocked`, egyébként `locked`.
   - Az „ismert" definícióját NEM itt döntöd el: a hívó adja a halmazt.

2. `app/grammar/index.tsx`: a progress-betöltés után (ugyanabban a `useFocusEffect`-ben): minden
   szintbeli témára `lessonFor(learnedLang, topic.id)` → `transformWordIds`; az összes id `Number(id)`-ként
   egy `db.getWordStates(ids)` hívás (lap ≥ 3 VAGY buried = 1, ez a meglévő EGY definíció, nem írsz újat);
   a visszakapott Map-ből `Set<string>` az 1-esekből; `lockState` témánként → `Map<topicId, LockState>` state.
   Sor-megjelenés (mockup: https://claude.ai/artifact/ShhNW4XgUzvQSHjETLB444, színek az app témájából):
   - `done` marad, ahogy most (pipa + kész, x/y); az alábbi csak nem-done sorra, és csak ha `need > 0`;
   - `unlocked`: keret `colors.tint` színnel (1px, borderRadius a sor meglévője), meta-szöveg
     `s.grammar.unlockedMeta(have, need)`;
   - `locked`: szürke sor (a meglévő inaktív szín), jobbra kis chip `s.grammar.locked`, meta-szöveg
     `s.grammar.lockedMeta(have, need)`; a sor koppintásra UGYANÚGY megnyílik (nincs disabled);
   - `testID`-k: `grammar-row-${topic.id}`, `grammar-lock-chip-${topic.id}`.
   Egyszeri sáv a lista tetején (a fejléc alatt): ha van olyan téma, ami `unlocked`, `need > 0`, és nincs
   a látott halmazban → sáv: `s.grammar.unlockedBanner(title)` + bezáró X (`accessibilityLabel`:
   `s.grammar.dismiss`, `testID="grammar-unlock-banner-close"`). A sáv megjelenésekor AZONNAL
   `db.setGameProgress('grammar-unlock-seen', topic.id, 'seen')` (app-újraindítás után ne jöjjön újra); az X
   csak elrejti. Több új téma: egyszerre egy sáv, az első; X után jöhet a következő. Látott halmaz:
   `db.getGameProgress('grammar-unlock-seen')` itemId-i. Ezt a gameId-t `export const GRAMMAR_UNLOCK_SEEN_KEY`
   néven a `lockState.ts`-ből exportáld.

3. i18n ×4 (`lib/i18n/hu.ts`, `en.ts`, `es.ts`, `de.ts`, a meglévő `grammar` blokkba):
   - `locked`: hu `Zárva`, en `Locked`, es `Bloqueado`, de `Gesperrt`
   - `lockedMeta: (have, need) =>` hu `zárva, ${have}/${need} szó megvan · koppintásra mégis nyílik`,
     en `locked, ${have}/${need} words known · tap to open anyway`, es `bloqueado, ${have}/${need} palabras
     · toca para abrir igual`, de `gesperrt, ${have}/${need} Wörter bekannt · tippen öffnet trotzdem`
   - `unlockedMeta: (have, need) =>` hu `feloldva, ${have}/${need} szó megvan`, en `unlocked, ${have}/${need}
     words known`, es `desbloqueado, ${have}/${need} palabras`, de `freigeschaltet, ${have}/${need} Wörter bekannt`
   - `unlockedBanner: (title) =>` hu `Új nyelvtani rész feloldva: ${title}`, en `New grammar part unlocked:
     ${title}`, es `Nueva parte de gramática desbloqueada: ${title}`, de `Neuer Grammatikteil freigeschaltet: ${title}`
   - `dismiss`: hu `Bezár`, en `Dismiss`, es `Cerrar`, de `Schließen` (ha van már közös close-kulcs, azt használd és ezt hagyd el)

4. Tesztek: `lib/__tests__/lockState.test.ts`: locked (részleges), unlocked (mind ismert), transform nélkül
   (`unlocked`, 0/0), üres ismert halmaz (locked, 0/n), duplikált wordId két itemben egyszer számít.
   Leckelista-teszt: mockolt `lessonFor` (fixture V2 lecke 2 transform itemmel, wordIds `["1","2","3"]`) és
   mockolt `db.getWordStates` (csak 1 és 2 ismert): a sor `locked` chip-et mutat, koppintás `router.push`-t hív;
   mind a 3 ismert: sáv látszik, `setGameProgress('grammar-unlock-seen', …)` egyszer hívódik, X után eltűnik;
   látott halmazban: nincs sáv.

Kapu: mint NY1. Commit: `feat(grammar): word-gated lesson unlock + list badges + one-time banner (NY2)`.
Jelentés max 10 sor.

---

## Brief NY3 (Sonnet `iro`), drill UI

Előfeltétel: NY1 + NY2 a fán. Fájlok: `components/grammar/GrammarDrill.tsx`, `lib/games/grammarChoice.ts`
(kör-építő), `lib/games/content.ts` (ha NY1 nem tette: `GrammarKind` + `grammarKindCounts`),
`app/grammar/[topic].tsx`, `lib/i18n/*` ×4, új `components/__tests__/grammarDrillTransform.test.tsx`.
A meglévő choice/match/form/why/mark ágakhoz nem nyúlsz, csak a jelvényt teszed rájuk.

1. Kör: `buildGrammarRound` a transform itemeket is berakja (a match/form/why becsomagolás mintájára),
   `grammarRoundItemKind` → `'transform'`. `grammarKindCounts` számolja.

2. `GrammarDrill.tsx`: új `TransformDrillItem` komponens, a listában `key={item.id}` (FB299: az állapot
   ne ússzon át a következő itemre). Képernyő, PONTOSAN a mockup szerint
   (https://claude.ai/artifact/ShhNW4XgUzvQSHjETLB444, színek az app témájából, nem a mockupé):
   - jelvény felül: `${TENSE_NAMES[tense.from].es} → ${TENSE_NAMES[tense.to].es}` (pl. `Presente → Pretérito indefinido`), kis chip;
   - kártya: `prompt.es` nagy betűvel; mellette „F" gomb 44×44, `colors.tint` keret, bekapcsolva `colors.tint`
     kitöltés + fehér F; `accessibilityLabel={s.grammar.showTranslation}`, `testID="transform-f"`; bekapcsolva
     a kártya alatt dőlt betűvel `prompt[contentLang] ?? prompt.en`; újra F → eltűnik;
   - címke `s.grammar.rewriteTo(TENSE_NAMES[tense.to][contentLang] ?? TENSE_NAMES[tense.to].en)` + `TextInput`
     a `answerInputProps`-szal (`@/lib/inputProps`, FB145), `testID="transform-input"`;
   - „Ellenőriz" teli gomb (`s.grammar.check` ha van a grammar blokkban, különben új kulcs), `testID="transform-check"`;
     ellenőrzés: `strictAnswerMatch(input, answer, { strictAccents })` VAGY bármely `accept` elemre ugyanez;
     `strictAccents` = `db.getStrictAccents()` egyszer, a `GrammarDrill` mount-jakor (state), a Beállítások kapcsolója;
   - jó: zöld doboz, `s.grammar.correct` + `why[contentLang] ?? why.en`; rossz: piros doboz,
     `s.grammar.correctAnswer` + az `answer` nagy betűvel + a `why`;
   - ellenőrzés után „Következő" gomb (`s.grammar.next`), `testID="transform-next"`, az app meglévő
     elsődleges-gomb stílusában (a többi drill-ág Következő gombja, ha van; különben `colors.text` háttér);
   - alul apró szöveg `s.grammar.accentHint`, CSAK ha `strictAccents === false`;
   - pontozás: helyes/összes az `onFinish`-be, mint a többi fajtánál.
   Jelvény a többi fajtán: choice/form/why itemnél, ha `item.tense` van, ugyanaz a chip a kérdés fölött.

3. `app/grammar/[topic].tsx`: `KIND_ORDER` végére `'transform'`; gomb szövege `s.grammar.startTransform(kindCounts.transform)`;
   a haladás kulcsa automatikusan `${topicId}:transform` (a meglévő `${drillKind}` minta). Ellenőrizd, hogy a
   `doneGrammarTopicProgress` (syllabus.ts) a `grammarKindCounts` kulcsain megy, tehát a „kész" a transform
   kört is kéri; ha kézzel sorolja a fajtákat, add hozzá.

4. i18n ×4, a `grammar` blokkba (ami már van, azt nem duplikálod):
   - `startTransform: (n) =>` hu `Átírás (${n})`, en `Rewrite (${n})`, es `Reescribir (${n})`, de `Umschreiben (${n})`
   - `rewriteTo: (tense) =>` hu `Írd át: ${tense}`, en `Rewrite in the ${tense}`, es `Reescribe en ${tense}`, de `Schreibe um: ${tense}`
   - `showTranslation`: hu `Fordítás mutatása`, en `Show translation`, es `Mostrar traducción`, de `Übersetzung zeigen`
   - `check`: hu `Ellenőriz`, en `Check`, es `Comprobar`, de `Prüfen`
   - `correct`: hu `Helyes`, en `Correct`, es `Correcto`, de `Richtig`
   - `correctAnswer`: hu `Helyes válasz`, en `Correct answer`, es `Respuesta correcta`, de `Richtige Antwort`
   - `next`: hu `Következő`, en `Next`, es `Siguiente`, de `Weiter`
   - `accentHint`: hu `Ékezet nélkül is elfogadja, a hiányzó ékezetet megmutatja`, en `Accepted without accents,
     missing accents are shown`, es `Se acepta sin tildes, se muestran las que faltan`, de `Auch ohne Akzente
     akzeptiert, fehlende Akzente werden gezeigt`

5. Teszt `components/__tests__/grammarDrillTransform.test.tsx` (a `grammarDrillWhy.test.tsx` mintájára; fixture
   V2 lecke 2 transform itemmel, `kinds={['transform']}`, mockolt `db.getStrictAccents`):
   helyes válasz → `Helyes`/`Correct` doboz + why; rossz → `Helyes válasz` + answer; ékezet nélküli válasz
   (`Comi pan`) lazán (strict false) elfogad, szigorúan (strict true) elutasít; F ki-be kapcsolja a fordítást;
   Következő → 2. item, a beviteli mező üres (a `key` miatt); a 2. után `onFinish(helyes, 2)`.

Kapu: mint NY1. Commit: `feat(grammar): transform drill UI with tense badge + F translation toggle (NY3)`.
Jelentés max 10 sor. Ha az elrendezésen/gombokon/szövegeken el akarnál térni a mockuptól: NEM döntesz, jelented.

---

## Brief NY4 (Sonnet `iro`), tartalom

Előfeltétel: NY1-NY3 a fán. Fájlok: új `data/games/grammar/es/indefinido-10-verbos.json`,
`lib/grammar/syllabus.ts`, `lib/games/content/es.ts` (import + regisztráció, az `indefinido-regular` mintájára),
`lib/__tests__/grammarSyllabus.test.ts` (ha számlálót állít). Olvasd el előbb:
`ai-workspace/kimacha/LECKE-SEMA.md` (tábla-minta, speak-szabály), és a
`data/games/grammar/es/indefinido-regular.json` első ~150 sorát (body + table + form + why alak).

1. Lecke-JSON: `schema: 2`, `topic: "indefinido-10-verbos"`, `level: "A2"`, `title` ×4 (hu `Befejezett múlt,
   a 10 leggyakoribb ige`, en `Preterite, the 10 most frequent verbs`, es `Indefinido, los 10 verbos más
   frecuentes`, de `Indefinido, die 10 häufigsten Verben`).
   `body`: 1 rövid `text` (mikor indefinido: lezárt, befejezett múlt, időhatározóval: ayer, anoche, el año
   pasado), 10 `table` blokk (`id: "ind10-<ige>"`, `header: Persona | <ige>` ×4 nyelven a meglévő minta
   szerint, 6 sor: yo, tú, él/ella/usted, nosotros/as, vosotros/as, ellos/ellas/ustedes, teljes indefinido
   paradigma), 1 `tip` (ékezet: -ó/-í/-é a 3. és 1. személyben a szabályosaknál; a rendhagyóknál nincs ékezet).
   Az igék és a sorrend: estar, ir, tener, saber, poder (rendhagyó), mirar, pasar, esperar, necesitar, gustar
   (szabályos), a fenti táblázatból. `speak` ×4 a LECKE-SEMA 3 szerint (spanyol szakaszok «…» közt).
   `glossary` opcionális.
   `items`: 12 `transform` item, id `i10-tr-01` … `i10-tr-12`, `tense: { from: "presente", to: "indefinido" }`,
   mindegyik a 10 ige egyikével, minden ige legalább egyszer, a maradék 2 a rendhagyókból; a mondat rövid
   (3-6 szó), A2 alatti szókincs, időhatározóval, ahol természetes (ayer, anoche, la semana pasada).
   Az item alakja SZÓ SZERINT a NYELVTAN.md „Adatformátum" blokkja:
   ```json
   {
     "id": "i10-tr-01",
     "kind": "transform",
     "tense": { "from": "presente", "to": "indefinido" },
     "prompt": { "es": "…", "hu": "…", "en": "…", "de": "…" },
     "answer": "…",
     "accept": ["…"],
     "wordIds": ["…"],
     "why": { "hu": "…", "en": "…", "es": "…", "de": "…" }
   }
   ```
   `prompt.es` a jelen idejű mondat, `answer` az indefinido mondat, `accept` a kitett névmásos változat
   (ha az `answer` névmás nélküli) vagy fordítva. `why` 4 nyelven, 1-2 mondat: miért indefinido + az ige
   ragozása (a NYELVTAN.md példája szerint).
   `wordIds`: a mondat MINDEN tartalmas szava (ige, főnév, melléknév, határozó) kártya-id STRINGKÉNT;
   funkciószó csak ha van kártyája. Kártya-választás: ha van a mondatbeli ragozott alakkal egyező kártya
   (pl. `"1051"` = `yo estoy`), az; különben a szótári alak kártyája (pl. `"28"` = `saber`). Minden id létező
   kártya a `data/words/a0.json`, `a1.json`, `a2.json` egyikében (más szint tilos, A2 a lecke szintje);
   írás előtt node-dal ellenőrizd, ne fejből. Opcionálisan 10 `form` item (`i10-form-<ige>`, a meglévő
   form-alak: `verb`, `person`, `answer`, `table` = a tábla id-ja).

2. `lib/grammar/syllabus.ts`: új téma `indefinido-10-verbos` az `a2-pasado` unitban, közvetlenül az
   `indefinido-irregular` után, `level: 'A2'`, `title` ×4 (mint fent), `blurb` ×4 (1 mondat), tier a tier-mapben
   `'core-plus'` (mint a két régi indefinido). `lib/games/content/es.ts`: import + regisztráció.
   A `tenseGate.ts` `indefinido: 'indefinido-regular'` sora marad.

3. Ha a `grammarSyllabus.test.ts` vagy más teszt fix darabszámot állít (témák száma, written/planned), frissítsd.

Kapu: `node scripts/audit-games.mjs` 0/0 (ez ellenőrzi a wordIds-t és a szintet, nem az ígéreted),
`npx jest` zöld, `npx tsc --noEmit` 0, `npx expo lint` 0 error. Commit: `feat(grammar): indefinido-10-verbos
lesson, 12 transform items (NY4)`. Jelentés max 10 sor + a 12 `prompt.es → answer` pár egy-egy sorban
(Kálmán látni akarja).

---

## Önellenőrzés (2026-09-18, első szelet vége)

- subagentek: 4 (NY1, NY2, NY3, NY4), ebből NY4 egy javító kört kapott SendMessage-dzsel (nem új spawn), összesen 5 futás.
- orkesztrátor-válaszok: 10 a menet alatt (felmérés 4, terv 1, tételenként 1 indítás + 1 nyugtázás, NY4 javítás 1).
- 3+ válasz egy lépésre kód-változás nélkül: nem volt.
- token: subagentek ≈ 0,73 M (134K + 162K + 217K + 212K), orkesztrátor-kontextus ~90K × ~12 kör (cache-elt); becslés 1,2-1,6 M, tény alatta.
- tanulság: a Sonnet a lecke-mondatokat a wordIds-kényszer miatt először a legszűkebb kártyakészletből írta (mucho/aquí ismétlés, egy nem-spanyol gustar-mondat); a briefbe legközelebb az ismétlés-plafon és a „természetes, anyanyelvű így mondja" szabály eleve bekerül.
