# PCIC szólista, fordítás-workflow (session-token ≈ 0)

Cél: a PCIC leltárból (Plan Curricular del Instituto Cervantes, 08/09 nociones = szavak) kinyert spanyol tételek angol (később magyar) fordítása úgy, hogy a Claude-session tokenje ne fogyjon. Tanulság 2026-09-18: a B1 minta (444 tétel) ~640K subagent-tokenbe került, ebből a fordítás maga kis rész, a többi agent-kör volt (kinyerő 3 kör instrukció-hiba miatt, JSON olvasás-írás sessionben). Ezért a szabály: LLM-hívás csak sessionen kívül, a te termináldból, script útján. Claude csak tervez, kaput olvas és 20-as mintát audital.

Állapot 2026-09-18: `data/pcic/b1-all.json` 2190 tétel, `b1-sample.json` 444 (20%, minden 5.), `b1-en.json` 439 fordítás (pattern-tételek nem kapnak). Hátra: a maradék ~1746 tétel, ha a PLAN-pcic.md 7. lépése (Kálmán ítélete) igen.

## Fájlok
- `data/pcic/08_nociones_generales_inventario_b1-b2.md`, `09_nociones_especificas_inventario_b1-b2.md`: forrás (nyers md, nem a clean).
- `scripts/pcic-b1.mjs`: kinyerő, determinisztikus, nem LLM → `b1-all.json` + `b1-sample.json`.
- `data/pcic/b1-all.json`: `[{id, order, es, kind: word|phrase|sentence|pattern, source: 08|09, section, headword?}]`.
- `data/pcic/b1-en.json`: `{id: "angol"}`.
- `scripts/pcic-check.mjs`: audit (nincs üres `en`, nincs dupla `es`, id-formátum, `order` hézagmentes).
- `scripts/pcic-translate.py`: MEGÍRANDÓ, spec lent.

## Lépések
0. Kinyerés (nem LLM): `node scripts/pcic-b1.mjs`. Szabály-változás előtt a NYERS md-t nézd meg, ne a clean-t (2026-09-18: 3 kör ment el erre).
1. Hiány-lista: `python3 scripts/pcic-translate.py --missing` kiírja, hány tételnek nincs `en`-je (all id-k mínusz en-kulcsok, pattern kihagyva).
2. Becslés: `--dry-run` kiírja az adagok számát és a bemeneti karakterszámot, API-t nem hív. Gemini-árat a futtatás napján a Google ár-oldaláról, nem fejből.
3. Füst: `--limit 1` (egy adag, 200 tétel), utána `node scripts/pcic-check.mjs` és `--audit` 20 véletlen pár szemre.
4. Teljes futás: `python3 scripts/pcic-translate.py` a TE termináldból (`$GEMINI_API_KEY` a shellben; a Claude-sessionben a kulcs maszkolt, onnan nem megy). Adagonként azonnal ír a `b1-en.json`-ba, megszakítás után ugyanaz a parancs folytatja onnan, ahol abbamaradt.
5. Kapu: `node scripts/pcic-check.mjs` → `check OK`. Teljes futásnál a check a sample helyett az all-ra nézzen: `--all` kapcsoló a check-scriptbe, megírandó a translate-tel egy menetben.
6. Claude-audit: `--audit` 20 véletlen `es | en | section` sort ír ki, ezt bemásolod a chatbe; Claude a JSON-t nem olvassa. 2+ hiba a 20-ból → érintett adag újrafuttatása nagyobb kontextussal (headword mondata a prompt mellé).
7. Commit: `data/pcic/b1-en.json` + a script egy commitban, ág `feat/pcic-b1`.

## `scripts/pcic-translate.py` spec (Sonnet `iro` agentnek, egy menet)
- Minta: `~/code/summarize.py` (urllib, `gemini-2.5-flash`, kulcs `$GEMINI_API_KEY` vagy `$GOOGLE_API_KEY`, nincs SDK-függőség, csak stdlib).
- Bemenet: `data/pcic/<level>-all.json`, `data/pcic/<level>-<target>.json` (ha van). Kapcsolók: `--level b1` (alap), `--target en` (alap; `hu` is), `--batch 200`, `--limit N` (N adag), `--dry-run`, `--missing`, `--audit [N=20]`.
- Adag: 200 tétel, `kind` ≠ pattern, még nincs fordítása. Prompt: feladat (spanyol→angol, rövid szótári megfelelő; ige `to`-val, főnév névelő nélkül; `sentence`-nél teljes angol mondat; `phrase`-nél a kifejezés természetes megfelelője), tételenként `id | kind | section | es`. Kimenet: csak JSON objektum `{id: fordítás}`, semmi más (`responseMimeType: application/json` a kérésben).
- Hibatűrés: rossz JSON → 1 újrapróba fél adaggal (100), utána a hiányzó id-k a stderr-re, a többi adag megy tovább. HTTP 429 → 30 s várakozás, max 5 próba adagonként.
- Írás: minden adag után merge + `json.dump(ensure_ascii=False)`; a meglévő kulcsokat nem írja át, csak bővít. `b1-all.json` és `b1-sample.json` érintetlen.
- Kapu az agentnek: `python3 scripts/pcic-translate.py --dry-run` lefut kulcs nélkül; `node scripts/pcic-check.mjs` zöld marad; jest változatlan.

## Tilos
- Agent (Sonnet/Fable/Haiku) sessionben ne fordítson, és ne olvassa a `b1-all.json`-t (360K).
- Fordítás nélküli tétel ne kerüljön a fülre: a check-kapu véd, az app csak olyan id-t mutat, aminek van `en`-je.

## Más szint, más célnyelv
Ugyanez a lánc: A2/B2 = `--level a2|b2` (a kinyerőt a másik inventárium-fájlra kell paraméterezni), magyar mező = `--target hu` → `b1-hu.json`. Az app-oldal (fül, SM-2, `pcic_cards`) nem változik.

Leggyengébb pont: Gemini egy szót kontextus nélkül félrefordíthat (poliszémia), ezért megy a `section` és a `kind` a promptba, és ezért kötelező a 20-as szemre-audit minden futás után.
