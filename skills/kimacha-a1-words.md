---
name: kimacha-a1-words
description: >
  Token-burn skill for expanding the Kimacha A1 Spanish vocabulary from 507 to 800
  words. Generates batches of new A1 words following TASK.md rules, deduplicates
  against all levels, and appends to data/words/a1.json. Also updates
  data/topics/a1.json when new topics are introduced.
  Trigger: "burn A1 words", "expand A1", "kimacha word expansion", "/kimacha-a1-words".
user-invocable: true
---

# Kimacha A1 Word Expansion (507 → 800)

Batch-fill `data/words/a1.json` with new A1 Spanish vocabulary following the
schema and rules in AGENTS.md §8b. Target: 800 words total (+293 from the current 507).

## Pre-flight checks

1. Count current A1 words:
   ```bash
   python3 -c "import json; d=json.load(open('data/words/a1.json')); print('current:', len(d), 'target: 800, need:', 800-len(d))"
   ```

2. Find the highest existing ID (to continue the sequence):
   ```bash
   python3 -c "import json; d=json.load(open('data/words/a1.json')); print('max id:', max(w['id'] for w in d))"
   ```

3. Build the full dedup set (all words across all levels, to avoid collisions):
   ```bash
   python3 -c "
   import json, glob
   all_es = set()
   for f in glob.glob('data/words/*.json'):
       for w in json.load(open(f)):
           all_es.add(str(w.get('es','')).lower())
   print('total existing es words:', len(all_es))
   "
   ```

## Word generation rules (MANDATORY)

Every new card must follow these rules exactly (from AGENTS.md §8b):

- **Schema**: `id, level:"A1", es, hu, en, de, topic, topicOrder, sentence_es,
  sentence_hu, sentence_en, sentence_de` — all 12 fields, all 4 languages.
- **Nouns**: always include article (`el/la/los/las`).
- **Verbs**: infinitive form (except grammar-topic conjugated forms).
- `sentence_hu` / `sentence_en`: idiomatic, NOT mirror translation.
- Sentences: present tense + `ir a + inf` near future; max 8-10 words.
- **Dedup**: no word that already exists in any level (check the es field).
- No proper nouns, no exotic/rare words — standard A1 vocabulary.
- IDs: continue from `max(current_id) + 1`.
- `topicOrder`: 1-based, continuous within each topic.

## Batch workflow

1. **Smoke test** (1 word): generate 1 word for topic `salud`, verify schema, check dedup.
2. **State file**: write `$TMPDIR/a1_expansion_state.json` with `{done: N, next_topic: X, next_id: Y}`.
3. **Batch loop**: generate 20-30 words per batch, append to `data/words/a1.json`, update state.
4. After each batch: `npx tsc --noEmit` must stay green (baseline errors only).
5. Stop when `len(a1.json) == 800`.

## Topic plan for +293 words

| Topic ID         | Approx words | Notes |
|-----------------|-------------|-------|
| familia         | +10         | expand existing (bővítés) |
| emociones       | +8          | expand existing |
| compras         | +10         | expand existing |
| animales        | +8          | expand existing |
| adjetivos_basicos | +10       | expand existing |
| verbos_cotidianos | +10       | expand existing |
| salud           | 20          | new topic (order 39) |
| dinero_banco    | 15          | new topic (order 40) |
| ocio            | 20          | new topic (order 41) |
| viajes          | 20          | new topic (order 42) |
| oficina_trabajo | 15          | new topic (order 43) |
| rutina_diaria   | 15          | new topic (order 44) |
| ir_a_inf        | 8           | new grammar topic (order 45) |
| comparativos    | 6           | new grammar topic (order 46) |
| **Pad/flex**    | ~98         | distribute across topics to hit 800 |

**New topics are already scaffolded in `data/topics/a1.json` (orders 39-46).**
When generating for a new topic, verify it exists in topics/a1.json.

## Commit per batch

After every successful batch (schema valid + tsc clean + dedup clean):
```bash
git add data/words/a1.json && git commit -m "feat(content): A1 word expansion batch N/M (total: X/800)"
```

## Acceptance

- `data/words/a1.json` has exactly 800 entries.
- All entries pass schema validation (all 12 fields present, non-empty).
- No duplicate `es` values within A1 or across all levels.
- `data/topics/a1.json` contains all topics referenced by the new words.
- `npx tsc --noEmit` baseline error count unchanged.
- The app's learn loop and `buildExam('A1', ...)` work with 800 words.
