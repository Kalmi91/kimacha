@AGENTS.md

## Adat fájlok struktúra

Szókészlet és vizsga kérdések **szintenként külön JSON**:
- `data/words/a0.json` ... `data/words/c2.json` — szólisták
- `data/exams/a0.json` ... `data/exams/c2.json` — vizsga kérdések
- `data/topics/a1.json` — A1 topic definíciók (grammar topic unlock rendszer)
- `data/words.ts` / `data/exams.ts` / `data/topics.ts` — csak type + import + helper (NE IDE ÍRJ adatot)

Ha szót adsz hozzá → megfelelő szint JSON-ját szerkeszd, NE a .ts fájlt.

**A1 speciális:** topic-alapú unlock. Szavak `topic` + `topicOrder` mezővel. Részletek: TASK.md FELADAT 0.
