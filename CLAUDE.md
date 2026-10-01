@AGENTS.md

<!-- Issue #3: az `AGENTS.md` symlink egy privát repóba, tehát friss klónban
     hiányzik, és a fenti import némán elmarad. Ami belőle egy közreműködőnek
     tényleg kell, az a publikus `docs/NORTH-STAR.md`-ben van. -->

## Észak-csillag (a tanulási modell végcélja)

Minden Kimacha-munka ehhez mérendő, teljes spec: `AGENTS.md` „🧭 ÉSZAK-CSILLAG" szekció.
Egy motor (`WORD` / `FORM` / `SENTENCE` item-típus, egy SRS, egy ütemező), nyelvtan-unlock
a patternhez kellő szavak ismertségére (nem globális szószám-szintre), a váltakozást az
ütemező dönti (nincs mód-gomb), és soha nincs mondat ismeretlen szóval.
Külön nyelvtani rész: ENGEDÉLYEZVE (2026-09-08), egy korpusszal és második SRS nélkül.
A modell CÉL, a FORM/SENTENCE/ütemező design-first.

## Adat fájlok struktúra

Szókészlet és vizsga kérdések **szintenként külön JSON**:
- `data/words-open/{a1,a2,b1,b2}.json` — a spanyol szólista (en→es, a spanyol szavak egyetlen forrása); `data/words/en/*.json` — az angol sáv (es→en)
- `data/exams/a0.json` ... `data/exams/c2.json` — vizsga kérdések
- `data/topics/a1.json` — A1 topic definíciók (grammar topic unlock rendszer)
- `data/words.ts` / `data/exams.ts` / `data/topics.ts` — csak type + import + helper (NE IDE ÍRJ adatot)

Ha szót adsz hozzá → megfelelő szint JSON-ját szerkeszd (words-open: `scripts/words-open-check.mjs` kapu), NE a .ts fájlt.

**A1 speciális:** topic-alapú unlock. Szavak `topic` + `topicOrder` mezővel. Részletek: TASK.md FELADAT 0.
