# PLAN, szabad szókészlet A1-B2 (4 × 150 szó), 2026-09-30

Kálmán döntése (2026-09-30): az új 600 szó KÜLÖN készletbe megy (`data/words-open/`), a régi
`data/words/**` érintetlen marad, amíg ő nem validálja. Cél: az app pénzért is kiadható legyen,
ezért a szókészlet semmilyen külső listából nem származhat (a mostani SUBTLEX-ESP-alapú lista
CC BY-NC-SA, nem kereskedelmi). Válogatás: a 600 leggyakoribb, leghasznosabb spanyol lemma,
150-esével szintekre (a „B2" így könnyebb a valódinál, ez vállalt).

Ág: `feat/words-open-a1-b2`, worktree: `C:\AI\kimacha-wt-words-open` (a main-ből, 4b3bb5a).
Becslés: ~600K token, 1-2 óra.

## Lépések

- [x] 1. (12:53) Worktree előkészítés + kapu-script `scripts/words-open-check.mjs` → kész, ha: a script lefut egy kis kézi mintán, és `npm run lint` zöld
- [x] 2. (13:01) 600 lemma listája (order, level, pos, lemma, es) a 4 fájlba, mondatok nélkül → kész, ha: a kapu R1, R2 szabálya zöld
- [x] 3. (13:01) A1 kártyák (fordítás + mondat) → kész, ha: a kapu minden szabálya zöld az A1-en; Opus 10-es mintát néz
- [x] 4. (13:22) A2, B1, B2 kártyák → kész, ha: a kapu teljes futása zöld
- [x] 5. (13:38) Második AI-átnézés (független Sonnet) + javítás → kész, ha: minden jelölt kártya javítva, kapu zöld
- [~] 6. (13:38) PR #59, lap: Opus. Repo-kapu, commit, push, PR + böngészős átnéző lap Kálmánnak → kész, ha: typecheck/lint/test zöld, PR nyitva, lap linkje kint

## Spec (a subagent ezt hajtja végre 1:1)

### Forrás-tilalom (licenc miatt, ez a legfontosabb)

A szavakat, fordításokat és mondatokat a saját tudásodból állítod elő. TILOS bármilyen meglévő
szólistát olvasni vagy másolni: a repó `data/words/**`, `data/pcic/**`, `data/games/**`,
`lib/freqOrder.ts` adatai, SUBTLEX-ESP, FrequencyWords, PCIC, Anki-pakli, bármilyen weboldal.
A kész készletnek bizonyíthatóan függetlennek kell lennie, hogy kereskedelmi appban is használható legyen.

### Fájlok

`data/words-open/a1.json`, `a2.json`, `b1.json`, `b2.json`: mindegyik JSON-tömb, PONTOSAN 150
objektum, `order` szerint rendezve. Előtte ellenőrizd, hogy semmi nem importálja globbal a
`data/words-open/` mappát (az app most nem használhatja).

Objektum, kulcsok ebben a sorrendben:

```json
{
  "order": 12,
  "level": "A1",
  "pos": "verb",
  "lemma": "estar",
  "es": "estar",
  "hu": "lenni (állapot, hely)",
  "en": "to be (state, location)",
  "de": "sein (Zustand, Ort)",
  "sentence_es": "Yo estoy en casa.",
  "sentence_hu": "Otthon vagyok.",
  "sentence_en": "I am at home.",
  "sentence_de": "Ich bin zu Hause.",
  "sentence_lemmas": ["yo", "estar", "en", "casa"]
}
```

- `order`: globális 1-600; A1 = 1-150, A2 = 151-300, B1 = 301-450, B2 = 451-600.
- `pos`: noun | verb | adj | adv | pron | det | prep | conj | num | interj.
- `lemma`: csupasz szótári alak, kisbetű (főnév névelő nélkül, ige főnévi igenév, melléknév hímnem egyes szám). Egyedi a 600 között.
- `es`: főnévnél határozott névelővel (`la casa`, `el agua`), egyébként = lemma. Egyedi.
- `hu` / `en` / `de`: természetes glossza; többjelentésű szónál a fő jelentés, zárójelben rövid pontosítás.
- `sentence_*`: a `sentence_es` és három hű fordítása.
- `sentence_lemmas`: a `sentence_es` minden szó-tokenjének lemmája, sorrendben (írásjel nem token).

### Szóválogatás és sorrend

- A 600 leggyakoribb, a mindennapi beszédben leghasznosabb lemma, semleges nemzetközi spanyol.
- Benne vannak a mondatépítéshez kellő funkciószavak (névelő, névmás, elöljárószó, kötőszó).
  Névelő-lemma: `el` (el/la/los/las), `un` (un/una/unos/unas). Tárgyas névmás: `lo` (lo/la/los/las), külön `me`, `te`, `se`, `le`, `nos`.
- Kizárva: tulajdonnév, trágárság, rövidítés, töltelékszó (eh, pues mint töltelék), ragozott alak mint külön tétel.
- A sorrend a tanítási sorrend: korán jönnek az építőkockák (yo, tú, ser, estar, tener, no, sí, el, un, y, en, de, bien, casa…), hogy minél hamarabb teljes mondat épülhessen.

### Szabályok, amiket a kapu (`scripts/words-open-check.mjs`) kikényszerít

- R1 Egyediség: minden `lemma` és minden `es` pontosan egyszer szerepel a 600 között (egy szó = egy szint).
- R2 Darabszám és sáv: szintenként pontosan 150; `order` hézagmentes 1-600; a `level` egyezik az order-sávval; a kulcsok a fenti 13 kulcs, ebben a sorrendben.
- R3 Teljes mondat: nagybetűvel kezdődik (előtte állhat ¿ vagy ¡), `.` `!` vagy `?` zárja, legalább 3 szó-token, és legalább egy tokenjének lemmája `pos: verb` kártya.
- R4 Csak tanult szó: a tokenek száma = `sentence_lemmas` hossza; minden lemma egy kártya lemmája, amelynek `order`-je ≤ ennek a kártyának az `order`-je; a kártya saját lemmája szerepel a mondatban.
- R5 Lemma-hihetőség: minden token és lemmája ékezet nélkül az első 2 betűben egyezik, VAGY a (token, lemma) pár szerepel a script rendhagyó-alak listájában (pl. soy→ser, fue→ser, va→ir, la→el, me→yo). A listát bővítheted, de csak valódi alakkal; az átnéző (5. lépés) ezt a listát is ellenőrzi.
- R6 Szint-nyelvtan és hossz: mondathossz legfeljebb A1 8, A2 10, B1 12, B2 14 szó. Igeidő: A1 csak kijelentő mód jelen idő (+ `ir a` + főnévi igenév, `tener que`, `hay`); A2 ehhez + pretérito perfecto, indefinido, imperfecto, `estar` + gerundio; B1 ehhez + futuro, condicional, felszólító mód, presente de subjuntivo; B2 ehhez + imperfecto de subjuntivo, összetett idők, si-mondatok. Nézd meg, hogy a `lib/grammar/tenseGate.ts` újrahasználható-e erre a mondatok besorolására; ha igen, azt használd, ha nem, adj minden kártyához szükség szerint egy ellenőrizhető módszert, és írd le a PR-ben, mit ellenőriz a script és mit csak az átnéző.
- R7 Üres mondat csak az elején: a négy `sentence_*` mező és a `sentence_lemmas` üres ("" / []) csak `order` ≤ 20 kártyán lehet, ott is csak ha még nem építhető teljes mondat; minden más kártyán kötelező a mondat.
- R8 Nincs két azonos `sentence_es`.

A script szabályonként kiírja a hibák számát és az első 5 példát, hibánál exit 1. Futtatás: `node scripts/words-open-check.mjs` (opcionálisan `--level a1` csak egy szintre, `--list-only` az R1-R2-re).

### Minőség (az átnéző ezt nézi, script nem tudja)

- Nincs értelmetlen, erőltetett vagy természetellenes mondat; a mondat egy hétköznapi helyzetet ír le.
- A fordítás hű és természetes mind a 3 nyelven; a névelő / nem helyes.
- A `sentence_lemmas` és a rendhagyó-alak lista igaz.
- Természetes spanyol: az alanyi névmás (yo, tú, él, nosotros…) csak ott marad, ahol egy anyanyelvi is kiírná (nyomaték, szembeállítás, egyértelműsítés 3. személyben). Szintenként a mondatok legfeljebb ~25%-a kezdődjön alanyi névmással (Opus-minta 2026-09-30: A1-ben 80/146 volt).

### Git

Conventional Commit, AI-marker NÉLKÜL (se Co-Authored-By, se „Generated with”, se Claude-sor). `git add` mindig nevesítve, soha `-A`. Kapu push előtt: `npm run typecheck:ci`, `npm run lint`, `npm run test:ci`, `node scripts/words-open-check.mjs`. PR-t Kálmán merge-öl.
