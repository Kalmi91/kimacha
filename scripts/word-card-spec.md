# Kimacha word-card generation spec (Spanish shared deck, B2/C1 expansion)

You generate Spanish vocabulary cards for a language-learning app. Source language
fields are Spanish (`es`); the learner may be Hungarian, English or German native.

## Output contract

Write ONE JSON file (UTF-8, array of objects) with the `Write` tool to the path given
in your task. Nothing else. Each object has EXACTLY these 8 keys, in this order:

```json
{
  "es": "la sostenibilidad",
  "hu": "fenntarthatóság",
  "en": "sustainability",
  "de": "Nachhaltigkeit",
  "sentence_es": "La sostenibilidad es clave para el futuro del planeta.",
  "sentence_hu": "A fenntarthatóság kulcsfontosságú a bolygó jövője szempontjából.",
  "sentence_en": "Sustainability is key to the future of the planet.",
  "sentence_de": "Nachhaltigkeit ist entscheidend für die Zukunft des Planeten."
}
```

No `id`, no `level`, the append script assigns those.

## Word-choice rules

- Deliver EXACTLY the number of cards your task states. Count them before writing.
- Nouns: `es` carries the definite article (`el` / `la` / `los` / `las`), so the
  learner sees the gender. Verbs: infinitive. Adjectives: masculine singular.
  Adverbs / connectors / fixed expressions: as used.
- Level-appropriate for the band your task names (see below). A card that a
  beginner would already know is a wasted slot.
- **No duplicates** against `existing_es.txt` (path in your task). Check both the
  exact string and the bare form without article: if `el mercado` is in the file,
  neither `el mercado` nor `mercado` may be emitted. Also no duplicates inside your
  own file.
- Skip: proper nouns, brand names, vulgar or offensive words, regional slang,
  narrow technical jargon a general learner never meets, and pure inflected forms
  of a verb already in the deck (teach the infinitive, not `pudiera`).
- Prefer words that carry their weight: high utility in reading a newspaper,
  following a discussion, writing a formal email.

## Band definitions

- **B2** (upper-intermediate): abstract but everyday-adjacent vocabulary. The
  learner can already discuss family, work, travel, health at a simple level; B2
  adds nuance, opinion, cause and consequence, institutions, moderately formal
  register.
- **C1** (advanced): precise, abstract, often formal or literary vocabulary.
  Nuanced synonyms, academic and administrative register, figurative senses,
  discourse connectors, verbs with fine shades of meaning.

## Translation rules

- `hu`: idiomatic Hungarian, never a word-for-word calque. Nouns bare (no `a`/`az`).
- `en`: idiomatic English, bare noun (no `the`).
- `de`: German noun **capitalised, without an article** (`Nachhaltigkeit`, NOT
  `die Nachhaltigkeit`). Verbs in the infinitive.
- When a word has two clearly distinct useful senses, you may write
  `sense one / sense two` in `hu` / `en` / `de`, keep the same order in all three.

## Sentence rules

- All four `sentence_*` fields say the SAME thing; they are translations of one
  another, not four different examples.
- 4–12 words, natural, contemporary, and they must actually contain the card's own
  word (in Spanish the word may appear inflected, that is fine and expected).
- The sentence should make the meaning guessable from context.
- `sentence_hu` idiomatic Hungarian; `sentence_de` grammatically correct German
  with the right article and case.
- No proper nouns, no politics of the day, no offensive content.

## Quality gate before you write

1. Exact card count matches the task.
2. Valid JSON, parses as an array (verify by running
   `node -e 'JSON.parse(require("fs").readFileSync("<your file>","utf8")).length'`).
3. All 8 fields present and non-empty on every card.
4. No duplicate `es` inside the file, none against `existing_es.txt`.
5. German nouns carry no leading article.

Report back only: the file path, the card count, and anything you had to skip.
