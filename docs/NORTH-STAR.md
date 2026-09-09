# North star

The product rules the code is built to. Everything else in this repository is
an implementation detail that can change; these are the things a change should
not quietly break.

The maintainer's day-to-day working documents (`AGENTS.md`, `BUILD.md`,
`GAMES.md`, `BUGS.md`) are symlinks into a private repository and will be
missing from your clone. This file is the public stand-in: it carries what a
contributor actually needs, and it does not depend on those symlinks.

## One engine, not two

Kimacha is a vocabulary app in which grammar is what you *do* with the words,
not a second subject with its own tab. There is one card set, one spaced
repetition scheduler, and three item types on it:

| Type | What it asks | When it can appear |
| --- | --- | --- |
| `WORD` | recall the meaning | always |
| `FORM` | an inflected form of a known word (hablo / hablas / habla) | the base word is known |
| `SENTENCE` | build, order or complete a sentence | **every** word in it is known |

Two separate tabs would mean two schedulers, two content pipelines, and a
learner who parks on the easier one. If a proposal adds a parallel track for
grammar, it is going the wrong way.

## Never a sentence with an unknown word

This is the rule the content tooling exists to enforce, and the one that
generates most of the review comments.

- Every Spanish token in authored content is either taught by that level's
  cumulative vocabulary, or carries a gloss (`newWords`, `glossary`).
  `node scripts/audit-games.mjs` and `node scripts/audit-corpus.mjs` check it,
  and CI runs them.
- A sentence also stays inside the **grammar** its level teaches. A perfect
  tense in an A1 example sentence is a bug even when every word is known:
  `lib/grammar/tenseGate.ts` detects the structures, a test scans the corpus,
  and a runtime filter drops sentence cards whose grammar is still locked.

## Vocabulary ceiling

Levels follow XLex-style cumulative bands (A1 around 1200 words, C1 around
4000). C1 is the ceiling. C2 is frozen on purpose and is not extended.

## Content conventions

- **Data lives in JSON.** `data/words.ts`, `data/topics.ts` and friends hold
  types, imports and wiring only. A `.ts` file with word data in it will be
  asked to move.
- **Every user-facing string exists in four languages** (`hu`, `en`, `es`,
  `de`). A missing translation is a content bug, not a fallback.
- **A word corpus is never regenerated wholesale.** Word data cannot be
  reviewed by eye, so a regenerated file is an unreviewable diff. Add and edit
  entries; do not rewrite the file.
- **Every direction has its own word set.** There is no corpus shared between
  tracks. Even A0 is the target language's own hundred most useful words, not a
  common tourist set: what a beginner needs differs by language, and hu to en is
  not the same list as en to hu. Above A0 a track's words are the ones its exams
  ask for.
- **Language tracks do not touch each other's files.** A track owns
  `data/**/<lang>/` and `lib/i18n/<lang>.ts`. `data/words/{a0..c2}.json` is the
  Spanish track's set, still at the path it had before the other tracks existed.
  Shared *code* branches on lookup tables keyed by language code, so adding a
  language is a table entry rather than an edit inside a function someone else
  also edits.

## Releases

The APK is built locally by the maintainer and distributed by hand. `android/`
is not in this repository and the signing key exists on one machine, so the
release workflow is manual-dispatch only. A contributor never needs to build an
APK; the gate in `.github/CONTRIBUTING.md` is what a pull request has to pass.
