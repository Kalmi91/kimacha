# PLAN-hibaim.md, „Hibáim" import + pakli

Ág: `feat/hibaim` (a `feat/play-vagas` 2baaca0 tetejéről), munkafa: `~/ai/kimacha-wt-hibaim`.
Kálmán kérése (2026-09-23): az AI-beszélgetésből (Drive „Mis errores de español") és később
WhatsApp-exportból kiszedett hibák kerüljenek az appba: elrontott szavak listája, „nézd át
újra" mutató a nyelvtani leckére, és külön pakli a helyes mondatokból + szavakból + nyelvtani
feladatokból. Elemzés laptopon (`/hibaim` skill) → JSON a Drive-ra → appban betöltés a
Restore mintájára. WhatsApp-stílus (ékezet nélkül, q, xq, jaja) NEM hiba.

Becslés: ~4 agent-lépés, lépésenként ~200K subagent-token (a PLAN-play 2. lépése alapján, nem mérés).

## Lépések

- [x] 1. Munkafa + ág + npm ci + alap-kapu → kész, ha: tsc 0, jest zöld az ág tövén (2026-09-23: tsc 0, jest 939/939 zöld `--runInBand`-dal; párhuzamos worker mellett 5 suite timeoutol a sandboxban, ez környezeti flakiness, nem regresszió)
- [x] 2. Formátum + validátor + tárolás (`lib/mistakes/`, DB-táblák natív + web) → kész, ha: jest-teszt zöld (2026-09-23, `9a2c5b0` formátum+validátor+check-mistakes.mjs, `06f087f` deck.ts+DB-táblák; tsc 0, jest 966/966 `--runInBand`-dal)
- [x] 3. Import gomb (Settings, Restore alatt) + riport-képernyő `app/mistakes/index.tsx` → kész, ha: tsc + jest zöld (2026-09-23, `1d34dbb`; tsc 0, jest 971/971 `--runInBand`-dal)
- [x] 4. Hibáim pakli `app/mistakes/deck.tsx` (SM-2) + belépő a PCIC fülön → kész, ha: tsc + lint + jest + 3 audit zöld (2026-09-23; tsc 0, lint 0 error/12 pre-existing warning, jest 973/973 `--runInBand`-dal, audit-corpus/games/prompts mind 0, nincs 800 sor feletti fájl)
- [x] 5. `/hibaim` skill (`~/.claude/skills/hibaim/SKILL.md`) → kész, ha: a fájl megvan, a formátum = ez a fájl (2026-09-23, Opus írta; validálás `scripts/check-mistakes.mjs`-sel, ezt az agent adja)
- [ ] 6. Skill a mai doksin → `hibaim-2026-09-23-claude.json` a Drive-on → kész, ha: a validátor elfogadja
- [ ] 7. Web-export képernyőképek (import, riport, kártya) → kész, ha: Kálmán megnézte
- [ ] 8. APK (fő munkafa, Kálmán parancsára) → kész, ha: Kálmán telefonon végigkattintott

Nyitott, NEM ebben a szeletben: mentés/visszatöltés vigye-e a hibáim-táblákat; a rosszul írt
szavak bekötése a `pcic_spelling_list`-be; köteg törlése.

## Formátum: `kimacha-hibaim` v1 (a skill és az app közti szerződés)

```json
{
  "format": "kimacha-hibaim",
  "version": 1,
  "batchId": "2026-09-23-claude",
  "title": "Claude chat, 2026-09-23",
  "date": "2026-09-23",
  "source": "claude-chat",
  "patterns": [
    {
      "id": "yo-form",
      "title": "Use the yo form when you talk about yourself",
      "rule": "When you talk about yourself, the verb is the yo form: tengo, sé, vivo.",
      "lessons": ["presente-irregular", "presente-regular"],
      "drills": [
        { "id": "d1", "prompt": "Pero no ___ tomate. (tener)", "answer": "tengo", "en": "But I don't have tomato." }
      ]
    }
  ],
  "sentences": [
    { "id": "s1", "en": "I don't have tomato.", "es": "No tengo tomate.", "wrong": "Pero no tienes tomate.", "pattern": "yo-form", "doubtful": false }
  ],
  "words": [
    { "id": "w1", "es": "sartén", "en": "frying pan", "note": "" }
  ],
  "wrongWords": [
    { "wrong": "tienes", "es": "tengo", "kind": "form", "note": "yo form of tener" },
    { "wrong": "misterios", "es": "errores", "kind": "word", "note": "misterios = mysteries" },
    { "wrong": "compania", "es": "compañía", "kind": "spelling", "note": "" }
  ]
}
```

Szabályok (a validátor ezeket ellenőrzi, bármelyik sérül → az egész fájl elutasítva, érthető hibaüzenettel):
- `format` pontosan `"kimacha-hibaim"`, `version` pontosan `1`.
- `batchId`: `^[a-z0-9-]{1,60}$`. Ugyanaz a `batchId` újra betöltve = a köteg tartalma lecserélődik, a kártyák haladása megmarad (azonos kártya-id).
- `date`: `YYYY-MM-DD`. `source`: `"claude-chat" | "whatsapp" | "other"`. `title`: nem üres.
- A 4 tömb kötelező (lehet üres). Tételenként max 300 karakter mezőnként, tömbönként max 500 tétel.
- `id`-k: `^[a-z0-9-]{1,40}$`, egyediek a saját tömbjükön belül (drill-id a saját mintáján belül).
- `sentences[].pattern` opcionális; ha van, létező `patterns[].id`-ra mutat. `doubtful` opcionális, alap `false`.
- `patterns[].lessons`: nyelvtani téma-id-k (a Nyelvtan fül `topic.id`-jai, pl. `ser-estar`). Ismeretlen id NEM hiba: a riport link nélkül, „No lesson in the app" szöveggel mutatja.
- `wrongWords[].kind`: `"spelling" | "form" | "word"`. `note` mindenhol opcionális.
- Kötelező szöveg-mezők: trimmelve nem üresek.

Kártya-id-k a paklihoz: mondat `${batchId}:s:${id}`, szó `${batchId}:w:${id}`, drill `${batchId}:d:${patternId}:${id}`. `doubtful: true` mondat NEM kerül a paklibe.

## Képernyők (Kálmán jóváhagyta 2026-09-23, „mehet"; a UI angol, `lib/i18n/index.ts` szerint)

1. **Settings**: a Restore gomb alatt új gomb `📥 Load my mistakes`, ugyanaz a stílus. DocumentPicker (JSON) → validálás → mentés → értesítés „Loaded: N sentences, N words, N grammar drills" → navigál a riportra. Hibás fájl → hibaüzenet a validátor szövegével.
2. **Riport** `app/mistakes/index.tsx` („My mistakes"): legfelül nagy gomb `Practice my mistakes (N due)` → pakli. Alatta kötegenként (legújabb elöl): cím + dátum, „Words you got wrong" (rossz alak áthúzva → helyes, note szürkén), „Review again" (mintánként: cím, szabály egy sorban, leckénként gomb → `/grammar/<id>`; ha nincs ilyen lecke: „No lesson in the app, the deck drills it"), „Not in the deck (correction uncertain)" ⚠ a `doubtful` mondatok. Üres állapot: „No mistakes loaded yet. Settings → Load my mistakes."
3. **Pakli** `app/mistakes/deck.tsx`: PCIC-kártya felület (CardShell, DockedAction, mint `app/grammar/deck/[topic].tsx`). Fent a feladat (mondat/szó: `en`; drill: `prompt`, alatta kicsiben `en`), kis címke: Sentence / Word / Grammar. Gépelés → Check → helyes alak charDiff-fel, mondatnál „You said:" + a régi hibás mondat áthúzva + a minta szabálya egy sorban, a spanyol felolvasva (`speak`). Két gomb: Didn't know / Knew it (a PCIC szövegeivel), előre kijelölve: pontos egyezés (`strictAnswerMatch`) → Knew it, más → Didn't know. Ütemezés: `lib/sm2.ts`, saját `mistake_cards` tábla (a `pcic_cards` statisztikáját nem szennyezi). Session: minden esedékes + max 20 új. Vége: „All done for now".
4. **PCIC fül**: kis `📕 My mistakes (N)` belépő, csak ha van betöltött köteg. A PCIC meglévő mezőinek és gombjainak mérete NEM változik.

## Instrukció a 2-4. lépéshez (Sonnet `iro` agent)

Munkafa: `/home/kalmi/ai/kimacha-wt-hibaim` (ág `feat/hibaim`). Ne válts ágat, ne pusholj, ne nyiss PR-t, ne buildelj APK-t, ne tölts fel semmit.

0. Alap-kapu az első változtatás előtt: `npx tsc --noEmit`, `npx jest` (a package.json scriptjei szerint). Ha már az alap piros: állj meg, jelents.
1. `lib/mistakes/format.ts`: típusok + `validateMistakesPayload(raw: unknown)` → `{ ok: true, batch } | { ok: false, error: string }` a fenti szabályokkal. Mintának nézd meg a `lib/backup.ts` validátorát. Fixture: `lib/mistakes/__fixtures__/sample.json` (2 minta, 3 mondat ebből 1 `doubtful`, 2 szó, 3 wrongWord, mintánként 1-2 drill; a tartalom a fenti példából és a mai doksiból: „Eso es bien → Eso está bien" (ser-estar), „Soy confundido → Estoy confundido"). Teszt: a fixture átmegy; minden szabály megsértése külön esetként elutasítva.
2. `lib/mistakes/deck.ts`: tiszta függvények: köteg(ek) → kártyalista (id-k a fenti sémával, `doubtful` kihagyva), válasz-összevetés `strictAnswerMatch`-csel, session-választás a `lib/sm2.ts` meglévő függvényeivel (`pickSm2Session` stb.). Teszt.
3. DB: új táblák a migrációs mintával (`lib/db/migrations.ts`): `mistake_batches (batch_id TEXT PRIMARY KEY, json TEXT NOT NULL, imported_at TEXT NOT NULL)` és `mistake_cards` a `pcic_cards` oszlopaival (`item_id` kulcs). Metódusok a natív (`lib/database.ts`) ÉS a web (`lib/database.web.ts`) implementációba ugyanazzal a szignatúrával: köteg mentése (upsert), kötegek listázása, kártya olvasás/írás, esedékes-szám. Ha van meglévő DB-teszt minta, kövesd.
4. Settings import gomb (a `handleRestore` mintájára, `app/(tabs)/settings.tsx`), i18n kulcsok `lib/i18n/en.ts`-be (és `es.ts`-be, ha ott is tükrözve van a szerkezet), új route-ok regisztrálása ott, ahol a `grammar/deck` is (`app/_layout.tsx`).
5. `app/mistakes/index.tsx` riport + `app/mistakes/deck.tsx` pakli a fenti leírás szerint. A lecke-id feloldása a Nyelvtan fül meglévő téma-listájából (`app/(tabs)/course.tsx` honnan veszi a `topic.id`-t, azt használd).
6. PCIC-belépő (`app/(tabs)/index.tsx`, most 785 sor): ha a hozzáadás 800 fölé vinné, a belépő külön komponensbe megy (`components/learn/`).
7. Kapu a végén: `npx tsc --noEmit` 0 hiba, `npm run lint` 0 error, `npx jest` mind zöld, `node scripts/audit-corpus.mjs`, `node scripts/audit-games.mjs`, `node scripts/audit-prompts.mjs` nem romlik, nincs 800 sor feletti forrásfájl.
8. Commitok: lépésenként kicsi, tömör Conventional Commit, a végén: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Minden kész lépés után ebben a fájlban a sor `[x]` + dátum + commit-hash.
9. Jelentés max 10 sor: mi változott (fájl), a kapu utolsó sorai, elakadás egy mondatban.

## Napló

- 2026-09-23, Opus-session: terv + képernyő jóváhagyva („mehet építsd meg, … külön ágon"), munkafa kész.
